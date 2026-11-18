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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} = require('firebase/firestore');
const {
  deleteObject,
  getBytes,
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
    profilePhotoUrl: 'https://firebasestorage.googleapis.com/example/avatar',
    profilePhotoPath: 'users/user-a/profile/avatar-1.jpg',
  }));
});

test('users cannot point profile metadata at another owner storage path', async () => {
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
    profilePhotoUrl: 'https://example.test/avatar',
    profilePhotoPath: 'users/user-b/profile/avatar.jpg',
  }));
});

test('presence is readable to signed-in users but writable only by the owner', async () => {
  const userADb = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const userBDb = environment.authenticatedContext('user-b', {
    email: 'b@example.test',
    email_verified: true,
  }).firestore();
  const unauthDb = environment.unauthenticatedContext().firestore();
  const presencePath = 'userPresence/user-a';

  await assertSucceeds(setDoc(doc(userADb, presencePath), {
    uid: 'user-a',
    state: 'online',
    deviceLabel: 'Web',
    lastActiveAt: 1,
    updatedAt: 1,
  }));
  await assertSucceeds(getDoc(doc(userBDb, presencePath)));
  await assertFails(getDoc(doc(unauthDb, presencePath)));
  await assertFails(setDoc(doc(userBDb, presencePath), {
    uid: 'user-b',
    state: 'online',
    deviceLabel: 'Web',
    lastActiveAt: 2,
    updatedAt: 2,
  }));
  await assertFails(setDoc(doc(userADb, presencePath), {
    uid: 'user-a',
    state: 'online',
    deviceLabel: 'x'.repeat(41),
    lastActiveAt: 3,
    updatedAt: 3,
  }));
  await assertFails(deleteDoc(doc(userADb, presencePath)));
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

test('verified direct-chat members can create the room and atomically send text while non-members cannot', async () => {
  const memberDb = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const outsiderDb = environment.authenticatedContext('user-c', {
    email: 'c@example.test',
    email_verified: true,
  }).firestore();
  const chatPath = 'chats/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  await assertSucceeds(getDoc(doc(memberDb, chatPath)));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), chatPath)));
  await assertSucceeds(setDoc(doc(memberDb, chatPath), {
    memberIds: ['user-a', 'user-b'],
    title: 'Direct Signova chat',
    avatarUrl: '',
    lastMessage: '',
    lastMessageAt: 1,
    createdAt: 1,
    updatedAt: 1,
  }));
  await assertFails(getDoc(doc(outsiderDb, chatPath)));

  const batch = writeBatch(memberDb);
  batch.set(doc(memberDb, `${chatPath}/messages/message-1`), {
    senderUid: 'user-a',
    type: 'text',
    text: 'Hello',
    createdAt: 2,
    clientMessageId: 'message-1',
  });
  batch.update(doc(memberDb, chatPath), {
    lastMessage: 'Hello',
    lastMessageAt: 2,
    updatedAt: 2,
  });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(outsiderDb, `${chatPath}/messages/message-outside`), {
    senderUid: 'user-c',
    type: 'text',
    text: 'Not allowed',
    createdAt: 3,
    clientMessageId: 'message-outside',
  }));
});

