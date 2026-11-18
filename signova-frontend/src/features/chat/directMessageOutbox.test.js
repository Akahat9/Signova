import {
  acknowledgeDirectMessage,
  directMessageOutboxKey,
  enqueueDirectMessage,
  flushDirectMessageOutbox,
  queuedDirectMessagesForContact,
  readDirectMessageOutbox,
} from './directMessageOutbox';

function storage() {
  const map = new Map();
  return {
    getItem: jest.fn((key) => map.get(key) || null),
    setItem: jest.fn((key, value) => map.set(key, value)),
  };
}

const baseMessage = {
  senderUid: 'user-a',
  contactId: 'contact-b',
  chatId: `direct-${'a'.repeat(40)}`,
  messageId: 'message-a',
  text: 'Hello from offline mode',
};

test('stores direct-message outbox items under the Firebase owner UID', () => {
  const local = storage();
  const queued = enqueueDirectMessage(local, 'user-a', baseMessage, { tokenFactory: () => 'token-a', now: () => 10 });

  expect(queued).toMatchObject({ token: 'token-a', ownerUid: 'user-a', queuedAt: 10 });
  expect(local.setItem).toHaveBeenCalledWith(directMessageOutboxKey('user-a'), expect.any(String));
  expect(readDirectMessageOutbox(local, 'user-a')).toEqual([expect.objectContaining({ messageId: 'message-a', text: 'Hello from offline mode' })]);
  expect(readDirectMessageOutbox(local, 'user-b')).toEqual([]);
});

test('rejects malformed or oversized queued direct messages', () => {
  const local = storage();
  expect(() => enqueueDirectMessage(local, 'user-a', { ...baseMessage, chatId: 'chat-a' })).toThrow(/Invalid queued/);
  expect(() => enqueueDirectMessage(local, 'user-a', { ...baseMessage, text: '' })).toThrow(/Invalid queued/);
  expect(() => enqueueDirectMessage(local, 'user-a', { ...baseMessage, text: 'x'.repeat(4001) })).toThrow(/Invalid queued/);
});

test('compacts repeated message IDs and acknowledges by immutable token', () => {
  const local = storage();
  enqueueDirectMessage(local, 'user-a', baseMessage, { tokenFactory: () => 'token-a', now: () => 10 });
  enqueueDirectMessage(local, 'user-a', { ...baseMessage, text: 'Updated text' }, { tokenFactory: () => 'token-b', now: () => 11 });

  expect(readDirectMessageOutbox(local, 'user-a')).toEqual([expect.objectContaining({ token: 'token-b', text: 'Updated text' })]);
  expect(acknowledgeDirectMessage(local, 'user-a', 'token-a')).toBe(false);
  expect(acknowledgeDirectMessage(local, 'user-a', 'token-b')).toBe(true);
  expect(readDirectMessageOutbox(local, 'user-a')).toEqual([]);
});

test('maps queued direct messages into visible conversation rows', () => {
  const local = storage();
  enqueueDirectMessage(local, 'user-a', baseMessage, { tokenFactory: () => 'token-a', now: () => 10 });
  enqueueDirectMessage(local, 'user-a', { ...baseMessage, contactId: 'other-contact', messageId: 'message-other' }, { tokenFactory: () => 'token-other', now: () => 11 });

  expect(queuedDirectMessagesForContact(local, 'user-a', 'contact-b', {
    timeFormatter: (timestamp) => `t-${timestamp}`,
  })).toEqual([
    expect.objectContaining({
      id: 'message-a',
      contactId: 'contact-b',
      status: 'queued',
      transport: 'firestore-queued',
      realtimeChatId: baseMessage.chatId,
      time: 't-10',
    }),
  ]);
});

test('flushes queued messages in order and removes only completed work', async () => {
  const local = storage();
  enqueueDirectMessage(local, 'user-a', baseMessage, { tokenFactory: () => 'token-a', now: () => 10 });
  enqueueDirectMessage(local, 'user-a', { ...baseMessage, messageId: 'message-b', text: 'Second' }, { tokenFactory: () => 'token-b', now: () => 11 });
  const sendMessage = jest.fn(async () => undefined);

  await expect(flushDirectMessageOutbox({
    storage: local,
    ownerUid: 'user-a',
    firestore: {},
    sendMessage,
  })).resolves.toMatchObject({ attempted: 2, completed: 2, remaining: 0, error: '' });

  expect(sendMessage.mock.calls.map(([call]) => call.messageId)).toEqual(['message-a', 'message-b']);
  expect(readDirectMessageOutbox(local, 'user-a')).toEqual([]);
});

test('retains failed and later messages when a flush head fails', async () => {
  const local = storage();
  enqueueDirectMessage(local, 'user-a', baseMessage, { tokenFactory: () => 'token-a', now: () => 10 });
  enqueueDirectMessage(local, 'user-a', { ...baseMessage, messageId: 'message-b', text: 'Second' }, { tokenFactory: () => 'token-b', now: () => 11 });
  const sendMessage = jest.fn(async ({ messageId }) => {
    if (messageId === 'message-a') throw new Error('network down');
  });

  await expect(flushDirectMessageOutbox({
    storage: local,
    ownerUid: 'user-a',
    firestore: {},
    sendMessage,
  })).resolves.toMatchObject({ attempted: 2, completed: 0, remaining: 2, error: 'network down' });

  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(readDirectMessageOutbox(local, 'user-a').map((message) => message.messageId)).toEqual(['message-a', 'message-b']);
});
