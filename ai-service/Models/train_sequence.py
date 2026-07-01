import argparse
import csv
import json
import math
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Subset, TensorDataset, WeightedRandomSampler

try:
    from Models.sequence_model import SignovaSequenceModel, SignovaTemporalCNNTransformerModel, SignovaTransformerModel, save_json
except ImportError:
    from sequence_model import SignovaSequenceModel, SignovaTemporalCNNTransformerModel, SignovaTransformerModel, save_json


SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
DEFAULT_DATASET = AI_SERVICE_DIR / "Data" / "processed_sequences" / "signova_sequences.npz"
DEFAULT_MODEL_PATH = SCRIPT_DIR / "signova_sequence_gru.pt"
DEFAULT_TRANSFORMER_MODEL_PATH = SCRIPT_DIR / "signova_sequence_transformer.pt"
DEFAULT_CLASS_MAP_PATH = SCRIPT_DIR / "signova_sequence_classes.json"


def parse_args():
    parser = argparse.ArgumentParser(description="Train Signova GRU/LSTM/Transformer sequence recognition model.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model-path", type=Path, default=None)
    parser.add_argument("--class-map-path", type=Path, default=DEFAULT_CLASS_MAP_PATH)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--model-type", choices=["gru", "lstm", "transformer", "cnn_transformer"], default="gru")
    parser.add_argument("--hidden-size", type=int, default=192)
    parser.add_argument("--model-dim", type=int, default=128)
    parser.add_argument("--num-heads", type=int, default=4)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.25)
    parser.add_argument("--rnn-type", choices=["gru", "lstm"], default=None)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--patience", type=int, default=8)
    parser.add_argument("--max-classes", type=int, default=0, help="Train on the first N classes from the dataset.")
    parser.add_argument("--min-samples-per-class", type=int, default=0, help="Drop classes with fewer than this many samples.")
    parser.add_argument("--metrics-path", type=Path, default=None, help="Optional JSON path for validation metrics.")
    parser.add_argument("--label-smoothing", type=float, default=0.08)
    parser.add_argument("--class-weights", action="store_true", help="Use inverse-frequency class weights.")
    parser.add_argument("--hard-class-rankings", type=Path, help="CSV error report used to emphasize weak classes.")
    parser.add_argument("--priority-class-weight", type=float, default=1.8)
    parser.add_argument("--review-class-weight", type=float, default=1.3)
    parser.add_argument("--focal-gamma", type=float, default=0.0, help="Focal loss gamma. Zero uses regular cross entropy.")
    parser.add_argument("--augment", action="store_true", help="Apply light landmark sequence augmentation during training.")
    parser.add_argument("--noise-std", type=float, default=0.012)
    parser.add_argument("--feature-dropout", type=float, default=0.03)
    parser.add_argument("--time-mask-ratio", type=float, default=0.08)
    parser.add_argument("--scheduler", choices=["none", "cosine"], default="cosine")
    parser.add_argument("--balanced-sampler", action="store_true", help="Oversample underrepresented classes in each training epoch.")
    parser.add_argument("--selection-metric", choices=["accuracy", "f1_macro"], default="accuracy", help="Metric used for best-checkpoint selection.")
    parser.add_argument("--group-split-key", default="", help="Manifest metadata field used to keep the same signer/source group out of both train and validation.")
    return parser.parse_args()


def load_dataset(path):
    if not path.is_file():
        raise FileNotFoundError(f"Sequence dataset not found: {path}")
    data = np.load(path, allow_pickle=True)
    sequences = data["sequences"].astype(np.float32)
    labels = data["labels"].astype(np.int64)
    class_names = [str(item) for item in data["class_names"].tolist()]
    if len(sequences) == 0:
        raise RuntimeError("Sequence dataset is empty.")
    return sequences, labels, class_names


def load_dataset_metadata(dataset_path):
    manifest_path = Path(dataset_path).parent / "sequence_manifest.json"
    if not manifest_path.is_file():
        return {}
    try:
        with manifest_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}


def filter_dataset(sequences, labels, class_names, max_classes=0, min_samples_per_class=0):
    counts = {index: int((labels == index).sum()) for index in range(len(class_names))}
    keep = [index for index, name in enumerate(class_names) if counts[index] >= min_samples_per_class]
    if max_classes > 0:
        keep = keep[:max_classes]
    if not keep:
        raise RuntimeError("No classes remain after filtering.")

    keep_set = set(keep)
    row_mask = np.asarray([label in keep_set for label in labels], dtype=bool)
    filtered_sequences = sequences[row_mask]
    old_labels = labels[row_mask]
    remap = {old: new for new, old in enumerate(keep)}
    filtered_labels = np.asarray([remap[int(label)] for label in old_labels], dtype=np.int64)
    filtered_classes = [class_names[index] for index in keep]
    return filtered_sequences, filtered_labels, filtered_classes, np.flatnonzero(row_mask)


