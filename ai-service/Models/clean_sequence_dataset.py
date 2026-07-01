import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(description="Audit and clean a Signova landmark sequence dataset.")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--min-samples-per-class", type=int, default=5)
    parser.add_argument("--max-classes", type=int, default=0)
    parser.add_argument("--min-nonzero-frames", type=int, default=4)
    parser.add_argument("--min-motion", type=float, default=0.0, help="Reject sequences with mean frame-to-frame motion below this value.")
    parser.add_argument("--near-duplicate-distance", type=float, default=0.0, help="Within-class normalized RMS distance used to reject near duplicates. Zero disables it.")
    parser.add_argument("--outlier-zscore", type=float, default=0.0, help="Reject class outliers using a robust MAD z-score. Zero disables it.")
    parser.add_argument("--exclude-sources", nargs="*", default=[])
    parser.add_argument("--source-class-limits", nargs="*", default=[], help="Optional source=count class quotas, for example ASL_Citizen=80 ISL_CSLRT=30.")
    return parser.parse_args()


def load_manifest(dataset_path):
    path = dataset_path.parent / "sequence_manifest.json"
    if not path.is_file():
        return {}, []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload, payload.get("metadata") or []


def normalized_rms_distance(left, right):
    left = np.asarray(left, dtype=np.float32)
    right = np.asarray(right, dtype=np.float32)
    scale = max(float(np.std(left)), float(np.std(right)), 1e-6)
    return float(np.sqrt(np.mean(np.square(left - right))) / scale)


def sequence_motion(sequence):
    frames = np.asarray(sequence, dtype=np.float32)
    if len(frames) < 2:
        return 0.0
    return float(np.mean(np.sqrt(np.mean(np.square(np.diff(frames, axis=0)), axis=1))))


def reject_class_outliers(candidates, threshold, rejected):
    if threshold <= 0:
        return candidates

    grouped = {}
    for item in candidates:
        grouped.setdefault(item[2], []).append(item)

    kept = []
    for items in grouped.values():
        if len(items) < 6:
            kept.extend(items)
            continue
        flattened = np.stack([item[1].reshape(-1) for item in items]).astype(np.float32)
        centroid = np.median(flattened, axis=0)
        distances = np.sqrt(np.mean(np.square(flattened - centroid), axis=1))
        median = float(np.median(distances))
        mad = float(np.median(np.abs(distances - median)))
        if mad < 1e-8:
            kept.extend(items)
            continue
        robust_z = 0.6745 * (distances - median) / mad
        for item, score in zip(items, robust_z):
            if score > threshold:
                rejected["class_outlier"] += 1
            else:
                kept.append(item)
    return kept


def main():
    args = parse_args()
    data = np.load(args.dataset, allow_pickle=True)
    sequences = data["sequences"].astype(np.float32)
    labels = data["labels"].astype(np.int64)
    class_names = [str(item) for item in data["class_names"].tolist()]
    manifest, metadata = load_manifest(args.dataset)
    metadata_aligned = len(metadata) == len(sequences)
    excluded_sources = {source.lower() for source in args.exclude_sources}
    source_class_limits = {}
    for value in args.source_class_limits:
        source, limit = value.rsplit("=", 1)
        source_class_limits[source.lower()] = int(limit)

    rejected = Counter()
    candidates = []
    seen = set()
    near_duplicate_sequences = {}
    for index, (sequence, label) in enumerate(zip(sequences, labels)):
        if not np.isfinite(sequence).all():
            rejected["non_finite"] += 1
            continue
        source = str(metadata[index].get("source", "")).lower() if metadata_aligned else ""
        if source in excluded_sources:
            rejected["excluded_source"] += 1
            continue
        nonzero_frames = int(np.count_nonzero(np.abs(sequence).sum(axis=1) > 1e-8))
        if nonzero_frames < args.min_nonzero_frames:
            rejected["too_few_landmark_frames"] += 1
            continue
        if sequence_motion(sequence) < args.min_motion:
            rejected["too_little_motion"] += 1
            continue
        fingerprint = sequence.tobytes()
        if fingerprint in seen:
            rejected["exact_duplicate"] += 1
            continue
        if args.near_duplicate_distance > 0:
            previous = near_duplicate_sequences.setdefault(int(label), [])
            if any(normalized_rms_distance(sequence, item) <= args.near_duplicate_distance for item in previous):
                rejected["near_duplicate"] += 1
                continue
            previous.append(sequence)
        seen.add(fingerprint)
        candidates.append((index, sequence, int(label), source))

    candidates = reject_class_outliers(candidates, args.outlier_zscore, rejected)
    counts = Counter(label for _, _, label, _ in candidates)
    label_sources = {}
    for _, _, label, source in candidates:
        label_sources.setdefault(label, Counter())[source] += 1
    keep_labels = [label for label, count in counts.items() if count >= args.min_samples_per_class]
    keep_labels.sort(key=lambda label: (-counts[label], class_names[label]))
    if source_class_limits:
        selected = []
        selected_set = set()
        for source, limit in source_class_limits.items():
            source_labels = [
                label for label in keep_labels
                if label_sources[label].most_common(1)[0][0] == source
            ][:limit]
            selected.extend(source_labels)
            selected_set.update(source_labels)
        keep_labels = selected + [label for label in keep_labels if label not in selected_set]
    if args.max_classes > 0:
        keep_labels = keep_labels[: args.max_classes]
    keep_set = set(keep_labels)
    rejected["low_support_or_class_limit"] += sum(1 for _, _, label, _ in candidates if label not in keep_set)

    remap = {old: new for new, old in enumerate(sorted(keep_labels, key=lambda label: class_names[label]))}
    ordered_old_labels = sorted(keep_labels, key=lambda label: class_names[label])
    cleaned = [(index, sequence, label) for index, sequence, label, _ in candidates if label in keep_set]
    output_sequences = np.stack([item[1] for item in cleaned]).astype(np.float32)
    output_labels = np.asarray([remap[item[2]] for item in cleaned], dtype=np.int64)
    output_classes = [class_names[label] for label in ordered_old_labels]
    output_metadata = [metadata[item[0]] for item in cleaned] if metadata_aligned else []

    args.output_dir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        args.output_dir / "signova_sequences.npz",
        sequences=output_sequences,
        labels=output_labels,
        class_names=np.asarray(output_classes),
    )
    class_counts = np.bincount(output_labels, minlength=len(output_classes)).tolist()
    report = {
        "input_dataset": str(args.dataset),
        "input_samples": int(len(sequences)),
        "input_classes": int(len(class_names)),
        "output_samples": int(len(output_sequences)),
        "output_classes": int(len(output_classes)),
        "min_samples_per_class": args.min_samples_per_class,
        "max_classes": args.max_classes,
        "min_nonzero_frames": args.min_nonzero_frames,
        "min_motion": args.min_motion,
        "near_duplicate_distance": args.near_duplicate_distance,
        "outlier_zscore": args.outlier_zscore,
        "excluded_sources": sorted(args.exclude_sources),
        "source_class_limits": source_class_limits,
        "rejected": dict(rejected),
        "class_counts": {name: count for name, count in zip(output_classes, class_counts)},
    }
    (args.output_dir / "cleaning_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    cleaned_manifest = {
        **manifest,
        "samples": len(output_sequences),
        "classes": output_classes,
        "metadata": output_metadata,
        "cleaning": report,
    }
    (args.output_dir / "sequence_manifest.json").write_text(json.dumps(cleaned_manifest, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
