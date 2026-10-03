const fs=require('node:fs'),path=require('node:path'),{zipSync}=require('fflate');
const root=path.resolve(__dirname,'..');
const files=['manifest.json','background.js','content.js','icon.png','README.md','Setup.cmd','READ-FIRST.html','popup.html','popup.js','native-helper/native-host.cjs','native-helper/Install-Helper.ps1','native-helper/Runtime.ps1','native-helper/Uninstall-Helper.ps1','native-helper/README.md'];
function makeBridgeArchive(origin){
 const entries={};
 for(const file of files){let bytes=fs.readFileSync(path.join(root,'browser-bridge',file));
  if(file==='manifest.json'&&origin){const manifest=JSON.parse(bytes);manifest.content_scripts[0].matches[0]=origin+'/*';bytes=Buffer.from(JSON.stringify(manifest,null,2));}
  entries[file]=new Uint8Array(bytes);
 }
 return zipSync(entries);
}
if(require.main===module)fs.writeFileSync(path.join(root,'browser-bridge.zip'),makeBridgeArchive());
module.exports={makeBridgeArchive,files};
