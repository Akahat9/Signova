import { deriveConversationKey, exportSignedDevicePublicBundle, generateDeviceKeyBundle } from './e2eePrimitives';
import { decryptAttachment, encryptAttachment, MAX_ATTACHMENT_BYTES } from './encryptedAttachments';

const { webcrypto } = require('crypto');

async function conversationKey() {
  const alice = await generateDeviceKeyBundle(webcrypto);
  const bob = await generateDeviceKeyBundle(webcrypto);
  const bobPublic = await exportSignedDevicePublicBundle(bob, 'bob-device', webcrypto);
  return deriveConversationKey(alice.agreement.privateKey, bobPublic, 'conversation-a', webcrypto);
}

test('encrypts attachment bytes with a separately wrapped content key', async () => {
  const key = await conversationKey();
  const plaintext = new TextEncoder().encode('private attachment');
  const envelope = await encryptAttachment(key, plaintext, {
    conversationId: 'conversation-a', attachmentId: 'attachment-a', senderDeviceId: 'alice-device',
    senderSequence: 7, contentType: 'text/plain',
  }, webcrypto);
  expect(envelope.ciphertext).not.toEqual(plaintext);
  const decrypted = await decryptAttachment(key, envelope, webcrypto);
  expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
});

test('attachment metadata and ciphertext tampering fail authentication', async () => {
  const key = await conversationKey();
  const envelope = await encryptAttachment(key, new Uint8Array([1, 2, 3]), {
    conversationId: 'conversation-a', attachmentId: 'attachment-a', senderDeviceId: 'alice-device', senderSequence: 1,
  }, webcrypto);
  await expect(decryptAttachment(key, {
    ...envelope,
    descriptor: { ...envelope.descriptor, attachmentId: 'tampered' },
  }, webcrypto)).rejects.toBeDefined();
  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice() };
  tampered.ciphertext[0] ^= 1;
  await expect(decryptAttachment(key, tampered, webcrypto)).rejects.toBeDefined();
});

test('rejects empty and oversized encrypted attachments', async () => {
  const key = await conversationKey();
  const context = { conversationId: 'c', attachmentId: 'a', senderDeviceId: 'd', senderSequence: 1 };
  await expect(encryptAttachment(key, new Uint8Array(), context, webcrypto)).rejects.toThrow(/size/i);
  await expect(encryptAttachment(key, new Uint8Array(MAX_ATTACHMENT_BYTES + 1), context, webcrypto)).rejects.toThrow(/size/i);
});
