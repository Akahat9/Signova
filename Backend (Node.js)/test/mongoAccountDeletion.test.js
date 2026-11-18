const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  anonymizedDeletedUserRef,
  cleanupMongoAccountData,
  deletedAccountModerationReason,
} = require('../services/mongoAccountDeletion');

function fakeCollection(name, calls) {
  return {
    async deleteMany(filter) {
      calls.push({ collection: name, operation: 'deleteMany', filter });
      return { deletedCount: name === 'aiFeedback' ? 2 : 1 };
    },
    async updateMany(filter, update) {
      calls.push({ collection: name, operation: 'updateMany', filter, update });
      return { modifiedCount: name === 'communitySigns' ? 3 : 4 };
    },
  };
}

test('creates a stable non-raw deleted-user reference', () => {
  const first = anonymizedDeletedUserRef('user-a', 'salt-that-is-long-enough');
  const second = anonymizedDeletedUserRef('user-a', 'salt-that-is-long-enough');
  assert.equal(first, second);
  assert.match(first, /^deleted-user:[a-f0-9]{24}$/);
  assert.equal(first.includes('user-a'), false);
});

test('deletes personal Mongo records and anonymizes retained moderation/catalogue records', async () => {
  const calls = [];
  const database = { collection: (name) => fakeCollection(name, calls) };
  const now = new Date('2026-01-01T00:00:00.000Z');
  const summary = await cleanupMongoAccountData({ uid: 'user-a', database, now });

  assert.deepEqual(summary, {
    aiFeedbackDeleted: 2,
    communityPresenceDeleted: 1,
    communityInstallsDeleted: 1,
    communitySignsArchived: 3,
    moderationReportsAnonymized: 4,
  });
  assert.deepEqual(
    calls.filter((call) => call.operation === 'deleteMany').map((call) => [call.collection, call.filter]),
    [
      ['aiFeedback', { firebaseUid: 'user-a' }],
      ['communityPresence', { userId: 'user-a' }],
      ['communityInstalls', { userId: 'user-a' }],
    ],
  );
  const signUpdate = calls.find((call) => call.collection === 'communitySigns');
  assert.equal(signUpdate.update.$set.status, 'archived');
  assert.equal(signUpdate.update.$set.visibility, 'private');
  assert.equal(signUpdate.update.$set.trainingConsent, false);
  assert.match(signUpdate.update.$set.creatorUid, /^deleted-user:/);

  const moderationUpdate = calls.find((call) => call.collection === 'communityPostModeration');
  assert.match(moderationUpdate.update.$set.reporterUid, /^deleted-user:/);
  assert.equal(moderationUpdate.update.$set.reason, deletedAccountModerationReason());
});
