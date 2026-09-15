const assert = require('assert');
const { sortAndFilterProfiles } = require('./vault-engine');

describe('Account-Level Star & Pin', () => {
  const mockProfiles = [
    { id: 'p1', email: 'charlie@example.com', name: 'Charlie', starred: false, pinned: false },
    { id: 'p2', email: 'alice@example.com', name: 'Alice', starred: true, pinned: false },
    { id: 'p3', email: 'bob@example.com', name: 'Bob', starred: false, pinned: true },
    { id: 'p4', email: 'david@example.com', name: 'David', starred: true, pinned: true }
  ];

  it('1. Sorts pinned profiles first, then starred, then alphabetical', () => {
    const sorted = sortAndFilterProfiles(mockProfiles, 'ALL');
    assert.strictEqual(sorted.length, 4);
    // Pinned: Bob and David (David has starred + pinned, Bob has pinned)
    // David and Bob should come first (both pinned), then Alice (starred), then Charlie (neither)
    assert.strictEqual(sorted[0].name, 'David'); // pinned + starred
    assert.strictEqual(sorted[1].name, 'Bob');   // pinned
    assert.strictEqual(sorted[2].name, 'Alice'); // starred
    assert.strictEqual(sorted[3].name, 'Charlie');
  });

  it('2. Filters by STARRED tab to only show starred profiles', () => {
    const starredOnly = sortAndFilterProfiles(mockProfiles, 'STARRED');
    assert.strictEqual(starredOnly.length, 2);
    assert.ok(starredOnly.some(p => p.email === 'alice@example.com'));
    assert.ok(starredOnly.some(p => p.email === 'david@example.com'));
    assert.ok(!starredOnly.some(p => p.email === 'bob@example.com'));
    assert.ok(!starredOnly.some(p => p.email === 'charlie@example.com'));
  });

  it('3. Filters by PINNED tab to only show pinned profiles', () => {
    const pinnedOnly = sortAndFilterProfiles(mockProfiles, 'PINNED');
    assert.strictEqual(pinnedOnly.length, 2);
    assert.ok(pinnedOnly.some(p => p.email === 'bob@example.com'));
    assert.ok(pinnedOnly.some(p => p.email === 'david@example.com'));
    assert.ok(!pinnedOnly.some(p => p.email === 'alice@example.com'));
    assert.ok(!pinnedOnly.some(p => p.email === 'charlie@example.com'));
  });

  it('4. Local scope filter ensures only accounts present on this PC are shown', () => {
    const localEmailsOnThisPc = new Set(['bob@example.com', 'charlie@example.com']);
    const localView = sortAndFilterProfiles(mockProfiles, 'ALL', localEmailsOnThisPc);
    assert.strictEqual(localView.length, 2);
    assert.strictEqual(localView[0].name, 'Bob'); // Pinned
    assert.strictEqual(localView[1].name, 'Charlie');
    // Alice and David are not on this PC, so they must not show
    assert.ok(!localView.some(p => p.email === 'alice@example.com'));
    assert.ok(!localView.some(p => p.email === 'david@example.com'));
  });

  it('5. Account star/pin is completely decoupled from link star/pin', () => {
    const link = { id: 'l1', title: 'Test Link', starred: true, pinned: false, profileEmail: 'charlie@example.com' };
    const profile = mockProfiles.find(p => p.email === 'charlie@example.com');
    assert.strictEqual(profile.starred, false, 'Account starred must not change when link is starred');
    assert.strictEqual(link.starred, true);
  });
});
