import { buildMlsKeyPackageRecord, MLS_CIPHERSUITE, publishMlsKeyPackage } from './mlsKeyPackageDirectory';

const now = Date.UTC(2026, 0, 1);
const input = {
  ownerUid: 'owner-a', deviceId: 'device-a', packageId: 'package-a',
  keyPackageBase64: 'A'.repeat(128), credentialFingerprint: 'B'.repeat(43) + '=',
  expiresAtMs: now + 3600_000,
};

test('builds a bounded one-time MLS publication record', () => {
  const record = buildMlsKeyPackageRecord(input, { now: () => now, serverTimestamp: () => 'server-time' });
  expect(record).toMatchObject({ protocol: 'MLS10', ciphersuite: MLS_CIPHERSUITE, status: 'available', claimedBy: null });
  expect(() => buildMlsKeyPackageRecord({ ...input, expiresAtMs: now + 8 * 86400_000 }, { now: () => now })).toThrow('expiry');
});

test('publishes only to the authenticated owner/device/package path', async () => {
  const setDoc = jest.fn(async () => undefined);
  const makeDoc = jest.fn((...segments) => segments.slice(1).join('/'));
  await publishMlsKeyPackage({}, input, { now: () => now, serverTimestamp: () => 'server-time', doc: makeDoc, setDoc });
  expect(setDoc).toHaveBeenCalledWith('mlsKeyPackageDirectories/owner-a/devices/device-a/mlsKeyPackages/package-a', expect.objectContaining({ ownerUid: 'owner-a' }));
});

test('rejects malformed package bytes and credential fingerprints before Firestore', () => {
  expect(() => buildMlsKeyPackageRecord({ ...input, keyPackageBase64: '!' }, { now: () => now })).toThrow('keyPackageBase64');
  expect(() => buildMlsKeyPackageRecord({ ...input, credentialFingerprint: 'short' }, { now: () => now })).toThrow('credentialFingerprint');
});

