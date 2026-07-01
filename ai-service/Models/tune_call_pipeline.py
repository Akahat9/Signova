import argparse
import json
from pathlib import Path
import statistics


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_REPORT = SCRIPT_DIR / "call_pipeline_benchmark.json"
DEFAULT_OUTPUT = SCRIPT_DIR / "call_pipeline_tuning.json"


def values(scenarios, getter):
    return [value for scenario in scenarios if (value := getter(scenario)) is not None]


def main():
    parser = argparse.ArgumentParser(description="Generate conservative RTMW and router tuning recommendations from a real-call benchmark.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    report = json.loads(args.report.read_text(encoding="utf-8"))
    scenarios = report.get("scenarios") or []
    if not scenarios:
        raise SystemExit("Benchmark report has no scenarios.")

    p95_rtmw = values(scenarios, lambda row: row["latency"]["rtmw_ms"]["p95"])
    wrong_switches = sum(row["tracking"]["wrong_signer_switches"] for row in scenarios)
    reliable_rates = values(scenarios, lambda row: row["tracking"]["reliable_hand_rate_percent"])
    accepted_rates = values(scenarios, lambda row: row["prediction"].get("accepted_rate_percent"))
    label_accuracies = values(scenarios, lambda row: row["prediction"].get("expected_label_accuracy_percent"))

    mean_p95 = statistics.mean(p95_rtmw) if p95_rtmw else 0.0
    configured_max_width = int((report.get("configuration") or {}).get("max_width") or 640)
    recommendations = {
        "SIGNOVA_RTMW_ACTIVE_SCORE_MIN": 0.34 if wrong_switches else 0.28,
        "SIGNOVA_RTMW_SWITCH_MARGIN": 0.12 if wrong_switches else 0.08,
        "SIGNOVA_RTMW_SWITCH_HOLD_MS": 1200 if wrong_switches else 900,
        "SIGNOVA_RTMW_MAX_FRAME_DIMENSION": min(960, configured_max_width) if mean_p95 > 700 else 1280,
    }
    router = {
        "action": "keep_current_gates",
        "reason": "Router gates should only change when expected-label benchmark coverage is available.",
    }
    if label_accuracies and accepted_rates:
        accuracy = statistics.mean(label_accuracies)
        accepted = statistics.mean(accepted_rates)
        if accepted > 80 and accuracy < 65:
            router = {
                "action": "tighten_gates",
                "reason": "The router accepts frequently but expected-label accuracy is low.",
                "suggested_delta": {"confidence": 0.03, "margin": 0.02},
            }
        elif accepted < 35 and accuracy >= 75:
            router = {
                "action": "carefully_relax_gates",
                "reason": "Predictions are accurate but too few clear the production gates.",
                "suggested_delta": {"confidence": -0.02, "margin": -0.01},
            }

    output = {
        "source_report": str(args.report),
        "scenario_count": len(scenarios),
        "observations": {
            "mean_scenario_p95_rtmw_ms": round(mean_p95, 2),
            "wrong_signer_switches": wrong_switches,
            "mean_reliable_hand_rate_percent": round(statistics.mean(reliable_rates), 2) if reliable_rates else None,
            "mean_router_accepted_rate_percent": round(statistics.mean(accepted_rates), 2) if accepted_rates else None,
            "mean_expected_label_accuracy_percent": round(statistics.mean(label_accuracies), 2) if label_accuracies else None,
        },
        "recommended_environment": recommendations,
        "router_recommendation": router,
        "performance_recommendation": (
            "Use CUDAExecutionProvider or a lighter detector; input is already small and CPU p95 remains above target."
            if mean_p95 > 700 and configured_max_width <= 640
            else "Current detector latency is within the configured benchmark target."
        ),
        "safety": "Review recommendations and rerun the benchmark before changing production configuration.",
    }
    args.output.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
