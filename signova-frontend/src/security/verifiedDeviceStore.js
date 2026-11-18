import { verifyDeviceVerificationPayload } from './deviceVerification';
import { verifySignedDevicePublicBundle } from './e2eePrimitives';

const DATABASE_NAME = 'signova-e2ee-verified-devices';
const DATABASE_VERSION = 1;
const STORE_NAME = 'verifiedDevices';

function openDatabase(indexedDBProvider = window.indexedDB) {
  if (!indexedDBProvider) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Verified-device database could not be opened'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Verified-device operation failed'));
  });
}

function identity(localUserId, localDeviceId, remoteUserId, remoteDeviceId) {
  const values = [localUserId, localDeviceId, remoteUserId, remoteDeviceId].map((value) => String(value || '').trim());
  if (values.some((value) => !value)) throw new Error('Complete local and remote device identities are required');
  return { values, key: JSON.stringify(values) };
}

export async function recordVerifiedDevice(params, options = {}) {
  const { localUserId, localDeviceId, remoteUserId, remoteBundle, verification, payload } = params;
  const { values, key } = identity(localUserId, localDeviceId, remoteUserId, remoteBundle?.deviceId);
  const cryptoProvider = options.cryptoProvider || window.crypto;
  if (!await verifySignedDevicePublicBundle(remoteBundle, cryptoProvider)) throw new Error('Remote signed device bundle is invalid');
  if (!verifyDeviceVerificationPayload(payload, verification)) throw new Error('Safety-number verification payload does not match');
  const participant = verification.participants.find((item) => item.userId === remoteUserId && item.deviceId === remoteBundle.deviceId);
  if (!participant || participant.fingerprint !== remoteBundle.fingerprint) throw new Error('Verified fingerprint does not match the remote device');
  const record = {
    key,
    localUserId: values[0],
    localDeviceId: values[1],
    remoteUserId: values[2],
    remoteDeviceId: values[3],
    fingerprint: remoteBundle.fingerprint,
    safetyNumber: verification.safetyNumber,
    status: 'verified',
    verifiedAt: Date.now(),
    revokedAt: null,
  };
  const database = await openDatabase(options.indexedDBProvider || window.indexedDB);
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).put(record));
    return record;
  } finally {
    database.close();
  }
}

export async function getDeviceTrust(localUserId, localDeviceId, remoteUserId, remoteBundle, options = {}) {
  const { key } = identity(localUserId, localDeviceId, remoteUserId, remoteBundle?.deviceId);
  if (!await verifySignedDevicePublicBundle(remoteBundle, options.cryptoProvider || window.crypto)) {
    return { status: 'invalid' };
  }
  const database = await openDatabase(options.indexedDBProvider || window.indexedDB);
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(key));
    if (!record) return { status: 'unverified' };
    if (record.status === 'revoked') return { status: 'revoked', record };
    if (record.fingerprint !== remoteBundle.fingerprint) return { status: 'changed', record };
    return { status: 'verified', record };
  } finally {
    database.close();
  }
}

export async function revokeVerifiedDevice(localUserId, localDeviceId, remoteUserId, remoteDeviceId, options = {}) {
  const { key } = identity(localUserId, localDeviceId, remoteUserId, remoteDeviceId);
  const database = await openDatabase(options.indexedDBProvider || window.indexedDB);
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestResult(store.get(key));
    if (!record) return false;
    await requestResult(store.put({ ...record, status: 'revoked', revokedAt: Date.now() }));
    return true;
  } finally {
    database.close();
  }
}
