# Signova credential rotation checklist

The repository no longer contains enabled public authentication or Pro-entitlement bypass flags. Local `.env` files remain ignored and were not printed or committed by this hardening change.

Complete these manual actions before any deployment:

- [ ] Rotate the MongoDB Atlas database-user password previously shared during development.
- [ ] Restrict the Atlas database user to the required database and least-privilege roles.
- [ ] Restrict Atlas network access; do not use unrestricted `0.0.0.0/0` access.
- [ ] Generate a new `SIGNOVA_AI_SERVICE_TOKEN` with at least 32 random bytes.
- [ ] Generate a new `SIGNOVA_IDENTITY_HMAC_SECRET` with at least 32 random bytes.
- [ ] Revoke and replace any downloaded Firebase service-account keys; prefer workload identity in production.
- [ ] Restrict the Firebase web API key by allowed web origins/API usage in Google Cloud.
- [ ] Store production secrets in the hosting provider's secret manager, never in frontend variables or committed files.
- [ ] Confirm `.env`, `.env.local`, service-account JSON, certificates, and model datasets are absent from Git history.
- [ ] Run a secret scanner against the complete Git history before creating a release tag.

Do not place secret values in this checklist.
