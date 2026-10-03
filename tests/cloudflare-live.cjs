const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = 'https://link-launcher.ranakaharian1.workers.dev';
const email = 'qa-' + crypto.randomUUID() + '@example.invalid';
const authVerifier = crypto.randomBytes(32).toString('hex');
const vault = {salt:crypto.randomBytes(16).toString('base64'),iv:crypto.randomBytes(12).toString('base64'),data:crypto.randomBytes(48).toString('base64')};
let token;
async function api(route, method='GET', body, current=token) {
  const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(current?{Authorization:'Bearer '+current}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
(async()=>{
  try {
    const registration=await api('/api/auth/register','POST',{email,authVerifier,encryptedVault:vault});
    assert.equal(registration.status,201); token=registration.body.token;
    const wrong=await api('/api/auth/login','POST',{email,authVerifier:'0'.repeat(64)}); assert.equal(wrong.status,401);
    const login=await api('/api/auth/login','POST',{email,authVerifier}); assert.equal(login.status,200); assert.deepEqual(login.body.encryptedVault,vault);
    token=login.body.token;
    const updated={...vault,data:crypto.randomBytes(64).toString('base64')};
    const save=await api('/api/vault','POST',{encryptedVault:updated,version:1}); assert.equal(save.status,200); assert.equal(save.body.version,2);
    assert.equal((await api('/api/vault','POST',{encryptedVault:vault,version:1})).status,409);
    assert.deepEqual((await api('/api/vault')).body.encryptedVault,updated);
    assert.equal((await api('/api/auth/logout','POST')).status,200);
    assert.equal((await api('/api/vault')).status,401);
    token=(await api('/api/auth/login','POST',{email,authVerifier})).body.token;
    assert.equal((await api('/api/account','DELETE')).status,200); token=null;
    console.log('Live Cloudflare check passed: registration, wrong-password rejection, sign-in, read/write, stale-write protection, logout and cleanup.');
  } finally {
    if(token) { const cleanup=await api('/api/account','DELETE'); if(cleanup.status!==200) throw new Error('QA account cleanup needs attention.'); }
  }
})().catch(()=>{console.error('Live check failed. Test details remain private; verify QA cleanup before declaring success.');process.exitCode=1;});
