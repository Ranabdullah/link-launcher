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
const JWT_SECRET = process.env.JWT_SECRET || 'dreamslab-secret-jwt-key-2026-secure';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'vaults.json');

// Middleware
app.use(express.json({ limit: '15mb' }));

// CORS configuration - allow GitHub Pages, local dev, and Electron
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : ['https://abdullahinayat24-lang.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Electron)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.github.io') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive CORS for user-hosted desktop/web clients
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Database with atomic persistence to DB_FILE
let db = { users: {} };
function loadDatabase() {
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
  try {
    const tempPath = DB_FILE + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Error persisting database:', err.message);
  }
}

loadDatabase();

// PostgreSQL Connection Pool (Render / Railway / Supabase / Neon)
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
    console.log('PostgreSQL database pool initialized.');
  } catch (e) {
    console.warn('Could not initialize pg Pool:', e.message);
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
      `);
      console.log('PostgreSQL table "users" verified/created successfully.');
    } catch (err) {
      console.error('Failed to initialize PostgreSQL table, falling back to local file DB:', err.message);
      pool = null;
    }
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
          encryptedVault: row.encrypted_vault,
          updatedAt: row.updated_at,
          version: row.version || 1,
          createdAt: row.created_at
        };
      }
      return null;
    } catch (err) {
      console.error('PostgreSQL findUser error, checking memory DB:', err.message);
    }
  }
  return db.users[normalizedEmail] || null;
}

async function insertUser(user) {
  const normalizedEmail = user.email.toLowerCase().trim();
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
        user.encryptedVault || null,
        user.updatedAt,
        user.version || 1,
        user.createdAt
      ]);
    } catch (err) {
      console.error('PostgreSQL insertUser error:', err.message);
      throw err;
    }
  }
  // Keep local memory/file synced
  db.users[normalizedEmail] = user;
  saveDatabase();
  return user;
}

async function updateUserVault(email, encryptedVault, updatedAt, version) {
  const normalizedEmail = email.toLowerCase().trim();
  if (pool) {
    try {
      await pool.query(`
        UPDATE users 
        SET encrypted_vault = $1, updated_at = $2, version = $3
        WHERE email = $4
      `, [encryptedVault, updatedAt, version, normalizedEmail]);
    } catch (err) {
      console.error('PostgreSQL updateUserVault error:', err.message);
      throw err;
    }
  }
  if (db.users[normalizedEmail]) {
    db.users[normalizedEmail].encryptedVault = encryptedVault;
    db.users[normalizedEmail].updatedAt = updatedAt;
    db.users[normalizedEmail].version = version;
    saveDatabase();
  }
}

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DreamsLab Cloud Vault Service',
    version: '1.0.6',
    storage: pool ? 'postgres' : 'file',
    time: new Date().toISOString()
  });
});

// 2. Register Account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, authVerifier, encryptedVault } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!authVerifier || typeof authVerifier !== 'string' || authVerifier.length < 16) {
      return res.status(400).json({ error: 'Valid authentication verifier is required.' });
    }

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
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// 3. Login Account
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, authVerifier } = req.body;
    if (!email || !authVerifier) {
      return res.status(400).json({ error: 'Email and authVerifier are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUser(normalizedEmail);

    if (!user) {
      return res.status(404).json({ error: 'Account not found for this email. Switch to "Create Account" to register.' });
    }

    const checkHash = hashVerifier(authVerifier, user.salt);
    const storedBuf = Buffer.from(user.verifierHash, 'hex');
    const checkBuf = Buffer.from(checkHash, 'hex');

    if (storedBuf.length !== checkBuf.length || !crypto.timingSafeEqual(storedBuf, checkBuf)) {
      return res.status(401).json({ error: 'Incorrect master password.' });
    }

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
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
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
    console.error('Get vault error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// 5. Update Vault Data (authenticated)
app.post('/api/vault', requireAuth, async (req, res) => {
  try {
    const { encryptedVault, version, updatedAt } = req.body;
    if (!encryptedVault) {
      return res.status(400).json({ error: 'encryptedVault payload is required.' });
    }

    const user = await findUser(req.userEmail);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    const now = new Date().toISOString();
    const nextVersion = (user.version || 1) + 1;
    const finalUpdatedAt = updatedAt || now;
    await updateUserVault(req.userEmail, encryptedVault, finalUpdatedAt, nextVersion);

    return res.json({
      success: true,
      updatedAt: finalUpdatedAt,
      version: nextVersion
    });
  } catch (err) {
    console.error('Save vault error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

async function startServer(port = PORT) {
  await initDatabase();
  return app.listen(port, () => {
    console.log(`DreamsLab Cloud Vault API running on http://localhost:${port}`);
    console.log(`Database storage: ${pool ? 'PostgreSQL' : DB_FILE}`);
  });
}

// Start Server if executed directly
if (require.main === module) {
  startServer(PORT);
}

module.exports = { app, db, pool, loadDatabase, saveDatabase, findUser, insertUser, updateUserVault, initDatabase, startServer };


