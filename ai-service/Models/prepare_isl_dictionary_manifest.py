"""Create a review manifest for locally acquired ISL dictionary videos.

This tool never asserts a licence, consent, signer identity, or train/test
assignment from a filename.  Those facts must be reviewed and filled in before
the videos may enter a training set.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path


VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def normalise_label(value: str) -> str:
    value = Path(value).stem
    value = re.sub(r"\s*\(sign[_ -]?\d+\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s*\(\d+\)", "", value)
    value = re.sub(r"[_\-]+", " ", value)
    return " ".join(value.split()).strip()


def short_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build_record(root: Path, video: Path, include_hash: bool) -> dict:
    relative = video.relative_to(root)
    top_level = relative.parts[0] if relative.parts else ""
    language_hint = "Hindi" if "New Hindi" in relative.parts else "English" if "New English" in relative.parts else "unknown"
    return {
        "clip_id": f"isl_dictionary_{hashlib.sha1(str(relative).encode('utf-8')).hexdigest()[:16]}",
        "relative_path": relative.as_posix(),
        "approved_label": normalise_label(video.name),
        "gloss": "",
        "target_text_en": normalise_label(video.name) if language_hint == "English" else "",
        "target_text_hi": normalise_label(video.name) if language_hint == "Hindi" else "",
        "sign_language": "ISL",
        "source_collection": "ISL Dictionary local import",
        "source_group": top_level,
        "source_language_hint": language_hint,
        "signer_id": "unknown",
        "session_id": "unknown",
        "split": "unassigned",
        "licence_status": "pending_review",
        "training_permission": "pending_review",
        "commercial_use": "pending_review",
        "review_status": "needs_expert_review",
        "sha256": short_hash(video) if include_hash else "",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a non-training ISL dictionary review manifest.")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--hash", action="store_true", help="Calculate SHA-256 for each video; slower but reproducible.")
    args = parser.parse_args()

    root = args.root.resolve()
    if not root.is_dir():
        raise SystemExit(f"Dictionary root does not exist: {root}")
    videos = sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in VIDEO_SUFFIXES)
    if not videos:
        raise SystemExit("No videos found.")

    rows = [build_record(root, video, args.hash) for video in videos]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "videos": len(rows),
        "unique_provisional_labels": len({row["approved_label"] for row in rows}),
        "training_ready": False,
        "reason": "Every entry needs licence, signer, split, and ISL expert review before training.",
    }
    args.output.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
