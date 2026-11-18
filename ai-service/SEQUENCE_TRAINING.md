# Signova Sequence Training

Signova now uses a multi-model landmark pipeline instead of forcing every sign into one model.

- `signova_isl_transformer_top10.pt` -> ISL/Hindi/Hinglish sentence mode
- `signova_asl_transformer_top200_clean_trainval_v3.pt` -> ASL word mode
- `signova_alphabet_transformer.pt` -> alphabet spelling mode
- `landmark_mlp.pt` -> quick gesture fallback
- `signova_sequence_transformer.pt` -> mixed auto fallback

The frontend sends translation mode, output language, and selected model to the Node backend. The Node backend proxies the request to `ai-service/signova.py`, and the Python predictor picks the correct model.

## Current Local Results

| Model | Dataset cache | Classes | Accuracy | Macro F1 | Precision | Recall |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Mixed Transformer | `Data/processed_sequences` | 88 | 44.58% | N/A | N/A | N/A |
| ISL Transformer top10 | `Data/processed_sequences_isl` | 10 | 40.00% | 33.33% | 30.00% | 40.00% |
| ASL Transformer top300 targeted clean v2 challenger | `Data/processed_sequences_asl_top300_clean_trainval_v2` | 300 | 66.56% | 65.58% | 69.48% | 66.56% |
| ASL Transformer top300 clean train+val v1 challenger | `Data/processed_sequences_asl_top300_clean_trainval_v1` | 300 | 62.27% | 61.33% | 65.82% | 62.20% |
| ASL Transformer top500 targeted clean v2 coverage | `Data/processed_sequences_asl_top500_clean_trainval_v2` | 500 | 52.89% | 51.59% | 54.96% | 52.90% |
| ASL GRU top500 v2 comparison | `Data/processed_sequences_asl_top500_clean_trainval_v2` | 500 | 52.23% | 50.62% | 54.17% | 52.29% |
| ASL Transformer top500 clean v1 coverage | `Data/processed_sequences_asl_top500_clean_trainval_v1` | 500 | 50.80% | 49.68% | 54.87% | 50.64% |
| ASL Transformer top200 clean train+val v3 | `Data/processed_sequences_asl_top200_clean_trainval_v3` | 200 | 71.86% | 70.83% | 74.75% | 72.13% |
| ASL Transformer top200 clean train+val v4 experiment | `Data/processed_sequences_asl_top200_clean_trainval_v4` | 200 | 69.53% | 68.62% | 72.40% | 69.71% |
| ASL Transformer top200 hard-class focal v5 experiment | `Data/processed_sequences_asl_top200_clean_trainval_v3` | 200 | 68.87% | 68.37% | 72.92% | 69.05% |
| ASL Transformer top200 clean train+val v2 | `Data/processed_sequences_asl_top200_clean_trainval` | 200 | 69.32% | 68.95% | 73.14% | 69.28% |
| ASL Transformer top200 clean train+val v1 | `Data/processed_sequences_asl_top200_clean_trainval` | 200 | 67.75% | 67.02% | 71.38% | 67.68% |
| ASL Transformer top100 clean train+val | `Data/processed_sequences_asl_top100_clean_trainval` | 100 | 70.79% | 69.28% | 72.57% | 70.73% |
| ASL Transformer top100 previous | `Data/processed_sequences_asl_top100` | 100 | 60.40% | 59.47% | 68.00% | 60.33% |
| ASL Transformer top50 | `Data/processed_sequences_asl_top50` | 50 | 54.73% | 53.63% | 59.50% | 54.67% |
| ASL Transformer top200 ranked | `Data/processed_sequences_asl_top200_ranked` | 200 | 44.50% | 40.77% | 44.67% | 44.75% |
| Alphabet Transformer | `Data/processed_sequences_alphabet` | 28 | 99.50% | 99.11% | 99.08% | 99.27% |
| ISL Top30 clean v3 CNN-Transformer challenger | `Data/processed_sequences_isl_top30_clean_v3` | 30 | 26.67% | 22.48% | 22.34% | 26.67% |
| ISL Top30 clean v3 bidirectional GRU challenger | `Data/processed_sequences_isl_top30_clean_v3` | 30 | 28.33% | 24.67% | 24.44% | 28.33% |
| Mixed dynamic clean v3 CNN-Transformer challenger | `Data/processed_sequences_mixed_dynamic_clean_v3` | 120 | 40.76% | 33.91% | 33.83% | 38.33% |

