window.addEventListener('message',event=>{
  if(event.source!==window || event.origin!==location.origin)return;
  const message=event.data;
  if(!message || message.channel!=='dreamslab-browser-bridge' || typeof message.id!=='string' || message.id.length>100)return;
  const types={ping:'dreamslab-bridge-ping',open:'dreamslab-bridge-open',profiles:'dreamslab-bridge-profiles',bindings:'dreamslab-bridge-bindings',bind:'dreamslab-bridge-bind','profile-open':'dreamslab-bridge-profile-open'};
  if(!types[message.action])return;
  chrome.runtime.sendMessage({type:types[message.action],url:message.url,account:message.account,bindings:message.bindings,profileKey:message.profileKey,profileEmail:message.profileEmail},response=>{
    const error=chrome.runtime.lastError;
    window.postMessage({...response,channel:'dreamslab-browser-bridge-reply',id:message.id,error:error?'Reload the app after enabling the extension.':response?.error},location.origin);
  });
});
