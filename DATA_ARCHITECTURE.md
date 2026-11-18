# Signova Firebase and MongoDB Architecture

## Ownership rule

Every record has one source of truth. Do not write the same mutable record to both databases.

## Current no-cost authentication mode

- Firebase Spark is sufficient for email/password authentication and normal Firestore free-tier usage.
- Signova signup, login, email verification, and password reset use Firebase Authentication directly in the frontend.
- Phone is optional profile information. SMS OTP is intentionally not required in the Spark setup.
- The legacy in-memory Node.js signup/login implementation has been removed.
- Username/phone login can be enabled later through the private identity resolver after Firebase Admin credentials and backend secrets are configured.

## Firebase owns

- Firebase Authentication accounts, email verification, phone OTP, ID tokens, and authenticated E2EE public device-key/revocation records.
- Private hashed username/phone identity mappings in Firestore.
- User profile essentials required immediately after login.
- Versioned user preferences under `users/{uid}/userPreferences/settings`.
  Identity fields (name, username, email, and phone) remain authoritative on the
  root user profile; the preference document stores only UI/device/privacy
  choices and non-identity profile preferences.
- Realtime chats, message delivery state, and user-owned operational UI state.
- Verified one-to-one text conversations use deterministic opaque
  `chats/{chatId}` documents and ordered `chats/{chatId}/messages/{messageId}`
  records. Room membership is immutable; a text send atomically creates the
  message and updates the bounded room preview. Firestore is authoritative and
  live subscriptions reconcile optimistic client IDs without fabricating
  encryption claims.
- Verified direct-message delivery/read receipts are stored as recipient-scoped
  `chats/{chatId}/messages/{messageId}/receipts/{uid}` documents. Firestore
  rules allow only chat members to read them, only the matching authenticated
  recipient to write their own receipt, and prevent the sender from spoofing a
  delivered/read state for their own message.
- Verified direct-chat file attachments store binary data under
  `chatAttachments/{chatId}/{senderUid}/{messageId}/{fileName}` in Firebase
  Storage. Firestore message documents store only bounded metadata and the
  Storage path; clients resolve temporary download URLs at render time for chat
  members instead of persisting public media URLs in the conversation record.
- Verified direct-message reactions are stored as user-scoped
  `chats/{chatId}/messages/{messageId}/reactions/{uid}` documents. Firestore
  rules allow only chat members to read them and only the matching authenticated
  user to create/update/delete their own reaction.
- Approximate web presence is stored in `userPresence/{uid}`. Only the owner can
  write their bounded heartbeat/visibility state; signed-in users can read it for
  chat UI presence. This is not a hard disconnect detector; Realtime Database
  remains the preferred future store for strict online/offline semantics.
- Live community posts, reactions, and creator-owned deletion. These records are
  realtime UI state and currently use `publicCommunityPosts` in Firestore.
- Presence should use Realtime Database when true online/offline semantics are required.
- Community, chat, and profile media binary files remain in Firebase Storage, not MongoDB.
- Durable profile photos use creator-owned versioned objects under
  `users/{uid}/profile/`; the root user profile stores the current validated
  Storage URL/path. A successful replacement removes the previous owned object,
  while a failed Firestore metadata commit rolls back the new object.
- Experimental encrypted chat attachments use authenticated ciphertext objects
  under `encryptedChatAttachments/{chatId}/{senderUid}/{attachmentId}.bin`;
  Firestore chat membership authorizes reads, the sender owns create/delete, and
  no Firebase download-token URL is persisted. Product activation remains gated
  on the selected MLS runtime and ciphertext-only message schema.
- Immutable MLS KeyPackage publications and their backend-atomic one-time claim state remain in Firestore. Clients cannot directly read, claim, update, or delete published packages.

## MongoDB owns

- Community signs and their versionable metadata.
- Community moderation cases and discovery/search projections that reference the
  authoritative Firestore post ID. MongoDB must not receive a mutable duplicate
  of the complete live post record.
- AI weak-sign feedback after explicit consent.
- Benchmark run metadata and aggregate model diagnostics.
- Larger catalogue/search documents that need flexible filtering and future vector search.

Mongo documents use Firebase `uid` fields such as `creatorUid`, `authorUid`, or `firebaseUid`. MongoDB never stores Firebase passwords, phone OTP secrets, private identity lookup values, or raw authentication tokens.

## Browser/offline cache isolation

- Local fallbacks are namespaced as `signova-user-workspace:{uid}:{collection}`.
  Contacts, chat state, calls, and preferences from one Firebase UID must never
  be read by another UID on the same browser.
- The old unscoped `signova-public-db:{collection}` cache is ignored for
  authenticated Firebase sessions. It is migrated only into an explicitly local
  browser workspace, then removed. Database persistence never signs in an
  anonymous Firebase account; verified identity remains exclusively owned by the
  application authentication flow.
- Account transitions clear live contacts, messages, lock flags, and call history
  before hydrating the next UID. Empty cloud collections are authoritative empty
  state rather than a reason to retain the previous account's React state.
- The browser cache is an availability fallback, not a second source of truth.
  Firestore remains authoritative after a cloud operation is acknowledged.
- Authenticated cache writes use a versioned UID-scoped write-ahead outbox. The
  outbox validates Firestore path segments, bounds retained work to 500 compacted
  operations / approximately 5 MB, and stores only the latest local intent for a
  given collection/document. Immutable operation tokens prevent a delayed
  acknowledgement from deleting a newer replacement.
- Online writes and deletes are bounded to five seconds. A failure leaves the
  operation queued; reconnect upgrades an authenticated offline session, flushes
  operations serially, and stops at the first failed head so later work cannot
  reorder around it. Account changes invalidate the previous session generation
  and cannot flush another UID's queue.
