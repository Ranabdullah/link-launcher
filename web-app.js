let saveQueue = Promise.resolve();
function bytesToBase64(bytes) {
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 32768) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  return btoa(parts.join(''));
}
const originalSaveVault = saveVault;
saveVault = function () {
  const email = currentUserEmail;
  const password = currentPassword;
  // Serialise encryption + version updates so fast edits cannot race.
  const run = () => email === currentUserEmail && password === currentPassword ? originalSaveVault() : { success: false, error: 'Session changed' };
  saveQueue = saveQueue.then(run, run);
  return saveQueue;
};

function getDeviceId() {
  let id = localStorage.getItem('dreamslab_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('dreamslab_device_id', id); }
  return id;
}
let currentDeviceId = getDeviceId();
function syncMeta(email = currentUserEmail) {
  try { return JSON.parse(localStorage.getItem(getStorageKey(email) + '_sync') || '{}'); }
  catch { return {}; }
}
function saveSyncMeta(value, email = currentUserEmail) {
  localStorage.setItem(getStorageKey(email) + '_sync', JSON.stringify(value));
}
function safeLinkUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {}
  return null;
}
function toggleMobileNavigation() {
  const open = document.body.classList.toggle('nav-open');
  document.getElementById('mobileMenu').setAttribute('aria-expanded', String(open));
}
function toggleSelectLink(id) {
  if (selectedLinkIds.has(id)) selectedLinkIds.delete(id); else selectedLinkIds.add(id);
  updateSelectionToolbar();
}
function updateSelectionToolbar() {
  const bar = document.getElementById('selectionToolbar');
  if (!bar) return;
  selectedLinkIds = new Set([...selectedLinkIds].filter(id => getScopedLinks().some(l => l.id === id)));
  bar.hidden = !selectedLinkIds.size;
  bar.style.display = selectedLinkIds.size ? 'flex' : 'none';
  document.getElementById('selectionCount').textContent = selectedLinkIds.size + ' selected';
  document.querySelectorAll('.link-checkbox').forEach(el => { el.checked = selectedLinkIds.has(el.dataset.id); });
}
async function bulkLinks(action) {
  if (!selectedLinkIds.size) return;
  if (action === 'delete' && !confirm('Delete the selected links from your account on all devices?')) return;
  vaultData.links.filter(l => selectedLinkIds.has(l.id)).forEach(l => {
    if (action === 'delete') l.deleted = true;
    if (action === 'star') l.starred = true;
    if (action === 'device') l.deviceIds = [...new Set([...(l.deviceIds || []), currentDeviceId])];
    l.updatedAt = new Date().toISOString();
  });
  selectedLinkIds.clear();
  await saveVault(); renderApp();
}
async function toggleLinkDevice(id) {
  const link = vaultData.links.find(l => l.id === id);
  if (!link) return;
  const ids = new Set(link.deviceIds || []);
  if (ids.has(currentDeviceId)) ids.delete(currentDeviceId); else ids.add(currentDeviceId);
  link.deviceIds = [...ids]; link.updatedAt = new Date().toISOString();
  await saveVault(); renderApp();
}
async function moveLink(id, direction) {
  if (searchQuery || activeCategory !== 'ALL' || activeProfileEmail || activeNavView !== 'ALL') {
    showToast('Open All Links and clear filters to reorder.'); return;
  }
  const visible = getScopedLinks().sort((a, b) => (a.order || 0) - (b.order || 0));
  const from = visible.findIndex(l => l.id === id), to = from + direction;
  if (from < 0 || to < 0 || to >= visible.length) return;
  [visible[from], visible[to]] = [visible[to], visible[from]];
  visible.forEach((l, index) => { l.order = index; l.updatedAt = new Date().toISOString(); });
  await saveVault(); renderApp();
}
async function openOfflineVault() {
  const email = document.getElementById('userEmailInput').value.trim().toLowerCase();
  const pass = document.getElementById('masterPasswordInput').value;
  const error = document.getElementById('unlockError');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || pass.length < 12) {
    error.textContent = 'Enter your email and a master password of at least 12 characters.'; return;
  }
  const cached = localStorage.getItem(getStorageKey(email));
  if (!cached && pass !== document.getElementById('confirmPasswordInput').value) {
    setLockMode(true); error.textContent = 'Confirm your password before creating a local vault.'; return;
  }
  try {
    await saveQueue;
    const data = cached ? await decryptData(JSON.parse(cached), pass) : { links: [], profiles: [], categories: [...DEFAULT_CATEGORIES] };
    cloudAuthToken = null; sessionStorage.removeItem('dreamslab_auth_token');
    currentUserEmail = email; currentPassword = pass; vaultData = data;
    localStorage.setItem('dreamslab_last_email', email);
    cloudVaultVersion = syncMeta(email).version || 0;
    normalizeVaultLinks();
    await saveVault();
    document.getElementById('lockScreen').style.display = 'none';
    renderApp(); error.textContent = '';
    showToast('Local vault opened. Cloud account sign-in is separate.');
  } catch { error.textContent = 'Unable to unlock this local vault. Check your password.'; }
}
async function retryPendingSync() {
  if (!currentPassword || !navigator.onLine || !cloudAuthToken) return;
  if (syncMeta().dirty && syncStatusState !== 'conflict') await saveVault();
}
const originalRenderApp = renderApp;
renderApp = function () {
  originalRenderApp(); updateSelectionToolbar();
  {
    const badge = document.getElementById('envModeBadge');
    if (badge) badge.textContent = 'Web app';
    const scope = document.getElementById('btnToggleScope');
    scope.textContent = filterToLocalOnly ? 'This device' : 'All devices';
    scope.title = 'Switch between links assigned to this browser and every link in your account';
    if (!cloudAuthToken) updateSyncBadge('offline');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  cloudFetch(cloudApiUrl + '/api/health').then(res => res.json()).then(health => {
    if (health.storage === 'file') {
      const status = document.getElementById('webStatus');
      status.hidden = false; status.textContent = 'Local preview: accounts created here are saved on this computer’s test server.';
    }
    if (health.migrationPending) {
      const status = document.getElementById('webStatus');
      status.hidden = false; status.textContent = 'Cloud accounts are being transferred. Cloud changes and registration will resume after verification.';
    }
  }).catch(() => {});
  document.getElementById('appToast').setAttribute('role', 'status');
  document.querySelectorAll('.form-group').forEach(group => {
    const label = group.querySelector('label'), control = group.querySelector('input:not([type=hidden]),select,textarea');
    if (label && control?.id) label.htmlFor = control.id;
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    el.addEventListener('click', () => document.body.classList.remove('nav-open'));
  });
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); });
  });
  {
    const taskPanel = document.getElementById('tasksSidebar');
    if (innerWidth <= 1200) taskPanel.classList.add('collapsed');
  }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      function showUpdate() {
        const bar = document.getElementById('webStatus');
        bar.hidden = false; bar.textContent = 'An app update is ready. Save your work, then reopen the app to use it.';
      }
      if (reg.waiting) showUpdate();
      reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', () => { if (reg.waiting && navigator.serviceWorker.controller) showUpdate(); }));
    }).catch(() => showToast('Offline app installation failed. Try reloading while online.'));
  }
});
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
  document.getElementById('installApp').hidden = false;
});
async function installWebApp() {
  if (installPrompt) { await installPrompt.prompt(); installPrompt = null; }
  else showToast('Use your browser menu → Install app / Add to Home Screen.');
}
window.addEventListener('online', retryPendingSync);
setInterval(retryPendingSync, 60000);
window.addEventListener('offline', () => updateSyncBadge('offline'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('nav-open'); closeDetailDrawer();
    document.querySelectorAll('.modal-overlay.open').forEach(el => closeModal(el.id));
  }
});

async function deleteCloudAccount() {
  if (!cloudAuthToken) { showToast('Sign in online before deleting your cloud account.'); return; }
  if (!confirm('Permanently delete your cloud account and every synced link? Export a backup first.')) return;
  try {
    const res = await cloudFetch(cloudApiUrl + '/api/account', { method: 'DELETE', headers: { Authorization: 'Bearer ' + cloudAuthToken } });
    if (!res.ok) throw new Error('Account deletion failed.');
    localStorage.removeItem(getStorageKey()); localStorage.removeItem(getStorageKey() + '_sync');
    await handleLogout(); showToast('Cloud account deleted. Clear cached copies on your other devices.');
  } catch (err) { showToast(err.message); }
}
