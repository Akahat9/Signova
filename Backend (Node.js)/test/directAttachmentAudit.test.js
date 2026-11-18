const assert = require('node:assert/strict');
const test = require('node:test');
const {
  privateObjectRef,
  selectOrphanedDirectAttachments,
} = require('../scripts/auditOrphanDirectAttachments');

test('selects only aged unreferenced direct attachment objects', () => {
  const files = [
    { name: 'chatAttachments/chat-a/user-a/message-a/kept.png', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
    { name: 'chatAttachments/chat-a/user-a/message-b/orphan.png', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
    { name: 'chatAttachments/chat-a/user-a/message-c/new.png', metadata: { timeCreated: '2026-07-12T00:00:00Z' } },
    { name: 'encryptedChatAttachments/chat-a/user-a/private.bin', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
  ];
  const result = selectOrphanedDirectAttachments(
    files,
    new Set(['chatAttachments/chat-a/user-a/message-a/kept.png']),
    Date.parse('2026-07-11T00:00:00Z'),
  );
  assert.deepEqual(result.map((file) => file.name), ['chatAttachments/chat-a/user-a/message-b/orphan.png']);
});

test('direct attachment operational references are stable hashes', () => {
  const path = 'chatAttachments/private-chat/private-user/private-message/private-file.png';
  const reference = privateObjectRef(path);
  assert.match(reference, /^[a-f0-9]{20}$/);
  assert.equal(reference.includes('private'), false);
  assert.equal(privateObjectRef(path), reference);
});
