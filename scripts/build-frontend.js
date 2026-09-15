const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read current index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

console.log('Original index.html lines:', content.split(/\r?\n/).length);

// 1. Update version badge in Header
content = content.replace(/v1\.0\.[0-8]/g, 'v1.0.9');

// 2. Ensure Sync Badge in Header reflects Cloud State
// Find header and make sure cloudSyncBadge and envModeBadge are styled nicely
const oldSyncBadge = /<div id="cloudSyncBadge"[^>]*>[\s\S]*?<\/div>/;
if (oldSyncBadge.test(content)) {
  content = content.replace(oldSyncBadge, `<div id="cloudSyncBadge" class="sync-badge sync-local" onclick="handleSyncBadgeClick()" title="Local Mode. Click to sign in or connect DreamsLab Cloud."><span class="status-dot dot-gray"></span><span>Local Mode</span></div>`);
}

// 3. Add Plaintext Warning Modal if not present
if (!content.includes('id="plaintextWarningModal"')) {
  const plaintextModalHtml = `
  <!-- PLAINTEXT EXPORT SECURITY WARNING MODAL -->
  <div id="plaintextWarningModal" class="modal-overlay">
    <div class="modal-card" style="max-width: 460px;">
      <div class="modal-header" style="background: #fdf2f2; border-bottom: 1px solid #fecaca;">
        <div class="modal-title" style="color: #991b1b; display: flex; align-items: center; gap: 6px;">
          <span>⚠️</span> Insecure Plaintext Export
        </div>
        <button class="modal-close-btn" onclick="closeModal('plaintextWarningModal')">&times;</button>
      </div>
      <div class="modal-body" style="padding: 18px 20px;">
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5; margin-bottom: 14px; background: #fff5f5; padding: 12px; border-radius: 8px; border: 1px solid #fed7d7;">
          <b>WARNING:</b> Exporting in plaintext saves all your bookmarks, categories, and account emails <b>COMPLETELY UNENCRYPTED</b>. Anyone with access to this file will be able to view all your private links.
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
          To confirm that you understand the security risk, type <code style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:700;">EXPORT PLAINTEXT</code> below:
        </p>
        <input type="text" id="plaintextConfirmInput" class="form-control" placeholder="Type EXPORT PLAINTEXT" oninput="onPlaintextConfirmInputChange()" style="font-size: 13px; padding: 10px 12px; font-family: var(--font-mono); margin-bottom: 14px;">
        <button id="btnConfirmPlaintextExport" class="btn-primary" style="width: 100%; justify-content: center; background: #dc2626; border-color: #dc2626; height: 38px;" disabled onclick="confirmPlaintextExport()">
          Download Unencrypted JSON Backup
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal('plaintextWarningModal')">Cancel</button>
      </div>
    </div>
  </div>
  `;
  content = content.replace('<div id="localSaveModal"', plaintextModalHtml + '\n  <div id="localSaveModal"');
}

// 4. Update localSaveModal body to have Encrypted .dlvault export as primary, and Plaintext behind security warning
const newLocalSaveBody = `
      <div class="modal-body">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: var(--google-green); margin-bottom: 4px;">🔒 Export Encrypted Vault Backup (Recommended)</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Downloads an AES-256 encrypted <code>.dlvault</code> file protected by your Master Password.</p>
          <button class="btn-primary" style="width: 100%; justify-content: center; background: var(--google-green); border-color: var(--google-green);" onclick="exportEncryptedVault()">⬇ Export Encrypted Vault (.dlvault)</button>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: #b45309; margin-bottom: 4px;">⚠️ Plaintext JSON Export (Insecure)</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Export unencrypted JSON. Requires security confirmation.</p>
          <button class="btn-secondary" style="width: 100%; justify-content: center; color: #b45309; border-color: #fde68a;" onclick="openPlaintextExportModal()">Export Plaintext JSON...</button>
        </div>

        <div style="background: #f8fafd; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 13px; color: var(--google-purple); margin-bottom: 4px;">📥 Import Vault Backup</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Restore or merge links and profiles from an encrypted (<code>.dlvault</code>) or plaintext backup.</p>
          <input type="file" id="localBackupFileInput" accept=".dlvault,.json" onchange="handleImportVaultFile(event)" style="display:none;">
          <button class="btn-secondary" style="width: 100%; justify-content: center;" onclick="document.getElementById('localBackupFileInput').click()">Choose Backup File (.dlvault / .json)</button>
        </div>

        <div style="background: #fdf2f2; border: 1px solid #f5c2c7; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 600; font-size: 13px; color: var(--google-red); margin-bottom: 4px;">🧹 Reset Local Device</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Clear local cache and saved state on this computer (Cloud backup remains safe).</p>
          <button class="btn-secondary" style="width: 100%; justify-content: center; color: var(--google-red); border-color: rgba(217,48,37,0.3);" onclick="openResetDeviceModal(event)">🧹 Reset Local Device</button>
        </div>
        <div id="localSaveStatus" style="font-size: 12px; text-align: center; min-height: 16px; font-weight: 500; margin-top: 8px;"></div>
      </div>`;

