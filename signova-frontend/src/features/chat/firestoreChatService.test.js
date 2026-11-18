import {
  acknowledgeDirectMessageReceipt,
  applyDirectMessageReceipts,
  buildDirectChatId,
  ensureDirectChat,
  groupDirectMessageReceipts,
  groupDirectMessageReactions,
  markDirectMessageEdited,
  markDirectMessageUnsent,
  normalizeDirectMessageReceipt,
  normalizeDirectMessageReaction,
  normalizeFirestoreChatMessage,
  sendDirectAttachmentMessage,
  sendDirectTextMessage,
  setDirectMessageReaction,
  subscribeDirectChatMessages,
  subscribeDirectChatReceipts,
  subscribeDirectChatReactions,
} from './firestoreChatService';

function digest(bytes) {
  const seed = Array.from(bytes).reduce((total, value) => (total + value) % 255, 0);
  return Promise.resolve(Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 255).buffer);
}

test('builds the same opaque direct-chat ID regardless of participant order', async () => {
  const first = await buildDirectChatId('user-a', 'user-b', { digest });
  const second = await buildDirectChatId('user-b', 'user-a', { digest });
  expect(first).toEqual(second);
  expect(first.chatId).toMatch(/^direct-[a-f0-9]{40}$/);
  await expect(buildDirectChatId('user-a', 'user-a', { digest })).rejects.toThrow('same account');
});

test('creates a missing verified direct chat transactionally and rejects membership mismatch', async () => {
  const transaction = { get: jest.fn(async () => ({ exists: () => false })), set: jest.fn() };
  const transact = jest.fn(async (db, callback) => callback(transaction));
  await expect(ensureDirectChat({ firestore: {}, currentUser: { uid: 'user-a', emailVerified: true }, contactUid: 'user-b', digest, makeDoc: () => 'chat-ref', transact, timestamp: () => 'server-time' })).resolves.toMatchObject({ memberIds: ['user-a', 'user-b'] });
  expect(transaction.set).toHaveBeenCalledWith('chat-ref', expect.objectContaining({ memberIds: ['user-a', 'user-b'], title: 'Direct Signova chat' }));

  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memberIds: ['user-a', 'user-c'] }) });
  await expect(ensureDirectChat({ firestore: {}, currentUser: { uid: 'user-a', emailVerified: true }, contactUid: 'user-b', digest, makeDoc: () => 'chat-ref', transact })).rejects.toThrow('membership mismatch');
});

test('subscribes to ordered bounded messages and normalizes sender direction', () => {
  const subscribe = jest.fn((queryValue, next) => {
    next({ docs: [{ id: 'message-1', data: () => ({ senderUid: 'user-a', text: 'Hello', createdAt: 1000 }) }] });
    return 'unsubscribe';
  });
  const onMessages = jest.fn();
  expect(subscribeDirectChatMessages({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    currentUid: 'user-a',
    contactId: 'contact-b',
    onMessages,
    makeCollection: () => 'messages-ref',
    makeQuery: (...parts) => parts,
    makeOrder: (...parts) => parts,
    makeLimit: (count) => count,
    subscribe,
  })).toBe('unsubscribe');
  expect(onMessages).toHaveBeenCalledWith([expect.objectContaining({ id: 'message-1', contactId: 'contact-b', direction: 'outgoing', transport: 'firestore', realtimeChatId: `direct-${'a'.repeat(40)}` })]);
});

test('normalizes deleted Firestore messages as unsent rows', () => {
  expect(normalizeFirestoreChatMessage({
    id: 'message-deleted',
    data: () => ({ senderUid: 'user-a', text: 'secret', createdAt: 1000, deletedAt: 2000 }),
  }, { currentUid: 'user-a', contactId: 'contact-b' })).toMatchObject({
    id: 'message-deleted',
    text: 'You unsent this message',
    status: 'deleted',
    deleted: true,
    unsent: true,
    liveActivity: 'Unsent through Firebase chat',
  });
});

test('normalizes edited Firestore messages without hiding the text', () => {
  expect(normalizeFirestoreChatMessage({
    id: 'message-edited',
    data: () => ({ senderUid: 'user-a', text: 'updated', createdAt: 1000, editedAt: 2000 }),
  }, { currentUid: 'user-a', contactId: 'contact-b' })).toMatchObject({
    id: 'message-edited',
    text: 'updated',
    status: 'sent',
    edited: true,
    liveActivity: 'Edited through Firebase chat',
  });
});

