import argparse
import base64
from collections import Counter
import json
from pathlib import Path
import statistics
import time

import cv2

try:
    from Models.predict import LandmarkGesturePredictor
    from Models.rtmw_engine import RTMWWholeBodyEngine
except ImportError:
    from predict import LandmarkGesturePredictor
    from rtmw_engine import RTMWWholeBodyEngine


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = SCRIPT_DIR / "call_pipeline_benchmark.json"
DEFAULT_THRESHOLDS = {
    "p95_rtmw_latency_ms": 700.0,
    "p95_prediction_latency_ms": 250.0,
    "p95_end_to_end_latency_ms": 900.0,
    "reliable_hand_rate_percent": 70.0,
    "active_signer_coverage_percent": 90.0,
    "wrong_signer_switches": 0,
}


def percentile(values, percentile_value):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * percentile_value))))
    return round(float(ordered[index]), 2)


def summarize_values(values):
    if not values:
        return {"count": 0, "mean": None, "p50": None, "p95": None, "max": None}
    return {
        "count": len(values),
        "mean": round(statistics.mean(values), 2),
        "p50": percentile(values, 0.50),
        "p95": percentile(values, 0.95),
        "max": round(max(values), 2),
    }


def encode_frame(frame, max_width=640, quality=55):
    started = time.perf_counter()
    height, width = frame.shape[:2]
    if width > max_width:
        scale = max_width / width
        frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, data = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Could not encode benchmark frame.")
    return base64.b64encode(data.tobytes()).decode("ascii"), (time.perf_counter() - started) * 1000.0


def load_scenarios(args):
    if args.manifest:
        payload = json.loads(args.manifest.read_text(encoding="utf-8"))
        rows = payload.get("scenarios") if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise ValueError("Manifest must contain a scenarios list.")
        scenarios = []
        for index, row in enumerate(rows):
            video = Path(row["video"])
            if not video.is_absolute():
                video = (args.manifest.parent / video).resolve()
            scenarios.append(
                {
                    "name": row.get("name") or video.stem or f"scenario-{index + 1}",
                    "video": video,
                    "expected_people": row.get("expected_people"),
                    "expected_label": row.get("expected_label"),
                    "expected_active_person_id": row.get("expected_active_person_id"),
                    "expected_signer_switches": row.get("expected_signer_switches", 0),
                    "notes": row.get("notes", ""),
                }
            )
        return scenarios
    return [
        {
            "name": args.video.stem,
            "video": args.video.resolve(),
            "expected_people": args.expected_people,
            "expected_label": args.expected_label,
            "expected_active_person_id": args.expected_active_person_id,
            "expected_signer_switches": args.expected_signer_switches,
            "notes": "",
        }
    ]


def readiness(summary, thresholds, require_prediction=True):
    checks = {
        "rtmw_latency": (summary["latency"]["rtmw_ms"]["p95"] or float("inf")) <= thresholds["p95_rtmw_latency_ms"],
        "end_to_end_latency": (summary["latency"]["end_to_end_ms"]["p95"] or float("inf")) <= thresholds["p95_end_to_end_latency_ms"],
        "reliable_hands": summary["tracking"]["reliable_hand_rate_percent"] >= thresholds["reliable_hand_rate_percent"],
        "active_signer_coverage": summary["tracking"]["active_signer_coverage_percent"] >= thresholds["active_signer_coverage_percent"],
        "wrong_signer_switches": summary["tracking"]["wrong_signer_switches"] <= thresholds["wrong_signer_switches"],
    }
    expected_people = summary.get("expectations", {}).get("expected_people")
    people_accuracy = summary.get("expectations", {}).get("people_accuracy_percent")
    if expected_people is not None:
        checks["people_count_accuracy"] = (people_accuracy or 0.0) >= 90.0
    if require_prediction:
        checks["prediction_latency"] = (summary["latency"]["prediction_ms"]["p95"] or float("inf")) <= thresholds["p95_prediction_latency_ms"]
    return {
        "status": "pass" if all(checks.values()) else "needs_work",
        "passed": sum(checks.values()),
        "total": len(checks),
        "checks": checks,
        "thresholds": thresholds,
    }


