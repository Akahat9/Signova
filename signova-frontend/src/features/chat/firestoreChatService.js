import { collection, collectionGroup, deleteDoc, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const SAFE_UID = /^[A-Za-z0-9._-]{1,128}$/;
const SAFE_MESSAGE_ID = /^[A-Za-z0-9._-]{1,128}$/;
const MAX_TEXT_LENGTH = 4000;
const MAX_REACTION_LENGTH = 32;
const DIRECT_ATTACHMENT_TYPES = new Set(['image', 'audio', 'document']);

function validateUid(value, label) {
  const uid = String(value || '').trim();
  if (!SAFE_UID.test(uid)) throw new Error(`Invalid ${label}`);
  return uid;
}

function defaultDigest(bytes) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) throw new Error('Secure conversation IDs are unavailable');
  return window.crypto.subtle.digest('SHA-256', bytes);
}

export async function buildDirectChatId(firstUid, secondUid, { digest = defaultDigest } = {}) {
  const members = [validateUid(firstUid, 'current user'), validateUid(secondUid, 'contact user')].sort();
  if (members[0] === members[1]) throw new Error('Cannot create a direct chat with the same account');
  const bytes = new TextEncoder().encode(`signova-direct-chat-v1\0${members[0]}\0${members[1]}`);
  const hash = new Uint8Array(await digest(bytes));
  const hex = Array.from(hash, (value) => value.toString(16).padStart(2, '0')).join('');
  if (hex.length < 40) throw new Error('Conversation ID digest is invalid');
  return { chatId: `direct-${hex.slice(0, 40)}`, memberIds: members };
}

export async function ensureDirectChat({
  firestore,
  currentUser,
  contactUid,
  digest,
  makeDoc = doc,
  transact = runTransaction,
  timestamp = serverTimestamp,
} = {}) {
  if (!firestore || !currentUser?.uid) throw new Error('Firebase login is required for realtime chat');
  const { chatId, memberIds } = await buildDirectChatId(currentUser.uid, contactUid, { digest });
  const chatRef = makeDoc(firestore, 'chats', chatId);
  await transact(firestore, async (transaction) => {
    const snapshot = await transaction.get(chatRef);
    if (snapshot.exists()) {
      const existingMembers = Array.isArray(snapshot.data()?.memberIds) ? [...snapshot.data().memberIds].sort() : [];
      if (existingMembers.join('\0') !== memberIds.join('\0')) throw new Error('Conversation membership mismatch');
      return;
    }
    transaction.set(chatRef, {
      memberIds,
      title: 'Direct Signova chat',
      avatarUrl: '',
      lastMessage: '',
      lastMessageAt: timestamp(),
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });
  });
  return { chatId, memberIds };
}

function timestampMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  if (Number.isFinite(value)) return Number(value);
  return Date.now();
}

function normalizeAttachmentData(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const attachmentType = String(data.attachmentType || data.type || '').trim();
  const title = String(data.title || '').trim();
  const mediaPath = String(data.mediaPath || '').trim();
  const contentType = String(data.contentType || '').trim();
  const sizeLabel = String(data.size || '').trim();
  const sizeBytes = Number(data.sizeBytes || 0);
  if (!DIRECT_ATTACHMENT_TYPES.has(attachmentType) || !title || !mediaPath || title.length > 160 || mediaPath.length > 500) return null;
  return {
    attachmentType,
    attachmentData: {
      title,
      url: '',
      fileType: contentType || attachmentType,
      size: sizeLabel || (Number.isFinite(sizeBytes) && sizeBytes > 0 ? `${Math.ceil(sizeBytes / 1024)} KB` : 'Ready'),
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
      mediaPath,
      durable: true,
      previewExpired: false,
      mode: data.mode || (attachmentType === 'image' ? 'Image' : ''),
      quality: data.quality || '',
    },
  };
}

