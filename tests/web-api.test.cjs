const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-launcher-api-'));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
const { startServer } = require('../server/server');
let server, origin;
before(async () => { server = await startServer(0); origin = 'http://127.0.0.1:' + server.address().port; });
after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir, { recursive: true, force: true }); });
const vault = () => ({ salt: crypto.randomBytes(16).toString('base64'), iv: crypto.randomBytes(12).toString('base64'), data: crypto.randomBytes(32).toString('base64') });
async function api(route, body, token, method = 'POST') {
  const res = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
test('real API: ownership, duplicate signup, version conflict, validation, revocation and deletion', async () => {
  const first = vault(), second = vault();
  const signup = { email: 'one@example.com', authVerifier: 'a'.repeat(64), encryptedVault: first };
  const one = await api('/api/auth/register', signup);
  const two = await api('/api/auth/register', { ...signup, email: 'two@example.com', encryptedVault: second });
  assert.equal(one.status, 201); assert.equal(two.status, 201);
  assert.equal((await api('/api/auth/register', signup)).status, 409);
  assert.equal((await api('/api/auth/login', { email: signup.email, authVerifier: 'b'.repeat(64) })).status, 401);
  assert.equal((await api('/api/vault', null, null, 'GET')).status, 401);
  assert.deepEqual((await api('/api/vault', null, two.body.token, 'GET')).body.encryptedVault, second);
  assert.equal((await api('/api/vault', { version: 1, encryptedVault: vault() }, one.body.token)).status, 200);
  assert.equal((await api('/api/vault', { version: 1, encryptedVault: first }, one.body.token)).status, 409);
  assert.equal((await api('/api/vault', { version: 2, encryptedVault: { data: 'invalid' } }, one.body.token)).status, 400);
  assert.equal((await api('/api/vault', { version: 2.5, encryptedVault: first }, one.body.token)).status, 400);
  assert.equal((await api('/api/auth/logout', null, one.body.token)).status, 200);
  assert.equal((await api('/api/vault', null, one.body.token, 'GET')).status, 401);
  assert.equal((await api('/api/account', null, two.body.token, 'DELETE')).status, 200);
  assert.equal((await api('/api/vault', null, two.body.token, 'GET')).status, 401);
  await api('/api/auth/register', { ...signup, email: 'two@example.com' });
  assert.equal((await api('/api/vault', null, two.body.token, 'GET')).status, 401, 'Deleted-account token cannot access a recreated account');
});
test('web assets are available; private files, installers and unknown routes are denied', async () => {
  for (const asset of ['/', '/sw.js', '/manifest.webmanifest', '/icons/icon-192.png', '/web-app.js']) assert.equal((await fetch(origin + asset)).status, 200, asset);
  for (const asset of ['/server/data/vaults.json', '/server/.env', '/package.json', '/main.js', '/installer.exe', '/missing']) assert.equal((await fetch(origin + asset)).status, 404, asset);
  const health = await api('/api/health', null, null, 'GET');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-frame-options'), 'DENY');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
});
