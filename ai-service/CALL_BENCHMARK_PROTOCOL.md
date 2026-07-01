# Signova Real-Call Benchmark Protocol

This dataset measures the real call pipeline. It is not training data.

## Privacy Rules

- Record only after every visible participant explicitly agrees.
- Use participant codes, not real names, email addresses, or phone numbers.
- Keep raw clips local. Do not publish or commit them.
- Delete a clip immediately if any participant withdraws consent.

## Required Scenarios

Record at least three takes of each:

1. `single-signer-clear`: one person, even lighting, both hands visible.
2. `two-people-one-signer`: two people visible, only one signs.
3. `low-light`: realistic dim room lighting.
4. `hand-occlusion`: briefly hide or overlap one hand, then recover.
5. `signer-switching`: person one signs, pauses, then person two signs.

The signer-switching preset expects one stable signer handoff. Extra or missing handoffs fail the switching check.

Recommended additional scenario:

- `four-hands-active`: both visible people move/sign simultaneously.

Use signs already supported by the production ASL hierarchy. Keep the camera fixed and frame the upper body and hands.

## Record

```powershell
python Models\collect_call_benchmarks.py `
  --scenario single-signer-clear `
  --participant-code tester-01 `
  --label help_me `
  --take 1 `
  --consent
```

The recorder opens a local camera preview:

- `R`: start recording
- `S`: stop and save
- `Q` or `Esc`: cancel

Import an existing consensual video:

```powershell
python Models\collect_call_benchmarks.py `
  --scenario two-people-one-signer `
  --participant-code pair-01 `
  --input-video path\to\video.mp4 `
  --consent
```

## Validate And Generate Manifest

```powershell
python Models\validate_call_benchmarks.py --require-all-scenarios
```

This checks consent metadata, readability, duration, resolution, and frame rate, then creates:

`Data/call_benchmarks/manifest.json`

## Run Full Pipeline Benchmark

```powershell
python Models\benchmark_call_pipeline.py `
  --manifest Data\call_benchmarks\manifest.json `
  --frames 90 `
  --output Models\call_pipeline_real_report.json
```

Tune the backend only after reviewing failures by scenario. A change is useful only if it improves the real-call report without reducing expected-label accuracy or increasing wrong signer switches.
