const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, 'seller-private');
const keyFile = path.join(privateDir, 'license-signing-key.pem');
const publicFile = path.join(root, 'commercial/license-public-key.json');
function init() {
  if (fs.existsSync(keyFile)) return;
  if (fs.existsSync(publicFile)) throw new Error('Public key exists but private key is missing. Restore the original key; do not replace it and invalidate buyers.');
  fs.mkdirSync(privateDir, { recursive: true });
  const keys = crypto.generateKeyPairSync('ec', { namedCurve:'prime256v1', privateKeyEncoding:{type:'pkcs8',format:'pem'}, publicKeyEncoding:{type:'spki',format:'pem'} });
  fs.writeFileSync(keyFile, keys.privateKey, { mode:0o600, flag:'wx' });
  fs.writeFileSync(publicFile, JSON.stringify(crypto.createPublicKey(keys.publicKey).export({format:'jwk'}), null, 2));
  console.log('Seller signing key created privately. Back it up securely; never upload it.');
}
function issue(email, order, requestCode) {
  if (!fs.existsSync(keyFile)) throw new Error('Initialize the seller key first.');
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[A-Za-z0-9_-]{1,80}$/.test(order || '') || !/^LL1:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestCode || '')) throw new Error('Use the buyer email, confirmed order ID and browser installation code.');
  const installation = requestCode.slice(4);
  const registryFile = path.join(privateDir, 'issued-licenses.json');
  const registry = fs.existsSync(registryFile) ? JSON.parse(fs.readFileSync(registryFile,'utf8')) : {};
  const record = registry[order] || {email,installations:[]};
  if (record.email !== email) throw new Error('This order is already assigned to another buyer.');
  if (!record.installations.includes(installation) && record.installations.length >= 3) throw new Error('Three installations already issued. Review the request before replacing an installation.');
  const payload = JSON.stringify({version:1,product:'link-launcher-commercial-v1',email,order,installation,issuedAt:new Date().toISOString()});
  const signature = crypto.sign('sha256', Buffer.from(payload), {key:fs.readFileSync(keyFile),dsaEncoding:'ieee-p1363'}).toString('base64url');
  if (!record.installations.includes(installation)) record.installations.push(installation);
  registry[order] = record;
  fs.writeFileSync(registryFile, JSON.stringify(registry,null,2), {mode:0o600});
  const out = path.join(privateDir, order + '-' + installation + '.lllicense');
  fs.writeFileSync(out, JSON.stringify({payload,signature}), {mode:0o600});
  console.log('Signed licence saved in seller-private. Deliver only the .lllicense file for the confirmed paid order.');
}
try { const [action,...args]=process.argv.slice(2); if(action==='init') init(); else if(action==='issue') issue(...args); else throw new Error('Usage: init | issue buyer-email confirmed-order-id LL1:installation-code'); }
catch(error) { console.error(error.message); process.exitCode=1; }
