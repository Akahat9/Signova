const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  UID_PREFIX,
  assertValidationUid,
  main,
  requireApplyGuard,
  validationUid,
  verifyMongoRetention,
} = require('../scripts/validateAccountDeletion');
const { anonymizedDeletedUserRef } = require('../services/mongoAccountDeletion');

test('account deletion validation refuses non-synthetic account ids', () => {
  assert.doesNotThrow(() => assertValidationUid(`${UID_PREFIX}abc`));
  assert.throws(() => assertValidationUid('real-user'), /Refusing/);
});

test('apply mode requires an explicit environment guard', () => {
  assert.equal(requireApplyGuard({ argv: ['node', 'script'], env: {} }), false);
  assert.throws(
    () => requireApplyGuard({ argv: ['node', 'script', '--apply'], env: {} }),
    /SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION/,
  );
  assert.equal(requireApplyGuard({
    argv: ['node', 'script', '--apply'],
    env: { SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION: 'true' },
  }), true);
});

test('dry-run returns the synthetic uid without creating data', async () => {
  const result = await main({
    argv: ['node', 'script'],
    env: { SIGNOVA_ACCOUNT_DELETION_VALIDATION_UID: `${UID_PREFIX}dry-run` },
  });
  assert.deepEqual(result, { applied: false, uid: `${UID_PREFIX}dry-run` });
  assert.match(validationUid(), new RegExp(`^${UID_PREFIX}`));
});

test('Mongo retention verifier detects deleted/anonymized validation state', async () => {
  const uid = `${UID_PREFIX}mongo`;
  const deletedRef = anonymizedDeletedUserRef(uid);
  const counts = new Map([
    ['aiFeedback:firebaseUid', 0],
    ['communityPresence:userId', 0],
    ['communityInstalls:userId', 0],
    ['communitySigns:creatorUid:raw', 0],
    ['communitySigns:creatorUid:deleted', 1],
    ['communityPostModeration:reporterUid:raw', 0],
    ['communityPostModeration:reporterUid:deleted', 1],
  ]);
  const database = {
    collection(name) {
      return {
        async countDocuments(filter) {
          if (name === 'communitySigns' && filter.creatorUid === uid) return counts.get('communitySigns:creatorUid:raw');
          if (name === 'communitySigns' && filter.creatorUid === deletedRef) return counts.get('communitySigns:creatorUid:deleted');
          if (name === 'communityPostModeration' && filter.reporterUid === uid) return counts.get('communityPostModeration:reporterUid:raw');
          if (name === 'communityPostModeration' && filter.reporterUid === deletedRef) return counts.get('communityPostModeration:reporterUid:deleted');
          const [field] = Object.keys(filter);
          return counts.get(`${name}:${field}`) || 0;
        },
      };
    },
  };
  await assert.doesNotReject(verifyMongoRetention({ database, uid }));
});

test('Mongo retention verifier fails when raw records remain', async () => {
  const uid = `${UID_PREFIX}mongo-fail`;
  const database = {
    collection() {
      return {
        async countDocuments() {
          return 1;
        },
      };
    },
  };
  await assert.rejects(verifyMongoRetention({ database, uid }), /raw account-owned records remain/);
});
