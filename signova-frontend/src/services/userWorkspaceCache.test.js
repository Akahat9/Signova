import { legacyWorkspaceCacheKey, readWorkspaceCache, removeWorkspaceCacheDoc, upsertWorkspaceCacheDoc, workspaceCacheKey, writeWorkspaceCache } from './userWorkspaceCache';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
    values,
  };
}

test('isolates the same collection for different authenticated owners', () => {
  const storage = createStorage();
  writeWorkspaceCache(storage, 'uid-a', 'chatState', [{ id: 'a' }]);
  writeWorkspaceCache(storage, 'uid-b', 'chatState', [{ id: 'b' }]);
  expect(readWorkspaceCache(storage, 'uid-a', 'chatState')).toEqual([{ id: 'a' }]);
  expect(readWorkspaceCache(storage, 'uid-b', 'chatState')).toEqual([{ id: 'b' }]);
  expect(workspaceCacheKey('uid-a', 'chatState')).not.toBe(workspaceCacheKey('uid-b', 'chatState'));
});

test('does not expose an unscoped legacy cache to authenticated sessions', () => {
  const legacyKey = legacyWorkspaceCacheKey('messages');
  const storage = createStorage({ [legacyKey]: JSON.stringify([{ id: 'legacy-secret' }]) });
  expect(readWorkspaceCache(storage, 'firebase-user', 'messages')).toEqual([]);
  expect(storage.removeItem).not.toHaveBeenCalled();
});

test('migrates legacy data only when the caller explicitly identifies a local workspace', () => {
  const legacyKey = legacyWorkspaceCacheKey('contacts');
  const storage = createStorage({ [legacyKey]: JSON.stringify([{ id: 'local-contact' }]) });
  expect(readWorkspaceCache(storage, 'local-owner', 'contacts', { migrateLegacy: true })).toEqual([{ id: 'local-contact' }]);
  expect(storage.values.get(workspaceCacheKey('local-owner', 'contacts'))).toBe(JSON.stringify([{ id: 'local-contact' }]));
  expect(storage.removeItem).toHaveBeenCalledWith(legacyKey);
});

test('upserts and removes documents without crossing workspace boundaries', () => {
  const storage = createStorage();
  expect(upsertWorkspaceCacheDoc(storage, 'uid-a', 'calls', { id: 'call-1', state: 'ringing' })).toBe(true);
  expect(upsertWorkspaceCacheDoc(storage, 'uid-a', 'calls', { id: 'call-1', state: 'ended' })).toBe(true);
  expect(readWorkspaceCache(storage, 'uid-a', 'calls')).toEqual([{ id: 'call-1', state: 'ended' }]);
  expect(removeWorkspaceCacheDoc(storage, 'uid-a', 'calls', 'call-1')).toBe(true);
  expect(readWorkspaceCache(storage, 'uid-a', 'calls')).toEqual([]);
});

test('fails safely for malformed data and storage exceptions', () => {
  const storage = createStorage({ [workspaceCacheKey('uid-a', 'calls')]: '{bad' });
  expect(readWorkspaceCache(storage, 'uid-a', 'calls')).toEqual([]);
  storage.setItem.mockImplementation(() => { throw new Error('quota'); });
  expect(writeWorkspaceCache(storage, 'uid-a', 'calls', [])).toBe(false);
});