test('direct-chat attachment metadata is bound to the sender storage path', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'chats/direct-attachments'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Attachment Test',
    });
  });
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const messagePath = 'chats/direct-attachments/messages/message-image';
  const mediaPath = 'chatAttachments/direct-attachments/user-a/message-image/hello.png';

  await assertSucceeds(setDoc(doc(db, messagePath), {
    senderUid: 'user-a',
    type: 'image',
    text: 'Image: hello.png',
    mediaPath,
    attachment: {
      type: 'image',
      title: 'hello.png',
      contentType: 'image/png',
      size: '1 KB',
      sizeBytes: 1024,
      mediaPath,
      mode: 'High quality',
      quality: 'High quality',
    },
    createdAt: 2,
    clientMessageId: 'message-image',
  }));
  await assertFails(setDoc(doc(db, 'chats/direct-attachments/messages/message-bad'), {
    senderUid: 'user-a',
    type: 'image',
    text: 'Image: stolen.png',
    mediaPath: 'chatAttachments/direct-attachments/user-b/message-bad/stolen.png',
    attachment: {
      type: 'image',
      title: 'stolen.png',
      contentType: 'image/png',
      size: '1 KB',
      sizeBytes: 1024,
      mediaPath: 'chatAttachments/direct-attachments/user-b/message-bad/stolen.png',
      mode: '',
      quality: '',
    },
    createdAt: 3,
    clientMessageId: 'message-bad',
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

test('message reactions are user-scoped and visible only to chat members', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'chats/chat-reactions'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Reaction Test',
    });
    await setDoc(doc(adminDb, 'chats/chat-reactions/messages/message-reaction'), {
      senderUid: 'user-b',
      type: 'text',
      text: 'hello',
      createdAt: 1,
      clientMessageId: 'message-reaction',
    });
  });
  const userADb = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const userBDb = environment.authenticatedContext('user-b', {
    email: 'b@example.test',
    email_verified: true,
  }).firestore();
  const outsiderDb = environment.authenticatedContext('user-c', {
    email: 'c@example.test',
    email_verified: true,
  }).firestore();
  const reactionPath = 'chats/chat-reactions/messages/message-reaction/reactions/user-a';

  await assertSucceeds(setDoc(doc(userADb, reactionPath), {
    userId: 'user-a',
    chatId: 'chat-reactions',
    messageId: 'message-reaction',
    reaction: '💜',
    updatedAt: 2,
  }));
  await assertSucceeds(getDoc(doc(userBDb, reactionPath)));
  await assertFails(getDoc(doc(outsiderDb, reactionPath)));
  await assertFails(setDoc(doc(userADb, 'chats/chat-reactions/messages/message-reaction/reactions/user-b'), {
    userId: 'user-b',
    chatId: 'chat-reactions',
    messageId: 'message-reaction',
    reaction: '🔥',
    updatedAt: 3,
  }));
  await assertFails(setDoc(doc(userADb, reactionPath), {
    userId: 'user-a',
    chatId: 'chat-reactions',
    messageId: 'message-reaction',
    reaction: 'x'.repeat(33),
    updatedAt: 4,
  }));
  await assertSucceeds(deleteDoc(doc(userADb, reactionPath)));
});

test('message receipts are recipient-scoped and cannot be spoofed by senders', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'chats/chat-receipts'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Receipt Test',
    });
    await setDoc(doc(adminDb, 'chats/chat-receipts/messages/message-receipt'), {
      senderUid: 'user-b',
      type: 'text',
      text: 'hello',
      createdAt: 1,
      clientMessageId: 'message-receipt',
    });
  });
  const userADb = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const userBDb = environment.authenticatedContext('user-b', {
    email: 'b@example.test',
    email_verified: true,
  }).firestore();
  const outsiderDb = environment.authenticatedContext('user-c', {
    email: 'c@example.test',
    email_verified: true,
  }).firestore();
  const receiptPath = 'chats/chat-receipts/messages/message-receipt/receipts/user-a';

  await assertSucceeds(setDoc(doc(userADb, receiptPath), {
    userId: 'user-a',
    chatId: 'chat-receipts',
    messageId: 'message-receipt',
    deliveredAt: 2,
    readAt: null,
    updatedAt: 2,
  }));
  await assertSucceeds(getDoc(doc(userBDb, receiptPath)));
  await assertFails(getDoc(doc(outsiderDb, receiptPath)));
  await assertFails(setDoc(doc(userBDb, 'chats/chat-receipts/messages/message-receipt/receipts/user-b'), {
    userId: 'user-b',
    chatId: 'chat-receipts',
    messageId: 'message-receipt',
    deliveredAt: 2,
    readAt: 3,
    updatedAt: 3,
  }));
  await assertFails(setDoc(doc(userADb, 'chats/chat-receipts/messages/message-receipt/receipts/user-b'), {
    userId: 'user-b',
    chatId: 'chat-receipts',
    messageId: 'message-receipt',
    deliveredAt: 2,
    readAt: null,
    updatedAt: 2,
  }));
  await assertSucceeds(updateDoc(doc(userADb, receiptPath), {
    readAt: 3,
    updatedAt: 3,
  }));
  await assertFails(updateDoc(doc(userADb, receiptPath), {
    readAt: 4,
    updatedAt: 4,
  }));
  await assertFails(deleteDoc(doc(userADb, receiptPath)));
});

