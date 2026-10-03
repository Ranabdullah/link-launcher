const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const workspace='Name each workspace, such as Home PC or Work laptop, and save its profiles. In a new browser, open Choose profiles for this device and select Home PC from Saved workspace to reuse its selection. Names and selections sync in your encrypted vault; the browser remembers your chosen workspace locally. Incognito cannot identify the physical PC and forgets that local choice when closed.';
const remember='Select Keep this browser unlocked only on your own trusted browser. It remembers the password locally using a browser encryption key, for up to 90 days. Anyone who can open that browser can access the vault. Lock or Log Out removes remembered access. Incognito forgets it when closed.';
const routing='To open each account in its assigned Chrome or Edge profile, open Browser profiles and download the extension and Windows helper. Extract browser-bridge.zip into a permanent folder; load the extension through chrome://extensions or edge://extensions. Double-click Setup.cmd from the extracted setup folder. It downloads a private verified runtime if needed. Reload the extension and refresh the app. In Browser profiles, select the actual browser profile for each account and save. One exact, unambiguous browser email match is also recognised automatically on Run. Missing assignments leave links closed instead of opening a default profile. The helper saves assignments only on this PC and can open a closed profile without a Link Launcher EXE. Install the extension in each profile where you run the app; install the helper once per Windows user. On phones, links use the current mobile browser. Browser names/emails are read locally; passwords, cookies and vault collections are not read by the helper.';
const own='For your own HTTPS deployment, edit the first matches entry in the extracted extension manifest.json to your actual app origin plus /*, then reload the extension. The buyer ZIP includes a placeholder origin and localhost support only.';
let html=fs.readFileSync(path.join(root,'commercial/START-HERE.html'),'utf8');
html=html.replace('<section><h2>4. Keep access to your data</h2>',`<section><h2>Saved workspaces and browser links</h2><p>${workspace}</p><p>${remember}</p><p>${routing}</p><p>${own}</p><p><a href="web/browser-bridge.zip">Download the browser extension</a></p></section><section><h2>4. Keep access to your data</h2>`);
fs.writeFileSync(path.join(root,'commercial/START-HERE.html'),html);
let cloud=fs.readFileSync(path.join(root,'commercial/OWN-CLOUD.md'),'utf8');
cloud+='\n## Saved workspaces, automatic unlock and browser links\n\n'+[workspace,remember,routing,own].join('\n\n')+'\n';
cloud=cloud.replace('The master password stays in browser memory while unlocked.','The master password stays in browser memory while unlocked; optional trusted-browser unlock keeps an encrypted local copy with a browser-held key.');
fs.writeFileSync(path.join(root,'commercial/OWN-CLOUD.md'),cloud);
let readme=fs.readFileSync(path.join(root,'README.md'),'utf8').replaceAll('Commercial-2.1.0','Commercial-2.1.4');
readme+='\n## Browser continuity and link routing\n\n'+[workspace,remember,routing].join('\n\n')+'\n';
fs.writeFileSync(path.join(root,'README.md'),readme);
for(const name of ['START-HERE.html','OWN-CLOUD.md'])fs.copyFileSync(path.join(root,'commercial',name),path.join(root,'sale-dist/Link-Launcher-Commercial-2.1.4',name));
for(const file of ['scripts/build-commercial.cjs','sale-dist/Link-Launcher-Commercial-2.1.4/web/sw.js']) {
 const f=path.join(root,file);fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('commercial-v2','commercial-v3'));
}
