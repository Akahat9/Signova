# Signova Production Implementation Tracker

Last updated: 2026-10-12

## Purpose

This is the living implementation record for Signova. Update it whenever a
production-readiness task is started, completed, tested, blocked, or materially
redesigned. It records what changed, where it changed, how it was verified, and
what remains.

## Current execution decision — 2026-10-12

The active delivery order, set by the product owner, is: responsive web across
all app surfaces; Flutter private beta; ISL top-30 data qualification and
retraining; reliable one-to-one calling; then remaining backlog triage and
delivery. Resolve release-critical privacy/security gates before inviting beta
users. Preserve Firebase as the owner of accounts and call-room signaling, and
keep mobile recognition on-device.

The responsive web work starts with the Community mobile page, whose former
mobile fallback forced a 1,180px page and hid vertical overflow. Flutter is a
new project at `mobile/signova_flutter/`; its generated models remain private
artifacts. A maintained ONNX Runtime Flutter wrapper currently requires iOS 16,
so that integration raises the plan's provisional iOS 15 floor until a reviewed
iOS-15-compatible ONNX bridge is selected. Android remains API 24+.

The current AI path is not ChatGPT/OpenAI: the Node gateway forwards AI
requests to the local or deployed Signova Python service through
`SIGNOVA_AI_URL` (development default `http://127.0.0.1:8000`). Missing or
unqualified model artifacts should degrade AI features to an explicit
unavailable state; they must not be treated as a production-ready model.

## Status legend

- `[x]` complete and verified
- `[~]` implemented or in progress, but not production-complete
- `[ ]` not started
- `[!]` external dependency, decision, or blocker

## Data ownership decision

Signova intentionally uses both Firebase and MongoDB. Mutable records must have
one source of truth; the application must not silently dual-write the same record
to both databases.

### Firebase owns

- Authentication, verified identity, Firebase ID tokens, and authenticated E2EE public device-key/revocation records.
- User profiles and private identity lookup records.
- Realtime chats, messages, delivery state, call signaling rooms, and presence.
- Live community posts, reactions, and creator-owned post deletion.
- Binary community/chat/profile media in Firebase Storage.

### MongoDB owns

- Community sign catalogue and versioned sign metadata.
- Moderation cases and discovery/search projections that reference Firebase post IDs.
- AI feedback, benchmark summaries, model diagnostics, and retention-controlled analytics.
- Community installation/presence aggregates and operational reporting.

### Integration rule

The verified Firebase UID is the cross-system identity. Backend routes verify the
Firebase ID token before accessing MongoDB. MongoDB never stores passwords, OTPs,
raw Firebase tokens, or a second mutable copy of live Firestore messages/posts.

## Corrected execution flow

1. Make all existing React web surfaces responsive and validate each flow at
   phone, tablet, and desktop widths, including safe areas, keyboard behavior,
   permissions, touch targets, and horizontal overflow.
2. Build the Flutter private beta around Firebase auth/call-room ownership,
   offline local ISL/ASL recognition, learning, and authenticated one-to-one
   calls. Generate platform hosts and build iOS on macOS CI. The beta requires
   private model-artifact delivery, Firebase native app configuration, and
   TestFlight/Play internal-testing credentials.
3. Qualify ISL top-30 only after public-source licensing review, expert-approved
   vocabulary, new consented signer data, signer-disjoint evaluation, and all
   registry promotion/rejection gates. The current candidate does not pass.
4. Validate managed TURN and cross-network calls on separate physical iOS and
   Android devices; do not include calls in beta until relay-only checks pass.
5. Triage the tracker backlog. Resolve and deploy the existing private identity
   lookup before beta; finish deployment/operations work, continue frontend
   extraction, and keep encryption claims disabled until MLS integration and
   external review are complete.

Foundation, Firebase/Mongo ownership, and existing validation practices remain
in force throughout this sequence.

## Phase overview

| Phase | Status | Completion | Notes |
|---|---|---:|---|
| Baseline, ownership, tracker | `[x]` | 100% | Tracker, ownership ADRs, architecture correction, and CI added |
| Durable community media | `[x]` | 100% | Durable workflow, signatures, posters, moderation, orphan audit, and authenticated upload/play/delete browser E2E verified |
| Responsive web across all surfaces | `[~]` | 15% | Removed the 1,180px mobile canvas, enabled vertical page scrolling and safe-area bottom nav for Community, added phone/tablet/desktop overflow coverage; remaining web routes and real-device Safari/Chrome checks are open |
| Flutter private beta | `[~]` | 25% | Added app code for Firebase email sign-in, offline starter lesson UI, camera/landmark/ONNX inference and 1:1 Firestore/WebRTC signaling; generated host projects, dependency resolution, iOS 16 compatibility, model artifact distribution, and physical-device verification remain |
| Real video calling | `[~]` | 87% | Authenticated two-browser negotiation/media/end and camera-denial fail-closed E2E, validated expiring TURN config, relay-only staging mode, forward-only lifecycle, reconnect, cleanup, and stats implemented |
| Automated testing depth | `[~]` | 99% | Unit/integration/rules plus desktop/mobile production-build journeys and real Firebase signup/verification/login/logout/recovery, API outage/recovery, community-media, realtime two-user text chat, two-party calling, and camera-denial E2E exist; physical cross-network/TURN-only staging remains |
| AI model completion | `[~]` | 85% | Promotion and deployment enforce consent/diversity, expert label specs, active artifact/dataset checksums, rejection benchmarks, and canary controls; top-30 data audit found no eligible consented signers and candidate macro F1 0.2248/0.2467, far below the 0.80 promotion minimum |
| True encryption | `[~]` | 92% | MLS/OpenMLS selected; KeyPackage fan-out, identity/replay/trust, ciphertext lifecycle, and encrypted monotonic epoch-state persistence tested; MLS runtime/rotation/recovery/review remain |
| CI/CD and operations | `[~]` | 85% | CI, fail-closed AI production gate, guarded deploy/rollback, config/SBOM validation, smoke/load, backup/restore safety, tracing, and crash ingestion exist; live sink/alert activation and restore drill remain |
| App.js maintainability | `[~]` | 85% | Auth validation/capabilities/API/speech/camera/MediaPipe loading and frame scheduling/calling/community/durable media plus profile-media, account-scoped cache, contact, learning, progress, versioned settings/privacy enforcement, shared presentation/iconography/data, migrated chat locks/attachments/local protection/card rendering, call-media protocol, and peer-session domains extracted and tested |

## Completed work

### Settings UI and theme repair

- [x] Settings page now follows the app theme selector again instead of forcing
  the dark reference palette for every theme.
- [x] Removed the desktop settings subtitle text and the redundant
  `settingsDesktopProfile` sidebar card.
- [x] Repaired the desktop settings top bar grid, icon button alignment, profile
  menu sizing, and full-height workspace/content/context panel sizing.
- [x] Rebuilt Settings switches with a final design-system override so older
  desktop page fixes cannot force the off-brand green/teal switch styling.
- [x] Added local browser persistence fallback for Settings updates and fixed
  the `1440p` camera-resolution schema mismatch that caused the UI value to be
  sanitized away on reload.
- [x] Fixed refresh/startup skeleton hangs by making legacy settings migration
  non-blocking and adding a local-workspace startup watchdog.
- [x] Added persistence regression coverage proving cached workspace data is
  used when a Firestore startup read times out, protecting the refresh skeleton
  path from hanging on slow/unavailable cloud reads.
- [x] Added a Settings refresh E2E regression that seeds local settings,
  reloads the app, waits for the startup skeleton to disappear, and verifies
  the persisted `1440p` camera setting hydrates after reload.
- [x] Added an E2E preflight guard before Playwright that fails fast with a
  clear Java 21 LTS/Firebase CLI requirement instead of hanging behind emulator
  startup failures; Java-version parsing is covered by a node test.
- [x] Verified the production E2E build and a browser audit for dark mode,
  light mode, removed profile block, subtitle removal, and zero horizontal
  overflow.

### Repository validation

- [x] Root `npm run check` covers backend syntax/tests, frontend tests, Firebase
  rules tests, Python tests, and the frontend production build.
- [x] Backend regression tests verify protected metrics routes preserve `401`.
- [x] Frontend production API misconfiguration now fails with a clear error.
- [x] Non-JSON API responses return a useful frontend error.
- [x] Added `npm run check:mongo` for safe MongoDB Atlas health diagnostics.
  Verified the configured Atlas cluster/database `signova` responds with
  `status: ok` and lists expected Mongo-owned collections without exposing
  credentials.

### Durable community media foundation

- [x] Selected image/video files upload to creator-scoped Firebase Storage paths.
- [x] Firestore stores the durable download URL and Storage object path.
- [x] Failed Firestore publish attempts clean up the just-uploaded object.
- [x] Creators receive a real `Delete post` action.
- [x] Deletion removes the Firestore post and attempts Storage object cleanup.
- [x] Non-owner feed removal is a persistent local hide, not a fake database delete.
- [x] Firestore and Storage security tests cover creator publish/delete and video upload/delete.
- [x] Library action button, excessive side padding, and oversized custom scroll rail were redesigned.

Verification at completion:

- Frontend unit tests: 3 passed.
- Firebase/Storage rules tests: 8 passed.
- Python AI tests: 13 passed.
- Backend tests: 3 passed.
- Frontend production build: passed.

## Current work

### Phase 1 — Baseline and architecture

- [x] Create this living tracker.
- [x] Inventory current Firebase and MongoDB usage.
- [x] Establish the no-dual-write ownership rule.
- [x] Reconcile `DATA_ARCHITECTURE.md` with actual live-post ownership.
- [x] Add Architecture Decision Records for data ownership, calling, and encryption.
- [x] Add CI workflow and documented local toolchain versions.

## Remaining backlog

### Durable media completion

- [x] Resumable upload progress, cancel, and retry UI.
- [x] File signature validation and browser-compatible media policy.
- [x] Thumbnail/poster generation.
- [x] Moderation case creation in MongoDB using the Firebase post ID.
- [x] Backend verifies the authoritative Firestore post exists before creating/updating its MongoDB moderation case.
- [x] Dry-run-first orphan-object audit/cleanup script; production scheduling remains an operations task.
- [x] End-to-end authenticated video upload/play/delete browser test, including Firestore and Storage deletion verification.

### Real authenticated video calling

