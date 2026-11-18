const crypto = require('crypto');
const { getMongoDatabase } = require('./mongoClient');

function anonymizedDeletedUserRef(uid, salt = process.env.SIGNOVA_ACCOUNT_DELETION_SALT || process.env.SIGNOVA_IDENTITY_HMAC_SECRET || '') {
  const secret = String(salt || '');
  const hash = secret.length >= 16
    ? crypto.createHmac('sha256', secret).update(String(uid)).digest('hex')
    : crypto.createHash('sha256').update(String(uid)).digest('hex');
  return `deleted-user:${hash.slice(0, 24)}`;
}

function deletedAccountModerationReason() {
  return 'Reporter account was deleted; original free-text reason was removed by account-deletion retention policy.';
}

async function cleanupMongoAccountData({
  uid,
  database,
  openMongo = getMongoDatabase,
  now = new Date(),
} = {}) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(String(uid || ''))) throw new Error('Invalid Mongo account owner');
  const db = database || await openMongo();
  const deletedRef = anonymizedDeletedUserRef(uid);

  const [
    feedback,
    presence,
    installs,
    signs,
    reports,
  ] = await Promise.all([
    db.collection('aiFeedback').deleteMany({ firebaseUid: uid }),
    db.collection('communityPresence').deleteMany({ userId: uid }),
    db.collection('communityInstalls').deleteMany({ userId: uid }),
    db.collection('communitySigns').updateMany(
      { creatorUid: uid },
      {
        $set: {
          creatorUid: deletedRef,
          creatorDeleted: true,
          trainingConsent: false,
          status: 'archived',
          visibility: 'private',
          updatedAt: now,
          deletionRetainedFor: 'non-public catalogue integrity',
        },
      },
    ),
    db.collection('communityPostModeration').updateMany(
      { reporterUid: uid },
      {
        $set: {
          reporterUid: deletedRef,
          reporterDeleted: true,
          reason: deletedAccountModerationReason(),
          updatedAt: now,
        },
      },
    ),
  ]);

  return {
    aiFeedbackDeleted: feedback.deletedCount || 0,
    communityPresenceDeleted: presence.deletedCount || 0,
    communityInstallsDeleted: installs.deletedCount || 0,
    communitySignsArchived: signs.modifiedCount || 0,
    moderationReportsAnonymized: reports.modifiedCount || 0,
  };
}

module.exports = {
  anonymizedDeletedUserRef,
  cleanupMongoAccountData,
  deletedAccountModerationReason,
};
