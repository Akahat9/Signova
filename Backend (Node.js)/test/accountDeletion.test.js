const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  deleteAccountData,
  handleDeleteAccountWithDependencies,
  requireDeletionConfirmation,
  requireRecentAuthentication,
} = require('../services/accountDeletion');

function responseRecorder() {
  let resolve;
  const completed = new Promise((done) => { resolve = done; });
  return {
    response: {
      signovaReq: {},
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

function querySnapshot(collectionName, docs) {
  return {
    docs: docs.map((id) => ({
      id,
      ref: {
        path: `${collectionName}/${id}`,
        async delete() {},
      },
    })),
  };
}

function fakeAdmin({ failStoragePrefix = '' } = {}) {
  const recursiveDeleted = [];
  const deletedFiles = [];
  const deletedUsers = [];
  const queries = {
    chats: querySnapshot('chats', ['chat-a', 'chat-b']),
    callRooms: querySnapshot('callRooms', ['call-a']),
    publicCommunityPosts: querySnapshot('publicCommunityPosts', ['post-a']),
    privateAuthIdentities: querySnapshot('privateAuthIdentities', ['identity-a', 'identity-b']),
  };
  const firestore = {
    collection(name) {
      return {
        doc(id) {
          return { path: `${name}/${id}` };
        },
        where(field, operator, value) {
          return {
            async get() {
              assert.equal(value, 'user-a');
              assert.ok(field === 'memberIds' || field === 'participantUids' || field === 'authorUid' || field === 'uid');
              assert.ok(operator === 'array-contains' || operator === '==');
              return queries[name];
            },
          };
        },
      };
    },
    async recursiveDelete(ref) {
      recursiveDeleted.push(ref.path);
    },
  };
  return {
    recursiveDeleted,
    deletedFiles,
    deletedUsers,
    firestore: () => firestore,
    auth: () => ({
      async deleteUser(uid) {
        deletedUsers.push(uid);
      },
    }),
    storage: () => ({
      bucket: () => ({
        async getFiles({ prefix }) {
          if (prefix === failStoragePrefix) throw new Error('Storage cleanup failed');
          return [[
            {
              async delete() {
                deletedFiles.push(prefix);
              },
            },
          ]];
        },
      }),
    }),
  };
}

test('requires a fresh Firebase authentication time', () => {
  assert.doesNotThrow(() => requireRecentAuthentication({ auth_time: 1000 }, 1200, 300));
  assert.throws(() => requireRecentAuthentication({ auth_time: 1000 }, 1401, 300), /Recent sign-in/);
  assert.throws(() => requireRecentAuthentication({}, 1401, 300), /Recent sign-in/);
});

test('requires an explicit destructive confirmation phrase', () => {
  assert.doesNotThrow(() => requireDeletionConfirmation({ confirm: 'DELETE' }));
  assert.throws(() => requireDeletionConfirmation({ confirm: 'delete' }), /Type DELETE/);
});

test('deletes owned Firestore roots, private identity mappings, Storage prefixes, and Auth user last', async () => {
  const admin = fakeAdmin();
  const result = await deleteAccountData({
    uid: 'user-a',
    admin,
    cleanupMongo: async ({ uid }) => ({ uid, aiFeedbackDeleted: 2 }),
  });

  assert.deepEqual(admin.recursiveDeleted, [
    'users/user-a',
    'e2eeDeviceDirectories/user-a',
    'mlsKeyPackageDirectories/user-a',
    'chats/chat-a',
    'chats/chat-b',
    'callRooms/call-a',
    'publicCommunityPosts/post-a',
  ]);
  assert.equal(result.identityMappings, 2);
  assert.deepEqual(result.mongo, { uid: 'user-a', aiFeedbackDeleted: 2 });
  assert.equal(result.storageObjects, 4);
  assert.deepEqual(admin.deletedUsers, ['user-a']);
  assert.equal(result.authUserDeleted, true);
});

test('does not delete the Firebase Auth user when cleanup fails first', async () => {
  const admin = fakeAdmin({ failStoragePrefix: 'community/user-a/' });

  await assert.rejects(deleteAccountData({
    uid: 'user-a',
    admin,
    cleanupMongo: async () => ({}),
  }), /Storage cleanup failed/);
  assert.deepEqual(admin.deletedUsers, []);
});

test('does not delete the Firebase Auth user when Mongo cleanup fails first', async () => {
  const admin = fakeAdmin();

  await assert.rejects(deleteAccountData({
    uid: 'user-a',
    admin,
    cleanupMongo: async () => {
      throw new Error('Mongo retention cleanup failed');
    },
  }), /Mongo retention cleanup failed/);
  assert.deepEqual(admin.deletedUsers, []);
});

test('route rejects stale sessions before destructive cleanup', async () => {
  const recorder = responseRecorder();
  let cleanupCalled = false;
  await handleDeleteAccountWithDependencies({}, recorder.response, {
    verifyFirebaseRequest: async () => ({ uid: 'user-a', email_verified: true, auth_time: 1000 }),
    readJson: async () => ({ confirm: 'DELETE' }),
    nowSeconds: () => 2000,
    maximumAgeSeconds: 60,
    enforceRateLimit: () => {},
    deleteAccountData: async () => {
      cleanupCalled = true;
    },
  });
  const result = await recorder.completed;

  assert.equal(result.statusCode, 401);
  assert.match(result.body.error, /Recent sign-in/);
  assert.equal(cleanupCalled, false);
});

test('route performs confirmed recent account deletion', async () => {
  const recorder = responseRecorder();
  let deletedUid = '';
  await handleDeleteAccountWithDependencies({}, recorder.response, {
    verifyFirebaseRequest: async () => ({ uid: 'user-a', email_verified: true, auth_time: 1000 }),
    readJson: async () => ({ confirm: 'DELETE' }),
    nowSeconds: () => 1050,
    maximumAgeSeconds: 60,
    enforceRateLimit: () => {},
    deleteAccountData: async ({ uid }) => {
      deletedUid = uid;
      return { authUserDeleted: true };
    },
  });
  const result = await recorder.completed;

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { deleted: true, summary: { authUserDeleted: true } });
  assert.equal(deletedUid, 'user-a');
});
