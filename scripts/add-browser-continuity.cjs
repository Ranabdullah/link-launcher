const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
function edit(file,fn){const f=path.join(root,file);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))}
function replace(s,from,to){if(!s.includes(from))throw new Error('Missing edit anchor: '+from.slice(0,65));return s.replace(from,to)}
edit('index.html',s=>{
s=replace(s,'<p style="font-size:12px;color:var(--text-muted)">Your master password stays in this browser while unlocked. You need it when reopening the app; encrypted links cannot be recovered without it.</p>','<label style="font-size:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="rememberBrowser">Keep this browser unlocked</label><p style="font-size:12px;color:var(--text-muted)">Use only on your own trusted browser: anyone opening it can access your vault. Your password is remembered locally with a browser encryption key, never sent to the cloud. Lock or Log Out removes it. Incognito windows forget it when closed.</p>');
s=replace(s,'async function handleUnlock(event) {','async function handleUnlock(event, rememberedCredentials) {');
s=replace(s,"const email = document.getElementById('userEmailInput').value.trim().toLowerCase();\n      const pass = document.getElementById('masterPasswordInput').value;", "const email = (rememberedCredentials?.email || document.getElementById('userEmailInput').value).trim().toLowerCase();\n      const pass = rememberedCredentials?.password || document.getElementById('masterPasswordInput').value;");
s=replace(s,"cloudAuthToken = token; cloudVaultVersion = version || 1;\n        normalizeVaultLinks();","cloudAuthToken = token; cloudVaultVersion = version || 1;\n        normalizeVaultLinks(); restoreBrowserWorkspace();");
s=replace(s,'if (token && meta.dirty && !conflict) await saveVault();',"if (token && meta.dirty && !conflict) await saveVault();\n        try { await rememberedBrowser.save('cloud'); } catch { showToast('Opened. This browser could not remember the unlock.'); }");
s=replace(s,'function lockVault() {',"async function lockVault() {\n      await rememberedBrowser.forget();\n      document.getElementById('rememberBrowser').checked=false;\n      await saveQueue;");
s=replace(s,'async function handleLogout() {',"async function handleLogout() {\n      await rememberedBrowser.forget();\n      document.getElementById('rememberBrowser').checked=false;");
s=replace(s,'async function confirmResetLocalVault() {',"async function confirmResetLocalVault() {\n      await rememberedBrowser.forget();\n      document.getElementById('rememberBrowser').checked=false;");
s=replace(s,'// Note: Lock does NOT delete secure_session.dat - it only locks the screen','// Explicit lock removes automatic browser unlock.');
s=replace(s,'function openDeviceProfilesModal() {',`function openDeviceProfilesModal() {
      const picker=document.getElementById('savedDeviceWorkspace'), physical=getDeviceId();
      const entries=[...(vaultData.devices||[])];
      if(!entries.some(d=>d.id===physical))entries.unshift({id:physical,name:'New workspace for this browser'});
      picker.replaceChildren(...entries.map(d=>{const option=document.createElement('option');option.value=d.id;option.textContent=d.name||('Unnamed workspace — '+d.id.slice(0,8));option.selected=d.id===currentDeviceId;return option;}));`);
s=replace(s,'<label class="field-label" for="deviceDisplayName">Device name (optional)</label>','<label class="field-label" for="savedDeviceWorkspace">Saved device workspace</label><select id="savedDeviceWorkspace" class="input-google" onchange="selectBrowserWorkspace()"></select><p>Choose Home PC or another saved workspace to reuse its profiles in this browser. New workspace keeps a separate selection. This choice is remembered per account in normal browsing; incognito forgets it when closed.</p><label class="field-label" for="deviceDisplayName">Workspace name (optional)</label>');
s=replace(s,'This web app cannot read Chrome\'s saved profiles. This selection belongs to this browser installation.','Saved workspaces belong to your encrypted account. This app cannot detect your physical computer or Chrome profiles; choose the workspace you want to use.');
s=replace(s,'<script src="web-app.js"></script>','<script src="web-app.js"></script>\n<script src="browser-session.js"></script>');
return s;
});
edit('web-app.js',s=>{
s=replace(s,'async function openOfflineVault() {','async function openOfflineVault(event, rememberedCredentials) {');
s=replace(s,"const email = document.getElementById('userEmailInput').value.trim().toLowerCase();\n  const pass = document.getElementById('masterPasswordInput').value;", "const email = (rememberedCredentials?.email || document.getElementById('userEmailInput').value).trim().toLowerCase();\n  const pass = rememberedCredentials?.password || document.getElementById('masterPasswordInput').value;");
s=replace(s,'    normalizeVaultLinks();\n    await saveVault();','    normalizeVaultLinks(); restoreBrowserWorkspace();\n    await saveVault();');
s=replace(s,"showToast('Local vault opened. Cloud account sign-in is separate.');","showToast('Local vault opened. Cloud account sign-in is separate.');\n    try { await rememberedBrowser.save('local'); } catch { showToast('Opened. This browser could not remember the unlock.'); }");return s;});
for(const file of ['scripts/build-web.cjs','scripts/build-commercial.cjs'])edit(file,s=>replace(s,"'web-app.js'","'web-app.js','browser-session.js'"));
edit('sw.js',s=>s.replace('link-launcher-web-v5','link-launcher-web-v6').replace("'./web-app.js'","'./web-app.js', './browser-session.js'"));
edit('commercial/license-gate.js',s=>s.replace('window.handleUnlock = async function (event)', 'window.handleUnlock = async function (event, credentials)').replace('originalLocal() : originalUnlock(event)','originalLocal(event, credentials) : originalUnlock(event, credentials)').replace('window.openOfflineVault = async function () { await ready; if (authorised()) return originalLocal(); }','window.openOfflineVault = async function (...args) { await ready; if (authorised()) return originalLocal(...args); }').replace('overlay.remove();','overlay.remove();\n      window.dispatchEvent(new Event(\'link-launcher-activated\'));'));
edit('responsive.css',s=>s+'\n#deviceProfilesModal .modal-card{max-width:680px} #savedDeviceWorkspace{width:100%;margin-bottom:8px}\n');
console.log('Saved workspaces and optional remembered unlock added');
