import { deriveConversationKey, exportSignedDevicePublicBundle, generateDeviceKeyBundle } from './e2eePrimitives';
import {
  attachmentRecordFromMessageMetadata,
  buildEncryptedAttachmentMessageMetadata,
  deleteEncryptedAttachment,
  downloadEncryptedAttachment,
  encryptedAttachmentPath,
  startEncryptedAttachmentUpload,
} from './encryptedAttachmentTransport';

const { webcrypto } = require('crypto');

async function makeConversationKey() {
  const alice = await generateDeviceKeyBundle(webcrypto);
  const bob = await generateDeviceKeyBundle(webcrypto);
  const bobPublic = await exportSignedDevicePublicBundle(bob, 'bob-device', webcrypto);
  return deriveConversationKey(alice.agreement.privateKey, bobPublic, 'chat-a', webcrypto);
}

function memoryStorage() {
  const objects = new Map();
  const makeRef = (_storage, path) => ({ fullPath: path });
  const createUploadTask = (reference, blob, metadata) => ({
    snapshot: { ref: reference, metadata },
    on(_event, progress, error, complete) {
      const reader = new FileReader();
      const bytes = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      bytes.then((buffer) => {
        objects.set(reference.fullPath, { bytes: buffer, metadata });
        progress({ bytesTransferred: blob.size, totalBytes: blob.size });
        complete();
      }).catch(error);
    },
    cancel: jest.fn(),
  });
  return {
    objects,
    makeRef,
    createUploadTask,
    readBytes: async (reference) => objects.get(reference.fullPath).bytes,
    remove: async (reference) => { objects.delete(reference.fullPath); },
  };
}

test('uploads only ciphertext and decrypts it through authenticated byte reads', async () => {
  const key = await makeConversationKey();
  const memory = memoryStorage();
  const progress = jest.fn();
  const plaintext = new TextEncoder().encode('private durable attachment');
  const context = {
    conversationId: 'chat-a', attachmentId: 'attachment-a', senderDeviceId: 'alice-device',
    senderSequence: 4, contentType: 'text/plain',
  };
  const upload = startEncryptedAttachmentUpload({
    storage: {}, conversationKey: key, input: plaintext, context, senderUid: 'alice-user',
    onProgress: progress, cryptoProvider: webcrypto, makeRef: memory.makeRef,
    createUploadTask: memory.createUploadTask,
  });
  const record = await upload.completion;
  const messageMetadata = buildEncryptedAttachmentMessageMetadata(record);
  expect(attachmentRecordFromMessageMetadata(messageMetadata)).toEqual(record);
  const stored = memory.objects.get(record.path);
  expect(new Uint8Array(stored.bytes)).not.toEqual(plaintext);
  expect(stored.metadata).toEqual(expect.objectContaining({
    contentType: 'application/octet-stream',
    customMetadata: { encryptionVersion: '1', chatId: 'chat-a', senderUid: 'alice-user' },
  }));
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 100 }));
  const decrypted = await downloadEncryptedAttachment({
    storage: {}, conversationKey: key, record, cryptoProvider: webcrypto,
    makeRef: memory.makeRef, readBytes: memory.readBytes,
  });
  expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
});

test('rejects path substitution before downloading or deleting', async () => {
  const record = {
    path: 'encryptedChatAttachments/chat-b/alice-user/attachment-a.bin',
    senderUid: 'alice-user', ciphertextBytes: 32,
    descriptor: { conversationId: 'chat-a', attachmentId: 'attachment-a' },
  };
  const readBytes = jest.fn();
  const remove = jest.fn();
  await expect(downloadEncryptedAttachment({ storage: {}, conversationKey: {}, record, readBytes }))
    .rejects.toThrow(/path does not match/i);
  await expect(deleteEncryptedAttachment({ storage: {}, record, remove }))
    .rejects.toThrow(/path does not match/i);
  expect(readBytes).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test('deletes the validated ciphertext object without exposing a download URL', async () => {
  const memory = memoryStorage();
  const record = {
    path: encryptedAttachmentPath({ conversationId: 'chat-a', senderUid: 'alice-user', attachmentId: 'attachment-a' }),
    senderUid: 'alice-user', descriptor: { conversationId: 'chat-a', attachmentId: 'attachment-a' },
  };
  memory.objects.set(record.path, { bytes: new ArrayBuffer(20) });
  await deleteEncryptedAttachment({ storage: {}, record, makeRef: memory.makeRef, remove: memory.remove });
  expect(memory.objects.has(record.path)).toBe(false);
  expect(record).not.toHaveProperty('downloadUrl');
});

test('cancellation during encryption prevents object creation', async () => {
  let resolveEncryption;
  const encrypt = () => new Promise((resolve) => { resolveEncryption = resolve; });
  const createUploadTask = jest.fn();
  const upload = startEncryptedAttachmentUpload({
    storage: {}, conversationKey: {}, input: new Uint8Array([1]), senderUid: 'alice-user',
    context: { conversationId: 'chat-a', attachmentId: 'attachment-a', senderDeviceId: 'device-a', senderSequence: 1 },
    encrypt, createUploadTask,
  });
  upload.cancel();
  resolveEncryption({ ciphertext: new Uint8Array([1, 2, 3]) });
  await expect(upload.completion).rejects.toMatchObject({ name: 'AbortError' });
  expect(createUploadTask).not.toHaveBeenCalled();
});

test('rejects unsafe identifiers before encryption or storage access', () => {
  expect(() => encryptedAttachmentPath({
    conversationId: '../chat', senderUid: 'alice', attachmentId: 'attachment',
  })).toThrow(/conversationId/);
});
