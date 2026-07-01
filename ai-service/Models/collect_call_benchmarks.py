import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import time

import cv2


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = AI_SERVICE_DIR / "Data" / "call_benchmarks"
SCENARIOS = {
    "single-signer-clear": {
        "expected_people": 1,
        "instructions": "One signer, bright even lighting, both hands fully visible.",
    },
    "two-people-one-signer": {
        "expected_people": 2,
        "instructions": "Two people visible. Only one person signs; the second remains mostly still.",
    },
    "low-light": {
        "expected_people": 1,
        "instructions": "One signer in intentionally dim but realistic room lighting.",
    },
    "hand-occlusion": {
        "expected_people": 1,
        "instructions": "One signer. Briefly hide or overlap one hand, then recover.",
    },
    "signer-switching": {
        "expected_people": 2,
        "expected_signer_switches": 1,
        "instructions": "Two people visible. Person one signs, pauses, then person two signs.",
    },
    "four-hands-active": {
        "expected_people": 2,
        "instructions": "Two people visible and both move/sign so four-hand tracking is exercised.",
    },
}


def safe_name(value):
    return "".join(char if char.isalnum() or char in "-_" else "-" for char in value.strip().lower()).strip("-")


def save_metadata(path, payload):
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def copy_existing_video(args, output_path):
    if not args.input_video.is_file():
        raise FileNotFoundError(args.input_video)
    shutil.copy2(args.input_video, output_path)
    capture = cv2.VideoCapture(str(output_path))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    capture.release()
    return {
        "frames": frames,
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "duration_seconds": round(frames / fps, 2) if fps else 0.0,
        "source": "imported",
    }


def record_camera(args, output_path, scenario):
    capture = cv2.VideoCapture(args.camera)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open camera {args.camera}.")
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    capture.set(cv2.CAP_PROP_FPS, args.fps)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or args.width)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or args.height)
    fps = float(capture.get(cv2.CAP_PROP_FPS) or args.fps)
    writer = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        capture.release()
        raise RuntimeError(f"Could not create video: {output_path}")

    print(f"Scenario: {args.scenario}")
    print(f"Instructions: {scenario['instructions']}")
    print("Press R to start, S to stop and save, or Q to cancel.")
    started_at = None
    frames = 0
    cancelled = False
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        preview = frame.copy()
        recording = started_at is not None
        elapsed = time.perf_counter() - started_at if recording else 0.0
        if recording:
            writer.write(frame)
            frames += 1
        cv2.rectangle(preview, (0, 0), (width, 74), (10, 20, 38), -1)
        status = f"REC {elapsed:05.1f}s" if recording else "READY - press R"
        cv2.putText(preview, status, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (50, 220, 255), 2)
        cv2.putText(preview, scenario["instructions"][:82], (18, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (240, 245, 255), 1)
        cv2.imshow("Signova Call Benchmark Recorder", preview)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            cancelled = True
            break
        if key == ord("r") and not recording:
            started_at = time.perf_counter()
        if key == ord("s") and recording:
            break
        if recording and elapsed >= args.duration:
            break

    writer.release()
    capture.release()
    cv2.destroyAllWindows()
    if cancelled or frames == 0:
        output_path.unlink(missing_ok=True)
        raise RuntimeError("Recording cancelled or no frames captured.")
    return {
        "frames": frames,
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "duration_seconds": round(frames / fps, 2) if fps else 0.0,
        "source": "camera",
    }


def main():
    parser = argparse.ArgumentParser(description="Record privacy-safe Signova real-call benchmark scenarios.")
    parser.add_argument("--scenario", choices=sorted(SCENARIOS), required=True)
    parser.add_argument("--label", default="")
    parser.add_argument("--expected-active-person-id", default="")
    parser.add_argument("--participant-code", default="anonymous")
    parser.add_argument("--take", type=int, default=1)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--duration", type=float, default=12.0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--input-video", type=Path)
    parser.add_argument("--consent", action="store_true", help="Confirm every visible participant consented to local benchmark recording.")
    args = parser.parse_args()

    if not args.consent:
        raise SystemExit("Recording stopped: pass --consent only after every visible participant agrees.")
    scenario = SCENARIOS[args.scenario]
    args.output_dir.mkdir(parents=True, exist_ok=True)
    participant = safe_name(args.participant_code) or "anonymous"
    filename = f"{args.scenario}__{participant}__take-{args.take:02d}.mp4"
    output_path = args.output_dir / filename
    if output_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing benchmark clip: {output_path}")

    media = copy_existing_video(args, output_path) if args.input_video else record_camera(args, output_path, scenario)
    metadata = {
        "name": output_path.stem,
        "scenario": args.scenario,
        "video": output_path.name,
        "participant_code": participant,
        "take": args.take,
        "expected_people": scenario["expected_people"],
        "expected_label": args.label or None,
        "expected_active_person_id": args.expected_active_person_id or None,
        "expected_signer_switches": scenario.get("expected_signer_switches", 0),
        "instructions": scenario["instructions"],
        "consent_confirmed": True,
        "privacy": "Local benchmark recording. Do not publish or commit without participant permission.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "media": media,
    }
    metadata_path = output_path.with_suffix(".json")
    save_metadata(metadata_path, metadata)
    print(json.dumps({"video": str(output_path), "metadata": str(metadata_path), "media": media}, indent=2))


if __name__ == "__main__":
    main()
