"""Fail-fast readiness checks for a Signova gloss-to-text training manifest."""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path


REQUIRED = {
    "clip_id", "relative_path", "approved_label", "gloss", "sign_language",
    "signer_id", "split", "licence_status", "training_permission", "review_status",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a CSV manifest before CTC/gloss-to-text training.")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--minimum-clips-per-label", type=int, default=10)
    args = parser.parse_args()
    with args.manifest.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        fields = set(reader.fieldnames or [])
    missing = REQUIRED - fields
    if missing:
        raise SystemExit(f"Missing required columns: {', '.join(sorted(missing))}")
    if not rows:
        raise SystemExit("Manifest is not ready for gloss-to-text training: it contains no clips.")
    labels = Counter(row["approved_label"].strip() for row in rows if row["approved_label"].strip())
    signers = defaultdict(set)
    invalid = []
    for row in rows:
        for field in ("gloss", "signer_id"):
            if not row[field].strip() or row[field].strip().lower() == "unknown":
                invalid.append(f"{row.get('clip_id', '<unknown>')}: missing {field}")
        if row["split"] not in {"train", "validation", "test"}:
            invalid.append(f"{row.get('clip_id', '<unknown>')}: unassigned split")
        if row["licence_status"] != "approved" or row["training_permission"] != "approved" or row["review_status"] != "approved":
            invalid.append(f"{row.get('clip_id', '<unknown>')}: approval pending")
        signers[row["approved_label"]].add(row["signer_id"])
    sparse = [label for label, count in labels.items() if count < args.minimum_clips_per_label]
    single_signer = [label for label, values in signers.items() if len(values - {"", "unknown"}) < 2]
    if invalid or sparse or single_signer:
        print(f"rows={len(rows)} labels={len(labels)}")
        print(f"invalid_rows={len(invalid)} sparse_labels={len(sparse)} labels_with_under_two_signers={len(single_signer)}")
        raise SystemExit("Manifest is not ready for gloss-to-text training.")
    print(f"READY: {len(rows)} clips, {len(labels)} labels, signer and approval checks passed.")


if __name__ == "__main__":
    main()
