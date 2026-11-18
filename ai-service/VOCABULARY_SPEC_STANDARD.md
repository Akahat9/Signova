# Signova Expert Vocabulary Specification Standard

Every production class map requires a separate versioned JSON specification
reviewed by a qualified signer/linguist for that sign language. Label names or
English glosses are not movement instructions. Engineers and generative tools
must not invent missing handshape, movement, orientation, location, or
non-manual-marker definitions.

## Required top-level evidence

- `schema_version: 1`
- exact registry task and frozen `class_map_sha256`
- `review_status: "approved"`
- role-based reviewer identifier such as `qualified-isl-reviewer` (do not store
  reviewer email, phone, or other personal data)
- ISO-8601 review timestamp
- controlled sources with stable ID, title, publisher, and version/date
- exactly one approved definition for every class-map label, with no extras

## Required label evidence

Each definition must include the exact machine label, display name, language,
static/dynamic/sentence/control type, dominant-hand policy, handshape, palm
orientation, signing-space location, movement, non-manual markers, start/end
poses, bounded minimum/maximum frames, known confusions, disambiguation notes,
source IDs, and approved review status.

Known confusions may reference another frozen label plus `unknown` or
`no_gesture`. A label cannot list itself. Empty prose fields, pending review,
unknown source IDs, duplicate/missing/extra labels, invalid frame bounds, or a
class-map checksum mismatch block model promotion.

## Validation

```powershell
python Models\validate_vocabulary_spec.py `
  Models\<task>.vocabulary.json `
  Models\<task>_classes.json `
  --task <registry-task> `
  --class-map-sha256 <frozen-sha256>
```

After validation, calculate the specification SHA-256, add both
`vocabulary_spec` and `vocabulary_spec_sha256` to the registry task, and run the
normal registry audit. Never edit an approved specification in place; create a
new version and re-review every affected/confusable label.

No current task has an approved specification committed. This is intentional:
the repository has no evidence of qualified expert review for the existing
10–500-label maps. The promotion audit therefore reports
`vocabulary_spec_missing` instead of accepting plausible but unverified sign
instructions.
