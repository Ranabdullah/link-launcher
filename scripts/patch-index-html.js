const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

console.log('Starting targeted patching of index.html...');

// 1. Version Bump
content = content.replace(/v1\.0\.[0-8]/g, 'v1.0.9');

// 2. Remove any remaining dreamslab_session_key password saves
content = content.replace(/localStorage\.setItem\('dreamslab_session_key'[^;]+;/g, '// dreamslab_session_key purged for zero-knowledge security');
content = content.replace(/localStorage\.removeItem\('dreamslab_session_key'\);/g, '// dreamslab_session_key removed\n      clearSecureSession();');
content = content.replace(/const savedSession = localStorage\.getItem\('dreamslab_session_key'\);[\s\S]*?}/g, `// SafeStorage Session Check
        const savedSession = await retrieveSecureSession();
        if (savedSession && savedSession.email && savedSession.token) {
          currentUserEmail = savedSession.email;
          cloudAuthToken = savedSession.token;
          setCloudState('CLOUD_CONNECTED');
        }`);

// 3. Replace DEFAULT_KNOWN_LOCAL_EMAILS and getLocalEmailsSet
const localDetectionRegex = /const DEFAULT_KNOWN_LOCAL_EMAILS[\s\S]*?function getLocalEmailsSet\(\)[\s\S]*?return set;\s*}/;
const newLocalDetectionLogic = `
    // ZERO-FALLBACK STRICT LOCAL PC CHROME DETECTION (Requirement 1)
    function getLocalEmailsSet() {
      const set = new Set();
      if (Array.isArray(localDetectedProfiles)) {
        localDetectedProfiles.forEach(lp => {
          const email = (lp.email || '').toLowerCase().trim();
          if (email) set.add(email);
        });
      }
      return set;
    }
`;
if (localDetectionRegex.test(content)) {
  content = content.replace(localDetectionRegex, newLocalDetectionLogic);
  console.log('Patched getLocalEmailsSet and removed DEFAULT_KNOWN_LOCAL_EMAILS');
} else {
  // Try finding getLocalEmailsSet directly
  content = content.replace(/function getLocalEmailsSet\(\)[\s\S]*?return set;\s*}/, newLocalDetectionLogic);
  console.log('Patched getLocalEmailsSet directly');
}

// 4. Update getDisplayProfiles to support Starred / Pinned sorting and filter tabs
const getDisplayProfilesRegex = /function getDisplayProfiles\(\)\s*\{[\s\S]*?return vaultData\.profiles \|\| \[\];\s*\}/;
const newGetDisplayProfilesLogic = `
    let sidebarProfileFilter = 'ALL'; // 'ALL' | 'STARRED' | 'PINNED'

    function setSidebarProfileFilter(filter) {
      sidebarProfileFilter = filter;
      ['All', 'Starred', 'Pinned'].forEach(tab => {
        const btn = document.getElementById('btnFilterProf' + tab);
        if (btn) btn.classList.toggle('active', tab.toUpperCase() === filter);
      });
      renderSidebarProfiles();
    }

    function sortAndFilterProfiles(profiles, filter = 'ALL', activeScopeEmails = null) {
      if (!Array.isArray(profiles)) return [];

      let list = profiles.filter(p => {
        if (!p) return false;
        if (activeScopeEmails !== null) {
          const email = (p.email || '').toLowerCase().trim();
          if (!email || !activeScopeEmails.has(email)) return false;
        }
        return true;
      });

      if (filter === 'STARRED') {
        list = list.filter(p => !!p.starred);
      } else if (filter === 'PINNED') {
        list = list.filter(p => !!p.pinned);
      }

      return list.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (aStarred !== bStarred) return bStarred - aStarred;

        const aName = (a.name || a.email || '').toLowerCase();
        const bName = (b.name || b.email || '').toLowerCase();
        return aName.localeCompare(bName);
      });
    }

    function getDisplayProfiles() {
      const scopeEmails = filterToLocalOnly ? getLocalEmailsSet() : null;
      return sortAndFilterProfiles(vaultData.profiles || [], sidebarProfileFilter, scopeEmails);
    }

    async function toggleProfileStar(profileIdOrEmail, event) {
      if (event) event.stopPropagation();
      const p = (vaultData.profiles || []).find(prof => prof.id === profileIdOrEmail || prof.email === profileIdOrEmail);
      if (p) {
        p.starred = !p.starred;
        p.updatedAt = new Date().toISOString();
        await saveVault();
        renderSidebarProfiles();
        showToast(p.starred ? '⭐ Starred ' + (p.name || p.email) : 'Unstarred ' + (p.name || p.email));
      }
    }

    async function toggleProfilePin(profileIdOrEmail, event) {
      if (event) event.stopPropagation();
      const p = (vaultData.profiles || []).find(prof => prof.id === profileIdOrEmail || prof.email === profileIdOrEmail);
      if (p) {
        p.pinned = !p.pinned;
        p.updatedAt = new Date().toISOString();
        await saveVault();
        renderSidebarProfiles();
        showToast(p.pinned ? '📌 Pinned ' + (p.name || p.email) + ' to top' : 'Unpinned ' + (p.name || p.email));
      }
    }
`;
if (getDisplayProfilesRegex.test(content)) {
  content = content.replace(getDisplayProfilesRegex, newGetDisplayProfilesLogic);
  console.log('Patched getDisplayProfiles and added Profile Star/Pin handlers');
}

