import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

import torch


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


def load_metrics(metrics_name, checkpoint_name):
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
    return {
        "source": str(source),
        "checkpoint": str(checkpoint_path),
        "accuracy": float(metrics.get("accuracy") or metrics.get("best_validation_accuracy") or 0.0),
        "f1_macro": float(metrics["f1_macro"]) if metrics.get("f1_macro") is not None else None,
        "classes": int(metrics.get("classes") or 0),
        "samples": int(metrics.get("samples") or 0),
        "model_type": metrics.get("model_type"),
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
    return not reasons, reasons


def audit_registry(registry):
    policy = registry["policy"]
    tasks = {}
    for task_name, task in registry["tasks"].items():
        champion = load_metrics(task.get("active_metrics"), task["active_checkpoint"])
        candidates = []
        for candidate in task.get("candidates", []):
            challenger = load_metrics(candidate.get("metrics"), candidate["checkpoint"])
            qualified, reasons = assess_candidate(champion, challenger, policy)
            candidates.append(
                {
                    **candidate,
                    "metrics_summary": challenger,
                    "qualified": qualified,
                    "reasons": reasons,
                    "accuracy_gain": round(challenger["accuracy"] - champion["accuracy"], 4) if challenger and champion else None,
                    "f1_gain": round(challenger["f1_macro"] - champion["f1_macro"], 4)
                    if challenger and champion and challenger["f1_macro"] is not None and champion["f1_macro"] is not None
                    else None,
                }
            )
        tasks[task_name] = {
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


def main():
    parser = argparse.ArgumentParser(description="Audit and safely promote Signova sequence model challengers.")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--promote-task")
    parser.add_argument("--candidate")
    args = parser.parse_args()

    registry = load_json(args.registry)
    report = audit_registry(registry)
    save_json(args.report, report)
    promotion = None
    if args.promote_task or args.candidate:
        if not args.promote_task or not args.candidate:
            raise SystemExit("Both --promote-task and --candidate are required.")
        promotion = promote(args.registry, registry, report, args.promote_task, args.candidate)

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
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
