import argparse
import hashlib
import json
from pathlib import Path

try:
    from Models.assess_dataset_coverage import assess_dataset_coverage
    from Models.validate_dataset_manifest import validate_manifest_file
    from Models.validate_vocabulary_spec import validate_vocabulary_spec_file
except ModuleNotFoundError:
    from assess_dataset_coverage import assess_dataset_coverage
    from validate_dataset_manifest import validate_manifest_file
    from validate_vocabulary_spec import validate_vocabulary_spec_file


SCRIPT_DIR = Path(__file__).resolve().parent
MANDATORY_TRUE_POLICY = {
    "require_checkpoint_sha256",
    "require_dataset_manifest",
    "require_dataset_coverage",
    "require_capture_metadata",
    "require_signer_disjoint_validation",
    "require_vocabulary_spec",
}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_file(base_dir, name):
    if not name:
        return None
    path = (Path(base_dir) / name).resolve()
    return path if path.parent == Path(base_dir).resolve() else None


def assess_model_release(registry, base_dir=SCRIPT_DIR):
    base_dir = Path(base_dir)
    policy = registry.get("policy") or {}
    unsafe = [f"mandatory_policy_disabled:{field}" for field in sorted(MANDATORY_TRUE_POLICY) if policy.get(field) is not True]
    task_reports = {}
    tasks = registry.get("tasks")
    if not isinstance(tasks, dict) or not tasks:
        return {"production_ready": False, "unsafe": [*unsafe, "tasks_missing"], "tasks": {}}

    for task_name, task in tasks.items():
        reasons = []
        class_map_path = safe_file(base_dir, task.get("class_map"))
        expected_class_sha = str(task.get("class_map_sha256") or "").lower()
        if not class_map_path or not class_map_path.is_file():
            reasons.append("class_map_missing")
        elif sha256_file(class_map_path) != expected_class_sha:
            reasons.append("class_map_sha256_mismatch")
            unsafe.append(f"class_map_sha256_mismatch:{task_name}")

        spec_path = safe_file(base_dir, task.get("vocabulary_spec"))
        expected_spec_sha = str(task.get("vocabulary_spec_sha256") or "").lower()
        if not spec_path or not class_map_path:
            reasons.append("vocabulary_spec_missing")
        else:
            spec_report = validate_vocabulary_spec_file(
                spec_path,
                class_map_path,
                expected_task=task_name,
                expected_class_map_sha256=expected_class_sha,
            )
            reasons.extend(spec_report.get("errors", []))
            if not spec_path.is_file() or sha256_file(spec_path) != expected_spec_sha:
                reasons.append("vocabulary_spec_sha256_missing_or_mismatch")

        checkpoint_path = safe_file(base_dir, task.get("active_checkpoint"))
        expected_checkpoint_sha = str(task.get("active_sha256") or "").lower()
        if not checkpoint_path or not checkpoint_path.is_file():
            reasons.append("active_checkpoint_missing")
        elif sha256_file(checkpoint_path) != expected_checkpoint_sha:
            reasons.append("active_checkpoint_sha256_missing_or_mismatch")

        metrics_path = safe_file(base_dir, task.get("active_metrics"))
        metrics = None
        if not metrics_path or not metrics_path.is_file():
            reasons.append("active_metrics_missing")
        else:
            try:
                metrics = load_json(metrics_path)
            except (OSError, json.JSONDecodeError):
                reasons.append("active_metrics_invalid")
        if metrics is not None:
            f1 = metrics.get("f1_macro")
            unknown_recall = metrics.get("unknown_recall")
            false_accept = metrics.get("unknown_false_accept_rate")
            samples = int(metrics.get("samples") or 0)
            if f1 is None or float(f1) < float(policy.get("minimum_f1_macro", 0)):
                reasons.append("active_f1_below_policy")
            if unknown_recall is None or float(unknown_recall) < float(policy.get("minimum_unknown_recall", 0)):
                reasons.append("active_unknown_recall_below_policy")
            if false_accept is None or float(false_accept) > float(policy.get("maximum_unknown_false_accept_rate", 1)):
                reasons.append("active_unknown_false_accept_rate_above_policy")
            if samples < int(policy.get("minimum_validation_samples", 0)):
                reasons.append("active_validation_samples_below_policy")
            if policy.get("require_signer_disjoint_validation") and metrics.get("signer_disjoint_validation") is not True:
                reasons.append("active_signer_disjoint_validation_required")

        manifest_path = safe_file(base_dir, task.get("active_dataset_manifest"))
        expected_manifest_sha = str(task.get("active_dataset_manifest_sha256") or "").lower()
        if not manifest_path or not manifest_path.is_file():
            reasons.append("active_dataset_manifest_missing")
        else:
            manifest_report = validate_manifest_file(manifest_path)
            reasons.extend(manifest_report.get("errors", []))
            manifest = load_json(manifest_path) if manifest_report.get("valid") else None
            if manifest:
                coverage = assess_dataset_coverage(manifest, policy)
                reasons.extend(f"dataset_coverage:{reason}" for reason in coverage.get("reasons", []))
            if sha256_file(manifest_path) != expected_manifest_sha:
                reasons.append("active_dataset_manifest_sha256_missing_or_mismatch")

        reasons = sorted(set(reasons))
        task_reports[task_name] = {"ready": not reasons, "reasons": reasons}

    unsafe = sorted(set(unsafe))
    return {
        "production_ready": not unsafe and all(item["ready"] for item in task_reports.values()),
        "unsafe": unsafe,
        "tasks": task_reports,
    }


def main():
    parser = argparse.ArgumentParser(description="Check whether active Signova models have complete production release evidence.")
    parser.add_argument("--registry", type=Path, default=SCRIPT_DIR / "model_registry.json")
    parser.add_argument("--output", type=Path, default=SCRIPT_DIR / "model_release_readiness.json")
    parser.add_argument("--fail-on-unsafe", action="store_true")
    parser.add_argument("--require-ready", action="store_true")
    args = parser.parse_args()
    registry = load_json(args.registry)
    report = assess_model_release(registry, args.registry.resolve().parent)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if args.fail_on_unsafe and report["unsafe"]:
        raise SystemExit(1)
    if args.require_ready and not report["production_ready"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
