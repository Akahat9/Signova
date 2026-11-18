# ADR 0004: E2EE protocol and implementation selection

Status: Accepted for implementation qualification; production activation prohibited

Date: 2026-07-11

## Decision

Signova selects **Messaging Layer Security (MLS), RFC 9420**, with **OpenMLS
0.8.1 or a later security-patched compatible release** as the implementation
candidate for private conversations and groups. A two-person conversation is an
MLS group with two authenticated device members. Each physical device is a
separate MLS client/leaf; Firebase UID remains the account identity binding.

This is a protocol/library selection, not a claim that E2EE is deployed. The
current Web Crypto envelope code remains experimental scaffolding and MUST NOT be
presented as MLS or production E2EE.

## Why

- RFC 9420 standardizes asynchronous group keying, membership changes, forward
  secrecy, and post-compromise security with logarithmic group update cost.
- OpenMLS implements RFC 9420, uses an MIT license, exposes a WASM build feature,
  and has undergone an independent 2026 security audit. Security fixes from that
  audit require the patched 0.8.x/0.7.x lines.
- A single group protocol avoids inventing a sender-key rotation scheme and
  avoids maintaining different 1:1 and group cryptographic state machines.

## Rejected for this architecture

### Custom ECDH/HKDF/AES-GCM protocol

The existing primitives are useful for experimentation and encrypted attachment
building blocks, but do not provide a reviewed asynchronous ratchet, membership
epochs, post-compromise security, or recovery semantics.

### Official libsignal as the web-wide dependency

Signal's official repository implements Double Ratchet/PQXDH and exposes native
Java, Swift, and Node/TypeScript wrappers. However, the maintainers explicitly
state that external use is unsupported and bridge APIs may change without notice.
The published Node package contains native desktop/server libraries rather than
a supported browser runtime, and the repository is AGPL-3.0. It therefore cannot
be the common mobile-web/browser implementation without separate licensing and
platform work.

## Mandatory activation gates

All gates must be machine-verifiable before `conversationE2EE.available` can be true:

1. Pinned OpenMLS version and cryptographic provider with lockfile/SBOM evidence.
2. WASM/browser and native mobile compatibility qualification on supported platforms.
3. Persistent encrypted MLS state with atomic epoch updates and rollback protection.
   The browser persistence boundary now provides non-exportable-key encryption,
   exact +1 epoch commits, parent transcript binding, concurrent fork rejection,
   tamper failure, and device wipe; this gate remains incomplete until it stores
   and restores qualified OpenMLS state across real Commit/Welcome flows.
4. Authenticated Firebase KeyPackage directory, one-time consumption, expiry, and replay protection.
5. Device credential binding to Firebase UID and the existing verified-device fingerprint flow.
   KeyPackage claims must also prove that claimant and target are members of the
   referenced immutable-membership Firestore conversation and atomically reserve
   one package for every active target device; partial device fan-out is forbidden.
6. Welcome/Commit ordering, offline delivery, fork recovery, removal, revocation, and rejoin tests.
7. Ciphertext-only Firestore message schema and encrypted attachment key integration.
8. Backup/recovery design that does not silently escrow conversation keys.
9. Independent application integration review and remediation.
10. No plaintext fallback after an encrypted group is established.

## Sources reviewed

- IETF RFC 9420, Messaging Layer Security.
- OpenMLS repository, supported targets/features and maintenance statement.
- OpenMLS 2026 security-audit announcement and patched release guidance.
- Signal Double Ratchet, PQXDH, and Sesame specifications.
- Signal `libsignal` repository support, packaging, API stability, and licensing statements.
