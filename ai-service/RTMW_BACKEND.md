# Signova RTMW Whole-Body Backend

RTMW is an optional, privacy-safe whole-body engine for multi-person video calls.

## What It Adds

- multiple people per frame
- 133 whole-body keypoints per person
- separate left/right hand landmarks for each tracked person
- pose and face landmarks for future multimodal sentence recognition
- persistent per-session person IDs
- active-signer scoring from hand visibility and motion, with switch hysteresis
- isolated per-person temporal buffers
- adaptive compact tracking responses for low-rate frontend snapshots

Incoming frames are processed in memory and are not saved.

## Install

```powershell
pip install -r requirements.txt
pip install -r requirements-rtmw.txt
```

The first initialization downloads the RTMW and person-detector ONNX checkpoints into the local RTMLib cache.

## Endpoints

- `GET /wholebody/status`
- `GET /wholebody/metrics`
- `POST /wholebody/frame`
- `POST /predict-sequence-v2`
- `POST /wholebody/session/clear`

Example frame request:

```json
{
  "session_id": "call-123",
  "image": "data:image/jpeg;base64,...",
  "include_landmarks": false,
  "predict": true,
  "mode": "word",
  "language": "asl"
}
```

`/wholebody/frame` returns tracked people, visible-hand count, the active person ID, an adaptive next-snapshot interval, and inference latency. Set `include_landmarks` to `false` for compact tracking-only responses. Set `predict` to `true` to also translate the active signer's isolated sequence.

Use `person_id` with `lock_person: true` to manually select a signer. Send an empty `person_id` to release the lock. Call `/wholebody/session/clear` when the call ends.

## Deployment Notes

- `balanced` mode prioritizes accuracy. Benchmark `lightweight` before using it on low-end hardware.
- CUDA is used only when ONNX Runtime exposes `CUDAExecutionProvider`; otherwise the engine reports and uses CPU.
- Keep the existing `/predict-sequence` endpoint as a fallback until the frontend has been migrated and multi-person latency has been measured.

Benchmark a representative call video:

```powershell
python Models\benchmark_rtmw.py --video path\to\call.mp4 --frames 30 --output Models\rtmw_benchmark.json
```

Benchmark the complete backend pipeline, including signer tracking and production-model predictions:

```powershell
python Models\benchmark_call_pipeline.py --video path\to\call.mp4 --frames 60 --output Models\call_pipeline_benchmark.json
```

For objective multi-scenario validation, copy `Models/call_benchmark_manifest.example.json`, add expected people,
active signer IDs, and labels, then run:

```powershell
python Models\benchmark_call_pipeline.py --manifest Models\call_benchmark_manifest.json --frames 60
```

The report measures encoding, RTMW, prediction, and end-to-end latency; reliable-hand coverage; active-signer
coverage and switching; people-count accuracy; and expected-label accuracy.

`GET /wholebody/metrics` exposes rolling production diagnostics such as inference mean/p95, processed frames,
people and reliable-hand maxima, active signer switches, and current per-session tracking state.