test('normalizes Firestore attachment messages with durable metadata but no persisted URL', () => {
  expect(normalizeFirestoreChatMessage({
    id: 'message-attachment',
    data: () => ({
      senderUid: 'user-b',
      type: 'image',
      text: 'Image: hello.png · High quality',
      createdAt: 1000,
      mediaPath: 'chatAttachments/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/user-b/message-attachment/hello.png',
      attachment: {
        type: 'image',
        title: 'hello.png',
        contentType: 'image/png',
        size: '1 KB',
        sizeBytes: 1024,
        mediaPath: 'chatAttachments/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/user-b/message-attachment/hello.png',
        mode: 'High quality',
        quality: 'High quality',
      },
    }),
  }, { currentUid: 'user-a', contactId: 'contact-b', chatId: `direct-${'a'.repeat(40)}` })).toMatchObject({
    id: 'message-attachment',
    direction: 'incoming',
    attachmentType: 'image',
    attachmentData: {
      title: 'hello.png',
      url: '',
      mediaPath: 'chatAttachments/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/user-b/message-attachment/hello.png',
      durable: true,
      previewExpired: false,
    },
  });
});

test('marks a direct Firestore message edited with bounded text', async () => {
  const update = jest.fn(async () => undefined);
  await expect(markDirectMessageEdited({
    firestore: {},
    chatId: `direct-${'e'.repeat(40)}`,
    messageId: 'message-edit',
    text: '  updated text  ',
    makeDoc: (db, ...segments) => segments.join('/'),
    update,
    timestamp: () => 'server-time',
  })).resolves.toEqual({ chatId: `direct-${'e'.repeat(40)}`, messageId: 'message-edit', text: 'updated text' });
  expect(update).toHaveBeenCalledWith('chats/direct-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/messages/message-edit', {
    text: 'updated text',
    editedAt: 'server-time',
  });
  await expect(markDirectMessageEdited({
    firestore: {},
    chatId: `direct-${'e'.repeat(40)}`,
    messageId: 'message-edit',
    text: '',
    update,
  })).rejects.toThrow('1 to 4000');
});

test('marks a direct Firestore message unsent with a bounded update', async () => {
  const update = jest.fn(async () => undefined);
  await expect(markDirectMessageUnsent({
    firestore: {},
    chatId: `direct-${'d'.repeat(40)}`,
    messageId: 'message-delete',
    makeDoc: (db, ...segments) => segments.join('/'),
    update,
    timestamp: () => 'server-time',
  })).resolves.toEqual({ chatId: `direct-${'d'.repeat(40)}`, messageId: 'message-delete' });
  expect(update).toHaveBeenCalledWith('chats/direct-dddddddddddddddddddddddddddddddddddddddd/messages/message-delete', {
    text: 'You unsent this message',
    deletedAt: 'server-time',
  });
});

test('normalizes and groups direct message reactions by message id', () => {
  const valid = normalizeDirectMessageReaction({
    id: 'user-a',
    data: () => ({
      chatId: `direct-${'f'.repeat(40)}`,
      messageId: 'message-1',
      userId: 'user-a',
      reaction: ' 💜 ',
    }),
  });
  const invalid = normalizeDirectMessageReaction({
    id: 'user-b',
    data: () => ({
      chatId: 'not-direct',
      messageId: 'message-1',
      userId: 'user-b',
      reaction: '👍',
    }),
  });
  const grouped = groupDirectMessageReactions([
    valid,
    { messageId: 'message-1', reaction: '👍' },
    invalid,
  ]);
  expect(valid).toEqual({
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    userId: 'user-a',
    reaction: '💜',
  });
  expect(invalid).toBeNull();
  expect(grouped.get('message-1')).toEqual(['💜', '👍']);
});

test('subscribes to bounded direct message reactions through a collection group', () => {
  const subscribe = jest.fn((queryValue, next) => {
    next({
      docs: [
        {
          id: 'user-a',
          data: () => ({
            chatId: `direct-${'f'.repeat(40)}`,
            messageId: 'message-1',
            userId: 'user-a',
            reaction: '💜',
          }),
        },
      ],
    });
    return 'unsubscribe-reactions';
  });
  const onReactions = jest.fn();
  expect(subscribeDirectChatReactions({
    firestore: {},
    chatId: `direct-${'f'.repeat(40)}`,
    onReactions,
    makeCollectionGroup: () => 'reactions-group',
    makeQuery: (...parts) => parts,
    makeWhere: (...parts) => parts,
    subscribe,
  })).toBe('unsubscribe-reactions');
  expect(onReactions).toHaveBeenCalledWith(expect.any(Map));
  expect(onReactions.mock.calls[0][0].get('message-1')).toEqual(['💜']);
});