- [x] Define call-room and ICE-candidate Firestore schema/rules.
- [x] Implement authenticated invite/ring/accept/reject/end signaling.
- [x] Replace local loopback with caller/callee peer connections.
- [x] Add backend TURN configuration with short-lived Coturn REST credentials; production server provisioning remains.
- [x] Add reconnect, ICE restart, ring timeout, and same-client duplicate-call protection.
- [x] Add `getStats()` network quality indicators and in-session telemetry.
- [x] Enforce a forward-only, role-aware signaling lifecycle; terminal rooms cannot be resurrected.
- [x] Add authenticated two-browser call E2E covering offer/answer, both candidate owners, bidirectional remote video tracks, and remote hang-up cleanup.
- [x] Fail closed on camera permission denial before creating a signaling room, with browser coverage proving no call-room write occurs.
- [~] Cross-device, cross-network, and TURN-only tests. Same-host verified-user negotiation, relay-only client policy, credential validation, and environment preflight are automated; a credentialed physical two-device staging run remains.

### AI model completion

- [~] Freeze production vocabulary class maps and expert-reviewed label specifications. Class-map SHA-256 values and a fail-closed exact-coverage specification schema/promotion gate are complete; qualified ASL/ISL reviewers must author and approve the real 10–500-label specifications.
- [x] Define consent-aware signer-separated train/validation/test manifests with leakage, hash, path, identity-field, and label-coverage validation.
- [~] Collect diverse signer/background/lighting/handedness data with consent. Machine-enforced collection taxonomy, privacy constraints, split/label signer minimums, and promotion coverage gates are complete; actual private recordings and consent records remain external.
- [x] Add unknown/no-sign rejection benchmark report tooling.
- [x] Enforce model promotion gates in the registry.
- [~] Store versioned private model artifacts and verify checksums at startup. Verification is implemented; private artifact publication remains external.
- [x] Add dedicated canary-channel activation and explicit rollback tooling.

### Encryption

- [x] Write threat model and recovery/multi-device requirements.
- [x] Select an audited message encryption protocol/library. MLS RFC 9420 with security-patched OpenMLS is selected for qualification; production activation remains prohibited until all ADR 0004 gates pass.
- [~] Implement per-device identities and secure key storage. Non-exportable local storage, authenticated public-key publication/lookup, irreversible revocation history, and backend-only one-time MLS KeyPackage claiming are implemented; key transparency and MLS UI lifecycle integration remain.
- [~] Persist MLS group state safely. Opaque state is encrypted under a non-exportable per-device key with exact monotonic epochs, parent transcript binding, concurrent fork/rollback rejection, tamper failure, and device wipe; qualified OpenMLS state restore and real Commit/Welcome flows remain.
- [~] Implement encrypted attachments and group member key rotation. Metadata-bound encryption/content-key wrapping, durable ciphertext transport, strict message schema, authenticated participant access, publish rollback, deletion cleanup state, and orphan auditing are complete; MLS key/UI integration, device fan-out, revocation, and group rotation remain.
- [ ] Add encoded-frame call E2EE only after real calling is stable.
- [ ] Obtain external security review before making E2EE claims.

### Maintainability and tests

- [~] Extract API/Firebase/media services from `App.js`. Call signaling, quality, community document models, and durable upload/poster/cleanup orchestration are extracted and tested.
- [~] Extract Community feature. Firestore post normalization/payload construction is extracted and tested; UI/state orchestration remains.
- [~] Extract Chat feature. Conversation ownership/migration, Firestore direct-message transport, dedicated direct-message outbox, authoritative direct delivery/read receipts, durable direct attachment schema/transport, attachment validation/classification, size formatting, and message presentation are extracted and tested; composer/message-list state orchestration remains.
- [~] Extract Calling feature and state machine. Pure lifecycle, quality, signaling, live-track/media-state, caption-protocol, and dependency-injected peer-session modules are tested; reconnect policy and media UI orchestration remain in `App.js`.
- [~] Extract Authentication and Camera features. Auth normalization/form/profile validation/error mapping plus camera media lifecycle, MediaPipe loading, and frame scheduling are extracted and tested; Firebase session/UI orchestration and MediaPipe result interpretation remain.
- [~] Add integration tests for auth, community, media, camera, API failures, and MongoDB. Real Firebase Auth/Profile integration and the authenticated Firebase-post-to-Mongo-moderation seam with failure short-circuits are covered; physical camera hardware and live MongoDB integration remain.
- [~] Add browser E2E tests for critical user journeys. Real Firebase signup/verification/login/logout/recovery, desktop/mobile auth/settings layout, deterministic API outage/retry recovery, durable video upload/play/delete, authenticated two-user Firestore text messaging, authenticated two-party WebRTC calling, and camera-denial failure are complete; physical cross-network/TURN-only staging remains.
- [~] Add a durable UID-scoped offline-write outbox with retry/conflict policy. Versioned aggregate write-ahead persistence, per-document latest-intent compaction, immutable acknowledgements, serial bounded reconnect flush, failure retention, session-generation invalidation, and UID isolation are complete. Verified direct text chats now use per-message Firestore documents with a dedicated same-device queued-send outbox; revision-aware multi-device merging of remaining aggregate documents and migration of local/legacy conversations remain.
- [~] Implement account deletion only with recent Firebase reauthentication plus verified cleanup of Firestore subcollections, Storage objects, identity mappings, Mongo-owned records, and the Firebase Auth account. Backend deletion now requires a fresh verified Firebase ID token, explicit `DELETE` confirmation, private identity cleanup, Firestore recursive cleanup, Mongo retention cleanup, Storage prefix cleanup, and deletes the Auth user last. Frontend password reauthentication, guarded Settings UI, and a dry-run-first staging/emulator validation harness are implemented; an applied staging/emulator evidence run remains.

### Production operations

- [x] GitHub Actions CI with pinned Node 22, Python, and Java LTS.
- [~] Development/staging/production environment separation. Required isolation and GitHub Environments are documented; owner infrastructure must be created.
- [x] Protected production deployment and rollback workflow, including main-branch enforcement and fail-fast environment validation.
- [~] Structured logs, correlation IDs, metrics, crash reporting, and alerts. Authenticated privacy-safe browser crash ingestion, anonymous grouping, accessible recovery, documented thresholds, correlation IDs, and structured backend logs are complete; centralized sink and paging activation remain environment-owner tasks.
- [~] Backup policy plus tested restore procedure. Dry-run-first MongoDB/Firestore backup and isolated restore tooling exists; a credentialed quarterly restore drill remains.
- [~] Load/stress test and production readiness checklist. Bounded health-load and multi-service smoke harnesses plus the runbook exist; staged capacity results remain.

## Known external/tooling issues

- `[!]` Firebase Admin currently carries moderate transitive `uuid` advisories;
  npm's available forced fix is not a safe application-level remediation.
- `[!]` Firebase emulator shutdown is unreliable under the installed Java 25;
  standardize automation on a supported Java LTS runtime.
- `[!]` Production TURN service credentials, deployment accounts, DNS, and environment
  secrets require owner-provided infrastructure/authority.

## Change log

### 2026-07-14

- Added Firestore-backed direct-message delivery/read receipts. Recipients now write their own `receipts/{uid}` document under each incoming message, senders subscribe to receipt collection-group snapshots, and outgoing bubbles upgrade to delivered/read only from Firestore evidence instead of local simulation.
- Hardened receipt authorization in Firestore rules. Only chat members can read receipts, only the matching authenticated recipient can create/update their own receipt, senders cannot spoof delivery/read state on their own messages, delivered timestamps are immutable, read timestamps cannot be rewritten, and receipt deletes are blocked.
- Preserved receipt-derived UI state across direct-message snapshot refreshes so a later message snapshot does not downgrade an already delivered/read outgoing row back to `sent`.
- Added focused service/model/rules regression coverage for receipt normalization, grouping, UI application, transaction acknowledgement, sender spoof rejection, outsider read rejection, read upgrade, read immutability, and delete denial.
- Added durable direct-chat image/audio/document attachment transport. Verified Firebase chats now upload files to member-readable `chatAttachments/{chatId}/{senderUid}/{messageId}/{fileName}` Storage paths, publish bounded Firestore attachment metadata only after upload succeeds, hydrate preview/download URLs from Storage at render time, and attempt Storage cleanup if publish or unsend fails after upload.
- Hardened attachment rules. Firestore attachment metadata must match the sender, chat ID, message ID, type, size, and Storage path; Storage allows only verified chat members to read, only the sender to create/delete, rejects non-member reads and sender spoofing, and keeps encrypted attachments on their separate ciphertext-only path.
- Added focused attachment coverage for safe storage names, durable descriptors, Firestore attachment normalization/send batching, UI copy for durable vs local previews, Firestore metadata binding, and Storage member-only attachment access.
- Added resumable direct attachment uploads with visible per-message progress, cancel control, publish-stage state, upload-task cleanup, cancelled/failed status, and same-session retry while the original browser `File` object is still available.
- Added focused lifecycle coverage for resumable direct attachment progress, task exposure, URL return, cancellation/error propagation, and card-level progress/cancel rendering.
- Added dry-run-first direct attachment orphan auditing. `audit:direct-attachments` reconciles `chatAttachments/` Storage objects against Firestore message `mediaPath` references, uses a minimum 24-hour grace window with a 72-hour default, requires `SIGNOVA_ALLOW_DIRECT_ATTACHMENT_DELETE=true` before deletion, and logs only hashed private object references.
- Added direct attachment auditor tests for aged unreferenced object selection and privacy-safe operational references. Backend syntax checks include the new script.
- Remaining chat scope: reload-persistent direct attachment retry, scheduled execution/evidence for direct attachment orphan cleanup, hard-delete, presence, group chat, cross-device conflict resolution for legacy aggregate records, and MLS-backed production E2EE remain separate unfinished capabilities.

### 2026-07-13

- Added `features/chat/directMessageOutbox.js`, a UID-scoped durable queued-send boundary for verified Firestore direct text messages. It stores only owner/sender UID, contact ID, direct chat ID, message ID, text, token, and queued time; validates bounded IDs/text; compacts repeated message IDs; acknowledges by immutable token; and flushes FIFO while retaining failed and later messages.
- Wired realtime send failures/timeouts into the direct-message outbox. Failed verified direct messages become `queued`, retry on realtime-chat readiness or browser reconnect, and reuse the same client message ID so the authoritative Firestore snapshot replaces the optimistic row without duplicates.
- Queued direct messages are now restored into the selected verified conversation after reload/chat selection as visible `queued` rows, then replaced by the authoritative Firestore snapshot after retry succeeds.
- Fixed the message retry action for Firestore-backed failed messages. It no longer fabricates delivered/read state; it retries the real Firestore batch, queues again on failure, and keeps local-only retry behavior only for non-Firebase messages.
- Added Firestore-backed unsend for verified direct text messages. Sender unsend now updates the authoritative message with `deletedAt` and replacement text, remote snapshots normalize the row as deleted/unsent, and local-only unsend remains local instead of claiming remote deletion.
- Added Firestore-backed edit for verified direct text messages. Sender edits now update the authoritative message with bounded replacement text and `editedAt`; remote snapshots render edited state instead of diverging per device.
- Added Firestore-backed reactions for verified direct messages. Each user writes only their own `reactions/{uid}` document, chat members subscribe to reaction snapshots, local refreshes preserve reaction state, and Firestore rules reject outsiders, UID spoofing, and oversized reactions.
- Added direct-message outbox/service tests plus focused chat regression coverage. Focused frontend chat coverage now passes 22/22 tests, the optimized production build compiles successfully, and Firestore/Storage rules pass 16/16 assertions including reaction authorization.
- Remaining chat scope: direct attachments, hard-delete, presence, group chat, cross-device conflict resolution for legacy aggregate records, and MLS-backed production E2EE remain separate unfinished capabilities.

