const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const customer=process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'sale-dist/Link-Launcher-Commercial-2.1.5');
const forbidden=['4dddb56c05af56a431914f2cb7f48eb4','2bd585fdb9252b0687c939a434d19886','2ea49342-0c59-4ce2-abc4-a671e5db0b75','ranakaharian1@gmail.com','abdullahinayat24@gmail.com','dreamslab-cloud-vault.onrender.com'];
const local=JSON.parse(fs.readFileSync(path.join(root,'server/data/vaults.json'),'utf8'));
for(const [email,row] of Object.entries(local.users||{}))forbidden.push(email,row.verifierHash,row.verifier_hash);
const privateFolder=path.join(root,'migration-private');
for(const file of fs.readdirSync(privateFolder).filter(f=>f.endsWith('.json'))){const data=JSON.parse(fs.readFileSync(path.join(privateFolder,file),'utf8'));for(const user of data.users||[])forbidden.push(user.email,user.verifier_hash);}
const connectionFile=path.join(privateFolder,'render-database-url.txt');if(fs.existsSync(connectionFile))forbidden.push(fs.readFileSync(connectionFile,'utf8').trim());
const allowedRoots=new Set(['web','cloudflare','package.json','package-lock.json','local-server.cjs','wrangler.jsonc','START-HERE.html','OWN-CLOUD.md','COMMERCIAL-LICENSE.md','CORE-MIT-LICENSE.txt','.gitignore','FILE-MANIFEST.json']);
let count=0;
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);const relative=path.relative(customer,file).replace(/\\/g,'/');const first=relative.split('/')[0];assert.ok(allowedRoots.has(first),'Unexpected customer entry: '+relative);if(entry.isDirectory()){walk(file);continue;}
  assert.ok(!/(?:^|\/)(?:\.wrangler|node_modules|seller-private|migration-private|server|test-results)(?:\/|$)/.test(relative),relative);
  assert.ok(!/\.(?:exe|pem|lllicense|sqlite|db|bat|ps1)$/i.test(relative),relative);
  const inspect=(bytes,label)=>{const text=Buffer.from(bytes).toString('utf8');assert.ok(!text.includes('PRIVATE KEY-----'),label);for(const value of forbidden.filter(Boolean))assert.ok(!text.includes(value),'Private material detected in '+label);};
  if(file.endsWith('.zip')) {const nested=require('fflate').unzipSync(fs.readFileSync(file));for(const [name,bytes] of Object.entries(nested))inspect(bytes,relative+'/'+name);}
  else if(!file.endsWith('.png'))inspect(fs.readFileSync(file),relative);
  count++;
}}
walk(customer);
const config=JSON.parse(fs.readFileSync(path.join(customer,'wrangler.jsonc'),'utf8'));assert.equal(config.account_id,undefined);assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');assert.equal(JSON.parse(config.vars.LICENSE_PUBLIC_KEY).d,undefined);
const html=fs.readFileSync(path.join(customer,'START-HERE.html'),'utf8');
for(const [,href] of html.matchAll(/href="([^"]+)"/g))if(!/^https?:/.test(href))assert.ok(fs.existsSync(path.join(customer,href)),href);
assert.ok(fs.readFileSync(path.join(customer,'web/index.html'),'utf8').includes('LINK_LAUNCHER_ACTIVATED = false'));
console.log(JSON.stringify({customerFilesChecked:count,privateMaterialAbsent:true,relativeGuideLinksValid:true,ownerCloudIdsAbsent:true}));

