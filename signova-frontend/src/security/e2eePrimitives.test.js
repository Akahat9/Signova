import {
  decryptMessageEnvelope,
  deriveConversationKey,
  encryptMessageEnvelope,
  exportSignedDevicePublicBundle,
  generateDeviceKeyBundle,
  verifySignedDevicePublicBundle,
} from './e2eePrimitives';

const { webcrypto } = require('crypto');

test('two verified devices derive the same authenticated conversation key', async () => {
  const alice = await generateDeviceKeyBundle(webcrypto);
  const bob = await generateDeviceKeyBundle(webcrypto);
  const alicePublic = await exportSignedDevicePublicBundle(alice, 'alice-device', webcrypto);
  const bobPublic = await exportSignedDevicePublicBundle(bob, 'bob-device', webcrypto);
  expect(await verifySignedDevicePublicBundle(alicePublic, webcrypto)).toBe(true);

  const aliceKey = await deriveConversationKey(alice.agreement.privateKey, bobPublic, 'conversation-a', webcrypto);
  const bobKey = await deriveConversationKey(bob.agreement.privateKey, alicePublic, 'conversation-a', webcrypto);
  const metadata = { conversationId: 'conversation-a', messageId: 'message-a', senderDeviceId: 'alice-device', senderSequence: 1, sentAt: 1 };
  const envelope = await encryptMessageEnvelope(aliceKey, 'hello', metadata, webcrypto);
  await expect(decryptMessageEnvelope(bobKey, envelope, webcrypto)).resolves.toBe('hello');
});

test('metadata tampering fails AES-GCM authentication', async () => {
  const alice = await generateDeviceKeyBundle(webcrypto);
  const bob = await generateDeviceKeyBundle(webcrypto);
  const alicePublic = await exportSignedDevicePublicBundle(alice, 'alice-device', webcrypto);
  const bobPublic = await exportSignedDevicePublicBundle(bob, 'bob-device', webcrypto);
  const aliceKey = await deriveConversationKey(alice.agreement.privateKey, bobPublic, 'conversation-a', webcrypto);
  const bobKey = await deriveConversationKey(bob.agreement.privateKey, alicePublic, 'conversation-a', webcrypto);
  const envelope = await encryptMessageEnvelope(aliceKey, 'hello', {
    conversationId: 'conversation-a', messageId: 'message-a', senderDeviceId: 'alice-device', senderSequence: 1, sentAt: 1,
  }, webcrypto);
  envelope.metadata.messageId = 'tampered';
  await expect(decryptMessageEnvelope(bobKey, envelope, webcrypto)).rejects.toBeDefined();
});

test('device identity substitution invalidates the signed public bundle', async () => {
  const keys = await generateDeviceKeyBundle(webcrypto);
  const bundle = await exportSignedDevicePublicBundle(keys, 'device-a', webcrypto);
  expect(await verifySignedDevicePublicBundle(bundle, webcrypto)).toBe(true);
  expect(await verifySignedDevicePublicBundle({ ...bundle, deviceId: 'device-b' }, webcrypto)).toBe(false);
});
