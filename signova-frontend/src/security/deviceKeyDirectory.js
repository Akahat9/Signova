import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { verifySignedDevicePublicBundle } from './e2eePrimitives';

const DIRECTORY_COLLECTION = 'e2eeDeviceDirectories';

function requireIdentifier(value, field) {
  const clean = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(clean)) throw new Error(`${field} is invalid`);
  return clean;
}

export async function buildDeviceDirectoryRecord(userId, bundle, dependencies = {}) {
  const verifyBundle = dependencies.verifyBundle || verifySignedDevicePublicBundle;
  const timestamp = dependencies.serverTimestamp || serverTimestamp;
  const ownerUid = requireIdentifier(userId, 'userId');
  const deviceId = requireIdentifier(bundle?.deviceId, 'deviceId');
  if (!await verifyBundle(bundle)) throw new Error('Device public-key bundle is invalid');
  return {
    ownerUid,
    deviceId,
    version: 1,
    agreementPublicKey: bundle.agreementPublicKey,
    signingPublicKey: bundle.signingPublicKey,
    agreementSignature: bundle.agreementSignature,
    fingerprint: bundle.fingerprint,
    status: 'active',
    createdAt: timestamp(),
    updatedAt: timestamp(),
    revokedAt: null,
  };
}

export async function registerDevicePublicBundle(db, userId, bundle, dependencies = {}) {
  const makeDoc = dependencies.doc || doc;
  const write = dependencies.setDoc || setDoc;
  const record = await buildDeviceDirectoryRecord(userId, bundle, dependencies);
  await write(makeDoc(db, DIRECTORY_COLLECTION, record.ownerUid, 'devices', record.deviceId), record);
  return record;
}

export async function revokeDevicePublicBundle(db, userId, deviceId, dependencies = {}) {
  const makeDoc = dependencies.doc || doc;
  const update = dependencies.updateDoc || updateDoc;
  const timestamp = dependencies.serverTimestamp || serverTimestamp;
  const ownerUid = requireIdentifier(userId, 'userId');
  const cleanDeviceId = requireIdentifier(deviceId, 'deviceId');
  const revokedAt = timestamp();
  await update(makeDoc(db, DIRECTORY_COLLECTION, ownerUid, 'devices', cleanDeviceId), {
    status: 'revoked',
    revokedAt,
    updatedAt: revokedAt,
  });
}

export async function listActiveDevicePublicBundles(db, userId, dependencies = {}) {
  const makeCollection = dependencies.collection || collection;
  const makeQuery = dependencies.query || query;
  const makeWhere = dependencies.where || where;
  const read = dependencies.getDocs || getDocs;
  const verifyBundle = dependencies.verifyBundle || verifySignedDevicePublicBundle;
  const ownerUid = requireIdentifier(userId, 'userId');
  const snapshot = await read(makeQuery(
    makeCollection(db, DIRECTORY_COLLECTION, ownerUid, 'devices'),
    makeWhere('status', '==', 'active'),
  ));
  const bundles = [];
  for (const item of snapshot.docs) {
    const record = item.data();
    if (record.ownerUid !== ownerUid || record.deviceId !== item.id || record.status !== 'active') continue;
    const bundle = {
      version: record.version,
      deviceId: record.deviceId,
      agreementPublicKey: record.agreementPublicKey,
      signingPublicKey: record.signingPublicKey,
      agreementSignature: record.agreementSignature,
      fingerprint: record.fingerprint,
    };
    if (await verifyBundle(bundle)) bundles.push(bundle);
  }
  return bundles;
}
