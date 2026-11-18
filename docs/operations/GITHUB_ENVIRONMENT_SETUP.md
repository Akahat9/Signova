# GitHub Environment Setup

Create `staging` and `production` under repository Settings → Environments.
Require reviewers for `production`, prevent administrator bypass where policy
allows, and restrict deployments to protected `main`.

Configure these environment variables separately in each environment:

- `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_HOSTING_SITE`
- `FRONTEND_URL`, `BACKEND_URL`, `AI_URL`

Configure these environment secrets:

- `FIREBASE_WEB_API_KEY`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Runtime-only backend and AI secrets—including MongoDB URI, Firebase Admin
identity, TURN shared secret, identity HMAC secret, and AI service token—belong
in Vercel/AI-host environment settings, not GitHub build logs. Use different
values per environment. Grant the Google service account only the Firebase
Hosting/rules permissions required by the deployment workflow and prefer
short-lived Workload Identity Federation over JSON keys.

Before the first production dispatch, verify CI branch protection, run staging,
create a tested Firebase rollback channel, retain the previous Vercel deployment,
and confirm all three public URLs pass `npm run ops:smoke`.
