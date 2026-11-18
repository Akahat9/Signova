import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const SAFE_UID = /^[A-Za-z0-9._-]{1,128}$/;
const ONLINE_WINDOW_MS = 90 * 1000;
const AWAY_WINDOW_MS = 5 * 60 * 1000;

function millis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  if (Number.isFinite(value)) return Number(value);
  return 0;
}

export function normalizePresenceSnapshot(snapshot, { now = Date.now() } = {}) {
  const data = snapshot?.data?.() || {};
  const uid = String(data.uid || snapshot?.id || '').trim();
  if (!SAFE_UID.test(uid)) return null;
  const state = ['online', 'away', 'offline', 'hidden'].includes(data.state) ? data.state : 'offline';
  const lastActiveAtMs = millis(data.lastActiveAt || data.updatedAt);
  const age = lastActiveAtMs ? Math.max(0, now - lastActiveAtMs) : Number.POSITIVE_INFINITY;
  const effectiveState = state === 'hidden'
    ? 'hidden'
    : state === 'offline'
      ? 'offline'
      : age <= ONLINE_WINDOW_MS
        ? 'online'
        : age <= AWAY_WINDOW_MS
          ? 'away'
          : 'offline';
  return {
    uid,
    state: effectiveState,
    rawState: state,
    lastActiveAtMs,
    deviceLabel: String(data.deviceLabel || 'Web').slice(0, 40),
    updatedAtMs: millis(data.updatedAt),
  };
}

export function presenceLabel(presence, { showLastSeen = true } = {}) {
  if (!presence || presence.state === 'hidden') {
    return { status: 'Hidden', detail: 'Presence hidden', device: 'Private mode', tone: 'offline' };
  }
  if (presence.state === 'online') {
    return { status: 'Online', detail: 'Active now', device: `${presence.deviceLabel || 'Web'} ready`, tone: 'online' };
  }
  if (presence.state === 'away') {
    return { status: 'Away', detail: 'Recently active', device: `${presence.deviceLabel || 'Web'} idle`, tone: 'away' };
  }
  const lastSeen = presence.lastActiveAtMs
    ? new Date(presence.lastActiveAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return {
    status: 'Offline',
    detail: showLastSeen && lastSeen ? `Last seen ${lastSeen}` : 'Offline',
    device: 'Offline mode',
    tone: 'offline',
  };
}

export async function writeUserPresence({
  firestore,
  uid,
  state = 'online',
  deviceLabel = 'Web',
  makeDoc = doc,
  write = setDoc,
  timestamp = serverTimestamp,
} = {}) {
  const userUid = String(uid || '').trim();
  if (!firestore || !SAFE_UID.test(userUid)) throw new Error('Valid authenticated user is required for presence');
  const cleanState = ['online', 'away', 'offline', 'hidden'].includes(state) ? state : 'offline';
  const ref = makeDoc(firestore, 'userPresence', userUid);
  await write(ref, {
    uid: userUid,
    state: cleanState,
    deviceLabel: String(deviceLabel || 'Web').slice(0, 40),
    lastActiveAt: timestamp(),
    updatedAt: timestamp(),
  }, { merge: true });
  return { uid: userUid, state: cleanState };
}

export function subscribeUserPresence({
  firestore,
  uid,
  onPresence,
  onError = () => {},
  makeDoc = doc,
  subscribe = onSnapshot,
  now = Date.now,
} = {}) {
  const userUid = String(uid || '').trim();
  if (!firestore || !SAFE_UID.test(userUid) || typeof onPresence !== 'function') {
    throw new Error('Valid presence subscription is required');
  }
  return subscribe(makeDoc(firestore, 'userPresence', userUid), (snapshot) => {
    onPresence(normalizePresenceSnapshot(snapshot, { now: now() }));
  }, onError);
}
