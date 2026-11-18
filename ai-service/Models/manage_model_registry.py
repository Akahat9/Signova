import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil

import torch

try:
    from Models.validate_dataset_manifest import validate_manifest_file
    from Models.assess_dataset_coverage import assess_dataset_coverage
    from Models.validate_vocabulary_spec import validate_vocabulary_spec_file
except ModuleNotFoundError:  # Direct execution from Models/manage_model_registry.py.
    from validate_dataset_manifest import validate_manifest_file
    from assess_dataset_coverage import assess_dataset_coverage
    from validate_vocabulary_spec import validate_vocabulary_spec_file


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_REGISTRY = SCRIPT_DIR / "model_registry.json"
DEFAULT_REPORT = SCRIPT_DIR / "model_promotion_report.json"
ROLLBACK_DIR = SCRIPT_DIR / "rollback"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_metrics(metrics_name, checkpoint_name, expected_sha256=None):
    metrics_path = SCRIPT_DIR / metrics_name if metrics_name else None
    checkpoint_path = SCRIPT_DIR / checkpoint_name
    if metrics_path and metrics_path.is_file():
        metrics = load_json(metrics_path)
        source = metrics_path
    elif checkpoint_path.is_file():
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        metrics = checkpoint.get("metrics") or {
            "accuracy": checkpoint.get("val_accuracy"),
            "f1_macro": None,
            "classes": len(checkpoint.get("classes") or []),
            "samples": None,
        }
        source = checkpoint_path
    else:
        return None
    actual_sha256 = sha256_file(checkpoint_path) if checkpoint_path.is_file() else None
    return {
        "source": str(source),
        "checkpoint": str(checkpoint_path),
        "accuracy": float(metrics.get("accuracy") or metrics.get("best_validation_accuracy") or 0.0),
        "f1_macro": float(metrics["f1_macro"]) if metrics.get("f1_macro") is not None else None,
        "classes": int(metrics.get("classes") or 0),
        "samples": int(metrics.get("samples") or 0),
        "model_type": metrics.get("model_type"),
        "unknown_recall": float(metrics["unknown_recall"]) if metrics.get("unknown_recall") is not None else None,
        "unknown_false_accept_rate": float(metrics["unknown_false_accept_rate"])
        if metrics.get("unknown_false_accept_rate") is not None else None,
        "signer_disjoint_validation": metrics.get("signer_disjoint_validation") is True,
        "expected_sha256": expected_sha256,
        "actual_sha256": actual_sha256,
        "checksum_valid": bool(expected_sha256 and actual_sha256 and expected_sha256.lower() == actual_sha256.lower()),
    }


def assess_candidate(champion, challenger, policy):
    reasons = []
    if challenger is None:
        return False, ["challenger_artifact_missing"]
    if champion is None:
        return False, ["active_champion_artifact_missing"]
    if not Path(challenger["checkpoint"]).is_file():
        reasons.append("challenger_checkpoint_missing")
    if challenger["samples"] < int(policy["minimum_validation_samples"]):
        reasons.append(f"validation_samples_below_{policy['minimum_validation_samples']}")
    if policy.get("require_equal_or_wider_vocabulary") and challenger["classes"] < champion["classes"]:
        reasons.append("vocabulary_regression")
    accuracy_gain = challenger["accuracy"] - champion["accuracy"]
    if accuracy_gain < float(policy["minimum_accuracy_gain"]):
        reasons.append(f"accuracy_gain_below_{policy['minimum_accuracy_gain']}")
    if champion["f1_macro"] is not None and challenger["f1_macro"] is not None:
        f1_regression = champion["f1_macro"] - challenger["f1_macro"]
        if f1_regression > float(policy["maximum_f1_regression"]):
            reasons.append(f"f1_regression_above_{policy['maximum_f1_regression']}")
    if challenger["f1_macro"] is None or challenger["f1_macro"] < float(policy.get("minimum_f1_macro", 0.0)):
        reasons.append(f"f1_macro_below_{policy.get('minimum_f1_macro', 0.0)}")
    if challenger["unknown_recall"] is None or challenger["unknown_recall"] < float(policy.get("minimum_unknown_recall", 0.0)):
        reasons.append(f"unknown_recall_below_{policy.get('minimum_unknown_recall', 0.0)}")
    if (
        challenger["unknown_false_accept_rate"] is None
        or challenger["unknown_false_accept_rate"] > float(policy.get("maximum_unknown_false_accept_rate", 1.0))
    ):
        reasons.append(f"unknown_false_accept_rate_above_{policy.get('maximum_unknown_false_accept_rate', 1.0)}")
    if policy.get("require_signer_disjoint_validation") and not challenger["signer_disjoint_validation"]:
        reasons.append("signer_disjoint_validation_required")
    if policy.get("require_checkpoint_sha256") and not challenger["checksum_valid"]:
        reasons.append("checkpoint_sha256_missing_or_mismatch")
    return not reasons, reasons


