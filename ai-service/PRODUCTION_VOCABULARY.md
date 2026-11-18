# Signova Production Vocabulary Freeze

The production vocabulary is defined by the class-map files and SHA-256 values
stored in `Models/model_registry.json`. A model artifact cannot be promoted if
the frozen class-map checksum changes unexpectedly.

Current task maps:

- `alphabet` → `signova_alphabet_classes.json`
- `asl_primary` → `signova_asl_top200_clean_trainval_v3_classes.json`
- `asl_top300` → `signova_asl_top300_clean_trainval_v2_classes.json`
- `asl_top500` → `signova_asl_top500_clean_trainval_v2_classes.json`
- `isl` → `signova_isl_top10_classes.json`
- `mixed` → `signova_sequence_classes.json`

Vocabulary expansion requires a new versioned class-map file, documented label
definitions, signer-disjoint evaluation, unknown/no-sign results, artifact and
class-map checksums, and an explicit registry candidate. Never edit an existing
frozen class map in place.

Every candidate now also requires an exact-coverage, expert-approved vocabulary
specification and frozen specification checksum. See
`VOCABULARY_SPEC_STANDARD.md`. Current tasks intentionally report
`vocabulary_spec_missing`; do not fill this gate with generated or engineer-
guessed sign descriptions.

Unknown/no-sign evaluation input uses JSONL rows:

```json
{"expected_label":"unknown","predicted_label":"hello","accepted":false}
```

Generate the required rejection report:

```powershell
python Models\evaluate_unknown_rejection.py predictions.jsonl --output unknown_report.json --signer-disjoint
```
