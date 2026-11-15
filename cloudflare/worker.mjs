const encoder = new TextEncoder();
const MAX_BODY = 15 * 1024 * 1024;
const CHUNK_SIZE = 512 * 1024;
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HEX64 = /^[a-fA-F0-9]{64}$/;
const security = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...security, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function failure(message, status = 400) { return json({ error: message }, status); }
function bytesHex(value) { return Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join(''); }
function hexBytes(value) { return Uint8Array.from(value.match(/.{2}/g) || [], c => parseInt(c, 16)); }
function b64url(value) { return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function encode(value) { return b64url(encoder.encode(JSON.stringify(value))); }
export async function hashVerifier(verifier, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(verifier), 'PBKDF2', false, ['deriveBits']);
  return bytesHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexBytes(salt), iterations: 20000 }, key, 256));
}
async function signingKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function tokenFor(user, env) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ email: user.email, accountCreatedAt: user.created_at, jti: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 86400 });
  const content = header + '.' + payload;
  return content + '.' + b64url(await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(content)));
}
async function authenticate(request, env) {
  const raw = request.headers.get('Authorization');
  if (!raw?.startsWith('Bearer ')) return null;
  try {
    const parts = raw.slice(7).split('.');
    if (parts.length !== 3) return null;
    const decodedSig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify('HMAC', await signingKey(env), decodedSig, encoder.encode(parts[0] + '.' + parts[1]))) return null;
    const token = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof token.email !== 'string' || !token.jti || !Number.isFinite(token.exp) || token.exp <= Math.floor(Date.now() / 1000)) return null;
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND created_at = ? AND NOT EXISTS (SELECT 1 FROM revoked_tokens WHERE token_id = ?)').bind(token.email, token.accountCreatedAt, token.jti).first();
    return user ? { user, token } : null;
  } catch (err) { if (String(err).includes('D1_')) throw err; return null; }
}
export function validVault(vault) {
  if (!vault || typeof vault !== 'object' || Array.isArray(vault)) return false;
  if (Object.keys(vault).length !== 3) return false;
  const base64 = /^[A-Za-z0-9+/]+={0,2}$/;
  try {
    return ['salt', 'iv', 'data'].every(k => typeof vault[k] === 'string' && vault[k].length % 4 === 0 && base64.test(vault[k]))
      && atob(vault.salt).length === 16 && atob(vault.iv).length === 12 && vault.data.length >= 24;
  } catch { return false; }
}
async function bodyOf(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('JSON body required.'), { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) return {};
  const parts = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.length;
    if (length > MAX_BODY) { await reader.cancel(); throw Object.assign(new Error('Vault is too large.'), { status: 413 }); }
    parts.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}
