import argparse
import csv
import json
from pathlib import Path


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_divide(numerator, denominator):
    return float(numerator) / float(denominator) if denominator else 0.0


def rounded(value):
    return round(float(value), 4)


def class_counts_from_manifest(manifest_path):
    if not manifest_path or not Path(manifest_path).is_file():
        return {}
    manifest = load_json(manifest_path)
    counts = {}
    for sample in manifest.get("sample_manifest") or manifest.get("metadata") or manifest.get("items") or []:
        label = sample.get("label")
        if label:
            counts[label] = counts.get(label, 0) + 1
    return counts


def analyze(metrics, train_counts=None, top_n=30):
    class_names = [entry["label"] for entry in metrics["per_class"]]
    confusion = metrics["confusion_matrix"]
    per_class = {entry["label"]: entry for entry in metrics["per_class"]}

    weak_classes = []
    for index, label in enumerate(class_names):
        row = confusion[index]
        support = int(sum(row))
        correct = int(row[index])
        errors = support - correct
        top_misses = []
        for pred_index, count in enumerate(row):
            if pred_index == index or not count:
                continue
            top_misses.append(
                {
                    "predicted_as": class_names[pred_index],
                    "count": int(count),
                    "rate": rounded(safe_divide(count, support)),
                }
            )
        top_misses.sort(key=lambda item: (-item["count"], item["predicted_as"]))
        stats = per_class[label]
        f1 = float(stats.get("f1_score") or 0)
        recall = float(stats.get("recall") or 0)
        precision = float(stats.get("precision") or 0)
        if f1 <= 0.25 or recall <= 0.25:
            action = "priority_review"
        elif f1 <= 0.5 or recall <= 0.5:
            action = "review"
        elif top_misses and top_misses[0]["rate"] >= 0.5:
            action = "pair_confusion_review"
        else:
            action = "keep"
        weak_classes.append(
            {
                "label": label,
                "action": action,
                "support": support,
                "train_samples": int((train_counts or {}).get(label, 0)),
                "correct": correct,
                "errors": errors,
                "precision": rounded(precision),
                "recall": rounded(recall),
                "f1_score": rounded(f1),
                "top_misses": top_misses[:5],
            }
        )
    weak_classes.sort(key=lambda item: (item["f1_score"], item["recall"], -item["errors"], item["label"]))

    directed_confusions = []
    for true_index, true_label in enumerate(class_names):
        support = int(sum(confusion[true_index]))
        for pred_index, count in enumerate(confusion[true_index]):
            if true_index == pred_index or count == 0:
                continue
            directed_confusions.append(
                {
                    "true_label": true_label,
                    "predicted_as": class_names[pred_index],
                    "count": int(count),
                    "true_support": support,
                    "rate": rounded(safe_divide(count, support)),
                }
            )
    directed_confusions.sort(key=lambda item: (-item["count"], -item["rate"], item["true_label"], item["predicted_as"]))

    pair_map = {}
    for item in directed_confusions:
        a = item["true_label"]
        b = item["predicted_as"]
        key = tuple(sorted((a, b)))
        pair = pair_map.setdefault(
            key,
            {
                "labels": list(key),
                "total_confusions": 0,
                "directions": [],
            },
        )
        pair["total_confusions"] += item["count"]
        pair["directions"].append(item)
    pair_confusions = list(pair_map.values())
    pair_confusions.sort(key=lambda item: (-item["total_confusions"], item["labels"]))

    false_positive_sinks = []
    for pred_index, label in enumerate(class_names):
        column_total = int(sum(row[pred_index] for row in confusion))
        tp = int(confusion[pred_index][pred_index])
        fp = column_total - tp
        false_positive_sinks.append(
            {
                "label": label,
                "false_positives": fp,
                "predicted_total": column_total,
                "precision": rounded(safe_divide(tp, column_total)),
            }
        )
    false_positive_sinks.sort(key=lambda item: (-item["false_positives"], item["precision"], item["label"]))

    return {
        "summary": {
            "accuracy": metrics.get("accuracy"),
            "f1_macro": metrics.get("f1_macro"),
            "precision_macro": metrics.get("precision_macro"),
            "recall_macro": metrics.get("recall_macro"),
            "classes": metrics.get("classes"),
            "samples": metrics.get("samples"),
            "priority_review_classes": sum(1 for item in weak_classes if item["action"] == "priority_review"),
            "review_classes": sum(1 for item in weak_classes if item["action"] in {"priority_review", "review"}),
        },
        "weak_classes": weak_classes[:top_n],
        "all_class_rankings": weak_classes,
        "directed_confusions": directed_confusions[:top_n],
        "pair_confusions": pair_confusions[:top_n],
        "false_positive_sinks": false_positive_sinks[:top_n],
    }


