const assert = require('node:assert/strict');
const test = require('node:test');
const {
  privateObjectRef,
  selectOrphanedEncryptedAttachments,
} = require('../scripts/auditOrphanEncryptedAttachments');

test('selects only aged unreferenced encrypted attachment objects', () => {
  const files = [
    { name: 'encryptedChatAttachments/chat-a/user-a/kept.bin', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
    { name: 'encryptedChatAttachments/chat-a/user-a/orphan.bin', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
    { name: 'encryptedChatAttachments/chat-a/user-a/new.bin', metadata: { timeCreated: '2026-07-12T00:00:00Z' } },
    { name: 'community/user-a/public.mp4', metadata: { timeCreated: '2026-01-01T00:00:00Z' } },
  ];
  const result = selectOrphanedEncryptedAttachments(
    files,
    new Set(['encryptedChatAttachments/chat-a/user-a/kept.bin']),
    Date.parse('2026-07-11T00:00:00Z'),
  );
  assert.deepEqual(result.map((file) => file.name), ['encryptedChatAttachments/chat-a/user-a/orphan.bin']);
});

test('operational references are stable hashes rather than raw private paths', () => {
  const path = 'encryptedChatAttachments/private-chat/private-user/private-file.bin';
  const reference = privateObjectRef(path);
  assert.match(reference, /^[a-f0-9]{20}$/);
  assert.equal(reference.includes('private'), false);
  assert.equal(privateObjectRef(path), reference);
});
