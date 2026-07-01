import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
DATA_DIR = AI_SERVICE_DIR / "Data"
DEFAULT_ASL_DIR = DATA_DIR / "ASL_Citizen"


def clean_label(label):
    return "_".join(str(label).strip().lower().replace("/", " ").split())


def read_csv(path):
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def audit_split(asl_dir, split):
    split_path = asl_dir / "splits" / f"{split}.csv"
    video_root = asl_dir / "videos"
    rows = read_csv(split_path) if split_path.is_file() else []
    counts = Counter()
    missing = []
    duplicate_files = Counter()
    label_files = defaultdict(list)

    for row in rows:
        label = clean_label(row.get("Gloss", ""))
        filename = row.get("Video file", "")
        video_path = video_root / filename
        if label:
            counts[label] += 1
            label_files[label].append(filename)
        if filename:
            duplicate_files[filename] += 1
        if filename and not video_path.is_file():
            missing.append(filename)

    duplicates = [name for name, count in duplicate_files.items() if count > 1]
    return {
        "split": split,
        "rows": len(rows),
        "classes": len(counts),
        "missing_videos": len(missing),
        "duplicate_video_rows": len(duplicates),
        "top_classes": counts.most_common(20),
        "low_sample_classes": sorted([label for label, count in counts.items() if count < 5])[:50],
        "class_counts": dict(sorted(counts.items())),
    }


def audit_processed(processed_dir):
    manifest_path = processed_dir / "sequence_manifest.json"
    if not manifest_path.is_file():
        return {"available": False}
    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    failed = manifest.get("failed") or []
    metadata = manifest.get("metadata") or []
    counts = Counter(item.get("label") for item in metadata if item.get("label"))
    return {
        "available": True,
        "samples": manifest.get("samples", 0),
        "classes": len(manifest.get("classes") or []),
        "failed": len(failed),
        "failure_rate": round(len(failed) / max(1, len(failed) + len(metadata)), 4),
        "top_classes": counts.most_common(20),
        "lowest_processed_classes": sorted(counts.items(), key=lambda item: (item[1], item[0]))[:20],
    }


def main():
    parser = argparse.ArgumentParser(description="Audit ASL Citizen data for Signova training.")
    parser.add_argument("--asl-dir", type=Path, default=DEFAULT_ASL_DIR)
    parser.add_argument("--processed-dir", type=Path, default=DATA_DIR / "processed_sequences_asl_top100")
    parser.add_argument("--output", type=Path, default=DATA_DIR / "processed_sequences_asl_top100" / "asl_audit.json")
    args = parser.parse_args()

    report = {
        "asl_dir": str(args.asl_dir),
        "splits": [audit_split(args.asl_dir, split) for split in ("train", "val", "test")],
        "processed": audit_processed(args.processed_dir),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(json.dumps({
        "splits": [
            {
                "split": split["split"],
                "rows": split["rows"],
                "classes": split["classes"],
                "missing_videos": split["missing_videos"],
                "duplicate_video_rows": split["duplicate_video_rows"],
            }
            for split in report["splits"]
        ],
        "processed": report["processed"],
        "output": str(args.output),
    }, indent=2))


if __name__ == "__main__":
    main()
