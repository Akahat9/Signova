const CACHE_PREFIX = 'signova-user-workspace';
const LEGACY_PREFIX = 'signova-public-db';

function safeSegment(value) {
  return encodeURIComponent(String(value || '').trim() || 'unknown');
}

export function workspaceCacheKey(ownerId, collectionName) {
  return `${CACHE_PREFIX}:${safeSegment(ownerId)}:${safeSegment(collectionName)}`;
}

export function legacyWorkspaceCacheKey(collectionName) {
  return `${LEGACY_PREFIX}:${collectionName}`;
}

function parseCollection(serialized) {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readWorkspaceCache(storage, ownerId, collectionName, { migrateLegacy = false } = {}) {
  if (!storage) return [];
  const key = workspaceCacheKey(ownerId, collectionName);
  try {
    const scoped = parseCollection(storage.getItem(key));
    if (scoped) return scoped;
    if (!migrateLegacy) return [];
    const legacyKey = legacyWorkspaceCacheKey(collectionName);
    const legacy = parseCollection(storage.getItem(legacyKey));
    if (!legacy) return [];
    storage.setItem(key, JSON.stringify(legacy));
    storage.removeItem(legacyKey);
    return legacy;
  } catch {
    return [];
  }
}

export function writeWorkspaceCache(storage, ownerId, collectionName, items) {
  if (!storage || !Array.isArray(items)) return false;
  try {
    storage.setItem(workspaceCacheKey(ownerId, collectionName), JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function upsertWorkspaceCacheDoc(storage, ownerId, collectionName, item) {
  if (!item?.id) return false;
  const items = readWorkspaceCache(storage, ownerId, collectionName);
  return writeWorkspaceCache(storage, ownerId, collectionName, [item, ...items.filter((entry) => entry?.id !== item.id)]);
}

export function removeWorkspaceCacheDoc(storage, ownerId, collectionName, id) {
  const items = readWorkspaceCache(storage, ownerId, collectionName);
  return writeWorkspaceCache(storage, ownerId, collectionName, items.filter((entry) => entry?.id !== id));
}

