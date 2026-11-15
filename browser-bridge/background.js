function trustedSender(sender) {
  try {
    const source=new URL(sender.url);
    return sender.id===chrome.runtime.id && chrome.runtime.getManifest().content_scripts[0].matches.some(match=>{
      const entry=new URL(match.replace(/\*$/,''));
      return entry.protocol===source.protocol && entry.hostname===source.hostname && (entry.hostname==='localhost'||entry.hostname==='127.0.0.1'||entry.port===source.port);
    });
  } catch {return false;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!trustedSender(sender))return;
  if(message?.type==='dreamslab-bridge-ping'){respond({ready:true,version:chrome.runtime.getManifest().version});return;}
  const commands={'dreamslab-bridge-profiles':'list','dreamslab-bridge-bindings':'bindings','dreamslab-bridge-bind':'bind','dreamslab-bridge-profile-open':'open','dreamslab-bridge-profile-manage':'manage'};
  if(commands[message?.type]){
    chrome.runtime.sendNativeMessage('com.dreamslab.linklauncher',{command:commands[message.type],account:message.account,bindings:message.bindings,profileKey:message.profileKey,profileEmail:message.profileEmail,target:message.target,url:message.url},response=>{
      const error=chrome.runtime.lastError;
      respond(error?{helperReady:false,opened:false,error:'The profile helper is not connected. Double-click Setup.cmd from the download, then reload this extension.'}:response);
    });return true;
  }
  if(message?.type!=='dreamslab-bridge-open')return;
  let url;try{url=new URL(message.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();}catch{respond({opened:false,error:'Invalid website address.'});return;}
  // tabs.create runs inside this extension's browser profile. It cannot switch profiles.
  chrome.tabs.create({url:url.href,active:true},tab=>{
    const error=chrome.runtime.lastError;
    respond(error?{opened:false,error:'This browser could not open the link.'}:{opened:!!tab});
  });
  return true;
});
