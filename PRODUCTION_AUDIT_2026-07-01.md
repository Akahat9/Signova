# Signova Production Audit

Date: 2026-07-01  
Decision: **REJECT FOR PRODUCTION**

## Scope and evidence

This audit inspected the 255 first-party files visible in the workspace, including the React/Electron client, Node gateway, Firebase rules, MongoDB access, Python inference service, model registry/metrics, Docker files, tests, and deployment configuration. Generated dependencies, virtual environments, build output, binary model weights, and private datasets were excluded from line-by-line source review.

Executed checks:

- React production build: pass
- React tests: 1/1 pass (only a render smoke test)
- Node syntax check: pass
- Python compile: pass
- Python unit tests: 13/13 pass
- Frontend production dependency audit: 0 known advisories
- Backend production dependency audit: 8 moderate advisories
- Live load, WebRTC network, browser matrix, Firebase emulator, and disaster-recovery tests: **not demonstrated**

Passing compilation is not production readiness. The product contains prototypes presented as working security, realtime, settings, call, and sign-learning features.

## Release blockers

### P0-01 — Encryption claims are materially inaccurate

- Severity: Critical
- Category: Security / Product integrity
- Location: `signova-frontend/src/App.js:813-823, 3180-3194, 5886-5892, 5930-5937, 7744, 7989, 9868, 9915`
- Root cause: Browser-memory AES keys are created locally, while plaintext message text and blob URLs are retained alongside ciphertext. There is no authenticated member key exchange, device identity, key verification, rotation, recovery, forward secrecy, or multi-device protocol.
- Impact: Users are told messages, calls, and community notes are end-to-end encrypted when the implementation does not establish E2EE between users. Audio itself is not encrypted by the shown metadata encryption.
- Required fix: Remove every E2EE claim until a reviewed protocol is implemented. Use an established protocol/library (for example MLS or Signal-style sessions), encrypt payloads before persistence/transmission, authenticate participants, and publish a threat model.
- Improved pattern:

```js
// The transport receives ciphertext only. Do not retain plaintext in the record.
const envelope = await conversationCrypto.encrypt({
  conversationId,
  recipientDeviceIds,
  plaintext: new TextEncoder().encode(message),
});
await messageRepository.send({ conversationId, envelope });
```

- Best practice: Never invent or market a custom cryptographic protocol without specialist review and interoperability tests.

### P0-02 — Public testing bypasses exist in the production client

- Severity: Critical
- Category: Security / Authorization
- Location: `signova-frontend/src/App.js:45-46, 7031, 8503, 8520, 8546-8547`
- Root cause: Build-time public environment flags can enable authentication and paid-plan bypass behavior in client code.
- Impact: A misconfigured production build can expose protected UI/features. Client-side Pro state is not authorization.
- Required fix: Delete auth bypasses from production code. Enforce entitlements in trusted backend/Firebase custom claims and deny unauthorized data/API access server-side.
- Improved pattern:

```js
const token = await verifyFirebaseRequest(req);
if (token.plan !== "pro") {
  return sendJson(res, 403, { error: "Pro entitlement required" });
}
```

- Best practice: Frontend feature flags may hide UI, but must never grant authority.

### P0-03 — Firestore message updates allow uncontrolled field mutation

- Severity: Critical
- Category: Security / Database
- Location: `firestore.rules:59-70`
- Root cause: Message update rules only preserve `senderUid`; they do not restrict changed keys, immutable timestamps, type, attachment paths, or maximum document shape.
- Impact: A sender can mutate arbitrary fields after creation, potentially forge metadata, bypass size expectations, or point at unauthorized media.
- Required fix: Use `diff().affectedKeys().hasOnly(...)`, validate every mutable field, make creation time/type immutable, and validate storage ownership.
- Improved rule:

```text
allow update: if isChatMember(chatId)
  && resource.data.senderUid == request.auth.uid
  && request.resource.data.senderUid == resource.data.senderUid
  && request.resource.data.createdAt == resource.data.createdAt
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['text', 'editedAt', 'deletedAt']);
```

- Best practice: Firestore rules are schema and authorization enforcement, not only identity checks.

### P0-04 — No production realtime architecture exists