def safe_divide(numerator, denominator):
    return float(numerator) / float(denominator) if denominator else 0.0


def multiclass_roc_auc(targets, probabilities, num_classes):
    aucs = []
    targets = np.asarray(targets, dtype=np.int64)
    probabilities = np.asarray(probabilities, dtype=np.float64)
    for class_index in range(num_classes):
        binary = (targets == class_index).astype(np.int64)
        positives = int(binary.sum())
        negatives = int(len(binary) - positives)
        if positives == 0 or negatives == 0:
            continue
        scores = probabilities[:, class_index]
        order = np.argsort(scores)
        ranks = np.empty_like(order, dtype=np.float64)
        sorted_scores = scores[order]
        start = 0
        while start < len(sorted_scores):
            end = start + 1
            while end < len(sorted_scores) and sorted_scores[end] == sorted_scores[start]:
                end += 1
            average_rank = (start + 1 + end) / 2.0
            ranks[order[start:end]] = average_rank
            start = end
        positive_rank_sum = float(ranks[binary == 1].sum())
        aucs.append((positive_rank_sum - positives * (positives + 1) / 2.0) / (positives * negatives))
    return float(np.mean(aucs)) if aucs else 0.0


def classification_metrics(targets, predictions, probabilities, class_names):
    num_classes = len(class_names)
    targets = np.asarray(targets, dtype=np.int64)
    predictions = np.asarray(predictions, dtype=np.int64)
    probabilities = np.asarray(probabilities, dtype=np.float64)
    confusion = np.zeros((num_classes, num_classes), dtype=np.int64)
    for target, prediction in zip(targets, predictions):
        confusion[int(target), int(prediction)] += 1

    total = int(confusion.sum())
    correct = int(np.trace(confusion))
    per_class = []
    precisions = []
    recalls = []
    f1_scores = []
    specificities = []

    for index, name in enumerate(class_names):
        tp = int(confusion[index, index])
        fp = int(confusion[:, index].sum() - tp)
        fn = int(confusion[index, :].sum() - tp)
        tn = int(total - tp - fp - fn)
        precision = safe_divide(tp, tp + fp)
        recall = safe_divide(tp, tp + fn)
        specificity = safe_divide(tn, tn + fp)
        f1 = safe_divide(2 * precision * recall, precision + recall)
        support = int(confusion[index, :].sum())
        precisions.append(precision)
        recalls.append(recall)
        f1_scores.append(f1)
        specificities.append(specificity)
        per_class.append(
            {
                "label": name,
                "support": support,
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1_score": round(f1, 4),
                "specificity": round(specificity, 4),
            }
        )

    row_sums = confusion.sum(axis=1)
    col_sums = confusion.sum(axis=0)
    numerator = (correct * total) - int(np.dot(row_sums, col_sums))
    denominator = math.sqrt(
        max(
            float(total**2 - np.dot(col_sums, col_sums))
            * float(total**2 - np.dot(row_sums, row_sums)),
            0.0,
        )
    )
    mcc = safe_divide(numerator, denominator)
    clipped = np.clip(probabilities, 1e-12, 1.0)
    log_loss = -float(np.mean(np.log(clipped[np.arange(len(targets)), targets]))) if len(targets) else 0.0

    return {
        "accuracy": round(100.0 * safe_divide(correct, total), 4),
        "precision_macro": round(float(np.mean(precisions)) if precisions else 0.0, 4),
        "recall_macro": round(float(np.mean(recalls)) if recalls else 0.0, 4),
        "f1_macro": round(float(np.mean(f1_scores)) if f1_scores else 0.0, 4),
        "specificity_macro": round(float(np.mean(specificities)) if specificities else 0.0, 4),
        "roc_auc_ovr_macro": round(multiclass_roc_auc(targets, probabilities, num_classes), 4),
        "log_loss": round(log_loss, 4),
        "mcc": round(mcc, 4),
        "samples": total,
        "classes": num_classes,
        "per_class": per_class,
        "confusion_matrix": confusion.tolist(),
    }


