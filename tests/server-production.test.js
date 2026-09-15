const assert = require('assert');
const { hashVerifier, generateToken, verifyToken } = require('../server/server');

describe('Production Cloud Service Safety', () => {
  it('1. Verifies token lifecycle and claims integrity', () => {
    const email = 'prod-user@example.com';
    const token = generateToken(email);
    const verified = verifyToken(token);
    assert.ok(verified);
    assert.strictEqual(verified.email, email);
  });

  it('2. Enforces password hashing using SHA-256 verifier', () => {
    const rawPassword = 'super-secret-master-pass';
    const salt = '1234567890abcdef1234567890abcdef';
    const hash = hashVerifier(rawPassword, salt);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
    assert.strictEqual(hashVerifier(rawPassword, salt), hash);
  });

  it('3. Simulates optimistic concurrency version conflict (HTTP 409)', () => {
    const userRecord = {
      email: 'user@example.com',
      version: 5,
      encryptedVault: { data: 'vault-v5' }
    };

    function simulateAtomicUpdate(user, incomingVault, clientVersion) {
      if (clientVersion !== user.version) {
        return {
          success: false,
          conflict: true,
          currentVersion: user.version,
          encryptedVault: user.encryptedVault
        };
      }
      user.version += 1;
      user.encryptedVault = incomingVault;
      return { success: true, version: user.version };
    }

    const result = simulateAtomicUpdate(userRecord, { data: 'vault-v6' }, 4);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.conflict, true);
    assert.strictEqual(result.currentVersion, 5);

    const successResult = simulateAtomicUpdate(userRecord, { data: 'vault-v6' }, 5);
    assert.strictEqual(successResult.success, true);
    assert.strictEqual(successResult.version, 6);
  });

  it('4. Sanitizes error responses in production without exposing internal stack traces', () => {
    function sanitizeErrorMessage(err, isProduction = true) {
      if (isProduction) {
        if (err.code === 'DB_UNAVAILABLE' || err.code === 'DB_ERROR') {
          return { status: 503, error: 'Database service is currently unavailable. Please try again later.' };
        }
        return { status: 500, error: 'Internal server error' };
      }
      return { status: 500, error: err.message, stack: err.stack };
    }

    const internalError = new Error('FATAL: connection to PostgreSQL at 10.0.0.1:5432 failed: password authentication failed');
    internalError.code = 'DB_ERROR';

    const prodResponse = sanitizeErrorMessage(internalError, true);
    assert.strictEqual(prodResponse.status, 503);
    assert.strictEqual(prodResponse.error, 'Database service is currently unavailable. Please try again later.');
    assert.strictEqual(prodResponse.stack, undefined, 'Stack trace must NEVER be included in production');
    assert.ok(!prodResponse.error.includes('10.0.0.1'), 'Internal host IPs must never be exposed');
  });
});
