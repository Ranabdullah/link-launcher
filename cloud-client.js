async function cloudFetch(url, options = {}) {
  if (!navigator.onLine) throw new Error('Offline');
  return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(70000) });
}
async function clearCloudSession() {
  if (cloudAuthToken) {
    try { await cloudFetch(cloudApiUrl + '/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + cloudAuthToken } }); }
    catch { /* Local logout remains available offline. */ }
  }
}
