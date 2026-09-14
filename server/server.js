/**
 * DreamsLab Link Launcher // Zero-Knowledge Authenticated Cloud Vault API
 * 
 * ARCHITECTURE & ZERO-KNOWLEDGE PRINCIPLES:
 * 1. Client derives authVerifier = PBKDF2(password, "dreamslab-auth:" + email)
 *    and sends authVerifier to this server.
 * 2. Client derives vaultKey = PBKDF2(password, "dreamslab-vault:" + email)
 *    and encrypts/decrypts the vault data locally with AES-GCM.
 * 3. This server NEVER receives, stores, or sees:
 *    - The user's Master Password
 *    - The client's vaultKey
 *    - Plaintext links, profiles, or bookmarks
 * 4. This server stores ONLY:
 *    - Email
 *    - Salt + PBKDF2 hash of authVerifier
 *    - Encrypted vault ciphertext blob
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Production Secrets Validation: Never use hardcoded secrets in production!
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? crypto.randomBytes(32).toString('hex') : null);
if (isProduction && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required in production.');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'vaults.json');

// Middleware
app.use(express.json({ limit: '15mb' }));

// CORS configuration - exact entries from ALLOWED_ORIGINS (no wildcards)
const defaultAllowedOrigins = isProduction
  ? 'https://abdullahinayat24-lang.github.io'
  : 'https://abdullahinayat24-lang.github.io,http://localhost:3000,http://127.0.0.1:3000';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin (Electron file://, mobile apps, curl)
    if (!origin) return callback(null, true);

    // Exact match against configured ALLOWED_ORIGINS
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject unknown browser origins
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Database with persistence to DB_FILE (DEV / FALLBACK MODE ONLY)
let db = { users: {} };
function loadDatabase() {
  if (isProduction) return; // Never load local file database in production
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
      if (!db.users) db.users = {};
    }
  } catch (err) {
    console.error('Warning: Could not load DB file, starting with empty store:', err.message);
    db = { users: {} };
  }
}

function saveDatabase() {
  if (isProduction) return; // Never save local file database in production
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = DB_FILE + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Error persisting database:', err.message);
  }
}

if (!isProduction) {
  loadDatabase();
}

// PostgreSQL Connection Pool (Render / Railway / Supabase / Neon)
let pool = null;

if (isProduction && !process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is required in production.');
  process.exit(1);
}

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
    console.log('PostgreSQL database pool initialized.');
  } catch (e) {
    console.error('Could not initialize pg Pool:', e.message);
    if (isProduction) {
      process.exit(1);
    }
    pool = null;
  }
}

async function initDatabase() {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          email VARCHAR(255) PRIMARY KEY,
          salt VARCHAR(64) NOT NULL,
          verifier_hash VARCHAR(128) NOT NULL,
          encrypted_vault TEXT,
          updated_at VARCHAR(64) NOT NULL,
          version INTEGER DEFAULT 1,
          created_at VARCHAR(64) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      `);
      console.log('PostgreSQL table "users" and index verified/created successfully.');

      // Auto-migration check: If users table is empty and vaults.json has records, seed postgres
      try {
        const checkCount = await pool.query('SELECT COUNT(*) FROM users');
        const count = parseInt(checkCount.rows[0].count, 10);
        if (count === 0 && fs.existsSync(DB_FILE)) {
          const fileRaw = fs.readFileSync(DB_FILE, 'utf8');
          const fileData = JSON.parse(fileRaw);
          if (fileData.users) {
            console.log('Migrating existing accounts from vaults.json into PostgreSQL...');
            for (const [uEmail, uData] of Object.entries(fileData.users)) {
              await pool.query(`
                INSERT INTO users (email, salt, verifier_hash, encrypted_vault, updated_at, version, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (email) DO NOTHING;
              `, [
                uEmail.toLowerCase().trim(),
                uData.salt,
                uData.verifierHash,
                typeof uData.encryptedVault === 'string' ? uData.encryptedVault : JSON.stringify(uData.encryptedVault),
                uData.updatedAt || new Date().toISOString(),
                uData.version || 1,
                uData.createdAt || new Date().toISOString()
              ]);
            }
            console.log('PostgreSQL migration completed successfully.');
          }
        }
      } catch (migErr) {
        console.warn('Initial seed migration notice:', migErr.message);
      }
    } catch (err) {
      console.error('Failed to initialize PostgreSQL table:', err.message);
      if (isProduction) {
        throw new Error('FATAL: PostgreSQL table initialization failed in production: ' + err.message);
      }
      pool = null;
    }
  } else if (isProduction) {
    throw new Error('FATAL: PostgreSQL pool is required in production.');
  }
}

// Database Abstraction Helpers
async function findUser(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          email: row.email,
          salt: row.salt,
          verifierHash: row.verifier_hash,
          encryptedVault: (row.encrypted_vault && row.encrypted_vault.startsWith('{')) ? JSON.parse(row.encrypted_vault) : row.encrypted_vault,
          updatedAt: row.updated_at,
          version: row.version || 1,
          createdAt: row.created_at
        };
      }
      return null;
    } catch (err) {
      console.error('PostgreSQL findUser error:', err.message);
      throw err; // A PostgreSQL query failure must return a database error, NEVER search vaults.json
    }
  }
  if (isProduction) {
    throw new Error('PostgreSQL database unavailable in production');
  }
  return db.users[normalizedEmail] || null;
}

async function insertUser(user) {
  const normalizedEmail = user.email.toLowerCase().trim();
  const vaultStr = (user.encryptedVault && typeof user.encryptedVault === 'object')
    ? JSON.stringify(user.encryptedVault)
    : (user.encryptedVault || null);

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO users (email, salt, verifier_hash, encrypted_vault, updated_at, version, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          salt = EXCLUDED.salt,
          verifier_hash = EXCLUDED.verifier_hash,
          encrypted_vault = EXCLUDED.encrypted_vault,
          updated_at = EXCLUDED.updated_at,
          version = EXCLUDED.version
      `, [
        normalizedEmail,
        user.salt,
        user.verifierHash,
        vaultStr,
        user.updatedAt,
        user.version || 1,
        user.createdAt
      ]);
      if (!isProduction) {
        db.users[normalizedEmail] = user;
        saveDatabase();
      }
      return user;
    } catch (err) {
      console.error('PostgreSQL insertUser error:', err.message);
      throw err;
    }
  }
  if (isProduction) {
    throw new Error('PostgreSQL database unavailable in production');
  }
  // Local development file fallback
  db.users[normalizedEmail] = user;
  saveDatabase();
  return user;
}

async function atomicUpdateUserVault(email, encryptedVault, updatedAt, clientVersion) {
  const normalizedEmail = email.toLowerCase().trim();
  const vaultStr = (encryptedVault && typeof encryptedVault === 'object')
    ? JSON.stringify(encryptedVault)
    : (encryptedVault || null);

  if (pool) {
    try {
      // Atomic PostgreSQL conditional update: only increments version and saves if version === clientVersion
      const res = await pool.query(`
        UPDATE users
        SET encrypted_vault = $1,
            updated_at = $2,
            version = version + 1
        WHERE email = $3
          AND version = $4
        RETURNING version, updated_at;
      `, [vaultStr, updatedAt, normalizedEmail, clientVersion]);

      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        if (!isProduction && db.users[normalizedEmail]) {
          db.users[normalizedEmail].encryptedVault = encryptedVault;
          db.users[normalizedEmail].updatedAt = row.updated_at;
          db.users[normalizedEmail].version = row.version;
          saveDatabase();
        }
        return {
          success: true,
          version: row.version,
          updatedAt: row.updated_at
        };
      }

      // No row updated: The client version is stale (conflict) or the user doesn't exist
      const checkUser = await pool.query('SELECT version FROM users WHERE email = $1', [normalizedEmail]);
      if (checkUser.rows && checkUser.rows.length > 0) {
        return {
          success: false,
          conflict: true,
          cloudVersion: checkUser.rows[0].version
        };
      }
      return { success: false, notFound: true };
    } catch (err) {
      console.error('PostgreSQL atomicUpdateUserVault error:', err.message);
      throw err;
    }
  }

  if (isProduction) {
    throw new Error('PostgreSQL database unavailable in production');
  }

  // Non-production development fallback
  const devUser = db.users[normalizedEmail];
  if (!devUser) return { success: false, notFound: true };

  const currentDevVersion = devUser.version || 1;
  if (Number(clientVersion) !== Number(currentDevVersion)) {
    return {
      success: false,
      conflict: true,
      cloudVersion: currentDevVersion
    };
  }

  const nextVer = currentDevVersion + 1;
  devUser.encryptedVault = encryptedVault;
  devUser.updatedAt = updatedAt;
  devUser.version = nextVer;
  saveDatabase();
  return {
    success: true,
    version: nextVer,
    updatedAt
  };
}

// Backward-compatible wrapper for direct updates
async function updateUserVault(email, encryptedVault, updatedAt, version) {
  const clientVersion = version !== undefined ? (Number(version) - 1) : 1;
  return atomicUpdateUserVault(email, encryptedVault, updatedAt, clientVersion);
}

// Rate Limiting for Authentication (Brute Force Protection)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 10;

function checkRateLimit(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return true;
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(key);
    return true;
  }
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, firstAttempt: now };
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.firstAttempt = now;
  } else {
    entry.count += 1;
  }
  loginAttempts.set(key, entry);
}

function clearRateLimit(key) {
  loginAttempts.delete(key);
}

// Rate Limiting for Account Registration (Anti-Spam)
const registerAttempts = new Map();
const REG_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REG_ATTEMPTS = 15;

function checkRegisterRateLimit(ip) {
  const now = Date.now();
  const entry = registerAttempts.get(ip);
  if (!entry) return true;
  if (now - entry.firstAttempt > REG_LIMIT_WINDOW_MS) {
    registerAttempts.delete(ip);
    return true;
  }
  return entry.count < MAX_REG_ATTEMPTS;
}

function recordRegisterAttempt(ip) {
  const now = Date.now();
  const entry = registerAttempts.get(ip) || { count: 0, firstAttempt: now };
  if (now - entry.firstAttempt > REG_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.firstAttempt = now;
  } else {
    entry.count += 1;
  }
  registerAttempts.set(ip, entry);
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const VERIFIER_REGEX = /^[a-fA-F0-9]{64}$/;

// Cryptographic helpers
function hashVerifier(authVerifier, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.pbkdf2Sync(authVerifier, salt, 20000, 32, 'sha256');
  return hash.toString('hex');
}

function generateToken(email) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}

function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return data;
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded || !decoded.email) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }
  req.userEmail = decoded.email.toLowerCase().trim();
  next();
}

// ----------------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------------

// 1. Health check
app.get('/api/health', async (req, res) => {
  let dbConnected = false;
  let schemaReady = false;

  if (pool) {
    try {
      const ping = await pool.query('SELECT 1');
      dbConnected = !!ping;
      const tblCheck = await pool.query("SELECT to_regclass('public.users') as tbl");
      schemaReady = !!(tblCheck.rows && tblCheck.rows[0] && tblCheck.rows[0].tbl);
    } catch (e) {
      dbConnected = false;
      schemaReady = false;
    }
  } else if (!isProduction) {
    dbConnected = true;
    schemaReady = true;
  }

  const isHealthy = isProduction ? (dbConnected && schemaReady) : true;
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'DreamsLab Cloud Vault Service',
    version: '1.0.6',
    storage: pool ? 'postgres' : (isProduction ? 'postgres (disconnected)' : 'file'),
    databaseConnected: dbConnected,
    schemaReady: schemaReady,
    time: new Date().toISOString()
  });
});

// 2. Register Account
app.post('/api/auth/register', async (req, res) => {
  try {
    const clientIp = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    if (!checkRegisterRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many registration attempts. Please try again in 10 minutes.' });
    }

    const { email, authVerifier, encryptedVault } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!authVerifier || typeof authVerifier !== 'string' || !VERIFIER_REGEX.test(authVerifier)) {
      return res.status(400).json({ error: 'Valid authentication verifier is required (64-character hex string).' });
    }

    recordRegisterAttempt(clientIp);

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await findUser(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please Sign In.' });
    }

    const saltHex = crypto.randomBytes(16).toString('hex');
    const verifierHash = hashVerifier(authVerifier, saltHex);
    const now = new Date().toISOString();

    const newUser = {
      email: normalizedEmail,
      salt: saltHex,
      verifierHash,
      encryptedVault: encryptedVault || null,
      updatedAt: now,
      version: 1,
      createdAt: now
    };
    await insertUser(newUser);

    const token = generateToken(normalizedEmail);
    return res.status(201).json({
      success: true,
      token,
      email: normalizedEmail,
      updatedAt: now,
      version: 1,
      message: 'Account created successfully.'
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// 3. Login Account (with Rate Limiting)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, authVerifier } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!authVerifier || typeof authVerifier !== 'string' || !VERIFIER_REGEX.test(authVerifier)) {
      return res.status(400).json({ error: 'Valid authentication verifier is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const clientIp = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const rateKey = `${clientIp}:${normalizedEmail}`;

    if (!checkRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many failed login attempts. Please try again in 5 minutes.' });
    }

    const user = await findUser(normalizedEmail);
    if (!user) {
      recordFailedLogin(rateKey);
      return res.status(404).json({ error: 'Account not found for this email. Switch to "Create Account" to register.' });
    }

    const checkHash = hashVerifier(authVerifier, user.salt);
    const storedBuf = Buffer.from(user.verifierHash, 'hex');
    const checkBuf = Buffer.from(checkHash, 'hex');

    if (storedBuf.length !== checkBuf.length || !crypto.timingSafeEqual(storedBuf, checkBuf)) {
      recordFailedLogin(rateKey);
      return res.status(401).json({ error: 'Incorrect master password.' });
    }

    // Success - clear failed attempts counter
    clearRateLimit(rateKey);

    const token = generateToken(normalizedEmail);
    return res.json({
      success: true,
      token,
      email: normalizedEmail,
      encryptedVault: user.encryptedVault,
      updatedAt: user.updatedAt,
      version: user.version || 1
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Get Vault Data (authenticated)
app.get('/api/vault', requireAuth, async (req, res) => {
  try {
    const user = await findUser(req.userEmail);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }
    return res.json({
      success: true,
      email: user.email,
      encryptedVault: user.encryptedVault,
      updatedAt: user.updatedAt,
      version: user.version || 1
    });
  } catch (err) {
    console.error('Get vault error:', err.message);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// 5. Update Vault Data (authenticated with Optimistic Concurrency / Atomic Version Protection)
app.post('/api/vault', requireAuth, async (req, res) => {
  try {
    const { encryptedVault, version, updatedAt } = req.body;
    if (!encryptedVault) {
      return res.status(400).json({ error: 'encryptedVault payload is required.' });
    }
    if (version === undefined || version === null || isNaN(Number(version))) {
      return res.status(400).json({ error: 'version integer is required for optimistic concurrency.' });
    }

    const clientVersion = Number(version);
    const now = new Date().toISOString();
    const finalUpdatedAt = updatedAt || now;

    const result = await atomicUpdateUserVault(req.userEmail, encryptedVault, finalUpdatedAt, clientVersion);

    if (result.notFound) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    if (result.conflict) {
      return res.status(409).json({
        error: 'Cloud data changed on another device.',
        code: 'CONFLICT',
        cloudVersion: result.cloudVersion,
        clientVersion: clientVersion
      });
    }

    return res.json({
      success: true,
      updatedAt: result.updatedAt,
      version: result.version
    });
  } catch (err) {
    console.error('Save vault error:', err.message);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

async function startServer(port = PORT) {
  await initDatabase();
  return app.listen(port, () => {
    console.log(`DreamsLab Cloud Vault API running on http://localhost:${port}`);
    console.log(`Database storage: ${pool ? 'PostgreSQL' : (isProduction ? 'FAIL (No Postgres)' : DB_FILE)}`);
  });
}

// Start Server if executed directly
if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  app,
  db,
  pool,
  loadDatabase,
  saveDatabase,
  findUser,
  insertUser,
  updateUserVault,
  atomicUpdateUserVault,
  initDatabase,
  startServer,
  checkRateLimit,
  recordFailedLogin,
  clearRateLimit,
  loginAttempts,
  checkRegisterRateLimit,
  recordRegisterAttempt,
  registerAttempts
};



