const assert = require('assert');
const { validateAndSanitizeImport } = require('./vault-engine');

describe('Secure Backups & Schema Validation', () => {
  it('1. Recognizes and validates encrypted vault backups (.dlvault)', () => {
    const encryptedPayload = {
      salt: 'c2FsdA==',
      iv: 'aXZpdml2aXY=',
      data: 'ZW5jcnlwdGVkZGF0YQ=='
    };
    const res = validateAndSanitizeImport(encryptedPayload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.isEncrypted, true);
  });

  it('2. Validates plaintext backups and normalizes link/profile structures', () => {
    const plaintextPayload = {
      links: [
        { id: 'l1', title: 'Google', url: 'https://google.com', priority: 'HIGH' }
      ],
      profiles: [
        { id: 'p1', email: 'user@example.com', name: 'User' }
      ]
    };
    const res = validateAndSanitizeImport(plaintextPayload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.isEncrypted, false);
    assert.strictEqual(res.data.links.length, 1);
    assert.strictEqual(res.data.links[0].url, 'https://google.com');
  });

  it('3. Neutralizes dangerous URL schemes (javascript:, data:, vbscript:) on import', () => {
    const dangerousPayload = {
      links: [
        { id: 'l1', title: 'XSS 1', url: 'javascript:alert(1)' },
        { id: 'l2', title: 'XSS 2', url: 'data:text/html,<script>alert(1)</script>' },
        { id: 'l3', title: 'Safe Link', url: 'https://safe.example.com' }
      ]
    };
    const res = validateAndSanitizeImport(dangerousPayload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.data.links[0].url, '', 'javascript: URL must be neutralized');
    assert.strictEqual(res.data.links[1].url, '', 'data: URL must be neutralized');
    assert.strictEqual(res.data.links[2].url, 'https://safe.example.com', 'Valid https URL must be preserved');
  });

  it('4. Rejects corrupted or malformed non-JSON backup inputs', () => {
    const res = validateAndSanitizeImport('{ this is not valid JSON }');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('Invalid JSON'));
  });

  it('5. Rejects backup objects missing essential vault structures', () => {
    const res = validateAndSanitizeImport({ someRandomKey: 123 });
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('missing required vault data'));
  });

  it('6. Enforces exact confirmation phrase for plaintext export', () => {
    function verifyPlaintextConfirmation(typedText) {
      return (typedText || '').trim() === 'EXPORT PLAINTEXT';
    }

    assert.strictEqual(verifyPlaintextConfirmation('EXPORT PLAINTEXT'), true);
    assert.strictEqual(verifyPlaintextConfirmation('export plaintext'), false);
    assert.strictEqual(verifyPlaintextConfirmation('yes'), false);
    assert.strictEqual(verifyPlaintextConfirmation(''), false);
  });
});