export function normalizeFirestoreChatMessage(snapshot, { currentUid, contactId, chatId } = {}) {
  const data = snapshot?.data?.() || {};
  const senderUid = String(data.senderUid || '');
  const createdAt = timestampMillis(data.createdAt);
  const deleted = Boolean(data.deletedAt);
  const edited = Boolean(data.editedAt) && !deleted;
  const editedAt = edited ? timestampMillis(data.editedAt) : 0;
  const attachment = deleted ? null : normalizeAttachmentData(data.attachment);
  return {
    id: String(snapshot?.id || data.clientMessageId || ''),
    contactId: String(contactId || ''),
    direction: senderUid === currentUid ? 'outgoing' : 'incoming',
    text: deleted ? 'You unsent this message' : String(data.text || ''),
    time: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sentAt: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    deliveredAt: '',
    readAt: '',
    status: deleted ? 'deleted' : 'sent',
    encrypted: false,
    reactions: [],
    createdAt,
    liveActivity: deleted ? 'Unsent through Firebase chat' : (edited ? 'Edited through Firebase chat' : 'Synced through Firebase chat'),
    seenGlow: false,
    senderUid,
    realtimeChatId: String(chatId || ''),
    transport: 'firestore',
    deleted,
    unsent: deleted,
    edited,
    editedAt: edited ? new Date(editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    ...(attachment || {}),
  };
}

export function subscribeDirectChatMessages({
  firestore,
  chatId,
  currentUid,
  contactId,
  onMessages,
  onError = () => {},
  makeCollection = collection,
  makeQuery = query,
  makeOrder = orderBy,
  makeLimit = limit,
  subscribe = onSnapshot,
} = {}) {
  if (!firestore || !SAFE_UID.test(String(currentUid || '')) || !/^direct-[a-f0-9]{40}$/.test(String(chatId || '')) || !contactId || typeof onMessages !== 'function') {
    throw new Error('Invalid realtime chat subscription');
  }
  const messagesQuery = makeQuery(
    makeCollection(firestore, 'chats', chatId, 'messages'),
    makeOrder('createdAt', 'asc'),
    makeLimit(200),
  );
  return subscribe(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((item) => normalizeFirestoreChatMessage(item, { currentUid, contactId, chatId })));
  }, onError);
}

export function normalizeDirectMessageReaction(snapshot) {
  const data = snapshot?.data?.() || {};
  const chatId = String(data.chatId || '');
  const messageId = String(data.messageId || '');
  const userId = String(data.userId || snapshot?.id || '');
  const reaction = String(data.reaction || '').trim();
  if (!/^direct-[a-f0-9]{40}$/.test(chatId) || !SAFE_MESSAGE_ID.test(messageId) || !SAFE_UID.test(userId) || !reaction || reaction.length > MAX_REACTION_LENGTH) return null;
  return { chatId, messageId, userId, reaction };
}

export function groupDirectMessageReactions(reactions = []) {
  const grouped = new Map();
  reactions.filter(Boolean).forEach((reaction) => {
    const current = grouped.get(reaction.messageId) || [];
    current.push(reaction.reaction);
    grouped.set(reaction.messageId, current);
  });
  return grouped;
}

export function subscribeDirectChatReactions({
  firestore,
  chatId,
  onReactions,
  onError = () => {},
  makeCollectionGroup = collectionGroup,
  makeQuery = query,
  makeWhere = where,
  subscribe = onSnapshot,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!firestore || !/^direct-[a-f0-9]{40}$/.test(normalizedChatId) || typeof onReactions !== 'function') {
    throw new Error('Invalid realtime reaction subscription');
  }
  const reactionQuery = makeQuery(
    makeCollectionGroup(firestore, 'reactions'),
    makeWhere('chatId', '==', normalizedChatId),
  );
  return subscribe(reactionQuery, (snapshot) => {
    onReactions(groupDirectMessageReactions(snapshot.docs.map(normalizeDirectMessageReaction).filter(Boolean)));
  }, onError);
}

