# Signova Model Promotion

Newly trained models are challengers. They must not replace an active production champion merely because they are newer or cover more classes.

Audit every registered challenger:

```powershell
cd ai-service
python Models\manage_model_registry.py
```

The audit writes `Models/model_promotion_report.json`. A challenger qualifies only when it:

- has a valid checkpoint and enough validation samples
- preserves or expands vocabulary coverage
- improves validation accuracy by the configured minimum
- does not regress macro F1 beyond the configured tolerance
- meets the absolute macro-F1 floor
- passes signer-disjoint validation
- references a consent-aware signer-disjoint dataset manifest with a matching SHA-256
- reports unknown/no-sign recall and false-accept rate within policy
- provides a SHA-256 checksum that matches the checkpoint artifact

Validate a private dataset manifest before training or registry audit:

```powershell
python Models\validate_dataset_manifest.py Models\my_private_dataset_manifest.json --output Models\my_private_dataset_manifest.report.json
```

The manifest stores pseudonymous signer/sample IDs and private consent-record
references, never names, email addresses, phone numbers, or media. Train,
validation, and test signer sets must be disjoint. Register both
`dataset_manifest` and `dataset_manifest_sha256` on every challenger.

Promotion is always explicit:

```powershell
python Models\manage_model_registry.py --promote-task asl_primary --candidate asl-top200-cnn-v6
```

Stage a qualified challenger on dedicated canary instances before promotion:

```powershell
python Models\manage_model_registry.py --stage-canary-task asl_primary --candidate asl-top200-cnn-v6
$env:SIGNOVA_MODEL_CHANNEL="canary"
```

Production champion instances leave `SIGNOVA_MODEL_CHANNEL` unset. Canary
instances load only the staged challenger. Both channels verify the registered
checkpoint SHA-256 before loading. Production model deployments must set
`SIGNOVA_REQUIRE_MODEL_CHECKSUM=true`; local training environments may leave it
off while generating a new challenger checksum.

Rollback is explicit and restores a timestamped champion backup:

```powershell
python Models\manage_model_registry.py --rollback-task asl_primary --rollback-dir Models\rollback\asl_primary\<timestamp>
```

If the candidate does not pass every gate, promotion is blocked. When promotion succeeds, the previous champion checkpoint and metrics are copied into `Models/rollback/<task>/<timestamp>/`.

The registry is stored at `Models/model_registry.json`. Add future trained models as candidates first, audit them, and only then consider promotion.