def write_csv(path, rows, fieldnames):
    with Path(path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def write_markdown(path, report):
    summary = report["summary"]
    lines = [
        "# ASL Top200 Error Analysis",
        "",
        "## Summary",
        "",
        f"- Accuracy: {summary['accuracy']}%",
        f"- Macro F1: {summary['f1_macro']}",
        f"- Precision macro: {summary['precision_macro']}",
        f"- Recall macro: {summary['recall_macro']}",
        f"- Classes: {summary['classes']}",
        f"- Validation samples: {summary['samples']}",
        f"- Priority review classes: {summary['priority_review_classes']}",
        f"- Review classes: {summary['review_classes']}",
        "",
        "## Best Next Move",
        "",
        "1. Review the priority classes first. These have very low recall or F1 and can drag the whole model down.",
        "2. Inspect the strongest confusion pairs. If two labels are visually identical, keep only one for v3 or add more examples.",
        "3. Rebuild a cleaned Top200 v3 cache after removing or fixing noisy classes, then retrain before Top300.",
        "",
        "## Weakest Classes",
        "",
        "| Rank | Label | Action | F1 | Recall | Precision | Support | Train samples | Top miss |",
        "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for rank, item in enumerate(report["weak_classes"], start=1):
        miss = item["top_misses"][0] if item["top_misses"] else {}
        top_miss = ""
        if miss:
            top_miss = f"{miss['predicted_as']} ({miss['count']}, {miss['rate']})"
        lines.append(
            "| {rank} | {label} | {action} | {f1_score:.4f} | {recall:.4f} | {precision:.4f} | {support} | {train_samples} | {top_miss} |".format(
                rank=rank,
                top_miss=top_miss,
                **item,
            )
        )

    lines.extend(
        [
            "",
            "## Top Confusion Pairs",
            "",
            "| Rank | Labels | Total confusions | Direction detail |",
            "| ---: | --- | ---: | --- |",
        ]
    )
    for rank, item in enumerate(report["pair_confusions"], start=1):
        detail = "; ".join(
            f"{direction['true_label']} -> {direction['predicted_as']} ({direction['count']}, {direction['rate']})"
            for direction in item["directions"]
        )
        lines.append(f"| {rank} | {' / '.join(item['labels'])} | {item['total_confusions']} | {detail} |")

    lines.extend(
        [
            "",
            "## False Positive Sinks",
            "",
            "These labels are over-predicted by the model.",
            "",
            "| Rank | Label | False positives | Predicted total | Precision |",
            "| ---: | --- | ---: | ---: | ---: |",
        ]
    )
    for rank, item in enumerate(report["false_positive_sinks"], start=1):
        lines.append(
            f"| {rank} | {item['label']} | {item['false_positives']} | {item['predicted_total']} | {item['precision']:.4f} |"
        )

    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Analyze Signova sequence model confusion and weak classes.")
    parser.add_argument("--metrics", required=True, help="Path to metrics JSON containing per_class and confusion_matrix.")
    parser.add_argument("--manifest", help="Optional sequence manifest JSON for train sample counts.")
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md", required=True)
    parser.add_argument("--output-csv")
    parser.add_argument("--top-n", type=int, default=30)
    args = parser.parse_args()

    metrics = load_json(args.metrics)
    train_counts = class_counts_from_manifest(args.manifest)
    report = analyze(metrics, train_counts=train_counts, top_n=args.top_n)

    Path(args.output_json).write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_markdown(args.output_md, report)
    if args.output_csv:
        rows = []
        for item in report["all_class_rankings"]:
            top_miss = item["top_misses"][0] if item["top_misses"] else {}
            rows.append(
                {
                    "label": item["label"],
                    "action": item["action"],
                    "f1_score": item["f1_score"],
                    "recall": item["recall"],
                    "precision": item["precision"],
                    "support": item["support"],
                    "train_samples": item["train_samples"],
                    "correct": item["correct"],
                    "errors": item["errors"],
                    "top_miss": top_miss.get("predicted_as", ""),
                    "top_miss_count": top_miss.get("count", ""),
                    "top_miss_rate": top_miss.get("rate", ""),
                }
            )
        write_csv(
            args.output_csv,
            rows,
            [
                "label",
                "action",
                "f1_score",
                "recall",
                "precision",
                "support",
                "train_samples",
                "correct",
                "errors",
                "top_miss",
                "top_miss_count",
                "top_miss_rate",
            ],
        )

    summary = report["summary"]
    print(
        "Analyzed {classes} classes, {samples} validation samples. "
        "Priority review: {priority_review_classes}, review: {review_classes}.".format(**summary)
    )
    print(f"Saved {args.output_json}")
    print(f"Saved {args.output_md}")
    if args.output_csv:
        print(f"Saved {args.output_csv}")


if __name__ == "__main__":
    main()
