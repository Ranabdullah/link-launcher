let browserBridgeReady=false;
const bridgeRequests=new Map();
function browserBridgeRequest(action,payload={}){return new Promise(resolve=>{
  const id=crypto.randomUUID(),timer=setTimeout(()=>{bridgeRequests.delete(id);resolve(null)},action==='ping'?1500:8000);
  bridgeRequests.set(id,response=>{clearTimeout(timer);bridgeRequests.delete(id);resolve(response)});
  window.postMessage({channel:'dreamslab-browser-bridge',id,action,...(typeof payload==='string'?{url:payload}:payload)},location.origin);
});}
window.addEventListener('message',event=>{
  if(event.source===window&&event.origin===location.origin&&event.data?.channel==='dreamslab-browser-bridge-reply')bridgeRequests.get(event.data.id)?.(event.data);
});
function mobileBrowser(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function routingAccountKey(profile){return String(profile.id||'email:'+String(profile.email||'').trim().toLowerCase());}
async function showBrowserRouting(){
  const state=document.getElementById('browserRoutingState'),list=document.getElementById('browserProfileAssignments'),save=document.getElementById('saveBrowserProfiles');
  list.replaceChildren();save.hidden=true;state.textContent='Checking this computer…';openModal('browserRoutingModal');selectRoutingTab('Profiles');
  const response=await browserBridgeRequest('ping');browserBridgeReady=!!response?.ready;
  if(!browserBridgeReady||Number(response.version?.split('.')[1]||0)<1){state.textContent='Update or reload the browser extension, then refresh this app. Assigned links stay closed until their browser profile is available.';selectRoutingTab('Setup');return;}
  const account=currentUserEmail;
  const result=await browserBridgeRequest('bindings',{account});
  if(account!==currentUserEmail)return;
  if(!result?.profiles){state.textContent=result?.error||'Run Setup.cmd from the download, then reload the extension.';selectRoutingTab('Setup');return;}
  state.textContent='Choose the actual browser profile for each account. These choices are saved on this computer and used from any browser with the extension.';
  document.getElementById('browserRoutingButton').textContent='Browser profiles: ready';
  for(const profile of vaultData.profiles||[]){
    const label=document.createElement('label');label.className='browser-profile-assignment';
    const name=document.createElement('span');name.textContent=profile.name+' — '+(profile.email||'No email');
    const select=document.createElement('select');select.dataset.profileKey=routingAccountKey(profile);select.setAttribute('aria-label','Browser for '+profile.name);
    const empty=document.createElement('option');empty.value='';empty.textContent='Choose a browser profile';select.append(empty);
    for(const browser of result.profiles){const option=document.createElement('option');option.value=browser.id;option.textContent=browser.browser+' · '+browser.name+(browser.email?' · '+browser.email:'');select.append(option);}
    const stored=result.bindings?.[select.dataset.profileKey];
    const matches=result.profiles.filter(p=>profile.email&&p.email.trim().toLowerCase()===profile.email.trim().toLowerCase());
    select.value=stored|| (matches.length===1?matches[0].id:'');
    if(stored&&!result.profiles.some(p=>p.id===stored)){const missing=document.createElement('option');missing.value=stored;missing.textContent='Previous browser profile was removed — choose another';select.append(missing);select.value=stored;}
    label.append(name,select);list.append(label);
  }
  save.hidden=false;
  save.onclick=async()=>{save.disabled=true;try{
    if(account!==currentUserEmail){closeModal('browserRoutingModal');return;}
    const bindings=Object.fromEntries([...list.querySelectorAll('select')].map(s=>[s.dataset.profileKey,s.value]));
    const saved=await browserBridgeRequest('bind',{account,bindings});
    if(saved?.saved){closeModal('browserRoutingModal');showToast('Browser profiles saved on this computer.');}else state.textContent=saved?.error||'Could not save browser profiles. Reload the extension and try again.';
  }finally{save.disabled=false;}};
}
openDirectTab=async function(value){
  const url=safeLinkUrl(value);if(!url){showToast('Enter a valid HTTP or HTTPS link.');return;}
  if(browserBridgeReady&&!mobileBrowser()){const result=await browserBridgeRequest('open',url);if(result?.opened){showToast('Opened in this browser profile.');return;}showToast(result?.error||'Browser extension disconnected. Reload the app.');return;}
  if(!mobileBrowser()&&window.matchMedia('(display-mode: standalone)').matches){showBrowserRouting();showToast('Enable the extension to open links in this browser.');return;}
  window.open(url,'_blank','noopener,noreferrer');showToast('Requested a new tab in this browser.');
};
async function openAssignedLink(item){
  const url=safeLinkUrl(item?.url);if(!url){showToast('Enter a valid HTTP or HTTPS link.');return;}
  if(mobileBrowser()){openDirectTab(url);return;}
  const profile=(vaultData.profiles||[]).find(p=>p.id===item.profileId)|| (vaultData.profiles||[]).find(p=>item.profileEmail&&p.email?.toLowerCase()===item.profileEmail.toLowerCase());
  if(!profile&&!item.profileEmail){openDirectTab(url);return;}
  const ping=await browserBridgeRequest('ping');browserBridgeReady=!!ping?.ready;
  if(!browserBridgeReady||Number(ping.version?.split('.')[1]||0)<1){await showBrowserRouting();showToast('Update the extension and connect the profile helper. This link was not opened.');return;}
  const result=await browserBridgeRequest('profile-open',{account:currentUserEmail,profileKey:routingAccountKey(profile||{email:item.profileEmail}),profileEmail:profile?.email||item.profileEmail||'',url});
  if(result?.opened){showToast('Requested in '+result.browser+' · '+result.profile+'.');return;}
  await showBrowserRouting();showToast(result?.error||'The profile helper did not respond. This link was not opened.');
}
window.addEventListener('DOMContentLoaded',async()=>{const response=await browserBridgeRequest('ping');browserBridgeReady=!!response?.ready;document.getElementById('browserRoutingButton').textContent=browserBridgeReady?'Browser profiles':'Browser profiles: setup';});

function selectRoutingTab(name,focus=false){for(const tab of ['Profiles','Setup','Help']){const selected=tab===name,button=document.getElementById('routingTab'+tab);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;document.getElementById('routingPanel'+tab).hidden=!selected;if(selected&&focus)button.focus();}}
window.addEventListener('DOMContentLoaded',()=>{document.querySelector('#browserRoutingModal [role="tablist"]').addEventListener('keydown',event=>{const tabs=['Profiles','Setup','Help'];const index=tabs.findIndex(name=>event.target.id==='routingTab'+name);if(index<0)return;let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();selectRoutingTab(tabs[next],true);});});