function credentials(body) {
  return typeof body?.email === 'string' && body.email.length <= 254 && EMAIL.test(body.email.trim()) && typeof body.authVerifier === 'string' && HEX64.test(body.authVerifier);
}
function chunkStatements(db, email, generation, vault) {
  const text = JSON.stringify(vault); const statements = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) statements.push(db.prepare('INSERT INTO vault_chunks(email, generation, part, data) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE email = ? AND generation = ?)').bind(email, generation, i / CHUNK_SIZE, text.slice(i, i + CHUNK_SIZE), email, generation));
  return statements;
}
async function vaultRecord(db, email, createdAt) {
  // One joined read keeps metadata and chunks from the same committed version.
  const { results } = await db.prepare('SELECT u.email, u.updated_at, u.version, u.vault_format, c.part, c.data FROM users u LEFT JOIN vault_chunks c ON c.email = u.email AND c.generation = u.generation WHERE u.email = ? AND u.created_at = ? ORDER BY c.part').bind(email, createdAt).all();
  if (!results.length) return null;
  const text = results.map(r => r.data || '').join('');
  if (!text) throw new Error('Vault transfer incomplete.');
  return { success: true, email, updatedAt: results[0].updated_at, version: results[0].version, encryptedVault: results[0].vault_format === 'opaque' ? text : JSON.parse(text) };
}
async function limited(binding, key) { return !(await binding.limit({ key })).success; }
export default {
  async fetch(request, env) {
    const url = new URL(request.url); const route = url.pathname;
    if (!route.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return failure('This request must come from the app.', 403);
      if (!env.DB || typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) return failure('Cloud account storage is not configured.', 503);
      if (route === '/api/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT 1 FROM users LIMIT 1').first();
        return json({ status: 'ok', version: '2.0.0', storage: 'd1', databaseConnected: true, schemaReady: true, dbAvailable: true, migrationPending: env.MIGRATION_PENDING === 'true' });
      }
      if (route.startsWith('/api/auth/')) {
        if (!env.AUTH_LIMIT || !env.LOGIN_LIMIT || !env.REGISTER_LIMIT) return failure('Authentication protection is not configured.', 503);
        if (await limited(env.AUTH_LIMIT, request.headers.get('CF-Connecting-IP') || 'local')) return failure('Too many requests. Wait a minute and try again.', 429);
      }
      if (['/api/auth/register', '/api/auth/login'].includes(route) && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!credentials(body)) return failure('Valid email and authentication verifier required.');
        const email = body.email.toLowerCase().trim(); const ip = request.headers.get('CF-Connecting-IP') || 'local';
        const register = route.endsWith('/register');
        if (await limited(register ? env.REGISTER_LIMIT : env.LOGIN_LIMIT, register ? ip : ip + ':' + email)) return failure('Too many attempts. Wait a minute and try again.', 429);
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (register) {
          if (env.MIGRATION_PENDING === 'true') return failure('Existing accounts are being transferred. Please try again after the transfer.', 503);
          if (!validVault(body.encryptedVault)) return failure('Valid encrypted vault required.');
          if (user) return failure('Account already exists. Sign in instead.', 409);
          const salt = bytesHex(crypto.getRandomValues(new Uint8Array(16)));
          const hash = await hashVerifier(body.authVerifier, salt); const now = new Date().toISOString(); const generation = crypto.randomUUID();
          try {
            await env.DB.batch([
              env.DB.prepare('INSERT INTO users(email,salt,verifier_hash,updated_at,version,created_at,generation) VALUES(?,?,?,?,1,?,?)').bind(email, salt, hash, now, now, generation),
              ...chunkStatements(env.DB, email, generation, body.encryptedVault)
            ]);
          } catch (err) { if (String(err).includes('UNIQUE constraint')) return failure('Account already exists. Sign in instead.', 409); throw err; }
          return json({ success: true, email, token: await tokenFor({ email, created_at: now }, env), updatedAt: now, version: 1 }, 201);
        }
        if (!user) return failure('Account not found for this email. Check your email or create an account.', 404);
        const hash = await hashVerifier(body.authVerifier, user.salt);
        // Compare fixed-size hashes without exiting at the first unequal byte.
        let mismatch = hash.length ^ user.verifier_hash.length;
        for (let i = 0; i < hash.length; i++) mismatch |= hash.charCodeAt(i) ^ user.verifier_hash.charCodeAt(i);
        if (mismatch) return failure('Incorrect master password.', 401);
        const record = await vaultRecord(env.DB, email, user.created_at);
        if (!record) return failure('Account no longer exists.', 401);
        return json({ ...record, token: await tokenFor(user, env) });
      }
      if (!['/api/vault', '/api/account', '/api/auth/logout'].includes(route)) return failure('Unknown API route.', 404);
      const auth = await authenticate(request, env);
      if (!auth) return failure('Session ended. Sign in again.', 401);
      const { user, token } = auth;
      if (route === '/api/vault' && request.method === 'GET') {
        const record = await vaultRecord(env.DB, user.email, token.accountCreatedAt); return record ? json(record) : failure('Account no longer exists.', 401);
      }
      if (route === '/api/vault' && request.method === 'POST') {
        if (env.MIGRATION_PENDING === 'true') return failure('Account transfer is finishing. Your changes remain saved on this device.', 503);
        const body = await bodyOf(request);
        if (!validVault(body.encryptedVault) || !Number.isSafeInteger(body.version) || body.version < 1) return failure('Valid encrypted vault and version integer required.');
        const generation = crypto.randomUUID(); const now = new Date().toISOString();
        const results = await env.DB.batch([
          env.DB.prepare("UPDATE users SET generation = ?, vault_format = 'json', updated_at = ?, version = version + 1 WHERE email = ? AND version = ? AND created_at = ?").bind(generation, now, user.email, body.version, token.accountCreatedAt),
          ...chunkStatements(env.DB, user.email, generation, body.encryptedVault),
          env.DB.prepare('DELETE FROM vault_chunks WHERE email = ? AND generation <> ? AND EXISTS (SELECT 1 FROM users WHERE email = ? AND generation = ?)').bind(user.email, generation, user.email, generation)
        ]);
        if (!results[0].meta.changes) {
          const current = await env.DB.prepare('SELECT version FROM users WHERE email = ? AND created_at = ?').bind(user.email, token.accountCreatedAt).first();
          return current ? json({ error: 'Cloud data changed on another device.', code: 'CONFLICT', cloudVersion: current.version, clientVersion: body.version }, 409) : failure('Account no longer exists.', 401);
        }
        return json({ success: true, updatedAt: now, version: body.version + 1 });
      }
      if (route === '/api/auth/logout' && request.method === 'POST') {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').bind(Math.floor(Date.now() / 1000)),
          env.DB.prepare('INSERT OR IGNORE INTO revoked_tokens(token_id, expires_at) VALUES (?,?)').bind(token.jti, token.exp)
        ]); return json({ success: true });
      }
      if (route === '/api/account' && request.method === 'DELETE') {
        if (env.MIGRATION_PENDING === 'true') return failure('Account transfer is finishing. Account deletion is temporarily unavailable.', 503);
        await env.DB.prepare('DELETE FROM users WHERE email = ? AND created_at = ?').bind(user.email, token.accountCreatedAt).run();
        return json({ success: true });
      }
      return failure('Method not allowed.', 405);
    } catch (err) {
      if (err.status) return failure(err.message, err.status);
      // Never expose account data, SQL parameters or authentication material in logs.
      return failure('Cloud storage is temporarily unavailable. Your local links are preserved.', 503);
    }
  }
};
