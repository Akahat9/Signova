import { createDeviceVerification, verifyDeviceVerificationPayload } from './deviceVerification';
import { exportSignedDevicePublicBundle, generateDeviceKeyBundle } from './e2eePrimitives';

const { webcrypto } = require('crypto');

async function bundles() {
  const aliceKeys = await generateDeviceKeyBundle(webcrypto);
  const bobKeys = await generateDeviceKeyBundle(webcrypto);
  return {
    alice: await exportSignedDevicePublicBundle(aliceKeys, 'alice-device', webcrypto),
    bob: await exportSignedDevicePublicBundle(bobKeys, 'bob-device', webcrypto),
  };
}

test('both devices derive the same safety number and QR payload regardless of order', async () => {
  const { alice, bob } = await bundles();
  const left = await createDeviceVerification('alice-user', alice, 'bob-user', bob, webcrypto);
  const right = await createDeviceVerification('bob-user', bob, 'alice-user', alice, webcrypto);
  expect(left.safetyNumber).toBe(right.safetyNumber);
  expect(left.payload).toBe(right.payload);
  expect(left.safetyNumber.split(' ')).toHaveLength(12);
  expect(verifyDeviceVerificationPayload(left.payload, right)).toBe(true);
});

test('tampered or unexpected verification payloads are rejected', async () => {
  const { alice, bob } = await bundles();
  const verification = await createDeviceVerification('alice-user', alice, 'bob-user', bob, webcrypto);
  expect(verifyDeviceVerificationPayload(`${verification.payload}x`, verification)).toBe(false);
  expect(verifyDeviceVerificationPayload(verification.payload, {
    ...verification,
    safetyNumber: `9${verification.safetyNumber}`,
  })).toBe(false);
});

test('invalid signed bundles cannot produce a trusted safety number', async () => {
  const { alice, bob } = await bundles();
  await expect(createDeviceVerification('alice-user', alice, 'bob-user', {
    ...bob,
    deviceId: 'substituted-device',
  }, webcrypto)).rejects.toThrow(/valid/i);
});
