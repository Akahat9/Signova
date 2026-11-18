import { IDBFactory } from 'fake-indexeddb';
import { allocateSenderSequence, readSenderSequence } from './messageSequenceStore';

const originalStructuredClone = global.structuredClone;

beforeAll(() => {
  global.structuredClone = originalStructuredClone || ((value) => JSON.parse(JSON.stringify(value)));
});

afterAll(() => {
  global.structuredClone = originalStructuredClone;
});

test('atomically allocates durable monotonically increasing sender sequences', async () => {
  const indexedDBProvider = new IDBFactory();
  const allocated = await Promise.all(Array.from({ length: 12 }, () => (
    allocateSenderSequence('conversation-a', 'device-a', indexedDBProvider)
  )));
  expect([...allocated].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  await expect(readSenderSequence('conversation-a', 'device-a', indexedDBProvider)).resolves.toBe(12);
  await expect(allocateSenderSequence('conversation-a', 'device-a', indexedDBProvider)).resolves.toBe(13);
});

test('keeps conversation and device counters independent', async () => {
  const indexedDBProvider = new IDBFactory();
  await expect(allocateSenderSequence('conversation-a', 'device-a', indexedDBProvider)).resolves.toBe(1);
  await expect(allocateSenderSequence('conversation-b', 'device-a', indexedDBProvider)).resolves.toBe(1);
  await expect(allocateSenderSequence('conversation-a', 'device-b', indexedDBProvider)).resolves.toBe(1);
});
