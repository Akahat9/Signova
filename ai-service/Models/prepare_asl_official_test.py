import argparse
import json
from pathlib import Path

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = SCRIPT_DIR / "signova_asl_hierarchy_classes.json"
DEFAULT_MODELS = [
    SCRIPT_DIR / "signova_asl_transformer_top200_clean_trainval_v3.pt",
    SCRIPT_DIR / "signova_asl_transformer_top300_clean_trainval_v2.pt",
    SCRIPT_DIR / "signova_asl_transformer_top500_clean_trainval_v2.pt",
]
CONTROL_LABELS = {"blank", "del", "delete", "no_gesture", "nothing", "space", "unknown"}


def main():
    parser = argparse.ArgumentParser(description="Create the exact class list used by the production ASL hierarchy.")
    parser.add_argument("--models", nargs="+", type=Path, default=DEFAULT_MODELS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    labels = set()
    model_counts = {}
    for path in args.models:
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
        classes = {str(label) for label in checkpoint.get("classes") or []}
        labels.update(classes)
        model_counts[path.stem] = len(classes)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "labels": sorted(labels),
        "unique_classes": len(labels),
        "unique_signs": len(labels - CONTROL_LABELS),
        "control_labels": sorted(labels & CONTROL_LABELS),
        "models": model_counts,
    }
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload | {"labels": f"{len(labels)} labels written to {args.output}"}, indent=2))


if __name__ == "__main__":
    main()
