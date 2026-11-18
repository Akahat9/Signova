import { deleteObject, getBytes, ref, uploadBytesResumable } from 'firebase/storage';
import { decryptAttachment, encryptAttachment, MAX_ATTACHMENT_BYTES } from './encryptedAttachments';

const IDENTIFIER = /^[A-Za-z0-9._-]{1,128}$/;
const MAX_CIPHERTEXT_BYTES = MAX_ATTACHMENT_BYTES + 16;

function validateIdentifier(value, field) {
  const normalized = String(value || '').trim();
  if (!IDENTIFIER.test(normalized)) throw new Error(`Invalid ${field}`);
  return normalized;
}

export function encryptedAttachmentPath({ conversationId, senderUid, attachmentId }) {
  const chat = validateIdentifier(conversationId, 'conversationId');
  const sender = validateIdentifier(senderUid, 'senderUid');
  const attachment = validateIdentifier(attachmentId, 'attachmentId');
  return `encryptedChatAttachments/${chat}/${sender}/${attachment}.bin`;
}

export function buildEncryptedAttachmentMessageMetadata(record) {
  const descriptor = record?.descriptor || {};
  const path = encryptedAttachmentPath({
    conversationId: descriptor.conversationId,
    senderUid: record?.senderUid,
    attachmentId: descriptor.attachmentId,
  });
  if (record.path !== path) throw new Error('Encrypted attachment path does not match authenticated metadata');
  return {
    version: 1,
    path,
    senderUid: String(record.senderUid),
    conversationId: String(descriptor.conversationId),
    attachmentId: String(descriptor.attachmentId),
    senderDeviceId: String(descriptor.senderDeviceId),
    senderSequence: Number(descriptor.senderSequence),
    contentType: String(descriptor.contentType),
    plaintextBytes: Number(descriptor.plaintextBytes),
    plaintextSha256: String(descriptor.plaintextSha256),
    ciphertextBytes: Number(record.ciphertextBytes),
    contentIv: String(record.contentIv),
    wrapIv: String(record.wrapIv),
    wrappedKey: String(record.wrappedKey),
  };
}

export function attachmentRecordFromMessageMetadata(metadata) {
  return {
    path: metadata?.path,
    senderUid: metadata?.senderUid,
    ciphertextBytes: metadata?.ciphertextBytes,
    contentIv: metadata?.contentIv,
    wrapIv: metadata?.wrapIv,
    wrappedKey: metadata?.wrappedKey,
    descriptor: {
      version: metadata?.version,
      conversationId: metadata?.conversationId,
      attachmentId: metadata?.attachmentId,
      senderDeviceId: metadata?.senderDeviceId,
      senderSequence: metadata?.senderSequence,
      contentType: metadata?.contentType,
      plaintextBytes: metadata?.plaintextBytes,
      plaintextSha256: metadata?.plaintextSha256,
    },
  };
}

function awaitUploadTask(task, onProgress) {
  return new Promise((resolve, reject) => {
    task.on('state_changed', (snapshot) => {
      const total = Number(snapshot.totalBytes || 0);
      const transferred = Number(snapshot.bytesTransferred || 0);
      onProgress?.({
        bytesTransferred: transferred,
        totalBytes: total,
        progress: total ? Math.round((transferred / total) * 100) : 0,
      });
    }, reject, () => resolve(task.snapshot));
  });
}

export function startEncryptedAttachmentUpload({
  storage,
  conversationKey,
  input,
  context,
  senderUid,
  onProgress,
  cryptoProvider = window.crypto,
  makeRef = ref,
  createUploadTask = uploadBytesResumable,
  encrypt = encryptAttachment,
} = {}) {
  if (!storage || !conversationKey) throw new Error('Storage and conversation key are required');
  const path = encryptedAttachmentPath({ ...context, senderUid });
  let task;
  let cancelled = false;
  const completion = (async () => {
    const envelope = await encrypt(conversationKey, input, context, cryptoProvider);
    if (cancelled) throw new DOMException('Encrypted attachment upload cancelled', 'AbortError');
    const ciphertext = new Blob([envelope.ciphertext], { type: 'application/octet-stream' });
    task = createUploadTask(makeRef(storage, path), ciphertext, {
      contentType: 'application/octet-stream',
      customMetadata: {
        encryptionVersion: '1',
        chatId: String(context.conversationId),
        senderUid: String(senderUid),
      },
    });
    await awaitUploadTask(task, onProgress);
    return {
      path,
      senderUid: String(senderUid),
      descriptor: envelope.descriptor,
      contentIv: envelope.contentIv,
      wrapIv: envelope.wrapIv,
      wrappedKey: envelope.wrappedKey,
      ciphertextBytes: envelope.ciphertext.byteLength,
    };
  })();
  return {
    completion,
    cancel() {
      cancelled = true;
      task?.cancel?.();
    },
  };
}

export async function downloadEncryptedAttachment({
  storage,
  conversationKey,
  record,
  cryptoProvider = window.crypto,
  makeRef = ref,
  readBytes = getBytes,
  decrypt = decryptAttachment,
} = {}) {
  if (!storage || !conversationKey || !record) throw new Error('Storage, conversation key, and attachment record are required');
  const expectedPath = encryptedAttachmentPath({
    conversationId: record.descriptor?.conversationId,
    senderUid: record.senderUid || record.descriptor?.senderUid,
    attachmentId: record.descriptor?.attachmentId,
  });
  if (record.path !== expectedPath) throw new Error('Encrypted attachment path does not match authenticated metadata');
  const ciphertext = new Uint8Array(await readBytes(makeRef(storage, record.path), MAX_CIPHERTEXT_BYTES));
  if (record.ciphertextBytes !== ciphertext.byteLength) throw new Error('Encrypted attachment ciphertext size mismatch');
  return decrypt(conversationKey, { ...record, ciphertext }, cryptoProvider);
}

export async function deleteEncryptedAttachment({
  storage,
  record,
  makeRef = ref,
  remove = deleteObject,
} = {}) {
  if (!storage || !record) throw new Error('Storage and attachment record are required');
  const expectedPath = encryptedAttachmentPath({
    conversationId: record.descriptor?.conversationId,
    senderUid: record.senderUid || record.descriptor?.senderUid,
    attachmentId: record.descriptor?.attachmentId,
  });
  if (record.path !== expectedPath) throw new Error('Encrypted attachment path does not match authenticated metadata');
  await remove(makeRef(storage, record.path));
}

export { MAX_CIPHERTEXT_BYTES };
