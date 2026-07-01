# Signova App Audit

Updated: 2026-06-12

## Current Health

- Frontend production build: passing
- Frontend smoke test: passing
- Node backend syntax and production dependency audit: passing
- Python source compile: 22/22 files passing
- Fresh AI and Node services: clean boot and health checks passing
- Runtime model selection: uses approved active checkpoints from `ai-service/Models/model_registry.json`

## Fixes Applied

- Production auth and Pro testing bypasses now default to disabled.
- AI gateway requests now time out instead of hanging indefinitely.
- AI `/health` no longer returns the entire sign catalogue on every poll.
- Frontend smoke test now waits for asynchronous app initialization.
- Runtime inference resolves the active model registry with safe file fallbacks.
- Non-breaking frontend dependency security updates were applied.

## Active Production Models

| Model | Classes | Validation accuracy |
| --- | ---: | ---: |
| Alphabet transformer | 28 | 99.50% |
| ASL primary top-200 | 200 | 71.86% |
| ASL top-300 | 300 | 66.56% |
| ASL top-500 | 500 | 52.89% |
| ISL top-10 | 10 | 40.00% |
| Mixed transformer | 88 | 44.58% |

ASL exposes 528 unique signs through hierarchical routing. No current challenger passes the promotion policy, so the existing champions remain active.

## Release Blockers

1. **Identity lookup privacy**
   `publicUserIdentities` currently supports username/phone login by exposing lookup documents to unauthenticated clients. Move this lookup behind a rate-limited server or Firebase callable function using hashed identifiers, then remove email/phone values from public Firestore documents.

2. **Frontend maintainability**
   `App.js` is about 9,781 lines and `App.css` is about 22,422 lines. Split by feature before adding more UI:
   `auth`, `calls`, `community`, `learn`, `library`, `progress`, and `settings`.

3. **Desktop dependency migration**
   Remaining audit warnings are mostly inherited from Create React App and the Electron/dev toolchain. Do not use `npm audit fix --force`; migrate from CRA to Vite and upgrade Electron in a dedicated tested change.

4. **Whole-body production latency**
   RTMW is available, but the requested CUDA device currently falls back to CPU. Benchmark real call videos and deploy GPU inference or a lighter detector before treating multi-person tracking as production-ready.

5. **Model data quality**
   Alphabet is production-ready. ASL primary is useful but needs real-call validation. ISL and mixed models need more independent signer data before another architecture experiment.

## Recommended Next Order

1. Build a repeatable call benchmark suite: single signer, two signers, switching, low light, occlusion, and mobile camera.
2. Add automated API contract tests for model/language routing and prediction telemetry.
3. Replace public identity lookup with a private server-side resolver.
4. Split the frontend monolith without changing design or behavior.
5. Tune RTMW and sequence routing against benchmark failures.
6. Collect weak-sign examples from consented user feedback, then retrain only when the dataset gate is met.

