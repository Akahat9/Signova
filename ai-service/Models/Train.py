import argparse
import json
import os
import random
import shutil
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image, UnidentifiedImageError
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from torchvision.models import ResNet18_Weights


SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
RAW_DATA_DIR = AI_SERVICE_DIR / "Data" / "asl_alphabet_train"
PROCESSED_DATA_DIR = AI_SERVICE_DIR / "Data" / "processed_asl_alphabet"
MODEL_DIR = SCRIPT_DIR

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def parse_args():
    parser = argparse.ArgumentParser(description="Clean and train the ASL alphabet model.")
    parser.add_argument("--raw-dir", type=Path, default=RAW_DATA_DIR)
    parser.add_argument("--processed-dir", type=Path, default=PROCESSED_DATA_DIR)
    parser.add_argument("--model-path", type=Path, default=MODEL_DIR / "asl_alphabet_resnet18.pth")
    parser.add_argument("--class-map-path", type=Path, default=MODEL_DIR / "asl_alphabet_classes.json")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--rebuild", action="store_true", help="Rebuild the cleaned split.")
    parser.add_argument("--skip-clean", action="store_true", help="Train using the existing processed split.")
    parser.add_argument("--clean-only", action="store_true", help="Clean/split the dataset without training.")
    parser.add_argument("--max-images-per-class", type=int, default=0, help="Limit images per class for quick experiments.")
    parser.add_argument("--freeze-backbone", action="store_true", help="Train only the final classifier layer.")
    return parser.parse_args()


def iter_images(class_dir):
    for path in sorted(class_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def verify_image(path):
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, UnidentifiedImageError):
        return False


def link_or_copy(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return

    try:
        os.link(source, destination)
    except OSError:
        if destination.exists() or os.path.exists(destination):
            try:
                if os.path.samefile(source, destination):
                    return
            except OSError:
                pass
        shutil.copy2(source, destination)


def clean_and_split(raw_dir, processed_dir, val_split, seed, rebuild, max_images_per_class=0):
    if not raw_dir.is_dir():
        raise FileNotFoundError(f"Raw dataset not found: {raw_dir}")

    if processed_dir.exists() and rebuild:
        shutil.rmtree(processed_dir)

    train_dir = processed_dir / "train"
    val_dir = processed_dir / "val"

    if train_dir.is_dir() and val_dir.is_dir() and not rebuild:
        print(f"Using existing cleaned dataset: {processed_dir}")
        return

    rng = random.Random(seed)
    classes = sorted(path.name for path in raw_dir.iterdir() if path.is_dir())
    if not classes:
        raise RuntimeError(f"No class folders found in {raw_dir}")

    summary = {
        "raw_dir": str(raw_dir),
        "processed_dir": str(processed_dir),
        "val_split": val_split,
        "seed": seed,
        "classes": {},
    }

    print(f"Cleaning {len(classes)} classes from {raw_dir}")
    for class_name in classes:
        class_dir = raw_dir / class_name
        valid_images = []
        invalid_images = []

        for image_path in iter_images(class_dir):
            if verify_image(image_path):
                valid_images.append(image_path)
            else:
                invalid_images.append(str(image_path))
            if max_images_per_class > 0 and len(valid_images) >= max_images_per_class:
                break

        rng.shuffle(valid_images)
        val_count = max(1, int(len(valid_images) * val_split)) if valid_images else 0
        val_images = set(valid_images[:val_count])

        for image_path in valid_images:
            split = "val" if image_path in val_images else "train"
            target = processed_dir / split / class_name / image_path.name
            link_or_copy(image_path, target)

        summary["classes"][class_name] = {
            "valid": len(valid_images),
            "invalid": len(invalid_images),
            "train": len(valid_images) - val_count,
            "val": val_count,
            "invalid_files": invalid_images,
        }
        print(
            f"{class_name}: {len(valid_images) - val_count} train, "
            f"{val_count} val, {len(invalid_images)} invalid"
        , flush=True)

    processed_dir.mkdir(parents=True, exist_ok=True)
    with (processed_dir / "cleaning_summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)


def build_dataloaders(processed_dir, batch_size, num_workers):
    train_root = processed_dir / "train"
    val_root = processed_dir / "val"
    if not train_root.is_dir() or not val_root.is_dir():
        raise FileNotFoundError(f"Expected train/val folders under {processed_dir}")

    train_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ColorJitter(brightness=0.15, contrast=0.15),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    val_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    train_data = datasets.ImageFolder(root=train_root, transform=train_transform)
    val_data = datasets.ImageFolder(root=val_root, transform=val_transform)

    train_loader = DataLoader(
        train_data,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_data,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    return train_data, val_data, train_loader, val_loader


def train(args):
    if not args.skip_clean:
        clean_and_split(
            args.raw_dir,
            args.processed_dir,
            args.val_split,
            args.seed,
            args.rebuild,
            args.max_images_per_class,
        )

    if args.clean_only:
        print(f"Cleaned dataset is ready at {args.processed_dir}")
        return

    train_data, val_data, train_loader, val_loader = build_dataloaders(
        args.processed_dir,
        args.batch_size,
        args.num_workers,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)
    print("Classes:", train_data.classes)
    print(f"Train images: {len(train_data)}")
    print(f"Validation images: {len(val_data)}")

    weights = ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)
    if args.freeze_backbone:
        for parameter in model.parameters():
            parameter.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, len(train_data.classes))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam((p for p in model.parameters() if p.requires_grad), lr=args.lr)

    best_acc = 0.0
    for epoch in range(args.epochs):
        model.train()
        running_loss = 0.0

        for images, labels in train_loader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)

        epoch_loss = running_loss / len(train_data)

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device, non_blocking=True)
                labels = labels.to(device, non_blocking=True)
                outputs = model(images)
                predicted = outputs.argmax(dim=1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()

        val_acc = 100.0 * correct / total if total else 0.0
        print(
            f"Epoch {epoch + 1}/{args.epochs} - "
            f"loss: {epoch_loss:.4f} - val_acc: {val_acc:.2f}%"
        )

        if val_acc >= best_acc:
            best_acc = val_acc
            args.model_path.parent.mkdir(parents=True, exist_ok=True)
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "classes": train_data.classes,
                    "val_accuracy": val_acc,
                    "epoch": epoch + 1,
                },
                args.model_path,
            )

    with args.class_map_path.open("w", encoding="utf-8") as handle:
        json.dump({idx: name for idx, name in enumerate(train_data.classes)}, handle, indent=2)

    print(f"Best validation accuracy: {best_acc:.2f}%")
    print(f"Model saved to {args.model_path}")
    print(f"Class map saved to {args.class_map_path}")


if __name__ == "__main__":
    train(parse_args())