test('ciphertext attachment messages bind sender, chat, path, and forbid plaintext fallback', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'chats/ciphertext-chat'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Ciphertext chat',
    });
  });
  const db = environment.authenticatedContext('user-a', {
    email: 'a@example.test', email_verified: true,
  }).firestore();
  const encryptedAttachment = {
    version: 1,
    path: 'encryptedChatAttachments/ciphertext-chat/user-a/attachment-a.bin',
    senderUid: 'user-a',
    conversationId: 'ciphertext-chat',
    attachmentId: 'attachment-a',
    senderDeviceId: 'device-a',
    senderSequence: 1,
    contentType: 'image/webp',
    plaintextBytes: 100,
    plaintextSha256: 'a'.repeat(64),
    ciphertextBytes: 116,
    contentIv: 'A'.repeat(16),
    wrapIv: 'B'.repeat(16),
    wrappedKey: 'C'.repeat(64),
  };
  const messagePath = 'chats/ciphertext-chat/messages/encrypted-a';
  const payload = {
    senderUid: 'user-a',
    type: 'encrypted_attachment',
    encryptedAttachment,
    createdAt: 1,
    clientMessageId: 'encrypted-client-a',
  };

  await assertSucceeds(setDoc(doc(db, messagePath), payload));
  await assertFails(setDoc(doc(db, 'chats/ciphertext-chat/messages/plaintext-fallback'), {
    ...payload,
    text: 'secret plaintext',
    clientMessageId: 'encrypted-client-b',
  }));
  await assertFails(setDoc(doc(db, 'chats/ciphertext-chat/messages/path-substitution'), {
    ...payload,
    clientMessageId: 'encrypted-client-c',
    encryptedAttachment: { ...encryptedAttachment, path: 'encryptedChatAttachments/other/user-a/attachment-a.bin' },
  }));
  await assertFails(updateDoc(doc(db, messagePath), { text: 'late plaintext', editedAt: 2 }));
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

test('storage permits owner community video upload and deletion', async () => {
  const storage = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).storage();
  const video = ref(storage, 'community/user-a/demo.mp4');

  await assertSucceeds(uploadBytes(
    video,
    new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    { contentType: 'video/mp4' },
  ));
  await assertSucceeds(deleteObject(video));
});

test('storage permits direct chat attachment access only to members and sender writes', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'chats/chat-attachments'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Attachment storage',
    });
  });
  const ownerStorage = environment.authenticatedContext('user-a', {
    email: 'a@example.test', email_verified: true,
  }).storage();
  const memberStorage = environment.authenticatedContext('user-b', {
    email: 'b@example.test', email_verified: true,
  }).storage();
  const outsiderStorage = environment.authenticatedContext('user-c', {
    email: 'c@example.test', email_verified: true,
  }).storage();
  const path = 'chatAttachments/chat-attachments/user-a/message-a/photo.png';
  const metadata = {
    contentType: 'image/png',
    customMetadata: { chatId: 'chat-attachments', senderUid: 'user-a', messageId: 'message-a' },
  };

  await assertSucceeds(uploadBytes(ref(ownerStorage, path), new Uint8Array([1, 2, 3]), metadata));
  await assertSucceeds(getBytes(ref(memberStorage, path)));
  await assertFails(getBytes(ref(outsiderStorage, path)));
  await assertFails(uploadBytes(ref(memberStorage, 'chatAttachments/chat-attachments/user-a/message-b/photo.png'), new Uint8Array([1, 2, 3]), {
    contentType: 'image/png',
    customMetadata: { chatId: 'chat-attachments', senderUid: 'user-a', messageId: 'message-b' },
  }));
  await assertSucceeds(deleteObject(ref(ownerStorage, path)));
});