- Severity: Critical
- Category: Architecture / Realtime
- Location: `Backend (Node.js)/package.json`, `Backend (Node.js)/Index.js`, `signova-frontend/src/App.js:4480-4530`
- Root cause: No Socket.IO/WebSocket signaling service exists. The WebRTC preview creates local and remote peers inside one browser process.
- Impact: Multi-user chat presence, signaling, calls, reconnection, ordering, TURN fallback, and cross-device communication cannot work at production scale.
- Required fix: Define signaling and message architecture, authenticated rooms, TURN/STUN, delivery IDs, idempotency, retries, offline queues, and observability. Prove calls between separate devices/networks.
- Best practice: A loopback WebRTC demo must be labeled a demo, not a call implementation.

### P0-05 — No deployable, version-controlled release baseline

- Severity: Critical
- Category: DevOps / Reliability
- Location: repository status (almost the entire application is untracked)
- Root cause: Source, rules, backend, AI service, and deployment files are not committed as a coherent baseline.
- Impact: Releases cannot be reproduced, reviewed, rolled back, compared, or protected by CI.
- Required fix: Remove generated/temp files, rotate exposed credentials, commit a clean baseline, protect the main branch, and require CI checks and reviewed pull requests.
- Best practice: Production artifacts must be traceable to an immutable commit and dependency lockfiles.

### P0-06 — User-generated media is not actually uploaded or durable

- Severity: Critical
- Category: Functional / Data
- Location: `signova-frontend/src/App.js:3511, 5186, 5923, 6048, 6215`
- Root cause: Multiple flows use `URL.createObjectURL()` as if it were persisted media.
- Impact: Media disappears on refresh/device change, cannot be shared with another user, leaks memory when URLs are not revoked, and creates false success states.
- Required fix: Validate media, upload to owned Firebase Storage paths, persist metadata only after upload succeeds, revoke previews on replacement/unmount, and provide cancellation/progress.
- Best practice: Blob URLs are local previews only.

## High-severity findings

### P1-01 — Frontend is an unmaintainable monolith

- Category: Architecture / UI / Performance
- Location: `signova-frontend/src/App.js` (10,284 lines), `App.css` (23,590), `desktopPageFixes.css` (7,293), `mobileDesktop.css` (4,889), `uiPerformanceFixes.css` (2,791)
- Evidence: `App.js` contains 168 state hooks, 46 effects, 61 refs, 311 click handlers, and 336 buttons.
- Impact: Global regressions, excessive rerenders, stale closures, inaccessible modal behavior, and effectively unreviewable changes. The repeated scroll/card overlap defects are symptoms of this architecture.
- Fix: Split by route/domain; introduce typed service/repository boundaries, route-level lazy loading, scoped CSS/modules, a token-based design system, and focused tests.
- Example:

```jsx
<Routes>
  <Route path="/chats/*" element={<Suspense fallback={<ChatSkeleton />}><ChatRoute /></Suspense>} />
  <Route path="/learn/*" element={<Suspense fallback={<LearnSkeleton />}><LearnRoute /></Suspense>} />
</Routes>
```

### P1-02 — Authentication and database sessions can diverge

- Category: Authentication / State
- Location: `signova-frontend/src/signovaDb.js:13, 72-101`
- Root cause: `activeSession` is a global cache and can create an anonymous Firebase user before the real auth observer settles. It remains cached until an explicit reset.
- Impact: Data can be written under an anonymous UID, appear missing after login, or leak across account switches in one browser session.
- Fix: Make authenticated UID the mandatory owner, subscribe to auth state once, abort pending loads on account change, and remove automatic anonymous sign-in for private user data.

### P1-03 — Local fallback silently changes consistency semantics

- Category: Data / UX
- Location: `signova-frontend/src/signovaDb.js:16-23, 103-138`
- Root cause: A 1.8-second timeout silently falls back to localStorage while the network operation continues and cannot be cancelled.
- Impact: Duplicate writes, stale reads, device-only data presented as saved, and race conditions when the late cloud request completes.
- Fix: Use an explicit offline queue with operation IDs and sync states; abort timed-out requests where possible; show “pending sync,” not “saved.”

### P1-04 — Identity endpoint supports account enumeration

