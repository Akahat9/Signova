import { createAttachmentObjectUrlRegistry, sanitizeAttachmentMessagesForPersistence } from './attachmentUrlLifecycle';

test('tracks and releases only session-owned blob URLs once', () => {
  const revokeObjectURL = jest.fn();
  const registry = createAttachmentObjectUrlRegistry({ revokeObjectURL });
  expect(registry.track('blob:one')).toBe('blob:one');
  registry.track('https://example.test/file');
  expect(registry.size).toBe(1);
  expect(registry.release('blob:one')).toBe(true);
  expect(registry.release('blob:one')).toBe(false);
  expect(revokeObjectURL).toHaveBeenCalledTimes(1);
});

test('removes session-only blob URLs before chat persistence without mutating live messages', () => {
  const live = [
    { id: 'a', attachmentData: { url: 'blob:private', title: 'Private' } },
    { id: 'b', attachmentData: { url: 'https://durable.test/file', title: 'Durable' } },
  ];
  const persisted = sanitizeAttachmentMessagesForPersistence(live);
  expect(persisted[0].attachmentData).toEqual({ url: '', title: 'Private', previewExpired: true });
  expect(persisted[1]).toBe(live[1]);
  expect(live[0].attachmentData.url).toBe('blob:private');
});

test('releases attachment messages and all remaining URLs on teardown', () => {
  const revokeObjectURL = jest.fn();
  const registry = createAttachmentObjectUrlRegistry({ revokeObjectURL });
  ['blob:a', 'blob:b', 'blob:c'].forEach((url) => registry.track(url));
  expect(registry.releaseMessages([
    { attachmentData: { url: 'blob:a' } },
    { attachmentData: { url: 'blob:b' } },
    { text: 'no attachment' },
  ])).toBe(2);
  expect(registry.size).toBe(1);
  expect(registry.releaseAll()).toBe(1);
  expect(registry.size).toBe(0);
  expect(revokeObjectURL.mock.calls.map(([url]) => url).sort()).toEqual(['blob:a', 'blob:b', 'blob:c']);
});