def validate_vocabulary(task):
    name = task.get("class_map")
    expected = task.get("class_map_sha256")
    path = (SCRIPT_DIR / name).resolve() if name else None
    valid_path = bool(path and path.parent == SCRIPT_DIR.resolve() and path.is_file())
    actual = sha256_file(path) if valid_path else None
    return {
        "class_map": name,
        "expected_sha256": expected,
        "actual_sha256": actual,
        "valid": bool(expected and actual and expected.lower() == actual.lower()),
    }


def validate_task_vocabulary_spec(task_name, task):
    spec_name = task.get("vocabulary_spec")
    expected_spec_sha256 = task.get("vocabulary_spec_sha256")
    class_map_name = task.get("class_map")
    if not spec_name:
        return {"valid": False, "errors": ["vocabulary_spec_missing"]}
    spec_path = (SCRIPT_DIR / spec_name).resolve()
    class_map_path = (SCRIPT_DIR / class_map_name).resolve() if class_map_name else None
    if spec_path.parent != SCRIPT_DIR.resolve() or not class_map_path or class_map_path.parent != SCRIPT_DIR.resolve():
        return {"valid": False, "errors": ["vocabulary_spec_path_invalid"]}
    report = validate_vocabulary_spec_file(
        spec_path,
        class_map_path,
        expected_task=task_name,
        expected_class_map_sha256=task.get("class_map_sha256"),
    )
    actual_spec_sha256 = sha256_file(spec_path) if spec_path.is_file() else None
    report["expected_sha256"] = expected_spec_sha256
    report["actual_sha256"] = actual_spec_sha256
    if not expected_spec_sha256 or not actual_spec_sha256 or expected_spec_sha256.lower() != actual_spec_sha256.lower():
        report["valid"] = False
        report.setdefault("errors", []).append("vocabulary_spec_sha256_missing_or_mismatch")
    report["errors"] = sorted(set(report.get("errors", [])))
    return report


def validate_candidate_dataset(candidate, policy=None):
    manifest_name = candidate.get("dataset_manifest")
    expected_sha256 = candidate.get("dataset_manifest_sha256")
    if not manifest_name:
        return {"valid": False, "errors": ["dataset_manifest_missing"]}
    manifest_path = (SCRIPT_DIR / manifest_name).resolve()
    if manifest_path.parent != SCRIPT_DIR.resolve():
        return {"valid": False, "errors": ["dataset_manifest_path_invalid"]}
    report = validate_manifest_file(manifest_path)
    if manifest_path.is_file():
        coverage = assess_dataset_coverage(load_json(manifest_path), policy or {})
        report["coverage"] = coverage
        if (policy or {}).get("require_dataset_coverage") and not coverage["ready"]:
            report["valid"] = False
            report.setdefault("errors", []).extend(f"dataset_coverage:{reason}" for reason in coverage["reasons"])
    actual_sha256 = sha256_file(manifest_path) if manifest_path.is_file() else None
    report["expected_sha256"] = expected_sha256
    report["actual_sha256"] = actual_sha256
    if not expected_sha256 or not actual_sha256 or expected_sha256.lower() != actual_sha256.lower():
        report["valid"] = False
        report.setdefault("errors", []).append("dataset_manifest_sha256_missing_or_mismatch")
    return report


