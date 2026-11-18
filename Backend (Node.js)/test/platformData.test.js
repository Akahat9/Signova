const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  buildModerationCase,
  handleCommunityPostReportWithDependencies,
} = require('../services/platformData');

function responseRecorder() {
  let resolve;
  const completed = new Promise((done) => { resolve = done; });
  return {
    response: {
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(body) {
        resolve({ statusCode: this.statusCode, body: JSON.parse(body) });
      },
    },
    completed,
  };
}

async function invokeReport({ payload, postExists = true, savedModerationId = 'moderation-stable', authError } = {}) {
  const writes = [];
  const recorder = responseRecorder();
  await handleCommunityPostReportWithDependencies({}, recorder.response, {
    verifyFirebaseRequest: async () => {
      if (authError) throw authError;
      return { uid: 'reporter-a', email_verified: true };
    },
    readJson: async () => payload || { postId: 'post-a', category: 'spam', reason: 'Repeated promotion' },
    assertCommunityPostExists: async (postId) => {
      assert.equal(postId, 'post-a');
      if (!postExists) {
        const error = new Error('Community post not found');
        error.statusCode = 404;
        throw error;
      }
    },
    getMongoDatabase: async () => ({
      collection(name) {
        assert.equal(name, 'communityPostModeration');
        return {
          async findOneAndUpdate(filter, update, options) {
            writes.push({ filter, update, options });
            return { moderationId: savedModerationId };
          },
        };
      },
    }),
  });
  return { result: await recorder.completed, writes };
}

test('builds a retention-controlled moderation record referencing a Firestore post', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const record = buildModerationCase({ postId: 'post-a', category: 'spam', reason: 'Repeated promotion' }, 'reporter-a', now);

  assert.equal(record.postId, 'post-a');
  assert.equal(record.reporterUid, 'reporter-a');
  assert.equal(record.source, 'firestore-publicCommunityPosts');
  assert.equal(record.status, 'open');
  assert.ok(record.expiresAt > now);
});

test('rejects invalid moderation categories', () => {
  assert.throws(
    () => buildModerationCase({ postId: 'post-a', category: 'anything', reason: 'reason' }, 'reporter-a'),
    /valid category/,
  );
});

test('authenticated reports verify the Firebase post and upsert one Mongo moderation record', async () => {
  const { result, writes } = await invokeReport();
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, { reported: true, moderationId: 'moderation-stable' });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].filter, { postId: 'post-a', reporterUid: 'reporter-a' });
  assert.equal(writes[0].options.upsert, true);
  assert.equal(writes[0].options.returnDocument, 'after');
  assert.equal(writes[0].update.$set.source, 'firestore-publicCommunityPosts');
});

test('nonexistent Firestore posts never create MongoDB moderation records', async () => {
  const { result, writes } = await invokeReport({ postExists: false });
  assert.equal(result.statusCode, 404);
  assert.match(result.body.error, /not found/i);
  assert.equal(writes.length, 0);
});

test('authentication failures never reach Firebase post lookup or MongoDB', async () => {
  const error = new Error('Authentication is required');
  error.statusCode = 401;
  const { result, writes } = await invokeReport({ authError: error });
  assert.equal(result.statusCode, 401);
  assert.equal(writes.length, 0);
});
