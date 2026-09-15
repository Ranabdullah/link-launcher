// Detect runtime: Node.js cloud server (Render, Railway, etc.) vs Electron desktop app
let electron;
try {
  electron = require('electron');
} catch (e) {}

if (!electron || typeof electron !== 'object' || !electron.app) {
  console.log('DreamsLab: Running in Node.js server environment.');
  console.log('Starting Cloud Vault API backend...');
  const { startServer } = require('./server/server.js');
  startServer();
} else {
  runDesktopApplication(electron);
}

function runDesktopApplication(electron) {
  const { app, BrowserWindow, ipcMain, shell } = electron;
  const path = require('path');
  const fs = require('fs');
  const https = require('https');
  const crypto = require('crypto');
  const { spawn } = require('child_process');

  // Single Instance Lock: prevents duplicate processes and installer conflicts
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }

  let mainWindow;

function isValidHtmlPackage(content) {
  if (!content || typeof content !== 'string') return false;
  if (content.length < 20000) return false;
  const lower = content.toLowerCase();
  return lower.includes('<!doctype html') && lower.includes('<html') && lower.includes('</html>') && lower.includes('<script>') && lower.includes('</script>');
}

function getActiveHtmlPath() {
  const updateDir = path.join(app.getPath('userData'), 'update');
  const userHtmlPath = path.join(updateDir, 'index.html');
  const backupPath = path.join(updateDir, 'index.html.backup');

  if (fs.existsSync(userHtmlPath)) {
    try {
      const content = fs.readFileSync(userHtmlPath, 'utf8');
      if (isValidHtmlPackage(content)) {
        return userHtmlPath;
      } else {
        console.warn('Cached index.html failed validation. Attempting rollback...');
        if (fs.existsSync(backupPath)) {
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          if (isValidHtmlPackage(backupContent)) {
            fs.writeFileSync(userHtmlPath, backupContent, 'utf8');
            return userHtmlPath;
          }
        }
      }
    } catch (e) {
      console.warn('Error verifying cached HTML:', e.message);
    }
  }
  return path.join(__dirname, 'index.html');
}

function getWindowIcon() {
  const candidates = [
    path.join(__dirname, 'app_icon.ico'),
    path.join(__dirname, 'app_icon.png'),
    path.join(__dirname, 'favicon.png'),
    path.join(process.resourcesPath || '', 'app_icon.ico'),
    path.join(process.resourcesPath || '', 'app_icon.png')
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch(e) {}
  }
  return undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 950,
    minHeight: 650,
    backgroundColor: '#06080d',
    icon: getWindowIcon(),
    title: 'DreamsLab Cyber Launcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true // Security Hardening: Enable standard SOP and web security
    }
  });

  const activePath = getActiveHtmlPath();
  mainWindow.loadFile(activePath);

  mainWindow.on('focus', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.focus();
    }
  });

  // Fallback to bundled HTML if loaded path fails
  mainWindow.webContents.on('did-fail-load', () => {
    const bundledPath = path.join(__dirname, 'index.html');
    if (activePath !== bundledPath && fs.existsSync(bundledPath)) {
      console.warn('Failed to load cached HTML, rolling back to bundled index.html');
      mainWindow.loadFile(bundledPath);
    }
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Prevent in-window navigation away from local launcher UI
    if (navigationUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(navigationUrl);
        }
      } catch(e) {}
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch(e) {}
    return { action: 'deny' };
  });
}

const CURRENT_APP_VERSION = '1.0.7';

function checkBackgroundUpdate() {
  const manifestUrl = 'https://raw.githubusercontent.com/abdullahinayat24-lang/link-launcher/main/version.json?t=' + Date.now();
  https.get(manifestUrl, (res) => {
    if (res.statusCode !== 200) return;
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
      try {
        const manifest = JSON.parse(rawData);
        if (manifest && manifest.version && manifest.version !== CURRENT_APP_VERSION) {
          console.log(`[Update] New version ${manifest.version} available (current: ${CURRENT_APP_VERSION})`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-available', {
              currentVersion: CURRENT_APP_VERSION,
              latestVersion: manifest.version,
              releaseNotes: manifest.releaseNotes || ''
            });
          }
        }
      } catch (e) {
        console.warn('Background update check notice:', e.message);
      }
    });
  }).on('error', (err) => {
    // Non-blocking offline resilience: do nothing if GitHub is unreachable
    console.log('[Update] Offline or GitHub unavailable, skipping background update check.');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Background auto-update check 4s after startup
  setTimeout(() => {
    checkBackgroundUpdate();
  }, 4000);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Chrome path resolution helper
function findChromeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const candidatePaths = [
    path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch(e) {}
  }
  return null;
}

function findChromeUserDataDir() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const candidates = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(appData, 'Google', 'Chrome', 'User Data')
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch(e) {}
  }
  return null;
}

