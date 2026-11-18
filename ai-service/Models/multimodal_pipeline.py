import argparse
import json
from pathlib import Path
import subprocess
import sys


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = AI_SERVICE_DIR / "Models"
DATA_DIR = AI_SERVICE_DIR / "Data" / "isl_signer_collection"
CLASSES_PATH = MODELS_DIR / "signova_multimodal_target_classes.json"
REPORT_PATH = DATA_DIR / "multimodal_coverage_report.json"
PROCESSED_DIR = AI_SERVICE_DIR / "Data" / "processed_sequences_multimodal_v2"
DATASET_PATH = PROCESSED_DIR / "signova_sequences.npz"
MODEL_PATH = MODELS_DIR / "signova_multimodal_v2.pt"
CLASS_MAP_PATH = MODELS_DIR / "signova_multimodal_v2_classes.json"


def run(command):
    print("Running:", " ".join(str(item) for item in command))
    subprocess.run([str(item) for item in command], cwd=AI_SERVICE_DIR, check=True)


def audit(minimum_signers, target_signers):
    run(
        [
            sys.executable,
            MODELS_DIR / "audit_isl_signer_collection.py",
            "--data-dir",
            DATA_DIR,
            "--classes-path",
            CLASSES_PATH,
            "--minimum-signers",
            str(minimum_signers),
            "--target-signers",
            str(target_signers),
            "--report",
            REPORT_PATH,
        ]
    )
    return json.loads(REPORT_PATH.read_text(encoding="utf-8"))


def require_ready(report):
    if report.get("status") != "ready_for_training":
        remaining = int(report.get("clips_needed_for_minimum") or 0)
        raise SystemExit(
            f"Training blocked: collect {remaining} more independent-signer clips "
            f"across the target signs. See {REPORT_PATH}."
        )


def build_dataset(max_samples_per_class):
    run(
        [
            sys.executable,
            MODELS_DIR / "build_sequence_dataset.py",
            "--datasets",
            "isl_signer_collection",
            "--classes-path",
            CLASSES_PATH,
            "--output-dir",
            PROCESSED_DIR,
            "--feature-layout",
            "multimodal_v2",
            "--max-classes",
            "7",
            "--max-samples-per-class",
            str(max_samples_per_class),
            "--frame-stride",
            "3",
            "--min-landmark-frames",
            "12",
        ]
    )


def train_model():
    run(
        [
            sys.executable,
            MODELS_DIR / "train_sequence.py",
            "--dataset",
            DATASET_PATH,
            "--model-type",
            "cnn_transformer",
            "--model-path",
            MODEL_PATH,
            "--class-map-path",
            CLASS_MAP_PATH,
            "--epochs",
            "140",
            "--batch-size",
            "24",
            "--lr",
            "0.0003",
            "--model-dim",
            "128",
            "--num-heads",
            "4",
            "--num-layers",
            "3",
            "--dropout",
            "0.3",
            "--class-weights",
            "--balanced-sampler",
            "--augment",
            "--selection-metric",
            "f1_macro",
            "--group-split-key",
            "signer_code",
        ]
    )


def main():
    parser = argparse.ArgumentParser(description="Guarded Signova multimodal collection/build/train pipeline.")
    parser.add_argument("action", choices=["status", "build", "train", "all"])
    parser.add_argument("--minimum-signers", type=int, default=30)
    parser.add_argument("--target-signers", type=int, default=50)
    parser.add_argument("--max-samples-per-class", type=int, default=50)
    args = parser.parse_args()

    report = audit(args.minimum_signers, args.target_signers)
    print(
        json.dumps(
            {
                "status": report["status"],
                "target_classes": report["classes"],
                "valid_clips": report["valid_clips"],
                "independent_signers": report["independent_signers"],
                "classes_meeting_minimum": report["classes_meeting_minimum"],
                "clips_needed_for_minimum": report["clips_needed_for_minimum"],
                "report": str(REPORT_PATH),
            },
            indent=2,
        )
    )
    if args.action == "status":
        return
    require_ready(report)
    if args.action in {"build", "all"}:
        build_dataset(args.max_samples_per_class)
    if args.action in {"train", "all"}:
        if not DATASET_PATH.is_file():
            raise SystemExit(f"Dataset missing: {DATASET_PATH}. Run the build action first.")
        train_model()


if __name__ == "__main__":
    main()