test('encrypted chat attachments are ciphertext-only and limited to conversation members', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'chats/encrypted-chat-a'), {
      memberIds: ['user-a', 'user-b'],
      title: 'Encrypted test',
    });
  });
  const claims = (uid) => ({ email: `${uid}@example.test`, email_verified: true });
  const ownerStorage = environment.authenticatedContext('user-a', claims('user-a')).storage();
  const memberStorage = environment.authenticatedContext('user-b', claims('user-b')).storage();
  const outsiderStorage = environment.authenticatedContext('user-c', claims('user-c')).storage();
  const path = 'encryptedChatAttachments/encrypted-chat-a/user-a/attachment-a.bin';
  const metadata = {
    contentType: 'application/octet-stream',
    customMetadata: { encryptionVersion: '1', chatId: 'encrypted-chat-a', senderUid: 'user-a' },
  };

  await assertSucceeds(uploadBytes(ref(ownerStorage, path), new Uint8Array(17).fill(7), metadata));
  await assertSucceeds(getBytes(ref(memberStorage, path)));
  await assertFails(getBytes(ref(outsiderStorage, path)));
  await assertFails(uploadBytes(ref(memberStorage, path), new Uint8Array(17).fill(8), {
    ...metadata,
    customMetadata: { ...metadata.customMetadata, senderUid: 'user-b' },
  }));
  await assertFails(deleteObject(ref(memberStorage, path)));
  await assertSucceeds(deleteObject(ref(ownerStorage, path)));
});

test('community post creator can publish and delete but another user cannot delete it', async () => {
  const ownerDb = environment.authenticatedContext('user-a', {
    email: 'a@example.test',
    email_verified: true,
  }).firestore();
  const otherDb = environment.authenticatedContext('user-b', {
    email: 'b@example.test',
    email_verified: true,
  }).firestore();
  const postPath = 'publicCommunityPosts/post-a';
  const payload = {
    authorUid: 'user-a',
    text: 'Practice video',
    name: 'User A',
    username: '@user-a',
    stats: { likes: 0, comments: 0, shares: 0 },
    mediaPath: 'community/user-a/video.mp4',
    mediaUrl: 'https://firebasestorage.googleapis.com/video.mp4',
    thumbnailPath: 'community/user-a/video-poster.jpg',
    thumbnailUrl: 'https://firebasestorage.googleapis.com/video-poster.jpg',
    createdAt: 1,
    createdAtMillis: 1,
    updatedAt: 1,
    tags: ['Practice'],
    sign: 'Hello',
    duration: 'Video',
    confidence: 'Live',
    mediaType: 'video',
    contentKind: 'post',
    mediaName: 'video.mp4',
    learningTip: 'Practice slowly.',
    level: 'Beginner',
    avatar: 'UA',
    avatarImage: '',
    avatarTone: 'cyan',
    isPremium: false,
    following: true,
  };

  await assertSucceeds(setDoc(doc(ownerDb, postPath), payload));
  await assertFails(deleteDoc(doc(otherDb, postPath)));
  await assertSucceeds(deleteDoc(doc(ownerDb, postPath)));
});

test('call rooms allow only participants and enforce signaling roles', async () => {
  const callerDb = environment.authenticatedContext('caller-a', {
    email: 'caller@example.test',
    email_verified: true,
  }).firestore();
  const calleeDb = environment.authenticatedContext('callee-b', {
    email: 'callee@example.test',
    email_verified: true,
  }).firestore();
  const outsiderDb = environment.authenticatedContext('outsider-c', {
    email: 'outsider@example.test',
    email_verified: true,
  }).firestore();
  const roomPath = 'callRooms/room-a';
  const room = {
    callerUid: 'caller-a',
    calleeUid: 'callee-b',
    participantUids: ['caller-a', 'callee-b'],
    mediaType: 'video',
    status: 'ringing',
    createdAt: 1,
    updatedAt: 1,
    expiresAtMillis: Date.now() + 600000,
  };

  await assertSucceeds(setDoc(doc(callerDb, roomPath), room));
  await assertSucceeds(getDocs(query(collection(calleeDb, 'callRooms'), where('calleeUid', '==', 'callee-b'))));
  await assertFails(getDocs(query(collection(outsiderDb, 'callRooms'), where('calleeUid', '==', 'callee-b'))));
  await assertFails(getDoc(doc(outsiderDb, roomPath)));
  await assertFails(updateDoc(doc(calleeDb, roomPath), {
    offer: { type: 'offer', sdp: 'forged-offer' },
    status: 'connecting',
    updatedAt: 2,
  }));
  await assertSucceeds(updateDoc(doc(callerDb, roomPath), {
    offer: { type: 'offer', sdp: 'caller-offer' },
    status: 'connecting',
    updatedAt: 2,
  }));
  await assertSucceeds(updateDoc(doc(calleeDb, roomPath), {
    answer: { type: 'answer', sdp: 'callee-answer' },
    status: 'connected',
    updatedAt: 3,
  }));
  await assertFails(updateDoc(doc(calleeDb, roomPath), {
    status: 'ringing',
    updatedAt: 4,
  }));
  await assertSucceeds(updateDoc(doc(callerDb, roomPath), {
    status: 'ended',
    updatedAt: 4,
  }));
  await assertFails(updateDoc(doc(callerDb, roomPath), {
    status: 'connected',
    updatedAt: 5,
  }));
  await assertSucceeds(setDoc(doc(callerDb, `${roomPath}/candidates/candidate-a`), {
    ownerUid: 'caller-a',
    candidate: 'candidate:1 1 UDP 1 127.0.0.1 5000 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: null,
    createdAt: 3,
  }));
  await assertFails(setDoc(doc(outsiderDb, `${roomPath}/candidates/candidate-b`), {
    ownerUid: 'outsider-c',
    candidate: 'candidate:2 1 UDP 1 127.0.0.1 5001 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: null,
    createdAt: 3,
  }));
});

