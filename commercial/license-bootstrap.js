// Fail closed if an activation asset is missing or cannot be verified.
window.LINK_LAUNCHER_ACTIVATED = false;
for (const entry of ['handleUnlock', 'openOfflineVault']) {
  const original = window[entry];
  window[entry] = function (...args) {
    if (!window.LINK_LAUNCHER_ACTIVATED) {
      args[0]?.preventDefault?.();
      document.getElementById('unlockError').textContent = 'Activation has not loaded. Restore the licence files and reload this app.';
      return;
    }
    return original(...args);
  };
}