def evaluate(model, loader, device, class_names=None):
    model.eval()
    correct = 0
    total = 0
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()
    all_targets = []
    all_predictions = []
    all_probabilities = []
    with torch.no_grad():
        for features, targets in loader:
            features = features.to(device)
            targets = targets.to(device)
            logits = model(features)
            loss = criterion(logits, targets)
            total_loss += loss.item() * targets.numel()
            probabilities = torch.softmax(logits, dim=1)
            predictions = probabilities.argmax(dim=1)
            correct += (predictions == targets).sum().item()
            total += targets.numel()
            all_targets.extend(targets.detach().cpu().numpy().tolist())
            all_predictions.extend(predictions.detach().cpu().numpy().tolist())
            all_probabilities.extend(probabilities.detach().cpu().numpy().tolist())
    metrics = {
        "loss": total_loss / total if total else 0.0,
        "accuracy": 100.0 * correct / total if total else 0.0,
    }
    if class_names:
        metrics.update(classification_metrics(all_targets, all_predictions, all_probabilities, class_names))
    return metrics


def make_class_weights(labels, train_indices, num_classes):
    train_labels = labels[np.asarray(train_indices, dtype=np.int64)]
    counts = np.bincount(train_labels, minlength=num_classes).astype(np.float32)
    counts[counts == 0] = 1.0
    weights = counts.sum() / (num_classes * counts)
    weights = weights / weights.mean()
    return torch.from_numpy(weights.astype(np.float32))


def make_balanced_sampler(labels, train_indices, num_classes):
    train_labels = labels[np.asarray(train_indices, dtype=np.int64)]
    counts = np.bincount(train_labels, minlength=num_classes).astype(np.float64)
    counts[counts == 0] = 1.0
    sample_weights = np.asarray([1.0 / counts[label] for label in train_labels], dtype=np.float64)
    return WeightedRandomSampler(torch.from_numpy(sample_weights), len(sample_weights), replacement=True)


def load_hard_class_weights(class_names, rankings_path, priority_weight=1.8, review_weight=1.3):
    weights = np.ones(len(class_names), dtype=np.float32)
    if not rankings_path or not Path(rankings_path).is_file():
        return torch.from_numpy(weights), {}

    actions = {}
    with Path(rankings_path).open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            label = str(row.get("label") or "").strip()
            action = str(row.get("action") or "").strip()
            if label:
                actions[label] = action

    class_to_index = {name: index for index, name in enumerate(class_names)}
    for label, action in actions.items():
        index = class_to_index.get(label)
        if index is None:
            continue
        if action == "priority_review":
            weights[index] = priority_weight
        elif action == "review":
            weights[index] = review_weight
    weights = weights / weights.mean()
    return torch.from_numpy(weights), actions


class WeightedFocalLoss(nn.Module):
    def __init__(self, weight=None, gamma=0.0, label_smoothing=0.0):
        super().__init__()
        self.register_buffer("weight", weight)
        self.gamma = max(0.0, float(gamma))
        self.label_smoothing = max(0.0, float(label_smoothing))

    def forward(self, logits, targets):
        losses = F.cross_entropy(
            logits,
            targets,
            weight=self.weight,
            label_smoothing=self.label_smoothing,
            reduction="none",
        )
        if self.gamma > 0:
            target_probabilities = F.softmax(logits, dim=-1).gather(1, targets.unsqueeze(1)).squeeze(1)
            losses = losses * (1.0 - target_probabilities).pow(self.gamma)
        return losses.mean()


def augment_features(features, args):
    if not args.augment:
        return features

    output = features
    if args.noise_std > 0:
        output = output + torch.randn_like(output) * args.noise_std

    if args.feature_dropout > 0:
        keep = torch.rand_like(output) > args.feature_dropout
        output = output * keep

    if args.time_mask_ratio > 0 and output.size(1) > 4:
        mask_len = max(1, int(round(output.size(1) * args.time_mask_ratio)))
        max_start = max(1, output.size(1) - mask_len)
        for row in range(output.size(0)):
            start = int(torch.randint(0, max_start, (1,), device=output.device).item())
            fill_index = max(0, start - 1)
            output[row, start : start + mask_len] = output[row, fill_index : fill_index + 1]

    return output


def stratified_split(labels, val_split=0.2, seed=42):
    rng = random.Random(seed)
    buckets = {}
    for index, label in enumerate(labels.tolist()):
        buckets.setdefault(int(label), []).append(index)

    train_indices = []
    val_indices = []
    for indices in buckets.values():
        rng.shuffle(indices)
        if len(indices) <= 1:
            train_indices.extend(indices)
            continue
        val_count = max(1, int(round(len(indices) * val_split)))
        val_count = min(val_count, len(indices) - 1)
        val_indices.extend(indices[:val_count])
        train_indices.extend(indices[val_count:])

    rng.shuffle(train_indices)
    rng.shuffle(val_indices)
    if not val_indices:
        split_at = max(1, int(len(train_indices) * (1.0 - val_split)))
        val_indices = train_indices[split_at:]
        train_indices = train_indices[:split_at]
    return train_indices, val_indices


