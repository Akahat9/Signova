export const PRIVACY_CAPABILITIES = Object.freeze({
  savedTrainingVideo: false,
  privateCommunityIdentity: false,
});

export function mayProcessCamera(privacy = {}) {
  return privacy.cameraProcessing !== false;
}

export function mayPersistChatHistory(privacy = {}) {
  return privacy.saveChatHistory !== false;
}

export function mayShareProfile(privacy = {}) {
  return privacy.qrSharing !== false;
}

export function buildHistoryDeletionTargets(callHistory = []) {
  const callIds = Array.from(new Set(
    (Array.isArray(callHistory) ? callHistory : [])
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean),
  ));
  return [
    { collection: 'chatState', id: 'messages' },
    ...callIds.map((id) => ({ collection: 'callHistory', id })),
  ];
}