Detailed metric reports are saved beside each newly trained model as `*.metrics.json`. The API exposes them through `GET /metrics` and the Node backend proxies them through `GET /api/metrics`.

The ISL score is lower because the local ISL corpus has very few usable samples per sentence class. The alphabet score is high because static alphabet images have many more clean samples per class.

## Remaining Model Cleanup V3

The remaining ISL and mixed datasets now use a conservative robust-cleaning pass:

- rejects non-finite and exact-duplicate sequences
- rejects very-low-motion clips
- rejects within-class near duplicates
- rejects extreme class outliers using median absolute deviation
- preserves the existing production champions unless a challenger proves better

ISL Top30 clean v3 retains 211 sequences across 30 sentence classes. The GRU challenger slightly beats the CNN-Transformer challenger, which confirms that the current ISL bottleneck is data volume rather than architecture. Neither replaces the 40% Top10 production model yet.

Mixed dynamic clean v3 retains 900 sequences across 120 classes: 90 ASL word classes and 30 ISL sentence classes. Its 40.76% accuracy is below the existing 44.58% mixed champion, but it provides wider dynamic vocabulary and remains a research candidate.

Do not promote these challengers based only on vocabulary size. The next material improvement requires more independent signer clips per ISL class and targeted samples for the mixed model's low-recall classes.

## Transformer Completion Plan

Phase 1 is the alphabet transformer. It is now marked complete for current Signova use because it passes the completion gate:

- target accuracy: 98%+, current: 99.50%
- target macro F1: 0.98+, current: 0.9911
- target classes: 28, current: 28 (`a-z`, `del`, `space`)
- target validation samples: 300+, current: 400
- sequence dataset samples: 2005

Check transformer readiness anytime:

```powershell
cd ai-service
python Models\transformer_status.py --model alphabet
python Models\transformer_status.py --model all
```

Current backend order:

1. Alphabet transformer: complete/freeze for sign creation and spelling.
2. ASL word transformer: active top200 clean train+val model, next target is 80%+ accuracy.
3. ISL sentence transformer: needs more clean local ISL samples.
4. Mixed auto transformer: keep as fallback until ASL/ISL are stronger.

## ASL Transformer Notes

The ASL Citizen raw dataset is structurally clean:

- train rows: 40154
- validation rows: 10304
- test rows: 32941
- classes: 2731
- missing videos: 0
- duplicate video rows: 0

The active ASL model uses a v3 cleaned top200 cache from train+validation splits, while the official test split remains untouched for later final evaluation. The top100 clean model remains available as the faster prototype baseline.

- cache: `Data/processed_sequences_asl_top200_clean_trainval_v3`
- samples: 3999
- classes: 200
- extraction failure rate: 4.83%
- feature format: wrist-centered, scale-normalized hand landmarks
- model: 4-layer transformer, model dim 224, 4 heads
- training improvements: class weights, label smoothing, cosine scheduler, light landmark augmentation, weak-class exclusion/backfill, stricter landmark extraction

Current gap to completion:

- accuracy target: 80%+, current 71.86%
- macro F1 target: 0.78+, current 0.7083
- validation sample target: 500+, current 803

Top200 v2 error analysis is saved in:

- `Models/signova_asl_top200_v2_error_report.md`
- `Models/signova_asl_top200_v2_error_report.json`
- `Models/signova_asl_top200_v2_class_rankings.csv`

The report currently flags 23 priority review classes and 67 review classes. The strongest confusion pairs are `child`/`shortperson`, `expect`/`hope`, and `halloween1`/`peekaboo`. Review or rebalance these before training Top200 v3.

