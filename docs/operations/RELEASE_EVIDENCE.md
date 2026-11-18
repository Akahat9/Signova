# Release evidence and supply-chain gate

Every Signova release must be traceable to a verified commit and retain enough
evidence for investigation or rollback.

## CI evidence

- JavaScript production dependencies are audited at high/critical severity.
- CycloneDX 1.5 SBOMs are generated for the root operations package, Node API,
  and frontend, then retained as a workflow artifact for 90 days.
- Unit, integration, Firebase rules, AI, production build, and browser journeys
  must pass before deployment.
- CI regenerates the candidate promotion report and active-model release
  readiness report, rejects disabled mandatory policies or frozen class-map
  drift, and retains both reports for 90 days.

## Deployment gates

- Production workflow dispatch is accepted only from `main`.
- GitHub Environment approval and environment-specific secrets remain required.
- `npm run ops:validate-deploy` rejects missing identifiers, malformed Firebase
  configuration, localhost/insecure URLs, embedded URL credentials, and a shared
  frontend/backend origin before the frontend build begins.
- Post-deployment smoke checks and the release record remain mandatory.
- Staging permits a structurally safe but incomplete AI registry so external
  artifacts/data can be qualified. Production runs `--require-ready` and fails
  closed unless every active task has checksummed checkpoint/metrics/dataset,
  coverage and unknown-rejection evidence, signer-disjoint validation, and an
  expert-approved frozen vocabulary specification.

## Operator checklist

1. Download and retain the CI SBOM artifact with the release ticket.
2. Confirm the requested environment and commit SHA.
3. For production, confirm the workflow ref is `main` and required reviewer approval is recorded.
4. Verify smoke checks and release record artifact.
5. Record any accepted dependency advisory with owner, impact, and expiry date.
6. Confirm `model_release_readiness.json` says `production_ready: true` for a
   production release and attach both AI reports to the release ticket.
