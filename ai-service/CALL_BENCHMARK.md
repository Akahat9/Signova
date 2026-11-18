# Real Video-Call Benchmark

The benchmark measures the complete Signova backend path:

`video frame -> RTMW multi-person tracking -> active signer -> selected language/model router -> prediction`

## Required scenarios

- `single-signer-clear`
- `two-people-one-signer`
- `low-light`
- `hand-occlusion`
- `signer-switching`
- `four-hands-active`

Every visible participant must consent. Videos remain local and should not be committed or published.

## Collect clips

```powershell
python Models\collect_call_benchmarks.py --scenario single-signer-clear --participant-code tester-01 --label help_me --consent
python Models\collect_call_benchmarks.py --scenario four-hands-active --participant-code group-01 --consent
```

Repeat for every required scenario. Use multiple people, rooms, cameras, lighting conditions, and distances.

## Validate and run

```powershell
python Models\validate_call_benchmarks.py --require-all-scenarios
python Models\benchmark_call_pipeline.py --manifest Data\call_benchmarks\manifest.json --frames 60 --stride 2 --language asl --mode word
python Models\tune_call_pipeline.py
```

The tuning script produces conservative recommendations. It does not silently change production router gates.

## Automated stress suite

The synthetic suite exercises tracking before real participants are available. It is intentionally reported separately and never counts as real-world consented sign-off.

```powershell
python Models\generate_call_stress_suite.py
python Models\validate_call_benchmarks.py --data-dir Data\call_benchmarks_synthetic --manifest Data\call_benchmarks_synthetic\manifest.json --allow-synthetic --require-all-scenarios
python Models\benchmark_call_pipeline.py --manifest Data\call_benchmarks_synthetic\manifest.json --frames 24 --stride 3 --skip-prediction --output Models\call_tracking_stress_report.json
```

## Current measured limitation

The local machine requests CUDA but RTMW currently uses CPU. A sampled single-person call clip produced roughly 717 ms RTMW p95 latency at 640px input. Because input is already small, GPU execution or a lighter detector is the meaningful next latency improvement.