Top200 v3 excludes those 23 priority classes and backfills to 200 classes. This raised validation accuracy from 69.32% to 71.86%.

Top200 v4 excluded the next priority-review batch as well, but accuracy dropped to 69.53%. Keep v3 active. This suggests that broad class exclusion has reached its limit; the next improvement should be targeted label/sample review or hard-class weighting rather than removing more classes.

Top200 v5 tested moderate performance-aware hard-class weights plus focal loss on the exact v3 dataset and split. It reached 68.87% and overfit quickly, so v3 remains active. Do not repeat this focal-loss recipe without stronger regularization or more samples.

Top200 v6 tested a residual temporal CNN + Transformer hybrid on the exact clean v3 dataset and split. The CNN captures short local motion before the Transformer models the full sequence.

- validation accuracy: 71.98% (v3: 71.86%)
- validation macro F1: 0.7130 (v3: 0.7083)
- official-test accuracy: 59.19% (v3: 58.69%)
- official-test macro F1: 0.5550 (v3: 0.5584)
- model: `Models/signova_asl_cnn_transformer_top200_v6.pt`

The gain is real but too small to replace v3. Adding v6 directly to the live hierarchy reduced accepted accuracy below the 80% safety target, so v3 remains the production champion and v6 remains a research challenger. The next material improvement requires targeted clean samples for the 37 official-test priority classes rather than another architecture-only run.

## ASL Top300 Challenger

Top300 v1 uses the stable temporal Transformer recipe instead of Random Forest because hand-sign recognition depends on ordered motion across frames. It uses normalized MediaPipe landmarks, stratified validation, class weighting, moderate augmentation, cosine scheduling, and leaves the official ASL test split untouched.

- cache: `Data/processed_sequences_asl_top300_clean_trainval_v1`
- sequences: 6042
- classes: 300
- extraction failure rate: 2.86%
- validation samples: 1214
- accuracy: 62.27%
- macro F1: 0.6133
- error report: `Models/signova_asl_top300_v1_error_report.md`

Top200 v3 remains the active accuracy champion. Top300 v1 is the wider-vocabulary challenger and should receive one targeted cleanup pass before Top500.

Top300 v2 excluded only the 12 zero-recall classes from v1 and backfilled to 300 classes. This careful cleanup raised accuracy from 62.27% to 66.56%, macro F1 from 0.6133 to 0.6558, and reduced priority-review classes from 43 to 39. Top300 v2 is now the best wider-vocabulary challenger.

## ASL Top500 Coverage Model

Top500 v2 excluded only the 44 zero-recall classes from Top500 v1 and backfilled to 500 classes. It uses optimized frame sampling, normalized temporal landmarks, class weighting, moderate augmentation, cosine scheduling, and early stopping.

- Top500 v1 Transformer: 50.80% accuracy, 0.4968 macro F1
- Top500 v2 Transformer: 52.89% accuracy, 0.5159 macro F1
- Top500 v2 bidirectional GRU comparison: 52.23% accuracy, 0.5062 macro F1
- priority-review classes: 162 -> 148
- best report: `Models/signova_asl_top500_v2_error_report.md`

The Transformer remains the best Top500 coverage architecture. The GRU is preserved only as a possible future ensemble diversity model. Top200 v3 remains the active production accuracy champion.

## Live Call Tracking Improvements

The live `/predict-sequence` path now keeps up to the active transformer's full sequence window instead of only the last 12 frames. It smooths landmark feature vectors with an exponential moving average, carries short missing landmark gaps, and returns a `tracking` object with:

- hands visible ratio
- two-hand ratio
- average hand area
- motion amount
- jitter score
- user-facing tracking tips

The model marks predictions uncertain when confidence, confidence margin, or tracking quality is weak. This keeps live captions from jumping when lighting, FPS, or hand framing is poor.

## Official ASL Test Baseline

The production ASL hierarchy is now evaluated on an untouched ASL Citizen test cache containing up to two test clips per production class.

