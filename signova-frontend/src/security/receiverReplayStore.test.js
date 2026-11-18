import { IDBFactory } from 'fake-indexeddb';
import { acceptIncomingSequence } from './receiverReplayStore';

const originalStructuredClone = global.structuredClone;
beforeAll(() => { global.structuredClone = originalStructuredClone || ((value) => JSON.parse(JSON.stringify(value))); });
afterAll(() => { global.structuredClone = originalStructuredClone; });

const message = (senderSequence, messageId = `message-${senderSequence}`, senderDeviceId = 'device-a') => ({
  senderSequence, messageId, senderDeviceId,
});

test('persists replay rejection across independent calls and reload-like reopenings', async () => {
  const indexedDBProvider = new IDBFactory();
  const options = { indexedDBProvider, windowSize: 8 };
  await expect(acceptIncomingSequence('conversation-a', message(1), options)).resolves.toBe(true);
  await expect(acceptIncomingSequence('conversation-a', message(1), options)).resolves.toBe(false);
  await expect(acceptIncomingSequence('conversation-a', message(1, 'different-id'), options)).resolves.toBe(false);
  await expect(acceptIncomingSequence('conversation-a', message(2, 'message-1'), options)).resolves.toBe(false);
});

test('serializes concurrent duplicate delivery atomically', async () => {
  const indexedDBProvider = new IDBFactory();
  const results = await Promise.all(Array.from({ length: 8 }, () => acceptIncomingSequence(
    'conversation-a', message(1), { indexedDBProvider },
  )));
  expect(results.filter(Boolean)).toHaveLength(1);
});

test('accepts bounded out-of-order messages and prunes stale message IDs', async () => {
  const indexedDBProvider = new IDBFactory();
  const options = { indexedDBProvider, windowSize: 8 };
  for (let sequence = 1; sequence <= 10; sequence += 1) {
    await expect(acceptIncomingSequence('conversation-a', message(sequence), options)).resolves.toBe(true);
  }
  await expect(acceptIncomingSequence('conversation-a', message(2, 'late-old'), options)).resolves.toBe(false);
  await expect(acceptIncomingSequence('conversation-a', message(11, 'message-1'), options)).resolves.toBe(true);
});
