import {
  deriveConversationKey,
  decryptMessageEnvelope,
  encryptMessageEnvelope,
  exportSignedDevicePublicBundle,
  generateDeviceKeyBundle,
  verifySignedDevicePublicBundle,
} from './e2eePrimitives';
import { loadDeviceKeyBundle, saveDeviceKeyBundle } from './deviceKeyStore';
import { listActiveDevicePublicBundles, registerDevicePublicBundle } from './deviceKeyDirectory';

export const E2EE_TEXT_PREFIX = '__e2ee_v1__:';
export const SIGNOVA_ACTIVE_E2EE_PROTOCOL = 'Signova E2EE v1 (ECDH P-256 + AES-256-GCM)';

const sequenceCounters = new Map();
const derivedSessionCache = new Map();
const localIdentityCache = new Map();

function getOrCreateDeviceId(uid) {
  const storageKey = `signova:e2ee:deviceId:${uid}`;
  try {
    const existing = window.localStorage?.getItem(storageKey);
    if (existing && /^[A-Za-z0-9._-]{4,128}$/.test(existing)) return existing;
  } catch {
    // ignore storage errors
  }
  const generated = `web-${window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
  try {
    window.localStorage?.setItem(storageKey, generated);
  } catch {
    // ignore storage errors
  }
  return generated;
}

function nextSequenceForChat(chatId) {
  const key = String(chatId || 'default');
  const next = (sequenceCounters.get(key) || 0) + 1;
  sequenceCounters.set(key, next);
  return next;
}

export async function ensureLocalDeviceIdentity(firestoreDb, uid) {
  if (!firestoreDb || !uid || typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }
  if (localIdentityCache.has(uid)) {
    return localIdentityCache.get(uid);
  }
  const deviceId = getOrCreateDeviceId(uid);
  let keys = null;
  try {
    keys = await loadDeviceKeyBundle(deviceId);
  } catch {
    keys = null;
  }
  if (!keys?.agreement?.privateKey || !keys?.signing?.privateKey) {
    keys = await generateDeviceKeyBundle(window.crypto);
    try {
      await saveDeviceKeyBundle(deviceId, keys);
    } catch {
      // IndexedDB may be unavailable in private browsing; in-memory keys still work for the session
    }
  }
  const publicBundle = await exportSignedDevicePublicBundle(keys, deviceId, window.crypto);
  await registerDevicePublicBundle(firestoreDb, uid, publicBundle).catch(() => undefined);
  const identity = { uid, deviceId, keys, publicBundle };
  localIdentityCache.set(uid, identity);
  return identity;
}

export async function resolvePeerE2EESession(firestoreDb, localIdentity, peerUid, chatId) {
  if (!firestoreDb || !localIdentity?.keys?.agreement?.privateKey || !peerUid || !chatId) {
    return {
      available: false,
      protocol: null,
      verifiedDevices: localIdentity ? 1 : 0,
      reason: 'Sign in with a verified Signova account to enable E2EE.',
    };
  }
  const cacheKey = `${chatId}:${localIdentity.deviceId}:${peerUid}`;
  if (derivedSessionCache.has(cacheKey)) {
    return derivedSessionCache.get(cacheKey);
  }
  const bundles = await listActiveDevicePublicBundles(firestoreDb, peerUid).catch(() => []);
  const verifiedBundle = bundles.find(Boolean) || null;
  if (!verifiedBundle || !(await verifySignedDevicePublicBundle(verifiedBundle, window.crypto).catch(() => false))) {
    return {
      available: false,
      protocol: null,
      verifiedDevices: 1,
      reason: 'Waiting for contact to open Signova and register their device key.',
    };
  }
  const key = await deriveConversationKey(
    localIdentity.keys.agreement.privateKey,
    verifiedBundle,
    chatId,
    window.crypto,
  );
  const session = Object.freeze({
    available: true,
    protocol: SIGNOVA_ACTIVE_E2EE_PROTOCOL,
    verifiedDevices: 2,
    localDeviceId: localIdentity.deviceId,
    localFingerprint: localIdentity.publicBundle.fingerprint,
    peerDeviceId: verifiedBundle.deviceId,
    peerFingerprint: verifiedBundle.fingerprint,
    key,
  });
  derivedSessionCache.set(cacheKey, session);
  return session;
}

export async function encryptRealtimeText(session, chatId, messageId, plaintext) {
  if (!session?.available || !session?.key) {
    return { text: plaintext, encrypted: false };
  }
  const envelope = await encryptMessageEnvelope(
    session.key,
    plaintext,
    {
      conversationId: chatId,
      messageId,
      senderDeviceId: session.localDeviceId,
      senderSequence: nextSequenceForChat(chatId),
      sentAt: Date.now(),
    },
    window.crypto,
  );
  return {
    text: `${E2EE_TEXT_PREFIX}${JSON.stringify(envelope)}`,
    encrypted: true,
  };
}

export async function decryptRealtimeText(session, rawText) {
  const value = String(rawText || '');
  if (!value.startsWith(E2EE_TEXT_PREFIX)) {
    return { text: value, encrypted: false };
  }
  if (!session?.key) {
    return { text: '🔒 Encrypted message (unlock E2EE session to view)', encrypted: true, decryptError: true };
  }
  try {
    const envelope = JSON.parse(value.slice(E2EE_TEXT_PREFIX.length));
    const plaintext = await decryptMessageEnvelope(session.key, envelope, window.crypto);
    return { text: plaintext, encrypted: true, decryptError: false };
  } catch {
    return { text: '🔒 Encrypted message (device key changed)', encrypted: true, decryptError: true };
  }
}

export function clearE2EESessionCache() {
  derivedSessionCache.clear();
  localIdentityCache.clear();
}
