import argparse
import json
from pathlib import Path
import statistics

import cv2


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = AI_SERVICE_DIR / "Data" / "call_benchmarks"
DEFAULT_MANIFEST = DEFAULT_DATA_DIR / "manifest.json"
REQUIRED_SCENARIOS = {
    "single-signer-clear",
    "two-people-one-signer",
    "low-light",
    "hand-occlusion",
    "signer-switching",
    "four-hands-active",
}


def inspect_video(path):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        return None
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    brightness = []
    sample_step = max(1, frames // 12)
    index = 0
    while capture.isOpened():
        ok, frame = capture.read()
        if not ok:
            break
        if index % sample_step == 0:
            brightness.append(float(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).mean()))
        index += 1
    capture.release()
    return {
        "fps": round(fps, 2),
        "frames": frames,
        "width": width,
        "height": height,
        "duration_seconds": round(frames / fps, 2) if fps else 0.0,
        "mean_brightness": round(statistics.mean(brightness), 2) if brightness else None,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate Signova call benchmark clips and generate the benchmark manifest.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--min-duration", type=float, default=5.0)
    parser.add_argument("--min-width", type=int, default=640)
    parser.add_argument("--require-all-scenarios", action="store_true")
    parser.add_argument("--allow-synthetic", action="store_true", help="Validate generated stress clips separately from real-call consented clips.")
    args = parser.parse_args()

    issues = []
    scenarios = []
    metadata_files = sorted(args.data_dir.glob("*.json")) if args.data_dir.is_dir() else []
    for metadata_path in metadata_files:
        if metadata_path.name == args.manifest.name:
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        video_path = metadata_path.parent / metadata.get("video", "")
        media = inspect_video(video_path)
        clip_issues = []
        synthetic = bool(metadata.get("synthetic_generated"))
        if not metadata.get("consent_confirmed") and not (args.allow_synthetic and synthetic):
            clip_issues.append("consent_not_confirmed")
        if media is None:
            clip_issues.append("video_unreadable")
        else:
            if media["duration_seconds"] < args.min_duration:
                clip_issues.append("video_too_short")
            if media["width"] < args.min_width:
                clip_issues.append("resolution_too_low")
            if media["fps"] < 20:
                clip_issues.append("frame_rate_too_low")
        if not metadata.get("scenario"):
            clip_issues.append("scenario_missing")
        if metadata.get("expected_people") is None:
            clip_issues.append("expected_people_missing")
        if metadata.get("scenario") == "signer-switching" and metadata.get("expected_signer_switches") is None:
            clip_issues.append("expected_signer_switches_missing")

        valid = not clip_issues
        if valid:
            scenarios.append(
                {
                    "name": metadata.get("name") or video_path.stem,
                    "video": video_path.name,
                    "expected_people": metadata.get("expected_people"),
                    "expected_label": metadata.get("expected_label"),
                    "expected_active_person_id": metadata.get("expected_active_person_id"),
                    "expected_signer_switches": metadata.get("expected_signer_switches", 0),
                    "notes": metadata.get("instructions", ""),
                    "synthetic_generated": synthetic,
                }
            )
        issues.append(
            {
                "metadata": metadata_path.name,
                "video": video_path.name,
                "scenario": metadata.get("scenario"),
                "valid": valid,
                "issues": clip_issues,
                "media": media,
            }
        )

    collected = {row["scenario"] for row in issues if row["valid"]}
    missing_scenarios = sorted(REQUIRED_SCENARIOS - collected)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps({"scenarios": scenarios}, indent=2), encoding="utf-8")
    status = "pass"
    if not scenarios or any(not row["valid"] for row in issues):
        status = "needs_work"
    if args.require_all_scenarios and missing_scenarios:
        status = "needs_work"
    report = {
        "status": status,
        "valid_clips": len(scenarios),
        "total_metadata_files": len(issues),
        "missing_required_scenarios": missing_scenarios,
        "validation_kind": "synthetic_stress" if args.allow_synthetic else "consented_real_call",
        "real_world_signoff": False if args.allow_synthetic else status == "pass",
        "manifest": str(args.manifest),
        "clips": issues,
    }
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if status == "pass" else 1)


if __name__ == "__main__":
    main()
