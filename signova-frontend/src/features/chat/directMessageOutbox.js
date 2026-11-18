import { sendDirectTextMessage } from './firestoreChatService';

export const DIRECT_MESSAGE_OUTBOX_VERSION = 1;
export const DIRECT_MESSAGE_OUTBOX_LIMIT = 200;
const MAX_OUTBOX_BYTES = 2 * 1024 * 1024;
const SAFE_UID = /^[A-Za-z0-9._-]{1,128}$/;
const SAFE_CONTACT_ID = /^[A-Za-z0-9._-]{1,128}$/;
const SAFE_MESSAGE_ID = /^[A-Za-z0-9._-]{1,128}$/;
const SAFE_CHAT_ID = /^direct-[a-f0-9]{40}$/;

function safeOwner(ownerUid) {
  const value = String(ownerUid || '').trim();
  if (!SAFE_UID.test(value)) throw new Error('Invalid direct-message outbox owner');
  return value;
}

export function directMessageOutboxKey(ownerUid) {
  return `signova-direct-message-outbox:${encodeURIComponent(safeOwner(ownerUid))}`;
}

function normalizeQueuedMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const token = String(value.token || '').trim();
  const ownerUid = String(value.ownerUid || '').trim();
  const senderUid = String(value.senderUid || '').trim();
  const contactId = String(value.contactId || '').trim();
  const chatId = String(value.chatId || '').trim();
  const messageId = String(value.messageId || '').trim();
  const text = String(value.text || '').trim();
  const queuedAt = Number(value.queuedAt);
  if (!SAFE_MESSAGE_ID.test(token)) return null;
  if (!SAFE_UID.test(ownerUid) || !SAFE_UID.test(senderUid) || ownerUid !== senderUid) return null;
  if (!SAFE_CONTACT_ID.test(contactId) || !SAFE_CHAT_ID.test(chatId) || !SAFE_MESSAGE_ID.test(messageId)) return null;
  if (!text || text.length > 4000) return null;
  if (!Number.isFinite(queuedAt) || queuedAt < 0) return null;
  return { version: DIRECT_MESSAGE_OUTBOX_VERSION, token, ownerUid, senderUid, contactId, chatId, messageId, text, queuedAt };
}

function serialize(items) {
  return JSON.stringify({ version: DIRECT_MESSAGE_OUTBOX_VERSION, messages: items });
}

function writeDirectMessageOutbox(storage, ownerUid, messages) {
  if (!storage) return false;
  const normalizedOwner = safeOwner(ownerUid);
  const normalized = messages.map(normalizeQueuedMessage).filter(Boolean).slice(-DIRECT_MESSAGE_OUTBOX_LIMIT);
  const payload = serialize(normalized);
  if (payload.length * 2 > MAX_OUTBOX_BYTES) return false;
  storage.setItem(directMessageOutboxKey(normalizedOwner), payload);
  return true;
}

export function readDirectMessageOutbox(storage, ownerUid) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(directMessageOutboxKey(ownerUid)) || 'null');
    if (!parsed || parsed.version !== DIRECT_MESSAGE_OUTBOX_VERSION || !Array.isArray(parsed.messages)) return [];
    return parsed.messages.map(normalizeQueuedMessage).filter(Boolean).slice(-DIRECT_MESSAGE_OUTBOX_LIMIT);
  } catch {
    return [];
  }
}

export function enqueueDirectMessage(storage, ownerUid, message, {
  now = () => Date.now(),
  tokenFactory = () => (typeof window !== 'undefined' && window.crypto?.randomUUID?.()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  const owner = safeOwner(ownerUid);
  const token = String(tokenFactory()).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128);
  const queued = normalizeQueuedMessage({
    version: DIRECT_MESSAGE_OUTBOX_VERSION,
    token,
    ownerUid: owner,
    senderUid: message?.senderUid,
    contactId: message?.contactId,
    chatId: message?.chatId,
    messageId: message?.messageId,
    text: message?.text,
    queuedAt: now(),
  });
  if (!queued) throw new Error('Invalid queued direct message');
  const current = readDirectMessageOutbox(storage, owner);
  const next = [...current.filter((item) => item.messageId !== queued.messageId), queued];
  return writeDirectMessageOutbox(storage, owner, next) ? queued : null;
}

export function acknowledgeDirectMessage(storage, ownerUid, token) {
  const owner = safeOwner(ownerUid);
  const current = readDirectMessageOutbox(storage, owner);
  const next = current.filter((message) => message.token !== token);
  if (next.length === current.length) return false;
  return writeDirectMessageOutbox(storage, owner, next);
}

export function queuedDirectMessagesForContact(storage, ownerUid, contactId, {
  chatId = '',
  timeFormatter = (timestamp) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
} = {}) {
  const normalizedContactId = String(contactId || '').trim();
  if (!SAFE_CONTACT_ID.test(normalizedContactId)) return [];
  return readDirectMessageOutbox(storage, ownerUid)
    .filter((message) => message.contactId === normalizedContactId && (!chatId || message.chatId === chatId))
    .map((message) => {
      const time = timeFormatter(message.queuedAt);
      return {
        id: message.messageId,
        contactId: message.contactId,
        direction: 'outgoing',
        text: message.text,
        time,
        sentAt: time,
        deliveredAt: '',
        readAt: '',
        status: 'queued',
        encrypted: false,
        reactions: [],
        createdAt: message.queuedAt,
        liveActivity: 'Queued for Firebase retry',
        seenGlow: false,
        senderUid: message.senderUid,
        transport: 'firestore-queued',
        realtimeChatId: message.chatId,
      };
    });
}

export async function flushDirectMessageOutbox({
  storage,
  ownerUid,
  firestore,
  chatId,
  contactId,
  sendMessage = sendDirectTextMessage,
  limit = 25,
} = {}) {
  const owner = safeOwner(ownerUid);
  const messages = readDirectMessageOutbox(storage, owner)
    .filter((message) => (!chatId || message.chatId === chatId) && (!contactId || message.contactId === contactId))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 25)));
  let completed = 0;
  for (const message of messages) {
    try {
      await sendMessage({
        firestore,
        chatId: message.chatId,
        senderUid: message.senderUid,
        text: message.text,
        messageId: message.messageId,
      });
      acknowledgeDirectMessage(storage, owner, message.token);
      completed += 1;
    } catch (error) {
      return { attempted: messages.length, completed, remaining: readDirectMessageOutbox(storage, owner).length, error: error?.message || 'Direct-message outbox flush failed' };
    }
  }
  return { attempted: messages.length, completed, remaining: readDirectMessageOutbox(storage, owner).length, error: '' };
}
