import {
  deleteEncryptedAttachmentMessage,
  EncryptedAttachmentCommitError,
  startEncryptedAttachmentMessageCommit,
} from './encryptedAttachmentLifecycle';

const record = {
  path: 'encryptedChatAttachments/chat-a/alice/attachment-a.bin',
  senderUid: 'alice',
  descriptor: {
    version: 1,
    conversationId: 'chat-a',
    attachmentId: 'attachment-a',
    senderDeviceId: 'device-a',
    senderSequence: 1,
    contentType: 'image/webp',
    plaintextBytes: 10,
    plaintextSha256: 'a'.repeat(64),
  },
  ciphertextBytes: 26,
  contentIv: 'A'.repeat(16),
  wrapIv: 'B'.repeat(16),
  wrappedKey: 'C'.repeat(64),
};

function uploadReturning(value = record) {
  return { completion: Promise.resolve(value), cancel: jest.fn() };
}

test('publishes only the strict encrypted attachment message metadata after upload', async () => {
  const publishMessage = jest.fn(async () => ({ id: 'message-a' }));
  const commit = startEncryptedAttachmentMessageCommit({
    uploadOptions: {},
    startUpload: () => uploadReturning(),
    publishMessage,
    cleanupObject: jest.fn(),
  });
  const result = await commit.completion;
  expect(publishMessage).toHaveBeenCalledWith({
    type: 'encrypted_attachment',
    encryptedAttachment: expect.objectContaining({
      path: record.path,
      conversationId: 'chat-a',
      senderUid: 'alice',
      ciphertextBytes: 26,
    }),
  });
  expect(result.messageResult).toEqual({ id: 'message-a' });
});

test('removes uploaded ciphertext when Firestore message publication fails', async () => {
  const publishFailure = new Error('firestore unavailable');
  const cleanupObject = jest.fn(async () => undefined);
  const commit = startEncryptedAttachmentMessageCommit({
    uploadOptions: {}, startUpload: () => uploadReturning(), cleanupObject,
    publishMessage: async () => { throw publishFailure; },
  });
  await expect(commit.completion).rejects.toMatchObject({
    name: 'EncryptedAttachmentCommitError',
    cause: publishFailure,
    cleanupComplete: true,
  });
  expect(cleanupObject).toHaveBeenCalledWith(record);
});

test('surfaces cleanup-pending state if both publication and rollback fail', async () => {
  const cleanupFailure = new Error('storage unavailable');
  const commit = startEncryptedAttachmentMessageCommit({
    uploadOptions: {}, startUpload: () => uploadReturning(),
    publishMessage: async () => { throw new Error('firestore unavailable'); },
    cleanupObject: async () => { throw cleanupFailure; },
  });
  await expect(commit.completion).rejects.toEqual(expect.objectContaining({
    name: 'EncryptedAttachmentCommitError',
    cleanupComplete: false,
    cleanupError: cleanupFailure,
  }));
});

test('cancel propagates to an active upload', () => {
  const upload = uploadReturning();
  const commit = startEncryptedAttachmentMessageCommit({
    uploadOptions: {}, startUpload: () => upload,
    publishMessage: jest.fn(), cleanupObject: jest.fn(),
  });
  commit.cancel();
  expect(upload.cancel).toHaveBeenCalledTimes(1);
  return expect(commit.completion).rejects.toMatchObject({ name: 'AbortError' });
});

test('message deletion precedes object cleanup and reports retryable orphan state', async () => {
  const order = [];
  const success = await deleteEncryptedAttachmentMessage({
    deleteMessage: async () => order.push('message'),
    deleteObject: async () => order.push('object'),
  });
  expect(order).toEqual(['message', 'object']);
  expect(success).toEqual({ messageDeleted: true, objectDeleted: true, cleanupPending: false });

  const pending = await deleteEncryptedAttachmentMessage({
    deleteMessage: async () => undefined,
    deleteObject: async () => { throw new Error('storage unavailable'); },
  });
  expect(pending).toEqual({ messageDeleted: true, objectDeleted: false, cleanupPending: true });
});

test('does not delete ciphertext if authoritative message deletion fails', async () => {
  const deleteObject = jest.fn();
  await expect(deleteEncryptedAttachmentMessage({
    deleteMessage: async () => { throw new Error('permission denied'); },
    deleteObject,
  })).rejects.toThrow('permission denied');
  expect(deleteObject).not.toHaveBeenCalled();
});

test('commit errors expose cleanup state without replacing the original cause', () => {
  const cause = new Error('publish');
  const error = new EncryptedAttachmentCommitError('failed', { cause, cleanupComplete: true });
  expect(error.cause).toBe(cause);
  expect(error.cleanupComplete).toBe(true);
});
