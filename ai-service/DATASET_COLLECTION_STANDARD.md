# Signova private dataset collection standard

This standard applies to every model candidate. Raw recordings, consent records,
and identity mapping remain outside Git in access-controlled private storage.

## Required split and signer coverage

- Train, validation, and test signers must be disjoint.
- At least five distinct signers are required in each split.
- Every training label requires samples from at least three distinct signers.
- A production dataset must cover at least four approved coarse diversity groups.
- Every sample requires capture metadata.

## Required capture coverage

- Lighting: at least three of `daylight`, `indoor`, `low-light`, `backlit`.
- Background: all three of `plain`, `cluttered`, `outdoor`.
- Handedness: at least two of `left`, `right`, `ambidextrous`.
- Device class: at least two of `mobile`, `desktop`, `tablet`.

These are minimum gates, not a claim of demographic representativeness. Per-label
error rates and unknown/no-sign rejection still require separate evaluation.

## Privacy and consent

- Use pseudonymous signer and sample IDs only.
- Keep names, email, phone, address, date of birth, GPS, and free-form identity
  notes out of the manifest.
- Diversity metadata uses only the allowlisted coarse taxonomy enforced by the
  validator. The private consent record must explain training and fairness use.
- Consent withdrawal must remove the signer from the next dataset version and
  trigger retraining when required by policy; immutable released artifacts are
  tracked through their manifest checksum.

## Release commands

```powershell
python Models/validate_dataset_manifest.py Models/<private-manifest>.json
python Models/manage_model_registry.py --report Models/model_promotion_report.json
```

A structurally valid manifest can still be promotion-ineligible. The registry
blocks candidates that miss any signer/capture coverage threshold, model metric,
unknown rejection, checksum, or vocabulary gate.