def audit_registry(registry):
    policy = registry["policy"]
    tasks = {}
    for task_name, task in registry["tasks"].items():
        vocabulary = validate_vocabulary(task)
        vocabulary_spec = validate_task_vocabulary_spec(task_name, task)
        champion = load_metrics(task.get("active_metrics"), task["active_checkpoint"], task.get("active_sha256"))
        candidates = []
        for candidate in task.get("candidates", []):
            challenger = load_metrics(candidate.get("metrics"), candidate["checkpoint"], candidate.get("sha256"))
            qualified, reasons = assess_candidate(champion, challenger, policy)
            dataset_manifest = validate_candidate_dataset(candidate, policy)
            if policy.get("require_dataset_manifest") and not dataset_manifest["valid"]:
                qualified = False
                reasons.extend(dataset_manifest["errors"])
            if not vocabulary["valid"]:
                qualified = False
                reasons.append("class_map_sha256_missing_or_mismatch")
            if policy.get("require_vocabulary_spec") and not vocabulary_spec["valid"]:
                qualified = False
                reasons.extend(vocabulary_spec["errors"])
            candidates.append(
                {
                    **candidate,
                    "metrics_summary": challenger,
                    "dataset_manifest": dataset_manifest,
                    "qualified": qualified,
                    "reasons": reasons,
                    "accuracy_gain": round(challenger["accuracy"] - champion["accuracy"], 4) if challenger and champion else None,
                    "f1_gain": round(challenger["f1_macro"] - champion["f1_macro"], 4)
                    if challenger and champion and challenger["f1_macro"] is not None and champion["f1_macro"] is not None
                    else None,
                }
            )
        tasks[task_name] = {
            "vocabulary": vocabulary,
            "vocabulary_spec": vocabulary_spec,
            "champion": champion,
            "candidates": candidates,
            "qualified_candidates": [candidate["id"] for candidate in candidates if candidate["qualified"]],
        }
    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "policy": policy,
        "tasks": tasks,
    }


def promote(registry_path, registry, report, task_name, candidate_id):
    task = registry["tasks"].get(task_name)
    if not task:
        raise SystemExit(f"Unknown task: {task_name}")
    assessed = next((item for item in report["tasks"][task_name]["candidates"] if item["id"] == candidate_id), None)
    if not assessed:
        raise SystemExit(f"Unknown candidate for {task_name}: {candidate_id}")
    if not assessed["qualified"]:
        raise SystemExit(f"Promotion blocked: {', '.join(assessed['reasons'])}")

    candidate = next(item for item in task["candidates"] if item["id"] == candidate_id)
    active_checkpoint = SCRIPT_DIR / task["active_checkpoint"]
    active_metrics = SCRIPT_DIR / task["active_metrics"] if task.get("active_metrics") else None
    candidate_checkpoint = SCRIPT_DIR / candidate["checkpoint"]
    candidate_metrics = SCRIPT_DIR / candidate["metrics"] if candidate.get("metrics") else None
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    rollback_task_dir = ROLLBACK_DIR / task_name / timestamp
    rollback_task_dir.mkdir(parents=True, exist_ok=True)
    if active_checkpoint.is_file():
        shutil.copy2(active_checkpoint, rollback_task_dir / active_checkpoint.name)
    if active_metrics and active_metrics.is_file():
        shutil.copy2(active_metrics, rollback_task_dir / active_metrics.name)

    shutil.copy2(candidate_checkpoint, active_checkpoint)
    if candidate_metrics and active_metrics:
        shutil.copy2(candidate_metrics, active_metrics)
    task["last_promotion"] = {
        "candidate_id": candidate_id,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "rollback_dir": str(rollback_task_dir),
    }
    save_json(registry_path, registry)
    return task["last_promotion"]


