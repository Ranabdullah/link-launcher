const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'web-dist');
fs.mkdirSync(out, { recursive: true });
// Only reviewed helper sources enter the optional download; never installed settings.
fs.writeFileSync(path.join(root,'browser-bridge.zip'),require('./package-browser-bridge.cjs').makeBridgeArchive());
fs.writeFileSync(path.join(root,'browser-bridge.sha256'),require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'browser-bridge.zip'))).digest('hex')+'  Link-Launcher-Browser-Setup.zip\n');
// Explicit allowlist: no databases, credentials, dependencies or EXE installers.
for (const file of ['index.html', 'cloud-config.js', 'cloud-client.js', 'web-app.js','browser-session.js','browser-routing.js','profile-appearance.js','browser-bridge.zip','browser-bridge.sha256', 'responsive.css', 'manifest.webmanifest', 'sw.js', 'favicon.png', 'robots.txt', '_headers']) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
console.log('Reviewed web assets built in web-dist.');
