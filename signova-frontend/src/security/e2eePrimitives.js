const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function canonicalMetadata(metadata) {
  const senderSequence = Number(metadata.senderSequence);
  if (!String(metadata.conversationId || '') || !String(metadata.messageId || '') || !String(metadata.senderDeviceId || '')) {
    throw new Error('Complete encrypted message metadata is required');
  }
  if (!Number.isSafeInteger(senderSequence) || senderSequence < 1) {
    throw new Error('senderSequence must be a positive safe integer');
  }
  return JSON.stringify({
    version: 1,
    conversationId: String(metadata.conversationId || ''),
    messageId: String(metadata.messageId || ''),
    senderDeviceId: String(metadata.senderDeviceId || ''),
    senderSequence,
    sentAt: Number(metadata.sentAt || 0),
  });
}

function canonicalDeviceBundleIdentity(bundle) {
  return JSON.stringify({
    version: 1,
    deviceId: String(bundle.deviceId || ''),
    agreementPublicKey: String(bundle.agreementPublicKey || ''),
    signingPublicKey: String(bundle.signingPublicKey || ''),
  });
}

export async function generateDeviceKeyBundle(cryptoProvider = window.crypto) {
  const agreement = await cryptoProvider.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const signing = await cryptoProvider.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  );
  return { agreement, signing };
}

export async function exportSignedDevicePublicBundle(keys, deviceId, cryptoProvider = window.crypto) {
  const agreementPublic = new Uint8Array(await cryptoProvider.subtle.exportKey('raw', keys.agreement.publicKey));
  const signingPublic = new Uint8Array(await cryptoProvider.subtle.exportKey('raw', keys.signing.publicKey));
  const fingerprint = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', signingPublic));
  const identity = {
    version: 1,
    deviceId: String(deviceId || ''),
    agreementPublicKey: bytesToBase64(agreementPublic),
    signingPublicKey: bytesToBase64(signingPublic),
    fingerprint: bytesToBase64(fingerprint),
  };
  if (!identity.deviceId) throw new Error('deviceId is required');
  const signature = new Uint8Array(await cryptoProvider.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keys.signing.privateKey,
    encoder.encode(canonicalDeviceBundleIdentity(identity)),
  ));
  return { ...identity, agreementSignature: bytesToBase64(signature) };
}

export async function verifySignedDevicePublicBundle(bundle, cryptoProvider = window.crypto) {
  if (bundle?.version !== 1 || !bundle.deviceId) return false;
  try {
    const signingBytes = base64ToBytes(bundle.signingPublicKey);
    const expectedFingerprint = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', signingBytes));
    if (bytesToBase64(expectedFingerprint) !== bundle.fingerprint) return false;
    const signingKey = await cryptoProvider.subtle.importKey(
      'raw',
      signingBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return cryptoProvider.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      base64ToBytes(bundle.agreementSignature),
      encoder.encode(canonicalDeviceBundleIdentity(bundle)),
    );
  } catch {
    return false;
  }
}

export async function deriveConversationKey(privateAgreementKey, remoteBundle, conversationId, cryptoProvider = window.crypto) {
  if (!await verifySignedDevicePublicBundle(remoteBundle, cryptoProvider)) throw new Error('Remote device key bundle is invalid');
  const remoteKey = await cryptoProvider.subtle.importKey(
    'raw',
    base64ToBytes(remoteBundle.agreementPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = await cryptoProvider.subtle.deriveBits(
    { name: 'ECDH', public: remoteKey },
    privateAgreementKey,
    256,
  );
  const keyMaterial = await cryptoProvider.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  const salt = await cryptoProvider.subtle.digest('SHA-256', encoder.encode(`signova:${conversationId}`));
  return cryptoProvider.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('signova-message-e2ee-v1') },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptMessageEnvelope(key, plaintext, metadata, cryptoProvider = window.crypto) {
  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const aad = encoder.encode(canonicalMetadata(metadata));
  const ciphertext = new Uint8Array(await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key,
    encoder.encode(String(plaintext)),
  ));
  return { version: 1, metadata: JSON.parse(decoder.decode(aad)), iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function decryptMessageEnvelope(key, envelope, cryptoProvider = window.crypto) {
  if (envelope?.version !== 1) throw new Error('Unsupported encrypted envelope version');
  const plaintext = await cryptoProvider.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.iv),
      additionalData: encoder.encode(canonicalMetadata(envelope.metadata)),
      tagLength: 128,
    },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return decoder.decode(plaintext);
}
