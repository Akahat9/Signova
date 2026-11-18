import { clearConversationMessages, LEGACY_MESSAGE_CONTACT_ID, mergeRealtimeConversationMessages, messagesForContact, normalizeConversationMessage, normalizeConversationMessages } from './conversationMessageModel';

test('migrates legacy unscoped messages into the Signova AI conversation', () => {
  expect(normalizeConversationMessage({ id: 'legacy', text: 'hello' })).toEqual({
    id: 'legacy',
    text: 'hello',
    contactId: LEGACY_MESSAGE_CONTACT_ID,
  });
  expect(normalizeConversationMessages([null, {}, { id: 'valid', contactId: 'contact-1' }])).toEqual([
    { id: 'valid', contactId: 'contact-1' },
  ]);
});

test('returns only messages owned by the selected conversation', () => {
  const messages = [
    { id: 'a', contactId: 'contact-a' },
    { id: 'b', contactId: 'contact-b' },
    { id: 'legacy' },
  ];
  expect(messagesForContact(messages, 'contact-a').map((message) => message.id)).toEqual(['a']);
  expect(messagesForContact(messages, LEGACY_MESSAGE_CONTACT_ID).map((message) => message.id)).toEqual(['legacy']);
  expect(messagesForContact(messages, '')).toEqual([]);
});

test('clears one conversation without deleting other contacts and can preserve system messages', () => {
  const messages = [
    { id: 'welcome', contactId: 'contact-a' },
    { id: 'a', contactId: 'contact-a' },
    { id: 'b', contactId: 'contact-b' },
  ];
  expect(clearConversationMessages(messages, 'contact-a', { preserveIds: ['welcome'] })).toEqual([
    { id: 'welcome', contactId: 'contact-a' },
    { id: 'b', contactId: 'contact-b' },
  ]);
});

test('replaces subscribed Firestore state and resolves matching optimistic messages without touching other contacts', () => {
  const merged = mergeRealtimeConversationMessages([
    { id: 'other', contactId: 'contact-b', createdAt: 1 },
    { id: 'old-remote', contactId: 'contact-a', transport: 'firestore', createdAt: 2 },
    { id: 'message-1', contactId: 'contact-a', transport: 'firestore-pending', createdAt: 3 },
    { id: 'message-2', contactId: 'contact-a', transport: 'firestore-failed', createdAt: 3.5, reactions: ['💜'], status: 'read', deliveredAt: '10:01 AM', readAt: '10:02 AM', seenGlow: true, liveActivity: 'Read through Firebase chat' },
    { id: 'failed-local', contactId: 'contact-a', transport: 'firestore-failed', createdAt: 4 },
  ], 'contact-a', [
    { id: 'message-1', contactId: 'contact-a', transport: 'firestore', createdAt: 3 },
    { id: 'message-2', contactId: 'contact-a', transport: 'firestore', createdAt: 3.5 },
    { id: 'new-remote', contactId: 'contact-a', transport: 'firestore', createdAt: 5 },
  ]);
  expect(merged.map((message) => message.id)).toEqual(['other', 'message-1', 'message-2', 'failed-local', 'new-remote']);
  expect(merged.find((message) => message.id === 'message-2')?.reactions).toEqual(['💜']);
  expect(merged.find((message) => message.id === 'message-2')).toMatchObject({
    status: 'read',
    deliveredAt: '10:01 AM',
    readAt: '10:02 AM',
    seenGlow: true,
    liveActivity: 'Read through Firebase chat',
  });
});
