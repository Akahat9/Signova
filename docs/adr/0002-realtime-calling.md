# ADR 0002: Authenticated WebRTC Calling

Status: Proposed  
Date: 2026-07-10

## Context

The current call UI creates a local loopback peer connection. Real calls require
authenticated signaling, traversal through restrictive networks, explicit call
state, cleanup, reconnection, and observable quality.

## Proposed decision

- WebRTC carries audio, video, captions, and data-channel traffic.
- Firestore owns ephemeral authenticated call rooms and ICE candidate signaling.
- Firebase rules restrict every room to its caller and callee.
- A backend endpoint issues short-lived TURN credentials; long-lived TURN secrets
  are never exposed to the frontend.
- Room documents expire and are cleaned automatically.
- A dedicated call state machine owns invite, ringing, connect, reconnect, end,
  timeout, and failure transitions.
- `RTCPeerConnection.getStats()` provides network-quality telemetry without storing
  media contents.

## Acceptance gate

This ADR becomes Accepted only after two authenticated accounts pass cross-device,
cross-network, TURN-only, reconnect, unauthorized-access, and cleanup tests.

TURN readiness can be checked without exposing the shared secret using
`npm run check:turn` in `Backend (Node.js)`. A staging TURN-only browser run must
build the frontend with `REACT_APP_SIGNOVA_FORCE_RELAY=true`; the client then
uses `iceTransportPolicy: relay` and rejects missing, malformed, mismatched, or
nearly expired relay credentials before creating a peer connection.
