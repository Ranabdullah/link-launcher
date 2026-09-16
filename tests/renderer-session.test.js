const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

for (const file of ['index.html', 'Link_Launcher.html']) {
  test(file + ': real renderer session helpers handle desktop, browser, and storage failures', async () => {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
    const start = html.indexOf('    async function storeSecureSession(');
    assert.ok(start >= 0, 'session helpers must exist');
    const context = vm.createContext({ window: {}, showToast() {} });
    vm.runInContext(html.slice(start, html.indexOf('    async function handleUnlock(', start)), context);
    assert.equal(await context.storeSecureSession('test@example.com', 'test-key', 'test-token'), false);
    assert.equal(await context.retrieveSecureSession(), null);
    assert.equal(await context.clearSecureSession(), true);
    let stored;
    context.window.electronAPI = {
      async secureStoreSession(value) { stored = value; return { success: true }; },
      async secureRetrieveSession() { return { success: true, session: stored }; },
      async secureClearSession() { stored = null; return { success: true }; }
    };
    assert.equal(await context.storeSecureSession('test@example.com', 'test-key', 'test-token'), true);
    const restored = await context.retrieveSecureSession();
    assert.equal(restored.email, 'test@example.com');
    assert.equal(restored.key, 'test-key');
    assert.equal(restored.token, 'test-token');
    assert.equal(await context.clearSecureSession(), true);
    assert.equal(await context.retrieveSecureSession(), null);
    for (const method of ['secureStoreSession', 'secureRetrieveSession', 'secureClearSession']) {
      context.window.electronAPI[method] = async () => { throw new Error('unavailable'); };
    }
    assert.equal(await context.storeSecureSession('test@example.com', 'test-key', null), false);
    assert.equal(await context.retrieveSecureSession(), null);
    assert.equal(await context.clearSecureSession(), false);
    context.window.electronAPI.secureStoreSession = async () => ({ success: false });
    assert.equal(await context.storeSecureSession('test@example.com', 'test-key', null), false);
  });
}