- Category: Security / Authentication
- Location: `Backend (Node.js)/services/identityResolver.js:60-67`
- Root cause: Unauthenticated `/identity/check` returns whether a username/phone mapping exists.
- Impact: Attackers can enumerate registered identities. The in-memory IP limiter is easy to bypass across instances and NAT-unfriendly.
- Fix: Remove the check endpoint from public signup or return a uniform workflow response; use distributed rate limits, App Check, abuse detection, and CAPTCHA after risk signals.

### P1-05 — Identity limiter is non-scalable and returns wrong statuses

- Category: Security / Backend
- Location: `identityResolver.js:9, 40-46, 60-67`
- Root cause: Per-process arrays grow without global eviction; non-rate-limit validation/configuration failures are returned as 503.
- Impact: Memory growth, inconsistent limits across replicas, misleading clients, and brute-force capacity multiplied by instance count.
- Fix: Redis-backed sliding window/token bucket, bounded keys, trusted proxy handling, and explicit 400/401/429/503 mappings.

### P1-06 — Global API limiter is per-process and eviction is exploitable

- Category: Security / Scalability
- Location: `requestSecurity.js:3-41`
- Root cause: In-memory fixed windows are not shared; when full, insertion order eviction can remove active buckets.
- Impact: Limits reset on restart/scaling and can be bypassed by distributed traffic or bucket churn.
- Fix: Use Redis/managed distributed rate limiting with atomic scripts, separate authenticated and IP quotas, and metrics.

### P1-07 — Backend routes lack consistent authentication/rate limiting

- Category: API / Security
- Location: `Backend (Node.js)/Index.js:91-128`, `platformData.js:25-37, 91-116`
- Root cause: Platform health and community sign listing are public by design, but public routes have no cache policy specific to content, no abuse quota, and all responses are forced `no-store`. Create/feedback routes have auth but no rate limit.
- Impact: Scraping/DoS risk and unnecessary database load.
- Fix: Add endpoint policy middleware, public read quotas, cache/ETag for immutable lists, and authenticated write quotas.

### P1-08 — Firebase user records trust client-owned verification fields

- Category: Security / Database
- Location: `firestore.rules:18-37`
- Root cause: Users may write `emailVerified` and `phoneVerified` fields themselves.
- Impact: Any UI/backend trusting these fields can be bypassed.
- Fix: Remove verification and entitlement fields from client-writable documents; derive them from Firebase token claims or admin-only records.

### P1-09 — Chat creation permits arbitrary member assignment

- Category: Authorization / Abuse
- Location: `firestore.rules:44-57`
- Root cause: Any verified user can create a chat containing up to 49 arbitrary UIDs, without invitation/consent or member existence checks.
- Impact: Spam, harassment, unwanted group creation, and notification abuse.
- Fix: Use invites or backend-mediated creation with membership consent and per-user abuse limits.

### P1-10 — Storage rules trust MIME metadata and expose uploads publicly

- Category: Security / Uploads
- Location: `storage.rules:9-37`
- Root cause: Validation uses client-supplied content type; profile/community objects are world-readable; file names and ownership metadata are not constrained.
- Impact: Polyglot/malicious content distribution, privacy leakage, and unbounded public hosting abuse.
- Fix: Quarantine uploads, verify signatures server-side, generate safe derivatives, use random object IDs, malware scan, moderation, retention rules, and signed access where content is private.

### P1-11 — MongoDB index creation blocks normal request startup

- Category: Database / Reliability
- Location: `mongoClient.js:39-46, 49-78`
- Root cause: Every first database request waits for all indexes to be checked/created.
- Impact: Cold-start latency and request failure if index permissions are unavailable.
- Fix: Run schema/index migrations as a deployment job; application startup should validate schema compatibility, not mutate production schema.

### P1-12 — MongoDB client is not closed on shutdown

- Category: Backend / Reliability
- Location: `mongoClient.js`, `Index.js:182-193`
- Root cause: The client instance is hidden inside a promise and no close function is invoked during shutdown.
- Impact: Forced termination, dropped in-flight writes, slow container shutdown, and unreliable tests.
- Fix: Export `closeMongoClient()`, stop accepting requests, await server close, drain work, close Mongo, then exit with a deadline.

