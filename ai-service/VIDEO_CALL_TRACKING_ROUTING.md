# Video-Call Tracking and Routing

The Signova call pipeline now uses:

`camera frame -> RTMW whole-body multi-person tracking -> stable active signer -> tracked signer sequence -> selected language/model router -> guarded prediction`

## Completed engineering behavior

- Tracks up to the configured RTMW people limit and exposes every person's hands and tracking quality.
- Associates identities using predicted motion, center distance, bounding-box overlap, and scale change.
- Keeps signer identity through short occlusions and requires a sustained score advantage before switching.
- Supports explicit manual signer lock.
- Uses the RTMW-selected signer's sequence as the primary call prediction source.
- Falls back to the local active-signer crop only while the RTMW sequence is warming up.
- Preserves explicit ASL, ISL, Top-300, Top-500, and alphabet model choices.
- Does not replace an explicit language/model prediction with an unrelated quick gesture.
- Returns tracking state, selected person, selected model, vocabulary, and uncertainty diagnostics.
- Clears in-memory tracking sessions when the camera/call stops.
- Selects RTMW mode automatically: lightweight on CPU for call latency and balanced on CUDA for accuracy.

## Verification

```powershell
python -m unittest Models.test_call_tracking_routing -v
python Models\benchmark_call_pipeline.py --manifest Data\call_benchmarks\manifest.json --language asl --mode word
python Models\tune_call_pipeline.py
```

The synthetic contract tests cover identity crossing, short occlusion, sustained signer switching, manual lock, explicit model preservation, and ASL hierarchy routing.

## Remaining real-world validation gate

Production validation still requires consented benchmark clips for:

- single signer
- two people with one signer
- low light
- hand occlusion
- signer switching
- four active hands

This gate measures real-world accuracy; it is not replaced by synthetic tests.
