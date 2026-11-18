const encoder = new TextEncoder();
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function canonicalDescriptor(descriptor) {
  return JSON.stringify({
    version: 1,
    conversationId: String(descriptor.conversationId || ''),
    attachmentId: String(descriptor.attachmentId || ''),
    senderDeviceId: String(descriptor.senderDeviceId || ''),
    senderSequence: Number(descriptor.senderSequence),
    contentType: String(descriptor.contentType || 'application/octet-stream'),
    plaintextBytes: Number(descriptor.plaintextBytes),
    plaintextSha256: String(descriptor.plaintextSha256 || ''),
  });
}

function validateContext(context) {
  if (!context?.conversationId || !context?.attachmentId || !context?.senderDeviceId) throw new Error('Complete attachment context is required');
  if (!Number.isSafeInteger(context.senderSequence) || context.senderSequence < 1) throw new Error('Valid senderSequence is required');
}

async function toUint8Array(input) {
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input?.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  throw new Error('Attachment must be a Blob, ArrayBuffer, or typed array');
}

export async function encryptAttachment(conversationKey, input, context, cryptoProvider = window.crypto) {
  validateContext(context);
  const plaintext = await toUint8Array(input);
  if (!plaintext.byteLength || plaintext.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('Attachment size is outside the encrypted media policy');
  const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', plaintext));
  const descriptor = {
    version: 1,
    conversationId: context.conversationId,
    attachmentId: context.attachmentId,
    senderDeviceId: context.senderDeviceId,
    senderSequence: context.senderSequence,
    contentType: context.contentType || input.type || 'application/octet-stream',
    plaintextBytes: plaintext.byteLength,
    plaintextSha256: hex(digest),
  };
  const aad = encoder.encode(canonicalDescriptor(descriptor));
  const contentKey = await cryptoProvider.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawContentKey = new Uint8Array(await cryptoProvider.subtle.exportKey('raw', contentKey));
  const contentIv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const wrapIv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv: contentIv, additionalData: aad, tagLength: 128 }, contentKey, plaintext,
  ));
  const wrappedKey = new Uint8Array(await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIv, additionalData: aad, tagLength: 128 }, conversationKey, rawContentKey,
  ));
  rawContentKey.fill(0);
  return {
    descriptor,
    contentIv: bytesToBase64(contentIv),
    wrapIv: bytesToBase64(wrapIv),
    wrappedKey: bytesToBase64(wrappedKey),
    ciphertext,
  };
}

export async function decryptAttachment(conversationKey, envelope, cryptoProvider = window.crypto) {
  validateContext(envelope?.descriptor);
  if (envelope.descriptor.version !== 1) throw new Error('Unsupported encrypted attachment version');
  const ciphertext = await toUint8Array(envelope.ciphertext);
  const aad = encoder.encode(canonicalDescriptor(envelope.descriptor));
  const rawContentKey = new Uint8Array(await cryptoProvider.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.wrapIv), additionalData: aad, tagLength: 128 },
    conversationKey,
    base64ToBytes(envelope.wrappedKey),
  ));
  try {
    const contentKey = await cryptoProvider.subtle.importKey('raw', rawContentKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = new Uint8Array(await cryptoProvider.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.contentIv), additionalData: aad, tagLength: 128 },
      contentKey,
      ciphertext,
    ));
    if (plaintext.byteLength !== envelope.descriptor.plaintextBytes) throw new Error('Encrypted attachment size mismatch');
    const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', plaintext));
    if (hex(digest) !== envelope.descriptor.plaintextSha256) throw new Error('Encrypted attachment checksum mismatch');
    return plaintext;
  } finally {
    rawContentKey.fill(0);
  }
}

export { MAX_ATTACHMENT_BYTES };
