import { MessageReplayGuard } from './messageReplayGuard';

const metadata = (sequence, messageId = `message-${sequence}`, device = 'device-a') => ({
  senderDeviceId: device,
  senderSequence: sequence,
  messageId,
});

test('accepts bounded out-of-order delivery once and rejects replay', () => {
  const guard = new MessageReplayGuard(8);
  expect(guard.accept(metadata(1))).toBe(true);
  expect(guard.accept(metadata(3))).toBe(true);
  expect(guard.accept(metadata(2))).toBe(true);
  expect(guard.accept(metadata(2, 'different-id'))).toBe(false);
  expect(guard.accept(metadata(4, 'message-1'))).toBe(false);
});

test('rejects sequences older than the retained replay window', () => {
  const guard = new MessageReplayGuard(8);
  for (let sequence = 1; sequence <= 10; sequence += 1) expect(guard.accept(metadata(sequence))).toBe(true);
  expect(guard.accept(metadata(1, 'late-message'))).toBe(false);
  expect(guard.snapshot()[0].seenSequences).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
});

test('tracks sender devices independently', () => {
  const guard = new MessageReplayGuard();
  expect(guard.accept(metadata(1, 'alice-1', 'alice-device'))).toBe(true);
  expect(guard.accept(metadata(1, 'bob-1', 'bob-device'))).toBe(true);
});
