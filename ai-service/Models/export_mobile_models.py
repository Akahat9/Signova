"""Export only the currently approved Signova sequence checkpoints to ONNX."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
MODELS = Path(__file__).resolve().parent
sys.path.insert(0, str(MODELS))

from predict import SequenceSignPredictor  # noqa: E402


TASKS = {
    "isl": {"registry_task": "isl", "asset_name": "isl", "language": "ISL"},
    "asl_primary": {"registry_task": "asl_primary", "asset_name": "asl", "language": "ASL"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def class_names(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [str(item) for item in payload]
    if isinstance(payload, dict):
        try:
            return [str(payload[key]) for key in sorted(payload, key=lambda value: int(value))]
        except (ValueError, TypeError):
            return [str(value) for value in payload.values()]
    raise ValueError(f"Unsupported class map format: {path}")


def export(task: str, output_dir: Path, tolerance: float) -> Path:
    import onnx
    import onnxruntime as ort

    registry = json.loads((MODELS / "model_registry.json").read_text(encoding="utf-8"))
    config = TASKS[task]
    approved = registry["tasks"][config["registry_task"]]
    checkpoint_path = MODELS / approved["active_checkpoint"]
    expected_classes = class_names(MODELS / approved["class_map"])
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Approved checkpoint is not present: {checkpoint_path}")

    predictor = SequenceSignPredictor(checkpoint_path, name=config["registry_task"])
    if not predictor.available():
        raise RuntimeError(f"Approved checkpoint did not load: {checkpoint_path}")
    if predictor.classes != expected_classes:
        raise RuntimeError("Checkpoint class order does not match the registry class map.")
    if predictor.feature_size != 126 or predictor.sequence_length != 40:
        raise RuntimeError("Mobile exporter expects the approved 40-frame, 126-feature contract.")

    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"{config['asset_name']}.onnx"
    sample = torch.zeros((1, predictor.sequence_length, predictor.feature_size), dtype=torch.float32)
    predictor.model.cpu().eval()
    with torch.inference_mode():
        reference = predictor.model(sample).cpu().numpy()
    torch.onnx.export(
        predictor.model,
        sample,
        model_path,
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    graph = onnx.load(str(model_path))
    onnx.checker.check_model(graph)
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    parity_inputs = [sample.numpy()]
    random = np.random.default_rng(20261012)
    for _ in range(8):
        probe = random.uniform(-0.7, 0.7, size=(1, predictor.sequence_length, predictor.feature_size)).astype(np.float32)
        probe[random.random(probe.shape) < 0.38] = 0.0
        parity_inputs.append(probe)
    errors = []
    for probe in parity_inputs:
        with torch.inference_mode():
            expected = predictor.model(torch.from_numpy(probe)).cpu().numpy()
        actual = session.run(["logits"], {"input": probe})[0]
        errors.append(float(np.max(np.abs(expected - actual))))
    error = max(errors)
    if not np.isfinite(error) or error > tolerance:
        model_path.unlink(missing_ok=True)
        raise RuntimeError(f"ONNX/PyTorch parity failed: max_abs_error={error:.8g}, tolerance={tolerance}")

    manifest = {
        "task": task,
        "language": config["language"],
        "checkpoint": checkpoint_path.name,
        "checkpointSha256": sha256(checkpoint_path),
        "onnxSha256": sha256(model_path),
        "classMap": approved["class_map"],
        "classMapSha256": sha256(MODELS / approved["class_map"]),
        "modelType": predictor.model_type,
        "sequenceLength": predictor.sequence_length,
        "featureSize": predictor.feature_size,
        "featureNormalization": predictor.feature_normalization,
        "inputName": "input",
        "outputName": "logits",
        "opset": 17,
        "parityMaxAbsError": error,
        "parityProbeCount": len(parity_inputs),
        "classes": predictor.classes,
        "promotionState": "active-approved-checkpoint",
    }
    (output_dir / f"{config['asset_name']}.manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"asset": str(model_path), "sha256": manifest["onnxSha256"], "parityMaxAbsError": error}, indent=2))
    return model_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", required=True, choices=sorted(TASKS))
    parser.add_argument("--output-dir", type=Path, default=ROOT.parent / "mobile" / "signova_flutter" / "assets" / "models")
    parser.add_argument("--parity-tolerance", type=float, default=1e-4)
    args = parser.parse_args()
    export(args.task, args.output_dir.resolve(), args.parity_tolerance)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
