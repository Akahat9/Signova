const DATABASE_NAME = 'signova-e2ee-protocol-state';
const STORE_NAME = 'senderSequences';
const DATABASE_VERSION = 1;

function requireIdentifier(value, field) {
  const clean = String(value || '').trim();
  if (!clean || clean.length > 256) throw new Error(`${field} is required`);
  return clean;
}

function openDatabase(indexedDBProvider = window.indexedDB) {
  if (!indexedDBProvider) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Protocol state database could not be opened'));
  });
}

export async function allocateSenderSequence(conversationId, deviceId, indexedDBProvider = window.indexedDB) {
  const conversation = requireIdentifier(conversationId, 'conversationId');
  const device = requireIdentifier(deviceId, 'deviceId');
  const key = JSON.stringify([conversation, device]);
  const database = await openDatabase(indexedDBProvider);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let allocated;
      const read = store.get(key);
      read.onerror = () => reject(read.error || new Error('Sender sequence could not be read'));
      read.onsuccess = () => {
        const previous = Number(read.result?.sequence || 0);
        if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) {
          transaction.abort();
          reject(new Error('Sender sequence is exhausted or corrupt; rotate the device identity'));
          return;
        }
        allocated = previous + 1;
        store.put({ key, conversationId: conversation, deviceId: device, sequence: allocated, updatedAt: Date.now() });
      };
      transaction.oncomplete = () => resolve(allocated);
      transaction.onerror = () => reject(transaction.error || new Error('Sender sequence allocation failed'));
      transaction.onabort = () => reject(transaction.error || new Error('Sender sequence allocation was aborted'));
    });
  } finally {
    database.close();
  }
}

export async function readSenderSequence(conversationId, deviceId, indexedDBProvider = window.indexedDB) {
  const conversation = requireIdentifier(conversationId, 'conversationId');
  const device = requireIdentifier(deviceId, 'deviceId');
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(JSON.stringify([conversation, device]));
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(Number(request.result?.sequence || 0));
      request.onerror = () => reject(request.error || new Error('Sender sequence could not be read'));
    });
  } finally {
    database.close();
  }
}