// 5. Update renderSidebarProfiles to render ⭐ and 📌 buttons for each profile row
const renderSidebarProfilesRegex = /function renderSidebarProfiles\(\)[\s\S]*?container\.innerHTML = html;\s*\}/;
const newRenderSidebarProfilesLogic = `
    function renderSidebarProfiles() {
      const container = document.getElementById('sidebarProfilesList');
      if (!container) return;
      let html = '';

      const btnScope = document.getElementById('btnToggleScope');
      if (btnScope) {
        btnScope.style.display = 'inline-block';
        btnScope.textContent = filterToLocalOnly ? '💻 Local' : '☁️ Cloud';
        btnScope.title = filterToLocalOnly ? 'Viewing profiles on this PC (Click to view Cloud)' : 'Viewing all cloud profiles (Click for Local)';
      }

      const displayProfiles = getDisplayProfiles();

      // Diagnostic message when 0 profiles displayed on desktop
      if (filterToLocalOnly && displayProfiles.length === 0) {
        let reason = 'No Chrome profiles matching this computer were detected.';
        if (chromeDetectionStatus === 'CHROME_NOT_INSTALLED') reason = 'Chrome is not installed on this PC.';
        else if (chromeDetectionStatus === 'NO_PROFILES_DIR') reason = 'Chrome User Data directory not found.';
        else if (chromeDetectionStatus === 'NO_PROFILES') reason = 'No Chrome user profiles found.';
        else if (chromeDetectionStatus === 'NO_EMAILS') reason = 'No signed-in Google accounts found in Chrome.';
        else if (chromeDetectionStatus === 'DETECTION_FAILED') reason = 'Chrome detection error: ' + (chromeDetectionError || 'Could not read profile data.');

        html += \`
          <div style="padding: 10px 12px; background: #f8f9fa; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); font-size: 11px; color: var(--text-muted); margin: 6px 0;">
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 2px;">No Local Accounts</div>
            \${reason}
            <div style="margin-top: 6px; display: flex; gap: 4px;">
              <button class="btn-link-optin" style="font-size: 10px; padding: 2px 6px;" onclick="refreshLocalChromeProfiles()">🔄 Detect</button>
              <button class="btn-link-optin" style="font-size: 10px; padding: 2px 6px;" onclick="toggleProfileScope()">☁️ View Cloud</button>
            </div>
          </div>
        \`;
      }

      // Render Active / Matching Profiles
      displayProfiles.forEach(p => {
        const meta = getProfileMeta(p.email, p.name);
        const isLocalInstalled = p.email && getLocalEmailsSet().has(p.email.toLowerCase().trim());
        const count = getScopedLinks().filter(l => {
          const lp = getProfileForLink(l);
          return (p.email && lp.email && lp.email.toLowerCase() === p.email.toLowerCase()) || (p.id && lp.id === p.id);
        }).length;

        const isActive = activeProfileEmail && (
          (p.email && activeProfileEmail.toLowerCase() === p.email.toLowerCase()) ||
          (p.id && activeProfileEmail === p.id)
        );

        const starActive = !!p.starred;
        const pinActive = !!p.pinned;

        html += \`
          <div class="account-item \${isActive ? 'active' : ''}" onclick="selectProfileFilter('\${escapeHtml(p.email || p.id)}')">
            <div style="display:flex; align-items:center; min-width:0; flex:1;">
              <div class="account-avatar" style="background: \${meta.color}; color:#fff; font-weight:700;">\${meta.letter}</div>
              <div class="account-info">
                <div class="account-name" style="font-weight:600; display:flex; align-items:center; gap:4px;">
                  <span>\${escapeHtml(meta.name)}</span>
                  \${isLocalInstalled ? '<span title="Installed on this PC" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#188038; flex-shrink:0;"></span>' : '<span title="Cloud profile" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#9aa0a6; flex-shrink:0;"></span>'}
                </div>
                <div class="account-email">\${escapeHtml(p.email || 'Default')}</div>
              </div>
            </div>
            <div class="account-item-right" style="display:flex; align-items:center; gap:3px;">
              <button type="button" class="btn-profile-action \${pinActive ? 'active' : ''}" onclick="toggleProfilePin('\${escapeHtml(p.id || p.email)}', event)" title="\${pinActive ? 'Unpin account' : 'Pin account to top'}">\${pinActive ? '📌' : '📍'}</button>
              <button type="button" class="btn-profile-action \${starActive ? 'active' : ''}" onclick="toggleProfileStar('\${escapeHtml(p.id || p.email)}', event)" title="\${starActive ? 'Unstar account' : 'Star account'}">\${starActive ? '⭐' : '☆'}</button>
              <span class="nav-badge">\${count}</span>
              <button type="button" class="btn-profile-del" onclick="deleteProfile('\${escapeHtml(p.id || p.email)}', event)" title="Remove this profile">✕</button>
            </div>
          </div>
        \`;
      });

      // Unlinked Local Chrome Profiles (on desktop)
      const unlinked = getUnlinkedLocalProfiles();
      if (unlinked.length > 0) {
        html += \`
          <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px;">
              Detected on this PC (Unlinked)
            </div>
        \`;

        unlinked.forEach(ulp => {
          const meta = getProfileMeta(ulp.email, ulp.name);
          html += \`
            <div class="unlinked-profile-item">
              <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                <div class="account-avatar" style="width:20px; height:20px; font-size:10px; background:\${meta.color}; color:#fff;">\${meta.letter}</div>
                <div style="min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  <div style="font-weight:600; font-size:11px;">\${escapeHtml(meta.name)}</div>
                  <div style="font-size:10px; color:var(--text-muted);">\${escapeHtml(ulp.email)}</div>
                </div>
              </div>
              <button type="button" class="btn-link-optin" onclick="linkLocalProfileToAccount('\${escapeHtml(ulp.email)}', '\${escapeHtml(ulp.name)}')">+ Link</button>
            </div>
          \`;
        });
        html += \`</div>\`;
      }

      container.innerHTML = html;
    }
`;
if (renderSidebarProfilesRegex.test(content)) {
  content = content.replace(renderSidebarProfilesRegex, newRenderSidebarProfilesLogic);
  console.log('Patched renderSidebarProfiles with Star and Pin buttons');
}

