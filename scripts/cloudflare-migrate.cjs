const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, 'migration-private');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
function normalize(row) {
  const vault = row.encrypted_vault ?? row.encryptedVault;
  const result = {
    email: row.email.toLowerCase().trim(), salt: row.salt,
    verifier_hash: row.verifier_hash ?? row.verifierHash,
    encrypted_vault: typeof vault === 'string' ? vault : JSON.stringify(vault),
    updated_at: row.updated_at ?? row.updatedAt, version: Number(row.version ?? 1),
    created_at: row.created_at ?? row.createdAt
  };
  if (!/^[0-9a-f]{32}$/i.test(result.salt) || !/^[0-9a-f]{64}$/i.test(result.verifier_hash) || !Number.isSafeInteger(result.version) || result.version < 1 || !result.updated_at || !result.created_at) throw new Error('Source record is incomplete; refusing a lossy transfer.');
  // Preserve old opaque payloads as well as modern JSON envelopes, byte for byte.
  if (typeof result.encrypted_vault !== 'string' || !result.encrypted_vault.length || result.encrypted_vault === 'null') throw new Error('Source account has no vault payload.');
  if (Buffer.byteLength(result.encrypted_vault) > 15 * 1024 * 1024) throw new Error('Source vault exceeds the current app limit; preserve it and adjust limits before migration.');
  return result;
}
function prepareExport(rows, source) {
  const users = rows.map(normalize).sort((a,b) => a.email.localeCompare(b.email));
  if (new Set(users.map(u => u.email)).size !== users.length) throw new Error('Duplicate source accounts.');
  return { format: 'link-launcher-cloud-transfer-v1', exportedAt: new Date().toISOString(), source, count: users.length, sha256: digest(users), users };
}
function sqlFor(snapshot) {
  const statements = [];
  for (const user of snapshot.users) {
    const generation = crypto.randomUUID();
    let format = 'json'; try { JSON.parse(user.encrypted_vault); } catch { format = 'opaque'; }
    statements.push(`INSERT INTO users(email,salt,verifier_hash,updated_at,version,created_at,generation,vault_format) VALUES(${[user.email,user.salt,user.verifier_hash,user.updated_at].map(quote).join(',')},${user.version},${quote(user.created_at)},${quote(generation)},${quote(format)});`);
    // Bound SQL import statements must also stay below D1's 100 KB limit.
    for (let i = 0; i < user.encrypted_vault.length; i += 32768) statements.push(`INSERT INTO vault_chunks(email,generation,part,data) VALUES(${quote(user.email)},${quote(generation)},${i/32768},${quote(user.encrypted_vault.slice(i,i+32768))});`);
  }
  return statements.join('\n');
}
async function exportSource(file) {
  let snapshot;
  if (file) {
    const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const rows = Array.isArray(data) ? data : Object.entries(data.users || {}).map(([email,u]) => ({ ...u, email }));
    snapshot = prepareExport(rows, 'local-file-backup');
  } else {
    const connectionFile = path.join(privateDir, 'render-database-url.txt');
    const connectionString = process.env.DATABASE_URL || (fs.existsSync(connectionFile) ? fs.readFileSync(connectionFile, 'utf8').trim() : '');
    if (!connectionString) throw new Error('Set DATABASE_URL privately or save the external URL in migration-private/render-database-url.txt.');
    const { Client } = require('pg');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
    try {
      await client.connect();
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows } = await client.query('SELECT email,salt,verifier_hash,encrypted_vault,updated_at,version,created_at FROM users ORDER BY email');
      snapshot = prepareExport(rows, 'render-postgres');
      await client.query('COMMIT');
    } finally { await client.end(); }
  }
  if (!snapshot.count) throw new Error('The source is empty. Refusing to treat it as a successful account transfer.');
  fs.mkdirSync(privateDir, { recursive: true });
  const out = path.join(privateDir, 'transfer-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(out, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(out.replace(/\.json$/, '.sql'), sqlFor(snapshot), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ accountCount: snapshot.count, source: snapshot.source, fingerprint: snapshot.sha256, backup: out }));
  return snapshot;
}
function wrangler(args) {
  const result = spawnSync(process.execPath, [path.join(root,'node_modules/wrangler/bin/wrangler.js'), ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, XDG_CONFIG_HOME: path.join(root,'.cloudflare-auth'), WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_ACCOUNT_ID: '4dddb56c05af56a431914f2cb7f48eb4' }
  });
  // CLI logs can include SQL and emails. Never print captured output on failure.
  if (result.status !== 0) throw new Error('Cloudflare database operation failed. Inspect private Wrangler logs locally; no account records have been printed.');
  // Remote SQL-file imports can emit progress notices despite --json. Their
  // exit code confirms execution; the separate fingerprint check confirms data.
  if (args.includes('--file')) return null;
  return JSON.parse(result.stdout);
}
function query(sql, local) {
  return wrangler(['d1','execute','link-launcher-vault', local ? '--local' : '--remote','--command',sql,'--json'])[0].results;
}
function verify(snapshot, local) {
  const meta = query('SELECT email,salt,verifier_hash,updated_at,version,created_at,generation FROM users ORDER BY email', local);
  const users = meta.map(row => {
    const chunks = query(`SELECT data FROM vault_chunks WHERE email=${quote(row.email)} AND generation=${quote(row.generation)} ORDER BY part`, local);
    return normalize({ ...row, encrypted_vault: chunks.map(c => c.data).join('') });
  }).sort((a,b) => a.email.localeCompare(b.email));
  if (users.length !== snapshot.count || digest(users) !== snapshot.sha256) throw new Error('Transfer verification failed. Do not switch hosts or delete Render data.');
  console.log(JSON.stringify({ verified: true, accountCount: users.length, fingerprint: snapshot.sha256 }));
}
async function main() {
  const [action, file, flag] = process.argv.slice(2);
  if (action === 'export') return exportSource(file);
  if (!['import','verify'].includes(action) || !file) throw new Error('Usage: export [backup-file] | import snapshot.json [--local] | verify snapshot.json [--local]');
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (snapshot.format !== 'link-launcher-cloud-transfer-v1' || snapshot.count !== snapshot.users.length || digest(snapshot.users) !== snapshot.sha256) throw new Error('Backup fingerprint does not match.');
  const local = flag === '--local';
  if (action === 'import') {
    const [{ count }] = query('SELECT COUNT(*) AS count FROM users', local);
    if (count) throw new Error('Destination contains accounts. Refusing to overwrite or merge them automatically.');
    const sql = path.resolve(file).replace(/\.json$/, '.sql');
    if (sql === path.resolve(file)) throw new Error('Snapshot filename must end in .json.');
    // Regenerate SQL from the verified snapshot, never trust a modified sidecar.
    fs.writeFileSync(sql, sqlFor(snapshot), { mode: 0o600 });
    wrangler(['d1','execute','link-launcher-vault',local ? '--local' : '--remote','--file',sql,'--yes','--json']);
  }
  verify(snapshot, local);
}
if (require.main === module) main().catch(() => { console.error('Transfer could not complete. Source data is unchanged. Check access, destination emptiness and backup integrity; do not delete Render data.'); process.exitCode = 1; });
module.exports = { normalize, prepareExport, sqlFor, digest };
