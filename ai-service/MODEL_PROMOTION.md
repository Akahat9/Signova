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

Promotion is always explicit:

```powershell
python Models\manage_model_registry.py --promote-task asl_primary --candidate asl-top200-cnn-v6
```

If the candidate does not pass every gate, promotion is blocked. When promotion succeeds, the previous champion checkpoint and metrics are copied into `Models/rollback/<task>/<timestamp>/`.

The registry is stored at `Models/model_registry.json`. Add future trained models as candidates first, audit them, and only then consider promotion.
