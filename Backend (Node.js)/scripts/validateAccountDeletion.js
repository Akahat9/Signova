require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { deleteAccountData } = require('../services/accountDeletion');
const { anonymizedDeletedUserRef } = require('../services/mongoAccountDeletion');
const { getFirebaseAdmin } = require('../services/firebaseAdmin');
const { getMongoDatabase } = require('../services/mongoClient');

const UID_PREFIX = 'signova-delete-validation-';

function validationUid() {
  return `${UID_PREFIX}${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function requireApplyGuard({ argv = process.argv, env = process.env } = {}) {
  const apply = argv.includes('--apply');
  if (!apply) return false;
  if (env.SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION !== 'true') {
    throw new Error('Set SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION=true before running --apply');
  }
  return true;
}

function assertValidationUid(uid) {
  if (!String(uid || '').startsWith(UID_PREFIX)) {
    throw new Error(`Refusing to validate deletion for non-synthetic uid: ${uid || '<empty>'}`);
  }
}

async function seedFirestoreAndStorage({ admin, uid, now = new Date(), bucketName = process.env.FIREBASE_STORAGE_BUCKET || undefined }) {
  assertValidationUid(uid);
  const firestore = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const chatId = `${uid}-chat`;
  const callId = `${uid}-call`;
  const postId = `${uid}-post`;
  const identityId = `${uid}-identity`;
  const paths = {
    userProfile: `users/${uid}/profile/avatar-validation.txt`,
    community: `community/${uid}/validation-media.txt`,
    encryptedAttachment: `encryptedChatAttachments/${chatId}/${uid}/validation.bin`,
  };

  await Promise.all([
    admin.auth().createUser({ uid, email: `${uid}@example.test`, emailVerified: true }),
    firestore.collection('users').doc(uid).set({ schemaVersion: 'validation', createdAt: now }),
    firestore.collection('users').doc(uid).collection('userPreferences').doc('settings').set({ validation: true }),
    firestore.collection('e2eeDeviceDirectories').doc(uid).collection('devices').doc('device-a').set({ ownerUid: uid }),
    firestore.collection('mlsKeyPackageDirectories').doc(uid).collection('devices').doc('device-a').collection('mlsKeyPackages').doc('package-a').set({ ownerUid: uid }),
    firestore.collection('chats').doc(chatId).set({ memberIds: [uid, 'validation-other'], createdAt: now }),
    firestore.collection('chats').doc(chatId).collection('messages').doc('message-a').set({ senderUid: uid, type: 'text', text: 'validation', createdAt: now }),
    firestore.collection('callRooms').doc(callId).set({ participantUids: [uid, 'validation-other'], callerUid: uid, calleeUid: 'validation-other', createdAt: now }),
    firestore.collection('publicCommunityPosts').doc(postId).set({ authorUid: uid, text: 'validation', createdAt: now }),
    firestore.collection('privateAuthIdentities').doc(identityId).set({ uid, type: 'username', updatedAt: now }),
    bucket.file(paths.userProfile).save(Buffer.from('profile-validation')),
    bucket.file(paths.community).save(Buffer.from('community-validation')),
    bucket.file(paths.encryptedAttachment).save(Buffer.from('encrypted-validation')),
  ]);

  return { chatId, callId, postId, identityId, paths };
}

async function seedMongo({ database, uid, now = new Date() }) {
  assertValidationUid(uid);
  await Promise.all([
    database.collection('aiFeedback').insertOne({ feedbackId: `${uid}-feedback`, firebaseUid: uid, label: 'validation', createdAt: now, expiresAt: new Date(now.getTime() + 86_400_000) }),
    database.collection('communityPresence').updateOne({ userId: uid }, { $set: { userId: uid, lastSeenAt: now, expiresAt: new Date(now.getTime() + 86_400_000) } }, { upsert: true }),
    database.collection('communityInstalls').updateOne({ userId: uid }, { $set: { userId: uid, installedAt: now } }, { upsert: true }),
    database.collection('communitySigns').updateOne({ signId: `${uid}-sign` }, { $set: { signId: `${uid}-sign`, creatorUid: uid, title: 'Validation sign', trainingConsent: true, status: 'draft', visibility: 'community', updatedAt: now } }, { upsert: true }),
    database.collection('communityPostModeration').updateOne({ postId: `${uid}-post`, reporterUid: uid }, { $set: { moderationId: `${uid}-moderation`, postId: `${uid}-post`, reporterUid: uid, reason: 'validation reason', status: 'open', updatedAt: now, expiresAt: new Date(now.getTime() + 86_400_000) } }, { upsert: true }),
  ]);
}

async function assertMissingAuthUser(admin, uid) {
  try {
    await admin.auth().getUser(uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') return;
    throw error;
  }
  throw new Error('Firebase Auth user still exists after deletion');
}

async function verifyFirestoreAndStorageDeleted({ admin, uid, seeded, bucketName = process.env.FIREBASE_STORAGE_BUCKET || undefined }) {
  const firestore = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const refs = [
    firestore.collection('users').doc(uid),
    firestore.collection('e2eeDeviceDirectories').doc(uid),
    firestore.collection('mlsKeyPackageDirectories').doc(uid),
    firestore.collection('chats').doc(seeded.chatId),
    firestore.collection('callRooms').doc(seeded.callId),
    firestore.collection('publicCommunityPosts').doc(seeded.postId),
    firestore.collection('privateAuthIdentities').doc(seeded.identityId),
  ];
  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  const remaining = snapshots.filter((snapshot) => snapshot.exists);
  if (remaining.length) throw new Error(`${remaining.length} Firebase document root(s) still exist after deletion`);

  for (const prefix of [`users/${uid}/`, `community/${uid}/`, `encryptedChatAttachments/${seeded.chatId}/${uid}/`]) {
    const [files] = await bucket.getFiles({ prefix, autoPaginate: false });
    if (files.length > 0) throw new Error(`Storage prefix still contains ${files.length} object(s): ${prefix}`);
  }
}

async function verifyMongoRetention({ database, uid }) {
  const deletedRef = anonymizedDeletedUserRef(uid);
  const [
    feedbackCount,
    presenceCount,
    installCount,
    rawSignCount,
    archivedSignCount,
    rawReportCount,
    anonymizedReportCount,
  ] = await Promise.all([
    database.collection('aiFeedback').countDocuments({ firebaseUid: uid }),
    database.collection('communityPresence').countDocuments({ userId: uid }),
    database.collection('communityInstalls').countDocuments({ userId: uid }),
    database.collection('communitySigns').countDocuments({ creatorUid: uid }),
    database.collection('communitySigns').countDocuments({ creatorUid: deletedRef, creatorDeleted: true, status: 'archived', visibility: 'private', trainingConsent: false }),
    database.collection('communityPostModeration').countDocuments({ reporterUid: uid }),
    database.collection('communityPostModeration').countDocuments({ reporterUid: deletedRef, reporterDeleted: true }),
  ]);
  if (feedbackCount || presenceCount || installCount || rawSignCount || rawReportCount) {
    throw new Error('MongoDB raw account-owned records remain after deletion');
  }
  if (archivedSignCount < 1 || anonymizedReportCount < 1) {
    throw new Error('MongoDB retained records were not anonymized/archived as expected');
  }
}

async function main({ argv = process.argv, env = process.env } = {}) {
  const apply = requireApplyGuard({ argv, env });
  const uid = env.SIGNOVA_ACCOUNT_DELETION_VALIDATION_UID || validationUid();
  assertValidationUid(uid);
  if (!apply) {
    console.log(`Account deletion validation dry-run. Synthetic uid would be: ${uid}`);
    console.log('Run with --apply and SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION=true against staging/emulators to seed, delete, and verify.');
    return { applied: false, uid };
  }

  const admin = getFirebaseAdmin();
  const database = await getMongoDatabase();
  const seeded = await seedFirestoreAndStorage({ admin, uid });
  await seedMongo({ database, uid });
  const summary = await deleteAccountData({ uid, admin });
  await assertMissingAuthUser(admin, uid);
  await verifyFirestoreAndStorageDeleted({ admin, uid, seeded });
  await verifyMongoRetention({ database, uid });
  console.log(`Account deletion validation passed for ${uid}`);
  return { applied: true, uid, summary };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || 'Account deletion validation failed');
    process.exitCode = 1;
  });
}

module.exports = {
  UID_PREFIX,
  assertValidationUid,
  main,
  requireApplyGuard,
  seedFirestoreAndStorage,
  seedMongo,
  validationUid,
  verifyFirestoreAndStorageDeleted,
  verifyMongoRetention,
};
