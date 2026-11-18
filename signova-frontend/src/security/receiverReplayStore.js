const DATABASE_NAME = 'signova-e2ee-receiver-replay';
const DATABASE_VERSION = 1;
const SENDERS_STORE = 'senderWindows';
const MESSAGES_STORE = 'messageIds';
const DEFAULT_WINDOW_SIZE = 64;

function requireMetadata(conversationId, metadata) {
  const conversation = String(conversationId || '').trim();
  const senderDeviceId = String(metadata?.senderDeviceId || '').trim();
  const messageId = String(metadata?.messageId || '').trim();
  const senderSequence = Number(metadata?.senderSequence);
  if (!conversation || !senderDeviceId || !messageId || !Number.isSafeInteger(senderSequence) || senderSequence < 1) {
    throw new Error('Complete receiver replay metadata is required');
  }
  return { conversation, senderDeviceId, messageId, senderSequence };
}

function openDatabase(indexedDBProvider = window.indexedDB) {
  if (!indexedDBProvider) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDBProvider.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SENDERS_STORE)) {
        request.result.createObjectStore(SENDERS_STORE, { keyPath: 'key' });
      }
      if (!request.result.objectStoreNames.contains(MESSAGES_STORE)) {
        request.result.createObjectStore(MESSAGES_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Receiver replay database could not be opened'));
  });
}

export async function acceptIncomingSequence(conversationId, metadata, options = {}) {
  const { conversation, senderDeviceId, messageId, senderSequence } = requireMetadata(conversationId, metadata);
  const windowSize = Number(options.windowSize || DEFAULT_WINDOW_SIZE);
  if (!Number.isSafeInteger(windowSize) || windowSize < 8 || windowSize > 4096) throw new Error('Replay window size must be between 8 and 4096');
  const indexedDBProvider = options.indexedDBProvider || window.indexedDB;
  const senderKey = JSON.stringify([conversation, senderDeviceId]);
  const messageKey = JSON.stringify([conversation, messageId]);
  const database = await openDatabase(indexedDBProvider);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([SENDERS_STORE, MESSAGES_STORE], 'readwrite');
      const senders = transaction.objectStore(SENDERS_STORE);
      const messages = transaction.objectStore(MESSAGES_STORE);
      const senderRead = senders.get(senderKey);
      const messageRead = messages.get(messageKey);
      let senderRecord;
      let messageRecord;
      let evaluated = false;
      let accepted = false;

      const evaluate = () => {
        if (evaluated || senderRecord === undefined || messageRecord === undefined) return;
        evaluated = true;
        const previous = senderRecord || { highest: 0, seen: [] };
        const seen = new Map((previous.seen || []).map((item) => [Number(item.sequence), String(item.messageId)]));
        const minimum = Math.max(1, Number(previous.highest || 0) - windowSize + 1);
        if (messageRecord || senderSequence < minimum || seen.has(senderSequence)) return;
        const highest = Math.max(Number(previous.highest || 0), senderSequence);
        seen.set(senderSequence, messageId);
        const nextMinimum = Math.max(1, highest - windowSize + 1);
        for (const [sequence, retainedMessageId] of seen) {
          if (sequence < nextMinimum) {
            seen.delete(sequence);
            messages.delete(JSON.stringify([conversation, retainedMessageId]));
          }
        }
        senders.put({
          key: senderKey,
          conversationId: conversation,
          senderDeviceId,
          highest,
          seen: Array.from(seen, ([sequence, retainedMessageId]) => ({ sequence, messageId: retainedMessageId })),
          updatedAt: Date.now(),
        });
        messages.put({ key: messageKey, conversationId: conversation, messageId, senderDeviceId, senderSequence });
        accepted = true;
      };
      senderRead.onsuccess = () => { senderRecord = senderRead.result || null; evaluate(); };
      messageRead.onsuccess = () => { messageRecord = messageRead.result || null; evaluate(); };
      senderRead.onerror = () => reject(senderRead.error || new Error('Replay sender state could not be read'));
      messageRead.onerror = () => reject(messageRead.error || new Error('Replay message state could not be read'));
      transaction.oncomplete = () => resolve(accepted);
      transaction.onerror = () => reject(transaction.error || new Error('Replay state transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('Replay state transaction aborted'));
    });
  } finally {
    database.close();
  }
}
