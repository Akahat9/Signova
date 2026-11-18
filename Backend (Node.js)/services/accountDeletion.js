const { readJson, sendJson } = require('./aiClient');
const { getFirebaseAdmin, verifyFirebaseRequest } = require('./firebaseAdmin');
const { cleanupMongoAccountData } = require('./mongoAccountDeletion');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

const DEFAULT_RECENT_AUTH_SECONDS = 10 * 60;
const IDENTITY_COLLECTION = 'privateAuthIdentities';

function requireRecentAuthentication(token, nowSeconds = Math.floor(Date.now() / 1000), maximumAgeSeconds = DEFAULT_RECENT_AUTH_SECONDS) {
  const authTime = Number(token?.auth_time || 0);
  if (!Number.isFinite(authTime) || authTime <= 0 || nowSeconds - authTime > maximumAgeSeconds) {
    const error = new Error('Recent sign-in is required before deleting this account');
    error.statusCode = 401;
    throw error;
  }
}

function requireDeletionConfirmation(payload = {}) {
  if (payload.confirm !== 'DELETE') {
    const error = new Error('Type DELETE to confirm account deletion');
    error.statusCode = 400;
    throw error;
  }
}

async function deleteSnapshotRefs(snapshot, deleteRef) {
  const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
  let deleted = 0;
  for (const item of docs) {
    await deleteRef(item.ref);
    deleted += 1;
  }
  return deleted;
}

async function deleteStoragePrefix(bucket, prefix) {
  const [files = []] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((file) => file.delete()));
  return files.length;
}

async function deleteAccountData({
  uid,
  admin = getFirebaseAdmin(),
  bucketName = process.env.FIREBASE_STORAGE_BUCKET || undefined,
  cleanupMongo = cleanupMongoAccountData,
} = {}) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(String(uid || ''))) throw new Error('Invalid account owner');
  const firestore = admin.firestore();
  const auth = admin.auth();
  const bucket = admin.storage().bucket(bucketName);
  const summary = {
    firestoreRoots: 0,
    firestoreDocuments: 0,
    identityMappings: 0,
    mongo: null,
    storageObjects: 0,
    authUserDeleted: false,
  };

  const recursiveDelete = async (ref) => {
    await firestore.recursiveDelete(ref);
    summary.firestoreRoots += 1;
  };
  const deleteRef = async (ref) => {
    await ref.delete();
    summary.firestoreDocuments += 1;
  };

  const chatSnapshot = await firestore.collection('chats').where('memberIds', 'array-contains', uid).get();
  const callSnapshot = await firestore.collection('callRooms').where('participantUids', 'array-contains', uid).get();
  const postSnapshot = await firestore.collection('publicCommunityPosts').where('authorUid', '==', uid).get();
  const identitySnapshot = await firestore.collection(IDENTITY_COLLECTION).where('uid', '==', uid).get();

  await recursiveDelete(firestore.collection('users').doc(uid));
  await recursiveDelete(firestore.collection('e2eeDeviceDirectories').doc(uid));
  await recursiveDelete(firestore.collection('mlsKeyPackageDirectories').doc(uid));
  for (const item of chatSnapshot.docs || []) await recursiveDelete(item.ref);
  for (const item of callSnapshot.docs || []) await recursiveDelete(item.ref);
  for (const item of postSnapshot.docs || []) await recursiveDelete(item.ref);
  summary.identityMappings = await deleteSnapshotRefs(identitySnapshot, deleteRef);
  summary.mongo = await cleanupMongo({ uid });

  summary.storageObjects += await deleteStoragePrefix(bucket, `users/${uid}/`);
  summary.storageObjects += await deleteStoragePrefix(bucket, `community/${uid}/`);
  for (const item of chatSnapshot.docs || []) {
    summary.storageObjects += await deleteStoragePrefix(bucket, `encryptedChatAttachments/${item.id}/${uid}/`);
  }

  await auth.deleteUser(uid);
  summary.authUserDeleted = true;
  return summary;
}

async function handleDeleteAccountWithDependencies(req, res, dependencies = {}) {
  try {
    const verify = dependencies.verifyFirebaseRequest || verifyFirebaseRequest;
    const readBody = dependencies.readJson || readJson;
    const removeAccount = dependencies.deleteAccountData || deleteAccountData;
    const rateLimit = dependencies.enforceRateLimit || enforceRateLimit;
    const token = await verify(req, { requireVerifiedEmail: true, checkRevoked: true });
    rateLimit(req, token.uid, {
      scope: 'account-delete',
      maximum: 3,
      windowMs: 60 * 60 * 1000,
    });
    requireRecentAuthentication(token, dependencies.nowSeconds?.(), dependencies.maximumAgeSeconds);
    requireDeletionConfirmation(await readBody(req));
    const summary = await removeAccount({ uid: token.uid });
    sendJson(res, 200, { deleted: true, summary });
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

async function handleDeleteAccount(req, res) {
  return handleDeleteAccountWithDependencies(req, res);
}

module.exports = {
  DEFAULT_RECENT_AUTH_SECONDS,
  deleteAccountData,
  handleDeleteAccount,
  handleDeleteAccountWithDependencies,
  requireDeletionConfirmation,
  requireRecentAuthentication,
};
