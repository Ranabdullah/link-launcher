const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'link-profile-scope-'));
process.env.DATA_DIR = temp; process.env.NODE_ENV = 'test'; delete process.env.DATABASE_URL;
const externalOrigin = process.env.LINK_LAUNCHER_TEST_ORIGIN;
const email = 'profile-scope@example.invalid';
const pass = 'ProfileScopeTestPassword42';
async function login(page, create = false) {
  await page.evaluate(create => setLockMode(create), create);
  await page.locator('#userEmailInput').fill(email);
  await page.locator('#masterPasswordInput').fill(pass);
  if (create) await page.locator('#confirmPasswordInput').fill(pass);
  await page.locator('#unlockSubmitBtn').click();
  await page.waitForFunction(() => document.getElementById('lockScreen').style.display === 'none');
}
async function choose(page, ids, name) {
  await page.evaluate(() => openDeviceProfilesModal());
  if (name !== undefined) await page.locator('#deviceDisplayName').fill(name);
  for (const input of await page.locator('#deviceProfilesChoices input').all()) {
    await input.setChecked(ids.includes(await input.getAttribute('value')));
  }
  await page.locator('#deviceProfilesModal button[type=submit]').click();
  await page.waitForFunction(() => !document.getElementById('deviceProfilesModal').classList.contains('open'));
}
(async () => {
  const server = externalOrigin ? null : await require('../server/server').startServer(0);
  const origin = externalOrigin || 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktop.newPage(); const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(origin); await login(page, true);
    await page.evaluate(async () => {
      vaultData.profiles = [
        { id: 'work', name: 'Work <img src=x onerror="window.XSS=true">', email: 'work@example.invalid' },
        { id: 'home', name: 'Home', email: '' },
        { id: 'empty', name: 'Empty profile', email: '' }
      ];
      vaultData.links = [
        { id: 'work-link', title: 'Legacy work', profileEmail: 'WORK@example.invalid', url: 'https://example.com', deviceIds: [] },
        { id: 'home-link', title: 'Legacy home', profileId: 'home', url: 'https://example.org', deviceIds: [] },
        { id: 'direct-link', title: 'Saved here', url: 'https://example.net', deviceIds: [currentDeviceId] },
        { id: 'deleted-link', title: 'Deleted work', profileEmail: 'work@example.invalid', url: 'https://example.com', deleted: true }
      ];
      normalizeVaultLinks(); await saveVault(); renderApp();
    });
    assert.equal(await page.locator('.account-item').count(), 0, 'Imported profiles are not silently assigned');
    assert.equal(await page.locator('.link-row').count(), 1);
    await choose(page, ['work', 'empty'], 'Home PC');
    assert.equal(await page.locator('#currentDeviceLabel').innerText(), 'Device: Home PC');
    assert.equal(await page.locator('.account-item').count(), 2, 'Chosen empty profiles are visible too');
    assert.equal(await page.locator('.link-row').count(), 2, 'All selected-profile links appear without per-link assignment');
    assert.equal(await page.evaluate(() => !!window.XSS), false, 'Profile picker escapes names');
    assert.equal(await page.locator('.account-item').filter({ hasText: 'Work' }).locator('.nav-badge').innerText(), '1');
    await page.locator('.account-label-button').filter({ hasText: 'Work' }).click();
    assert.equal(await page.locator('.link-row').count(), 1, 'Sidebar profile filter works for legacy mixed-case emails');
    await page.evaluate(() => { activeProfileEmail = null; renderApp(); });
    await page.reload(); await login(page);
    assert.equal(await page.locator('#currentDeviceLabel').innerText(), 'Device: Home PC', 'Encrypted device name survives reload');
    assert.equal(await page.locator('.account-item').count(), 2, 'Selection survives normalization and cloud reload');
    await page.evaluate(async () => {
      vaultData.links.push({ id:'future-work', title:'Future work', profileId:'work', url:'https://example.com/new', deviceIds:[] });
      normalizeVaultLinks(); await saveVault(); renderApp();
    });
    assert.equal(await page.locator('.link-row').count(), 3, 'Future profile links inherit scope');
    const phoneContext = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const phone = await phoneContext.newPage(); phone.on('pageerror', err => errors.push(err.message));
    await phone.goto(origin); await login(phone);
    assert.equal(await phone.locator('.account-item').count(), 0, 'Other browser starts with no assigned profiles');
    assert.equal(await phone.locator('.link-row').count(), 0);
    await phone.evaluate(() => toggleProfileScope());
    assert.equal(await phone.locator('.link-row').count(), 4, 'All devices retains every non-deleted link');
    assert.equal(await phone.locator('.account-item').count(), 3);
    await choose(phone, ['home'], 'My phone');
    assert.equal(await phone.locator('#currentDeviceLabel').innerText(), 'Device: My phone');
    assert.equal(await phone.locator('.account-item').count(), 1);
    assert.equal(await phone.locator('.link-row').count(), 1);
    assert.equal(await phone.locator('.link-title-text').innerText(), 'Legacy home');
    await page.evaluate(() => pullLatestFromCloud());
    assert.equal(await page.locator('#currentDeviceLabel').innerText(), 'Device: Home PC', 'Phone keeps desktop name intact');
    assert.equal(await page.locator('.account-item').count(), 2, 'Phone selection does not replace desktop selection');
    assert.equal(await page.locator('.link-row').count(), 3);
    await choose(page, []);
    assert.equal(await page.locator('.link-row').count(), 1, 'Unassigning profiles retains individually saved links');
    assert.equal(await page.locator('.account-item').count(), 0);
    await page.evaluate(() => toggleProfileScope());
    assert.equal(await page.locator('.link-row').count(), 4, 'Unassigning never deletes account data');
    await phone.evaluate(() => pullLatestFromCloud());
    await phone.evaluate(() => navigator.serviceWorker.ready); await phone.reload();
    await phoneContext.setOffline(true); await login(phone);
    await choose(phone, ['home', 'empty']);
    await phone.reload(); await login(phone);
    assert.equal(await phone.locator('.account-item').count(), 2, 'Offline selection survives reopening');
    assert.equal(await phone.locator('.link-row').count(), 1);
    await phone.evaluate(() => openDeviceProfilesModal());
    for (const width of [320, 390, 768, 1440]) {
      await phone.setViewportSize({width, height:900});
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Picker fits width ' + width);
    }
    await phone.setViewportSize({width:390,height:844});
    fs.mkdirSync('test-results', {recursive:true});
    await phone.screenshot({path:'test-results/device-profile-picker.png',fullPage:true,animations:'disabled'});
    await phone.evaluate(() => closeModal('deviceProfilesModal'));
    await phoneContext.setOffline(false);
    await phone.evaluate(() => handleLogout()); await login(phone);
    await phone.waitForFunction(() => !syncMeta().dirty);
    assert.equal(await phone.evaluate(() => getDisplayProfiles().length), 2, 'Offline profile choices sync after online sign-in');
    assert.deepEqual(errors, []);
    console.log('Profile selection passed: legacy links, escaped labels, empty profiles, future links, independent desktop/phone scope, no data loss, cloud reload, offline reopen/reconnect and responsive picker.');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, {recursive:true,force:true});
  }
})().catch(err => { console.error(err); process.exitCode=1; });
