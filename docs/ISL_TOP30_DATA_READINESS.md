# ISL top-30 data readiness audit

Audited 2026-10-12 against the local candidate manifests, signer-collection reports, model registry, and the local ISL-CSLRT corpus directory. Raw video and identity/consent records remain in ignored local data directories and are not copied here.

## Findings

- The local ISL-CSLRT corpus description identifies its contents and says it is publicly available, but the checked-out corpus directory contains no explicit license grant. Public availability alone does not establish permission for model training or redistribution. Get and archive the authoritative license/terms and source citation before including it in a released training manifest.
- The current top-30 processed manifest records 211 samples over 30 labels and contains absolute machine-local paths. It is unsuitable as a shareable release manifest until provenance, signer separation, metadata completeness, and path anonymization are checked.
- The existing CNN top-30 candidate reports validation accuracy 26.67% and macro F1 0.2248 on 60 samples; the GRU candidate reports 28.33% and macro F1 0.2467. Both are far below the registry minimum macro F1 of 0.80. Neither is eligible for promotion.
- The local consented signer collection reports zero valid clips and zero independent signers. Its single current sample is rejected for blur and duration. New, consented signer recordings and an expert-reviewed vocabulary specification are still required.
- Existing registry gates also require signer-disjoint splits, at least five signers in each split, three train signers per label, capture metadata and coverage, unknown-sign metrics, class-map compatibility, and a checksummed export.

## Decision

Do not promote either top-30 candidate and do not train another candidate from the same insufficient evidence. Keep the active ISL top-10 and ASL top-200 models in the private beta. The mobile ONNX export path is implemented separately and exports only registry active checkpoints; generated model binaries and manifests stay outside Git.

## Next data work

1. Obtain written licensing/provenance terms for each public source and record source versions and permitted uses.
2. Have qualified ISL reviewers approve the exact top-30 glosses, variants, and label descriptions.
3. Collect consented recordings in access-controlled storage using `ai-service/DATASET_COLLECTION_STANDARD.md`; keep consent records and signer identity mapping separate from pseudonymous sample metadata.
4. Build anonymized train/validation/test manifests with signer-disjoint partitions and run the existing validator, registry promotion checks, and unknown-sign evaluation.
5. Promote only after all existing thresholds pass; then export ONNX and compare mobile/runtime predictions against the Python reference before a later app update.
