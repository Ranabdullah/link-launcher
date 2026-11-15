const crypto = require('node:crypto');
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
module.exports = { normalize, prepareExport, sqlFor, digest };
