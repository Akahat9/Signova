"""Build a review manifest from consented clips made by collect_isl_signer_data.

The output deliberately leaves gloss/text/review/split fields unapproved. A
qualified reviewer must fill them before validate_slt_manifest can pass.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


FIELDS = [
    "clip_id", "relative_path", "approved_label", "gloss", "target_text_en",
    "target_text_hi", "sign_language", "signer_id", "session_id", "split",
    "licence_status", "training_permission", "review_status", "reviewer",
    "quality_status", "quality_issues", "consent_version",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an ISL reviewer manifest from consented collection metadata.")
    parser.add_argument("--collection-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    collection_dir = args.collection_dir.resolve()
    if not collection_dir.is_dir():
        raise SystemExit(f"Collection directory does not exist: {collection_dir}")
    rows = []
    for metadata_path in sorted(collection_dir.rglob("*.json")):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        video_name = str(metadata.get("video") or "")
        if not video_name:
            continue
        video_path = metadata_path.with_name(video_name)
        if not video_path.is_file() or not metadata.get("consent_confirmed"):
            continue
        rows.append({
            "clip_id": str(metadata.get("clip_id") or ""),
            "relative_path": video_path.relative_to(collection_dir).as_posix(),
            "approved_label": str(metadata.get("sentence") or ""),
            "gloss": "",
            "target_text_en": "",
            "target_text_hi": "",
            "sign_language": "ISL",
            "signer_id": str(metadata.get("signer_code") or ""),
            "session_id": "",
            "split": "unassigned",
            "licence_status": "approved",
            "training_permission": "approved",
            "review_status": "needs_expert_review",
            "reviewer": "",
            "quality_status": str(metadata.get("quality_status") or "needs_review"),
            "quality_issues": ";".join(metadata.get("quality_issues") or []),
            "consent_version": str(metadata.get("consent_version") or ""),
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} consented clips to {args.output}")


if __name__ == "__main__":
    main()
