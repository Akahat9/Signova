import {
  createLocalChatLockCredential,
  LOCAL_CHAT_LOCK_ALGORITHM,
  LOCAL_CHAT_LOCK_ITERATIONS,
  migrateLegacyChatLockFlags,
  verifyLegacyChatLock,
  verifyLocalChatLockCredential,
} from './localChatLock';

const { webcrypto } = require('crypto');

test('creates a salted PBKDF2 credential and verifies only the matching secret', async () => {
  const credential = await createLocalChatLockCredential('correct horse', { cryptoProvider: webcrypto });
  expect(credential).toMatchObject({ version: 2, algorithm: LOCAL_CHAT_LOCK_ALGORITHM, iterations: LOCAL_CHAT_LOCK_ITERATIONS });
  expect(credential).not.toHaveProperty('password');
  await expect(verifyLocalChatLockCredential('correct horse', credential, { cryptoProvider: webcrypto })).resolves.toBe(true);
  await expect(verifyLocalChatLockCredential('wrong password', credential, { cryptoProvider: webcrypto })).resolves.toBe(false);
});

test('uses fresh salts and rejects weak or oversized new credentials', async () => {
  const first = await createLocalChatLockCredential('same secret', { cryptoProvider: webcrypto });
  const second = await createLocalChatLockCredential('same secret', { cryptoProvider: webcrypto });
  expect(first.salt).not.toBe(second.salt);
  expect(first.verifier).not.toBe(second.verifier);
  await expect(createLocalChatLockCredential('123', { cryptoProvider: webcrypto })).rejects.toThrow(/6-128/);
  await expect(createLocalChatLockCredential('x'.repeat(129), { cryptoProvider: webcrypto })).rejects.toThrow(/6-128/);
});

test('fails closed for malformed, downgraded, or unsupported credentials', async () => {
  const credential = await createLocalChatLockCredential('valid secret', { cryptoProvider: webcrypto });
  await expect(verifyLocalChatLockCredential('valid secret', { ...credential, iterations: 1 }, { cryptoProvider: webcrypto })).rejects.toThrow(/unsupported/i);
  await expect(verifyLocalChatLockCredential('valid secret', { ...credential, salt: 'bad!' }, { cryptoProvider: webcrypto })).rejects.toThrow(/invalid/i);
  await expect(createLocalChatLockCredential('valid secret', { cryptoProvider: {} })).rejects.toThrow(/unavailable/i);
});

test('supports one-time legacy plaintext and SHA-256 verification for migration', async () => {
  await expect(verifyLegacyChatLock('old-pin', { password: 'old-pin' }, { cryptoProvider: webcrypto })).resolves.toBe(true);
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('contact-1:old-pin'));
  const passwordHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await expect(verifyLegacyChatLock('old-pin', { passwordHash, passwordSalt: 'contact-1' }, { contactId: 'contact-1', cryptoProvider: webcrypto })).resolves.toBe(true);
  await expect(verifyLegacyChatLock('wrong', { passwordHash, passwordSalt: 'contact-1' }, { contactId: 'contact-1', cryptoProvider: webcrypto })).resolves.toBe(false);
});

test('bulk-migrates persisted plaintext atomically without mutating unrelated flags', async () => {
  const original = {
    one: { password: '1234', passwordSet: true, locked: true, pinned: true },
    two: { muted: true },
  };
  const result = await migrateLegacyChatLockFlags(original, { cryptoProvider: webcrypto });
  expect(result.migratedCount).toBe(1);
  expect(result.flags.one).toMatchObject({ passwordSet: true, locked: true, pinned: true, chatLockCredential: expect.any(Object) });
  expect(result.flags.one.password).toBeUndefined();
  expect(result.flags.two).toEqual({ muted: true });
  expect(original.one.password).toBe('1234');
  await expect(verifyLocalChatLockCredential('1234', result.flags.one.chatLockCredential, { cryptoProvider: webcrypto })).resolves.toBe(true);
});

test('bulk migration fails without returning a partially sanitized credential map', async () => {
  const original = { one: { password: 'legacy', locked: true }, two: { pinned: true } };
  await expect(migrateLegacyChatLockFlags(original, { cryptoProvider: {} })).rejects.toThrow(/unavailable/i);
  expect(original.one.password).toBe('legacy');
});