def benchmark_scenario(scenario, args, engine, predictor):
    capture = cv2.VideoCapture(str(scenario["video"]))
    if not capture.isOpened():
        raise FileNotFoundError(f"Could not open video: {scenario['video']}")
    source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
    session_id = f"benchmark-{scenario['name']}-{time.time_ns()}"
    rows = []
    predictions = []
    previous_active = None
    active_switches = 0
    wrong_switches = 0
    source_index = 0
    processed_index = 0

    while capture.isOpened() and processed_index < args.frames:
        ok, frame = capture.read()
        if not ok:
            break
        if source_index % max(1, args.stride) != 0:
            source_index += 1
            continue

        frame_timestamp = source_index / max(source_fps, 1.0)
        encoded, encode_ms = encode_frame(frame, args.max_width, args.jpeg_quality)
        stage_started = time.perf_counter()
        result = engine.process_base64(
            encoded,
            session_id=session_id,
            timestamp=frame_timestamp,
            include_landmarks=False,
        )
        rtmw_wall_ms = (time.perf_counter() - stage_started) * 1000.0
        active_id = result.get("active_person_id")
        if previous_active and active_id and previous_active != active_id:
            active_switches += 1
            if scenario.get("expected_active_person_id") and active_id != scenario["expected_active_person_id"]:
                wrong_switches += 1
        previous_active = active_id or previous_active

        prediction = None
        prediction_ms = 0.0
        if predictor and (processed_index + 1) % max(1, args.predict_every) == 0:
            frames, selected_person_id = engine.sequence_frames(session_id, active_id)
            if len(frames) >= args.min_sequence_frames:
                prediction_started = time.perf_counter()
                prediction = predictor.predict_sequence(
                    frames,
                    {
                        "mode": args.mode,
                        "language": args.language,
                        "model": args.model,
                        "max_frames": args.max_sequence_frames,
                    },
                )
                prediction_ms = (time.perf_counter() - prediction_started) * 1000.0
                prediction["person_id"] = selected_person_id
                predictions.append(
                    {
                        "frame": source_index,
                        "timestamp": round(frame_timestamp, 3),
                        "label": prediction.get("label"),
                        "confidence": prediction.get("confidence"),
                        "selected_model": prediction.get("selected_model") or prediction.get("source"),
                        "person_id": selected_person_id,
                        "latency_ms": round(prediction_ms, 2),
                        "is_uncertain": prediction.get("is_uncertain"),
                        "router": prediction.get("router"),
                    }
                )

        people = result.get("people") or []
        hand_visibilities = [
            float((person.get("quality") or {}).get("hand_visibility") or 0.0)
            for person in people
        ]
        rows.append(
            {
                "source_frame": source_index,
                "timestamp": round(frame_timestamp, 3),
                "people": result["people_count"],
                "detected_hands": result["detected_hands"],
                "reliable_hands": result["reliable_hands"],
                "mean_hand_visibility": round(statistics.mean(hand_visibilities), 4) if hand_visibilities else 0.0,
                "active_person_id": active_id,
                "switch_candidate_id": result.get("switch_candidate_id"),
                "encoding_ms": round(encode_ms, 2),
                "rtmw_inference_ms": result["latency"]["inference_ms"],
                "rtmw_wall_ms": round(rtmw_wall_ms, 2),
                "prediction_ms": round(prediction_ms, 2),
                "end_to_end_ms": round(encode_ms + rtmw_wall_ms + prediction_ms, 2),
                "prediction": prediction.get("label") if prediction else None,
                "prediction_confidence": prediction.get("confidence") if prediction else None,
            }
        )
        source_index += 1
        processed_index += 1

    capture.release()
    engine.clear_session(session_id)
    if not rows:
        raise RuntimeError(f"No frames were benchmarked from {scenario['video']}")

    expected_people = scenario.get("expected_people")
    expected_active = scenario.get("expected_active_person_id")
    expected_label = scenario.get("expected_label")
    expected_switches = int(scenario.get("expected_signer_switches") or 0)
    if not expected_active:
        wrong_switches = abs(active_switches - expected_switches)
    people_match = [row["people"] == expected_people for row in rows] if expected_people is not None else []
    active_match = [row["active_person_id"] == expected_active for row in rows if row["active_person_id"]] if expected_active else []
    label_match = [row["prediction"] == expected_label for row in rows if row["prediction"]] if expected_label else []
    active_frames = sum(bool(row["active_person_id"]) for row in rows)
    hand_frames = sum(row["reliable_hands"] > 0 for row in rows)
    detected_hand_frames = sum(row["detected_hands"] > 0 for row in rows)

    summary = {
        "name": scenario["name"],
        "video": scenario["video"].name,
        "notes": scenario.get("notes", ""),
        "source_fps": round(source_fps, 2),
        "processed_frames": len(rows),
        "sampled_duration_seconds": round(rows[-1]["timestamp"] - rows[0]["timestamp"], 2),
        "latency": {
            "encoding_ms": summarize_values([row["encoding_ms"] for row in rows]),
            "rtmw_inference_ms": summarize_values([row["rtmw_inference_ms"] for row in rows]),
            "rtmw_ms": summarize_values([row["rtmw_wall_ms"] for row in rows]),
            "prediction_ms": summarize_values([row["prediction_ms"] for row in rows if row["prediction_ms"] > 0]),
            "end_to_end_ms": summarize_values([row["end_to_end_ms"] for row in rows]),
        },
        "tracking": {
            "max_people": max(row["people"] for row in rows),
            "people_distribution": dict(Counter(str(row["people"]) for row in rows)),
            "max_detected_hands": max(row["detected_hands"] for row in rows),
            "max_reliable_hands": max(row["reliable_hands"] for row in rows),
            "detected_hand_rate_percent": round(100.0 * detected_hand_frames / len(rows), 2),
            "reliable_hand_rate_percent": round(100.0 * hand_frames / len(rows), 2),
            "active_signer_coverage_percent": round(100.0 * active_frames / len(rows), 2),
            "active_signer_switches": active_switches,
            "wrong_signer_switches": wrong_switches,
            "expected_signer_switches": expected_switches,
            "unique_active_people": sorted({row["active_person_id"] for row in rows if row["active_person_id"]}),
            "mean_hand_visibility": round(statistics.mean(row["mean_hand_visibility"] for row in rows), 4),
        },
        "prediction": {
            "count": len(predictions),
            "labels": dict(Counter(row["label"] for row in predictions)),
            "mean_confidence": round(statistics.mean(float(row["confidence"] or 0.0) for row in predictions), 4) if predictions else None,
            "accepted_rate_percent": round(
                100.0 * sum(bool((row.get("router") or {}).get("accepted")) for row in predictions) / len(predictions),
                2,
            ) if predictions else None,
            "uncertain_rate_percent": round(
                100.0 * sum(bool(row.get("is_uncertain")) for row in predictions) / len(predictions),
                2,
            ) if predictions else None,
            "expected_label": expected_label,
            "expected_label_accuracy_percent": round(100.0 * sum(label_match) / len(label_match), 2) if label_match else None,
            "rows": predictions,
        },
        "expectations": {
            "expected_people": expected_people,
            "people_accuracy_percent": round(100.0 * sum(people_match) / len(people_match), 2) if people_match else None,
            "expected_active_person_id": expected_active,
            "active_person_accuracy_percent": round(100.0 * sum(active_match) / len(active_match), 2) if active_match else None,
            "expected_signer_switches": expected_switches,
        },
    }
    summary["readiness"] = readiness(summary, DEFAULT_THRESHOLDS, require_prediction=not args.skip_prediction)
    if args.include_rows:
        summary["rows"] = rows
    return summary