// IPC: Chrome launch (with dynamic email-to-folder resolution and safe spawn)
ipcMain.handle('launch-chrome-profile', async (event, { folder, url, email }) => {
  let profileDir = 'Default';
  const userDataDir = findChromeUserDataDir();
  let matched = false;

  // If email is provided, dynamically resolve local Chrome folder from Local State
  if (email && typeof email === 'string' && email.trim()) {
    const targetEmail = email.toLowerCase().trim();
    if (userDataDir) {
      try {
        const localStatePath = path.join(userDataDir, 'Local State');
        if (fs.existsSync(localStatePath)) {
          const localStateRaw = fs.readFileSync(localStatePath, 'utf8');
          const localState = JSON.parse(localStateRaw);
          const profileInfoCache = localState.profile?.info_cache || {};
          for (const [fName, info] of Object.entries(profileInfoCache)) {
            const uEmail = (info.user_name || (info.hosted_domain && info.hosted_domain !== 'NO_HOSTED_DOMAIN' ? info.hosted_domain : '') || '').toLowerCase().trim();
            if (uEmail && uEmail === targetEmail) {
              profileDir = fName;
              matched = true;
              console.log(`Matched email ${email} to Chrome profile folder: ${profileDir}`);
              break;
            }
          }
        }
      } catch(e) {
        console.warn('Email resolution warning:', e.message);
      }
    }
    if (!matched) {
      return {
        success: false,
        error: `Chrome profile for account "${targetEmail}" is not present on this computer.`
      };
    }
  } else if (folder) {
    profileDir = folder;
  }

  const chromeExe = findChromeExecutable();
  if (!chromeExe) {
    return {
      success: false,
      error: 'Google Chrome executable not found on this computer. Please install Google Chrome.'
    };
  }

  const targetUrl = (url && typeof url === 'string' && url.trim()) ? url.trim() : 'chrome://newtab';

  // Sanitize target URL
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:', 'chrome:'].includes(parsed.protocol)) {
      return { success: false, error: 'Invalid URL protocol' };
    }
  } catch(e) {
    if (!targetUrl.startsWith('chrome://')) {
      return { success: false, error: 'Invalid URL format' };
    }
  }

  // Security Hardening: Use spawn with argument array rather than shell string concatenation
  const args = [`--profile-directory=${profileDir}`, targetUrl];
  console.log('Launching Chrome securely with spawn:', chromeExe, args);

  return new Promise((resolve) => {
    try {
      const child = spawn(chromeExe, args, {
        detached: true,
        stdio: 'ignore'
      });
      let responded = false;
      child.on('error', (err) => {
        if (!responded) {
          responded = true;
          resolve({ success: false, error: 'Failed to launch Chrome process: ' + err.message });
        }
      });
      child.unref();
      setTimeout(() => {
        if (!responded) {
          responded = true;
          resolve({ success: true, folder: profileDir });
        }
      }, 150);
    } catch (error) {
      console.error('Chrome spawn error:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
});

// IPC: Chrome profile detection with resilient multi-source extraction & structured diagnostics
ipcMain.handle('detect-local-chrome-profiles', async () => {
  try {
    const chromeExe = findChromeExecutable();
    const chromeUserData = findChromeUserDataDir();

    if (!chromeExe && !chromeUserData) {
      return {
        success: false,
        status: 'CHROME_NOT_INSTALLED',
        profiles: [],
        error: 'Google Chrome is not installed on this computer.'
      };
    }

    if (!chromeUserData || !fs.existsSync(chromeUserData)) {
      return {
        success: false,
        status: 'NO_PROFILES_DIR',
        profiles: [],
        error: 'Chrome User Data directory not found.'
      };
    }

    const profileMap = new Map(); // folderName -> profileObj

    // 1. Primary Source: Local State (info_cache)
    const localStatePath = path.join(chromeUserData, 'Local State');
    if (fs.existsSync(localStatePath)) {
      try {
        const localStateRaw = fs.readFileSync(localStatePath, 'utf8');
        const localState = JSON.parse(localStateRaw);
        const profileInfoCache = localState.profile?.info_cache || {};
        for (const [folderName, info] of Object.entries(profileInfoCache)) {
          const email = (info.user_name || (info.hosted_domain && info.hosted_domain !== 'NO_HOSTED_DOMAIN' ? info.hosted_domain : '') || '').toLowerCase().trim();
          const name = info.shortcut_name || info.name || info.gaia_name || folderName;
          profileMap.set(folderName, {
            folder: folderName,
            name: name,
            email: email,
            gaiaName: info.gaia_name || '',
            avatarIcon: info.avatar_icon || info.last_downloaded_gaia_picture_url_with_size || ''
          });
        }
      } catch (parseErr) {
        console.warn('Local State parse warning, falling back to direct profile directories:', parseErr.message);
      }
    }

    // 2. Secondary Source & Email Enrichment: Inspect individual profile directories
    try {
      const entries = fs.readdirSync(chromeUserData, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderName = entry.name;
        if (folderName === 'Default' || folderName.startsWith('Profile ')) {
          const prefPath = path.join(chromeUserData, folderName, 'Preferences');
          if (fs.existsSync(prefPath)) {
            try {
              const prefRaw = fs.readFileSync(prefPath, 'utf8');
              const pref = JSON.parse(prefRaw);

              let prefEmail = '';
              let prefName = '';
              let avatarPic = '';

              if (Array.isArray(pref.account_info) && pref.account_info.length > 0) {
                const acc = pref.account_info[0];
                if (acc.email) prefEmail = acc.email.toLowerCase().trim();
                if (acc.full_name || acc.given_name) prefName = acc.full_name || acc.given_name;
                if (acc.picture_url) avatarPic = acc.picture_url;
              }

              if (!prefEmail && pref.google?.services?.username) {
                prefEmail = pref.google.services.username.toLowerCase().trim();
              }

              if (!prefName && pref.profile?.name) {
                prefName = pref.profile.name;
              }

              if (profileMap.has(folderName)) {
                const existing = profileMap.get(folderName);
                if (!existing.email && prefEmail) existing.email = prefEmail;
                if (prefName && (existing.name === folderName || !existing.name)) existing.name = prefName;
                if (avatarPic && !existing.avatarIcon) existing.avatarIcon = avatarPic;
              } else {
                profileMap.set(folderName, {
                  folder: folderName,
                  name: prefName || folderName,
                  email: prefEmail,
                  gaiaName: '',
                  avatarIcon: avatarPic
                });
              }
            } catch (prefErr) {
              console.warn(`Preferences read warning for ${folderName}:`, prefErr.message);
            }
          }
        }
      }
    } catch (dirErr) {
      console.warn('Error reading Chrome User Data directory:', dirErr.message);
    }

    const allProfiles = Array.from(profileMap.values());

    if (allProfiles.length === 0) {
      return {
        success: true,
        status: 'NO_PROFILES',
        profiles: [],
        error: 'No Chrome user profiles found in Chrome User Data.'
      };
    }

    const hasProfilesWithEmail = allProfiles.some(p => p.email && p.email.length > 0);

    if (!hasProfilesWithEmail) {
      return {
        success: true,
        status: 'NO_EMAILS',
        profiles: allProfiles,
        error: 'Chrome profiles were detected, but none are signed into a Google Account.'
      };
    }

    return {
      success: true,
      status: 'PROFILES_FOUND',
      profiles: allProfiles
    };
  } catch (err) {
    return {
      success: false,
      status: 'DETECTION_FAILED',
      profiles: [],
      error: err.message
    };
  }
});

// IPC: Live Self-Updating from GitHub with Version Manifest & Integrity Verification
ipcMain.handle('check-and-apply-update', async () => {
  return new Promise((resolve) => {
    const manifestUrl = 'https://raw.githubusercontent.com/abdullahinayat24-lang/link-launcher/main/version.json?t=' + Date.now();
    https.get(manifestUrl, (mRes) => {
      if (mRes.statusCode !== 200) {
        return resolve({ success: false, error: 'Could not fetch update manifest from GitHub (HTTP ' + mRes.statusCode + ')' });
      }
      let manifestRaw = '';
      mRes.on('data', chunk => manifestRaw += chunk);
      mRes.on('end', () => {
        let manifest;
        try {
          manifest = JSON.parse(manifestRaw);
        } catch(e) {
          return resolve({ success: false, error: 'Invalid update manifest format' });
        }

        if (!manifest || !manifest.version) {
          return resolve({ success: false, error: 'Manifest missing version number' });
        }

        if (manifest.version === CURRENT_APP_VERSION) {
          return resolve({
            success: true,
            updated: false,
            version: CURRENT_APP_VERSION,
            message: `You are already running the latest verified version (v${CURRENT_APP_VERSION}).`
          });
        }

        // Fetch the update package HTML
        const htmlUrl = 'https://raw.githubusercontent.com/abdullahinayat24-lang/link-launcher/main/index.html?t=' + Date.now();
        https.get(htmlUrl, (res) => {
          if (res.statusCode !== 200) {
            return resolve({ success: false, error: 'Failed to download update package (HTTP ' + res.statusCode + ')' });
          }
          let rawData = '';
          res.on('data', chunk => rawData += chunk);
          res.on('end', () => {
            try {
              if (!isValidHtmlPackage(rawData)) {
                return resolve({ success: false, error: 'Downloaded package failed integrity checks' });
              }

              // Check SHA-256 if manifest provides it
              if (manifest.sha256) {
                const computedSha = crypto.createHash('sha256').update(rawData).digest('hex');
                if (computedSha.toLowerCase() !== manifest.sha256.toLowerCase()) {
                  return resolve({ success: false, error: 'Package checksum verification failed. Update discarded.' });
                }
              }

              const updateDir = path.join(app.getPath('userData'), 'update');
              if (!fs.existsSync(updateDir)) fs.mkdirSync(updateDir, { recursive: true });
              const userHtmlPath = path.join(updateDir, 'index.html');
              const backupPath = path.join(updateDir, 'index.html.backup');

              // Backup previous working version
              if (fs.existsSync(userHtmlPath)) {
                try { fs.copyFileSync(userHtmlPath, backupPath); } catch(e) {}
              }

              fs.writeFileSync(userHtmlPath, rawData, 'utf8');
              fs.writeFileSync(path.join(updateDir, 'version.json'), JSON.stringify(manifest, null, 2), 'utf8');

              resolve({
                success: true,
                updated: true,
                version: manifest.version,
                message: `Successfully verified and installed v${manifest.version}! Please restart DreamsLab to apply.`
              });
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        }).on('error', (err) => {
          resolve({ success: false, error: 'Network error downloading update: ' + err.message });
        });
      });
    }).on('error', (err) => {
      resolve({ success: false, error: 'Network error checking manifest: ' + err.message });
    });
  });
});

// IPC: Documents Auto-Backup
ipcMain.handle('save-to-documents', async (event, dataStr) => {
  try {
    const docs = app.getPath('documents');
    const backupDir = path.join(docs, 'DreamsLab Backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, 'DreamsLab_Vault_Backup.json');
    fs.writeFileSync(backupPath, dataStr, 'utf8');
    return { success: true, path: backupPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC: Documents Auto-Restore
ipcMain.handle('restore-from-documents', async () => {
  try {
    const docs = app.getPath('documents');
    const backupPath = path.join(docs, 'DreamsLab Backup', 'DreamsLab_Vault_Backup.json');
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8');
      return { success: true, content, path: backupPath };
    }
    return { success: false, error: 'No backup found in Documents\\DreamsLab Backup' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC: Reset Local Vault & Backup
ipcMain.handle('reset-local-vault', async () => {
  try {
    const docs = app.getPath('documents');
    const backupPath = path.join(docs, 'DreamsLab Backup', 'DreamsLab_Vault_Backup.json');
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log('Local documents backup deleted on reset:', backupPath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

  ipcMain.handle('open-external', async (event, url) => {
    try {
      if (!url || typeof url !== 'string') return false;
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
        return true;
      }
    } catch(e) {}
    return false;
  });
}

