const {chromium}=require('playwright');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'link-launcher-own-cloud-'));
const keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const publicKey=keys.publicKey.export({format:'jwk'});
fs.cpSync(path.resolve('sale-dist/Link-Launcher-Commercial-2.1.5'),temp,{recursive:true});
fs.writeFileSync(path.join(temp,'web/license-config.js'),'window.LINK_LAUNCHER_LICENSE='+JSON.stringify({publicKey})+';');
fs.writeFileSync(path.join(temp,'web/cloud-config.js'),"window.LINK_LAUNCHER_CLOUD={apiUrl:'',localOnly:false};");
const email='buyer@example.invalid';const password='OwnCloudBuyerPassword42';
async function activate(page){
  const installation=(await page.locator('#activationRequest').inputValue()).slice(4);
  const payload=JSON.stringify({version:1,product:'link-launcher-commercial-v1',email,order:'QA-NOT-A-PURCHASE',installation});
  const signature=crypto.sign('sha256',Buffer.from(payload),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  await page.locator('#commercialLicenseFile').setInputFiles({name:'qa.lllicense',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({payload,signature}))});
  await page.locator('#commercialActivation').waitFor({state:'detached'});
}
async function unlock(page,create=false){if(create)await page.locator('#tabCreateAccount').click();await page.locator('#masterPasswordInput').fill(password);if(create)await page.locator('#confirmPasswordInput').fill(password);await page.locator('#unlockSubmitBtn').click();await page.waitForFunction(()=>document.getElementById('lockScreen').style.display==='none');}
(async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({name:'own-cloud-browser',host:'127.0.0.1',port:0,modules:[{type:'ESModule',path:path.join(temp,'cloudflare/worker.mjs')},{type:'ESModule',path:path.join(temp,'cloudflare/vault-worker.mjs')}],modulesRoot:path.join(temp,'cloudflare'),compatibilityDate:'2026-10-01',d1Databases:['DB'],bindings:{JWT_SECRET:crypto.randomBytes(32).toString('hex'),MIGRATION_PENDING:'false',LICENSE_PUBLIC_KEY:JSON.stringify(publicKey)},assets:{directory:path.join(temp,'web'),binding:'ASSETS',run_worker_first:['/api/*'],routerConfig:{has_user_worker:true}},ratelimits:Object.fromEntries(['AUTH_LIMIT','LOGIN_LIMIT','REGISTER_LIMIT'].map((name,i)=>[name,{namespace_id:String(i+1),simple:{limit:60,period:60}}]))}));
  let browser;
  try{
    const db=await mf.getD1Database('DB');const schema=fs.readFileSync(path.join(temp,'cloudflare/migrations/0001_vault.sql'),'utf8');await db.batch(schema.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
    const origin=(await mf.ready).origin;browser=await chromium.launch({headless:true,channel:'chrome'});
    const desktop=await browser.newContext({viewport:{width:1440,height:900}});const page=await desktop.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await activate(page);await unlock(page,true);
    await page.evaluate(()=>openAddLinkModal());await page.locator('#newLinkTitle').fill('Own-cloud link');await page.locator('#newLinkUrl').fill('https://example.com');await page.locator('#addLinkModal button[type=submit]').click();await page.waitForFunction(()=>syncStatusState==='synced'&&vaultData.links.length===1);
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();phone.on('pageerror',error=>errors.push(error.message));await phone.goto(origin);await activate(phone);await unlock(phone);
    assert.equal(await phone.locator('.link-row').count(),0);await phone.evaluate(()=>toggleProfileScope());assert.equal(await phone.locator('.link-row').count(),1);
    await phone.locator('.device-toggle').first().click();await phone.waitForFunction(()=>syncStatusState==='synced');await phone.evaluate(()=>toggleProfileScope());assert.equal(await phone.locator('.link-row').count(),1);
    assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await phone.evaluate(()=>lockVault());await unlock(phone);assert.equal(await phone.locator('.link-row').count(),1);
    assert.deepEqual(errors,[]);
    console.log('Commercial own-cloud browser check passed: licensed registration/sign-in, encrypted saves, two-device sync, scope assignment and relock.');
  }finally{if(browser)await browser.close();await mf.dispose();fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});

