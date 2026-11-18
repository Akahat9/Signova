# Multimodal sentence recognition training

The `multimodal_fusion_transformer` is the Signova sentence model for live
communication. It consumes one 40-frame sequence with 165 values per frame:

- 126 hand landmark values (two hands)
- 27 normalized upper-body pose values
- 12 facial/non-manual expression values

The architecture keeps three feature branches, fuses them, learns local motion
with temporal convolutions, and then applies Transformer attention over time.
It also contains unknown-sign and language/category heads. Those auxiliary
heads are deliberately disabled in checkpoints made by the current generic
trainer; they must be trained with labelled negative/unknown clips and category
targets before live routing can trust them.

## Build the dataset

Sync the source sentence video corpus locally first. Each clip needs a
consented sentence label, signer identifier, language/category (`asl` or
`isl`), lighting condition, background, device class, handedness, and camera
angle. Include clips that are not in the supported vocabulary as `unknown`.

```powershell
cd ai-service
..\.venv\Scripts\python.exe Models\build_sequence_dataset.py `
  --datasets isl_cslrt `
  --output-dir Data\processed_sequences_isl_multimodal `
  --feature-layout multimodal_v2 `
  --sequence-length 40 `
  --max-samples-per-class 0
```

Do not mix the same signer into training and validation. The manifest should
contain the signer ID so the trainer can use `--group-split-key signer_id`.

## Train a candidate

```powershell
cd ai-service
..\.venv\Scripts\python.exe Models\train_sequence.py `
  --dataset Data\processed_sequences_isl_multimodal\signova_sequences.npz `
  --model-path Models\signova_isl_multimodal_fusion_candidate.pt `
  --class-map-path Models\signova_isl_multimodal_fusion_candidate_classes.json `
  --model-type multimodal_fusion_transformer `
  --model-dim 192 --num-heads 6 --num-layers 3 `
  --epochs 40 --batch-size 16 --augment --class-weights --balanced-sampler `
  --selection-metric f1_macro --group-split-key signer_id
```

This creates a candidate only. Benchmark it against the current sentence model
using signer-disjoint clips, low-light clips, different backgrounds, both hands,
and unseen/unknown signs. Promote it only after it exceeds the existing model
on macro-F1 and unknown-sign false-accept rate.