- Added the authenticated account-deletion backend route at `POST /api/account/delete`. It verifies a revoked-checked email-verified Firebase ID token, enforces recent `auth_time`, rate-limits destructive attempts, requires an explicit `DELETE` confirmation, recursively deletes owned Firestore user/E2EE/MLS/chat/call/community-post roots, removes `privateAuthIdentities` mappings, deletes owned Storage prefixes, and deletes the Firebase Auth user only after cleanup succeeds.
- Added account-deletion backend tests proving stale sessions and missing confirmation fail before cleanup, cleanup failure prevents Auth deletion, owned Firestore/Storage/private-identity cleanup is attempted, and the route preserves unauthenticated `401` behavior. Backend unit coverage now passes 32 tests and backend syntax checks pass.
- Added the frontend account-deletion client boundary and Settings UI wiring. The user must enter the current password, Firebase reauthentication runs first, a fresh ID token is sent to `/api/account/delete`, and successful deletion clears local session state before returning to login.
- Updated auth capabilities so sensitive-action reauthentication and account deletion are advertised only now that a real password challenge plus backend cleanup route exist.
- Added frontend account-deletion/capability tests and verified the production build. Focused frontend coverage passes 7/7 tests and `npm run build` compiles successfully.
- Added MongoDB account-deletion retention cleanup. AI feedback, community presence, and install records are deleted; community signs are archived/private with training consent withdrawn; moderation reports are retained for audit but reporter UID becomes a one-way deleted-user reference and free-text reason is scrubbed.
- Account deletion now fails closed if Mongo cleanup fails before Storage/Auth deletion. Backend tests cover the Mongo policy and prove Auth deletion does not happen after Mongo cleanup failure.
- Added `Backend (Node.js)/scripts/validateAccountDeletion.js`, a dry-run-first account-deletion validation harness. Apply mode requires `SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION=true`, refuses non-synthetic UIDs, seeds one `signova-delete-validation-*` Firebase Auth/Firestore/Storage/Mongo account, runs the real deletion cleanup path, and verifies Auth, Firestore, Storage, and MongoDB cleanup/anonymization. The dry-run command is wired into the root `npm run check` and GitHub CI backend verification.
- Documented the guarded dry-run/apply commands in `docs/operations/PRODUCTION_RUNBOOK.md`.
- Backend coverage now passes 40 tests and syntax checks include the validator. `npm run validate:account-deletion --prefix "Backend (Node.js)"` passes in dry-run mode, and root operations tests pass 3/3.
- Remaining account-deletion scope: run the validator with `--apply` against configured local emulators or staging credentials and record the evidence before marking account deletion production-complete.

- Fixed the core conversation-ownership defect: messages now carry a `contactId`, each chat renders only its own records, and clear/delete affects only the selected conversation. Legacy unscoped messages migrate conservatively to the Signova AI conversation instead of appearing under every contact.
- Added `features/chat/firestoreChatService.js` with deterministic opaque direct-chat IDs, verified-member room creation, ordered realtime subscriptions, bounded text validation, optimistic message IDs, and atomic message-plus-preview writes. Verified Firebase contacts use the realtime transport; unlinked/AI contacts remain truthfully local instead of showing fabricated delivered/read state.
- Added duplicate-safe realtime reconciliation. A delayed Firestore acknowledgement replaces either a pending or timed-out optimistic record with the authoritative message rather than rendering the same client message twice.
- Removed `signovaDb` anonymous authentication. Database startup now waits in a UID-isolated local session until the app's verified Firebase Auth flow owns the identity, eliminating a bootstrap race that could replace an email-verified user with an anonymous unverified account.
- Fixed Firestore direct-room first-create transactions. Signed-in users may probe a non-existent deterministic chat document, while existing rooms and list/query results remain member-only; unauthenticated probes and non-member reads fail. Firebase rules pass 15/15.
- Added a real two-browser emulator journey proving verified user A creates/sends an atomic Firestore text message and verified user B receives it through the live snapshot; the stored sender UID is also verified through Firebase Admin. The focused desktop E2E passes 1/1 in 24.3 seconds.
- Added conversation, transport, auth-race, and reconciliation regression coverage. The complete frontend suite passes 193 tests across 55 suites and the optimized production build compiles successfully. `App.js` is 10,417 lines; maintainability remains 85% because chat subscription/composer orchestration and most route UI still live in the root component.
- Remaining chat scope is explicit: direct attachments, hard-delete, presence, group chat, legacy aggregate conflict resolution, and MLS-backed E2EE are not claimed complete.

- Added the versioned `services/userWorkspaceOutbox.js` write-ahead boundary. It validates collection/document/token segments, isolates queues by UID, compacts repeated same-document operations to the newest local intent, bounds storage to 500 operations / approximately 5 MB, rejects malformed envelopes, and acknowledges by immutable token so a stale completion cannot erase a newer replacement.
- Integrated queued upsert/delete semantics into `signovaDb.js`. Authenticated offline and mid-write failures retain cache plus outbox state; Firestore writes have a five-second bound; reconnect flushes serially and stops at the first failure; successful writes acknowledge exactly their operation; same-device delete/save ordering is deterministic.
- Fixed authenticated offline ownership: an existing Firebase user now keeps their real UID when the browser is offline instead of falling back to the shared local-owner identity. Unscoped legacy caches remain unavailable to that authenticated offline session.
- Added session-generation and current-auth checks so logout/account switching invalidates stale startup/writes, cannot flush another user's outbox, and cannot hydrate a completed read from the previous generation. Cloud startup failures use a ten-second retry backoff instead of blocking every local state update.
- Added a browser `online` recovery hook that attempts queued sync and reports connected, remaining-work, local fallback, or retry-failure status without discarding saved changes.
- Added nine outbox and database integration tests covering owner isolation, repeated-write/delete compaction, stale acknowledgements, malformed/quota failure, queue bounds, offline-to-online replay, failed-write retention, cross-account non-flush, authenticated legacy-cache denial, and queued deletion. Full frontend coverage passes 183 tests across 53 suites and the optimized production build compiles successfully without warnings. `App.js` is 10,302 lines; maintainability remains 85% while the root retains reconnect/status orchestration.
- Multi-device conflicts on the same legacy aggregate document are explicitly not called complete: the current queue guarantees same-device order, while revision-aware reconciliation or per-message Firestore records remains required.

- Replaced the browser-global database fallback with the tested `services/userWorkspaceCache.js` boundary. Cache keys now include the active Firebase/local owner UID, cloud reads refresh only that UID's cache, and save/delete operations cannot cross workspace boundaries.
- Added a fail-closed legacy migration: old unscoped `signova-public-db:*` collections are never exposed to authenticated Firebase sessions and migrate only into an explicit local workspace. Settings no longer initialize from the browser-global `signova-settings-v1` record for authenticated accounts.
- Fixed a second cross-account isolation defect in React state. Account startup/logout now clears messages, attachment URLs, contacts, local chat-lock flags, calls, and prior preferences; hydration always applies empty collections instead of retaining a previous user's state when the next account has no records.
- Added versioned Firebase-owned preference persistence at `users/{uid}/userPreferences/settings`. Privacy consent is resolved before chat restoration; identity fields remain on the root Firebase profile, while sanitized UI/device/privacy and non-identity profile preferences sync through the private user subcollection. The legacy local settings record migrates only for a local workspace.
- Replaced base64-only profile-photo previews with the tested durable profile workflow. JPEG/PNG/WebP signatures and the 10 MB limit are validated, a versioned owner path uploads to Firebase Storage, Firestore atomically selects the new URL/path, failed metadata commits clean up the new object, and successful replacements best-effort delete the previous owned object.
- Hardened Firestore profile rules to allow only bounded Firebase Storage URLs and owner-matching `users/{uid}/profile/*` paths. Emulator rules coverage now rejects cross-owner profile metadata and passes 14/14 tests; Java 25 still emits its known shutdown-only rules-runtime exception after the successful run.
- Removed the fake destructive “Delete account” action, which only reset local UI state. Account deletion is now a truthful disabled capability until recent reauthentication and complete Firebase/Storage/identity cleanup exist; the existing export action is accurately labeled as a current-local-data export.
- Added ten workspace/settings/database isolation tests and four durable profile-photo lifecycle tests. Full frontend coverage passes 174 tests across 51 suites and the optimized production build compiles successfully without warnings. `App.js` is 10,287 lines; maintainability remains 85% because startup/profile orchestration is still inside the root component despite the new tested service boundaries.

- Added the tested `features/settings/privacyPolicy.js` enforcement boundary for live camera processing, persisted chat history, outbound QR profile sharing, and unavailable privacy capabilities.
- Fixed a real retention defect: disabling “Save chat history” now prevents message restore, removes the persisted `chatState/messages` record from the active local/Firestore workspace, and stops subsequent message writes while keeping the current in-memory session usable.
- Camera-processing consent is now enforced before `getUserMedia`; turning it off stops an active camera/MediaPipe loop. The UI now states the current release does not save live camera video instead of exposing a nonfunctional “Save video data” promise.
- QR sharing now fails closed: disabling it removes the generated QR, closes its preview, disables copy/share/download, and guards the corresponding handlers. Incoming QR scanning remains available because it does not publish the user's profile.
- Fixed the misleading history-clear action: it now clears in-memory translation/chat/call state, releases attachment preview URLs, and deletes the persisted chat record plus every known call-history record from the active local/Firestore workspace. Partial deletion failures are reported truthfully.
- Corrected unsupported or misleading privacy controls: anonymous/private Community identity and username hiding are explicitly unavailable; correction feedback is described as pseudonymous model-review data; presence, last-seen, and receipt switches are labeled as local conversation-display behavior rather than unimplemented remote privacy enforcement.
- Added five privacy capability/enforcement and deduplicated-cleanup contract tests. Full frontend coverage passes 160 tests across 48 suites and the optimized production build compiles successfully without warnings. `App.js` is 10,244 lines; maintainability rises to 85% through the shared privacy-policy boundary.

