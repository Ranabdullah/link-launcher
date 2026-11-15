CREATE TABLE users (
  email TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  verifier_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  vault_format TEXT NOT NULL DEFAULT 'json',
  generation TEXT NOT NULL
);
-- Separate chunks keep large encrypted vaults below D1's 2 MB row limit.
CREATE TABLE vault_chunks (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  generation TEXT NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (email, generation, part)
);
CREATE TABLE revoked_tokens (token_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
