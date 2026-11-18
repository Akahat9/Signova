const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_CONTEXT = 'signova-local-session-v1';
const MAX_LOCAL_TEXT_BYTES = 16 * 1024;

function bytesToBase64(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach((value) => { binary += String.fromCharCode(value); });
  return window.btoa(binary);
}

function base64ToBytes(value, field) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`Invalid local ${field}`);
  try {
    return Uint8Array.from(window.atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error(`Invalid local ${field}`);
  }
}

function normalizedContext(context) {
  const value = String(context || DEFAULT_CONTEXT);
  if (!value || value.length > 256) throw new Error('Invalid local protection context');
  return value;
}

export async function createLocalSessionProtectionKey(cryptoProvider = window.crypto) {
  if (!cryptoProvider?.subtle) throw new Error('Web Crypto is unavailable');
  return cryptoProvider.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function protectLocalSessionText(key, text, {
  context = DEFAULT_CONTEXT,
  cryptoProvider = window.crypto,
} = {}) {
  if (!key) throw new Error('Local session key is required');
  const plaintext = encoder.encode(String(text || ''));
  if (!plaintext.byteLength || plaintext.byteLength > MAX_LOCAL_TEXT_BYTES) throw new Error('Local session text is outside policy');
  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const aad = encoder.encode(normalizedContext(context));
  const ciphertext = await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext,
  );
  return {
    version: 1,
    algorithm: 'AES-256-GCM-local-session',
    cipherText: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
  };
}

export async function revealLocalSessionText(key, payload, {
  context = DEFAULT_CONTEXT,
  cryptoProvider = window.crypto,
} = {}) {
  if (!key || payload?.version !== 1 || payload?.algorithm !== 'AES-256-GCM-local-session') {
    throw new Error('Unsupported local session payload');
  }
  const iv = base64ToBytes(payload.iv, 'IV');
  const ciphertext = base64ToBytes(payload.cipherText, 'ciphertext');
  if (iv.byteLength !== 12 || ciphertext.byteLength < 17 || ciphertext.byteLength > MAX_LOCAL_TEXT_BYTES + 16) {
    throw new Error('Invalid local session payload size');
  }
  const plaintext = await cryptoProvider.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(normalizedContext(context)), tagLength: 128 },
    key,
    ciphertext,
  );
  return decoder.decode(plaintext);
}

export { MAX_LOCAL_TEXT_BYTES };