test('normalizes, groups, and applies direct message receipts', () => {
  const valid = normalizeDirectMessageReceipt({
    id: 'user-b',
    data: () => ({
      chatId: `direct-${'a'.repeat(40)}`,
      messageId: 'message-1',
      userId: 'user-b',
      deliveredAt: { seconds: 2, nanoseconds: 0 },
      readAt: { seconds: 3, nanoseconds: 0 },
    }),
  });
  const invalid = normalizeDirectMessageReceipt({
    id: 'user-c',
    data: () => ({
      chatId: 'not-direct',
      messageId: 'message-1',
      userId: 'user-c',
      deliveredAt: { seconds: 2, nanoseconds: 0 },
    }),
  });
  const grouped = groupDirectMessageReceipts([
    { ...valid, readAtMs: 0, readAt: '' },
    valid,
    invalid,
  ]);
  expect(valid).toMatchObject({
    chatId: `direct-${'a'.repeat(40)}`,
    messageId: 'message-1',
    userId: 'user-b',
    deliveredAtMs: 2000,
    readAtMs: 3000,
  });
  expect(invalid).toBeNull();
  expect(grouped.get('message-1')).toMatchObject({ readAtMs: 3000 });
  expect(applyDirectMessageReceipts([
    { id: 'message-1', direction: 'outgoing', transport: 'firestore', status: 'sent' },
    { id: 'message-2', direction: 'incoming', transport: 'firestore', status: 'sent' },
  ], grouped)).toEqual([
    expect.objectContaining({ id: 'message-1', status: 'read', seenGlow: true }),
    expect.objectContaining({ id: 'message-2', status: 'sent' }),
  ]);
});

test('subscribes to direct message receipts through a collection group', () => {
  const subscribe = jest.fn((queryValue, next) => {
    next({
      docs: [
        {
          id: 'user-b',
          data: () => ({
            chatId: `direct-${'a'.repeat(40)}`,
            messageId: 'message-1',
            userId: 'user-b',
            deliveredAt: 2000,
            readAt: 3000,
          }),
        },
      ],
    });
    return 'unsubscribe-receipts';
  });
  const onReceipts = jest.fn();
  expect(subscribeDirectChatReceipts({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    onReceipts,
    makeCollectionGroup: () => 'receipts-group',
    makeQuery: (...parts) => parts,
    makeWhere: (...parts) => parts,
    subscribe,
  })).toBe('unsubscribe-receipts');
  expect(onReceipts.mock.calls[0][0].get('message-1')).toMatchObject({ readAtMs: 3000 });
});

test('acknowledges delivery once and upgrades to read transactionally', async () => {
  const transaction = {
    get: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
    set: jest.fn(),
    update: jest.fn(),
  };
  const transact = jest.fn(async (db, callback) => callback(transaction));
  await expect(acknowledgeDirectMessageReceipt({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-b',
    read: true,
    makeDoc: (db, ...segments) => segments.join('/'),
    transact,
    timestamp: () => 'server-time',
  })).resolves.toMatchObject({ messageId: 'message-1', read: true });
  expect(transaction.set).toHaveBeenCalledWith('chats/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/messages/message-1/receipts/user-b', {
    userId: 'user-b',
    chatId: `direct-${'a'.repeat(40)}`,
    messageId: 'message-1',
    deliveredAt: 'server-time',
    readAt: 'server-time',
    updatedAt: 'server-time',
  });

  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ deliveredAt: 'old-time', readAt: null }) });
  await acknowledgeDirectMessageReceipt({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-b',
    read: true,
    makeDoc: (db, ...segments) => segments.join('/'),
    transact,
    timestamp: () => 'server-time-2',
  });
  expect(transaction.update).toHaveBeenCalledWith('chats/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/messages/message-1/receipts/user-b', {
    readAt: 'server-time-2',
    updatedAt: 'server-time-2',
  });
});