- Added the centralized `features/auth/authCapabilities.js` registry so recovery and account-security UI can distinguish implemented Firebase email verification/reset/session persistence from unavailable 2FA, global app lock, biometrics, login alerts, child-safety enforcement, sensitive-action reauthentication, preview redaction, automatic locking, and server session management.
- Corrected recovery to its real contract: it now requests an account email, exposes only email reset as available, and marks Voice/PIN recovery unavailable instead of advertising unsupported flows.
- Converted non-enforced Security settings from mutable fake preferences into truthful disabled controls with concise limitations. Removed the unsupported “DPDP-ready” compliance claim; notice acknowledgement is now described only as a stored preference, not proof of legal compliance.
- Fixed related security wording/data defects: the unprotected welcome message is no longer flagged encrypted, AI/contact cards no longer call ordinary chat/contact exchange secure, pending message state says “Sending,” disabled QR sharing says “off,” and unavailable student verification no longer implies connected secure storage.
- Updated default settings so unsupported advanced security flags start false, while Firebase local session persistence is shown as implemented but not independently configurable.
- Added two capability-registry tests and production-build browser assertions for email-only recovery, unavailable recovery methods, disabled 2FA/global-lock controls, responsive layout, focus/touch sizing, and overflow. Focused auth/settings E2E passes 4/4.
- Frontend coverage passes 155 tests across 47 suites; both E2E and normal optimized production builds compile successfully. `App.js` remains 10,202 lines, and maintainability rises to 84% through the shared capability boundary.

- Consolidated duplicate live-translation/chat/library/learning browser speech implementations into the dependency-injected `services/speechService.js` accessibility boundary.
- Voice output now maps English, Hindi, Hinglish, ISL Gloss, and explicit BCP-47 locales consistently; prefers an exact locale voice before a primary-language fallback; cancels only active speech; clamps rate/pitch; bounds input to 2,000 characters; and returns safely when synthesis, utterance construction, voice lookup, or playback is unavailable/blocked.
- Fixed a preference bug where chat clicks and translated messages could speak while output type was text-only. Both paths now honor the shared `text` mode before invoking speech.
- Replaced the misleading clipboard status “Message copied securely” with the truthful “Message copied”; copying text does not establish a security property.
- Added four locale, voice-selection, cancellation, bounds, control-clamping, unavailable-API, and throwing-browser tests. Frontend coverage passes 153 tests across 46 suites and the optimized production build compiles successfully.
- `App.js` falls from 10,231 to 10,202 lines; maintainability rises to 83%.

- Extracted the MediaPipe camera cadence loop from `App.js` into the dependency-injected `features/camera/cameraFrameLoop.js` scheduler.
- The scheduler owns its timer, clamps dynamic processing to 1–120 FPS, applies live frame-skipping/modulo configuration, ignores missing/unready video, prevents overlapping frame work, isolates processing failures, compensates for processing elapsed time, and stops without rescheduling when the stream becomes inactive.
- Camera restart, startup failure, and normal stop now terminate the scheduler before closing streams/Hands; a new scheduler receives only live stream/video/config callbacks plus the existing RTMW snapshot and MediaPipe processing callback.
- Added four cadence, dynamic configuration, frame-skip, ready-state, failure-continuation, timer ownership, and inactive-stream tests.
- Frontend coverage passes 149 tests across 45 suites and the optimized production build compiles successfully. `App.js` falls from 10,247 to 10,231 lines; maintainability rises to 82%.

- Extracted MediaPipe CDN versioning, script injection, readiness verification, and retry state from `App.js` into the dependency-injected `features/camera/mediaPipeLoader.js` service.
- The loader now allowlists HTTPS jsDelivr URLs, deduplicates concurrent requests, recognizes already-loaded scripts, removes failed/stalled elements, permits clean retry, applies anonymous/no-referrer loading, and fails stalled camera dependency loading after a bounded 20 seconds instead of waiting indefinitely.
- Camera startup fails closed when the browser/document runtime or `window.Hands` constructor is missing; the pinned Hands asset base URL remains the single source used by both script loading and `locateFile` resolution.
- Added four loader tests covering concurrency, idempotence, failed-script replacement, clean retry, untrusted URLs, missing runtime, bounded timeout, timer cleanup, and DOM cleanup.
- Frontend coverage passes 145 tests across 44 suites and the optimized production build compiles successfully. `App.js` falls from 10,298 to 10,247 lines; maintainability rises to 80%.

- Added a global WCAG-aware service recovery banner for backend/AI health failures instead of hiding outage state only inside Settings → About. It uses an assertive alert, actionable error detail, keyboard-visible retry, dark design tokens, safe-area positioning, responsive layout, and reduced-motion behavior.
- Retry now triggers an immediate health check without reloading the app, moves the connection into a truthful checking state, preserves non-service camera permission errors, and clears service/API recovery errors only after a successful backend/AI response.
- Added a deterministic production-build Playwright journey that forces `/api/health` to return 503, verifies the outage announcement/retry action/no horizontal overflow, switches the same page to a healthy backend response, retries, and confirms the About health metric becomes Connected.
- The first cross-viewport run passed desktop and exposed a real mobile accessibility defect: the retry target rendered at 42px. The component now enforces a 44px mobile minimum, and the focused mobile rerun passes; the focused desktop journey also passes.
- The E2E and normal production builds compile successfully, and the complete frontend unit/component regression passes 141 tests across 43 suites. A subsequent complete Playwright orchestration was terminated after the installed Java 25/Firebase-emulator process remained output-less beyond the expected duration; this is not recorded as a passing full-suite run. The prior authoritative full regression remains 12 passed with four intentional mobile duplicates skipped, plus the two independently passing new outage journeys.
- Automated testing depth rises to 99%; credentialed physical cross-network/TURN-only staging remains the final browser validation gate.

### 2026-07-12

- Added atomic bulk migration for persisted legacy chat-lock maps. Any plaintext password available during startup is converted to the versioned salted PBKDF2 credential before the flags enter normal live state, while unrelated chat flags and lock state remain unchanged.
- The migration builds a complete replacement before returning and never mutates its input. If secure derivation fails, the original in-memory map remains available for recovery and no partial migration is emitted.
- Added defense in depth to the chat-flags persistence effect: it independently migrates/sanitizes flags and refuses to write legacy plaintext back to local storage or Firestore when Web Crypto is unavailable. Completed credentials also remove stale plaintext/SHA fields.
- Added two atomicity, non-mutation, verifier-continuity, and unavailable-Web-Crypto tests. Frontend coverage passes 141 tests across 43 suites and the optimized production build compiles without warnings.
- `App.js` is 10,268 lines after explicit asynchronous load/save migration handling; maintainability rises to 78% because credential-map migration and sanitization are centralized in the tested chat-lock boundary.

- Replaced the inline fast SHA-256/local integer-fallback chat-lock helper with the versioned `features/chat/localChatLock.js` credential boundary.
- New local locks use a fresh 128-bit random salt, 310,000-iteration PBKDF2-SHA-256, a 256-bit verifier, bounded 6–128-character secrets, strict credential shape/algorithm/iteration checks, and constant-work verifier comparison; lock creation and verification fail closed when Web Crypto is unavailable.
- Existing plaintext and legacy salted-SHA records remain unlockable only as a migration path; after successful verification they are removed and replaced by the versioned PBKDF2 credential. Invalid, malformed, downgraded, unsupported, or credential-less locked records cannot unlock.
- Corrected another capability mismatch: Face/Fingerprint choices were selectable despite having no biometric verification implementation. They now render truthfully disabled, password/PIN is the only available method, and the dialog explicitly states that local chat lock hides UI but does not encrypt stored or transmitted messages.
- Added four credential, salt, policy, downgrade, malformed-input, unavailable-Web-Crypto, wrong-secret, and legacy-migration tests. Frontend coverage passes 139 tests across 43 suites and the optimized production build compiles without warnings.
- `App.js` is 10,246 lines after explicit fail-closed migration/error handling; maintainability rises to 77% because secret derivation, validation, and compatibility logic now live behind a tested feature boundary.

- Extracted static navigation, sign fallback, learning mission, avatar, form-default, performance-profile, reaction, sticker, and composer data from `App.js` into the side-effect-free `features/app/appData.js` module.
- Added contract coverage for unique identifiers/palettes, complete learning/sign records, bounded performance profiles, contact privacy defaults, and form capability defaults.
- Fixed a security-truth bug found during the extraction: the disabled “Group E2EE unavailable” control previously left a hidden `encryptedRequired: true` default that new group records persisted. Defaults and creation now fail closed with `encryptedRequired: false` until audited MLS activation is real.
- Frontend coverage passes 135 tests across 42 suites and the optimized production build compiles successfully.
- `App.js` falls from 10,401 to 10,232 lines (169 static-data lines removed); maintainability rises to 76%.

- Extracted eleven self-contained presentation concerns from `App.js` into `components/AppPresentation.jsx`: contact avatar/privacy metadata, community actions, compact call/header icons, call-history labeling, startup skeleton, opening motion, and feed-video lifecycle behavior.
- Kept feature state and API handlers in their owning domains while making the presentation boundary independently testable; existing CSS contracts, contact visibility rules, call aliases, loading announcements, video viewport pause, and single-video playback behavior remain intact.
- Fixed a real SVG correctness issue found during production verification: repeated community action icons now use collision-free React-generated gradient IDs instead of duplicate deterministic DOM IDs.
- Added five privacy/accessibility/lifecycle/mapping/collision tests. Frontend coverage passes 131 tests across 41 suites and the optimized production build compiles without warnings.
- `App.js` falls from 10,618 to 10,401 lines (217 additional presentation lines removed); maintainability rises to 74%.

- Extracted the complete attachment/action and navigation-rail 3D SVG icon families from `App.js` into the reusable `components/SignovaIcons.jsx` design-system boundary.
- Preserved all existing icon variants, CSS class contracts, gradient/shadow rendering, fallback glyphs, and opening/call/chat/library/progress/settings usage without changing navigation or feature behavior.
- Icons remain decorative so accessible parent button labels are not duplicated, and React-generated SVG definition IDs remain collision-free across repeated instances.
- Added four focused render/accessibility/fallback/ID-collision tests. Frontend coverage passes 126 tests across 40 suites and the optimized production build compiles successfully.
- `App.js` falls from 10,890 to 10,618 lines (272 presentation-only lines removed); maintainability rises to 71%.