def group_aware_split(labels, groups, val_split=0.2, seed=42):
    groups = np.asarray(groups, dtype=object)
    unique_groups = sorted(set(str(group) for group in groups))
    if len(unique_groups) < 3:
        return stratified_split(labels, val_split=val_split, seed=seed)

    target_groups = max(1, min(len(unique_groups) - 1, int(round(len(unique_groups) * val_split))))
    all_classes = set(int(label) for label in labels.tolist())
    best = None
    for attempt in range(256):
        rng = random.Random(seed + attempt)
        shuffled = unique_groups[:]
        rng.shuffle(shuffled)
        val_groups = set(shuffled[:target_groups])
        val_indices = [index for index, group in enumerate(groups) if str(group) in val_groups]
        train_indices = [index for index, group in enumerate(groups) if str(group) not in val_groups]
        train_classes = set(int(labels[index]) for index in train_indices)
        val_classes = set(int(labels[index]) for index in val_indices)
        coverage = len(train_classes & val_classes)
        size_error = abs(len(val_indices) - (len(labels) * val_split))
        score = (coverage, -size_error)
        if best is None or score > best[0]:
            best = (score, train_indices, val_indices)
        if train_classes == all_classes and val_classes == all_classes:
            break
    return best[1], best[2]


def main():
    args = parse_args()
    if args.rnn_type:
        args.model_type = args.rnn_type
    if args.model_path is None:
        args.model_path = DEFAULT_TRANSFORMER_MODEL_PATH if args.model_type == "transformer" else DEFAULT_MODEL_PATH

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    random.seed(args.seed)

    dataset_metadata = load_dataset_metadata(args.dataset)
    sequences, labels, class_names = load_dataset(args.dataset)
    sequences, labels, class_names, retained_indices = filter_dataset(
        sequences,
        labels,
        class_names,
        max_classes=args.max_classes,
        min_samples_per_class=args.min_samples_per_class,
    )
    dataset = TensorDataset(torch.from_numpy(sequences), torch.from_numpy(labels))
    metadata = dataset_metadata.get("metadata") or []
    largest_retained_index = int(retained_indices.max()) if retained_indices.size else -1
    if args.group_split_key and len(metadata) > largest_retained_index:
        groups = [
            str(metadata[int(index)].get(args.group_split_key) or f"missing-{int(index)}")
            for index in retained_indices
        ]
        train_indices, val_indices = group_aware_split(labels, groups, val_split=args.val_split, seed=args.seed)
    else:
        train_indices, val_indices = stratified_split(labels, val_split=args.val_split, seed=args.seed)
    train_data = Subset(dataset, train_indices)
    val_data = Subset(dataset, val_indices)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_sampler = make_balanced_sampler(labels, train_indices, len(class_names)) if args.balanced_sampler else None
    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=train_sampler is None, sampler=train_sampler)
    val_loader = DataLoader(val_data, batch_size=args.batch_size, shuffle=False)

    if args.model_type in {"transformer", "cnn_transformer"}:
        model_class = SignovaTemporalCNNTransformerModel if args.model_type == "cnn_transformer" else SignovaTransformerModel
        model = model_class(
            input_size=sequences.shape[-1],
            model_dim=args.model_dim,
            num_heads=args.num_heads,
            num_layers=args.num_layers,
            num_classes=len(class_names),
            dropout=args.dropout,
            max_length=sequences.shape[1],
        ).to(device)
    else:
        model = SignovaSequenceModel(
            input_size=sequences.shape[-1],
            hidden_size=args.hidden_size,
            num_layers=args.num_layers,
            num_classes=len(class_names),
            dropout=args.dropout,
            rnn_type=args.model_type,
        ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    class_weights = make_class_weights(labels, train_indices, len(class_names)) if args.class_weights else torch.ones(len(class_names))
    hard_weights, hard_actions = load_hard_class_weights(
        class_names,
        args.hard_class_rankings,
        priority_weight=args.priority_class_weight,
        review_weight=args.review_class_weight,
    )
    combined_weights = (class_weights * hard_weights)
    combined_weights = (combined_weights / combined_weights.mean()).to(device)
    criterion = WeightedFocalLoss(
        weight=combined_weights,
        gamma=args.focal_gamma,
        label_smoothing=args.label_smoothing,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, args.epochs), eta_min=args.lr * 0.08) if args.scheduler == "cosine" else None

    best_accuracy = 0.0
    best_score = -1.0
    best_state = None
    history = []
    print(f"Using device: {device}")
    print(
        f"Model: {args.model_type} | Samples: {len(dataset)} | "
        f"Train: {len(train_data)} | Val: {len(val_data)} | "
        f"Classes: {len(class_names)} | Sequence shape: {tuple(sequences.shape[1:])}"
    )

    epochs_without_improvement = 0
    for epoch in range(args.epochs):
        model.train()
        total_loss = 0.0
        total = 0
        for features, targets in train_loader:
            features = features.to(device)
            targets = targets.to(device)
            features = augment_features(features, args)
            optimizer.zero_grad()
            logits = model(features)
            loss = criterion(logits, targets)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item() * targets.numel()
            total += targets.numel()
        if scheduler:
            scheduler.step()

        val_metrics = evaluate(model, val_loader, device, class_names=class_names)
        train_loss = total_loss / total if total else 0.0
        history.append({"epoch": epoch + 1, "train_loss": train_loss, **val_metrics})
        print(
            f"Epoch {epoch + 1}/{args.epochs} - "
            f"loss: {train_loss:.4f} - val_loss: {val_metrics['loss']:.4f} - "
            f"val_acc: {val_metrics['accuracy']:.2f}%"
        )
        selection_score = float(val_metrics[args.selection_metric])
        if selection_score >= best_score:
            best_score = selection_score
            best_accuracy = val_metrics["accuracy"]
            best_state = {key: value.detach().cpu() for key, value in model.state_dict().items()}
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
        if args.patience > 0 and epochs_without_improvement >= args.patience:
            print(f"Early stopping after {epoch + 1} epochs without validation improvement.")
            break

    checkpoint = {
        "model_state_dict": best_state or model.state_dict(),
        "classes": class_names,
        "model_type": args.model_type,
        "input_size": int(sequences.shape[-1]),
        "sequence_length": int(sequences.shape[1]),
        "dataset_metadata": dataset_metadata,
        "feature_normalization": dataset_metadata.get("feature_normalization", "raw_mediapipe"),
        "hidden_size": args.hidden_size,
        "model_dim": args.model_dim,
        "num_heads": args.num_heads,
        "num_layers": args.num_layers,
        "dropout": args.dropout,
        "rnn_type": args.model_type if args.model_type in {"gru", "lstm"} else None,
        "label_smoothing": args.label_smoothing,
        "class_weights": bool(args.class_weights),
        "hard_class_rankings": str(args.hard_class_rankings) if args.hard_class_rankings else None,
        "priority_class_weight": args.priority_class_weight,
        "review_class_weight": args.review_class_weight,
        "focal_gamma": args.focal_gamma,
        "hard_class_actions": hard_actions,
        "augment": bool(args.augment),
        "noise_std": args.noise_std,
        "feature_dropout": args.feature_dropout,
        "time_mask_ratio": args.time_mask_ratio,
        "scheduler": args.scheduler,
        "balanced_sampler": bool(args.balanced_sampler),
        "selection_metric": args.selection_metric,
        "group_split_key": args.group_split_key or None,
        "best_selection_score": best_score,
        "val_accuracy": best_accuracy,
        "history": history,
    }
    if best_state:
        model.load_state_dict(best_state)
    detailed_metrics = evaluate(model, val_loader, device, class_names=class_names)
    detailed_metrics.update(
        {
            "model_type": args.model_type,
            "dataset": str(args.dataset),
            "model_path": str(args.model_path),
            "best_validation_accuracy": round(best_accuracy, 4),
        }
    )
    checkpoint["metrics"] = detailed_metrics
    args.model_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(checkpoint, args.model_path)
    save_json(args.class_map_path, {index: name for index, name in enumerate(class_names)})
    metrics_path = args.metrics_path or args.model_path.with_suffix(".metrics.json")
    save_json(metrics_path, detailed_metrics)
    print(f"Best validation accuracy: {best_accuracy:.2f}%")
    print(
        "Metrics: "
        f"macro_f1={detailed_metrics['f1_macro']:.4f}, "
        f"precision={detailed_metrics['precision_macro']:.4f}, "
        f"recall={detailed_metrics['recall_macro']:.4f}, "
        f"log_loss={detailed_metrics['log_loss']:.4f}, "
        f"mcc={detailed_metrics['mcc']:.4f}"
    )
    print(f"Saved sequence model to {args.model_path}")
    print(f"Saved metrics to {metrics_path}")


if __name__ == "__main__":
    main()
