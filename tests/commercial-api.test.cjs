const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
test('Commercial API requires signed licence and enforces purchased email even with a spoofed header',async()=>{
  const root=path.resolve('sale-dist/Link-Launcher-Commercial-2.1.4');
  const keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const publicKey=keys.publicKey.export({format:'jwk'});
  const payload=JSON.stringify({version:1,product:'link-launcher-commercial-v1',email:'buyer@example.com',order:'TEST',installation:crypto.randomUUID()});
  const bundle={payload,signature:crypto.sign('sha256',Buffer.from(payload),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
  const mf=new Miniflare(convertV4MiniflareOptions({name:'commercial',modules:[{type:'ESModule',path:path.join(root,'cloudflare/worker.mjs')},{type:'ESModule',path:path.join(root,'cloudflare/vault-worker.mjs')}],modulesRoot:path.join(root,'cloudflare'),compatibilityDate:'2026-10-01',d1Databases:['DB'],bindings:{JWT_SECRET:crypto.randomBytes(32).toString('hex'),MIGRATION_PENDING:'false',LICENSE_PUBLIC_KEY:JSON.stringify(publicKey)},assets:{directory:path.join(root,'web'),binding:'ASSETS',routerConfig:{has_user_worker:true},run_worker_first:['/api/*']},ratelimits:Object.fromEntries(['AUTH_LIMIT','LOGIN_LIMIT','REGISTER_LIMIT'].map((name,i)=>[name,{namespace_id:String(i+1),simple:{limit:60,period:60}}]))}));
  try{
    const db=await mf.getD1Database('DB');const sql=fs.readFileSync(path.join(root,'cloudflare/migrations/0001_vault.sql'),'utf8');await db.batch(sql.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
    const vault={salt:crypto.randomBytes(16).toString('base64'),iv:crypto.randomBytes(12).toString('base64'),data:crypto.randomBytes(32).toString('base64')};
    const signup={email:'buyer@example.com',authVerifier:'a'.repeat(64),encryptedVault:vault};
    const call=(body,license=bundle,extra={})=>mf.dispatchFetch('https://app.example/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',...(license?{'X-Link-Launcher-License':JSON.stringify(license)}:{}),...extra},body:JSON.stringify(body)});
    assert.equal((await call(signup,null)).status,403);
    assert.equal((await call(signup,{...bundle,payload:payload.replace('TEST','TAMPERED')})).status,403);
    assert.equal((await call({...signup,email:'other@example.com'},bundle,{'X-Link-Launcher-Verified-Email':'other@example.com'})).status,403);
    const valid=await call(signup);assert.equal(valid.status,201);const account=await valid.json();
    const signedHeaders={'X-Link-Launcher-License':JSON.stringify(bundle),Authorization:'Bearer '+account.token};
    assert.equal((await mf.dispatchFetch('https://app.example/api/vault',{headers:{Authorization:'Bearer '+account.token}})).status,403);
    const own=await mf.dispatchFetch('https://app.example/api/vault',{headers:signedHeaders});assert.equal(own.status,200);assert.deepEqual((await own.json()).encryptedVault,vault);
  }finally{await mf.dispose();}
});
test('Seller issuer verifies order owner, limits installations and keeps the private key out of distributed verification data',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'link-launcher-issuer-'));
  try{
    fs.mkdirSync(path.join(temp,'scripts'));fs.mkdirSync(path.join(temp,'commercial'));
    fs.copyFileSync(path.resolve('scripts/commercial-license.cjs'),path.join(temp,'scripts/commercial-license.cjs'));
    const command=(...args)=>spawnSync(process.execPath,[path.join(temp,'scripts/commercial-license.cjs'),...args],{encoding:'utf8'});
    assert.equal(command('init').status,0);
    const code=()=> 'LL1:'+crypto.randomUUID();
    for(let i=0;i<3;i++)assert.equal(command('issue','buyer@example.com','PAID-ORDER-FIXTURE',code()).status,0);
    assert.notEqual(command('issue','buyer@example.com','PAID-ORDER-FIXTURE',code()).status,0);
    assert.notEqual(command('issue','another@example.com','PAID-ORDER-FIXTURE',code()).status,0);
    const publicKey=JSON.parse(fs.readFileSync(path.join(temp,'commercial/license-public-key.json'),'utf8'));assert.equal(publicKey.d,undefined);
    const file=fs.readdirSync(path.join(temp,'seller-private')).find(f=>f.endsWith('.lllicense'));
    const issued=JSON.parse(fs.readFileSync(path.join(temp,'seller-private',file),'utf8'));
    assert.equal(crypto.verify('sha256',Buffer.from(issued.payload),{key:crypto.createPublicKey({key:publicKey,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(issued.signature,'base64url')),true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

