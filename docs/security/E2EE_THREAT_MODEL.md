# Signova E2EE Threat Model and Activation Gate

Status: Foundation implemented; product capability remains disabled.

## Protected assets

- Message and attachment plaintext.
- Per-device private agreement/signing keys.
- Conversation keys and attachment content keys.
- Device verification state and membership changes.

## In-scope attackers

- Network observer or compromised transport proxy.
- Curious/compromised application database operator.
- Unauthorized Firestore client or stolen public download URL.
- Attacker modifying ciphertext, metadata, public key bundles, or group membership.
- Lost/revoked device attempting to continue decrypting future messages.

## Explicitly not solved by the current foundation

- Compromised participant device, browser extension, or operating system.
- Metadata hiding (participants, timing, sizes, and routing may remain visible).
- Traffic analysis.
- Account recovery without a separately designed recovery-key ceremony.
- Audited group messaging protocol, post-compromise security, or call encoded-frame E2EE.

## Implemented foundation

- Per-device P-256 ECDH agreement and ECDSA signing keys using Web Crypto.
- Signed public agreement bundles with signing-key fingerprints.
- Bundle signatures bind protocol version, device ID, agreement key, and signing key; device-ID substitution is rejected.
- HKDF-SHA-256 conversation key derivation.
- AES-256-GCM message envelopes binding conversation/message/device/timestamp metadata as AAD.
- Positive per-device sender sequences bound into message AAD plus a bounded
  replay window that accepts limited out-of-order delivery once and rejects
  duplicate or stale sequences.
- Atomic IndexedDB sequence allocation persisted per conversation/device so
  reloads and concurrent sends cannot reuse an AES-GCM message sequence.
- Deterministic order-independent 60-digit safety numbers and QR payloads bound
  to both verified signed device fingerprints.
- Fingerprint-bound verified-device trust persisted locally with distinct
  verified, changed, malformed, and revoked states; revocation is retained.
- Atomic durable receiver replay state spanning reloads and concurrent delivery,
  with conversation-wide message-ID and per-sender sequence rejection.
- Attachment encryption with random AES-256-GCM content keys, conversation-key
  wrapping, metadata AAD, plaintext SHA-256/size verification, and a 25 MiB limit.
- Durable ciphertext-only attachment transport in Firebase Storage with no
  download-token URL, authenticated byte reads, conversation-membership checks,
  sender-only create/delete, immutable objects, progress/cancel support, path
  substitution rejection, and ciphertext size verification.
- A strict Firestore `encrypted_attachment` message schema that rejects
  plaintext/media-path fallback, binds chat/sender/object path, freezes the
  attachment metadata after creation, and bounds every cryptographic field.
- Cross-service lifecycle orchestration removes uploaded ciphertext when message
  publication fails, propagates cancellation, preserves the original error plus
  cleanup state, and marks post-message-delete object failures for audit retry.
- A dry-run-first orphan auditor reconciles encrypted Storage objects with
  authoritative Firestore messages after a 72-hour minimum grace period and
  logs only hashed object references.
- Opaque MLS state persistence with a non-exportable per-device AES-256-GCM key,
  metadata-bound encrypted state, exact monotonic epoch commits, parent transcript
  binding, concurrent fork rejection, tamper fail-closed behavior, and full
  per-device state/key wipe. This is a storage boundary, not an MLS implementation.
- Tamper-detection and two-device interoperability tests.
- Non-exportable private CryptoKeys persisted through IndexedDB structured cloning.
- Authenticated Firebase per-device public-key directory with owner-only publish,
  irreversible history-preserving revocation, verified-user lookup, strict field
  allowlists, and client-side signature verification after lookup.

## Required before `conversationE2EE.available` may become true

1. [Implemented] Authenticated public-key directory with add/revoke history and Firebase rules.
2. [Partial] Deterministic safety-number/QR generation, strict payload comparison,
   and fingerprint-bound persisted verified-device state are implemented;
   user-visible scan/compare ceremony remains.
3. [Partial] Encrypted atomic monotonic epoch-state persistence and rollback/fork
   rejection are implemented; OpenMLS-produced state, Commit/Welcome ordering,
   multi-device fan-out, and membership/key rotation remain.
4. [Partial] Encrypted attachment content keys plus durable ciphertext
   upload/download/delete and conversation-member Storage authorization are
   implemented and tested; MLS content-key integration, multi-device fan-out,
   UI integration, multi-device fan-out, and revocation behavior remain.
5. Recovery design that does not silently escrow plaintext keys.
6. [Partial] Sequence-bound replay/out-of-order handling, atomic durable sender
   allocation, atomic durable receiver state, concurrency/reload tests, and unit
   vectors are implemented; independent cross-device protocol vectors remain.
7. External cryptographic/security review.

The directory does not provide key transparency against a compromised Firebase
administrator. QR/fingerprint verification and an audited transparency or
key-change warning design are still required before users can trust first-seen
keys without an out-of-band ceremony.

Until every gate passes, UI must say E2EE unavailable and must describe local
session encryption and WebRTC DTLS-SRTP only as transport/local protections.
