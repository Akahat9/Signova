import {
  buildEncryptedAttachmentMessageMetadata,
  deleteEncryptedAttachment,
  startEncryptedAttachmentUpload,
} from './encryptedAttachmentTransport';

export class EncryptedAttachmentCommitError extends Error {
  constructor(message, { cause, cleanupComplete, cleanupError } = {}) {
    super(message);
    this.name = 'EncryptedAttachmentCommitError';
    this.cause = cause;
    this.cleanupComplete = Boolean(cleanupComplete);
    this.cleanupError = cleanupError;
  }
}

export function startEncryptedAttachmentMessageCommit({
  uploadOptions,
  publishMessage,
  startUpload = startEncryptedAttachmentUpload,
  cleanupObject,
} = {}) {
  if (typeof publishMessage !== 'function') throw new Error('publishMessage is required');
  const upload = startUpload(uploadOptions);
  let cancelled = false;
  const cleanup = cleanupObject || ((record) => deleteEncryptedAttachment({
    storage: uploadOptions?.storage,
    record,
  }));
  const completion = (async () => {
    const record = await upload.completion;
    if (cancelled) {
      await cleanup(record);
      throw new DOMException('Encrypted attachment commit cancelled', 'AbortError');
    }
    const encryptedAttachment = buildEncryptedAttachmentMessageMetadata(record);
    try {
      const messageResult = await publishMessage({ type: 'encrypted_attachment', encryptedAttachment });
      return { record, encryptedAttachment, messageResult };
    } catch (cause) {
      try {
        await cleanup(record);
        throw new EncryptedAttachmentCommitError('Encrypted attachment message publish failed; ciphertext was removed', {
          cause,
          cleanupComplete: true,
        });
      } catch (cleanupError) {
        if (cleanupError instanceof EncryptedAttachmentCommitError) throw cleanupError;
        throw new EncryptedAttachmentCommitError('Encrypted attachment message publish failed and ciphertext cleanup is pending', {
          cause,
          cleanupComplete: false,
          cleanupError,
        });
      }
    }
  })();
  return {
    completion,
    cancel() {
      cancelled = true;
      upload.cancel?.();
    },
  };
}

export async function deleteEncryptedAttachmentMessage({
  deleteMessage,
  deleteObject,
} = {}) {
  if (typeof deleteMessage !== 'function' || typeof deleteObject !== 'function') {
    throw new Error('deleteMessage and deleteObject are required');
  }
  await deleteMessage();
  try {
    await deleteObject();
    return { messageDeleted: true, objectDeleted: true, cleanupPending: false };
  } catch {
    return { messageDeleted: true, objectDeleted: false, cleanupPending: true };
  }
}