// 6. Insert 3-Way Merge, SafeStorage Helpers, and Schema Validation into JS
const extraJsLogic = `
    /* ==========================================================================
       3-WAY MERGE ENGINE & SAFESTORAGE HELPERS
       ========================================================================== */
    let CloudState = 'LOCAL_ONLY'; // 'LOCAL_ONLY' | 'CLOUD_CONNECTED' | 'CLOUD_OFFLINE' | 'CLOUD_EXPIRED'
    let pendingOfflineSyncCount = 0;
    let lastSyncedVault = null;

    function setCloudState(newState, detail = '') {
      CloudState = newState;
      updateCloudSyncBadge();
    }

    function updateCloudSyncBadge() {
      const badge = document.getElementById('cloudSyncBadge');
      if (!badge) return;
      if (CloudState === 'LOCAL_ONLY') {
        badge.className = 'sync-badge sync-local';
        badge.innerHTML = '<span class="status-dot dot-gray"></span><span>Local Mode</span>';
        badge.title = 'Local view. Click to sign in or connect DreamsLab Cloud.';
      } else if (CloudState === 'CLOUD_CONNECTED') {
        badge.className = 'sync-badge sync-online';
        badge.innerHTML = '<span class="status-dot dot-green"></span><span>Cloud Connected</span>';
        badge.title = 'Connected to DreamsLab Cloud (' + currentUserEmail + '). Vault v' + cloudVaultVersion;
      } else if (CloudState === 'CLOUD_OFFLINE') {
        badge.className = 'sync-badge sync-offline';
        const pStr = pendingOfflineSyncCount > 0 ? ' (' + pendingOfflineSyncCount + ' pending)' : '';
        badge.innerHTML = '<span class="status-dot dot-yellow"></span><span>Offline' + pStr + '</span>';
        badge.title = 'Offline mode. Changes saved locally.';
      } else if (CloudState === 'CLOUD_EXPIRED') {
        badge.className = 'sync-badge sync-expired';
        badge.innerHTML = '<span class="status-dot dot-red"></span><span>Session Expired</span>';
        badge.title = 'Session expired. Click to re-enter master password.';
      }
    }

    function handleSyncBadgeClick() {
      if (CloudState === 'LOCAL_ONLY' || CloudState === 'CLOUD_EXPIRED') {
        openModal('cloudModal');
      } else {
        syncWithCloudVault(true);
      }
    }

    async function storeSecureSession(email, token) {
      if (isDesktopApp && window.electronAPI && window.electronAPI.secureStoreSession) {
        try {
          await window.electronAPI.secureStoreSession({ email, token, updatedAt: new Date().toISOString() });
        } catch(e) {
          console.warn('safeStorage store error:', e);
        }
      }
      sessionStorage.setItem('dreamslab_auth_token', token);
      localStorage.setItem('dreamslab_auth_email_last', email);
    }

    async function retrieveSecureSession() {
      if (isDesktopApp && window.electronAPI && window.electronAPI.secureRetrieveSession) {
        try {
          const res = await window.electronAPI.secureRetrieveSession();
          if (res && res.success && res.session) {
            return res.session;
          }
        } catch(e) {
          console.warn('safeStorage retrieve error:', e);
        }
      }
      const token = sessionStorage.getItem('dreamslab_auth_token');
      const email = localStorage.getItem('dreamslab_auth_email_last');
      if (token && email) return { token, email };
      return null;
    }

    async function clearSecureSession() {
      if (isDesktopApp && window.electronAPI && window.electronAPI.secureClearSession) {
        try {
          await window.electronAPI.secureClearSession();
        } catch(e) {}
      }
      sessionStorage.removeItem('dreamslab_auth_token');
      localStorage.removeItem('dreamslab_session_key');
    }

    function merge3WayVault(baseVault, localVault, remoteVault) {
      const base = baseVault || { links: [], profiles: [], categories: [] };
      const local = localVault || { links: [], profiles: [], categories: [] };
      const remote = remoteVault || { links: [], profiles: [], categories: [] };

      const baseLinksMap = new Map((base.links || []).map(l => [l.id, l]));
      const localLinksMap = new Map((local.links || []).map(l => [l.id, l]));
      const remoteLinksMap = new Map((remote.links || []).map(l => [l.id, l]));

      const allLinkIds = new Set([
        ...baseLinksMap.keys(),
        ...localLinksMap.keys(),
        ...remoteLinksMap.keys()
      ]);

      const mergedLinks = [];

      for (const id of allLinkIds) {
        const baseLink = baseLinksMap.get(id);
        const localLink = localLinksMap.get(id);
        const remoteLink = remoteLinksMap.get(id);

        if (!baseLink && localLink && !remoteLink) {
          mergedLinks.push(localLink);
          continue;
        }

        if (!baseLink && !localLink && remoteLink) {
          mergedLinks.push(remoteLink);
          continue;
        }

        if (!baseLink && localLink && remoteLink) {
          const lTime = new Date(localLink.updatedAt || localLink.createdAt || 0).getTime();
          const rTime = new Date(remoteLink.updatedAt || remoteLink.createdAt || 0).getTime();
          mergedLinks.push(lTime >= rTime ? localLink : remoteLink);
          continue;
        }

        if (baseLink) {
          if (!localLink && !remoteLink) continue;
          if (localLink?.deleted && remoteLink?.deleted) continue;

          if (!localLink || localLink.deleted) {
            const rTime = new Date(remoteLink?.updatedAt || 0).getTime();
            const bTime = new Date(baseLink.updatedAt || 0).getTime();
            if (rTime > bTime) mergedLinks.push(remoteLink);
            continue;
          }

          if (!remoteLink || remoteLink.deleted) {
            const lTime = new Date(localLink.updatedAt || 0).getTime();
            const bTime = new Date(baseLink.updatedAt || 0).getTime();
            if (lTime > bTime) mergedLinks.push(localLink);
            continue;
          }

          const lTime = new Date(localLink.updatedAt || 0).getTime();
          const rTime = new Date(remoteLink.updatedAt || 0).getTime();
          mergedLinks.push(lTime >= rTime ? localLink : remoteLink);
        }
      }

      // Merge Profiles
      const profMap = new Map();
      const cleanProf = p => {
        if (!p) return null;
        const c = Object.assign({}, p);
        delete c.folder;
        return c;
      };

      (remote.profiles || []).forEach(p => {
        const email = (p.email || '').toLowerCase().trim();
        const key = email || p.id;
        if (key) profMap.set(key, cleanProf(p));
      });

      (local.profiles || []).forEach(lp => {
        const email = (lp.email || '').toLowerCase().trim();
        const key = email || lp.id;
        if (!key) return;
        const c = cleanProf(lp);
        if (!profMap.has(key)) {
          profMap.set(key, c);
        } else {
          const ex = profMap.get(key);
          const lTime = new Date(c.updatedAt || 0).getTime();
          const rTime = new Date(ex.updatedAt || 0).getTime();
          profMap.set(key, lTime >= rTime ? Object.assign({}, ex, c) : Object.assign({}, c, ex));
        }
      });

      const catSet = new Set([
        ...DEFAULT_CATEGORIES,
        ...(base.categories || []),
        ...(remote.categories || []),
        ...(local.categories || [])
      ]);

      return {
        links: mergedLinks,
        profiles: Array.from(profMap.values()),
        categories: Array.from(catSet),
        cloudConfig: Object.assign({}, base.cloudConfig, remote.cloudConfig, local.cloudConfig)
      };
    }

    function validateAndSanitizeImport(input) {
      let parsed = null;
      if (typeof input === 'string') {
        try {
          parsed = JSON.parse(input);
        } catch (e) {
          return { valid: false, error: 'Invalid JSON: ' + e.message };
        }
      } else if (typeof input === 'object' && input !== null) {
        parsed = input;
      } else {
        return { valid: false, error: 'Input must be a valid JSON string or object.' };
      }

      if (parsed.data && parsed.iv) {
        return { valid: true, isEncrypted: true, data: parsed };
      }

      if (!parsed.links && !parsed.profiles && !Array.isArray(parsed)) {
        return { valid: false, error: 'File missing required vault structures (links/profiles).' };
      }

      const rawLinks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.links) ? parsed.links : []);
      const sanitizedLinks = [];

      for (const link of rawLinks) {
        if (!link || typeof link !== 'object') continue;
        let url = String(link.url || '').trim();
        if (url) {
          try {
            const p = new URL(url);
            if (p.protocol !== 'http:' && p.protocol !== 'https:') url = '';
          } catch(e) { url = ''; }
        }
        sanitizedLinks.push({
          id: link.id || 'link_' + Math.random().toString(36).substr(2, 9),
          title: String(link.title || link.name || 'Untitled').slice(0, 300),
          url: url,
          category: String(link.category || 'General').slice(0, 100),
          profileEmail: (link.profileEmail || '').toLowerCase().trim(),
          profileId: link.profileId || '',
          priority: ['HIGH', 'MEDIUM', 'LOW'].includes(link.priority) ? link.priority : 'MEDIUM',
          starred: !!link.starred,
          pinned: !!link.pinned,
          deleted: !!link.deleted,
          createdAt: link.createdAt || new Date().toISOString(),
          updatedAt: link.updatedAt || new Date().toISOString()
        });
      }

      const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
      const sanitizedProfiles = [];
      for (const prof of rawProfiles) {
        if (!prof || typeof prof !== 'object') continue;
        const email = (prof.email || '').toLowerCase().trim();
        sanitizedProfiles.push({
          id: prof.id || 'prof_' + Math.random().toString(36).substr(2, 9),
          name: String(prof.name || email.split('@')[0] || 'Profile').slice(0, 100),
          email: email,
          color: prof.color || '#0b57d0',
          starred: !!prof.starred,
          pinned: !!prof.pinned,
          createdAt: prof.createdAt || new Date().toISOString(),
          updatedAt: prof.updatedAt || new Date().toISOString()
        });
      }

      return {
        valid: true,
        isEncrypted: false,
        data: {
          links: sanitizedLinks,
          profiles: sanitizedProfiles,
          categories: Array.isArray(parsed.categories) ? parsed.categories : undefined,
          cloudConfig: parsed.cloudConfig || {}
        }
      };
    }

    async function exportEncryptedVault() {
      if (!currentPassword) { showToast('⚠️ Unlock required to export vault'); return; }
      try {
        const encrypted = await encryptData(vaultData, currentPassword);
        const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = 'dreamslab_vault_backup_' + (currentUserEmail || 'vault') + '_' + dateStr + '.dlvault';
        a.click();
        URL.revokeObjectURL(url);
        closeModal('localSaveModal');
        showToast('🔒 Encrypted Vault exported safely (.dlvault)');
      } catch (err) {
        showToast('❌ Export failed: ' + err.message);
      }
    }

    function openPlaintextExportModal() {
      closeModal('localSaveModal');
      const input = document.getElementById('plaintextConfirmInput');
      const btn = document.getElementById('btnConfirmPlaintextExport');
      if (input) input.value = '';
      if (btn) btn.disabled = true;
      openModal('plaintextWarningModal');
    }

    function onPlaintextConfirmInputChange() {
      const input = document.getElementById('plaintextConfirmInput');
      const btn = document.getElementById('btnConfirmPlaintextExport');
      if (input && btn) {
        btn.disabled = input.value.trim() !== 'EXPORT PLAINTEXT';
      }
    }

    function confirmPlaintextExport() {
      const input = document.getElementById('plaintextConfirmInput');
      if (!input || input.value.trim() !== 'EXPORT PLAINTEXT') return;
      closeModal('plaintextWarningModal');
      const blob = new Blob([JSON.stringify(vaultData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = 'dreamslab_vault_UNENCRYPTED_' + (currentUserEmail || 'vault') + '_' + dateStr + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('⚠️ Exported PLAINTEXT backup (Insecure)');
    }

    async function handleImportVaultFile(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          const result = validateAndSanitizeImport(fileContent);
          if (!result.valid) {
            showToast('❌ Import error: ' + result.error);
            return;
          }

          if (result.isEncrypted) {
            let decrypted = null;
            try {
              decrypted = await decryptData(result.data, currentPassword);
            } catch (decErr) {
              const pass = prompt('This backup was encrypted with a master password.\\nEnter password for this backup:');
              if (pass) {
                decrypted = await decryptData(result.data, pass.trim());
              } else {
                showToast('❌ Import cancelled');
                return;
              }
            }
            if (decrypted && decrypted.links) {
              const sanitized = validateAndSanitizeImport(decrypted);
              if (sanitized.valid && sanitized.data) {
                vaultData = merge3WayVault(lastSyncedVault, vaultData, sanitized.data);
                await saveVault();
                renderApp();
                closeModal('localSaveModal');
                showToast('✅ Successfully restored encrypted backup!');
              }
            }
          } else if (result.data) {
            vaultData = merge3WayVault(lastSyncedVault, vaultData, result.data);
            await saveVault();
            renderApp();
            closeModal('localSaveModal');
            showToast('✅ Successfully imported backup!');
          }
        } catch (err) {
          showToast('❌ Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
`;

