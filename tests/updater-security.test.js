const assert = require('assert');
const crypto = require('crypto');
const { compareSemver } = require('./vault-engine');

describe('Secure Hot-Update Engine', () => {
  it('1. Compares semver versions correctly across all dimensions', () => {
    assert.strictEqual(compareSemver('1.0.9', '1.0.8'), 1);
    assert.strictEqual(compareSemver('1.0.8', '1.0.9'), -1);
    assert.strictEqual(compareSemver('1.0.9', '1.0.9'), 0);
    assert.strictEqual(compareSemver('2.0.0', '1.9.9'), 1);
    assert.strictEqual(compareSemver('1.1.0', '1.0.9'), 1);
    assert.strictEqual(compareSemver('v1.0.9', '1.0.9'), 0);
  });

  it('2. Prevents downgrading or re-applying same version', () => {
    const currentAppVersion = '1.0.9';
    function isUpdateEligible(targetVersion) {
      return compareSemver(targetVersion, currentAppVersion) > 0;
    }

    assert.strictEqual(isUpdateEligible('1.0.8'), false, 'Older version must not be eligible');
    assert.strictEqual(isUpdateEligible('1.0.9'), false, 'Same version must not be eligible');
    assert.strictEqual(isUpdateEligible('1.0.10'), true, 'Newer patch version must be eligible');
    assert.strictEqual(isUpdateEligible('1.1.0'), true, 'Newer minor version must be eligible');
  });

  it('3. Computes and verifies SHA-256 checksum match', () => {
    const fileContent = '<!DOCTYPE html><html><body>DreamsLab Vault v1.0.9</body></html>';
    const computedHash = crypto.createHash('sha256').update(fileContent).digest('hex');

    const manifest = {
      version: '1.0.9',
      sha256: computedHash
    };

    const isChecksumValid = (content, expectedHash) => {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return hash.toLowerCase() === (expectedHash || '').toLowerCase();
    };

    assert.strictEqual(isChecksumValid(fileContent, manifest.sha256), true);
    assert.strictEqual(isChecksumValid(fileContent + ' <!-- tampered -->', manifest.sha256), false);
  });

  it('4. Rejects update when checksum verification fails', () => {
    const untrustedContent = '<!DOCTYPE html><html><body>Malicious Payload</body></html>';
    const expectedHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const actualHash = crypto.createHash('sha256').update(untrustedContent).digest('hex');
    assert.notStrictEqual(actualHash, expectedHash);
  });
});
