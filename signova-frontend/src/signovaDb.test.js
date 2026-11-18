/* eslint-disable import/first */
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ server: true })),
  setDoc: jest.fn(),
}));
jest.mock('./firebase', () => ({ firebaseAuth: null, firestoreDb: null, isFirebaseReady: false }));

import { deleteUserDoc, loadUserCollection, resetDatabaseSession, saveUserDoc } from './signovaDb';
import { legacyWorkspaceCacheKey, workspaceCacheKey } from './services/userWorkspaceCache';

beforeEach(() => {
  window.localStorage.clear();
  resetDatabaseSession();
});

test('keeps local fallback documents isolated by the active owner id', async () => {
  window.localStorage.setItem('signova-public-owner-id', 'local-a');
  await saveUserDoc('chatState', { id: 'messages', items: [{ id: 'message-a' }] });
  expect(await loadUserCollection('chatState')).toEqual([{ id: 'messages', items: [{ id: 'message-a' }] }]);

  resetDatabaseSession();
  window.localStorage.setItem('signova-public-owner-id', 'local-b');
  expect(await loadUserCollection('chatState')).toEqual([]);
  await saveUserDoc('chatState', { id: 'messages', items: [{ id: 'message-b' }] });

  expect(JSON.parse(window.localStorage.getItem(workspaceCacheKey('local-a', 'chatState')))[0].items[0].id).toBe('message-a');
  expect(JSON.parse(window.localStorage.getItem(workspaceCacheKey('local-b', 'chatState')))[0].items[0].id).toBe('message-b');
});

test('migrates an old unscoped collection only into the explicit local workspace', async () => {
  window.localStorage.setItem('signova-public-owner-id', 'local-owner');
  window.localStorage.setItem(legacyWorkspaceCacheKey('contacts'), JSON.stringify([{ id: 'legacy-contact' }]));
  expect(await loadUserCollection('contacts')).toEqual([{ id: 'legacy-contact' }]);
  expect(window.localStorage.getItem(legacyWorkspaceCacheKey('contacts'))).toBeNull();
  expect(window.localStorage.getItem(workspaceCacheKey('local-owner', 'contacts'))).toBe(JSON.stringify([{ id: 'legacy-contact' }]));
});

test('deletes only from the current owner workspace', async () => {
  window.localStorage.setItem('signova-public-owner-id', 'local-owner');
  await saveUserDoc('callHistory', { id: 'call-1' });
  await deleteUserDoc('callHistory', 'call-1');
  expect(await loadUserCollection('callHistory')).toEqual([]);
});
