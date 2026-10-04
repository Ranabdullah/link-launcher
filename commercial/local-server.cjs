const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'web');
const files = new Set(['index.html','cloud-config.js','cloud-client.js','web-app.js','browser-session.js','browser-routing.js','profile-appearance.js','browser-bridge.zip','browser-bridge.sha256','responsive.css','manifest.webmanifest','sw.js','favicon.png','robots.txt','license-config.js','license-gate.js','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png']);
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png', '.txt':'text/plain', '.zip':'application/zip' };
const port = Number(process.env.PORT || 4783);
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  if (pathname === '/api/health') { response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({status:'ok',storage:'local-browser',cloudEnabled:false})); return; }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
  if (request.method === 'HEAD') { response.end(); return; }
  fs.createReadStream(path.join(root, file)).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Link Launcher local edition: http://localhost:${port}/\nKeep this window open while loading or installing the app. No links are stored on a server.`));
