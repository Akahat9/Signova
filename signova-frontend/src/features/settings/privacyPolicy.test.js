import { buildHistoryDeletionTargets, mayPersistChatHistory, mayProcessCamera, mayShareProfile, PRIVACY_CAPABILITIES } from './privacyPolicy';

test('fails closed when explicit camera processing consent is disabled', () => {
  expect(mayProcessCamera({ cameraProcessing: false })).toBe(false);
  expect(mayProcessCamera({ cameraProcessing: true })).toBe(true);
});

test('prevents chat restore and persistence when history saving is disabled', () => {
  expect(mayPersistChatHistory({ saveChatHistory: false })).toBe(false);
  expect(mayPersistChatHistory({ saveChatHistory: true })).toBe(true);
});

test('prevents outbound profile sharing when QR sharing is disabled', () => {
  expect(mayShareProfile({ qrSharing: false })).toBe(false);
  expect(mayShareProfile({ qrSharing: true })).toBe(true);
});

test('reports privacy features that are not implemented', () => {
  expect(PRIVACY_CAPABILITIES).toEqual({
    savedTrainingVideo: false,
    privateCommunityIdentity: false,
  });
});

test('builds deduplicated persisted history cleanup targets', () => {
  expect(buildHistoryDeletionTargets([{ id: 'call-1' }, { id: 'call-1' }, { id: 'call-2' }, null])).toEqual([
    { collection: 'chatState', id: 'messages' },
    { collection: 'callHistory', id: 'call-1' },
    { collection: 'callHistory', id: 'call-2' },
  ]);
  expect(buildHistoryDeletionTargets(null)).toEqual([{ collection: 'chatState', id: 'messages' }]);
});
