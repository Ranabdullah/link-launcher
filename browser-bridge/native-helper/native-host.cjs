const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const hostName='com.dreamslab.linklauncher';
function candidates(env=process.env){const local=env.LOCALAPPDATA,pf=env.ProgramFiles,pf86=env['ProgramFiles(x86)'];return [
 {id:'chrome',name:'Chrome',root:path.join(local,'Google/Chrome/User Data'),executables:[path.join(pf,'Google/Chrome/Application/chrome.exe'),path.join(pf86||pf,'Google/Chrome/Application/chrome.exe'),path.join(local,'Google/Chrome/Application/chrome.exe')]},
 {id:'edge',name:'Edge',root:path.join(local,'Microsoft/Edge/User Data'),executables:[path.join(pf86||pf,'Microsoft/Edge/Application/msedge.exe'),path.join(pf,'Microsoft/Edge/Application/msedge.exe')]}
];}
function enumerate(browsers=candidates()){const result=[];for(const browser of browsers){const executable=browser.executables.find(f=>fs.existsSync(f));if(!executable)continue;let cache;try{cache=JSON.parse(fs.readFileSync(path.join(browser.root,'Local State'),'utf8')).profile.info_cache;}catch{continue;}
 for(const [directory,record]of Object.entries(cache||{})){if(!/^(Default|Profile [0-9]+)$/.test(directory))continue;const folder=path.join(browser.root,directory);try{const relative=path.relative(fs.realpathSync(browser.root),fs.realpathSync(folder));if(relative.startsWith('..')||path.isAbsolute(relative))continue;}catch{continue;}
 result.push({id:browser.id+':'+directory,browser:browser.name,name:String(record.name||directory).slice(0,120),email:String(record.user_name||'').slice(0,254),directory,root:browser.root,executable});
 }}return result;}
function store(settingsFile){return JSON.parse(fs.readFileSync(settingsFile,'utf8').replace(/^\uFEFF/,''));}
async function saveBindings(settingsFile,key,bindings,merge=false){
 const lock=settingsFile+'.lock';let fd;
 for(let attempt=0;attempt<100;attempt++){try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));break;}catch(e){if(e.code!=='EEXIST')throw e;
  try{if(Date.now()-fs.statSync(lock).mtimeMs>10000){const pid=Number(fs.readFileSync(lock,'utf8'));let alive=false;if(pid>0)try{process.kill(pid,0);alive=true;}catch{}if(!alive){fs.unlinkSync(lock);continue;}}}catch{}
  await new Promise(resolve=>setTimeout(resolve,20));}}
 if(fd===undefined)throw Error('Browser assignments are busy. Try saving again.');
 try{const latest=store(settingsFile);latest.accounts||={};latest.accounts[key]=merge?{...latest.accounts[key],...bindings}:bindings;
  const temp=settingsFile+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(latest,null,2));fs.renameSync(temp,settingsFile);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
function accountKey(account){if(typeof account!=='string'||account.length>254||!account.includes('@'))throw Error('Sign in to your vault first.');return crypto.createHash('sha256').update(account.trim().toLowerCase()).digest('hex');}
function profileKey(value){if(typeof value!=='string'||value.length<1||value.length>300)throw Error('Choose an account for this link.');return value;}
function website(value){if(typeof value!=='string'||value.length>16384)throw Error('Invalid website address.');const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid website address.');return u.href;}
async function dispatch(message,{settingsFile,browsers,launch=spawn}={}){const config=store(settingsFile),profiles=enumerate(browsers);const publicProfiles=profiles.map(({id,browser,name,email})=>({id,browser,name,email}));
 if(message?.command==='list')return{helperReady:true,machineId:config.machineId,profiles:publicProfiles};
 const key=accountKey(message?.account);config.accounts||={};const bindings=config.accounts[key]||{};
 if(message.command==='bindings')return{bindings,profiles:publicProfiles};
 if(message.command==='bind'){if(!message.bindings||typeof message.bindings!=='object'||Array.isArray(message.bindings)||Object.keys(message.bindings).length>500)throw Error('Invalid browser assignments.');const next=Object.create(null);for(const [label,target]of Object.entries(message.bindings)){profileKey(label);if(target==='')continue;if(!profiles.some(p=>p.id===target))throw Error('A selected browser profile is no longer on this computer.');next[label]=target;}await saveBindings(settingsFile,key,next);return{saved:true,bindings:next};}
 if(message.command!=='open')throw Error('Unknown helper request.');
 const label=profileKey(message.profileKey),url=website(message.url);let target=profiles.find(p=>p.id===bindings[label]);
 if(bindings[label]&&!target)throw Error('The assigned browser profile was removed. Choose its replacement in Browser profiles.');
 if(!target&&typeof message.profileEmail==='string'&&message.profileEmail.trim()){
  const matches=profiles.filter(p=>p.email.trim().toLowerCase()===message.profileEmail.trim().toLowerCase());
  if(matches.length===1){target=matches[0];await saveBindings(settingsFile,key,{[label]:target.id},true);}
 }
 if(!target)throw Error('Choose the browser profile for this account in Browser profiles. The link has not been opened.');
 await new Promise((resolve,reject)=>{const child=launch(target.executable,['--user-data-dir='+target.root,'--profile-directory='+target.directory,url],{shell:false,detached:true,windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
 return{opened:true,browser:target.browser,profile:target.name};
}
if(require.main===module){const settingsFile=path.join(__dirname,'settings.json');let config;try{config=store(settingsFile);}catch{process.exit(1);}if(!config.allowedOrigins.includes(process.argv[2]))process.exit(1);
 let input=Buffer.alloc(0),handled=false;process.stdin.on('data',chunk=>{if(handled)return;input=Buffer.concat([input,chunk]);if(input.length<4)return;const size=input.readUInt32LE(0);if(size>65536){handled=true;process.exit(1);}if(input.length<4+size)return;handled=true;
  (async()=>{let result;try{result=await dispatch(JSON.parse(input.subarray(4,4+size).toString('utf8')),{settingsFile});}catch(e){result={opened:false,error:e.message};}const body=Buffer.from(JSON.stringify(result)),header=Buffer.alloc(4);header.writeUInt32LE(body.length);process.stdout.end(Buffer.concat([header,body]));})();
 });}
module.exports={hostName,candidates,enumerate,dispatch,website};
