import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = AI_SERVICE_DIR / "Data" / "isl_signer_collection"
DEFAULT_CLASSES_PATH = AI_SERVICE_DIR / "Models" / "signova_isl_gru_top30_clean_v3_classes.json"


def load_classes(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    values = payload.values() if isinstance(payload, dict) else payload
    return [str(value) for value in values]


def main():
    parser = argparse.ArgumentParser(description="Audit independent-signer coverage for the Signova ISL training collection.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--classes-path", type=Path, default=DEFAULT_CLASSES_PATH)
    parser.add_argument("--minimum-signers", type=int, default=30)
    parser.add_argument("--target-signers", type=int, default=50)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    classes = load_classes(args.classes_path)
    clips_by_sentence = defaultdict(list)
    signer_to_sentences = defaultdict(set)
    invalid = []
    duplicate_signer_takes = Counter()

    report_path = args.report or args.data_dir / "coverage_report.json"
    for metadata_path in sorted(args.data_dir.rglob("*.json")) if args.data_dir.is_dir() else []:
        if metadata_path.resolve() == report_path.resolve() or metadata_path.name.endswith("coverage_report.json"):
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        sentence = str(metadata.get("sentence") or "")
        signer = str(metadata.get("signer_code") or "")
        video_path = metadata_path.parent / str(metadata.get("video") or "")
        issues = list(metadata.get("quality_issues") or [])
        if sentence not in classes:
            issues.append("sentence_not_in_target_classes")
        if not signer:
            issues.append("signer_code_missing")
        if not metadata.get("consent_confirmed"):
            issues.append("consent_not_confirmed")
        if not video_path.is_file():
            issues.append("video_missing")
        if issues:
            invalid.append({"metadata": str(metadata_path), "issues": sorted(set(issues))})
            continue
        clips_by_sentence[sentence].append(metadata)
        signer_to_sentences[signer].add(sentence)
        duplicate_signer_takes[(sentence, signer)] += 1

    rows = []
    for sentence in classes:
        clips = clips_by_sentence[sentence]
        signers = sorted({clip["signer_code"] for clip in clips})
        count = len(signers)
        rows.append(
            {
                "sentence": sentence,
                "valid_clips": len(clips),
                "independent_signers": count,
                "minimum_remaining": max(0, args.minimum_signers - count),
                "target_remaining": max(0, args.target_signers - count),
                "status": "target_met" if count >= args.target_signers else "minimum_met" if count >= args.minimum_signers else "collecting",
            }
        )

    rows.sort(key=lambda row: (-row["minimum_remaining"], row["independent_signers"], row["sentence"]))
    total_signers = len(signer_to_sentences)
    minimum_met = sum(row["independent_signers"] >= args.minimum_signers for row in rows)
    target_met = sum(row["independent_signers"] >= args.target_signers for row in rows)
    duplicate_pairs = [
        {"sentence": sentence, "signer_code": signer, "takes": takes}
        for (sentence, signer), takes in duplicate_signer_takes.items()
        if takes > 1
    ]
    report = {
        "status": "ready_for_training" if minimum_met == len(classes) else "collecting",
        "classes": len(classes),
        "valid_clips": sum(len(value) for value in clips_by_sentence.values()),
        "independent_signers": total_signers,
        "minimum_signers_per_class": args.minimum_signers,
        "target_signers_per_class": args.target_signers,
        "classes_meeting_minimum": minimum_met,
        "classes_meeting_target": target_met,
        "minimum_coverage_percent": round(100.0 * minimum_met / len(classes), 2) if classes else 0.0,
        "target_coverage_percent": round(100.0 * target_met / len(classes), 2) if classes else 0.0,
        "clips_needed_for_minimum": sum(row["minimum_remaining"] for row in rows),
        "clips_needed_for_target": sum(row["target_remaining"] for row in rows),
        "duplicate_signer_takes": duplicate_pairs,
        "invalid_clips": invalid,
        "priority_queue": rows,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