export function normalizeDirectMessageReceipt(snapshot) {
  const data = snapshot?.data?.() || {};
  const chatId = String(data.chatId || '');
  const messageId = String(data.messageId || '');
  const userId = String(data.userId || snapshot?.id || '');
  if (!data.deliveredAt) return null;
  const deliveredAtMs = timestampMillis(data.deliveredAt);
  const readAtMs = data.readAt ? timestampMillis(data.readAt) : 0;
  if (!/^direct-[a-f0-9]{40}$/.test(chatId) || !SAFE_MESSAGE_ID.test(messageId) || !SAFE_UID.test(userId)) return null;
  if (!Number.isFinite(deliveredAtMs) || deliveredAtMs <= 0) return null;
  return {
    chatId,
    messageId,
    userId,
    deliveredAtMs,
    readAtMs: Number.isFinite(readAtMs) && readAtMs > 0 ? readAtMs : 0,
    deliveredAt: new Date(deliveredAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    readAt: readAtMs ? new Date(readAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

export function groupDirectMessageReceipts(receipts = []) {
  const grouped = new Map();
  receipts.filter(Boolean).forEach((receipt) => {
    const current = grouped.get(receipt.messageId);
    if (!current || receipt.readAtMs > current.readAtMs || receipt.deliveredAtMs > current.deliveredAtMs) {
      grouped.set(receipt.messageId, receipt);
    }
  });
  return grouped;
}

export function applyDirectMessageReceipts(messages = [], receiptMap = new Map()) {
  return messages.map((message) => {
    if (message?.direction !== 'outgoing' || message.transport !== 'firestore' || message.status === 'deleted') return message;
    const receipt = receiptMap.get(message.id);
    if (!receipt) return message;
    const status = receipt.readAt ? 'read' : 'delivered';
    return {
      ...message,
      status,
      deliveredAt: receipt.deliveredAt || message.deliveredAt,
      readAt: receipt.readAt || '',
      seenGlow: Boolean(receipt.readAt),
      liveActivity: receipt.readAt ? 'Read through Firebase chat' : 'Delivered through Firebase chat',
    };
  });
}

export function subscribeDirectChatReceipts({
  firestore,
  chatId,
  onReceipts,
  onError = () => {},
  makeCollectionGroup = collectionGroup,
  makeQuery = query,
  makeWhere = where,
  subscribe = onSnapshot,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!firestore || !/^direct-[a-f0-9]{40}$/.test(normalizedChatId) || typeof onReceipts !== 'function') {
    throw new Error('Invalid realtime receipt subscription');
  }
  const receiptQuery = makeQuery(
    makeCollectionGroup(firestore, 'receipts'),
    makeWhere('chatId', '==', normalizedChatId),
  );
  return subscribe(receiptQuery, (snapshot) => {
    onReceipts(groupDirectMessageReceipts(snapshot.docs.map(normalizeDirectMessageReceipt).filter(Boolean)));
  }, onError);
}

export async function sendDirectTextMessage({
  firestore,
  chatId,
  senderUid,
  text,
  messageId,
  makeDoc = doc,
  makeBatch = writeBatch,
  timestamp = serverTimestamp,
  timeoutMs = 8000,
} = {}) {
  const uid = validateUid(senderUid, 'message sender');
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const cleanText = String(text || '').trim();
  if (!cleanText || cleanText.length > MAX_TEXT_LENGTH) throw new Error('Message must contain 1 to 4000 characters');
  const clientMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(clientMessageId)) throw new Error('Invalid message ID');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const chatRef = makeDoc(firestore, 'chats', normalizedChatId);
  const messageRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', clientMessageId);
  const batch = makeBatch(firestore);
  batch.set(messageRef, {
    senderUid: uid,
    type: 'text',
    text: cleanText,
    createdAt: timestamp(),
    clientMessageId,
  });
  batch.update(chatRef, {
    lastMessage: cleanText.slice(0, 240),
    lastMessageAt: timestamp(),
    updatedAt: timestamp(),
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('Realtime message confirmation timed out');
      error.code = 'chat/write-timeout';
      reject(error);
    }, timeoutMs);
    batch.commit().then(
      () => { clearTimeout(timer); resolve(); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
  return { chatId: normalizedChatId, messageId: clientMessageId };
}

export async function sendDirectAttachmentMessage({
  firestore,
  chatId,
  senderUid,
  messageId,
  text,
  mediaPath,
  attachment,
  makeDoc = doc,
  makeBatch = writeBatch,
  timestamp = serverTimestamp,
  timeoutMs = 8000,
} = {}) {
  const uid = validateUid(senderUid, 'message sender');
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const clientMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(clientMessageId)) throw new Error('Invalid message ID');
  const cleanText = String(text || '').trim();
  if (!cleanText || cleanText.length > MAX_TEXT_LENGTH) throw new Error('Attachment message must contain 1 to 4000 characters');
  const cleanMediaPath = String(mediaPath || '').trim();
  if (!cleanMediaPath || !cleanMediaPath.startsWith(`chatAttachments/${normalizedChatId}/${uid}/${clientMessageId}/`)) throw new Error('Attachment path does not match this direct chat');
  const normalizedAttachment = normalizeAttachmentData({ ...attachment, mediaPath: cleanMediaPath });
  if (!normalizedAttachment) throw new Error('Invalid attachment metadata');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const chatRef = makeDoc(firestore, 'chats', normalizedChatId);
  const messageRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', clientMessageId);
  const batch = makeBatch(firestore);
  batch.set(messageRef, {
    senderUid: uid,
    type: normalizedAttachment.attachmentType,
    text: cleanText,
    mediaPath: cleanMediaPath,
    attachment: {
      type: normalizedAttachment.attachmentType,
      title: normalizedAttachment.attachmentData.title,
      contentType: normalizedAttachment.attachmentData.fileType,
      size: normalizedAttachment.attachmentData.size,
      sizeBytes: normalizedAttachment.attachmentData.sizeBytes,
      mediaPath: cleanMediaPath,
      mode: normalizedAttachment.attachmentData.mode || '',
      quality: normalizedAttachment.attachmentData.quality || '',
    },
    createdAt: timestamp(),
    clientMessageId,
  });
  batch.update(chatRef, {
    lastMessage: cleanText.slice(0, 240),
    lastMessageAt: timestamp(),
    updatedAt: timestamp(),
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('Realtime attachment confirmation timed out');
      error.code = 'chat/write-timeout';
      reject(error);
    }, timeoutMs);
    batch.commit().then(
      () => { clearTimeout(timer); resolve(); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
  return { chatId: normalizedChatId, messageId: clientMessageId, mediaPath: cleanMediaPath };
}

export async function acknowledgeDirectMessageReceipt({
  firestore,
  chatId,
  messageId,
  userUid,
  read = false,
  makeDoc = doc,
  transact = runTransaction,
  timestamp = serverTimestamp,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const normalizedMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(normalizedMessageId)) throw new Error('Invalid message ID');
  const uid = validateUid(userUid, 'receipt user');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const receiptRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', normalizedMessageId, 'receipts', uid);
  await transact(firestore, async (transaction) => {
    const snapshot = await transaction.get(receiptRef);
    if (!snapshot.exists()) {
      transaction.set(receiptRef, {
        userId: uid,
        chatId: normalizedChatId,
        messageId: normalizedMessageId,
        deliveredAt: timestamp(),
        readAt: read ? timestamp() : null,
        updatedAt: timestamp(),
      });
      return;
    }
    const data = snapshot.data() || {};
    if (read && !data.readAt) {
      transaction.update(receiptRef, {
        readAt: timestamp(),
        updatedAt: timestamp(),
      });
    }
  });
  return { chatId: normalizedChatId, messageId: normalizedMessageId, userUid: uid, read: Boolean(read) };
}

export async function markDirectMessageUnsent({
  firestore,
  chatId,
  messageId,
  makeDoc = doc,
  update = updateDoc,
  timestamp = serverTimestamp,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const normalizedMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(normalizedMessageId)) throw new Error('Invalid message ID');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const messageRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', normalizedMessageId);
  await update(messageRef, {
    text: 'You unsent this message',
    deletedAt: timestamp(),
  });
  return { chatId: normalizedChatId, messageId: normalizedMessageId };
}

export async function markDirectMessageEdited({
  firestore,
  chatId,
  messageId,
  text,
  makeDoc = doc,
  update = updateDoc,
  timestamp = serverTimestamp,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const normalizedMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(normalizedMessageId)) throw new Error('Invalid message ID');
  const cleanText = String(text || '').trim();
  if (!cleanText || cleanText.length > MAX_TEXT_LENGTH) throw new Error('Message must contain 1 to 4000 characters');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const messageRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', normalizedMessageId);
  await update(messageRef, {
    text: cleanText,
    editedAt: timestamp(),
  });
  return { chatId: normalizedChatId, messageId: normalizedMessageId, text: cleanText };
}

export async function setDirectMessageReaction({
  firestore,
  chatId,
  messageId,
  userUid,
  reaction,
  makeDoc = doc,
  write = setDoc,
  remove = deleteDoc,
  timestamp = serverTimestamp,
} = {}) {
  const normalizedChatId = String(chatId || '');
  if (!/^direct-[a-f0-9]{40}$/.test(normalizedChatId)) throw new Error('Invalid direct chat ID');
  const normalizedMessageId = String(messageId || '').trim();
  if (!SAFE_MESSAGE_ID.test(normalizedMessageId)) throw new Error('Invalid message ID');
  const uid = validateUid(userUid, 'reaction user');
  const cleanReaction = String(reaction || '').trim();
  if (cleanReaction.length > MAX_REACTION_LENGTH) throw new Error('Reaction is too long');
  if (!firestore) throw new Error('Realtime chat is unavailable');
  const reactionRef = makeDoc(firestore, 'chats', normalizedChatId, 'messages', normalizedMessageId, 'reactions', uid);
  if (!cleanReaction) {
    await remove(reactionRef);
    return { chatId: normalizedChatId, messageId: normalizedMessageId, userUid: uid, reaction: '' };
  }
  await write(reactionRef, {
    userId: uid,
    chatId: normalizedChatId,
    messageId: normalizedMessageId,
    reaction: cleanReaction,
    updatedAt: timestamp(),
  });
  return { chatId: normalizedChatId, messageId: normalizedMessageId, userUid: uid, reaction: cleanReaction };
}
