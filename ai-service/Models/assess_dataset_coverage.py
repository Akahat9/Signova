from collections import Counter, defaultdict


CAPTURE_FIELDS = ("lighting", "background", "handedness", "device_class")


def assess_dataset_coverage(manifest, policy):
    signers = {item.get("signer_id"): item for item in manifest.get("signers", []) if isinstance(item, dict)}
    samples = [item for item in manifest.get("samples", []) if isinstance(item, dict)]
    split_signers = defaultdict(set)
    label_train_signers = defaultdict(set)
    capture_values = {field: set() for field in CAPTURE_FIELDS}
    diversity_groups = set()
    missing_capture = Counter()

    for signer in signers.values():
        for group in signer.get("diversity_groups") or []:
            if isinstance(group, str) and group.strip():
                diversity_groups.add(group.strip())
    for sample in samples:
        split = str(sample.get("split") or "").lower()
        signer_id = sample.get("signer_id")
        split_signers[split].add(signer_id)
        if split == "train":
            label_train_signers[str(sample.get("label") or "")].add(signer_id)
        capture = sample.get("capture") if isinstance(sample.get("capture"), dict) else {}
        for field in CAPTURE_FIELDS:
            value = str(capture.get(field) or "").strip().lower()
            if value:
                capture_values[field].add(value)
            else:
                missing_capture[field] += 1

    reasons = []
    minimum_split = int(policy.get("minimum_signers_per_split", 1))
    for split in ("train", "validation", "test"):
        if len(split_signers[split]) < minimum_split:
            reasons.append(f"{split}_signers_below_{minimum_split}")
    minimum_label_signers = int(policy.get("minimum_train_signers_per_label", 1))
    for label, values in sorted(label_train_signers.items()):
        if len(values) < minimum_label_signers:
            reasons.append(f"train_signers_below_{minimum_label_signers}:{label}")
    minimum_diversity = int(policy.get("minimum_diversity_groups", 0))
    if len(diversity_groups) < minimum_diversity:
        reasons.append(f"diversity_groups_below_{minimum_diversity}")
    for field in CAPTURE_FIELDS:
        minimum = int(policy.get(f"minimum_{field}_categories", 0))
        if len(capture_values[field]) < minimum:
            reasons.append(f"{field}_categories_below_{minimum}")
        if policy.get("require_capture_metadata") and missing_capture[field]:
            reasons.append(f"missing_{field}_metadata:{missing_capture[field]}")

    return {
        "ready": not reasons,
        "reasons": reasons,
        "signers_per_split": {split: len(split_signers[split]) for split in ("train", "validation", "test")},
        "minimum_train_signers_by_label": min((len(value) for value in label_train_signers.values()), default=0),
        "diversity_groups": sorted(diversity_groups),
        "capture_categories": {field: sorted(values) for field, values in capture_values.items()},
    }

