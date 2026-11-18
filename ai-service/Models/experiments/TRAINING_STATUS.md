# Training status — 19 October 2026

All results below are exploratory. None is eligible for deployment because the
source manifests do not prove signer-disjoint validation.

| Run | Dataset | Samples / classes | Validation result | Decision |
| --- | --- | --- | --- | --- |
| `isl_cslrt_rope_swiglu_baseline_v1` | ISL-CSLRT, labels with >=8 clips | 56 / 7 | 21.43% accuracy, 0.1984 macro-F1 | Reject: too few clips and no signer split. |
| `isl_top30_rope_swiglu_v1` | Existing cleaned ISL Top-30 | 211 / 30 | Selected checkpoint: 14.29% accuracy, 0.1278 macro-F1; best observed accuracy was 20.00% on a different epoch | Reject: insufficient clips per class and no signer split. |
| `asl_citizen_rope_swiglu_baseline_v1` | ASL Citizen, labels with >=8 clips | 952 / 119 | 12.61% accuracy, 0.0954 macro-F1 | Reject: sparse per-class data. |

## Architecture used

- Feature projector -> RoPE Transformer encoder -> attention pooling -> class head
- RMSNorm, SwiGLU, bias-free linear layers, dropout 0.1
- AdamW betas `(0.9, 0.95)`, weight decay `0.05`
- Linear warmup followed by cosine learning-rate decay

The full CTC gloss plus encoder-decoder text model is available in
`multimodal_slt_transformer.py`. It must only be trained after a manifest has
approved `gloss`, target text, signer, split, licence, and training permission.

## Next data gate

For each ISL target label: at least 10 approved clips, at least two independent
signers, a signer-disjoint train/validation/test split, and ISL expert-reviewed
gloss/text labels. The review manifest generator is
`prepare_isl_dictionary_manifest.py`; its output is intentionally blocked from
training until `validate_slt_manifest.py` passes.
