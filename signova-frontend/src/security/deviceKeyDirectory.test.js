import { buildDeviceDirectoryRecord, listActiveDevicePublicBundles, revokeDevicePublicBundle } from './deviceKeyDirectory';

const bundle = {
  version: 1,
  deviceId: 'device-a',
  agreementPublicKey: 'agreement',
  signingPublicKey: 'signing',
  agreementSignature: 'signature',
  fingerprint: 'fingerprint',
};

test('builds an owner-bound active directory record only after verification', async () => {
  const timestamps = [{ seconds: 1 }, { seconds: 2 }];
  const record = await buildDeviceDirectoryRecord('user-a', bundle, {
    verifyBundle: async () => true,
    serverTimestamp: () => timestamps.shift(),
  });
  expect(record).toMatchObject({ ownerUid: 'user-a', deviceId: 'device-a', status: 'active', revokedAt: null });
  await expect(buildDeviceDirectoryRecord('user-a', bundle, { verifyBundle: async () => false })).rejects.toThrow(/invalid/i);
});

test('revocation is a history-preserving status update', async () => {
  const writes = [];
  await revokeDevicePublicBundle('db', 'user-a', 'device-a', {
    doc: (...parts) => parts.join('/'),
    updateDoc: async (reference, value) => writes.push({ reference, value }),
    serverTimestamp: () => 'server-time',
  });
  expect(writes).toEqual([{
    reference: 'db/e2eeDeviceDirectories/user-a/devices/device-a',
    value: { status: 'revoked', revokedAt: 'server-time', updatedAt: 'server-time' },
  }]);
});

test('directory lookup discards malformed, mismatched, and unverifiable records', async () => {
  const valid = { ...bundle, ownerUid: 'user-a', status: 'active' };
  const docs = [
    { id: 'device-a', data: () => valid },
    { id: 'wrong-id', data: () => valid },
    { id: 'device-b', data: () => ({ ...valid, deviceId: 'device-b', agreementSignature: 'bad' }) },
  ];
  const result = await listActiveDevicePublicBundles('db', 'user-a', {
    collection: (...parts) => parts.join('/'),
    where: (...parts) => parts,
    query: (...parts) => parts,
    getDocs: async () => ({ docs }),
    verifyBundle: async (candidate) => candidate.agreementSignature === 'signature',
  });
  expect(result).toEqual([bundle]);
});
