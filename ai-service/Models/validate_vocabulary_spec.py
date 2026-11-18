import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re


SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
ALLOWED_LANGUAGES = {"ASL", "ISL", "mixed", "control"}
ALLOWED_SIGN_TYPES = {"static", "dynamic", "sentence", "control"}
ALLOWED_DOMINANT_HANDS = {"left", "right", "either", "both", "not_applicable"}
REQUIRED_LABEL_TEXT = {
    "display_name": 120,
    "handshape": 500,
    "palm_orientation": 300,
    "location": 300,
    "movement": 500,
    "non_manual_markers": 500,
    "start_pose": 500,
    "end_pose": 500,
    "disambiguation_notes": 1000,
}
TOP_LEVEL_FIELDS = {
    "schema_version", "task", "class_map_sha256", "review_status",
    "reviewed_by_role", "reviewed_at", "sources", "labels",
}
SOURCE_FIELDS = {"id", "title", "publisher", "version_or_date"}
LABEL_FIELDS = {
    "label", "display_name", "language", "sign_type", "dominant_hand",
    *REQUIRED_LABEL_TEXT.keys(), "minimum_frames", "maximum_frames",
    "known_confusions", "source_reference_ids", "review_status",
}


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_class_labels(class_map):
    if not isinstance(class_map, dict) or not class_map:
        return None
    try:
        indices = sorted(int(key) for key in class_map)
    except (TypeError, ValueError):
        return None
    if indices != list(range(len(indices))):
        return None
    labels = [str(class_map[str(index)]).strip() for index in indices]
    return labels if all(labels) and len(labels) == len(set(labels)) else None