test('writes and clears a user-scoped direct message reaction', async () => {
  const write = jest.fn(async () => undefined);
  const remove = jest.fn(async () => undefined);
  await expect(setDirectMessageReaction({
    firestore: {},
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-a',
    reaction: ' 👍 ',
    makeDoc: (db, ...segments) => segments.join('/'),
    write,
    remove,
    timestamp: () => 'server-time',
  })).resolves.toEqual({
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-a',
    reaction: '👍',
  });
  expect(write).toHaveBeenCalledWith('chats/direct-ffffffffffffffffffffffffffffffffffffffff/messages/message-1/reactions/user-a', {
    userId: 'user-a',
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    reaction: '👍',
    updatedAt: 'server-time',
  });
  await expect(setDirectMessageReaction({
    firestore: {},
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-a',
    reaction: '',
    makeDoc: (db, ...segments) => segments.join('/'),
    write,
    remove,
  })).resolves.toMatchObject({ reaction: '' });
  expect(remove).toHaveBeenCalledWith('chats/direct-ffffffffffffffffffffffffffffffffffffffff/messages/message-1/reactions/user-a');
  await expect(setDirectMessageReaction({
    firestore: {},
    chatId: `direct-${'f'.repeat(40)}`,
    messageId: 'message-1',
    userUid: 'user-a',
    reaction: 'x'.repeat(33),
  })).rejects.toThrow('too long');
});

test('writes a text message and chat preview atomically through a batch', async () => {
  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(async () => undefined) };
  await expect(sendDirectTextMessage({
    firestore: {},
    chatId: `direct-${'b'.repeat(40)}`,
    senderUid: 'user-a',
    text: '  Hello  ',
    messageId: 'message-1',
    makeDoc: (db, ...segments) => segments.join('/'),
    makeBatch: () => batch,
    timestamp: () => 'server-time',
  })).resolves.toEqual({ chatId: `direct-${'b'.repeat(40)}`, messageId: 'message-1' });
  expect(batch.set).toHaveBeenCalledWith('chats/direct-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/messages/message-1', expect.objectContaining({ senderUid: 'user-a', text: 'Hello', clientMessageId: 'message-1' }));
  expect(batch.update).toHaveBeenCalledWith('chats/direct-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', expect.objectContaining({ lastMessage: 'Hello' }));
  expect(batch.commit).toHaveBeenCalled();
});

test('writes an attachment message and chat preview atomically through a batch', async () => {
  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(async () => undefined) };
  await expect(sendDirectAttachmentMessage({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    senderUid: 'user-a',
    messageId: 'message-attachment',
    text: 'Image: hello.png · High quality',
    mediaPath: `chatAttachments/direct-${'a'.repeat(40)}/user-a/message-attachment/hello.png`,
    attachment: {
      type: 'image',
      title: 'hello.png',
      contentType: 'image/png',
      size: '1 KB',
      sizeBytes: 1024,
      mode: 'High quality',
      quality: 'High quality',
    },
    makeDoc: (db, ...segments) => segments.join('/'),
    makeBatch: () => batch,
    timestamp: () => 'server-time',
  })).resolves.toEqual({
    chatId: `direct-${'a'.repeat(40)}`,
    messageId: 'message-attachment',
    mediaPath: `chatAttachments/direct-${'a'.repeat(40)}/user-a/message-attachment/hello.png`,
  });
  expect(batch.set).toHaveBeenCalledWith('chats/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/messages/message-attachment', expect.objectContaining({
    senderUid: 'user-a',
    type: 'image',
    text: 'Image: hello.png · High quality',
    mediaPath: `chatAttachments/direct-${'a'.repeat(40)}/user-a/message-attachment/hello.png`,
    attachment: expect.objectContaining({ type: 'image', title: 'hello.png', mediaPath: `chatAttachments/direct-${'a'.repeat(40)}/user-a/message-attachment/hello.png` }),
  }));
  expect(batch.update).toHaveBeenCalledWith('chats/direct-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', expect.objectContaining({ lastMessage: 'Image: hello.png · High quality' }));
  await expect(sendDirectAttachmentMessage({
    firestore: {},
    chatId: `direct-${'a'.repeat(40)}`,
    senderUid: 'user-a',
    messageId: 'message-attachment',
    text: 'Image: hello.png',
    mediaPath: 'chatAttachments/other/user-a/message-attachment/hello.png',
    attachment: { type: 'image', title: 'hello.png', contentType: 'image/png', size: '1 KB', sizeBytes: 1024 },
  })).rejects.toThrow(/path/i);
});

test('bounds message confirmation when the Firestore batch remains pending', async () => {
  jest.useFakeTimers();
  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(() => new Promise(() => {})) };
  const sending = sendDirectTextMessage({
    firestore: {},
    chatId: `direct-${'c'.repeat(40)}`,
    senderUid: 'user-a',
    text: 'Offline message',
    messageId: 'message-timeout',
    makeDoc: () => 'ref',
    makeBatch: () => batch,
    timestamp: () => 'server-time',
    timeoutMs: 20,
  });
  jest.advanceTimersByTime(20);
  await expect(sending).rejects.toMatchObject({ code: 'chat/write-timeout' });
  jest.useRealTimers();
});
