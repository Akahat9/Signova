/* eslint-disable import/first */
const mockSetDoc = jest.fn(async () => undefined);
const mockDeleteDoc = jest.fn(async () => undefined);
const mockGetDocs = jest.fn(async () => ({ docs: [] }));

jest.mock('firebase/firestore', () => ({
  collection: (...segments) => ({ segments }),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  doc: (...segments) => ({ segments }),
  getDocs: (...args) => mockGetDocs(...args),
  serverTimestamp: () => ({ server: true }),
  setDoc: (...args) => mockSetDoc(...args),
}));
jest.mock('./firebase', () => ({ firebaseAuth: { currentUser: { uid: 'user-a' } }, firestoreDb: { name: 'test-db' }, isFirebaseReady: true }));

import { firebaseAuth } from './firebase';
import { deleteUserDoc, flushUserWorkspaceOutbox, loadUserCollection, resetDatabaseSession, saveUserDoc } from './signovaDb';
import { legacyWorkspaceCacheKey, workspaceCacheKey } from './services/userWorkspaceCache';
import { readWorkspaceOutbox } from './services/userWorkspaceOutbox';

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
  window.localStorage.clear();
  firebaseAuth.currentUser = { uid: 'user-a' };
  mockSetDoc.mockReset().mockResolvedValue(undefined);
  mockDeleteDoc.mockReset().mockResolvedValue(undefined);
  mockGetDocs.mockReset().mockResolvedValue({ docs: [] });
  setOnline(true);
  resetDatabaseSession();
});

test('does not create an anonymous Firebase identity while verified authentication is still booting', async () => {
  firebaseAuth.currentUser = null;
  await expect(saveUserDoc('userPreferences', { id: 'settings', theme: 'dark' })).resolves.toMatchObject({
    mode: 'local',
    queued: false,
  });
  expect(mockSetDoc).not.toHaveBeenCalled();
  expect(window.localStorage.getItem('signova-public-owner-id')).toMatch(/^local-/);
});

test('queues an authenticated offline write under its Firebase UID and flushes it after reconnect', async () => {
  setOnline(false);
  await expect(saveUserDoc('userPreferences', { id: 'settings', theme: 'dark' })).resolves.toMatchObject({ mode: 'local', queued: true });
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([
    expect.objectContaining({ kind: 'upsert', collection: 'userPreferences', documentId: 'settings' }),
  ]);
  expect(mockSetDoc).not.toHaveBeenCalled();

  setOnline(true);
  await expect(flushUserWorkspaceOutbox()).resolves.toMatchObject({ mode: 'firestore', remaining: 0 });
  expect(mockSetDoc).toHaveBeenCalledWith(
    expect.objectContaining({ segments: [{ name: 'test-db' }, 'users', 'user-a', 'userPreferences', 'settings'] }),
    expect.objectContaining({ theme: 'dark', updatedAt: { server: true } }),
    { merge: true },
  );
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([]);
});

test('retains a write after a Firestore failure and acknowledges it only after a later successful flush', async () => {
  mockSetDoc.mockRejectedValueOnce(new Error('network down'));
  await expect(saveUserDoc('contacts', { id: 'contact-1', name: 'A' })).resolves.toMatchObject({ mode: 'local', queued: true, reason: 'network down' });
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toHaveLength(1);

  await flushUserWorkspaceOutbox();
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([]);
  expect(mockSetDoc).toHaveBeenCalledTimes(2);
});

test('never flushes one account outbox while another Firebase UID is active', async () => {
  setOnline(false);
  await saveUserDoc('chatState', { id: 'messages', items: [{ id: 'a-secret' }] });
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toHaveLength(1);

  firebaseAuth.currentUser = { uid: 'user-b' };
  setOnline(true);
  await flushUserWorkspaceOutbox();
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toHaveLength(1);
  expect(mockSetDoc).not.toHaveBeenCalled();

  firebaseAuth.currentUser = { uid: 'user-a' };
  await flushUserWorkspaceOutbox();
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([]);
  expect(mockSetDoc).toHaveBeenCalledTimes(1);
});

test('queues authenticated offline deletes and does not migrate an unscoped legacy cache', async () => {
  window.localStorage.setItem(legacyWorkspaceCacheKey('contacts'), JSON.stringify([{ id: 'legacy-secret' }]));
  setOnline(false);
  expect(await loadUserCollection('contacts')).toEqual([]);
  expect(window.localStorage.getItem(legacyWorkspaceCacheKey('contacts'))).not.toBeNull();

  await saveUserDoc('contacts', { id: 'contact-1', name: 'A' });
  await expect(deleteUserDoc('contacts', 'contact-1')).resolves.toMatchObject({ mode: 'local', queued: true });
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([
    expect.objectContaining({ kind: 'delete', documentId: 'contact-1' }),
  ]);

  setOnline(true);
  await flushUserWorkspaceOutbox();
  expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  expect(readWorkspaceOutbox(window.localStorage, 'user-a')).toEqual([]);
});

test('falls back to cached workspace data when Firestore reads time out', async () => {
  window.localStorage.setItem(workspaceCacheKey('user-a', 'contacts'), JSON.stringify([{ id: 'cached-contact', name: 'Cached' }]));
  mockGetDocs.mockResolvedValueOnce(null);

  await expect(loadUserCollection('contacts')).resolves.toEqual([{ id: 'cached-contact', name: 'Cached' }]);
  expect(mockGetDocs).toHaveBeenCalledTimes(1);
});
