export const CALL_ROOM_STATUSES = Object.freeze([
  'ringing',
  'connecting',
  'connected',
  'reconnecting',
  'ended',
  'rejected',
  'failed',
]);

export const TERMINAL_CALL_STATUSES = Object.freeze(['ended', 'rejected', 'failed']);

const ALLOWED_TRANSITIONS = Object.freeze({
  ringing: Object.freeze(['connecting', 'rejected', 'ended', 'failed']),
  connecting: Object.freeze(['connected', 'rejected', 'ended', 'failed']),
  connected: Object.freeze(['reconnecting', 'ended', 'failed']),
  reconnecting: Object.freeze(['connected', 'ended', 'failed']),
  ended: Object.freeze([]),
  rejected: Object.freeze([]),
  failed: Object.freeze([]),
});

export function isCallRoomStatus(status) {
  return CALL_ROOM_STATUSES.includes(status);
}

export function isIncomingCallStatus(status) {
  return status === 'ringing' || status === 'connecting';
}

export function isTerminalCallStatus(status) {
  return TERMINAL_CALL_STATUSES.includes(status);
}

export function canTransitionCallStatus(from, to) {
  return Boolean(ALLOWED_TRANSITIONS[from]?.includes(to));
}