content = content.replace(/<div class="modal-body">[\s\S]*?<\/div>\s*<div class="modal-footer">\s*<button class="btn-secondary" onclick="closeModal\('localSaveModal'\)">/m, newLocalSaveBody + '\n      <div class="modal-footer">\n        <button class="btn-secondary" onclick="closeModal(\'localSaveModal\')">');

// 5. Add "Keep me signed in on this PC" checkbox to Lock Screen
if (!content.includes('id="rememberSessionCheck"')) {
  const rememberCheckboxHtml = `
        <!-- KEEP ME SIGNED IN ON THIS PC -->
        <div id="rememberSessionGroup" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          <input type="checkbox" id="rememberSessionCheck" checked style="cursor: pointer; width: 15px; height: 15px; accent-color: var(--google-blue);">
          <label for="rememberSessionCheck" style="cursor: pointer; user-select: none;">Keep me signed in on this PC (SafeStorage DPAPI)</label>
        </div>
  `;
  content = content.replace('<button type="submit" id="unlockSubmitBtn"', rememberCheckboxHtml + '\n        <button type="submit" id="unlockSubmitBtn"');
}

// 6. Add Profile Filter Tabs (All / Starred / Pinned) to Sidebar
if (!content.includes('id="profileFilterTabs"')) {
  const profileFilterTabsHtml = `
      <!-- CHROME ACCOUNTS / EMAILS -->
      <div class="nav-section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span>Accounts</span>
          <button type="button" onclick="toggleProfileScope()" id="btnToggleScope" title="Toggle This PC vs All Cloud" style="background: #eaf1fb; border: 1px solid #d3e3fd; border-radius: 10px; font-size: 10px; cursor: pointer; color: var(--google-blue); font-weight: 600; padding: 1px 6px;">💻 Local</button>
        </span>
        <button class="btn-add-mini" onclick="openAddProfileModal()" title="Add Chrome Profile">+</button>
      </div>
      <!-- PROFILE FILTER TABS -->
      <div id="profileFilterTabs" style="display: flex; gap: 4px; padding: 2px 0 6px 0;">
        <button type="button" id="btnFilterProfAll" class="btn-filter-pill active" onclick="setSidebarProfileFilter('ALL')">All</button>
        <button type="button" id="btnFilterProfStarred" class="btn-filter-pill" onclick="setSidebarProfileFilter('STARRED')">⭐ Starred</button>
        <button type="button" id="btnFilterProfPinned" class="btn-filter-pill" onclick="setSidebarProfileFilter('PINNED')">📌 Pinned</button>
      </div>`;

  content = content.replace(/<!-- CHROME ACCOUNTS \/ EMAILS -->[\s\S]*?<div id="sidebarProfilesList"/, profileFilterTabsHtml + '\n      <div id="sidebarProfilesList"');
}

// Add CSS for .btn-filter-pill if not in style
if (!content.includes('.btn-filter-pill')) {
  const extraCss = `
    .btn-filter-pill {
      flex: 1;
      padding: 3px 6px;
      font-size: 10.5px;
      font-family: var(--font-google);
      font-weight: 500;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-secondary);
      border-radius: var(--radius-full);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }
    .btn-filter-pill:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .btn-filter-pill.active {
      background: var(--google-blue-light);
      color: var(--google-blue);
      border-color: #a8c7fa;
      font-weight: 600;
    }
    .btn-profile-action {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
      border-radius: 4px;
      opacity: 0.6;
      transition: opacity 0.15s, transform 0.15s;
    }
    .btn-profile-action:hover {
      opacity: 1;
      transform: scale(1.15);
    }
    .btn-profile-action.active {
      opacity: 1;
    }
    .sync-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
    }
    .sync-local {
      background: #f1f3f4;
      color: #5f6368;
      border: 1px solid #dadce0;
    }
    .sync-online {
      background: #e6f4ea;
      color: #137333;
      border: 1px solid #ceead6;
    }
    .sync-offline {
      background: #fef7e0;
      color: #b06000;
      border: 1px solid #feefc3;
    }
    .sync-expired {
      background: #fce8e6;
      color: #c5221f;
      border: 1px solid #fad2cf;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-gray { background: #9aa0a6; }
    .dot-green { background: #1e8e3e; }
    .dot-yellow { background: #f9ab00; }
    .dot-red { background: #d93025; }
  `;
  content = content.replace('</style>', extraCss + '\n  </style>');
}

fs.writeFileSync(indexPath, content, 'utf8');
console.log('HTML structure updated successfully.');