### P1-13 — AI service can be exposed without authentication

- Category: AI / Security
- Location: `ai-service/signova.py:428-431`, `docker-compose.yml:7-10`
- Root cause: Empty service token is accepted whenever configured host is loopback, while Compose binds port 8000 publicly and does not set a token. Configuration is fragile and environment-dependent.
- Impact: Inference endpoints may be reachable without auth after deployment/network changes.
- Fix: Fail startup outside an explicit development mode when token/mTLS is absent; do not publish the AI port publicly; place it on an internal network.

### P1-14 — Python development HTTP server is not a production serving stack

- Category: AI / Scalability
- Location: `signova.py:421, 655-662`
- Root cause: `ThreadingHTTPServer` directly serves CPU/GPU inference.
- Impact: Weak lifecycle/timeout/backpressure/telemetry behavior and poor multi-worker resource governance.
- Fix: Move API to FastAPI/ASGI behind a production server; isolate model workers; queue bounded inference; expose readiness/liveness separately.

### P1-15 — AI input dimensions are insufficiently bounded

- Category: AI / Security / Performance
- Location: `signova.py:455-466, 567-632`
- Root cause: Body bytes are bounded, but landmark/frame list lengths, nesting, labels, and decoded image pixel count are not comprehensively validated at the API boundary.
- Impact: CPU/RAM exhaustion and pathological inference latency.
- Fix: Typed schemas with maximum list lengths/dimensions, base64 decoded-size checks, decompression-bomb protection, and per-route limits.

### P1-16 — AI dependencies are largely unpinned

- Category: Supply chain / Reproducibility
- Location: `ai-service/requirements.txt`
- Root cause: NumPy has only an upper bound; Pillow, Torch, and torchvision are unpinned.
- Impact: Non-reproducible models, incompatible wheels, silent numerical changes, and supply-chain drift.
- Fix: Generate hashes/lockfiles for CPU and GPU targets; pin CUDA/runtime variants; create an SBOM and scan the built image.

### P1-17 — Docker runs as root and copies the whole AI context

- Category: DevOps / Security
- Location: `ai-service/Dockerfile:1-21`
- Root cause: No non-root user, health check, `.dockerignore` evidence, immutable model artifact stage, or resource policy.
- Impact: Larger attack surface/image, accidental inclusion of local files, and weak runtime hardening.
- Fix: Multi-stage build, non-root UID, read-only filesystem, explicit copied paths, healthcheck, pinned digest base image, and GPU resource declarations.

### P1-18 — Settings include non-functional controls

- Category: Functional / UX
- Location: representative examples `App.js:9886, 10196`
- Root cause: Several “settings” buttons only display status text rather than changing or enforcing behavior.
- Impact: Users believe security/privacy/notification settings are active when they are not.
- Fix: Maintain a settings capability matrix. Hide unfinished controls or label them preview-only; test persistence and enforcement end-to-end.

### P1-19 — Client-side chat lock is not a security boundary

- Category: Security / UX
- Location: `App.js:5616-5654`
- Root cause: A locally hashed password controls UI access while message data remains available to the same JavaScript origin/storage.
- Impact: “Locked” chats can be read by XSS, devtools, extensions, or local data extraction.
- Fix: Describe it as a privacy screen, use platform secure storage/WebAuthn for unlock, and encrypt persisted chat data with a protected key if offline secrecy is required.

### P1-20 — No backend automated tests

- Category: QA / Reliability
- Location: `Backend (Node.js)/package.json`
- Root cause: Only `node --check` exists.
- Impact: Auth, rate limits, CORS, malformed bodies, Firebase failures, Mongo failures, and transaction behavior can regress undetected.
- Fix: Add unit and integration tests using Firebase/Mongo emulators/test containers; require coverage on critical branches.

## Medium-severity findings