- production hierarchy classes covered: 529 / 529
- successfully extracted clips: 1,048 / 1,058
- extraction success: 99.05% using denser frame sampling and tolerant hand detection
- strict router accepted accuracy: 82.05%
- strict router coverage: 41.98%
- calibrated router accepted accuracy: 80.25%
- calibrated router coverage: 44.94%
- calibrated router end-to-end accuracy: 36.07%
- official report: `Models/signova_asl_official_test_v2_report.json`

The production confidence gates now use the measured 0.95 calibration scale. The next ASL improvement should focus on raising model accuracy and router coverage while preserving at least 80% accepted accuracy.

## Dataset Use

Usable now:

- `Data/ISL_CSLRT_Corpus/ISL_CSLRT_Corpus` for ISL sentence recognition.
- `Data/ASL_Citizen` for ASL word/gloss recognition.
- `Data/asl_alphabet_train` for static alphabet support.
- `Data/processed_asl_alphabet` for cleaned static alphabet support.

Not directly trainable:

- `Data/download_how2sign.sh` is only a downloader. Run it first to create `Data/How2Sign`.
- `Data/Unconfirmed 277654.crdownload` is an incomplete browser download and must not be used for training.

## Install

```powershell
cd ai-service
pip install -r requirements.txt
```

For CUDA on RTX 2050, install the CUDA PyTorch build:

```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

Verify CUDA:

```powershell
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

## Train ASL Word Transformer

```powershell
python Models\build_sequence_dataset.py --datasets asl_citizen --output-dir Data\processed_sequences_asl_top50 --max-classes 50 --max-samples-per-class 15 --frame-stride 8

python Models\train_sequence.py --dataset Data\processed_sequences_asl_top50\signova_sequences.npz --model-type transformer --model-path Models\signova_asl_transformer_top50.pt --class-map-path Models\signova_asl_top50_classes.json --epochs 80 --batch-size 16 --lr 0.0003 --num-layers 2 --model-dim 128 --num-heads 4 --dropout 0.3 --patience 18
```

## Train Alphabet Transformer

```powershell
python Models\build_sequence_dataset.py --datasets processed_asl_alphabet --output-dir Data\processed_sequences_alphabet --max-classes 29 --max-samples-per-class 80 --frame-stride 1

python Models\train_sequence.py --dataset Data\processed_sequences_alphabet\signova_sequences.npz --model-type transformer --model-path Models\signova_alphabet_transformer.pt --class-map-path Models\signova_alphabet_classes.json --epochs 50 --batch-size 32 --lr 0.0005 --num-layers 2 --model-dim 96 --num-heads 4 --dropout 0.25 --patience 12
```

## Routing Rules

- Hindi, Hinglish, ISL Gloss, or sentence mode prefers the ISL model.
- ASL language or word mode uses a confidence hierarchy: Top200 v3 first, Top300 v2 when Top200 is uncertain, and Top500 v2 only when both narrower models are uncertain.
- Each wider ASL model has stricter confidence, margin, and tracking-quality gates so vocabulary coverage does not silently reduce live-caption reliability.
- If no individual ASL model clears its strict gate, agreement between at least two past champion models can be accepted using historical accuracy/F1-weighted consensus.
- The combined hierarchy exposes 528 unique ASL signs plus the `space` spelling control token, for 529 recognizable ASL classes in total.
- Alphabet/spelling mode prefers the alphabet model.
- Auto mixed model uses `signova_sequence_transformer.pt`.
- If a sequence model is unavailable, Signova falls back to the quick gesture MLP.

## Verify

```powershell
python -m py_compile Models\predict.py signova.py Models\train_sequence.py Models\sequence_model.py Models\build_sequence_dataset.py

python - <<'PY'
from Models.predict import MultiSequencePredictor
p = MultiSequencePredictor()
print(p.available_models())
PY
```

Restart `signova.py` after training. The `/health` endpoint should include `sequence_models` with `mixed`, `isl`, `asl`, and `alphabet`.
