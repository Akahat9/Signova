# Signova Production Runbook

## Environments

Use separate Firebase projects, MongoDB databases/users, API deployments, AI
deployments, Storage buckets, TURN realms/secrets, and OAuth origins for
development, staging, and production. Never point a staging frontend at a
production backend or database. Store secrets in GitHub Environments or the
hosting provider; commit only `.env.example` files.

Required GitHub environments:

- `staging`: environment-scoped secrets and URLs; automatic deploys may be enabled.
- `production`: required reviewers, no self-approval, protected `main`, and
  environment-scoped secrets.

## Release

1. Merge only after `Signova CI` succeeds.
2. Deploy to staging with `.github/workflows/deploy.yml` and verify its smoke checks.
3. Exercise login, upload/play/delete, incoming call, AI inference, and moderation.
4. Keep a verified Firebase Hosting rollback channel and record its name, the
   Vercel deployment URL, AI image digest, commit SHA,
   database migrations, and model registry channel in the release notes.
5. Dispatch the production deployment. A production reviewer must approve it.
6. Watch structured request errors, latency, AI readiness, MongoDB connections, and
   call failures during the observation window.

## Rollback

Application rollback is manual and approval-gated through
`.github/workflows/rollback.yml`. Supply an already verified Firebase Hosting
channel and/or Vercel deployment URL. Roll model traffic from canary to the
registered champion before rolling back data. Do not reverse schema/data changes
until compatibility has been checked.

## Backup and restore

`ops/backup.ps1` is plan-only by default. Applied backups run `mongodump` and a
managed Firestore export. Configure bucket lifecycle/retention and encryption,
keep a copy in a separate failure domain, and schedule the job outside GitHub
Actions where database credentials can remain private.

Every quarter, restore into isolated `*_restore_test` MongoDB and Firebase
projects using `ops/restore.ps1`. The script rejects obvious production targets
unless explicitly overridden. Verify document counts, indexes, sampled media
references, authentication configuration, moderation records, and smoke tests.
Firebase Storage objects need bucket versioning/replication or a separate Storage
transfer policy; Firestore export does not back up Storage binaries or Firebase Auth.

Run `npm run audit:encrypted-attachments --prefix "Backend (Node.js)"` as a
scheduled dry-run to reconcile ciphertext objects against Firestore encrypted
attachment messages. Review counts and hashed object references. Apply deletion
only after the grace window and incident review using `-- --apply` together with
`SIGNOVA_ALLOW_ENCRYPTED_ATTACHMENT_DELETE=true`. The default grace period is 72
hours and cannot be configured below 24 hours.

Run `npm run audit:direct-attachments --prefix "Backend (Node.js)"` on the same
schedule for regular direct-chat image/audio/document objects under
`chatAttachments/`. It compares Storage objects against Firestore message
`mediaPath` references and logs hashed private object references. Apply deletion
only after review using `-- --apply` with
`SIGNOVA_ALLOW_DIRECT_ATTACHMENT_DELETE=true`. The default grace period is also
72 hours and cannot be configured below 24 hours.

## Account deletion validation

Run the account deletion validator against staging or local emulators before
enabling the feature for production users. The script is dry-run by default:

```powershell
npm run validate:account-deletion --prefix "Backend (Node.js)"
```

Apply mode seeds one synthetic `signova-delete-validation-*` Firebase Auth user,
Firestore data, Storage objects, and MongoDB records, runs the same backend
cleanup path used by `POST /api/account/delete`, then verifies Auth, Firestore,
Storage, and MongoDB cleanup. It refuses non-synthetic UIDs.

```powershell
$env:SIGNOVA_ALLOW_ACCOUNT_DELETION_VALIDATION = "true"
npm run validate:account-deletion --prefix "Backend (Node.js)" -- --apply
```

Use staging/emulator credentials only. Never run this validator against
production without an approved deletion test window, a synthetic UID, current
backups, and owner monitoring.

## Load and health checks

Run `npm run ops:smoke` with deployed URLs. Run the bounded, GET-only health load
harness with `SIGNOVA_LOAD_URL`, starting at concurrency 5 for 30 seconds. Raise
load gradually in staging and stop on elevated errors or saturation. Production
load tests require an approved window and monitoring owner.

## Client crash reporting and alerts

The frontend sends authenticated, deduplicated crash envelopes to
`POST /api/observability/client-errors`. Set `REACT_APP_SIGNOVA_RELEASE` to the
immutable commit SHA or release identifier. The backend writes the structured
`client_application_error` event with request ID, anonymous user reference,
source, error name, release, route, fingerprint, and at most eight sanitized
source-file frames. Raw error messages, component props, URLs, query strings,
tokens, user input, and media must never be added to this envelope.

Route structured logs to the selected centralized logging platform and create:

- warning: five events with one fingerprint/release in five minutes;
- critical: client error events exceed 2% of authenticated active sessions for
  ten minutes, or a new fingerprint appears on login/calls/translation routes;
- release guard: compare the new release against the previous release during the
  observation window and roll back on a sustained two-times crash-rate increase.

Alert delivery must be tested in staging. Record alert IDs, query/dashboard URL,
owner, acknowledgement time, and resolution in release evidence. The repository
defines the event and thresholds; production sink credentials and paging routes
remain environment-owner configuration.

## Incident minimum

Assign an incident lead, preserve correlation IDs and timestamps, stop unsafe
deployments, roll back application traffic when appropriate, and document impact,
timeline, root cause, recovery, and follow-up. Never paste tokens, MongoDB URIs,
TURN secrets, user media, or raw authentication data into tickets or logs.
