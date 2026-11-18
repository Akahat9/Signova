# ISL Multi-Signer Data Collection

The remaining ISL model bottleneck is independent signer coverage. The current corpus has roughly 6-8 clips per sentence. Signova should collect at least 30 independent signers per sentence before the next serious model promotion attempt; 50 is the preferred target.

## Privacy Rules

- Obtain explicit recording and model-training consent before every clip.
- Use a stable pseudonymous signer code, never a name, email, phone number, or student ID.
- Do not publish collected videos.
- Store consented training videos only in the protected local collection directory.
- Remove a signer's clips if they withdraw consent.

## Record A Clip

Use a sentence label from `Models/signova_isl_gru_top30_clean_v3_classes.json`.

For the new face/body-aware model, use `Models/signova_multimodal_target_classes.json`.

```powershell
cd ai-service
python Models\collect_isl_signer_data.py `
  --sentence thank_you_so_much `
  --signer-code signer-001 `
  --take 1 `
  --classes-path Models\signova_multimodal_target_classes.json `
  --consent
```

The recorder checks duration, resolution, FPS, brightness, sharpness, hand visibility, face visibility, and upper-body visibility. A clip with quality issues is saved as `needs_review` and is excluded from the valid coverage count.

Import an existing consented clip:

```powershell
python Models\collect_isl_signer_data.py `
  --sentence help_me `
  --signer-code signer-002 `
  --take 1 `
  --input-video C:\path\to\consented-help-me.mp4 `
  --consent
```

## Check Collection Progress

```powershell
python Models\multimodal_pipeline.py status
```

The report is written to `Data/isl_signer_collection/coverage_report.json`. It shows:

- independent signers per sentence
- invalid or review-required clips
- remaining clips to reach 30 and 50 signer targets
- priority sentence queue
- duplicate signer takes

## Collection Protocol

1. Keep the signer centered with face, upper body, and both hands visible.
2. Use even front lighting and a simple background.
3. Record one natural performance per clip.
4. Prefer different people over many takes from the same person.
5. Vary age group, body proportions, skin tone, clothing, camera, and room while preserving clear signing.
6. Keep a signer entirely in train, validation, or test during the later dataset split to prevent identity leakage.

Do not retrain the production ISL model until every target class has at least 30 independent valid signers.

## Build The Multi-Signer Training Cache

After the minimum coverage gate is met:

```powershell
python Models\multimodal_pipeline.py build
```

`multimodal_v2` stores 165 values per frame:

- 126 left/right hand coordinates
- 27 normalized upper-body coordinates
- 12 compact facial and body non-manual signals, including mouth openness, eye openness, brow raise, head tilt, shoulder tilt, and torso lean

Existing 126-value production checkpoints remain compatible. A model only uses the new values after it is retrained from a `multimodal_v2` dataset.

Train with signer-separated validation. This is essential: clips from the same signer must never appear in both training and validation.

```powershell
python Models\multimodal_pipeline.py train
```

Or run the guarded build and training sequence together:

```powershell
python Models\multimodal_pipeline.py all
```

The pipeline refuses to build or train until all seven target signs have at least 30 independent valid signers.
