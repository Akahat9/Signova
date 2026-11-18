import { IDBFactory } from 'fake-indexeddb';
import { createDeviceVerification } from './deviceVerification';
import { exportSignedDevicePublicBundle, generateDeviceKeyBundle } from './e2eePrimitives';
import { getDeviceTrust, recordVerifiedDevice, revokeVerifiedDevice } from './verifiedDeviceStore';

const { webcrypto } = require('crypto');
const originalStructuredClone = global.structuredClone;
beforeAll(() => { global.structuredClone = originalStructuredClone || ((value) => JSON.parse(JSON.stringify(value))); });
afterAll(() => { global.structuredClone = originalStructuredClone; });

async function fixture() {
  const aliceKeys = await generateDeviceKeyBundle(webcrypto);
  const bobKeys = await generateDeviceKeyBundle(webcrypto);
  const alice = await exportSignedDevicePublicBundle(aliceKeys, 'alice-device', webcrypto);
  const bob = await exportSignedDevicePublicBundle(bobKeys, 'bob-device', webcrypto);
  const verification = await createDeviceVerification('alice-user', alice, 'bob-user', bob, webcrypto);
  return { alice, bob, verification };
}

test('persists fingerprint-bound verification and detects key changes', async () => {
  const indexedDBProvider = new IDBFactory();
  const { bob, verification } = await fixture();
  const params = {
    localUserId: 'alice-user', localDeviceId: 'alice-device', remoteUserId: 'bob-user',
    remoteBundle: bob, verification, payload: verification.payload,
  };
  await recordVerifiedDevice(params, { indexedDBProvider, cryptoProvider: webcrypto });
  await expect(getDeviceTrust('alice-user', 'alice-device', 'bob-user', bob, { indexedDBProvider, cryptoProvider: webcrypto })).resolves.toMatchObject({ status: 'verified' });
  const replacementKeys = await generateDeviceKeyBundle(webcrypto);
  const replacement = await exportSignedDevicePublicBundle(replacementKeys, 'bob-device', webcrypto);
  await expect(getDeviceTrust('alice-user', 'alice-device', 'bob-user', replacement, { indexedDBProvider, cryptoProvider: webcrypto })).resolves.toMatchObject({ status: 'changed' });
  await expect(getDeviceTrust('alice-user', 'alice-device', 'bob-user', { ...bob, fingerprint: 'bad' }, { indexedDBProvider, cryptoProvider: webcrypto })).resolves.toMatchObject({ status: 'invalid' });
});

test('revocation is persisted and cannot look verified afterward', async () => {
  const indexedDBProvider = new IDBFactory();
  const { bob, verification } = await fixture();
  await recordVerifiedDevice({
    localUserId: 'alice-user', localDeviceId: 'alice-device', remoteUserId: 'bob-user',
    remoteBundle: bob, verification, payload: verification.payload,
  }, { indexedDBProvider, cryptoProvider: webcrypto });
  await expect(revokeVerifiedDevice('alice-user', 'alice-device', 'bob-user', 'bob-device', { indexedDBProvider })).resolves.toBe(true);
  await expect(getDeviceTrust('alice-user', 'alice-device', 'bob-user', bob, { indexedDBProvider, cryptoProvider: webcrypto })).resolves.toMatchObject({ status: 'revoked' });
});

test('mismatched QR payload cannot create a verified trust record', async () => {
  const indexedDBProvider = new IDBFactory();
  const { bob, verification } = await fixture();
  await expect(recordVerifiedDevice({
    localUserId: 'alice-user', localDeviceId: 'alice-device', remoteUserId: 'bob-user',
    remoteBundle: bob, verification, payload: `${verification.payload}tampered`,
  }, { indexedDBProvider, cryptoProvider: webcrypto })).rejects.toThrow(/does not match/i);
});