if (!content.includes('merge3WayVault(')) {
  content = content.replace('/* ==========================================================================\n       CRYPTO ENGINE', extraJsLogic + '\n    /* ==========================================================================\n       CRYPTO ENGINE');
  console.log('Added 3-Way merge, safeStorage, and validation logic into JS');
}

fs.writeFileSync(indexPath, content, 'utf8');

// Mirror directly to Link_Launcher.html
const launcherPath = path.join(__dirname, '..', 'Link_Launcher.html');
fs.writeFileSync(launcherPath, content, 'utf8');

// Compute SHA-256 Checksum and write version.json
const sha256 = crypto.createHash('sha256').update(content).digest('hex');
const versionJsonPath = path.join(__dirname, '..', 'version.json');
const versionManifest = {
  version: '1.0.9',
  sha256: sha256,
  releaseDate: new Date().toISOString().split('T')[0],
  notes: 'DreamsLab Link Launcher v1.0.9 - Full Architecture & Security Suite (3-Way Merge, Local Account Isolation, Account Star/Pin, SafeStorage DPAPI, Validated Backups)'
};
fs.writeFileSync(versionJsonPath, JSON.stringify(versionManifest, null, 2), 'utf8');

// Update package.json version
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '1.0.9';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

console.log('Patching complete! SHA-256:', sha256);
