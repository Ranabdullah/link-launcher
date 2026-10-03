const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),logo=path.join(root,'favicon.png');
(async()=>{
 fs.mkdirSync(path.join(root,'icons'),{recursive:true});
 for(const size of [192,512])await sharp(logo).resize(size,size).png().toFile(path.join(root,'icons','icon-'+size+'.png'));
 await sharp(logo).resize(384,384).extend({top:64,bottom:64,left:64,right:64,background:'#020413'}).png().toFile(path.join(root,'icons','maskable-512.png'));
 fs.copyFileSync(logo,path.join(root,'browser-bridge','icon.png'));
})().catch(error=>{console.error(error);process.exitCode=1;});
