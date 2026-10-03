function automaticColour(key){let hash=0;for(const char of String(key))hash=((hash<<5)-hash+char.charCodeAt(0))|0;return GOOGLE_AVATAR_COLORS[Math.abs(hash)%GOOGLE_AVATAR_COLORS.length];}
function categoryColour(category){const value=Object.hasOwn(vaultData.categoryColors||{},category)?vaultData.categoryColors[category]:'';return /^#[0-9a-f]{6}$/i.test(value)?value:automaticColour(category);}
function appearanceModal(id,title){
 let modal=document.getElementById(id);if(modal)return modal;
 modal=document.createElement('div');modal.id=id;modal.className='modal-overlay';
 const card=document.createElement('div');card.className='modal-card';
 const header=document.createElement('div');header.className='modal-header';const heading=document.createElement('h2');heading.className='modal-title';heading.textContent=title;const close=document.createElement('button');close.className='modal-close-btn';close.setAttribute('aria-label','Close');close.textContent='×';close.onclick=()=>closeModal(id);header.append(heading,close);
 const body=document.createElement('div');body.className='modal-body';card.append(header,body);modal.append(card);document.body.append(modal);return modal;
}
function openAppearance(kind,key,event){
 event?.stopPropagation();const account=currentUserEmail,modal=appearanceModal('appearanceModal','Choose colours'),body=modal.querySelector('.modal-body');body.replaceChildren();
 const caption=document.createElement('p');caption.textContent='A subtle colour helps identify accounts and category tabs. These choices are saved in your encrypted vault.';
 const target=document.createElement('select');target.id='appearanceTarget';target.className='input-google';target.setAttribute('aria-label',kind==='profile'?'Account':'Category');
 const choices=kind==='profile'?sortAndFilterProfiles(vaultData.profiles||[]):['ALL',...new Set(vaultData.categories||[])];
 for(const item of choices){const option=document.createElement('option');option.value=kind==='profile'?item.id:item;option.textContent=kind==='profile'?(item.name||item.email)+(item.email?' — '+item.email:''):(item==='ALL'?'All items':item);target.append(option);}
 if(kind==='profile'){const selected=choices.find(p=>p.id===key||p.email===key);if(selected)target.value=selected.id;}
 const colour=document.createElement('input');colour.type='color';colour.id='appearanceColour';colour.setAttribute('aria-label','Colour');
 const preview=document.createElement('div');preview.className='colour-preview';preview.textContent='Preview';
 const update=()=>{colour.value=kind==='profile'?getProfileMeta(choices.find(p=>p.id===target.value)?.email,choices.find(p=>p.id===target.value)?.name,target.value).color:categoryColour(target.value);preview.style.background=colour.value+'18';preview.style.borderColor=colour.value;};target.onchange=update;colour.oninput=()=>{preview.style.background=colour.value+'18';preview.style.borderColor=colour.value;};
 const palette=document.createElement('div');palette.className='colour-palette';for(const value of GOOGLE_AVATAR_COLORS){const button=document.createElement('button');button.className='colour-swatch';button.style.background=value;button.setAttribute('aria-label','Use colour '+value);button.onclick=()=>{colour.value=value;colour.oninput();};palette.append(button);}
 const actions=document.createElement('div');actions.className='appearance-actions';const reset=document.createElement('button');reset.className='btn-secondary';reset.textContent='Automatic colour';reset.onclick=()=>{const p=choices.find(p=>p.id===target.value);colour.value=automaticColour(kind==='profile'?(p?.email||p?.id||p?.name):target.value);colour.oninput();};
 const save=document.createElement('button');save.className='btn-primary';save.textContent='Save colour';save.onclick=async()=>{if(account!==currentUserEmail||!/^#[0-9a-f]{6}$/i.test(colour.value))return;save.disabled=true;try{if(kind==='profile'){const p=vaultData.profiles.find(p=>p.id===target.value);if(!p)return;p.color=colour.value;p.updatedAt=new Date().toISOString();}else{vaultData.categoryColors={...vaultData.categoryColors,[target.value]:colour.value};}const result=await saveVault();if(!result.success&&!result.localSaved)return;renderApp();closeModal('appearanceModal');showToast('Colour saved.');}finally{save.disabled=false;}};actions.append(reset,save);
 body.append(caption,target,colour,palette,preview,actions);if(!choices.length){save.disabled=true;caption.textContent='Add an account first, or use Find browser profiles on this PC.';}update();openModal('appearanceModal');
}
function updateAddLinkPreview(){const value=document.getElementById('newLinkProfileSelect').value,p=(vaultData.profiles||[]).find(p=>(p.email||p.id)===value);document.getElementById('addLinkRoutingPreview').textContent=p?'Desktop Run uses the browser assigned to '+(p.name||p.email)+'. Change it in Browser profiles.':'Unassigned links open in the browser you use here.';}
const openAddLinkOriginal=openAddLinkModal;
openAddLinkModal=function(){openAddLinkOriginal();updateAddLinkPreview();};
const renderProfilesOriginal=renderSidebarProfiles;
renderSidebarProfiles=function(){renderProfilesOriginal();const all=document.getElementById('btnFilterProfAll');if(all){all.textContent='All accounts';all.title='Show all accounts in the current device scope';all.classList.toggle('active',sidebarProfileFilter==='ALL'&&!activeProfileEmail);all.setAttribute('aria-pressed',String(sidebarProfileFilter==='ALL'&&!activeProfileEmail));}};
let discoveredBrowserProfiles=[];
async function findBrowserProfiles(){
 const account=currentUserEmail,modal=appearanceModal('findProfilesModal','Browser profiles on this PC'),body=modal.querySelector('.modal-body');body.textContent='Checking this PC…';openModal('findProfilesModal');
 const ping=await browserBridgeRequest('ping');if(!ping?.ready||Number(ping.version?.split('.')[1]||0)<1){showProfileSetupNotice(body,'Update the browser extension and install the helper first.');return;}
 const result=await browserBridgeRequest('profiles');if(account!==currentUserEmail)return;
 if(!result?.profiles){showProfileSetupNotice(body,result?.error||'The local helper is not available.');return;}
 discoveredBrowserProfiles=result.profiles;body.replaceChildren();
 const caption=document.createElement('p');caption.textContent='Choose missing profiles to add to your account. Their names and emails will be saved in your encrypted vault; their browser locations and routing choices stay on this PC.';
 const list=document.createElement('div');list.className='device-profile-choices';let missing=0;
 const existing=await browserBridgeRequest('bindings',{account});if(account!==currentUserEmail)return;
 if(!existing?.bindings){body.textContent=existing?.error||'The helper could not load saved browser assignments. Reload the extension and try again.';return;}
 for(const detected of result.profiles){const saved=(vaultData.profiles||[]).find(p=>(detected.email&&p.email?.trim().toLowerCase()===detected.email.trim().toLowerCase())||existing?.bindings?.[routingAccountKey(p)]===detected.id);
  const label=document.createElement('label');label.className='device-profile-choice';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=detected.id;checkbox.disabled=!!saved;checkbox.checked=false;
  const name=document.createElement('span'),title=document.createElement('strong'),email=document.createElement('small');title.textContent=detected.browser+' · '+detected.name;email.textContent=(detected.email||'No browser email')+(saved?' · Already saved':' · Not in your vault');name.append(title,email);label.append(checkbox,name);list.append(label);if(!saved)missing++;
 }
 const status=document.createElement('p');status.textContent=result.profiles.length+' browser profiles detected here; '+missing+' missing from your saved accounts.';status.setAttribute('role','status');
 const save=document.createElement('button');save.className='btn-primary';save.textContent='Add selected accounts';save.disabled=missing===0;
 save.onclick=async()=>{if(account!==currentUserEmail)return;const selected=[...list.querySelectorAll('input:checked:not(:disabled)')].map(input=>result.profiles.find(p=>p.id===input.value));if(!selected.length){showToast('Select a missing profile first.');return;}save.disabled=true;
  try{const bindings={...existing?.bindings};for(const detected of selected){let p=detected.email?(vaultData.profiles||[]).find(p=>p.email?.trim().toLowerCase()===detected.email.trim().toLowerCase()):null;if(!p){p={id:'prof_'+crypto.randomUUID(),name:detected.name,email:detected.email||'',deviceIds:[currentDeviceId],color:automaticColour(detected.email||detected.id),updatedAt:new Date().toISOString()};vaultData.profiles.push(p);}bindings[routingAccountKey(p)]=detected.id;}
   const saved=await saveVault();if(!saved.success&&!saved.localSaved)return;const bound=await browserBridgeRequest('bind',{account,bindings});sidebarProfileFilter='ALL';activeProfileEmail=null;renderApp();closeModal('findProfilesModal');showToast(bound?.saved?'Accounts added and assigned to their browsers.':'Accounts saved. Open Browser profiles to finish assigning them.');
  }finally{save.disabled=false;}
 };
 body.append(caption,status,list,save);
}

function showProfileSetupNotice(body,message){body.replaceChildren();const text=document.createElement('p');text.textContent=message;const setup=document.createElement('button');setup.className='btn-primary';setup.textContent='Open setup';setup.onclick=()=>{closeModal('findProfilesModal');showBrowserRouting();};body.append(text,setup);}