- Hardened the extracted Settings model into a versioned persistence boundary instead of letting arbitrary localStorage JSON enter live application state.
- Added automatic migration from the legacy unversioned payload to schema version 2, exact top-level and nested-key allowlisting, primitive type checks, supported enum validation, finite/range-bounded numeric values, and bounded strings while retaining the resized local profile-photo workflow.
- Unsupported future envelopes, corrupt JSON, invalid value types, unknown fields, oversized text, and storage quota/private-mode write failures now fail safely without breaking the active settings session or erasing valid legacy preferences.
- Migrated `App.js` to the shared fail-safe serializer; no route, setting control, theme, responsive layout, or Firebase/MongoDB ownership behavior changed.
- Added three persistence/security regression tests. Frontend coverage passes 122 tests across 39 suites, the production build compiles successfully, and `App.js` is 10,890 lines; maintainability rises to 68%.

- Extracted custom chat/group Web Crypto helpers from `App.js` into the explicitly scoped `features/chat/localSessionProtection.js`; it remains a local preview boundary and is not MLS or E2EE.
- Local AES-256-GCM keys are now non-exportable, envelopes are versioned and size-bounded, and chat/group identity is authenticated as AAD so payloads cannot be moved between local contexts.
- Malformed base64, invalid IV/ciphertext sizes, empty/oversized text, context substitution, and ciphertext tampering fail closed.
- Replaced every “Delivered securely”/“Seen with Signova glow” activity claim with truthful “Delivered locally”/“Seen locally”; message detail continues to state temporary local-session protection is not E2EE.
- Added three crypto-boundary tests. Frontend coverage passes 119 tests across 39 suites and the production build; `App.js` falls from 10,927 to 10,894 lines and maintainability rises to 67%.

- Added a dedicated lazy boundary for the extracted multi-type chat attachment renderer, so community/dashboard startup no longer eagerly downloads attachment-card audio/poll/contact/meet logic.
- The lazy boundary provides an accessible live `Loading attachment preview` fallback and resolves transparently with the existing injected icon/callback behavior.
- Added a fallback-to-resolved-chunk regression test. Frontend coverage passes 116 tests across 38 suites and the production build succeeds.
- The gzip main bundle falls from 360.77 kB to 359.20 kB (1.57 kB removed from initial load), with the 2.15 kB attachment renderer emitted as an on-demand chunk; maintainability rises to 65%.

- Extracted the complete standalone chat attachment renderer from `App.js` into `features/chat/SpecialMessageCard.jsx`, covering document, image, audio, camera clip, meet, poll, contact, and gesture sticker variants.
- Preserved the existing Signova icon system through an injected icon component while making the renderer independently reusable/testable and keeping message mutation callbacks owned by the parent feature.
- Added focused rendering/action tests for truthful expired-preview disabled states, absence of false security wording, poll totals/voting, outgoing contact edit, and incoming meet save routing.
- Frontend coverage passes 115 tests across 37 suites and the production build. `App.js` falls from 11,147 to 10,927 lines; maintainability rises to 64%.

- Added a dependency-light active-model release checker distinct from candidate promotion: every production task must prove frozen class/spec checksums, approved vocabulary coverage, checksummed active checkpoint and signer-disjoint dataset manifest, diversity coverage, metrics, unknown recall/false-accept policy, and validation sample minimums.
- The checker distinguishes structurally unsafe configuration (disabled mandatory policy or frozen class-map drift) from safe-but-incomplete evidence, emits a deterministic per-task JSON report, supports `--fail-on-unsafe` for CI/staging, and `--require-ready` for production.
- CI now regenerates candidate promotion plus active release reports, fails on unsafe drift, and retains both as 90-day artifacts. Deployment always uploads its gate evidence; staging can qualify external assets while production fails closed unless every active task is ready.
- Added local `ai:check-release` and `ai:require-release` commands and wired the safe audit into root `npm run check`; release-evidence documentation now requires the AI reports.
- Added three release-checker tests. The AI suite passes 31 tests, both workflow files parse as valid YAML, local safe audit passes, and strict production readiness correctly blocks all six incomplete active tasks.
- AI model completion and CI/CD operations each rise to 85%; production deployment is intentionally blocked until expert specs, private signer-disjoint manifests, active checksums, and rejection metrics are supplied.

- Added a strict expert vocabulary specification validator covering exact class-map label parity, task/class checksum binding, controlled ASL/ISL/type/handedness fields, complete phonological/movement/start/end/frame evidence, known-confusion constraints, disambiguation notes, controlled sources, and per-label approval.
- Specifications reject missing/duplicate/extra labels, pending review, empty or oversized definitions, invalid frame ranges, self/unknown confusions, unknown source references, timezone-free review dates, and undeclared fields that could contain reviewer PII or ungoverned metadata.
- Added a second frozen specification checksum to the registry contract and made `require_vocabulary_spec` a mandatory promotion policy; every current candidate now truthfully reports `vocabulary_spec_missing` in addition to its existing artifact/dataset/metric blockers.
- Documented the expert authoring/versioning workflow in `ai-service/VOCABULARY_SPEC_STANDARD.md`; no generated or engineer-guessed handshape/movement descriptions were introduced for the 10–500-label maps.
- Added six vocabulary/registry tests. The AI suite passes 28 tests and the full registry audit has zero qualified candidates, as expected until real expert specs, private datasets, checksummed artifacts, and benchmark evidence are supplied.
- AI model completion rises to 83%; qualified reviewer work and private training/deployment assets remain external evidence tasks.

- Added a session-owned attachment object-URL registry with idempotent per-message, batch, and teardown cleanup.
- Chat file and recorded voice-note blob URLs are now revoked on unsend, chat clear, account preview reset, logout, persisted-state replacement, and app unmount; URLs cannot be double-revoked.
- Session-only `blob:` URLs are stripped before chat persistence and marked as expired local previews, preventing invalid private browser URLs from being written to Firestore/local storage or restored after reload.
- Restored document/image cards now expose truthful disabled unavailable actions, and removed the misleading “secure attachment” label from local unencrypted previews.
- Added three lifecycle/persistence tests. Frontend coverage passes 112 tests across 36 suites and the production build compiles successfully; maintainability rises to 61%.

- Extracted chat attachment validation, classification, size formatting, and message payload presentation from `App.js` into `features/chat/attachmentModel.js`.
- Enforced the same 25 MiB ceiling as encrypted attachments and an explicit image/audio/document allowlist before creating blob URLs or mutating chat/drive state.
- Empty, oversized, executable, disguised MIME/extension, unsupported, overlong, and control-character filenames now fail with visible feedback; valid image quality/document mode, audio, and office/PDF/text previews retain existing UI behavior.
- Multi-file selection now adds and sends only accepted files and reports the rejected count plus first actionable reason.
- Added four focused attachment tests. Frontend coverage passes 109 tests across 35 suites and the production build compiles without warnings; `App.js` is 11,123 lines and maintainability rises to 60%.

- Added an IndexedDB MLS state persistence boundary that encrypts opaque group state with a non-exportable per-device AES-256-GCM key and binds group, device, epoch, commit/parent hashes, and state checksum as authenticated metadata.
- State commits must begin at epoch 1 and advance exactly one epoch with the previous commit hash as parent; rollback, skipped epochs, stale commits, and transcript forks are rejected atomically.
- Concurrent competing commits serialize through one IndexedDB transaction so only one branch can win; encrypted state/metadata tampering fails closed with a recovery-or-rejoin requirement.
- Device wipe removes every local group state plus its non-exportable storage key while leaving other devices intact.
- Added five reload/concurrency/rollback/tamper/wipe tests. Frontend coverage passes 105 tests across 34 suites and the production build compiles successfully.
- True encryption rises to 92%, but `durableEpochState` remains an unproven activation gate until qualified OpenMLS state survives real Welcome/Commit/rejoin flows; no E2EE claim is enabled.

- Added encrypted attachment upload-to-message commit orchestration: ciphertext uploads first, strict Firestore metadata publishes second, and publication failure automatically deletes the uploaded object.
- Commit failures preserve the original publication cause and distinguish completed rollback from cleanup-pending state; cancellation propagates to the active resumable upload and prevents message publication.
- Deletion now removes the authoritative message before its object, never deletes ciphertext when message authorization fails, and reports retryable object cleanup state without falsely claiming complete deletion.
- Added a dry-run-first encrypted attachment orphan auditor that reconciles Storage with collection-group message references, enforces a minimum 24-hour grace window (72 hours by default), requires an explicit destructive-action environment gate, and logs only hashed private object references.
- Added seven lifecycle tests and two auditor tests. Backend syntax checks and 25 tests pass; frontend coverage passes 100 tests across 33 suites, Firebase/Storage rules pass 13 assertions, and the production build compiles successfully.
- True encryption rises to 90%; MLS runtime, epoch updates, membership rotation, multi-device delivery, recovery, and external security review still block product E2EE activation.

### 2026-07-11

- Added durable encrypted-attachment transport using resumable Firebase Storage ciphertext uploads, progress/cancel, authenticated `getBytes` downloads, integrity-checked decryption, and sender deletion without generating or persisting public download-token URLs.
- Added strict `encryptedChatAttachments/{chatId}/{senderUid}/{attachmentId}.bin` path validation and Storage rules that consult authoritative Firestore chat membership, require verified participants, permit only sender creation/deletion, reject updates, require encryption metadata, and cap AES-GCM ciphertext size.
- Download/delete now fail before Storage access when the object path disagrees with authenticated envelope metadata; downloaded ciphertext length, AES-GCM AAD/tag, plaintext length, and SHA-256 are independently verified.
- Added five transport tests covering real Web Crypto round-trip, ciphertext-only persistence, progress, cancel-before-write, path substitution, deletion, and identifier traversal rejection.
- Added a ciphertext-only Firestore `encrypted_attachment` message schema: it rejects text/media-path fallback, binds sender/chat/object path, validates bounded IV/wrapped-key/hash/size metadata, and prevents plaintext from being added by later edits.
- Firebase/Storage rules pass 13 assertions including ciphertext-message fallback/path rejection, member read, outsider denial, cross-sender write/delete denial, and owner cleanup; frontend coverage passes 93 tests across 32 suites and the production build.
- True encryption rises to 88%, but the feature remains correctly disabled until the MLS runtime, epoch/rotation, fan-out, ciphertext-only message schema, recovery, and external review gates pass.

