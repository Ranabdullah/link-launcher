const assert = require('assert');
const { merge3WayVault } = require('./vault-engine');

describe('3-Way Sync & Conflict Resolution', () => {
  it('1. Merges non-conflicting additions from both local and remote', () => {
    const base = {
      links: [{ id: 'link-1', title: 'Base Link', url: 'https://base.com' }],
      profiles: [{ id: 'p1', email: 'user@example.com', name: 'User' }],
      categories: ['Work']
    };

    const local = {
      links: [
        { id: 'link-1', title: 'Base Link', url: 'https://base.com' },
        { id: 'link-local', title: 'Local Link', url: 'https://local.com', createdAt: '2026-09-15T10:00:00Z' }
      ],
      profiles: [{ id: 'p1', email: 'user@example.com', name: 'User' }],
      categories: ['Work', 'Personal']
    };

    const remote = {
      links: [
        { id: 'link-1', title: 'Base Link', url: 'https://base.com' },
        { id: 'link-remote', title: 'Remote Link', url: 'https://remote.com', createdAt: '2026-09-15T11:00:00Z' }
      ],
      profiles: [{ id: 'p1', email: 'user@example.com', name: 'User' }],
      categories: ['Work', 'Finance']
    };

    const merged = merge3WayVault(base, local, remote);

    assert.strictEqual(merged.links.length, 3, 'Merged vault must contain all 3 links');
    const ids = merged.links.map(l => l.id);
    assert.ok(ids.includes('link-1'));
    assert.ok(ids.includes('link-local'));
    assert.ok(ids.includes('link-remote'));

    assert.ok(merged.categories.includes('Personal'));
    assert.ok(merged.categories.includes('Finance'));
  });

  it('2. Resolves concurrent field-level edits using latest updatedAt timestamp', () => {
    const base = {
      links: [{ id: 'link-1', title: 'Original Title', url: 'https://base.com', updatedAt: '2026-09-15T08:00:00Z' }],
      profiles: [],
      categories: []
    };

    const local = {
      links: [{ id: 'link-1', title: 'Local Newer Title', url: 'https://base.com', updatedAt: '2026-09-15T10:00:00Z' }],
      profiles: [],
      categories: []
    };

    const remote = {
      links: [{ id: 'link-1', title: 'Remote Older Title', url: 'https://base.com', updatedAt: '2026-09-15T09:00:00Z' }],
      profiles: [],
      categories: []
    };

    const merged = merge3WayVault(base, local, remote);
    assert.strictEqual(merged.links.length, 1);
    assert.strictEqual(merged.links[0].title, 'Local Newer Title', 'Newer local edit must win over older remote edit');
  });

  it('3. Respects deletion tombstones when item was deleted remotely and untouched locally', () => {
    const base = {
      links: [{ id: 'link-1', title: 'To Delete', url: 'https://delete.com', updatedAt: '2026-09-15T08:00:00Z' }],
      profiles: [],
      categories: []
    };

    const local = {
      links: [{ id: 'link-1', title: 'To Delete', url: 'https://delete.com', updatedAt: '2026-09-15T08:00:00Z' }],
      profiles: [],
      categories: []
    };

    const remote = {
      links: [{ id: 'link-1', title: 'To Delete', url: 'https://delete.com', deleted: true, updatedAt: '2026-09-15T09:00:00Z' }],
      profiles: [],
      categories: []
    };

    const merged = merge3WayVault(base, local, remote);
    assert.strictEqual(merged.links.length, 0, 'Deleted link must not appear in merged links');
  });

  it('4. Strips local hardware folders from profiles during merge', () => {
    const base = { links: [], profiles: [], categories: [] };
    const local = {
      links: [],
      profiles: [{ id: 'p1', email: 'user@example.com', name: 'User', folder: 'C:\\Chrome\\Profile 1' }],
      categories: []
    };
    const remote = {
      links: [],
      profiles: [{ id: 'p1', email: 'user@example.com', name: 'User', starred: true }],
      categories: []
    };

    const merged = merge3WayVault(base, local, remote);
    assert.strictEqual(merged.profiles.length, 1);
    assert.strictEqual(merged.profiles[0].folder, undefined, 'Hardware folder path must be stripped');
    assert.strictEqual(merged.profiles[0].email, 'user@example.com');
  });
});