test('device key directory allows verified publication and irreversible owner revocation', async () => {
  const ownerDb = environment.authenticatedContext('owner-a', {
    email: 'owner@example.test',
    email_verified: true,
  }).firestore();
  const peerDb = environment.authenticatedContext('peer-b', {
    email: 'peer@example.test',
    email_verified: true,
  }).firestore();
  const unverifiedDb = environment.authenticatedContext('unverified-c', {
    email: 'unverified@example.test',
    email_verified: false,
  }).firestore();
  const path = 'e2eeDeviceDirectories/owner-a/devices/device-a';
  const keyText = 'A'.repeat(86) + '==';
  const fingerprint = 'B'.repeat(43) + '=';
  const record = {
    ownerUid: 'owner-a',
    deviceId: 'device-a',
    version: 1,
    agreementPublicKey: keyText,
    signingPublicKey: keyText,
    agreementSignature: keyText,
    fingerprint,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    revokedAt: null,
  };

  await assertSucceeds(setDoc(doc(ownerDb, path), record));
  await assertSucceeds(getDoc(doc(peerDb, path)));
  await assertFails(setDoc(doc(peerDb, 'e2eeDeviceDirectories/owner-a/devices/forged'), {
    ...record,
    deviceId: 'forged',
  }));
  await assertFails(getDoc(doc(unverifiedDb, path)));
  await assertFails(updateDoc(doc(peerDb, path), { status: 'revoked', revokedAt: 2, updatedAt: 2 }));
  await assertSucceeds(updateDoc(doc(ownerDb, path), { status: 'revoked', revokedAt: 2, updatedAt: 2 }));
  await assertFails(updateDoc(doc(ownerDb, path), { status: 'active', revokedAt: null, updatedAt: 3 }));
  await assertFails(deleteDoc(doc(ownerDb, path)));
});

test('MLS KeyPackages are owner-published but backend-claim-only and immutable to clients', async () => {
  const ownerDb = environment.authenticatedContext('owner-a', { email: 'owner@example.test', email_verified: true }).firestore();
  const peerDb = environment.authenticatedContext('peer-b', { email: 'peer@example.test', email_verified: true }).firestore();
  const path = 'mlsKeyPackageDirectories/owner-a/devices/device-a/mlsKeyPackages/package-a';
  const record = {
    ownerUid: 'owner-a', deviceId: 'device-a', packageId: 'package-a', protocol: 'MLS10',
    ciphersuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
    keyPackageBase64: 'A'.repeat(128), credentialFingerprint: 'B'.repeat(43) + '=',
    status: 'available', createdAt: 1, expiresAtMs: 1893456000000,
    claimedAt: null, claimedBy: null, claimId: null,
  };
  await assertSucceeds(setDoc(doc(ownerDb, path), record));
  await assertFails(getDoc(doc(ownerDb, path)));
  await assertFails(getDoc(doc(peerDb, path)));
  await assertFails(setDoc(doc(peerDb, 'mlsKeyPackageDirectories/owner-a/devices/device-a/mlsKeyPackages/forged'), { ...record, packageId: 'forged' }));
  await assertFails(updateDoc(doc(ownerDb, path), { status: 'claimed', claimedBy: 'peer-b' }));
  await assertFails(deleteDoc(doc(ownerDb, path)));
});