- Added a real Firebase emulator authentication journey covering account creation, persisted Firestore profile ownership, verification-email action code, verification gate, verified login, authenticated workspace identity, logout, recovery request, and password-reset action code.
- Fixed a real signup contract bug found by the browser journey: phone is documented as optional but blank input was rejected; signup now validates a phone only when supplied and retains strict E.164 validation otherwise.
- Added an explicit local E2E auth-flow mode that enables the normal Firebase session watcher while keeping the visual auth-shell mode deterministic and production behavior unchanged.
- Fixed shared Firebase Admin test initialization so auth, Firestore, and Storage suites can run serially in one process without losing the configured Storage bucket.
- Full Playwright regression now passes 12 journeys with four intentional duplicate mobile skips; frontend coverage passes 88 tests across 31 suites and both E2E and production builds compile successfully.
- Automated testing depth rises to 98%; physical device/network/TURN staging and live MongoDB environment integration remain outside the local harness.

- Added verified-user-only `POST /api/observability/client-errors` ingestion with the shared request correlation ID and bounded per-user/IP rate limiting.
- Client crash records contain only source, error class, immutable release, path without query/fragment, dedupe fingerprint, sanitized source-file frames, and a one-way anonymous user reference; raw messages, tokens, URLs, user input, component props, and media are excluded.
- Added one-minute client deduplication, five-second non-blocking delivery, global runtime/unhandled-rejection capture, and a React error boundary with an accessible dark recovery screen.
- Documented release tagging, centralized-log event contract, warning/critical/release-regression thresholds, staging paging tests, and owner evidence requirements in the production runbook.
- Backend syntax checks and all 23 backend tests pass; frontend coverage passes 87 tests across 31 suites and the production build compiles successfully.
- CI/CD and operations rises to 82%; production log-sink credentials, dashboards, paging routes, and a live alert exercise remain external activation work.

- Extracted `RTCPeerConnection` construction, local-track registration, caller data-channel creation, local/remote ICE routing, remote stream/channel delivery, and connection-state forwarding into `features/calls/peerConnectionSession.js`.
- The peer session requires an explicitly injected browser peer constructor and signaling callbacks, keeping Firebase room identity and UI/reconnect policy outside the transport boundary.
- Added four browser-independent peer-session tests covering configuration/tracks, both candidate directions, stream/channel/state events, unsubscribe ownership, async failure routing, and incomplete dependency rejection.
- Re-ran the authoritative authenticated two-user WebRTC browser journey after migration; successful negotiation/media/end and camera-denial fail-closed cases both pass.
- Frontend coverage now passes 83 tests across 29 suites; E2E and normal production builds compile successfully, and maintainability rises to 59%.

- Extracted live WebRTC track normalization, local media-state derivation, and caption data-channel payload construction into `features/calls/callMediaProtocol.js` with four focused tests.
- Media state now comes from enabled live tracks rather than potentially stale React flags, while UI flags are used only before a stream exists.
- Made video-call startup await camera acquisition and fail closed with a truthful call status when permission is denied instead of leaving the UI in a false ringing state.
- Added a browser denial journey that injects `NotAllowedError`, verifies the visible recovery state, and proves no Firestore call room is created.
- Post-race-fix full Playwright regression passes 10 tests with two intentional duplicate mobile skips; the expanded call spec passes both successful negotiation and camera-denial cases.
- Frontend coverage now passes 79 tests across 28 suites; E2E and normal production builds compile successfully.
- Real video calling rises to 87%, testing depth to 97%, and `App.js` maintainability to 57%.

- Added an authenticated two-context WebRTC browser journey with separate verified Firebase users, real offer/answer signaling, ICE candidates from both owners, remote video-track assertions in both directions, and remote hang-up teardown.
- Fixed Firestore call-query authorization by making caller/callee participation explicit in rules; the rules suite now passes 11 assertions including the incoming-call query shape.
- Fixed three negotiation/lifecycle races: stale media-state data-channel values, duplicate pending answer application, and terminal snapshots being incorrectly treated as reconnect offers.
- Terminal call state now performs idempotent peer/media/subscription/UI cleanup on the remote participant, and actual received track kinds are exposed only in guarded local E2E builds.
- Firebase-emulator browser suites now use one Playwright worker because authenticated media tests intentionally share one emulator project and must not reset identities concurrently.
- The focused two-party call journey passes twice consecutively after the race fix; frontend tests pass 75/75 across 27 suites and both E2E and normal production builds compile successfully.
- Real video calling rises to 86% and testing depth to 96%; a credentialed physical cross-device, cross-network, TURN-only staging run is still required before calling the phase production-complete.

- Added localhost-only Firebase Auth, Firestore, and Storage emulator wiring to the production-build Playwright harness; analytics/installations are disabled in emulator builds so fake credentials never contact production Google services.
- Added a verified emulator identity and an actual UI journey using the repository MP4 fixture: select, inspect, confirm, resumably upload, publish, render, and play in the community feed.
- The browser test reads authoritative Firestore state to capture the durable Storage path, then uses the creator menu to delete and independently verifies both the Firestore document and Storage object are absent.
- Extended Playwright web-server orchestration to Auth/Firestore/Storage emulators; the full suite passes 9 tests with one intentional mobile duplicate skip.
- Durable community media is now complete and verified at the browser boundary; testing depth rises to 92%.

- Extracted the full persisted settings schema/defaults, safe nested merge, storage loading, dynamic category metadata, and search filtering into `features/settings/settingsModel.js`.
- Persisted settings now ignore removed/unknown top-level groups while preserving newly introduced nested defaults, reducing stale local-storage schema risk.
- Settings remains dark-first and consumes the same live camera/device state; route/UI behavior is unchanged.
- Added four settings model regression tests; `App.js` fell from 11,270 to 11,091 lines (330 lines removed across the latest maintainability passes).
- Frontend coverage now passes 75 tests across 27 suites and the production build.

- Extracted contact country metadata, username/phone validation, persisted contact normalization, and avatar initials from `App.js` into `features/contacts/contactModel.js`.
- Extracted sign-language inference, text normalization, book classification, usage, and learning-purpose copy into `features/learning/signPresentation.js`.
- Extracted metric/time formatting, radar geometry, and landmark coordinate conversion into `features/progress/progressPresentation.js`.
- Added focused regression suites for all three domains; `App.js` fell from 11,421 to 11,270 lines without changing UI routes or behavior.
- Frontend coverage now passes 71 tests across 26 suites and the production build.

- Added dataset coverage assessment for per-split signer counts, per-label training signer diversity, coarse approved diversity groups, and lighting/background/handedness/device capture coverage.
- Made complete capture metadata and production minimums mandatory model-promotion gates: five signers per split, three training signers per label, four diversity groups, and explicit environment/device category coverage.
- Added a controlled privacy-preserving taxonomy and rejected free-form diversity values, GPS/unknown capture fields, and unsupported capture categories before promotion.
- Updated the example manifest and added `ai-service/DATASET_COLLECTION_STANDARD.md`; the example is structurally valid but intentionally too small for promotion.
- Python AI coverage passes 22 tests; the example manifest validates and registry audit confirms no incomplete candidate is qualified.

- Hardened MLS KeyPackage claiming against authenticated pool-exhaustion: claimant and target must both belong to the referenced Firestore conversation before any package is consumed.
- Changed claiming from one arbitrary recipient package to one atomic package per active verified recipient device, with a 16-device safety bound.
- Claims now fail without any writes when even one active device lacks a valid unexpired package, preventing silent partial-device encryption coverage.
- All packages in a fan-out share an internal claim ID and conversation binding, while this reservation metadata is never returned to clients.
- Backend coverage now passes 18 tests including conversation authorization, multi-device fan-out, all-or-nothing shortage, and self-claim rejection; syntax checks pass.

- Added an owner-published MLS KeyPackage directory with strict protocol/ciphersuite, encoded-size, fingerprint, identity, and seven-day lifetime bounds.
- Denied all client KeyPackage reads, updates, claims, and deletes; only verified owners can create immutable available packages, while Firebase Admin performs authenticated claims.
- Added an authenticated, rate-limited backend claim endpoint using a Firestore transaction to select one valid unexpired package and atomically mark it claimed once.
- Added the required collection-group composite index and documented Firebase as the authoritative owner of KeyPackage claim state; MongoDB remains uninvolved.
- Added frontend record/path validation, backend claim/expiry/self-claim tests, and Firebase authorization/reuse tests.
- Backend passes 17 tests and syntax checks; frontend passes 64 tests across 23 suites and production build; Firebase/Storage rules pass 11 assertions.

- Selected MLS RFC 9420 with security-patched OpenMLS as Signova's unified 1:1/group E2EE implementation candidate and documented the decision in ADR 0004.
- Rejected custom Web Crypto envelopes as a production protocol and rejected official libsignal as the common browser dependency because external use is unsupported, browser runtime support is not provided, bridge APIs may change, and licensing needs separate review.
- Recorded OpenMLS's 2026 independent audit and required patched 0.8.1+ compatible releases, while treating its built-but-not-tested WASM target as a mandatory qualification risk.
- Added a fail-closed E2EE readiness evaluator with ten machine-verifiable engineering/review gates plus verified-device coverage; the application continues to report E2EE unavailable.
- Frontend coverage now passes 61 tests across 22 suites and the production build.

- Added a fail-fast deployment configuration validator covering required Firebase identifiers, HTTPS/non-local public endpoints, embedded credentials, distinct frontend/backend origins, and supported environment names.
- Prevented production workflow dispatches from deploying non-`main` refs.
- Added three operations regression tests and wired them into CI.
- Added CycloneDX 1.5 production SBOM generation for the root, backend, and frontend dependency graphs with 90-day CI artifact retention.
- Corrected root npm package identity/version metadata so its SBOM is standards-valid; all three SBOM commands and `npm ci --dry-run` pass locally.
- Documented release evidence and operator gates in `docs/operations/RELEASE_EVIDENCE.md`.

- Added strict client ICE configuration validation for allowed STUN/TURN protocols, credential completeness, backend metadata consistency, and minimum credential lifetime.
- Added staging TURN-only mode through `REACT_APP_SIGNOVA_FORCE_RELAY=true`; peer connections use `iceTransportPolicy: relay` and fail closed when a relay is unavailable.
- Added a backend `npm run check:turn` production preflight requiring a strong Coturn shared secret plus UDP and TCP/TLS relay routes without printing credentials.
- Added malformed, expired, metadata-mismatch, incomplete-credential, relay-only, and TURN environment tests.
- Backend now passes 13 tests and syntax checks; frontend now passes 58 tests across 21 suites and the production build.

