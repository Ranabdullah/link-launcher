const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'link-browser-routing-'));process.env.DATA_DIR=path.join(temp,'data');process.env.NODE_ENV='test';delete process.env.DATABASE_URL;
(async()=>{const server=await require('../server/server').startServer(0),origin='http://127.0.0.1:'+server.address().port,extension=path.resolve(__dirname,'../browser-bridge');let context;try{
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{headless:true,channel:'chrome',ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1280,height:800}});
 const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Extensions.loadUnpacked',{path:extension});
 await context.route('https://example.org/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Sample destination</title><h1>Opened in the same browser profile</h1>'}));
 const page=context.pages()[0];await page.goto(origin);await page.waitForFunction(()=>browserBridgeReady,{timeout:10000});
 const opened=context.waitForEvent('page');await page.evaluate(()=>openDirectTab('https://example.org/'));const tab=await opened;await tab.waitForLoadState();assert.equal(tab.url(),'https://example.org/');assert.equal(page.url(),origin+'/');
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');assert.equal(await worker.evaluate(()=>trustedSender({id:chrome.runtime.id,url:'https://evil.example/'})),false);assert.equal(await worker.evaluate(url=>trustedSender({id:chrome.runtime.id,url}),origin),true);
 assert.equal(await page.evaluate(async()=>{const result=await browserBridgeRequest('open','javascript:alert(1)');return result.opened}),false);
 const standalone=context.waitForEvent('page');await page.evaluate(()=>{const original=matchMedia;window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true}:original(q);return openDirectTab('https://example.org/installed')});const second=await standalone;await second.waitForLoadState();assert.equal(second.url(),'https://example.org/installed','Extension takes installed-app link handling through current profile');
 await page.evaluate(()=>{browserBridgeReady=false;return openDirectTab('https://example.org/wrong-browser')});assert.equal(await page.locator('#browserRoutingModal').evaluate(el=>el.classList.contains('open')),true,'Installed app without bridge shows setup instead of opening the wrong browser');
 console.log('Real extension: same-profile tab creation, standalone routing, sender restriction, unsafe URL rejection and no silent default-browser fallback passed');
}finally{if(context)await context.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});

