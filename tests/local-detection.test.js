const assert = require('assert');
const { getLocalEmailsSet } = require('./vault-engine');

describe('Local Account Detection', () => {
  it('1. Returns empty Set when Chrome is not installed / detectedProfiles is empty', () => {
    const detected = [];
    const result = getLocalEmailsSet(detected);
    assert.strictEqual(result.size, 0, 'Must return 0 accounts when no profiles detected');
  });

  it('2. Returns empty Set when detectedProfiles is null or undefined', () => {
    assert.strictEqual(getLocalEmailsSet(null).size, 0);
    assert.strictEqual(getLocalEmailsSet(undefined).size, 0);
  });

  it('3. Ignores profiles with missing, empty, or whitespace-only emails', () => {
    const detected = [
      { name: 'Profile 1', folder: 'Profile 1' },
      { name: 'Profile 2', folder: 'Profile 2', email: '' },
      { name: 'Profile 3', folder: 'Profile 3', email: '   ' }
    ];
    const result = getLocalEmailsSet(detected);
    assert.strictEqual(result.size, 0, 'Profiles without signed-in email must not be in local accounts');
  });

  it('4. Returns exactly the detected emails from Chrome User Data on this PC', () => {
    const detected = [
      { name: 'Work', email: 'john.work@example.com', folder: 'Default' },
      { name: 'Personal', email: 'john.personal@gmail.com', folder: 'Profile 1' }
    ];
    const result = getLocalEmailsSet(detected);
    assert.strictEqual(result.size, 2);
    assert.ok(result.has('john.work@example.com'));
    assert.ok(result.has('john.personal@gmail.com'));
  });

  it('5. Never includes cloud-only accounts in local account set', () => {
    const detected = [
      { name: 'Local Only', email: 'local@example.com', folder: 'Default' }
    ];
    const cloudAccount = 'remote-cloud-only@example.com';
    const result = getLocalEmailsSet(detected);
    assert.ok(!result.has(cloudAccount), 'Cloud-only account must never leak into local set');
  });

  it('6. Normalizes emails to lowercase and trimmed strings', () => {
    const detected = [
      { name: 'Mixed Case', email: '  User.Test@Gmail.COM  ' }
    ];
    const result = getLocalEmailsSet(detected);
    assert.ok(result.has('user.test@gmail.com'));
  });
});