def aggregate_report(scenarios, engine_status, args):
    statuses = [scenario["readiness"]["status"] for scenario in scenarios]
    return {
        "benchmark": "Signova real-call backend pipeline",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configuration": {
            "frames_per_scenario": args.frames,
            "stride": args.stride,
            "max_width": args.max_width,
            "jpeg_quality": args.jpeg_quality,
            "predict_every": args.predict_every,
            "min_sequence_frames": args.min_sequence_frames,
            "mode": args.mode,
            "language": args.language,
            "model": args.model or "production-router",
        },
        "engine": engine_status,
        "summary": {
            "status": "pass" if statuses and all(status == "pass" for status in statuses) else "needs_work",
            "scenarios": len(scenarios),
            "passed": sum(status == "pass" for status in statuses),
            "needs_work": sum(status != "pass" for status in statuses),
            "total_frames": sum(scenario["processed_frames"] for scenario in scenarios),
        },
        "scenarios": scenarios,
    }


def main():
    parser = argparse.ArgumentParser(description="Benchmark the complete Signova real-call backend pipeline.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--video", type=Path)
    source.add_argument("--manifest", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--frames", type=int, default=30)
    parser.add_argument("--stride", type=int, default=3)
    parser.add_argument("--max-width", type=int, default=640)
    parser.add_argument("--jpeg-quality", type=int, default=55)
    parser.add_argument("--predict-every", type=int, default=6)
    parser.add_argument("--min-sequence-frames", type=int, default=12)
    parser.add_argument("--max-sequence-frames", type=int, default=40)
    parser.add_argument("--mode", default="word")
    parser.add_argument("--language", default="asl")
    parser.add_argument("--model", default="")
    parser.add_argument("--expected-people", type=int)
    parser.add_argument("--expected-label")
    parser.add_argument("--expected-active-person-id")
    parser.add_argument("--expected-signer-switches", type=int, default=0)
    parser.add_argument("--skip-prediction", action="store_true")
    parser.add_argument("--include-rows", action="store_true")
    args = parser.parse_args()

    engine = RTMWWholeBodyEngine()
    if not engine.available():
        raise RuntimeError(engine.status().get("error") or "RTMW engine is unavailable.")
    predictor = None if args.skip_prediction else LandmarkGesturePredictor()
    scenarios = [
        benchmark_scenario(scenario, args, engine, predictor)
        for scenario in load_scenarios(args)
    ]
    report = aggregate_report(scenarios, engine.status(), args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "status": report["summary"]["status"],
                "scenarios": [
                    {
                        "name": scenario["name"],
                        "frames": scenario["processed_frames"],
                        "p95_rtmw_ms": scenario["latency"]["rtmw_ms"]["p95"],
                        "p95_end_to_end_ms": scenario["latency"]["end_to_end_ms"]["p95"],
                        "reliable_hand_rate_percent": scenario["tracking"]["reliable_hand_rate_percent"],
                        "active_signer_switches": scenario["tracking"]["active_signer_switches"],
                        "readiness": scenario["readiness"]["status"],
                    }
                    for scenario in scenarios
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
