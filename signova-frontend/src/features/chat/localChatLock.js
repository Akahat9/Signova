const encoder = new TextEncoder();

export const LOCAL_CHAT_LOCK_VERSION = 2;
export const LOCAL_CHAT_LOCK_ALGORITHM = 'PBKDF2-SHA-256-local-lock';
export const LOCAL_CHAT_LOCK_ITERATIONS = 310_000;
export const MIN_LOCAL_CHAT_LOCK_LENGTH = 6;
export const MAX_LOCAL_CHAT_LOCK_LENGTH = 128;

function requireCrypto(cryptoProvider) {
  if (!cryptoProvider?.subtle || typeof cryptoProvider.getRandomValues !== 'function') {
    throw new Error('Secure chat lock is unavailable in this browser');
  }
}

function normalizeSecret(secret, minimumLength = MIN_LOCAL_CHAT_LOCK_LENGTH) {
  const value = String(secret || '').trim();
  if (value.length < minimumLength || value.length > MAX_LOCAL_CHAT_LOCK_LENGTH) {
    throw new Error(`Chat password must be ${minimumLength}-${MAX_LOCAL_CHAT_LOCK_LENGTH} characters`);
  }
  return value;
}

function bytesToBase64(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach((value) => { binary += String.fromCharCode(value); });
  return window.btoa(binary);
}

function base64ToBytes(value, expectedLength) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid chat lock credential');
  let bytes;
  try { bytes = Uint8Array.from(window.atob(value), (character) => character.charCodeAt(0)); }
  catch { throw new Error('Invalid chat lock credential'); }
  if (bytes.byteLength !== expectedLength) throw new Error('Invalid chat lock credential');
  return bytes;
}

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function deriveVerifier(secret, salt, iterations, cryptoProvider) {
  const material = await cryptoProvider.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await cryptoProvider.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, material, 256));
}

export async function createLocalChatLockCredential(secret, {
  cryptoProvider = window.crypto,
  minimumLength = MIN_LOCAL_CHAT_LOCK_LENGTH,
} = {}) {
  requireCrypto(cryptoProvider);
  const normalized = normalizeSecret(secret, minimumLength);
  const salt = cryptoProvider.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(normalized, salt, LOCAL_CHAT_LOCK_ITERATIONS, cryptoProvider);
  return {
    version: LOCAL_CHAT_LOCK_VERSION,
    algorithm: LOCAL_CHAT_LOCK_ALGORITHM,
    iterations: LOCAL_CHAT_LOCK_ITERATIONS,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
  };
}

export async function verifyLocalChatLockCredential(secret, credential, {
  cryptoProvider = window.crypto,
} = {}) {
  requireCrypto(cryptoProvider);
  const normalized = normalizeSecret(secret, 1);
  if (credential?.version !== LOCAL_CHAT_LOCK_VERSION
    || credential?.algorithm !== LOCAL_CHAT_LOCK_ALGORITHM
    || credential?.iterations !== LOCAL_CHAT_LOCK_ITERATIONS) {
    throw new Error('Unsupported chat lock credential');
  }
  const salt = base64ToBytes(credential.salt, 16);
  const expected = base64ToBytes(credential.verifier, 32);
  const actual = await deriveVerifier(normalized, salt, credential.iterations, cryptoProvider);
  return constantTimeEqual(actual, expected);
}

async function legacySha256(secret, salt, cryptoProvider) {
  requireCrypto(cryptoProvider);
  const digest = await cryptoProvider.subtle.digest('SHA-256', encoder.encode(`${salt}:${secret}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyLegacyChatLock(secret, flags, {
  contactId = '',
  cryptoProvider = window.crypto,
} = {}) {
  const normalized = normalizeSecret(secret, 1);
  if (typeof flags?.password === 'string') return normalized === flags.password;
  if (typeof flags?.passwordHash !== 'string' || !/^[a-f0-9]{64}$/i.test(flags.passwordHash)) return false;
  const hash = await legacySha256(normalized, flags.passwordSalt || contactId, cryptoProvider);
  return hash.toLowerCase() === flags.passwordHash.toLowerCase();
}

export async function migrateLegacyChatLockFlags(chatFlags, {
  cryptoProvider = window.crypto,
} = {}) {
  if (!chatFlags || typeof chatFlags !== 'object' || Array.isArray(chatFlags)) {
    return { flags: {}, migratedCount: 0 };
  }
  const entries = Object.entries(chatFlags).slice(0, 500);
  const migratedEntries = [];
  let migratedCount = 0;

  // Build the complete replacement before returning it. If Web Crypto fails,
  // callers retain the original map and must not persist a partial migration.
  for (const [contactId, rawFlags] of entries) {
    const current = rawFlags && typeof rawFlags === 'object' && !Array.isArray(rawFlags) ? rawFlags : {};
    const {
      password: legacyPassword,
      passwordHash: legacyHash,
      passwordSalt: legacySalt,
      ...safeFlags
    } = current;
    if (safeFlags.chatLockCredential) {
      // A completed migration wins over every stale legacy field.
      migratedEntries.push([contactId, safeFlags]);
      if (legacyPassword !== undefined || legacyHash !== undefined || legacySalt !== undefined) migratedCount += 1;
    } else if (typeof legacyPassword === 'string' && legacyPassword.trim()) {
      const chatLockCredential = await createLocalChatLockCredential(legacyPassword, { cryptoProvider, minimumLength: 1 });
      migratedEntries.push([contactId, { ...safeFlags, chatLockCredential, passwordSet: true }]);
      migratedCount += 1;
    } else {
      migratedEntries.push([contactId, {
        ...safeFlags,
        ...(legacyHash !== undefined ? { passwordHash: legacyHash } : {}),
        ...(legacySalt !== undefined ? { passwordSalt: legacySalt } : {}),
      }]);
    }
  }
  return { flags: Object.fromEntries(migratedEntries), migratedCount };
}
