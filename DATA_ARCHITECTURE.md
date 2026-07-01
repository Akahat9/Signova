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

- Firebase Authentication accounts, email verification, phone OTP, and ID tokens.
- Private hashed username/phone identity mappings in Firestore.
- User profile essentials required immediately after login.
- Realtime chats, message delivery state, and user-owned operational UI state.
- Presence should use Realtime Database when true online/offline semantics are required.
- Media binary files remain in Firebase Storage or S3, not MongoDB.

## MongoDB owns

- Community signs and their versionable metadata.
- Community posts, comments, reactions, moderation state, and discovery queries.
- AI weak-sign feedback after explicit consent.
- Benchmark run metadata and aggregate model diagnostics.
- Larger catalogue/search documents that need flexible filtering and future vector search.

Mongo documents use Firebase `uid` fields such as `creatorUid`, `authorUid`, or `firebaseUid`. MongoDB never stores Firebase passwords, phone OTP secrets, private identity lookup values, or raw authentication tokens.

## Initial collections

### `communitySigns`

- `signId`
- `creatorUid`
- title, meaning, language family, type, category, difficulty
- description and build path
- video/image URLs
- visibility, status, verification status, training consent
- created, updated, and published timestamps

### `communityPosts`

- `postId`, `authorUid`
- sign/media references, caption, visibility
- denormalized counters for feed reads
- moderation and timestamps

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
3. Move new community signs and new AI feedback to MongoDB first.
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
