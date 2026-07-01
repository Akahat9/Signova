import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import cv2
import numpy as np


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_DIR = AI_SERVICE_DIR / "Data" / "ASL_Citizen" / "videos"
DEFAULT_OUTPUT_DIR = AI_SERVICE_DIR / "Data" / "call_benchmarks_synthetic"


def read_clip(path, width=640, height=720, minimum_frames=180):
    capture = cv2.VideoCapture(str(path))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
    frames = []
    while capture.isOpened() and len(frames) < minimum_frames:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA))
    capture.release()
    if len(frames) < 24:
        raise RuntimeError(f"Source clip is too short: {path}")
    while len(frames) < minimum_frames:
        frames.extend(frames[: min(len(frames), minimum_frames - len(frames))])
    return frames[:minimum_frames], max(20.0, fps)


def write_video(path, frames, fps):
    height, width = frames[0].shape[:2]
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not create {path}")
    for frame in frames:
        writer.write(frame)
    writer.release()
    return {
        "frames": len(frames),
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "duration_seconds": round(len(frames) / fps, 2),
        "source": "synthetic_stress_suite",
    }


def side_by_side(left, right):
    return np.hstack([left, right])


def darken(frame):
    return cv2.convertScaleAbs(frame, alpha=0.34, beta=-12)


def occlude_hands(frame, index, total):
    output = frame.copy()
    if total * 0.3 <= index <= total * 0.62:
        height, width = output.shape[:2]
        left, top = int(width * 0.18), int(height * 0.42)
        right, bottom = int(width * 0.82), int(height * 0.76)
        region = output[top:bottom, left:right]
        output[top:bottom, left:right] = cv2.GaussianBlur(region, (61, 61), 0)
    return output


def add_signer_motion(frame, index):
    shift = int(round(14 * np.sin(index * 0.45)))
    transform = np.float32([[1, 0, shift], [0, 1, 0]])
    return cv2.warpAffine(frame, transform, (frame.shape[1], frame.shape[0]), borderMode=cv2.BORDER_REFLECT)


def metadata(name, scenario, video, media, expected_people, expected_switches=0, notes=""):
    return {
        "name": name,
        "scenario": scenario,
        "video": video,
        "participant_code": "synthetic-local-dataset",
        "expected_people": expected_people,
        "expected_label": None,
        "expected_active_person_id": None,
        "expected_signer_switches": expected_switches,
        "instructions": notes,
        "consent_confirmed": False,
        "synthetic_generated": True,
        "privacy": "Generated locally from existing local dataset clips. Simulation only; not a substitute for consented real-call validation.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "media": media,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate deterministic Signova call tracking stress scenarios.")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--source-a", type=Path)
    parser.add_argument("--source-b", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--frames", type=int, default=180)
    args = parser.parse_args()

    if args.source_a and args.source_b:
        sources = [args.source_a, args.source_b]
    else:
        preferred = [
            args.source_dir / "8336197103293617-CHAMP.mp4",
            args.source_dir / "8336197103293617-CHAMP.mp4",
        ]
        sources = [path for path in preferred if path.is_file()]
        if len(sources) < 2:
            sources = sorted(args.source_dir.glob("*.mp4"))[:2]
    if len(sources) < 2 or any(not path.is_file() for path in sources):
        raise SystemExit("At least two readable source videos are required.")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    first, fps_first = read_clip(sources[0], minimum_frames=args.frames)
    second, fps_second = read_clip(sources[1], minimum_frames=args.frames)
    second = [cv2.flip(frame, 1) for frame in second]
    fps = min(fps_first, fps_second, 30.0)
    frozen_first = first[len(first) // 2]
    frozen_second = second[len(second) // 2]

    scenarios = {
        "single-signer-clear": (first, 1, 0, "Synthetic clear single-signer baseline."),
        "low-light": ([darken(frame) for frame in first], 1, 0, "Synthetic low-light transform."),
        "hand-occlusion": (
            [occlude_hands(frame, index, len(first)) for index, frame in enumerate(first)],
            1,
            0,
            "Synthetic temporary hand-region occlusion.",
        ),
        "two-people-one-signer": (
            [side_by_side(frame, frozen_second) for frame in first],
            2,
            0,
            "Synthetic two-person scene with one moving signer.",
        ),
        "four-hands-active": (
            [side_by_side(add_signer_motion(left, index), add_signer_motion(right, index + 7)) for index, (left, right) in enumerate(zip(first, second))],
            2,
            0,
            "Synthetic two-person scene with both participants moving.",
        ),
        "signer-switching": (
            [
                side_by_side(
                    add_signer_motion(left, index) if index < len(first) // 2 else frozen_first,
                    frozen_second if index < len(first) // 2 else add_signer_motion(right, index),
                )
                for index, (left, right) in enumerate(zip(first, second))
            ],
            2,
            1,
            "Synthetic signer handoff at the midpoint.",
        ),
    }

    generated = []
    for scenario, (frames, expected_people, expected_switches, notes) in scenarios.items():
        video_name = f"{scenario}__synthetic.mp4"
        video_path = args.output_dir / video_name
        media = write_video(video_path, frames, fps)
        payload = metadata(
            f"{scenario}__synthetic",
            scenario,
            video_name,
            media,
            expected_people,
            expected_switches,
            notes,
        )
        metadata_path = video_path.with_suffix(".json")
        metadata_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        generated.append({"scenario": scenario, "video": video_name, "metadata": metadata_path.name, "media": media})

    print(json.dumps({"output_dir": str(args.output_dir), "generated": generated}, indent=2))


if __name__ == "__main__":
    main()
