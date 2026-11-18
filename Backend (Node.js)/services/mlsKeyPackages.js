const crypto = require('crypto');
const { readJson, sendJson } = require('./aiClient');
const { getFirebaseAdmin, verifyFirebaseRequest } = require('./firebaseAdmin');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

const COLLECTION_GROUP = 'mlsKeyPackages';
const MAX_PACKAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function requireId(value, name) {
  const clean = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(clean)) {
    const error = new Error(`${name} is invalid`);
    error.statusCode = 400;
    throw error;
  }
  return clean;
}

function validatePublishedKeyPackage(record, nowMs = Date.now()) {
  const ownerUid = requireId(record?.ownerUid, 'ownerUid');
  const deviceId = requireId(record?.deviceId, 'deviceId');
  const packageId = requireId(record?.packageId, 'packageId');
  const encoded = String(record?.keyPackageBase64 || '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length < 64 || encoded.length > 65536) {
    throw Object.assign(new Error('keyPackageBase64 is invalid'), { statusCode: 400 });
  }
  const expiresAtMs = Number(record?.expiresAtMs);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs + 60_000 || expiresAtMs > nowMs + MAX_PACKAGE_AGE_MS) {
    throw Object.assign(new Error('KeyPackage expiry is outside the allowed window'), { statusCode: 400 });
  }
  if (record.protocol !== 'MLS10' || record.ciphersuite !== 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519') {
    throw Object.assign(new Error('Unsupported MLS protocol or ciphersuite'), { statusCode: 400 });
  }
  return { ownerUid, deviceId, packageId, encoded, expiresAtMs };
}

async function claimMlsKeyPackages({ db, targetUid, claimantUid, conversationId, nowMs = Date.now(), dependencies = {} }) {
  const target = requireId(targetUid, 'targetUid');
  const claimant = requireId(claimantUid, 'claimantUid');
  const conversation = requireId(conversationId, 'conversationId');
  if (target === claimant) throw Object.assign(new Error('Cannot claim your own KeyPackage'), { statusCode: 400 });
  const makePackageQuery = dependencies.makePackageQuery || ((database) => database.collectionGroup(COLLECTION_GROUP)
    .where('ownerUid', '==', target)
    .where('status', '==', 'available')
    .where('expiresAtMs', '>', nowMs)
    .orderBy('expiresAtMs', 'asc')
    .limit(100));
  const makeDeviceQuery = dependencies.makeDeviceQuery || ((database) => database
    .collection('e2eeDeviceDirectories').doc(target).collection('devices').where('status', '==', 'active').limit(17));
  const makeConversationRef = dependencies.makeConversationRef || ((database) => database.collection('chats').doc(conversation));
  const claimedAt = dependencies.timestamp || (() => new Date(nowMs));

  return db.runTransaction(async (transaction) => {
    const [conversationSnapshot, deviceSnapshot, packageSnapshot] = await Promise.all([
      transaction.get(makeConversationRef(db)),
      transaction.get(makeDeviceQuery(db)),
      transaction.get(makePackageQuery(db)),
    ]);
    const members = conversationSnapshot.exists ? conversationSnapshot.data()?.memberIds : [];
    if (!Array.isArray(members) || !members.includes(claimant) || !members.includes(target)) {
      throw Object.assign(new Error('Both users must be members of the conversation'), { statusCode: 403 });
    }
    const activeDeviceIds = [...new Set(deviceSnapshot.docs.map((item) => String(item.id || item.data()?.deviceId || '')).filter(Boolean))];
    if (!activeDeviceIds.length) throw Object.assign(new Error('Recipient has no active verified devices'), { statusCode: 409 });
    if (activeDeviceIds.length > 16) throw Object.assign(new Error('Recipient device count exceeds the supported limit'), { statusCode: 409 });

    const candidatesByDevice = new Map();
    for (const item of packageSnapshot.docs) {
      try {
        const validated = validatePublishedKeyPackage(item.data(), nowMs);
        if (activeDeviceIds.includes(validated.deviceId) && !candidatesByDevice.has(validated.deviceId)) candidatesByDevice.set(validated.deviceId, item);
      } catch {
        // Invalid or stale records are never returned or consumed.
      }
    }
    const missingDeviceIds = activeDeviceIds.filter((deviceId) => !candidatesByDevice.has(deviceId));
    if (missingDeviceIds.length) return { packages: [], missingDeviceIds };

    const claimId = crypto.randomUUID();
    const packages = [];
    for (const deviceId of activeDeviceIds) {
      const candidate = candidatesByDevice.get(deviceId);
      const record = candidate.data();
      transaction.update(candidate.ref, { status: 'claimed', claimedBy: claimant, claimedAt: claimedAt(), claimId, conversationId: conversation });
      packages.push({
        ownerUid: record.ownerUid, deviceId: record.deviceId, packageId: record.packageId,
        protocol: record.protocol, ciphersuite: record.ciphersuite,
        keyPackageBase64: record.keyPackageBase64, credentialFingerprint: record.credentialFingerprint,
        expiresAtMs: record.expiresAtMs,
      });
    }
    return { packages, missingDeviceIds: [] };
  });
}

async function handleClaimMlsKeyPackage(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    enforceRateLimit(req, token.uid, { scope: 'mls-key-package-claim', maximum: 60 });
    const payload = await readJson(req);
    const admin = getFirebaseAdmin();
    const result = await claimMlsKeyPackages({
      db: admin.firestore(), targetUid: payload.targetUid, claimantUid: token.uid, conversationId: payload.conversationId,
    });
    if (result.missingDeviceIds.length) return sendJson(res, 409, { error: 'A KeyPackage is not available for every active recipient device', missingDeviceIds: result.missingDeviceIds });
    return sendJson(res, 200, { keyPackages: result.packages });
  } catch (error) {
    return sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = { claimMlsKeyPackages, handleClaimMlsKeyPackage, validatePublishedKeyPackage };
