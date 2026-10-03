// Copyright 2026 DreamsLab Studio. Commercial activation component.
// This controls the unmodified commercial edition. It is not tamper-proof DRM.
(() => {
  'use strict';
  const config = window.LINK_LAUNCHER_LICENSE;
  if (!config?.publicKey) throw new Error('Commercial licence verification is not configured.');
  const encoder = new TextEncoder();
  const keyName = 'dl_commercial_license_v1';
  const installationKey = 'dl_commercial_installation_v1';
  let installation = localStorage.getItem(installationKey);
  if (!installation) { installation = crypto.randomUUID(); localStorage.setItem(installationKey, installation); }
  let accepted = null;
  let acceptedBundle = null;
  const originalSetLockMode = window.setLockMode;
  window.setLockMode = function (createMode) {
    if (!window.LINK_LAUNCHER_CLOUD?.localOnly) return originalSetLockMode(createMode);
    const hasVault = accepted && localStorage.getItem(getStorageKey(accepted.email));
    originalSetLockMode(!hasVault);
    document.getElementById('lockTitle').textContent = hasVault ? 'Open your local vault' : 'Create your local vault';
    document.getElementById('lockSubtitle').textContent = 'Encrypted links saved in this browser';
    document.getElementById('unlockSubmitBtn').textContent = 'Open local vault';
    document.getElementById('tabCreateAccount').parentElement.style.display = 'none';
    document.getElementById('lockFooterToggle').textContent = 'No cloud account is needed for local use.';
  };
  const originalCloudFetch = window.cloudFetch;
  window.cloudFetch = function (url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (acceptedBundle) headers.set('X-Link-Launcher-License', JSON.stringify(acceptedBundle));
    return originalCloudFetch(url, { ...options, headers });
  };
  function decode(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
  async function validate(bundle) {
    if (!bundle || typeof bundle.payload !== 'string' || typeof bundle.signature !== 'string' || bundle.payload.length > 4096 || bundle.signature.length > 256) throw new Error('Invalid licence file.');
    const key = await crypto.subtle.importKey('jwk', config.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode(bundle.signature), encoder.encode(bundle.payload))) throw new Error('The licence signature is invalid.');
    const licence = JSON.parse(bundle.payload);
    if (licence.product !== 'link-launcher-commercial-v1' || licence.installation !== installation || typeof licence.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(licence.email) || !licence.order || licence.version !== 1) throw new Error('This licence belongs to a different browser installation or product.');
    return licence;
  }
  const ready = new Promise(resolve => { window.addEventListener('DOMContentLoaded', async () => {
    const overlay = document.createElement('div');
    overlay.id = 'commercialActivation'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:#f5f7fc;z-index:100000;display:grid;place-items:center;padding:20px;overflow:auto';
    overlay.innerHTML = `<section style="background:white;padding:28px;border:1px solid #dbe2f0;border-radius:20px;max-width:460px;width:100%;box-sizing:border-box;font:14px/1.6 system-ui;color:#17243c"><img src="favicon.png" alt="" width="56" height="56"><h1 style="font-size:24px">Activate Link Launcher</h1><p>Each purchased licence is for one person, with up to three browser installations. Activate this browser once; local use then works offline.</p><label for="activationRequest">Send this installation code to the seller through your purchase order</label><input id="activationRequest" readonly style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0 16px;border:1px solid #ccd6ea;border-radius:8px"><label for="commercialLicenseFile">Import the signed .lllicense file provided by the seller</label><input type="file" id="commercialLicenseFile" accept=".lllicense,application/json" style="display:block;max-width:100%;margin:12px 0"><p id="commercialLicenseStatus" role="status"></p><p style="color:#64748b;font-size:12px">Keep your licence file. Clearing browser data creates a new installation code. Licence activation never reads your links or master password.</p></section>`;
    document.body.append(overlay);
    document.getElementById('activationRequest').value = 'LL1:' + installation;
    const status = document.getElementById('commercialLicenseStatus');
    async function accept(bundle) {
      accepted = await validate(bundle);
      acceptedBundle = bundle;
      window.LINK_LAUNCHER_ACTIVATED = true;
      localStorage.setItem(keyName, JSON.stringify(bundle));
      overlay.remove();
      window.dispatchEvent(new Event('link-launcher-activated'));
      document.getElementById('userEmailInput').value = accepted.email;
      if (window.LINK_LAUNCHER_CLOUD?.localOnly) setLockMode(true);
    }
    document.getElementById('commercialLicenseFile').addEventListener('change', async event => {
      try {
        const file = event.target.files[0];
        if (!file || file.size > 8192) throw new Error('Choose a valid licence file smaller than 8 KB.');
        await accept(JSON.parse(await file.text()));
      } catch (error) { status.textContent = error.message; status.style.color = '#c5221f'; }
    });
    try {
      const saved = localStorage.getItem(keyName);
      if (saved) await accept(JSON.parse(saved));
    } catch { status.textContent = 'Saved activation is invalid. Import the licence for this browser.'; }
    resolve();
  }, { once: true }); });
  function authorised() {
    const email = document.getElementById('userEmailInput').value.trim().toLowerCase();
    if (accepted && accepted.email === email) return true;
    document.getElementById('unlockError').textContent = accepted ? 'Use the email on your purchased licence.' : 'Activate this browser with a valid purchased licence first.';
    return false;
  }
  const originalUnlock = window.handleUnlock;
  const originalLocal = window.openOfflineVault;
  window.handleUnlock = async function (event, credentials) {
    event?.preventDefault(); await ready;
    if (!authorised()) return;
    return window.LINK_LAUNCHER_CLOUD?.localOnly ? originalLocal(event, credentials) : originalUnlock(event, credentials);
  };
  window.openOfflineVault = async function (...args) { await ready; if (authorised()) return originalLocal(...args); };
  window.addEventListener('DOMContentLoaded', () => {
    if (window.LINK_LAUNCHER_CLOUD?.localOnly) {
      setLockMode(true);
      document.getElementById('unlockSubmitBtn').textContent = 'Open local vault';
      document.getElementById('webStatus').hidden = false;
      document.getElementById('webStatus').textContent = 'Local edition: encrypted links stay in this browser. Use your own cloud edition for sync.';
    }
  }, { once: true });
})();
