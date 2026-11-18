import argparse
from datetime import datetime, timezone
import json
from pathlib import Path


UNKNOWN_LABELS = {"unknown", "no_gesture", "nothing", "blank", "background"}


def evaluate(rows):
    unknown_rows = [row for row in rows if str(row.get("expected_label", "")).strip().lower() in UNKNOWN_LABELS]
    known_rows = [row for row in rows if row not in unknown_rows]
    unknown_accepted = sum(bool(row.get("accepted")) for row in unknown_rows)
    unknown_rejected = len(unknown_rows) - unknown_accepted
    known_accepted = sum(bool(row.get("accepted")) for row in known_rows)
    known_correct = sum(
        bool(row.get("accepted"))
        and str(row.get("predicted_label", "")).strip().lower() == str(row.get("expected_label", "")).strip().lower()
        for row in known_rows
    )
    return {
        "samples": len(rows),
        "unknown_samples": len(unknown_rows),
        "known_samples": len(known_rows),
        "unknown_recall": unknown_rejected / len(unknown_rows) if unknown_rows else None,
        "unknown_false_accept_rate": unknown_accepted / len(unknown_rows) if unknown_rows else None,
        "known_coverage": known_accepted / len(known_rows) if known_rows else None,
        "known_end_to_end_accuracy": known_correct / len(known_rows) if known_rows else None,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate Signova unknown/no-sign rejection from JSONL predictions.")
    parser.add_argument("input", type=Path, help="JSONL rows with expected_label, predicted_label, and accepted.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--signer-disjoint", action="store_true", help="Assert that the evaluated manifest is signer-disjoint from training.")
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.input.read_text(encoding="utf-8").splitlines() if line.strip()]
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        **evaluate(rows),
        "signer_disjoint_validation": args.signer_disjoint,
        "source": str(args.input),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