def _valid_timestamp(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.tzinfo is not None and parsed.utcoffset() is not None
    except (TypeError, ValueError):
        return False


def validate_vocabulary_spec(spec, class_map, *, expected_task=None, expected_class_map_sha256=None):
    errors = []
    labels = _load_class_labels(class_map)
    if labels is None:
        return {"valid": False, "errors": ["class_map_invalid"], "label_count": 0}
    label_set = set(labels)
    for field in sorted(set(spec) - TOP_LEVEL_FIELDS):
        errors.append(f"unknown_top_level_field:{field}")
    if spec.get("schema_version") != 1:
        errors.append("schema_version_must_be_1")
    task = str(spec.get("task") or "")
    if expected_task and task != expected_task:
        errors.append("task_mismatch")
    class_digest = str(spec.get("class_map_sha256") or "").lower()
    if not SHA256_PATTERN.fullmatch(class_digest):
        errors.append("class_map_sha256_invalid")
    if expected_class_map_sha256 and class_digest != expected_class_map_sha256.lower():
        errors.append("class_map_sha256_mismatch")
    if spec.get("review_status") != "approved":
        errors.append("expert_approval_required")
    if not ID_PATTERN.fullmatch(str(spec.get("reviewed_by_role") or "")):
        errors.append("reviewed_by_role_required")
    if not _valid_timestamp(spec.get("reviewed_at")):
        errors.append("reviewed_at_invalid")

    sources = spec.get("sources")
    if not isinstance(sources, list) or not sources:
        errors.append("sources_required")
        sources = []
    source_ids = set()
    for source in sources:
        if not isinstance(source, dict):
            errors.append("source_must_be_object")
            continue
        for field in sorted(set(source) - SOURCE_FIELDS):
            errors.append(f"unknown_source_field:{field}")
        source_id = str(source.get("id") or "")
        if not ID_PATTERN.fullmatch(source_id) or source_id in source_ids:
            errors.append(f"source_id_invalid_or_duplicate:{source_id or '<empty>'}")
        source_ids.add(source_id)
        for field in ("title", "publisher", "version_or_date"):
            value = str(source.get(field) or "").strip()
            if not value or len(value) > 300:
                errors.append(f"source_{field}_invalid:{source_id or '<empty>'}")

    definitions = spec.get("labels")
    if not isinstance(definitions, list):
        errors.append("labels_required")
        definitions = []
    definition_names = [str(item.get("label") or "") for item in definitions if isinstance(item, dict)]
    for duplicate in sorted({name for name in definition_names if definition_names.count(name) > 1}):
        errors.append(f"duplicate_label:{duplicate}")
    missing = sorted(label_set - set(definition_names))
    extra = sorted(set(definition_names) - label_set)
    errors.extend(f"label_missing:{label}" for label in missing)
    errors.extend(f"unknown_label:{label}" for label in extra)

    for item in definitions:
        if not isinstance(item, dict):
            errors.append("label_definition_must_be_object")
            continue
        label = str(item.get("label") or "")
        prefix = label or "<empty>"
        for field in sorted(set(item) - LABEL_FIELDS):
            errors.append(f"unknown_label_field:{prefix}:{field}")
        if label not in label_set:
            continue
        if item.get("review_status") != "approved":
            errors.append(f"label_expert_approval_required:{prefix}")
        if item.get("language") not in ALLOWED_LANGUAGES:
            errors.append(f"invalid_language:{prefix}")
        if item.get("sign_type") not in ALLOWED_SIGN_TYPES:
            errors.append(f"invalid_sign_type:{prefix}")
        if item.get("dominant_hand") not in ALLOWED_DOMINANT_HANDS:
            errors.append(f"invalid_dominant_hand:{prefix}")
        for field, maximum in REQUIRED_LABEL_TEXT.items():
            value = str(item.get(field) or "").strip()
            if not value or len(value) > maximum:
                errors.append(f"invalid_{field}:{prefix}")
        minimum_frames = item.get("minimum_frames")
        maximum_frames = item.get("maximum_frames")
        if not isinstance(minimum_frames, int) or minimum_frames < 1:
            errors.append(f"invalid_minimum_frames:{prefix}")
        if not isinstance(maximum_frames, int) or not isinstance(minimum_frames, int) or maximum_frames < minimum_frames or maximum_frames > 600:
            errors.append(f"invalid_maximum_frames:{prefix}")
        confusions = item.get("known_confusions")
        if not isinstance(confusions, list):
            errors.append(f"known_confusions_must_be_list:{prefix}")
        else:
            for confused in confusions:
                if confused == label or confused not in label_set | {"unknown", "no_gesture"}:
                    errors.append(f"invalid_known_confusion:{prefix}:{confused}")
        references = item.get("source_reference_ids")
        if not isinstance(references, list) or not references:
            errors.append(f"source_references_required:{prefix}")
        else:
            for source_id in references:
                if source_id not in source_ids:
                    errors.append(f"unknown_source_reference:{prefix}:{source_id}")

    unique_errors = sorted(set(errors))
    return {
        "valid": not unique_errors,
        "errors": unique_errors,
        "task": task,
        "label_count": len(labels),
        "defined_label_count": len(set(definition_names) & label_set),
        "complete_coverage": not missing and not extra,
    }


def validate_vocabulary_spec_file(spec_path, class_map_path, *, expected_task=None, expected_class_map_sha256=None):
    spec_path = Path(spec_path)
    class_map_path = Path(class_map_path)
    if not spec_path.is_file():
        return {"valid": False, "errors": ["vocabulary_spec_missing"], "path": str(spec_path)}
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        class_map = json.loads(class_map_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"valid": False, "errors": ["vocabulary_spec_or_class_map_invalid_json"], "path": str(spec_path)}
    report = validate_vocabulary_spec(
        spec,
        class_map,
        expected_task=expected_task,
        expected_class_map_sha256=expected_class_map_sha256,
    )
    report["path"] = str(spec_path)
    return report


def main():
    parser = argparse.ArgumentParser(description="Validate expert-reviewed Signova per-label vocabulary specifications.")
    parser.add_argument("spec", type=Path)
    parser.add_argument("class_map", type=Path)
    parser.add_argument("--task")
    parser.add_argument("--class-map-sha256")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = validate_vocabulary_spec_file(
        args.spec,
        args.class_map,
        expected_task=args.task,
        expected_class_map_sha256=args.class_map_sha256,
    )
    payload = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload)
    if not report["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
