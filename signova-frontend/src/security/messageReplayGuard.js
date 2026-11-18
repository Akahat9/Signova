const DEFAULT_WINDOW_SIZE = 64;

function requireMetadata(metadata) {
  const senderDeviceId = String(metadata?.senderDeviceId || '');
  const messageId = String(metadata?.messageId || '');
  const senderSequence = Number(metadata?.senderSequence);
  if (!senderDeviceId || !messageId || !Number.isSafeInteger(senderSequence) || senderSequence < 1) {
    throw new Error('Valid sender device, message ID, and sequence are required');
  }
  return { senderDeviceId, messageId, senderSequence };
}

export class MessageReplayGuard {
  constructor(windowSize = DEFAULT_WINDOW_SIZE) {
    if (!Number.isSafeInteger(windowSize) || windowSize < 8 || windowSize > 4096) {
      throw new Error('Replay window size must be between 8 and 4096');
    }
    this.windowSize = windowSize;
    this.devices = new Map();
    this.messageIds = new Map();
  }

  accept(metadata) {
    const { senderDeviceId, messageId, senderSequence } = requireMetadata(metadata);
    if (this.messageIds.has(messageId)) return false;
    const state = this.devices.get(senderDeviceId) || { highest: 0, seen: new Map() };
    const minimum = Math.max(1, state.highest - this.windowSize + 1);
    if (senderSequence < minimum || state.seen.has(senderSequence)) return false;
    state.highest = Math.max(state.highest, senderSequence);
    state.seen.set(senderSequence, messageId);
    const nextMinimum = Math.max(1, state.highest - this.windowSize + 1);
    for (const [sequence, retainedMessageId] of state.seen) {
      if (sequence < nextMinimum) {
        state.seen.delete(sequence);
        this.messageIds.delete(retainedMessageId);
      }
    }
    this.devices.set(senderDeviceId, state);
    this.messageIds.set(messageId, { senderDeviceId, senderSequence });
    return true;
  }

  snapshot() {
    return Array.from(this.devices.entries()).map(([senderDeviceId, state]) => ({
      senderDeviceId,
      highestSequence: state.highest,
      seenSequences: Array.from(state.seen.keys()).sort((a, b) => a - b),
    }));
  }
}
