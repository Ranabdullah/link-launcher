const app=chrome.runtime.getManifest().content_scripts[0].matches[0].replace(/\/\*$/,'/');
const link=document.getElementById('openApp');
if(app.includes('your-own-link-launcher.example')){link.href='http://localhost:4783/';link.textContent='Open local Link Launcher';}else link.href=app;