- This supplies durable retry and deterministic same-device ordering, not a
  general multi-device merge algorithm. Verified direct text messages have moved
  to per-message Firestore documents with a dedicated bounded same-device
  queued-send outbox. Local/legacy AI and unlinked-contact records still use the
  scoped `chatState/messages` aggregate. Other concurrent aggregate edits still
  need revision-aware conflict handling before complete offline multi-device
  synchronization can be claimed.

## Account deletion boundary

- Destructive account deletion is owned by the backend Admin boundary, not by
  client Firestore rules. The route requires a verified Firebase ID token with a
  recent `auth_time`, rate limits attempts, and requires an explicit `DELETE`
  confirmation.
- The frontend collects the current password only for Firebase
  reauthentication, requests a fresh ID token, and then calls the backend
  deletion route. The password is not written to local storage, Firestore, or
  MongoDB.
- Firebase-owned cleanup deletes the user profile subtree, E2EE device directory,
  MLS KeyPackage directory, direct chat/call rooms involving the user, live
  community posts authored by the user, private identity mappings, owner Storage
  prefixes, and finally the Firebase Auth account. The Auth user is deleted last
  so cleanup failures do not leave an unreachable half-owned dataset.
- MongoDB account-deletion cleanup is retention-specific: `aiFeedback`,
  `communityPresence`, and `communityInstalls` are deleted; user-created
  `communitySigns` are archived, made private, and removed from training
  consent; `communityPostModeration` reports retain the moderation case but
  replace the reporter UID with a one-way deleted-user reference and remove the
  original free-text reason. Benchmark/model diagnostic records are aggregate
  operational evidence and must not store raw Firebase identifiers.

## Realtime direct-chat flow

1. Both accounts authenticate through the verified Firebase Auth flow.
2. The client derives an opaque SHA-256-based room ID from the sorted member UIDs.
3. A Firestore transaction reads the deterministic path, creates the room when
   absent, or verifies the exact immutable membership when present.
4. Each participant subscribes to at most the newest 200 ordered message records.
5. Text sends validate 1–4000 characters and atomically write the client message
   ID plus the room preview/timestamps.
6. The snapshot replaces matching pending or timed-out optimistic UI state.
7. Same-device send failures/timeouts enqueue a bounded UID-scoped retry record
   containing only the direct chat ID, contact ID, sender UID, client message ID,
   text, token, and queued timestamp. Reconnect flushes FIFO and acknowledges by
   immutable token after the Firestore batch succeeds.
8. Sender edit/unsend for verified direct text messages updates the
   authoritative message document with bounded replacement text plus `editedAt`
   or `deletedAt`; clients render the snapshot as edited or unsent rather than
   locally diverging from remote devices.
9. Reactions are written to each user's own reaction document under the message
   and subscribed through a bounded collection-group query filtered by chat ID.
10. Delivery/read state is written by the receiving account to its own receipt
    document under the message. Sender UI subscribes to the receipt collection
    group, upgrades outgoing rows to delivered/read only from Firestore evidence,
    and preserves that state across message snapshot refreshes.
11. Image, audio, and document attachments in verified direct chats upload to a
    sender-owned Storage object scoped by chat ID and message ID. The message is
    published only after the upload succeeds; publish failure attempts Storage
    cleanup. Member clients hydrate preview/download URLs from Storage on demand.
    The active browser session uses resumable upload tasks, progress state,
    cancellation, and same-session retry while the original `File` object is
    still available.

Current limitations: reload-persistent direct attachment retry, attachment orphan
cleanup scheduling evidence, hard-delete, strict Realtime Database disconnect
presence, group chat, cross-device conflict resolution for legacy aggregate
records, and production E2EE remain separate unfinished capabilities.

## Initial collections

### `communitySigns`

- `signId`
- `creatorUid`
- title, meaning, language family, type, category, difficulty
- description and build path
- video/image URLs
- visibility, status, verification status, training consent
- created, updated, and published timestamps

### `communityPostModeration`

- `postId` (the authoritative Firestore document ID), reporter/moderator UID
- reason, evidence references, decision, status, and timestamps
- search/discovery projection fields only when they can be rebuilt from Firestore
- never a second mutable copy of the full post, caption, reactions, or ownership state

### `aiFeedback`

- `feedbackId`, `firebaseUid`
- model, language, mode, predicted label, expected label
- confidence, reason, training consent
- automatic TTL expiry
- no raw video, landmarks, email, phone, or transcript

### `benchmarkRuns`

- environment and model versions
- scenario summaries and aggregate latency/accuracy
- references to local/private benchmark artifacts, never raw participant video

## Request flow

1. Frontend signs in through Firebase Authentication.
2. Frontend obtains a Firebase ID token.
3. Protected backend requests send `Authorization: Bearer <ID token>`.
4. Backend verifies the token with Firebase Admin.
5. Backend uses the verified Firebase UID when reading or writing MongoDB.

## Migration order

1. Configure and verify MongoDB Atlas with a dedicated least-privilege database user.
2. Use `/api/platform/health` to verify both data systems.
3. Keep live community posts/reactions in Firestore; move community signs, AI
   feedback, moderation cases, and rebuildable discovery projections to MongoDB.
4. Keep existing Firestore user/chat records unchanged.
5. Migrate historical community content only after record counts and checksums are implemented.
6. Never migrate authentication or private identity documents to MongoDB.

## Local configuration

MongoDB is optional. With no `MONGODB_URI`, Signova keeps running with Firebase and reports MongoDB as disabled.

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=signova
```

Use a secret manager in production. Never commit the connection string.