- Extracted community resumable upload, creator-scoped path construction, progress reporting, optional video-poster upload, and idempotent multi-object cleanup from `App.js` into `features/community/durableMediaService.js`.
- Reused the same cleanup primitive for Firestore publish rollback and creator post deletion, reducing duplicated Firebase Storage logic and orphan-object risk.
- Added failure-path coverage proving poster generation may fail without losing the durable video and cleanup tolerates already-missing objects.
- Frontend coverage now passes 52 tests across 20 suites and the production build.

- Added dependency-injected integration coverage for the authenticated Firebase-to-MongoDB community moderation boundary.
- Rejected reports for nonexistent authoritative Firestore posts before MongoDB is contacted.
- Fixed duplicate-report responses to return the stable moderation ID stored by MongoDB rather than a newly generated unused ID.
- Proved authentication failures and missing posts cannot write moderation records; backend now passes 11 tests.
- Added a versioned, consent-aware private dataset manifest schema and validator with pseudonymous signer/sample IDs.
- Enforced unique samples/signers, SHA-256 metadata, safe relative paths, required consent references, train/validation/test presence, signer-disjoint splits, and train label coverage.
- Made valid dataset manifests with matching checksums mandatory for every model challenger; all existing incomplete challengers remain safely blocked.
- Python AI coverage now passes 19 tests, the example manifest validates, and the registry audit completes without promoting an unsafe candidate.
- Bound signed device bundles to protocol version, device ID, agreement key, and signing key, closing a device-identity substitution weakness.
- Added an authenticated Firebase device public-key directory service with owner-only registration, verified-user lookup, signature revalidation, and irreversible revocation history.
- Added strict Firestore device-directory allowlists and authorization tests; 10/10 rules assertions pass.
- Frontend crypto/directory coverage now passes 23 tests across 11 suites and the production build.
- Added positive per-device message sequences to authenticated envelope metadata and a bounded replay guard that safely accepts limited out-of-order delivery once.
- Added encrypted attachment envelopes with random AES-256-GCM content keys, conversation-key wrapping, AAD-bound metadata, SHA-256/size verification, typed-array/Blob compatibility, and a 25 MiB memory-safety limit.
- Fixed a cross-realm typed-array compatibility issue caught by jsdom/Web Crypto tests and bounded replay-ID retention to prevent long-session memory growth.
- Frontend coverage now passes 29 tests across 13 suites and the production build.
- Added atomic IndexedDB sender-sequence allocation scoped per conversation/device; concurrent allocation, reload persistence, and counter isolation are tested.
- Added deterministic order-independent 60-digit safety numbers and QR verification payloads derived only after both signed device bundles validate.
- Rejected altered QR payloads, unexpected safety numbers, and substituted device identities before trust can be recorded.
- Frontend coverage now passes 34 tests across 15 suites and the production build.
- Added atomic durable receiver replay storage spanning reloads, concurrent duplicate delivery, conversation-wide message IDs, per-device sequence windows, and bounded pruning.
- Added fingerprint-bound verified-device trust persistence with verified, changed, invalid, and irrevocably revoked states.
- Required current signed-bundle revalidation on every trust lookup so malformed bundles cannot inherit stored trust.
- Frontend coverage now passes 40 tests across 17 suites and the production build.
- Extracted camera constraint construction, over-constrained fallback, optional microphone track merge, actual quality reporting, safe error mapping, and idempotent stream cleanup from `App.js`.
- Fixed a camera resource leak where tracks could remain active if video playback or post-acquisition startup failed.
- Added tests proving permission errors do not trigger unsafe fallback, microphone denial does not kill video, unsupported constraints degrade safely, and all tracks are cleaned up.
- Frontend coverage now passes 45 tests across 18 suites and the production build.
- Extracted authentication identity normalization, signup/login form validation, profile safety checks, password confirmation, and Firebase-safe error mapping from `App.js`.
- The main signup/login submit path now consumes one validated normalized result, preventing field-by-field normalization drift before Firebase calls.
- Added regressions for disposable email, reserved/abusive usernames, unsafe display names, mismatched passwords, login-only fields, and internal Firebase error redaction.
- Frontend coverage now passes 49 tests across 19 suites and the production build.
- Added a repository-native Playwright harness against the production build with desktop and mobile Chromium projects.
- Added real-browser signup→login→recovery navigation, JavaScript/runtime error monitoring, same-origin resource failure detection, and horizontal overflow assertions.
- Wired Playwright Chromium installation, browser execution, and retained failure traces/screenshots/video into CI.
- Verified all four desktop/mobile browser assertions locally in Edge/Chromium; auth recovery layouts render without horizontal page overflow.

### 2026-07-10

- Created the production implementation goal and phased plan.
- Created this living tracker.
- Confirmed that both Firebase and MongoDB remain intentional parts of the architecture.
- Recorded the live Firestore community-post ownership mismatch for correction.
- Recorded durable media upload/delete and UI scrollbar/library improvements as completed foundation work.
- Reconciled `DATA_ARCHITECTURE.md` and added ADRs for data ownership, calling, and encryption boundaries.
- Added `.github/workflows/ci.yml` pinned to Node 22, Python 3.11, and Java 21.
- Replaced one-shot community uploads with resumable Firebase Storage uploads.
- Added live percentage progress, cancel, failure state, and retry without reselecting the file.
- Re-ran frontend tests and production build successfully after the upload workflow change.
- Added a modular Firestore call-signaling service for rooms, offers, answers, ICE candidates, status, and listeners.
- Added participant-only call-room/ICE security rules and role enforcement tests.
- Added authenticated `/api/calls/ice-config` with expiring backend-generated Coturn REST credentials.
- Added backend tests proving TURN secrets are not returned and credentials expire.
- Added authenticated username-to-Firebase-UID contact resolution; local contact IDs are never treated as call identities.
- Added automatic private identity registration after verified login/profile updates.
- Replaced the local loopback call path with Firestore offer/answer/ICE negotiation between verified users.
- Added incoming call Accept/Decline UI, microphone-only voice calls, remote media/data-channel setup, and call cleanup.
- Added automatic caller ICE restart and receiver renegotiation after a disconnect.
- Added aggregate RTT, packet-loss, and bitrate sampling through `RTCPeerConnection.getStats()`.
- Verified 6 backend tests, 3 frontend tests, production build, and 9 Firebase rule assertions.
- Added a 30-second unanswered-call timeout, same-client duplicate-call guard, timer cleanup, and dry-run-first recursive expired-room cleanup script.
- Extracted WebRTC stats summarization from `App.js` into a pure tested call feature module.
- Frontend coverage now includes 5 tests across App, encryption notice, and call-quality behavior.
- Added byte-signature validation for JPEG, PNG, WebP, MP4, and WebM with MIME mismatch rejection and compatibility fallback.
- Added generated video poster uploads, Firestore poster references, feed poster rendering, and delete/failure cleanup.
- Added MongoDB-owned `communityPostModeration` cases keyed by authoritative Firestore post ID and reporter UID.
- Added authenticated moderation report actions that hide reported content after MongoDB records the case.
- Replaced obsolete MongoDB live-post indexes with moderation queue, unique reporter, and TTL indexes.
- Added dry-run-first `audit:media` script to find/delete old unreferenced Firebase Storage community objects.
- Verification now passes 7 frontend tests, 8 backend tests, 9 Firebase rule assertions, syntax checks, and production build.
- Froze all current production task class maps with tracked SHA-256 values.
- Added mandatory macro-F1, unknown recall/false-accept, signer-disjoint, checkpoint checksum, vocabulary, and sample-count promotion gates.
- Added startup checkpoint checksum enforcement for production deployments.
- Added dedicated `SIGNOVA_MODEL_CHANNEL=canary` loading, canary staging, and timestamped rollback commands.
- Added unknown/no-sign JSONL evaluator and registry gate tests; Python suite now passes 16 tests.
- Audited all registered challengers: none currently qualify, so no unsafe model was promoted.
- Added an explicit E2EE threat model and activation checklist; product capability remains disabled.
- Added tested per-device ECDH/ECDSA keys, signed public bundles, HKDF conversation derivation, and metadata-bound AES-256-GCM envelopes.
- Added non-exportable CryptoKey persistence/removal through IndexedDB.
- Corrected remaining call UI wording to WebRTC DTLS-SRTP transport protection instead of unproven E2EE.
- Extracted the frontend API client with tests for auth injection, timeout/status handling, non-JSON rejection, and configuration errors.
- Added frontend-generated correlation IDs, backend response propagation, AI forwarding/echo, and structured JSON request logs.
- Frontend suite now passes 12 tests across seven suites; backend suite passes 8 tests.
- Added manual GitHub Environment-gated staging/production deploy and production rollback workflows for Firebase and Vercel.
- Added retrying frontend/backend/AI post-deploy smoke checks and a bounded, dependency-free GET health load harness.
- Added plan-only-by-default MongoDB/Firestore backup tooling and production-target-resistant isolated restore tooling.
- Added the production environment, release, rollback, backup/restore, load-test, and incident runbook.
- Added an exact GitHub staging/production variables, secrets, reviewer, branch-protection, and least-privilege setup checklist.
- Extracted the community Firestore post schema, age formatting, durable-media normalization, and publish payload construction from `App.js`.
- Extracted shared username normalization into the authentication feature boundary and reused it in community payloads.
- Added deterministic community model and identity normalization regressions; frontend now passes 16 tests across nine suites and the production build.
- Added a shared forward-only call state machine used by signaling and UI terminal-state handling.
- Closed a Firestore authorization gap that allowed terminal call rooms to transition back into live states; offer/answer transitions are now phase- and role-bound.
- Frontend now passes 19 tests across ten suites; all nine Firestore/Storage rule assertions passed, including terminal-room resurrection rejection.
- Local Firebase emulator assertions pass, while Java 25 still crashes during emulator shutdown; CI remains pinned to Java 21.
# Latest UI update — 2026-07-11

- Implemented a unified semantic dark design system in `signova-frontend/src/signovaDesignSystem.css`.
- Rebuilt Settings as a responsive product layout: desktop category sidebar + flexible content + large-screen context panel; mobile grouped navigation + full-width detail pages.
- Added reusable settings primitives in `signova-frontend/src/components/settings/SettingsPrimitives.jsx`.
- Preserved existing settings logic and added organized General, Accessibility, Chat, and Support groups around existing state/actions.
- Added focus-visible, reduced-motion, touch-target, safe-area, compact-row, and overflow rules.
- Added deterministic desktop/mobile settings browser tests. Current result: **8/8 Playwright checks passed**.
- Added the implementation and manual release checklist at `docs/ui/RESPONSIVE_DARK_QA.md`.
- Remaining: real-account/manual review across all routes and devices, legacy hardcoded-style migration, WCAG tooling audit, Safari/Firefox/foldable testing, and continued `App.js` modularization.

