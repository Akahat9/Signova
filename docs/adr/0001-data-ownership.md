# ADR 0001: Firebase and MongoDB Data Ownership

Status: Accepted  
Date: 2026-07-10

## Context

Signova uses Firebase for authentication and realtime client workflows and
MongoDB for backend-owned catalogue, analytics, moderation, and model data.
Duplicating mutable records across both systems would introduce conflicts,
partial writes, and unclear deletion/security behavior.

## Decision

- Firebase Authentication is the only account and token authority.
- Firestore owns user profiles, realtime chats/messages, call signaling, live
  community posts/reactions, and user-facing realtime operational state.
- Firebase Storage owns community, chat, and profile media objects.
- MongoDB owns community sign catalogue records, moderation cases referencing
  Firestore post IDs, discovery/search projections, AI feedback, benchmark/model
  diagnostics, and operational aggregates.
- The verified Firebase UID is the cross-system identity.
- No request may dual-write a complete mutable record to Firestore and MongoDB.
- MongoDB projections must be explicitly rebuildable and must never become an
  accidental second authority for post ownership, captions, reactions, or deletion.

## Consequences

- Realtime UI remains simple and secured by Firebase rules.
- Backend-only workflows can use MongoDB indexes and retention policies.
- Cross-system workflows require idempotency keys and reconciliation metrics.
- MongoDB outages must not break Firebase authentication/chat/live-post reads;
  affected backend-owned features report a degraded state instead.

