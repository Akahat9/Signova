import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path, PurePosixPath
import re


ALLOWED_SPLITS = {"train", "validation", "test"}
FORBIDDEN_IDENTITY_KEYS = {"name", "email", "phone", "address", "date_of_birth", "dob"}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
DIVERSITY_GROUP_PATTERN = re.compile(
    r"^(age-(youth|young-adult|adult|senior)|skin-tone-group-[a-f]|"
    r"mobility-(typical|limited)|signing-experience-(beginner|intermediate|advanced|native))$"
)
CAPTURE_TAXONOMY = {
    "lighting": {"daylight", "indoor", "low-light", "backlit"},
    "background": {"plain", "cluttered", "outdoor"},
    "handedness": {"left", "right", "ambidextrous"},
    "device_class": {"mobile", "desktop", "tablet"},
}


def _duplicate_values(values):
    counts = Counter(values)
    return sorted(value for value, count in counts.items() if count > 1)


def validate_manifest(manifest):
    errors = []
    if manifest.get("schema_version") != 1:
        errors.append("schema_version_must_be_1")
    for field in ("dataset_id", "task", "created_at"):
        if not str(manifest.get(field) or "").strip():
            errors.append(f"{field}_required")

    signers = manifest.get("signers")
    samples = manifest.get("samples")
    if not isinstance(signers, list) or not signers:
        errors.append("signers_required")
        signers = []
    if not isinstance(samples, list) or not samples:
        errors.append("samples_required")
        samples = []

    signer_ids = [str(item.get("signer_id") or "") for item in signers if isinstance(item, dict)]
    for duplicate in _duplicate_values(signer_ids):
        errors.append(f"duplicate_signer_id:{duplicate}")
    signer_map = {str(item.get("signer_id") or ""): item for item in signers if isinstance(item, dict)}
    for signer_id, signer in signer_map.items():
        if not ID_PATTERN.fullmatch(signer_id):
            errors.append(f"invalid_signer_id:{signer_id or '<empty>'}")
        if not str(signer.get("consent_record_id") or "").strip():
            errors.append(f"consent_record_required:{signer_id}")
        if signer.get("consent_for_training") is not True:
            errors.append(f"training_consent_required:{signer_id}")
        if not str(signer.get("consent_version") or "").strip():
            errors.append(f"consent_version_required:{signer_id}")
        diversity_groups = signer.get("diversity_groups", [])
        if not isinstance(diversity_groups, list):
            errors.append(f"diversity_groups_must_be_list:{signer_id}")
        else:
            for group in diversity_groups:
                if not isinstance(group, str) or not DIVERSITY_GROUP_PATTERN.fullmatch(group):
                    errors.append(f"invalid_diversity_group:{signer_id}:{group}")
        forbidden = FORBIDDEN_IDENTITY_KEYS.intersection(signer)
        if forbidden:
            errors.append(f"raw_identity_fields_forbidden:{signer_id}:{','.join(sorted(forbidden))}")

    sample_ids = [str(item.get("sample_id") or "") for item in samples if isinstance(item, dict)]
    for duplicate in _duplicate_values(sample_ids):
        errors.append(f"duplicate_sample_id:{duplicate}")

    split_signers = defaultdict(set)
    split_labels = defaultdict(set)
    split_counts = Counter()
    for sample in samples:
        if not isinstance(sample, dict):
            errors.append("sample_must_be_object")
            continue
        sample_id = str(sample.get("sample_id") or "")
        signer_id = str(sample.get("signer_id") or "")
        label = str(sample.get("label") or "").strip()
        split = str(sample.get("split") or "").lower()
        digest = str(sample.get("sha256") or "").lower()
        relative_path = str(sample.get("relative_path") or "")
        if not ID_PATTERN.fullmatch(sample_id):
            errors.append(f"invalid_sample_id:{sample_id or '<empty>'}")
        if signer_id not in signer_map:
            errors.append(f"unknown_signer:{sample_id}:{signer_id or '<empty>'}")
        if not label:
            errors.append(f"label_required:{sample_id}")
        if split not in ALLOWED_SPLITS:
            errors.append(f"invalid_split:{sample_id}:{split or '<empty>'}")
        if not SHA256_PATTERN.fullmatch(digest):
            errors.append(f"invalid_sha256:{sample_id}")
        path = PurePosixPath(relative_path.replace("\\", "/"))
        if not relative_path or path.is_absolute() or ".." in path.parts:
            errors.append(f"unsafe_relative_path:{sample_id}")
        forbidden = FORBIDDEN_IDENTITY_KEYS.intersection(sample)
        if forbidden:
            errors.append(f"raw_identity_fields_forbidden:{sample_id}:{','.join(sorted(forbidden))}")
        capture = sample.get("capture")
        if capture is not None:
            if not isinstance(capture, dict):
                errors.append(f"capture_must_be_object:{sample_id}")
            else:
                unknown_capture_fields = set(capture) - set(CAPTURE_TAXONOMY)
                if unknown_capture_fields:
                    errors.append(f"unknown_capture_fields:{sample_id}:{','.join(sorted(unknown_capture_fields))}")
                for field, allowed in CAPTURE_TAXONOMY.items():
                    if field in capture and str(capture[field]).lower() not in allowed:
                        errors.append(f"invalid_capture_value:{sample_id}:{field}:{capture[field]}")
        if split in ALLOWED_SPLITS:
            split_signers[split].add(signer_id)
            split_labels[split].add(label)
            split_counts[split] += 1

    for split in sorted(ALLOWED_SPLITS):
        if split_counts[split] == 0:
            errors.append(f"split_empty:{split}")
    signer_splits = defaultdict(set)
    for split, values in split_signers.items():
        for signer_id in values:
            signer_splits[signer_id].add(split)
    for signer_id, splits in signer_splits.items():
        if len(splits) > 1:
            errors.append(f"signer_split_leakage:{signer_id}:{','.join(sorted(splits))}")
    train_labels = split_labels["train"]
    for split in ("validation", "test"):
        for label in sorted(split_labels[split] - train_labels):
            errors.append(f"label_missing_from_train:{split}:{label}")

    unique_errors = sorted(set(errors))
    return {
        "valid": not unique_errors,
        "errors": unique_errors,
        "dataset_id": manifest.get("dataset_id"),
        "task": manifest.get("task"),
        "counts": {
            "signers": len(signer_map),
            "samples": len(samples),
            "splits": {split: split_counts[split] for split in sorted(ALLOWED_SPLITS)},
        },
        "signer_disjoint": not any(error.startswith("signer_split_leakage:") for error in unique_errors),
    }


def validate_manifest_file(path):
    path = Path(path)
    if not path.is_file():
        return {"valid": False, "errors": ["dataset_manifest_missing"], "path": str(path)}
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"valid": False, "errors": ["dataset_manifest_invalid_json"], "path": str(path)}
    report = validate_manifest(manifest)
    report["path"] = str(path)
    return report


def main():
    parser = argparse.ArgumentParser(description="Validate a consent-aware, signer-disjoint Signova dataset manifest.")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = validate_manifest_file(args.manifest)
    payload = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload)
    if not report["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