# Settings visual QA update — 2026-07-13

- Fixed a desktop Settings detail-header regression where the legacy subpage grid kept the selected category title in a narrow first column. The selected category heading now spans the full content column in the dark split layout.
- Restyled the mobile app rail/bottom navigation to stay on the dark design system surface instead of rendering as a bright shell in mobile mode.
- Tightened the global service-recovery banner layout with safer mobile grid behavior, smaller footprint, dark tokens, and 44px retry target sizing.
- Extended `signova-frontend/e2e/settings-responsive.spec.js` to assert the full-width desktop category header and non-white mobile app rail background.
- Verification: `npm run build:e2e` passed, and `npx playwright test e2e/settings-responsive.spec.js --reporter=list` passed **4/4** on desktop and mobile Chromium.
- Screenshot review: desktop header and right context panel render correctly; mobile bottom navigation is dark. Mobile outage banner still needs real-device review with normal text-scaling and connected-service states before calling the entire mobile UI pixel-final.

# Settings redesign pass — 2026-07-14

- Reworked Settings navigation data into visible groups: Account, Preferences, Call & Chat, Data & Storage, and Support.
- Updated desktop and mobile Settings rendering to use grouped category sections instead of one long flat list.
- Added final design-system overrides for the Settings page: layered dark surfaces, premium sidebar/content panels, grouped mobile cards, improved focus/search states, thinner scrollbars, sticky hierarchy, and calmer tap/hover motion.
- Preserved existing settings state/actions, account controls, privacy controls, chat/call preferences, data export/clear actions, and unavailable-feature disclosures.
- Verification: `npm run build` in `signova-frontend` compiled successfully.
- Follow-up: Jest focused settings test command timed out before output; rerun targeted tests or Playwright visual QA when the dev server/browser is available.

# Settings navbar/scroll/performance fix — 2026-07-14

- Reworked the Settings top header into a sticky product navbar with a stronger surface, right-side action cluster, and better title/description alignment.
- Fixed the clipped desktop Settings layout by making the page a two-row grid and giving the sidebar/content independent scroll regions.
- Restored mobile page scrolling by allowing the settings shell/body to use normal document scrolling below tablet width.
- Reduced Settings-page animation cost by disabling legacy page/card animations and shortening remaining control transitions to lightweight 90ms feedback.
- Kept reduced-motion behavior compatible with the existing global setting.
- Verification: `npm run build` in `signova-frontend` compiled successfully.

# Premium dark-mode product polish — 2026-07-14

- Read and applied the attached dark-mode redesign brief as a CSS-first visual-system pass.
- Added a broader premium dark token layer covering app background, surfaces, cards, app bars, bottom nav, dialogs, dividers, text colors, semantic states, motion, shadows, and radii.
- Standardized dark styling for primary app chrome, cards, lists, buttons, search/input fields, chat bubbles, modals, popovers, camera controls, call controls, loading/skeleton states, and scrollbars.
- Reduced animation cost by using shorter transitions, removing expensive blur-heavy visual treatments, avoiding unnecessary repeated animations, and respecting reduced-motion preferences.
- Preserved existing navigation, routes, APIs, chat/calls/camera/community/library/settings behavior; this pass is presentation-only.
- Verification: `npm run build` in `signova-frontend` compiled successfully.
- Follow-up: needs browser/manual QA across each major route to catch page-specific legacy CSS conflicts.

# UI bug sweep — 2026-07-14

- Ran automated browser-style layout checks against the built app on Home, Library, Learn, Community, and Settings.
- Fixed the Settings desktop viewport bug where the panel/workspace could grow below the visible screen, causing cut-off content and scroll confusion.
- Restored tablet/mobile Settings flow by ensuring the workspace uses visible document scrolling instead of clipping grouped content.
- Fixed dark-mode light leaks in the app rail logo/tribute, Library hero stats, Library book lesson badges, Learn mode tabs, Learn pose label, and avatar loading state.
- Verification: `npm run build:e2e` compiled successfully.
- Verification audit result: Home, Library, Learn, Community, and Settings all reported `overflowX: 0` and `lightLeaks: 0`; Settings content is independently scrollable on desktop.

# Settings full-page design pass — 2026-07-14

- Redesigned Settings as a full-page product canvas instead of a centered card cluster.
- Expanded the desktop Settings workspace to a wide three-column layout: category rail, flexible content area, and contextual privacy/status panel.
- Added responsive laptop behavior that hides the context panel and preserves a two-column split when width is limited.
- Refined the page header, sidebar profile/search block, content surface, context card, section headers, row height, and spacing to feel like one coherent app screen.
- Preserved all settings controls/actions and route behavior.
- Verification: `npm run build:e2e` compiled successfully.
- Verification audit: desktop/laptop Settings have no horizontal overflow and keep content independently scrollable; tablet/mobile use normal document scrolling with no horizontal overflow.

# Premium desktop Settings expansion — 2026-07-14

- Added a global Settings top bar with universal search, keyboard shortcut hint, notification/help actions, and profile/account menu.
- Expanded the Settings navigation to 19 desktop categories, including AI Settings, Community, Library, Calls, Backup & Sync, and Developer Options.
- Added safe content panels for Community, Library, Backup & Sync, and Developer Options using existing Signova settings/actions instead of placeholders.
- Rebuilt the right context panel to update by selected category; Privacy/Security, Data & Storage, Appearance, Calls, AI Settings, and General now show category-specific status/help cards.
- Tightened desktop navigation row sizing, active/hover states, top-bar alignment, and context-panel status rows.
- Verification: `npm run build:e2e` compiled successfully.
- Verification audit: desktop, laptop, and mobile Settings all reported `overflowX: 0`; desktop/laptop content remains scrollable; desktop Privacy context panel rendered dynamically.

# Settings reference alignment correction — 2026-07-14

- Compared the implemented Settings screen against the supplied reference and identified major mismatches: mixed white outer canvas, overly rounded top/header card, oversized vertical gaps, bulky center/right panels, and light-mode leakage when the saved theme was `Light`.
- Scoped dark design tokens directly to `body.signovaSettingsPage` so the Settings page no longer renders as a half-light/half-dark hybrid when user preferences persist a light theme.
- Reworked the desktop Settings shell to be edge-to-edge dark, with a slimmer top bar, flush left navigation, denser center cards, compact right context panel, and reference-like 14–16px radii.
- Verification: `npm run build:e2e` compiled successfully.
- Verification audit at 1455×779: `overflowX: 0`, no large light-surface leaks, center content remains scrollable, and Settings panels render on dark surfaces.

# Settings full-height column fix — 2026-07-14

- Fixed the real DOM path (`signToolsPane > workRail > settingsPanel > settingsWorkspace`) so final desktop rules apply to the active Settings layout.
- Forced `settingsWorkspace`, `settingsDesktopSidebar`, `settingsContent`, and `settingsContextCard` to fill the remaining desktop viewport height below the top bar.
- Removed the leftover bottom gutter that made the columns stop short of the viewport.
- Verification: `npm run build:e2e` compiled successfully.
- Verification audit at 1455×779: workspace, sidebar, content, and context card all bottom-align at `779px`; `overflowX: 0`; light leaks: `0`.

# Startup loading performance fix — 2026-08-16

- Prevented the initial workspace render from waiting on Firebase outbox retries; durable cloud operations now flush in the background while explicit sync calls remain awaitable.
- Reduced the startup watchdog from 8 seconds to 2.5 seconds and shortened the visual skeleton minimum to 180ms, so slow/offline devices reach the usable local workspace quickly.
- Kept cached/local hydration and Firebase fallback behavior intact.
- Verification: `npm run build:e2e` compiled successfully; `signovaDb` and `signovaDbOutbox` tests passed (9/9).

# Backend-first readiness audit — 2026-08-16

- Backend regression suite passes: 42/42 tests.
- MongoDB Atlas configuration is present, but the live health check currently
  reports `unavailable` after the connection timeout. A direct diagnostic
  reached SRV resolution but failed during MongoDB TLS/server selection, so
  this is currently an Atlas/network/TLS access issue rather than a confirmed
  collection or index defect.
- Backend-first work should begin with Atlas connectivity recovery, then AI
  service deployment/release qualification, followed by cross-network calling
  and production operations evidence. New visual feature work is paused except
  for blocking integration regressions.

# Backend health recheck — 2026-08-16

- MongoDB Atlas is now reachable and `/api/platform/health` reports MongoDB
  `status: ok`; MongoDB is no longer a current delivery blocker.
- AI service `/health` and backend `/api/health` both report `status: ok`.
- The first platform-health request can exceed a short 5-second client timeout
  while the connection/indexes warm up; this is a cold-start optimization item,
  not a data failure.
- The next production blocker is AI model release qualification: the release
  gate remains `production_ready: false` until private artifacts, manifests,
  signer-separated metrics, vocabulary approval, and unknown-sign benchmarks
  are supplied.

# AI release gate audit — 2026-08-16

- Python AI/model test coverage passes: 31/31 tests.
- The release gate is functioning correctly and safely rejects the current
  registry as non-production-ready; no unsafe policy bypass was introduced.
- No code-only change can close the remaining gates without the private,
  consented dataset evidence, expert vocabulary review, and final artifact
  checksums.

# Realtime and operations readiness audit — 2026-08-16

- TURN readiness check is implemented, but staging is not ready because
  `SIGNOVA_TURN_URLS` and a backend-only `SIGNOVA_TURN_SHARED_SECRET` are not
  configured. A real Coturn deployment and secret must be supplied before
  cross-network/TURN-only calling can be validated.
- Deployment validation and operations tests pass in code, but smoke/load
  checks correctly refuse to run without isolated staging URLs and deployment
  environment variables.
- Same-host calling, reconnect logic, camera/microphone failure handling,
  signaling lifecycle, cleanup, and telemetry remain automated; physical
  two-device/network validation and live operations evidence are still pending.

# Twilio Network Traversal integration — 2026-08-16

- Added an optional server-side Twilio Network Traversal provider for the
  authenticated `/api/calls/ice-config` endpoint.
- Twilio ephemeral ICE tokens are requested only by the backend; account
  credentials are never sent to the browser. Existing Coturn HMAC credentials
  remain supported as the fallback provider.
- Added provider validation and token-response tests; backend suite now passes
  44/44 tests.
- Remaining manual work: add Twilio credentials to staging secrets, run
  `npm run check:turn`, then execute two-device, different-network, and
  TURN-only calling tests.
