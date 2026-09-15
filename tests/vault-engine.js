/**
 * DreamsLab Vault Core Logic Engine
 * Shared algorithms for 3-way merge, profile sorting/filtering, URL sanitization, and semver comparison.
 */

/**
 * Compare two semver strings (e.g. '1.0.9' vs '1.0.8')
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean = v => String(v).trim().replace(/^v/i, '');
  const p1 = clean(v1).split('.').map(n => parseInt(n, 10) || 0);
  const p2 = clean(v2).split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] !== undefined ? p1[i] : 0;
    const num2 = p2[i] !== undefined ? p2[i] : 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Get the set of local emails detected strictly from Chrome on this PC
 * NO DEFAULT HARDCODED FALLBACKS ALLOWED.
 * @param {Array<{email: string}>} detectedProfiles
 * @returns {Set<string>}
 */
function getLocalEmailsSet(detectedProfiles) {
  const set = new Set();
  if (Array.isArray(detectedProfiles)) {
    detectedProfiles.forEach(p => {
      const email = (p && p.email ? String(p.email) : '').toLowerCase().trim();
      if (email) set.add(email);
    });
  }
  return set;
}

/**
 * Sort and filter profiles based on tab filter and active view scope
 * Priority: Pinned first -> Starred second -> Alphabetical by name/email
 * @param {Array<object>} profiles
 * @param {'ALL'|'STARRED'|'PINNED'} filter
 * @param {Set<string>|null} activeScopeEmails - If provided (Local view), only profiles in this set are shown
 * @returns {Array<object>}
 */
function sortAndFilterProfiles(profiles, filter = 'ALL', activeScopeEmails = null) {
  if (!Array.isArray(profiles)) return [];

  // Step 1: Filter by scope (Local vs Cloud)
  let list = profiles.filter(p => {
    if (!p) return false;
    if (activeScopeEmails !== null) {
      const email = (p.email || '').toLowerCase().trim();
      if (!email || !activeScopeEmails.has(email)) return false;
    }
    return true;
  });

  // Step 2: Filter by tab (ALL, STARRED, PINNED)
  if (filter === 'STARRED') {
    list = list.filter(p => !!p.starred);
  } else if (filter === 'PINNED') {
    list = list.filter(p => !!p.pinned);
  }

  // Step 3: Sort: pinned -> starred -> alphabetical
  return list.sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aStarred = a.starred ? 1 : 0;
    const bStarred = b.starred ? 1 : 0;
    if (aStarred !== bStarred) return bStarred - aStarred;

    const aName = (a.name || a.email || '').toLowerCase();
    const bName = (b.name || b.email || '').toLowerCase();
    return aName.localeCompare(bName);
  });
}

/**
 * 3-Way Vault Merge
 * Merges local changes and remote changes using the last-synced base state.
 * Handles:
 * - Stable IDs
 * - Timestamps (updatedAt) for field-level resolution
 * - Deletion tombstones (deleted: true / deletedAt)
 * - Profile merging (strips local hardware folders)
 * - Category deduplication
 *
 * @param {object} baseVault - Last synced state
 * @param {object} localVault - Local state on current PC
 * @param {object} remoteVault - Incoming remote state from Cloud
 * @returns {object} Merged vault
 */
function merge3WayVault(baseVault, localVault, remoteVault) {
  const base = baseVault || { links: [], profiles: [], categories: [] };
  const local = localVault || { links: [], profiles: [], categories: [] };
  const remote = remoteVault || { links: [], profiles: [], categories: [] };

  const baseLinksMap = new Map((base.links || []).map(l => [l.id, l]));
  const localLinksMap = new Map((local.links || []).map(l => [l.id, l]));
  const remoteLinksMap = new Map((remote.links || []).map(l => [l.id, l]));

  const allLinkIds = new Set([
    ...baseLinksMap.keys(),
    ...localLinksMap.keys(),
    ...remoteLinksMap.keys()
  ]);

  const mergedLinks = [];

  for (const id of allLinkIds) {
    const baseLink = baseLinksMap.get(id);
    const localLink = localLinksMap.get(id);
    const remoteLink = remoteLinksMap.get(id);

    // Case 1: Added only locally
    if (!baseLink && localLink && !remoteLink) {
      mergedLinks.push(localLink);
      continue;
    }

    // Case 2: Added only remotely
    if (!baseLink && !localLink && remoteLink) {
      mergedLinks.push(remoteLink);
      continue;
    }

    // Case 3: Added on both sides independently
    if (!baseLink && localLink && remoteLink) {
      const localTime = new Date(localLink.updatedAt || localLink.createdAt || 0).getTime();
      const remoteTime = new Date(remoteLink.updatedAt || remoteLink.createdAt || 0).getTime();
      mergedLinks.push(localTime >= remoteTime ? localLink : remoteLink);
      continue;
    }

    // Case 4: Existed in base
    if (baseLink) {
      // Deleted on both sides
      if (!localLink && !remoteLink) continue;
      if (localLink?.deleted && remoteLink?.deleted) continue;

      // Deleted locally, unchanged remotely -> stay deleted
      if (!localLink || localLink.deleted) {
        const remoteTime = new Date(remoteLink?.updatedAt || 0).getTime();
        const baseTime = new Date(baseLink.updatedAt || 0).getTime();
        if (remoteTime > baseTime) {
          // Remote was updated after base, keep remote
          mergedLinks.push(remoteLink);
        }
        // else locally deleted wins
        continue;
      }

      // Deleted remotely, unchanged locally -> stay deleted
      if (!remoteLink || remoteLink.deleted) {
        const localTime = new Date(localLink.updatedAt || 0).getTime();
        const baseTime = new Date(baseLink.updatedAt || 0).getTime();
        if (localTime > baseTime) {
          // Local was updated after base, keep local
          mergedLinks.push(localLink);
        }
        // else remotely deleted wins
        continue;
      }

      // Modified on both sides -> latest updatedAt wins
      const localTime = new Date(localLink.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteLink.updatedAt || 0).getTime();

      if (localTime >= remoteTime) {
        mergedLinks.push(localLink);
      } else {
        mergedLinks.push(remoteLink);
      }
    }
  }

  // --- MERGE PROFILES ---
  const profMap = new Map();

  // Helper to normalize and strip hardware folder
  const cleanProfile = p => {
    if (!p) return null;
    const clone = Object.assign({}, p);
    delete clone.folder;
    return clone;
  };

  (remote.profiles || []).forEach(p => {
    const email = (p.email || '').toLowerCase().trim();
    const key = email || p.id;
    if (key) profMap.set(key, cleanProfile(p));
  });

  (local.profiles || []).forEach(lp => {
    const email = (lp.email || '').toLowerCase().trim();
    const key = email || lp.id;
    if (!key) return;

    const cleanedLocal = cleanProfile(lp);
    if (!profMap.has(key)) {
      profMap.set(key, cleanedLocal);
    } else {
      const existing = profMap.get(key);
      const lTime = new Date(cleanedLocal.updatedAt || 0).getTime();
      const rTime = new Date(existing.updatedAt || 0).getTime();
      profMap.set(key, lTime >= rTime ? Object.assign({}, existing, cleanedLocal) : Object.assign({}, cleanedLocal, existing));
    }
  });

  const mergedProfiles = Array.from(profMap.values());

  // --- MERGE CATEGORIES ---
  const DEFAULT_CATEGORIES = [
    "Book Publish", "App Ideas", "Book Writing", "Advertisement",
    "App Development", "Book Cover", "Work Related", "Apps",
    "Marketing", "Personal", "Research", "Testing", "General"
  ];
  const catSet = new Set([
    ...DEFAULT_CATEGORIES,
    ...(base.categories || []),
    ...(remote.categories || []),
    ...(local.categories || [])
  ]);
  const mergedCategories = Array.from(catSet);

  return {
    links: mergedLinks,
    profiles: mergedProfiles,
    categories: mergedCategories,
    cloudConfig: Object.assign({}, base.cloudConfig, remote.cloudConfig, local.cloudConfig)
  };
}

