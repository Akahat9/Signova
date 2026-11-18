import { IDBFactory } from 'fake-indexeddb';
import {
  loadMlsGroupState,
  MLS_GROUP_STATE_STORE,
  MLS_STATE_DATABASE_NAME,
  MLS_STATE_KEY_STORE,
  saveMlsGroupState,
  wipeMlsDeviceState,
} from './mlsStateStore';

const { webcrypto } = require('crypto');
const originalStructuredClone = global.structuredClone;
beforeAll(() => { global.structuredClone = originalStructuredClone || ((value) => value); });
afterAll(() => { global.structuredClone = originalStructuredClone; });

const state = (text) => new TextEncoder().encode(text);
const hash = (character) => character.repeat(64);
const options = (indexedDBProvider) => ({ indexedDBProvider, cryptoProvider: webcrypto });

function openRawDatabase(indexedDBProvider) {
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(MLS_STATE_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('encrypts opaque MLS state at rest and reloads the current epoch', async () => {
  const indexedDBProvider = new IDBFactory();
  const plaintext = state('opaque openmls group state');
  await saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 1,
    commitHash: hash('a'), parentCommitHash: '', state: plaintext,
  }, options(indexedDBProvider));
  const loaded = await loadMlsGroupState('group-a', 'device-a', options(indexedDBProvider));
  expect(loaded).toMatchObject({ epoch: 1, commitHash: hash('a'), parentCommitHash: '' });
  expect(Array.from(loaded.state)).toEqual(Array.from(plaintext));

  const database = await openRawDatabase(indexedDBProvider);
  const transaction = database.transaction([MLS_STATE_KEY_STORE, MLS_GROUP_STATE_STORE], 'readonly');
  const keyRecord = await requestResult(transaction.objectStore(MLS_STATE_KEY_STORE).get('device-a'));
  const rawRecord = await requestResult(transaction.objectStore(MLS_GROUP_STATE_STORE).get(JSON.stringify(['device-a', 'group-a'])));
  expect(keyRecord.key.extractable).toBe(false);
  expect(Array.from(rawRecord.ciphertext)).not.toEqual(Array.from(plaintext));
  expect(rawRecord).not.toHaveProperty('state');
  database.close();
});

test('rejects rollback, epoch skips, and transcript forks', async () => {
  const indexedDBProvider = new IDBFactory();
  await saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 1,
    commitHash: hash('a'), state: state('epoch one'),
  }, options(indexedDBProvider));
  await expect(saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 1,
    commitHash: hash('b'), state: state('rollback'),
  }, options(indexedDBProvider))).rejects.toThrow(/rollback, skip, or fork/i);
  await expect(saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 3,
    commitHash: hash('c'), parentCommitHash: hash('a'), state: state('skip'),
  }, options(indexedDBProvider))).rejects.toThrow(/rollback, skip, or fork/i);
  await expect(saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 2,
    commitHash: hash('d'), parentCommitHash: hash('f'), state: state('fork'),
  }, options(indexedDBProvider))).rejects.toThrow(/rollback, skip, or fork/i);
});

test('serializes concurrent epoch commits so only one branch wins', async () => {
  const indexedDBProvider = new IDBFactory();
  await saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 1,
    commitHash: hash('a'), state: state('epoch one'),
  }, options(indexedDBProvider));
  const attempts = await Promise.allSettled(['b', 'c'].map((character) => saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 2,
    commitHash: hash(character), parentCommitHash: hash('a'), state: state(`epoch two ${character}`),
  }, options(indexedDBProvider))));
  expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const loaded = await loadMlsGroupState('group-a', 'device-a', options(indexedDBProvider));
  expect(loaded.epoch).toBe(2);
  expect([hash('b'), hash('c')]).toContain(loaded.commitHash);
});

test('fails closed when encrypted state or bound metadata is tampered', async () => {
  const indexedDBProvider = new IDBFactory();
  await saveMlsGroupState({
    groupId: 'group-a', deviceId: 'device-a', epoch: 1,
    commitHash: hash('a'), state: state('epoch one'),
  }, options(indexedDBProvider));
  const database = await openRawDatabase(indexedDBProvider);
  const transaction = database.transaction(MLS_GROUP_STATE_STORE, 'readwrite');
  const store = transaction.objectStore(MLS_GROUP_STATE_STORE);
  const record = await requestResult(store.get(JSON.stringify(['device-a', 'group-a'])));
  record.ciphertext = record.ciphertext.slice();
  record.ciphertext[0] ^= 1;
  await requestResult(store.put(record));
  database.close();
  await expect(loadMlsGroupState('group-a', 'device-a', options(indexedDBProvider)))
    .rejects.toThrow(/authentication failed/i);
});

test('wipes every group and the non-exportable key for a revoked device', async () => {
  const indexedDBProvider = new IDBFactory();
  await Promise.all(['group-a', 'group-b'].map((groupId, index) => saveMlsGroupState({
    groupId, deviceId: 'device-a', epoch: 1,
    commitHash: hash(index ? 'b' : 'a'), state: state(groupId),
  }, options(indexedDBProvider))));
  await saveMlsGroupState({
    groupId: 'group-c', deviceId: 'device-b', epoch: 1,
    commitHash: hash('c'), state: state('other device'),
  }, options(indexedDBProvider));
  await wipeMlsDeviceState('device-a', indexedDBProvider);
  await expect(loadMlsGroupState('group-a', 'device-a', options(indexedDBProvider))).resolves.toBeNull();
  await expect(loadMlsGroupState('group-b', 'device-a', options(indexedDBProvider))).resolves.toBeNull();
  await expect(loadMlsGroupState('group-c', 'device-b', options(indexedDBProvider)))
    .resolves.toMatchObject({ epoch: 1 });
});
