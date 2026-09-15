const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  isElectron: true,
  launchChromeProfile: (folder, url, email) => ipcRenderer.invoke('launch-chrome-profile', { folder, url, email }),
  detectLocalChromeProfiles: () => ipcRenderer.invoke('detect-local-chrome-profiles'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  checkAndApplyUpdate: () => ipcRenderer.invoke('check-and-apply-update'),
  saveToDocuments: (dataStr) => ipcRenderer.invoke('save-to-documents', dataStr),
  restoreFromDocuments: () => ipcRenderer.invoke('restore-from-documents'),
  resetLocalVault: () => ipcRenderer.invoke('reset-local-vault'),
  secureStoreSession: (sessionData) => ipcRenderer.invoke('secure-store-session', sessionData),
  secureRetrieveSession: () => ipcRenderer.invoke('secure-retrieve-session'),
  secureClearSession: () => ipcRenderer.invoke('secure-clear-session'),
  onBackgroundUpdate: (callback) => ipcRenderer.on('background-update-ready', (_event, value) => callback(value)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value))
});

