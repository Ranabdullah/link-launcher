const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'link-launcher-browser-'));
process.env.DATA_DIR = temp; process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL;
const externalOrigin = process.env.LINK_LAUNCHER_TEST_ORIGIN;
const startServer = externalOrigin ? null : require('../server/server').startServer;
const pass = 'BrowserTestPassword42';
async function login(page, email, create = false) {
  await page.evaluate(create => setLockMode(create), create);
  await page.locator('#userEmailInput').fill(email);
  await page.locator('#masterPasswordInput').fill(pass);
  if (create) await page.locator('#confirmPasswordInput').fill(pass);
  await page.locator('#unlockSubmitBtn').click();
  try { await page.waitForFunction(() => document.getElementById('lockScreen').style.display === 'none', null, { timeout: 5000 }); }
  catch (err) { throw new Error('Login did not open: ' + await page.locator('#unlockError').innerText(), { cause: err }); }
}
async function add(page, title, url = 'https://example.com') {
  await page.evaluate(() => openAddLinkModal());
  await page.locator('#newLinkUrl').fill(url);
  await page.locator('#newLinkTitle').fill(title);
  await page.locator('#addLinkModal button[type=submit]').click();
  await page.waitForFunction(() => !document.getElementById('addLinkModal').classList.contains('open'));
}
(async () => {
  const server = externalOrigin ? null : await startServer(0);
  const origin = externalOrigin || 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch({ headless: true, channel: 'chrome' }); }
  catch (err) { if (server) await new Promise(resolve => server.close(resolve)); throw err; }
  fs.mkdirSync('test-results', { recursive: true });
  const errors = [];
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await desktop.newPage(); page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message); });
    await page.goto(origin); await login(page, 'browser@example.com', true);
    await add(page, 'First link'); await add(page, 'Second link', 'https://example.org');
    assert.equal(await page.locator('.link-row').count(), 2);
    await page.evaluate(() => moveLink(vaultData.links[1].id, -1));
    assert.equal(await page.locator('.link-title-text').first().innerText(), 'First link');
    await page.locator('.link-checkbox').first().check();
    assert.equal(await page.locator('#selectionCount').innerText(), '1 selected');
    await page.locator('#selectionToolbar button').filter({ hasText: /^Star$/ }).click();
    await page.waitForFunction(() => vaultData.links.some(l => l.starred));
    await page.locator('#globalSearchInput').fill('Second'); assert.equal(await page.locator('.link-row').count(), 1);
    await page.locator('#globalSearchInput').fill('');
    await page.locator('.link-title-text').first().click();
    await page.locator('#drawerTitleInput').fill('Edited link');
    await page.locator('#drawerForm').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => !document.getElementById('detailDrawer').classList.contains('open'));
    assert.equal(await page.locator('.link-title-text').first().innerText(), 'Edited link');
    await page.evaluate(() => openAddProfileModal());
    await page.locator('#newProfName').fill("Work's <label>");
    await page.locator('#addProfileModal button[type=submit]').click();
    await page.waitForFunction(() => !document.getElementById('addProfileModal').classList.contains('open'));
    await page.evaluate(() => { vaultData.categories.push("Work');window.XSS=true;//"); renderApp(); });
    await page.locator('.category-chip').last().click();
    assert.equal(await page.evaluate(() => !!window.XSS), false);
    await page.evaluate(() => {
      vaultData.categories = vaultData.categories.filter(c => !c.includes('window.XSS'));
      vaultData.profiles[0].name = 'Work'; selectCategory('ALL');
    });
    assert.equal(await page.evaluate(() => safeLinkUrl('javascript:alert(1)')), null);
    assert.equal(await page.evaluate(() => safeLinkUrl('data:text/html,test')), null);
    assert.equal(await page.evaluate(async () => {
      const input = { links: [{ notes: 'x'.repeat(300000) }], profiles: [] };
      return (await decryptData(await encryptData(input, currentPassword), currentPassword)).links[0].notes.length;
    }), 300000, 'Large vault encryption avoids argument-stack limits');
    await page.evaluate(() => saveVault());
    await page.evaluate(() => { closeDetailDrawer(); document.querySelector('.app-body').scrollLeft = 0; });
    assert.equal(await page.evaluate(() => document.querySelector('.sidebar-left').getBoundingClientRect().left >= 0), true);
    await page.screenshot({ path: 'test-results/desktop.png', fullPage: true, animations: 'disabled' });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage(); phone.on('pageerror', e => errors.push(e.message));
    await phone.goto(origin); await login(phone, 'browser@example.com');
    assert.equal(await phone.locator('.link-row').count(), 0, 'New device starts with own links');
    await phone.evaluate(() => toggleProfileScope()); assert.equal(await phone.locator('.link-row').count(), 2);
    await phone.locator('.device-toggle').first().click();
    await phone.waitForFunction(() => syncStatusState === 'synced');
    await phone.evaluate(() => toggleProfileScope()); assert.equal(await phone.locator('.link-row').count(), 1);
    await phone.locator('#mobileMenu').click(); assert.equal(await phone.evaluate(() => document.body.classList.contains('nav-open')), true);
    await phone.locator('.nav-scrim').click({ position: { x: 360, y: 400 } });
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Phone should not overflow horizontally');
    const visibleTitle = await phone.locator('.link-title-text').first().boundingBox();
    assert.ok(visibleTitle && visibleTitle.width > 50 && visibleTitle.x >= 0 && visibleTitle.x + visibleTitle.width <= 390, 'Phone titles fit and are visible');
    await phone.screenshot({ path: 'test-results/mobile.png', fullPage: true, animations: 'disabled' });
    await phone.evaluate(() => navigator.serviceWorker.ready); await phone.reload();
    await mobile.setOffline(true); await phone.reload(); await login(phone, 'browser@example.com');
    await add(phone, 'Offline edit');
    assert.equal(await phone.evaluate(() => syncMeta().dirty), true);
    await phone.reload(); await login(phone, 'browser@example.com');
    assert.equal(await phone.locator('.link-row').count(), 2, 'Offline edit survives reopening');
    await mobile.setOffline(false);
    await phone.evaluate(() => handleLogout()); await login(phone, 'browser@example.com');
    await phone.waitForFunction(() => !syncMeta().dirty);
    await page.evaluate(() => pullLatestFromCloud());
    await page.evaluate(() => toggleProfileScope());
    assert.equal(await page.locator('.link-row').count(), 3, 'Other device receives offline edit');
    // Simultaneous device changes must preserve the loser locally and report conflict.
    await add(page, 'Desktop concurrent edit');
    await add(phone, 'Phone concurrent edit');
    assert.equal(await phone.evaluate(() => syncStatusState), 'conflict');
    for (const width of [320, 768, 1024]) {
      await phone.setViewportSize({ width, height: 900 });
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No page overflow at width ' + width);
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.evaluate(() => handleLogout()); await login(phone, 'browser@example.com');
    assert.equal(await phone.evaluate(() => vaultData.links.some(l => l.title === 'Phone concurrent edit')), true);
    assert.equal(await phone.evaluate(() => syncStatusState), 'conflict');
    const downloaded = page.waitForEvent('download');
    await page.evaluate(() => exportEncryptedVault()); const download = await downloaded;
    assert.ok(download.suggestedFilename().endsWith('.dlvault'));
    const backupFile = path.join(temp, 'restore.dlvault'); await download.saveAs(backupFile);
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#localBackupFileInput').setInputFiles(backupFile);
    await page.waitForFunction(() => document.getElementById('localSaveStatus').textContent.includes('Restored'));
    const restoreCount = await page.evaluate(() => vaultData.links.length);
    assert.equal(restoreCount, 4, 'Encrypted backup imports through the actual file input');
    await page.evaluate(() => lockVault());
    assert.equal(await page.locator('.link-row').count(), 0, 'Lock removes plaintext rows');
    await page.evaluate(() => confirmResetLocalVault());
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('dreamslab_vault_'))), false, 'Device reset clears encrypted caches');
    await login(page, 'browser@example.com');
    assert.equal(await page.evaluate(() => vaultData.links.length), 4, 'Device reset preserves the cloud account');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('Browser flows passed: desktop/mobile CRUD, reorder, selection, labels, XSS, device scope, offline reopen/reconnect, conflict preservation, large vault encryption, encrypted export/import, lock; widths 320/390/768/1024/1440.');
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(err => { console.error(err); process.exitCode = 1; });
