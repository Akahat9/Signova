# ADR 0003: Encryption Claims and E2EE Boundary

Status: Proposed  
Date: 2026-07-10

## Context

TLS, Firebase platform encryption, WebRTC transport encryption, and a local chat
PIN are useful controls but do not prove application-level end-to-end encryption.
Incorrect claims would create a serious user trust and security problem.

## Proposed decision

- UI copy must describe only controls that are actually implemented and tested.
- No custom cryptographic primitive will be designed for Signova.
- Message E2EE requires audited protocol/library selection, per-device identity
  keys, verified device membership, secure local key storage, rotation, encrypted
  attachments, recovery, and multi-device behavior.
- Call media E2EE is a separate phase built on encoded-frame transforms after real
  calling is stable.
- Servers may store ciphertext and routing metadata but not plaintext message keys.
- External security review is required before an E2EE claim ships.

## Current boundary

Group E2EE is unavailable. Chat locks are local access controls, not cryptographic
message protection. The product must continue to say so until this ADR is accepted.

