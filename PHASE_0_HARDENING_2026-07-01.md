# Phase 0 security hardening

Status: implemented locally; not deployed

## Completed

- Removed public authentication bypass flags, UI, and implementation.
- Removed development-host email-verification bypass.
- Removed client-side Pro and student-verification activation paths.
- Disabled subscription, payment, student-ID upload, and active-session controls until trusted server implementations exist.
- Replaced inaccurate E2EE claims with explicit local-preview wording.
- Prevented clients from writing `emailVerified` and `phoneVerified` profile fields.
- Added allowlisted Firestore schemas for chats, messages, and public posts.
- Protected immutable message fields and constrained media ownership paths.
- Split Firebase Storage create/update/delete rules and retained owner checks.
- Fixed a recursive Firestore wildcard that unintentionally bypassed root-profile field restrictions.
- Added Firestore and Storage emulator authorization regression tests.
- Added a credential-rotation checklist without recording secret values.

## Verification

- Firebase Firestore/Storage rules tests: 6/6 pass
- React production build: pass, no ESLint warnings
- React smoke test: 1/1 pass
- Backend syntax checks: pass
- Production bypass scan: no paths found
- Backend dependency audit: 8 moderate advisories remain

The Firebase Storage emulator emits a Java 25 shutdown warning after successful tests. The test command exits successfully and all authorization assertions pass. Use an Firebase-supported LTS Java runtime in CI to remove this tooling warning.

## Manual actions still required

- Rotate MongoDB and service secrets using `SECURITY_ROTATION_CHECKLIST.md`.
- Do not deploy Firebase rules until current production document shapes are sampled and a compatibility migration is prepared.
- Upgrade the backend Firebase/Google dependency chain and rerun integration tests.
- Establish a clean Git baseline and CI before public deployment.
