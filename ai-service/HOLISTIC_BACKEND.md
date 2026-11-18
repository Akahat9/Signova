# MediaPipe Holistic tracker

Signova now supports the current MediaPipe Tasks `HolisticLandmarker` as a
selectable live-call tracker. It produces face landmarks, pose landmarks, and
left/right hand landmarks together, which is the correct input shape for the
multimodal sentence model.

The default tracker remains RTMW because it is multi-person. Holistic is
single-person and should be used for one-to-one calls or A/B testing.

```powershell
$env:SIGNOVA_TRACKER_BACKEND='holistic'
..\.venv\Scripts\python.exe signova.py --ai-only
```

Verify the active tracker at `GET /wholebody/status`. The response must say
`MediaPipe HolisticLandmarker` and `available: true`. Return to RTMW with
`SIGNOVA_TRACKER_BACKEND=rtmw`.

The model bundle is stored at `Models/holistic_landmarker.task`. It was sourced
from the MediaPipe model distribution and is loaded locally; live frames are
processed only in memory.
