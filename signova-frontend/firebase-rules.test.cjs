const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} = require('firebase/firestore');
const {
  deleteObject,
  ref,
  uploadBytes,
} = require('firebase/storage');

const projectId = process.env.GCLOUD_PROJECT || 'signova-6e929';
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8'),
    },
  });
});

after(async () => {
  await environment?.cleanup();
});

test('users cannot forge verification state', async () => {
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();

  await assertFails(setDoc(doc(db, 'users/user-a'), {
    name: 'User A',
    username: '@user-a',
    email: 'a@example.test',
    phone: '',
    showNumber: false,
    emailVerified: true,
  }));
});

test('users can create an allowlisted profile', async () => {
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();

  await assertSucceeds(setDoc(doc(db, 'users/user-a'), {
    name: 'User A',
    username: '@user-a',
    email: 'a@example.test',
    phone: '',
    showNumber: false,
  }));
});

test('message creation rejects undeclared fields and unsafe media paths', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'chats/chat-a'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Test',
    });
  });
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();

  await assertFails(setDoc(doc(db, 'chats/chat-a/messages/message-a'), {
    senderUid: 'user-a',
    type: 'image',
    text: '',
    mediaPath: 'community/user-b/stolen.png',
    createdAt: 1,
    admin: true,
  }));
});

test('message immutable fields cannot be rewritten', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'chats/chat-b'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Test',
    });
    await setDoc(doc(adminDb, 'chats/chat-b/messages/message-b'), {
      senderUid: 'user-a',
      type: 'text',
      text: 'hello',
      createdAt: 1,
      clientMessageId: 'client-1',
    });
  });
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();

  await assertFails(updateDoc(doc(db, 'chats/chat-b/messages/message-b'), {
    type: 'system',
  }));
  await assertSucceeds(updateDoc(doc(db, 'chats/chat-b/messages/message-b'), {
    text: 'edited',
    editedAt: 2,
  }));
  const snapshot = await assertSucceeds(getDoc(doc(db, 'chats/chat-b/messages/message-b')));
  assert.equal(snapshot.data().text, 'edited');
});

test('storage rejects cross-user and unverified uploads', async () => {
  const verifiedStorage = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).storage();
  const unverifiedStorage = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: false,
  }).storage();
  const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const metadata = { contentType: 'image/jpeg' };

  await assertFails(uploadBytes(ref(verifiedStorage, 'users/user-b/profile/avatar.jpg'), image, metadata));
  await assertFails(uploadBytes(ref(unverifiedStorage, 'users/user-a/profile/avatar.jpg'), image, metadata));
});

test('storage permits owner image upload and deletion', async () => {
  const storage = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).storage();
  const avatar = ref(storage, 'users/user-a/profile/avatar.jpg');

  await assertSucceeds(uploadBytes(
    avatar,
    new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    { contentType: 'image/jpeg' },
  ));
  await assertSucceeds(deleteObject(avatar));
});
