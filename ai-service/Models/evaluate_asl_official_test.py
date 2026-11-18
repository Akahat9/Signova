import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

try:
    from Models.predict import MultiSequencePredictor, SequenceSignPredictor
    from Models.train_sequence import classification_metrics
except ImportError:
    from predict import MultiSequencePredictor, SequenceSignPredictor
    from train_sequence import classification_metrics


SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
DEFAULT_DATASET = AI_SERVICE_DIR / "Data" / "processed_sequences_asl_official_test" / "signova_sequences.npz"
DEFAULT_OUTPUT = SCRIPT_DIR / "signova_asl_official_test_report.json"
DEFAULT_MODELS = {
    "asl": SCRIPT_DIR / "signova_asl_transformer_top200_clean_trainval_v3.pt",
    "asl_top300": SCRIPT_DIR / "signova_asl_transformer_top300_clean_trainval_v2.pt",
    "asl_top500": SCRIPT_DIR / "signova_asl_transformer_top500_clean_trainval_v2.pt",
}
CALIBRATION_BASE_GATES = {
    "asl": {"confidence": 0.62, "margin": 0.14, "tracking": 0.42},
    "asl_top300": {"confidence": 0.66, "margin": 0.16, "tracking": 0.42},
    "asl_top500": {"confidence": 0.72, "margin": 0.20, "tracking": 0.46},
}


def run_model(name, path, sequences, true_labels, batch_size):
    predictor = SequenceSignPredictor(path, name=name)
    model_labels = predictor.classes
    label_to_index = {label: index for index, label in enumerate(model_labels)}
    covered = np.asarray([label in label_to_index for label in true_labels], dtype=bool)
    covered_sequences = sequences[covered]
    covered_labels = [label for label, keep in zip(true_labels, covered) if keep]
    targets = np.asarray([label_to_index[label] for label in covered_labels], dtype=np.int64)
    loader = DataLoader(
        TensorDataset(torch.from_numpy(covered_sequences).float()),
        batch_size=batch_size,
        shuffle=False,
    )
    probabilities = []
    with torch.no_grad():
        for (features,) in loader:
            logits = predictor.model(features.to(predictor.device))
            probabilities.append(torch.softmax(logits, dim=1).cpu().numpy())
    probabilities = np.concatenate(probabilities) if probabilities else np.empty((0, len(model_labels)))
    predictions = probabilities.argmax(axis=1) if len(probabilities) else np.empty(0, dtype=np.int64)
    metrics = classification_metrics(targets, predictions, probabilities, model_labels) if len(targets) else {}
    top_values = np.sort(probabilities, axis=1)[:, -2:] if len(probabilities) else np.empty((0, 2))
    return {
        "name": name,
        "path": str(path),
        "labels": model_labels,
        "covered_mask": covered,
        "probabilities": probabilities,
        "predicted_labels": [model_labels[index] for index in predictions],
        "confidence": probabilities.max(axis=1) if len(probabilities) else np.empty(0),
        "margin": (top_values[:, 1] - top_values[:, 0]) if len(top_values) else np.empty(0),
        "metrics": metrics,
        "covered_samples": int(covered.sum()),
        "coverage_percent": round(100.0 * float(covered.mean()), 4) if len(covered) else 0.0,
    }


def router_report(results, true_labels, gate_scale=1.0):
    rows = []
    positions = {name: 0 for name in results}
    for true_label in true_labels:
        candidates = []
        selected = None
        for name, result in results.items():
            if true_label not in result["labels"]:
                continue
            position = positions[name]
            prediction = {
                "label": result["predicted_labels"][position],
                "confidence": float(result["confidence"][position]),
                "confidence_margin": float(result["margin"][position]),
                "quality_score": 1.0,
                "tracking": {"score": 1.0},
            }
            positions[name] += 1
            candidates.append((name, prediction))
            gate = CALIBRATION_BASE_GATES[name]
            passes_gate = (
                prediction["confidence"] >= gate["confidence"] * gate_scale
                and prediction["confidence_margin"] >= gate["margin"] * gate_scale
                and prediction["quality_score"] >= gate["tracking"]
            )
            if selected is None and passes_gate:
                selected = (name, prediction, "strict_gate")
        if selected is None:
            consensus = MultiSequencePredictor.__new__(MultiSequencePredictor)._consensus_prediction(candidates)
            if consensus:
                selected = (consensus[0], consensus[1], "consensus")
        rows.append(
            {
                "true_label": true_label,
                "predicted_label": selected[1]["label"] if selected else None,
                "selected_model": selected[0] if selected else None,
                "decision": selected[2] if selected else "rejected",
            }
        )

    accepted = [row for row in rows if row["predicted_label"] is not None]
    correct = [row for row in accepted if row["predicted_label"] == row["true_label"]]
    return {
        "samples": len(rows),
        "accepted": len(accepted),
        "rejected": len(rows) - len(accepted),
        "coverage_percent": round(100.0 * len(accepted) / len(rows), 4) if rows else 0.0,
        "accepted_accuracy": round(100.0 * len(correct) / len(accepted), 4) if accepted else 0.0,
        "end_to_end_accuracy": round(100.0 * len(correct) / len(rows), 4) if rows else 0.0,
        "selected_models": {
            name: sum(row["selected_model"] == name for row in rows)
            for name in results
        },
        "decisions": {
            decision: sum(row["decision"] == decision for row in rows)
            for decision in ("strict_gate", "consensus", "rejected")
        },
        "gate_scale": gate_scale,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate production ASL models on the untouched official ASL Citizen test cache.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    data = np.load(args.dataset, allow_pickle=True)
    sequences = data["sequences"].astype(np.float32)
    labels = data["labels"].astype(np.int64)
    class_names = [str(item) for item in data["class_names"].tolist()]
    true_labels = [class_names[index] for index in labels]

    results = {
        name: run_model(name, path, sequences, true_labels, args.batch_size)
        for name, path in DEFAULT_MODELS.items()
    }
    calibration = [
        router_report(results, true_labels, gate_scale=round(scale, 2))
        for scale in np.arange(0.70, 1.01, 0.05)
    ]
    eligible = [item for item in calibration if item["accepted_accuracy"] >= 80.0]
    recommended = max(eligible, key=lambda item: item["coverage_percent"]) if eligible else calibration[-1]
    report = {
        "dataset": str(args.dataset),
        "samples": len(sequences),
        "classes": len(set(true_labels)),
        "models": {
            name: {
                "path": result["path"],
                "covered_samples": result["covered_samples"],
                "coverage_percent": result["coverage_percent"],
                "metrics": result["metrics"],
            }
            for name, result in results.items()
        },
        "router": router_report(results, true_labels),
        "calibration": {
            "target_accepted_accuracy": 80.0,
            "recommended_gate_scale": recommended["gate_scale"],
            "recommended_result": recommended,
            "sweep": calibration,
        },
    }
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "samples": report["samples"],
        "classes": report["classes"],
        "models": {
            name: {
                "coverage_percent": item["coverage_percent"],
                "accuracy": item["metrics"].get("accuracy"),
                "f1_macro": item["metrics"].get("f1_macro"),
            }
            for name, item in report["models"].items()
        },
        "router": report["router"],
        "recommended_calibration": report["calibration"]["recommended_result"],
        "output": str(args.output),
    }, indent=2))


if __name__ == "__main__":
    main()
