import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

export const MLS_CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
const MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function requireId(value, name) {
  const clean = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(clean)) throw new Error(`${name} is invalid`);
  return clean;
}

export function buildMlsKeyPackageRecord({ ownerUid, deviceId, packageId, keyPackageBase64, credentialFingerprint, expiresAtMs }, dependencies = {}) {
  const nowMs = (dependencies.now || Date.now)();
  const timestamp = dependencies.serverTimestamp || serverTimestamp;
  const encoded = String(keyPackageBase64 || '');
  const fingerprint = String(credentialFingerprint || '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length < 64 || encoded.length > 65536) throw new Error('keyPackageBase64 is invalid');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fingerprint) || fingerprint.length < 32 || fingerprint.length > 128) throw new Error('credentialFingerprint is invalid');
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs + 60_000 || expiresAtMs > nowMs + MAX_LIFETIME_MS) throw new Error('KeyPackage expiry is outside the allowed window');
  return {
    ownerUid: requireId(ownerUid, 'ownerUid'), deviceId: requireId(deviceId, 'deviceId'), packageId: requireId(packageId, 'packageId'),
    protocol: 'MLS10', ciphersuite: MLS_CIPHERSUITE, keyPackageBase64: encoded,
    credentialFingerprint: fingerprint, status: 'available', createdAt: timestamp(),
    expiresAtMs, claimedAt: null, claimedBy: null, claimId: null,
  };
}

export async function publishMlsKeyPackage(db, input, dependencies = {}) {
  const makeDoc = dependencies.doc || doc;
  const write = dependencies.setDoc || setDoc;
  const record = buildMlsKeyPackageRecord(input, dependencies);
  const reference = makeDoc(db, 'mlsKeyPackageDirectories', record.ownerUid, 'devices', record.deviceId, 'mlsKeyPackages', record.packageId);
  await write(reference, record);
  return record;
}

