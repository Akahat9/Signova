export const LEGACY_MESSAGE_CONTACT_ID = 'signova-ai';

export function normalizeConversationMessage(message, fallbackContactId = LEGACY_MESSAGE_CONTACT_ID) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  const id = String(message.id || '').trim();
  if (!id) return null;
  const contactId = String(message.contactId || fallbackContactId || '').trim();
  if (!contactId) return null;
  return { ...message, id, contactId };
}

export function normalizeConversationMessages(messages, fallbackContactId = LEGACY_MESSAGE_CONTACT_ID) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => normalizeConversationMessage(message, fallbackContactId)).filter(Boolean);
}

export function messagesForContact(messages, contactId) {
  const normalizedContactId = String(contactId || '').trim();
  if (!normalizedContactId) return [];
  return normalizeConversationMessages(messages).filter((message) => message.contactId === normalizedContactId);
}

export function clearConversationMessages(messages, contactId, { preserveIds = [] } = {}) {
  const normalizedContactId = String(contactId || '').trim();
  const preserved = new Set(preserveIds.map(String));
  return normalizeConversationMessages(messages).filter((message) => (
    message.contactId !== normalizedContactId || preserved.has(message.id)
  ));
}

export function mergeRealtimeConversationMessages(messages, contactId, remoteMessages) {
  const current = normalizeConversationMessages(messages);
  const currentById = new Map(current.filter((message) => message.contactId === contactId).map((message) => [message.id, message]));
  const remote = normalizeConversationMessages(remoteMessages, contactId).map((message) => {
    const existing = currentById.get(message.id);
    const existingHasReceipt = existing?.status === 'delivered' || existing?.status === 'read';
    const remoteHasNoReceipt = !message.status || message.status === 'sent';
    return {
      ...message,
      contactId,
      reactions: existing?.reactions?.length ? existing.reactions : (message.reactions || []),
      status: existingHasReceipt && remoteHasNoReceipt ? existing.status : message.status,
      deliveredAt: existingHasReceipt && !message.deliveredAt ? existing.deliveredAt : message.deliveredAt,
      readAt: existing?.status === 'read' && !message.readAt ? existing.readAt : message.readAt,
      seenGlow: existing?.status === 'read' ? existing.seenGlow : message.seenGlow,
      liveActivity: existingHasReceipt && (!message.liveActivity || message.liveActivity === 'Synced through Firebase chat') ? existing.liveActivity : message.liveActivity,
    };
  });
  const remoteIds = new Set(remote.map((message) => message.id));
  const retained = current.filter((message) => (
    message.contactId !== contactId
    || (message.transport !== 'firestore' && !remoteIds.has(message.id))
  ));
  return [...retained, ...remote].sort((first, second) => Number(first.createdAt || 0) - Number(second.createdAt || 0));
}
