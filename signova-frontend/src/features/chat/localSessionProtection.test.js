import {
  createLocalSessionProtectionKey,
  MAX_LOCAL_TEXT_BYTES,
  protectLocalSessionText,
  revealLocalSessionText,
} from './localSessionProtection';

const { webcrypto } = require('crypto');

test('round-trips context-bound local text with a non-exportable key', async () => {
  const key = await createLocalSessionProtectionKey(webcrypto);
  expect(key.extractable).toBe(false);
  const payload = await protectLocalSessionText(key, 'local preview only', { context: 'chat:one', cryptoProvider: webcrypto });
  expect(payload).toMatchObject({ version: 1, algorithm: 'AES-256-GCM-local-session' });
  expect(payload.cipherText).not.toContain('local preview only');
  await expect(revealLocalSessionText(key, payload, { context: 'chat:one', cryptoProvider: webcrypto }))
    .resolves.toBe('local preview only');
});

test('fails authentication for context or ciphertext tampering', async () => {
  const key = await createLocalSessionProtectionKey(webcrypto);
  const payload = await protectLocalSessionText(key, 'private', { context: 'group:a', cryptoProvider: webcrypto });
  await expect(revealLocalSessionText(key, payload, { context: 'group:b', cryptoProvider: webcrypto })).rejects.toBeDefined();
  const tampered = { ...payload, cipherText: `${payload.cipherText.slice(0, -2)}AA` };
  await expect(revealLocalSessionText(key, tampered, { context: 'group:a', cryptoProvider: webcrypto })).rejects.toBeDefined();
});

test('rejects malformed, empty, and oversized local payloads', async () => {
  const key = await createLocalSessionProtectionKey(webcrypto);
  await expect(protectLocalSessionText(key, '', { cryptoProvider: webcrypto })).rejects.toThrow(/outside policy/i);
  await expect(protectLocalSessionText(key, 'a'.repeat(MAX_LOCAL_TEXT_BYTES + 1), { cryptoProvider: webcrypto })).rejects.toThrow(/outside policy/i);
  await expect(revealLocalSessionText(key, { version: 1, algorithm: 'AES-256-GCM-local-session', iv: 'bad!', cipherText: 'bad!' }, { cryptoProvider: webcrypto }))
    .rejects.toThrow(/invalid local/i);
});