def stage_canary(registry_path, registry, report, task_name, candidate_id):
    task = registry["tasks"].get(task_name)
    if not task:
        raise SystemExit(f"Unknown task: {task_name}")
    assessed = next((item for item in report["tasks"][task_name]["candidates"] if item["id"] == candidate_id), None)
    if not assessed or not assessed["qualified"]:
        reasons = assessed["reasons"] if assessed else ["candidate_not_registered"]
        raise SystemExit(f"Canary staging blocked: {', '.join(reasons)}")
    candidate = next(item for item in task["candidates"] if item["id"] == candidate_id)
    task["canary"] = {
        "candidate_id": candidate_id,
        "checkpoint": candidate["checkpoint"],
        "sha256": candidate.get("sha256"),
        "staged_at": datetime.now(timezone.utc).isoformat(),
        "activation": "Set SIGNOVA_MODEL_CHANNEL=canary on dedicated canary instances.",
    }
    save_json(registry_path, registry)
    return task["canary"]


def rollback(registry_path, registry, task_name, rollback_dir):
    task = registry["tasks"].get(task_name)
    if not task:
        raise SystemExit(f"Unknown task: {task_name}")
    source = Path(rollback_dir).resolve()
    checkpoint_source = source / Path(task["active_checkpoint"]).name
    metrics_source = source / Path(task["active_metrics"]).name if task.get("active_metrics") else None
    if not checkpoint_source.is_file():
        raise SystemExit(f"Rollback checkpoint missing: {checkpoint_source}")
    shutil.copy2(checkpoint_source, SCRIPT_DIR / task["active_checkpoint"])
    if metrics_source and metrics_source.is_file():
        shutil.copy2(metrics_source, SCRIPT_DIR / task["active_metrics"])
    task["last_rollback"] = {"restored_at": datetime.now(timezone.utc).isoformat(), "source": str(source)}
    task.pop("canary", None)
    save_json(registry_path, registry)
    return task["last_rollback"]


def main():
    parser = argparse.ArgumentParser(description="Audit and safely promote Signova sequence model challengers.")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--promote-task")
    parser.add_argument("--candidate")
    parser.add_argument("--stage-canary-task")
    parser.add_argument("--rollback-task")
    parser.add_argument("--rollback-dir", type=Path)
    args = parser.parse_args()

    registry = load_json(args.registry)
    report = audit_registry(registry)
    save_json(args.report, report)
    promotion = None
    canary = None
    rollback_result = None
    if args.promote_task or args.candidate:
        if not args.promote_task or not args.candidate:
            raise SystemExit("Both --promote-task and --candidate are required.")
        promotion = promote(args.registry, registry, report, args.promote_task, args.candidate)
    if args.stage_canary_task:
        if not args.candidate:
            raise SystemExit("--candidate is required with --stage-canary-task.")
        canary = stage_canary(args.registry, registry, report, args.stage_canary_task, args.candidate)
    if args.rollback_task or args.rollback_dir:
        if not args.rollback_task or not args.rollback_dir:
            raise SystemExit("Both --rollback-task and --rollback-dir are required.")
        rollback_result = rollback(args.registry, registry, args.rollback_task, args.rollback_dir)

    summary = {
        "report": str(args.report),
        "tasks": {
            name: {
                "champion_accuracy": item["champion"]["accuracy"] if item["champion"] else None,
                "champion_f1": item["champion"]["f1_macro"] if item["champion"] else None,
                "qualified_candidates": item["qualified_candidates"],
                "candidates": [
                    {
                        "id": candidate["id"],
                        "qualified": candidate["qualified"],
                        "accuracy_gain": candidate["accuracy_gain"],
                        "f1_gain": candidate["f1_gain"],
                        "reasons": candidate["reasons"],
                    }
                    for candidate in item["candidates"]
                ],
            }
            for name, item in report["tasks"].items()
        },
        "promotion": promotion,
        "canary": canary,
        "rollback": rollback_result,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
