import argparse
import json
from pathlib import Path

import torch

try:
    from Models.predict import MODEL_COMPLETION_TARGETS, model_readiness
except ImportError:
    from predict import MODEL_COMPLETION_TARGETS, model_readiness


SCRIPT_DIR = Path(__file__).resolve().parent

MODEL_FILES = {
    "alphabet": "signova_alphabet_transformer.metrics.json",
    "asl": "signova_asl_transformer_top200_clean_trainval_v3.metrics.json",
    "asl_top300": "signova_asl_transformer_top300_clean_trainval_v2.metrics.json",
    "asl_top500": "signova_asl_transformer_top500_clean_trainval_v2.metrics.json",
    "isl": "signova_isl_transformer_top10.metrics.json",
    "mixed": "signova_sequence_transformer.metrics.json",
}

MODEL_CHECKPOINTS = {
    "alphabet": "signova_alphabet_transformer.pt",
    "asl": "signova_asl_transformer_top200_clean_trainval_v3.pt",
    "asl_top300": "signova_asl_transformer_top300_clean_trainval_v2.pt",
    "asl_top500": "signova_asl_transformer_top500_clean_trainval_v2.pt",
    "isl": "signova_isl_transformer_top10.pt",
    "mixed": "signova_sequence_transformer.pt",
}

FALLBACK_MODEL_FILES = {
    "mixed": "signova_sequence_gru.metrics.json",
}

RESEARCH_MODEL_FILES = {
    "isl": [
        "signova_isl_cnn_transformer_top30_clean_v3.metrics.json",
        "signova_isl_gru_top30_clean_v3.metrics.json",
    ],
    "mixed": [
        "signova_sequence_cnn_transformer_mixed_clean_v3.metrics.json",
    ],
}


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def status_for_model(name):
    metrics_path = SCRIPT_DIR / MODEL_FILES[name]
    source = "transformer"
    metrics = None
    metrics_source = str(metrics_path)

    if metrics_path.is_file():
        metrics = load_json(metrics_path)
    else:
        checkpoint_path = SCRIPT_DIR / MODEL_CHECKPOINTS[name]
        if checkpoint_path.is_file():
            checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
            metrics = checkpoint.get("metrics") or {
                "accuracy": checkpoint.get("val_accuracy"),
                "best_validation_accuracy": checkpoint.get("val_accuracy"),
                "classes": len(checkpoint.get("classes") or []),
                "model_type": checkpoint.get("model_type") or checkpoint.get("rnn_type") or "unknown",
            }
            metrics_source = str(checkpoint_path)
        elif name in FALLBACK_MODEL_FILES:
            metrics_path = SCRIPT_DIR / FALLBACK_MODEL_FILES[name]
            source = "fallback"
            if metrics_path.is_file():
                metrics = load_json(metrics_path)
                metrics_source = str(metrics_path)

    if metrics is None:
        return {
            "model": name,
            "source": source,
            "available": False,
            "readiness": {
                "status": "missing",
                "progress_percent": 0.0,
                "targets": MODEL_COMPLETION_TARGETS.get(name, {}),
                "remaining": ["Train this transformer and save metrics JSON."],
            },
        }

    readiness = model_readiness(name, metrics, class_count=int(metrics.get("classes") or 0))
    research_candidates = []
    for candidate_name in RESEARCH_MODEL_FILES.get(name, []):
        candidate_path = SCRIPT_DIR / candidate_name
        if not candidate_path.is_file():
            continue
        candidate = load_json(candidate_path)
        research_candidates.append(
            {
                "metrics_path": str(candidate_path),
                "model_type": candidate.get("model_type"),
                "accuracy": candidate.get("accuracy") or candidate.get("best_validation_accuracy"),
                "f1_macro": candidate.get("f1_macro"),
                "classes": candidate.get("classes"),
                "samples": candidate.get("samples"),
            }
        )

    return {
        "model": name,
        "source": source,
        "available": True,
        "metrics_path": metrics_source,
        "accuracy": metrics.get("accuracy") or metrics.get("best_validation_accuracy"),
        "f1_macro": metrics.get("f1_macro"),
        "precision_macro": metrics.get("precision_macro"),
        "recall_macro": metrics.get("recall_macro"),
        "classes": metrics.get("classes"),
        "samples": metrics.get("samples"),
        "research_candidates": research_candidates,
        "readiness": readiness,
    }


def official_asl_status():
    path = SCRIPT_DIR / "signova_asl_official_test_v2_report.json"
    if not path.is_file():
        return {"available": False, "remaining": ["Run Models/evaluate_asl_official_test.py."]}
    report = load_json(path)
    calibration = report.get("calibration") or {}
    recommended = calibration.get("recommended_result") or report.get("router") or {}
    return {
        "available": True,
        "report_path": str(path),
        "samples": report.get("samples"),
        "classes": report.get("classes"),
        "accepted_accuracy": recommended.get("accepted_accuracy"),
        "coverage_percent": recommended.get("coverage_percent"),
        "end_to_end_accuracy": recommended.get("end_to_end_accuracy"),
        "recommended_gate_scale": calibration.get("recommended_gate_scale"),
    }


def main():
    parser = argparse.ArgumentParser(description="Show Signova transformer readiness.")
    parser.add_argument("--model", choices=["alphabet", "asl", "asl_top300", "asl_top500", "isl", "mixed", "all"], default="all")
    parser.add_argument("--json", action="store_true", help="Print full JSON output.")
    args = parser.parse_args()

    names = ["alphabet", "asl", "asl_top300", "asl_top500", "isl", "mixed"] if args.model == "all" else [args.model]
    report = [status_for_model(name) for name in names]
    official_test = official_asl_status()

    if args.json:
        payload = {"models": report, "official_asl_test": official_test} if args.model == "all" else report[0]
        print(json.dumps(payload, indent=2))
        return

    for item in report:
        readiness = item["readiness"]
        print(
            f"{item['model']}: {readiness['status']} | "
            f"{readiness['progress_percent']:.2f}% | "
            f"accuracy={item.get('accuracy', 'N/A')} | "
            f"classes={item.get('classes', 'N/A')} | "
            f"samples={item.get('samples', 'N/A')}"
        )
        for remaining in readiness.get("remaining", []):
            print(f"  - {remaining}")
        for candidate in item.get("research_candidates", []):
            print(
                "  challenger: "
                f"{Path(candidate['metrics_path']).stem} | "
                f"accuracy={candidate.get('accuracy', 'N/A')} | "
                f"f1={candidate.get('f1_macro', 'N/A')} | "
                f"classes={candidate.get('classes', 'N/A')}"
            )
    if args.model == "all":
        print(
            "official_asl_router: "
            f"accepted_accuracy={official_test.get('accepted_accuracy', 'N/A')}% | "
            f"coverage={official_test.get('coverage_percent', 'N/A')}% | "
            f"end_to_end_accuracy={official_test.get('end_to_end_accuracy', 'N/A')}% | "
            f"samples={official_test.get('samples', 'N/A')}"
        )


if __name__ == "__main__":
    main()
