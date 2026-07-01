import argparse
import base64
import json
from pathlib import Path
import statistics

import cv2

try:
    from Models.rtmw_engine import RTMWWholeBodyEngine
except ImportError:
    from rtmw_engine import RTMWWholeBodyEngine


def encode_frame(frame):
    ok, data = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    if not ok:
        raise RuntimeError("Could not encode benchmark frame.")
    return base64.b64encode(data.tobytes()).decode("ascii")


def main():
    parser = argparse.ArgumentParser(description="Benchmark Signova RTMW whole-body inference on a video.")
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--frames", type=int, default=30)
    parser.add_argument("--stride", type=int, default=3)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    engine = RTMWWholeBodyEngine()
    capture = cv2.VideoCapture(str(args.video))
    rows = []
    index = 0
    while capture.isOpened() and len(rows) < args.frames:
        ok, frame = capture.read()
        if not ok:
            break
        if index % max(1, args.stride) == 0:
            result = engine.process_base64(encode_frame(frame), session_id="benchmark")
            rows.append(
                {
                    "latency_ms": result["latency"]["inference_ms"],
                    "people": result["people_count"],
                    "detected_hands": result["detected_hands"],
                    "reliable_hands": result["reliable_hands"],
                }
            )
        index += 1
    capture.release()

    latencies = [row["latency_ms"] for row in rows]
    summary = {
        "engine": engine.status(),
        "video": str(args.video),
        "frames": len(rows),
        "average_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
        "p95_latency_ms": round(sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 2) if latencies else None,
        "estimated_fps": round(1000.0 / statistics.mean(latencies), 2) if latencies else None,
        "max_people": max((row["people"] for row in rows), default=0),
        "max_detected_hands": max((row["detected_hands"] for row in rows), default=0),
        "max_reliable_hands": max((row["reliable_hands"] for row in rows), default=0),
        "rows": rows,
    }
    if args.output:
        args.output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
