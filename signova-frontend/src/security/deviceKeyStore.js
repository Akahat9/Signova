const DATABASE_NAME = 'signova-secure-device-keys';
const STORE_NAME = 'deviceKeys';
const DATABASE_VERSION = 1;

function openDatabase(indexedDBProvider = window.indexedDB) {
  if (!indexedDBProvider) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'deviceId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Secure key database could not be opened'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Secure key operation failed'));
  });
}

export async function saveDeviceKeyBundle(deviceId, keys, indexedDBProvider = window.indexedDB) {
  if (!deviceId || !keys?.agreement?.privateKey || !keys?.signing?.privateKey) throw new Error('Complete device keys are required');
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).put({
      deviceId,
      agreementPrivateKey: keys.agreement.privateKey,
      agreementPublicKey: keys.agreement.publicKey,
      signingPrivateKey: keys.signing.privateKey,
      signingPublicKey: keys.signing.publicKey,
      createdAt: Date.now(),
      version: 1,
    }));
  } finally {
    database.close();
  }
}

export async function loadDeviceKeyBundle(deviceId, indexedDBProvider = window.indexedDB) {
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(deviceId));
    if (!record) return null;
    return {
      deviceId: record.deviceId,
      createdAt: record.createdAt,
      agreement: { privateKey: record.agreementPrivateKey, publicKey: record.agreementPublicKey },
      signing: { privateKey: record.signingPrivateKey, publicKey: record.signingPublicKey },
    };
  } finally {
    database.close();
  }
}

export async function deleteDeviceKeyBundle(deviceId, indexedDBProvider = window.indexedDB) {
  const database = await openDatabase(indexedDBProvider);
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).delete(deviceId));
  } finally {
    database.close();
  }
}