1. **Oversized bundles:** main JS 335.46 kB gzip, Three/R3F chunk 243.39 kB, CSS 141.21 kB. Split routes, remove dead UI, compress models/assets, and set performance budgets.
2. **CRA technical debt:** `react-scripts@5` is obsolete infrastructure and drives development audit debt. Migrate to Vite or a maintained framework in an isolated change.
3. **Backend dependency advisories:** eight moderate production advisories flow through `firebase-admin`/Google libraries. Upgrade and regression-test; do not force-update blindly.
4. **Object URL leaks:** only one revoke was found for several create calls. Centralize preview lifecycle and revoke on unmount/replacement.
5. **Timer-heavy UI:** dozens of timeout/interval-driven interactions and custom double-tap behavior create races and accessibility problems. Replace delay-based navigation with explicit controls/state machines.
6. **CSS cascade instability:** four giant global stylesheets make source order the de facto design system. Use tokens, component scopes, and visual regression snapshots.
7. **No error boundaries:** a render/runtime exception in the monolith can blank the entire app. Add route and high-risk camera/3D boundaries.
8. **No robust API cancellation:** route changes/account changes can leave async work resolving into stale state. Use `AbortController` and request identity.
9. **No idempotency for write endpoints:** retries may duplicate feedback or side effects. Require idempotency keys for retried writes.
10. **Health endpoint couples to AI:** backend `/health` calls AI and can make the whole service unhealthy. Separate liveness from dependency readiness.
11. **Error status flattening:** several catch blocks return 503/401 for unrelated validation and internal errors. Centralize typed errors and safe logging.
12. **No structured logs/tracing:** console messages lack request IDs, user-safe correlation IDs, metrics, and redaction.
13. **No Redis despite scale assumptions:** rate limits, presence, idempotency, session coordination, and job state cannot coordinate across replicas.
14. **No backup/restore evidence:** MongoDB/Firestore backup schedules, retention, encryption keys, and restore drills are undocumented.
15. **No data deletion workflow:** deleting a Firebase account does not demonstrate cascading deletion from Mongo, Storage, local caches, analytics, and backups.
16. **DPDP operational gaps:** consent records, purpose/version, withdrawal, grievance workflow, retention enforcement, child handling, breach process, and data-principal export/delete proof are absent.
17. **Accessibility coverage absent:** no axe tests, keyboard-flow tests, focus-trap verification, reduced-motion audit, or screen-reader matrix.
18. **Responsive coverage absent:** no visual tests for 320/360/390/768/1024 widths, landscape, safe areas, zoom, or virtual keyboard.
19. **WebRTC production configuration absent:** no TURN credentials, ICE policy, stats monitoring, reconnection state machine, device-switch tests, or packet-loss tests.
20. **Call history semantics unreliable:** UI/state demos do not establish server-authoritative call records, ordering, deduplication, or reconciliation.
21. **Community counters have contention risk:** one Firestore post document is transactionally updated for every like/share, creating a hot document at scale.
22. **Presence is expensive:** every heartbeat calculates multiple aggregate queries. Cache aggregates and decouple writes from read-heavy summaries.
23. **Public post schema is under-constrained:** create rules do not use `keys().hasOnly`, allowing extra fields and oversized nested content.
24. **Empty Firestore index manifest:** current queries may work only because they are simple; there is no documented index plan for scaled feeds/chats.
25. **Electron hardening incomplete:** sandbox, navigation/window-open restrictions, permission handlers, CSP verification, and IPC argument validation are absent.
26. **No CI/CD configuration found:** no mandatory lint, test, rule emulator, dependency scan, image scan, SBOM, or deployment promotion gate.
27. **No test coverage thresholds:** the single frontend smoke test can pass while every user interaction is broken.
28. **AI benchmark evidence is offline-only:** existing reports do not prove live-device latency, demographic/signer generalization, low-light robustness, or calibrated confidence.
29. **ISL quality is below release quality:** the prior registry report records 40% validation accuracy for ISL top-10; it must not be marketed as reliable translation.
30. **Learn avatar is not semantically complete:** a data-driven animation shell is not evidence that linguistic signs, non-manual markers, timing, and regional variants are correct.

## UI/UX report

The primary UX defect is systemic, not a single margin bug. The app has no stable layout contract. Global CSS overrides, fixed viewport calculations, nested scroll regions, animation timers, and one component controlling almost every surface produce the reported overlapping cards, double scrollbars, clipped mobile chat, inconsistent dark theme, and modal positioning.

Required UI release gate:

