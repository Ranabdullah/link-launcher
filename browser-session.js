// Optional automatic unlock on a trusted browser. Nothing in this store is sent to the cloud.
// This does not protect an unlocked/shared computer or against malicious same-origin code.
const rememberedBrowser = (() => {
  let queue = Promise.resolve(), generation = 0;
  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dreamslab-trusted-browser-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('session');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function operation(mode, callback) {
    const db = await database();
    try { return await new Promise((resolve,reject) => {
      const tx = db.transaction('session',mode), request=callback(tx.objectStore('session'));
      let result; request.onsuccess=()=>{result=request.result};
      tx.oncomplete=()=>resolve(result); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    }); } finally {db.close();}
  }
  function forget() {
    generation++;
    queue=queue.catch(()=>{}).then(()=>operation('readwrite',store=>store.clear()));
    return queue;
  }
  function save(mode='cloud') {
    const email=currentUserEmail, password=currentPassword, api=cloudApiUrl, stamp=generation;
    if (!document.getElementById('rememberBrowser')?.checked || !password) return forget();
    queue=queue.catch(()=>{}).then(async()=>{
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(location.origin)},key,new TextEncoder().encode(password));
      if(stamp!==generation || currentUserEmail!==email || currentPassword!==password)return;
      await operation('readwrite',store=>store.put({email,api,mode,key,iv,ciphertext,expires:Date.now()+90*86400000},'active'));
    });
    return queue;
  }
  async function restore() {
    try {
      const record=await operation('readonly',store=>store.get('active'));
      if(!record)return;
      if(record.expires<Date.now() || record.api!==cloudApiUrl){await forget();return;}
      // Commercial builds may only restore after their licence gate has authorised the browser.
      if(window.LINK_LAUNCHER_ACTIVATED===false)return;
      const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(location.origin)},record.key,record.ciphertext);
      const credentials={email:record.email,password:new TextDecoder().decode(clear)};
      document.getElementById('rememberBrowser').checked=true;
      if(record.mode==='local')await openOfflineVault(null,credentials);
      else await handleUnlock(null,credentials);
      if(!currentPassword)await forget();
    } catch {await forget().catch(()=>{});}
  }
  return {save,forget,restore};
})();

function selectBrowserWorkspace() {
  const id=document.getElementById('savedDeviceWorkspace').value;
  const physical=getDeviceId();
  if(id!==physical && !(vaultData.devices||[]).some(d=>d.id===id))return;
  currentDeviceId=id;
  localStorage.setItem('dreamslab_workspace_'+currentUserEmail,id);
  filterToLocalOnly=true; localStorage.setItem('dreamslab_filter_scope','local');
  activeProfileEmail=null; selectedLinkIds.clear();
  openDeviceProfilesModal(); renderApp();
}
function restoreBrowserWorkspace() {
  const saved=localStorage.getItem('dreamslab_workspace_'+currentUserEmail);
  currentDeviceId=saved && (vaultData.devices||[]).some(d=>d.id===saved)?saved:getDeviceId();
}
window.addEventListener('DOMContentLoaded',()=>rememberedBrowser.restore());
window.addEventListener('link-launcher-activated',()=>rememberedBrowser.restore());
