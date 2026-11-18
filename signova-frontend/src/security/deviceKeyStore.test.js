import { IDBFactory } from 'fake-indexeddb';
import { deleteDeviceKeyBundle, loadDeviceKeyBundle, saveDeviceKeyBundle } from './deviceKeyStore';
import { generateDeviceKeyBundle } from './e2eePrimitives';

const { webcrypto } = require('crypto');

test('persists and removes non-exportable device CryptoKeys', async () => {
  const originalStructuredClone = global.structuredClone;
  global.structuredClone = originalStructuredClone || ((value) => value);
  const indexedDBProvider = new IDBFactory();
  const keys = await generateDeviceKeyBundle(webcrypto);
  expect(keys.agreement.privateKey.extractable).toBe(false);
  expect(keys.signing.privateKey.extractable).toBe(false);

  await saveDeviceKeyBundle('device-a', keys, indexedDBProvider);
  const restored = await loadDeviceKeyBundle('device-a', indexedDBProvider);
  expect(restored.deviceId).toBe('device-a');
  expect(restored.agreement.privateKey.type).toBe('private');
  expect(restored.signing.privateKey.type).toBe('private');

  await deleteDeviceKeyBundle('device-a', indexedDBProvider);
  await expect(loadDeviceKeyBundle('device-a', indexedDBProvider)).resolves.toBeNull();
  global.structuredClone = originalStructuredClone;
});
