const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'web-dist');
fs.mkdirSync(out, { recursive: true });
// Explicit allowlist: no databases, credentials, dependencies or installers.
for (const file of ['index.html', 'cloud-config.js', 'cloud-client.js', 'web-app.js', 'responsive.css', 'manifest.webmanifest', 'sw.js', 'favicon.png', 'robots.txt', '_headers']) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
console.log('Reviewed web assets built in web-dist.');
