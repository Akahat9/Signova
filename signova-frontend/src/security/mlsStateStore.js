const DATABASE_NAME = 'signova-mls-state';
const DATABASE_VERSION = 1;
const KEY_STORE = 'stateKeys';
const GROUP_STORE = 'groupStates';
const MAX_STATE_BYTES = 5 * 1024 * 1024;
const encoder = new TextEncoder();

function identifier(value, field) {
  const clean = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(clean)) throw new Error(`Invalid ${field}`);
  return clean;
}

function validateHash(value, field, allowEmpty = false) {
  const clean = String(value || '');
  if (allowEmpty && !clean) return '';
  if (!/^[a-f0-9]{64}$/.test(clean)) throw new Error(`Invalid ${field}`);
  return clean;
}

function stateKey(deviceId, groupId) {
  return JSON.stringify([deviceId, groupId]);
}

function metadataAad(metadata) {
  return encoder.encode(JSON.stringify({
    version: 1,
    groupId: metadata.groupId,
    deviceId: metadata.deviceId,
    epoch: metadata.epoch,
    commitHash: metadata.commitHash,
    parentCommitHash: metadata.parentCommitHash,
    stateSha256: metadata.stateSha256,
  }));
}

function bytes(input) {
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new Error('MLS state must be an ArrayBuffer or typed array');
}

function hex(value) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function openDatabase(indexedDBProvider = window.indexedDB) {
  if (!indexedDBProvider) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_STORE)) {
        request.result.createObjectStore(KEY_STORE, { keyPath: 'deviceId' });
      }
      if (!request.result.objectStoreNames.contains(GROUP_STORE)) {
        const store = request.result.createObjectStore(GROUP_STORE, { keyPath: 'key' });
        store.createIndex('deviceId', 'deviceId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('MLS state database could not be opened'));
  });
}

function requestResult(request, fallback) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(fallback));
  });
}

function transactionComplete(transaction, fallback) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error(fallback));
    transaction.onabort = () => reject(transaction.error || new Error(fallback));
  });
}

async function getOrCreateStateKey(deviceId, indexedDBProvider, cryptoProvider) {
  const candidate = await cryptoProvider.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const database = await openDatabase(indexedDBProvider);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(KEY_STORE, 'readwrite');
      const store = transaction.objectStore(KEY_STORE);
      let selectedKey;
      const read = store.get(deviceId);
      read.onerror = () => reject(read.error || new Error('MLS state key could not be read'));
      read.onsuccess = () => {
        selectedKey = read.result?.key || candidate;
        if (!read.result) store.put({ deviceId, key: selectedKey, version: 1, createdAt: Date.now() });
      };
      transaction.oncomplete = () => resolve(selectedKey);
      transaction.onerror = () => reject(transaction.error || new Error('MLS state key transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('MLS state key transaction aborted'));
    });
  } finally {
    database.close();
  }
}

export async function saveMlsGroupState({
  groupId,
  deviceId,
  epoch,
  commitHash,
  parentCommitHash = '',
  state,
}, { indexedDBProvider = window.indexedDB, cryptoProvider = window.crypto } = {}) {
  const group = identifier(groupId, 'groupId');
  const device = identifier(deviceId, 'deviceId');
  if (!Number.isSafeInteger(epoch) || epoch < 1) throw new Error('Invalid MLS epoch');
  const commit = validateHash(commitHash, 'commitHash');
  const parent = validateHash(parentCommitHash, 'parentCommitHash', true);
  const plaintext = bytes(state);
  if (!plaintext.byteLength || plaintext.byteLength > MAX_STATE_BYTES) throw new Error('MLS state size is outside policy');
  const key = await getOrCreateStateKey(device, indexedDBProvider, cryptoProvider);
  const stateSha256 = hex(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', plaintext)));
  const metadata = { groupId: group, deviceId: device, epoch, commitHash: commit, parentCommitHash: parent, stateSha256 };
  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: metadataAad(metadata), tagLength: 128 },
    key,
    plaintext,
  ));
  const database = await openDatabase(indexedDBProvider);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(GROUP_STORE, 'readwrite');
      const store = transaction.objectStore(GROUP_STORE);
      const id = stateKey(device, group);
      let accepted = false;
      const read = store.get(id);
      read.onerror = () => reject(read.error || new Error('MLS group state could not be read'));
      read.onsuccess = () => {
        const current = read.result;
        const expectedEpoch = current ? current.epoch + 1 : 1;
        const expectedParent = current ? current.commitHash : '';
        if (epoch !== expectedEpoch || parent !== expectedParent) {
          transaction.abort();
          reject(new Error('MLS epoch rollback, skip, or fork rejected'));
          return;
        }
        accepted = true;
        store.put({ key: id, ...metadata, iv, ciphertext, updatedAt: Date.now(), version: 1 });
      };
      transaction.oncomplete = () => resolve({ epoch, commitHash: commit, accepted });
      transaction.onerror = () => reject(transaction.error || new Error('MLS group state transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('MLS group state transaction aborted'));
    });
  } finally {
    database.close();
  }
}

export async function loadMlsGroupState(groupId, deviceId, {
  indexedDBProvider = window.indexedDB,
  cryptoProvider = window.crypto,
} = {}) {
  const group = identifier(groupId, 'groupId');
  const device = identifier(deviceId, 'deviceId');
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction([KEY_STORE, GROUP_STORE], 'readonly');
    const [keyRecord, record] = await Promise.all([
      requestResult(transaction.objectStore(KEY_STORE).get(device), 'MLS state key could not be read'),
      requestResult(transaction.objectStore(GROUP_STORE).get(stateKey(device, group)), 'MLS group state could not be read'),
    ]);
    if (!record) return null;
    if (!keyRecord?.key) throw new Error('MLS state key is missing; recovery or rejoin is required');
    const metadata = {
      groupId: record.groupId,
      deviceId: record.deviceId,
      epoch: record.epoch,
      commitHash: record.commitHash,
      parentCommitHash: record.parentCommitHash,
      stateSha256: record.stateSha256,
    };
    let plaintext;
    try {
      plaintext = new Uint8Array(await cryptoProvider.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv, additionalData: metadataAad(metadata), tagLength: 128 },
        keyRecord.key,
        record.ciphertext,
      ));
    } catch {
      throw new Error('MLS state authentication failed; recovery or rejoin is required');
    }
    const digest = hex(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', plaintext)));
    if (digest !== record.stateSha256) throw new Error('MLS state checksum mismatch');
    return { ...metadata, state: plaintext };
  } finally {
    database.close();
  }
}

export async function wipeMlsDeviceState(deviceId, indexedDBProvider = window.indexedDB) {
  const device = identifier(deviceId, 'deviceId');
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction([KEY_STORE, GROUP_STORE], 'readwrite');
    const groupStore = transaction.objectStore(GROUP_STORE);
    const cursor = groupStore.index('deviceId').openCursor();
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      if (cursor.result.value?.deviceId === device) cursor.result.delete();
      cursor.result.continue();
    };
    transaction.objectStore(KEY_STORE).delete(device);
    await transactionComplete(transaction, 'MLS device state wipe failed');
  } finally {
    database.close();
  }
}

export { DATABASE_NAME as MLS_STATE_DATABASE_NAME, GROUP_STORE as MLS_GROUP_STATE_STORE, KEY_STORE as MLS_STATE_KEY_STORE, MAX_STATE_BYTES as MAX_MLS_STATE_BYTES };
