import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset


SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR.parent
AI_SERVICE_DIR = MODELS_DIR.parent
DEFAULT_TRAIN_DIR = AI_SERVICE_DIR / "Datasets" / "ann_train_val"
DEFAULT_TEST_DIR = AI_SERVICE_DIR / "Datasets" / "ann_test"
DEFAULT_MODEL_PATH = MODELS_DIR / "landmark_mlp.pt"


def normalize_landmarks(landmarks):
    points = np.asarray(landmarks, dtype=np.float32)
    if points.ndim != 2 or points.shape[0] < 21 or points.shape[1] < 2:
        raise ValueError("Expected at least 21 hand landmarks with x/y coordinates.")

    points = points[:21, :2]
    wrist = points[0].copy()
    points = points - wrist
    scale = float(np.linalg.norm(points, axis=1).max())
    if scale <= 1e-6:
        scale = 1.0
    return (points / scale).reshape(-1)


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class LandmarkMLP(nn.Module):
    def __init__(self, input_size=42, num_classes=18, dropout=0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_size, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 96),
            nn.BatchNorm1d(96),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(96, num_classes),
        )

    def forward(self, inputs):
        return self.net(inputs)


def collect_landmark_samples(dataset_dir, labels=None, max_samples_per_label=0, include_no_gesture=False, seed=42):
    dataset_dir = Path(dataset_dir)
    if not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    label_files = sorted(dataset_dir.glob("*.json"))
    if labels:
        wanted = set(labels)
        label_files = [path for path in label_files if path.stem in wanted]

    rng = random.Random(seed)
    samples = []
    class_names = []

    for json_path in label_files:
        file_label = json_path.stem
        if file_label not in class_names:
            class_names.append(file_label)

        rows = []
        data = load_json(json_path)
        item_values = list(data.values())
        rng.shuffle(item_values)

        for item in item_values:
            item_labels = item.get("labels") or []
            landmark_groups = item.get("landmarks") or []
            for item_label, landmarks in zip(item_labels, landmark_groups):
                if item_label == "no_gesture" and not include_no_gesture:
                    continue
                if item_label != file_label:
                    continue
                try:
                    rows.append(normalize_landmarks(landmarks))
                except ValueError:
                    continue
                if max_samples_per_label and len(rows) >= max_samples_per_label:
                    break
            if max_samples_per_label and len(rows) >= max_samples_per_label:
                break

        samples.extend((file_label, row) for row in rows)

    class_names = sorted(class_names)
    class_to_index = {name: index for index, name in enumerate(class_names)}
    rng.shuffle(samples)

    features = np.vstack([row for _, row in samples]).astype(np.float32)
    targets = np.asarray([class_to_index[label] for label, _ in samples], dtype=np.int64)
    return features, targets, class_names


def make_loader(features, targets, batch_size=256, shuffle=True):
    dataset = TensorDataset(torch.from_numpy(features), torch.from_numpy(targets))
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)


def train_landmark_model(
    train_dir=DEFAULT_TRAIN_DIR,
    test_dir=DEFAULT_TEST_DIR,
    model_path=DEFAULT_MODEL_PATH,
    epochs=12,
    batch_size=256,
    lr=0.001,
    max_samples_per_label=5000,
    seed=42,
):
    torch.manual_seed(seed)
    np.random.seed(seed)
    random.seed(seed)

    train_x, train_y, class_names = collect_landmark_samples(
        train_dir,
        max_samples_per_label=max_samples_per_label,
        seed=seed,
    )
    test_x, test_y, test_classes = collect_landmark_samples(
        test_dir,
        labels=class_names,
        max_samples_per_label=max(500, max_samples_per_label // 5) if max_samples_per_label else 0,
        seed=seed,
    )

    if test_classes != class_names:
        raise RuntimeError("Train and test classes do not match.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LandmarkMLP(num_classes=len(class_names)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()

    train_loader = make_loader(train_x, train_y, batch_size=batch_size, shuffle=True)
    test_loader = make_loader(test_x, test_y, batch_size=batch_size, shuffle=False)

    best_accuracy = 0.0
    best_state = None
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for features, targets in train_loader:
            features = features.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            logits = model(features)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * features.size(0)

        accuracy = evaluate_model(model, test_loader, device)
        avg_loss = total_loss / len(train_loader.dataset)
        print(f"Epoch {epoch + 1}/{epochs} - loss: {avg_loss:.4f} - test_acc: {accuracy:.2f}%")
        if accuracy >= best_accuracy:
            best_accuracy = accuracy
            best_state = model.state_dict()

    model_path = Path(model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_state_dict": best_state or model.state_dict(),
            "classes": class_names,
            "input_size": train_x.shape[1],
            "test_accuracy": best_accuracy,
            "max_samples_per_label": max_samples_per_label,
        },
        model_path,
    )
    print(f"Saved landmark model to {model_path}")
    print(f"Best test accuracy: {best_accuracy:.2f}%")
    return model_path


def evaluate_model(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for features, targets in loader:
            features = features.to(device)
            targets = targets.to(device)
            predictions = model(features).argmax(dim=1)
            correct += (predictions == targets).sum().item()
            total += targets.numel()
    return 100.0 * correct / total if total else 0.0


class LandmarkMLPPredictor:
    def __init__(self, model_path=DEFAULT_MODEL_PATH):
        self.model_path = Path(model_path)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.classes = []
        self._load()

    def _load(self):
        if not self.model_path.is_file():
            return

        checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=True)
        self.classes = checkpoint.get("classes") or []
        input_size = int(checkpoint.get("input_size") or 42)
        if not self.classes:
            raise RuntimeError("Landmark model checkpoint is missing classes.")

        self.model = LandmarkMLP(input_size=input_size, num_classes=len(self.classes)).to(self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

    def available(self):
        return self.model is not None

    def predict(self, landmarks):
        if self.model is None:
            return None

        vector = normalize_landmarks(landmarks)
        tensor = torch.from_numpy(vector).float().unsqueeze(0).to(self.device)
        with torch.no_grad():
            probabilities = torch.softmax(self.model(tensor), dim=1)[0]
        confidence, index = torch.max(probabilities, dim=0)
        label = self.classes[int(index)]
        return {
            "label": label,
            "confidence": round(float(confidence), 4),
            "source": "landmark_mlp",
        }


def main():
    parser = argparse.ArgumentParser(description="Train/evaluate Signova landmark sign classifier.")
    parser.add_argument("--train-dir", type=Path, default=DEFAULT_TRAIN_DIR)
    parser.add_argument("--test-dir", type=Path, default=DEFAULT_TEST_DIR)
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--max-samples-per-label", type=int, default=5000)
    args = parser.parse_args()

    train_landmark_model(
        train_dir=args.train_dir,
        test_dir=args.test_dir,
        model_path=args.model_path,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        max_samples_per_label=args.max_samples_per_label,
    )


if __name__ == "__main__":
    main()
