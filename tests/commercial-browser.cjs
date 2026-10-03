const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'link-launcher-commercial-'));
const keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const publicKey=keys.publicKey.export({format:'jwk'});
const email='licensed@example.invalid';
function licence(installation,owner=email) {
  const payload=JSON.stringify({version:1,product:'link-launcher-commercial-v1',email:owner,order:'QA-NOT-A-PURCHASE',installation,issuedAt:new Date().toISOString()});
  return {payload,signature:crypto.sign('sha256',Buffer.from(payload),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
function upload(page,bundle) {return page.locator('#commercialLicenseFile').setInputFiles({name:'qa.lllicense',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});}
async function activate(page,bundle) {await upload(page,bundle);await page.locator('#commercialActivation').waitFor({state:'detached'});}
fs.cpSync(path.join(root,'sale-dist/Link-Launcher-Commercial-2.1.4'),temp,{recursive:true});
fs.writeFileSync(path.join(temp,'web/license-config.js'),'window.LINK_LAUNCHER_LICENSE='+JSON.stringify({publicKey})+';');
const server=spawn(process.execPath,['local-server.cjs'],{cwd:temp,env:{...process.env,PORT:'4791'},stdio:'ignore'});
(async()=>{
  let browser;
  try {
    for(let i=0;i<50;i++){try{if((await fetch('http://localhost:4791/')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const desktop=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await desktop.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:4791/');
    const installation=(await page.locator('#activationRequest').inputValue()).slice(4);
    await page.evaluate(()=>handleUnlock({preventDefault(){}}));
    assert.match(await page.locator('#unlockError').innerText(),/Activate/);
    const wrongBrowser=licence(crypto.randomUUID());await upload(page,wrongBrowser);
    await page.waitForFunction(()=>document.getElementById('commercialLicenseStatus').textContent.includes('different browser'));
    const correct=licence(installation);await upload(page,{...correct,payload:correct.payload.replace(email,'forged@example.invalid')});
    await page.waitForFunction(()=>document.getElementById('commercialLicenseStatus').textContent.includes('signature is invalid'));
    await activate(page,correct);
    await page.locator('#masterPasswordInput').fill('LocalBuyerPassword42');await page.locator('#confirmPasswordInput').fill('LocalBuyerPassword42');
    await page.locator('#rememberBrowser').check();
    await page.locator('#unlockSubmitBtn').click();await page.waitForFunction(()=>document.getElementById('lockScreen').style.display==='none');
    await page.evaluate(()=>rememberedBrowser.save('local'));
    await page.evaluate(()=>openAddLinkModal());await page.locator('#newLinkTitle').fill('Cloudflare documentation');await page.locator('#newLinkUrl').fill('https://developers.cloudflare.com/');
    await page.locator('#addLinkModal button[type=submit]').click();await page.waitForFunction(()=>!document.getElementById('addLinkModal').classList.contains('open'));
    assert.equal(await page.locator('.link-row').count(),1);
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/commercial-desktop.png'),fullPage:true,animations:'disabled'});
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
    await desktop.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.getElementById('lockScreen').style.display==='none');assert.equal(await page.locator('.link-row').count(),1);
    await page.locator('button[onclick="lockVault()"]').click();
    await page.waitForFunction(()=>document.getElementById('lockScreen').style.display!=='none');
    await page.reload();await page.waitForTimeout(700);
    assert.notEqual(await page.locator('#lockScreen').evaluate(node=>node.style.display),'none');
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();await phone.goto('http://localhost:4791/');
    await upload(phone,correct);await phone.waitForFunction(()=>document.getElementById('commercialLicenseStatus').textContent.includes('different browser'));
    const phoneInstall=(await phone.locator('#activationRequest').inputValue()).slice(4);await activate(phone,licence(phoneInstall));
    await phone.locator('#userEmailInput').fill('another@example.invalid');await phone.locator('#masterPasswordInput').fill('LocalBuyerPassword42');await phone.locator('#confirmPasswordInput').fill('LocalBuyerPassword42');await phone.locator('#unlockSubmitBtn').click();
    assert.match(await phone.locator('#unlockError').innerText(),/email on your purchased licence/);
    await phone.locator('#userEmailInput').fill(email);await phone.locator('#unlockSubmitBtn').click();await phone.waitForFunction(()=>document.getElementById('lockScreen').style.display==='none');
    await phone.evaluate(()=>openAddLinkModal());await phone.locator('#newLinkTitle').fill('GitHub');await phone.locator('#newLinkUrl').fill('https://github.com/');
    await phone.locator('#addLinkModal button[type=submit]').click();await phone.waitForFunction(()=>!document.getElementById('addLinkModal').classList.contains('open'));
    assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await phone.screenshot({path:path.join(root,'test-results/commercial-mobile.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);
    assert.equal((await fetch('http://localhost:4791/.git/config')).status,404);
    assert.equal((await fetch('http://localhost:4791/COMMERCIAL-LICENSE.md')).status,404);
    const missing=await browser.newContext();
    await missing.route('**/license-gate.js',route=>route.abort());
    const missingPage=await missing.newPage();await missingPage.goto('http://localhost:4791/');
    await missingPage.evaluate(()=>handleUnlock({preventDefault(){}}));
    assert.match(await missingPage.locator('#unlockError').innerText(),/Activation has not loaded/);
    assert.notEqual(await missingPage.locator('#lockScreen').evaluate(node=>node.style.display),'none');
    console.log('Commercial browser checks passed: unlicensed/forged/copied/wrong-email rejection, valid desktop/phone activation, encrypted local links and offline reopening.');
  } finally {
    if(browser)await browser.close();
    if(server.exitCode === null) await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
    fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

