import { verifySignedDevicePublicBundle } from './e2eePrimitives';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const URI_PREFIX = 'signova-e2ee://verify/';

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function participant(userId, bundle) {
  const uid = String(userId || '').trim();
  if (!uid || !bundle?.deviceId || !bundle?.fingerprint) throw new Error('Complete device verification identity is required');
  return { userId: uid, deviceId: bundle.deviceId, fingerprint: bundle.fingerprint };
}

function canonicalParticipants(left, right) {
  return [left, right].sort((a, b) => (
    `${a.userId}\u0000${a.deviceId}`.localeCompare(`${b.userId}\u0000${b.deviceId}`)
  ));
}

function formatSafetyNumber(digest) {
  const groups = [];
  for (let index = 0; index < 24; index += 2) {
    groups.push(String(((digest[index] << 8) | digest[index + 1]) % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}

export async function createDeviceVerification(localUserId, localBundle, remoteUserId, remoteBundle, cryptoProvider = window.crypto) {
  if (!await verifySignedDevicePublicBundle(localBundle, cryptoProvider)
    || !await verifySignedDevicePublicBundle(remoteBundle, cryptoProvider)) {
    throw new Error('Both signed device bundles must be valid');
  }
  const participants = canonicalParticipants(participant(localUserId, localBundle), participant(remoteUserId, remoteBundle));
  const canonical = JSON.stringify({ version: 1, participants });
  const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', encoder.encode(canonical)));
  const record = { version: 1, participants, safetyNumber: formatSafetyNumber(digest) };
  const payload = `${URI_PREFIX}${bytesToBase64Url(encoder.encode(JSON.stringify(record)))}`;
  return { ...record, payload };
}

export function verifyDeviceVerificationPayload(payload, expected) {
  try {
    if (!String(payload).startsWith(URI_PREFIX) || expected?.version !== 1) return false;
    const encoded = String(payload).slice(URI_PREFIX.length);
    const parsed = JSON.parse(decoder.decode(base64UrlToBytes(encoded)));
    return parsed.version === 1
      && parsed.safetyNumber === expected.safetyNumber
      && JSON.stringify(parsed.participants) === JSON.stringify(expected.participants);
  } catch {
    return false;
  }
}