- One app shell with one documented scroll owner per route
- Design tokens for light/dark surfaces, text, borders, focus, spacing, typography, radii, elevation, and motion
- Minimum 44×44 CSS-pixel touch targets
- Keyboard-complete navigation and modal focus management
- `prefers-reduced-motion` support
- WCAG 2.2 AA contrast and zoom to 200%
- Automated screenshots at 320×568, 360×800, 390×844, 768×1024, 1024×768, 1440×900, and landscape variants
- No horizontal overflow at any target
- Native scrolling; avoid JS scroll animation unless essential

## Performance and scalability report

The current design does not support one million users. The backend has no distributed coordination, job queue, cache layer, autoscaling evidence, load-shedding policy, or database capacity model. Presence aggregation and transactional counters will become hotspots. AI concurrency defaults to two inferences per process and lacks a queue/GPU scheduling model.

Do not run 100–1000-user tests against production. Create an isolated staging environment with synthetic accounts/data and test:

- k6: auth-protected reads/writes at 100, 500, and 1,000 concurrent virtual users
- sustained 30-minute and spike tests
- p50/p95/p99 latency, error rate, saturation, queue delay, Mongo pool wait, Firestore contention, AI inference latency
- WebRTC tests through TURN with 2%, 5%, and 10% loss and network changes
- browser memory after 30-minute camera, voice recording, 3D avatar, and route-switch sessions

Initial SLO proposal: API p95 < 300 ms excluding inference, inference p95 target defined per device/model, error rate < 0.5%, and zero unbounded queues.

## Architecture review

Recommended target boundaries:

```text
React routes
  -> typed API client
  -> Node API/BFF
     -> Firebase Auth/Firestore (identity, chat metadata)
     -> MongoDB (moderated catalogue/community/AI feedback)
     -> Redis (rate limits, presence, idempotency, jobs)
     -> signaling service + TURN (calls)
     -> private AI inference service
```

Do not allow the client to decide entitlement, verification, encryption status, moderation, or authoritative counters.

## Scores

| Area | Score / 100 |
| --- | ---: |
| Code quality | 31 |
| Security | 38 |
| Performance | 42 |
| Scalability | 24 |
| Maintainability | 18 |
| User experience | 39 |
| Reliability | 30 |
| Production readiness | **27** |

## Prioritized roadmap

### Phase 0 — Stop-ship safety (first)

1. Remove or correct E2EE/security claims; disable production bypass paths.
2. Rotate all credentials previously shared or present in local configuration.
3. Establish a clean committed baseline and CI.
4. Tighten Firestore/Storage rules and test them in emulators.
5. Hide non-functional security/settings/call controls.

### Phase 1 — Stable product foundation

1. Split `App.js` into route/domain modules without redesigning behavior.
2. Replace global CSS patches with tokens and scoped components.
3. Establish one scroll/layout owner and responsive visual tests.
4. Fix authenticated data ownership and offline synchronization.
5. Add backend/API/Firebase integration tests and browser E2E tests.

### Phase 2 — Real communication platform

1. Design server-authoritative chat and durable uploads.
2. Implement signaling, TURN, reconnection, ordering, idempotency, and delivery states.
3. Add Redis/distributed limits, structured telemetry, dashboards, alerts, and SLOs.
4. Implement truthful, reviewed E2EE or remove the promise permanently.

### Phase 3 — AI productionization

1. Pin dependencies and create reproducible model containers.
2. Add typed request limits, worker isolation, GPU scheduling, and backpressure.
3. Validate on independent signers and real calls; calibrate confidence/rejection.
4. Gate each language/model independently. Do not release low-quality ISL as translation.

### Phase 4 — Compliance and release

1. Complete DPDP data inventory, notices, consent/version records, retention, export/delete, grievance and incident procedures.
2. Perform staging load, browser/device, accessibility, penetration, backup-restore, and disaster-recovery tests.
3. Canary release with rollback and monitored error/performance budgets.

## Immediate next step

Create a **release-hardening branch** and complete Phase 0 only. The first implementation task should be Firestore/Storage authorization tests plus removal of misleading E2EE/bypass behavior. Do not continue visual redesign or public deployment until these stop-ship items pass.