/**
 * Validate and sanitize vault JSON imports
 * Ensures safe URLs (http/https only) and correct object schema.
 * @param {string|object} input
 * @returns {{ valid: boolean, error?: string, data?: object }}
 */
function validateAndSanitizeImport(input) {
  let parsed = null;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return { valid: false, error: 'Invalid JSON format: ' + e.message };
    }
  } else if (typeof input === 'object' && input !== null) {
    parsed = input;
  } else {
    return { valid: false, error: 'Input must be a JSON string or object.' };
  }

  // Check if this is an encrypted vault payload
  if (parsed.data && parsed.iv && (parsed.salt !== undefined || typeof parsed.data === 'string')) {
    return { valid: true, isEncrypted: true, data: parsed };
  }

  // Check if plaintext vault
  if (!parsed.links && !parsed.profiles && !Array.isArray(parsed)) {
    return { valid: false, error: 'Backup file missing required vault data (links or profiles).' };
  }

  const rawLinks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.links) ? parsed.links : []);
  const sanitizedLinks = [];

  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue;
    let url = String(link.url || '').trim();

    // Enforce http: and https: only (prevent javascript:, data:, etc.)
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          url = ''; // Disallow dangerous protocols
        }
      } catch (e) {
        // If relative or invalid URL format, ignore or strip
        url = '';
      }
    }

    sanitizedLinks.push({
      id: link.id || 'link_' + Math.random().toString(36).substr(2, 9),
      title: String(link.title || link.name || 'Untitled').slice(0, 300),
      url: url,
      category: String(link.category || 'General').slice(0, 100),
      profileEmail: (link.profileEmail || '').toLowerCase().trim(),
      profileId: link.profileId || '',
      priority: ['HIGH', 'MEDIUM', 'LOW'].includes(link.priority) ? link.priority : 'MEDIUM',
      starred: !!link.starred,
      pinned: !!link.pinned,
      deleted: !!link.deleted,
      createdAt: link.createdAt || new Date().toISOString(),
      updatedAt: link.updatedAt || new Date().toISOString()
    });
  }

  const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  const sanitizedProfiles = [];

  for (const prof of rawProfiles) {
    if (!prof || typeof prof !== 'object') continue;
    const email = (prof.email || '').toLowerCase().trim();
    sanitizedProfiles.push({
      id: prof.id || 'prof_' + Math.random().toString(36).substr(2, 9),
      name: String(prof.name || email.split('@')[0] || 'Profile').slice(0, 100),
      email: email,
      color: prof.color || '#0b57d0',
      starred: !!prof.starred,
      pinned: !!prof.pinned,
      createdAt: prof.createdAt || new Date().toISOString(),
      updatedAt: prof.updatedAt || new Date().toISOString()
    });
  }

  const categories = Array.isArray(parsed.categories) ? parsed.categories.map(c => String(c).slice(0, 50)) : [];

  return {
    valid: true,
    isEncrypted: false,
    data: {
      links: sanitizedLinks,
      profiles: sanitizedProfiles,
      categories: categories.length > 0 ? categories : undefined,
      cloudConfig: parsed.cloudConfig || {}
    }
  };
}

module.exports = {
  compareSemver,
  getLocalEmailsSet,
  sortAndFilterProfiles,
  merge3WayVault,
  validateAndSanitizeImport
};
