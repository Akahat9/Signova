import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np

try:
    from Models.multimodal_features import (
        FEATURE_LAYOUT_HANDS_V1,
        FEATURE_LAYOUT_MULTIMODAL_V2,
        HAND_FEATURE_SIZE,
        MULTIMODAL_FEATURE_SIZE,
        compact_body_vector,
        expression_features,
    )
except ImportError:
    from multimodal_features import (
        FEATURE_LAYOUT_HANDS_V1,
        FEATURE_LAYOUT_MULTIMODAL_V2,
        HAND_FEATURE_SIZE,
        MULTIMODAL_FEATURE_SIZE,
        compact_body_vector,
        expression_features,
    )

try:
    import cv2
    import mediapipe as mp
except ImportError:
    cv2 = None
    mp = None

SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
DATA_DIR = AI_SERVICE_DIR / "Data"
OUTPUT_DIR = AI_SERVICE_DIR / "Data" / "processed_sequences"
DEFAULT_SEQUENCE_LENGTH = 40
DEFAULT_FEATURE_SIZE = HAND_FEATURE_SIZE
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".MP4"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".JPG", ".JPEG", ".PNG"}


def save_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def normalize_sequence(sequence, sequence_length=DEFAULT_SEQUENCE_LENGTH, feature_size=DEFAULT_FEATURE_SIZE):
    frames = np.asarray(sequence, dtype=np.float32)
    if frames.ndim == 1:
        frames = frames.reshape(1, -1)
    if frames.shape[1] < feature_size:
        padded = np.zeros((frames.shape[0], feature_size), dtype=np.float32)
        padded[:, : frames.shape[1]] = frames
        frames = padded
    elif frames.shape[1] > feature_size:
        frames = frames[:, :feature_size]
    if len(frames) > sequence_length:
        indices = np.linspace(0, len(frames) - 1, sequence_length).round().astype(int)
        return frames[indices].astype(np.float32)
    output = np.zeros((sequence_length, feature_size), dtype=np.float32)
    output[: len(frames)] = frames
    if len(frames):
        output[len(frames) :] = frames[-1]
    return output


def parse_args():
    parser = argparse.ArgumentParser(description="Build Signova MediaPipe sequence datasets.")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--datasets", nargs="+", default=["isl_cslrt", "asl_citizen", "asl_alphabet", "processed_asl_alphabet"])
    parser.add_argument("--sequence-length", type=int, default=DEFAULT_SEQUENCE_LENGTH)
    parser.add_argument("--max-samples-per-class", type=int, default=8)
    parser.add_argument("--max-classes", type=int, default=120)
    parser.add_argument("--frame-stride", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--asl-splits", nargs="+", default=["train"], choices=["train", "val", "test"], help="ASL Citizen splits to include when collecting samples.")
    parser.add_argument("--exclude-labels", nargs="*", default=[], help="Cleaned labels to exclude from collection.")
    parser.add_argument("--exclude-labels-file", type=Path, help="Text or JSON file containing cleaned labels to exclude.")
    parser.add_argument("--include-labels-file", type=Path, help="Optional text or JSON file restricting collection to specific cleaned labels.")
    parser.add_argument("--classes-path", type=Path, help="Alias for --include-labels-file when supplying a target class-map JSON.")
    parser.add_argument("--min-landmark-frames", type=int, default=6)
    parser.add_argument("--raw-landmarks", action="store_true", help="Store raw MediaPipe coordinates instead of normalized hand features.")
    parser.add_argument(
        "--feature-layout",
        choices=[FEATURE_LAYOUT_HANDS_V1, FEATURE_LAYOUT_MULTIMODAL_V2],
        default=FEATURE_LAYOUT_MULTIMODAL_V2,
        help="multimodal_v2 adds upper-body and facial non-manual signals while preserving the first 126 hand values.",
    )
    parser.add_argument("--detection-confidence", type=float, default=0.5)
    parser.add_argument("--tracking-confidence", type=float, default=0.5)
    parser.add_argument("--model-complexity", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def require_vision_deps():
    if cv2 is None or mp is None:
        raise RuntimeError(
            "OpenCV and MediaPipe are required for landmark extraction. "
            "Install with: pip install opencv-python mediapipe"
        )


def read_csv(path):
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def clean_label(label):
    return "_".join(str(label).strip().lower().replace("/", " ").split())


def load_excluded_labels(labels=None, labels_file=None):
    excluded = {clean_label(label) for label in (labels or []) if str(label).strip()}
    if labels_file:
        path = Path(labels_file)
        if path.is_file():
            if path.suffix.lower() == ".json":
                payload = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(payload, dict):
                    values = payload.get("exclude_labels") or payload.get("labels") or []
                else:
                    values = payload
            else:
                values = path.read_text(encoding="utf-8").splitlines()
            excluded.update(clean_label(label) for label in values if str(label).strip())
    return excluded


def load_included_labels(labels_file=None):
    if not labels_file:
        return set()
    path = Path(labels_file)
    if not path.is_file():
        raise FileNotFoundError(f"Included-label file not found: {path}")
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            values = payload.get("include_labels") or payload.get("labels") or payload.get("classes")
            if values is None and all(str(key).isdigit() for key in payload):
                values = payload.values()
            values = values or []
        else:
            values = payload
    else:
        values = path.read_text(encoding="utf-8").splitlines()
    return {clean_label(label) for label in values if str(label).strip()}


def hand_to_vector(hand, normalize=True):
    points = np.asarray([[landmark.x, landmark.y, landmark.z] for landmark in hand.landmark[:21]], dtype=np.float32)
    if not normalize:
        return points.reshape(-1)

    wrist = points[0].copy()
    points = points - wrist
    xy_scale = float(np.linalg.norm(points[:, :2], axis=1).max())
    z_scale = float(np.max(np.abs(points[:, 2])))
    scale = max(xy_scale, z_scale, 1e-6)
    points = points / scale
    return points.reshape(-1)


def extract_hand_vector(results, normalize=True):
    vector = np.zeros(DEFAULT_FEATURE_SIZE, dtype=np.float32)
    hands = []
    if results.multi_hand_landmarks:
        hands = sorted(results.multi_hand_landmarks, key=lambda hand: hand.landmark[0].x)[:2]
    for hand_index, hand in enumerate(hands):
        offset = hand_index * 63
        vector[offset : offset + 63] = hand_to_vector(hand, normalize=normalize)
    return vector


MEDIAPIPE_TO_COCO_BODY = (0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
MEDIAPIPE_TO_FACE68 = {
    0: 234, 16: 454,
    17: 107, 18: 66, 19: 70, 20: 63, 21: 105,
    22: 336, 23: 300, 24: 293, 25: 334, 26: 296,
    36: 33, 37: 160, 38: 158, 39: 133, 40: 153, 41: 144,
    42: 362, 43: 385, 44: 387, 45: 263, 46: 380, 47: 373,
    48: 61, 54: 291, 57: 17, 62: 13, 66: 14,
}


def mediapipe_points(landmark_list, indices=None):
    if landmark_list is None:
        return []
    landmarks = landmark_list.landmark
    selected = indices if indices is not None else range(len(landmarks))
    return [
        [landmarks[index].x, landmarks[index].y, landmarks[index].z, getattr(landmarks[index], "visibility", 1.0)]
        for index in selected
    ]


def mediapipe_face68(face_landmarks):
    output = [[0.0, 0.0, 0.0, 0.0] for _ in range(68)]
    if face_landmarks is None:
        return output
    output = [[0.0, 0.0, 0.0, 1.0] for _ in range(68)]
    landmarks = face_landmarks.landmark
    for target, source in MEDIAPIPE_TO_FACE68.items():
        point = landmarks[source]
        output[target] = [point.x, point.y, point.z, 1.0]
    return output


def extract_multimodal_vector(results, normalize=True, feature_layout=FEATURE_LAYOUT_MULTIMODAL_V2):
    hands = np.zeros(HAND_FEATURE_SIZE, dtype=np.float32)
    ordered_hands = [results.left_hand_landmarks, results.right_hand_landmarks]
    for hand_index, hand in enumerate(ordered_hands):
        if hand is None:
            continue
        offset = hand_index * 63
        hands[offset : offset + 63] = hand_to_vector(hand, normalize=normalize)
    if feature_layout == FEATURE_LAYOUT_HANDS_V1:
        return hands
    pose = mediapipe_points(results.pose_landmarks, MEDIAPIPE_TO_COCO_BODY)
    face = mediapipe_face68(results.face_landmarks)
    return np.concatenate([hands, compact_body_vector(pose), expression_features(face, pose)]).astype(np.float32)


class MediaPipeExtractor:
    def __init__(self, normalize_landmarks=True, min_landmark_frames=6, detection_confidence=0.5, tracking_confidence=0.5, model_complexity=1, feature_layout=FEATURE_LAYOUT_MULTIMODAL_V2):
        require_vision_deps()
        self.normalize_landmarks = normalize_landmarks
        self.feature_layout = feature_layout
        self.min_landmark_frames = max(1, int(min_landmark_frames))
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            model_complexity=model_complexity,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
        )
        self.image_hands = mp.solutions.hands.Hands(
            static_image_mode=True,
            max_num_hands=2,
            model_complexity=model_complexity,
            min_detection_confidence=detection_confidence,
        )
        self.holistic = mp.solutions.holistic.Holistic(
            static_image_mode=False,
            model_complexity=model_complexity,
            smooth_landmarks=True,
            refine_face_landmarks=False,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
        )
        self.image_holistic = mp.solutions.holistic.Holistic(
            static_image_mode=True,
            model_complexity=model_complexity,
            refine_face_landmarks=False,
            min_detection_confidence=detection_confidence,
        )

    @property
    def feature_size(self):
        return MULTIMODAL_FEATURE_SIZE if self.feature_layout == FEATURE_LAYOUT_MULTIMODAL_V2 else HAND_FEATURE_SIZE

    def extract(self, rgb, image=False):
        if self.feature_layout == FEATURE_LAYOUT_MULTIMODAL_V2:
            results = (self.image_holistic if image else self.holistic).process(rgb)
            vector = extract_multimodal_vector(
                results,
                normalize=self.normalize_landmarks,
                feature_layout=self.feature_layout,
            )
            if not np.any(vector[:HAND_FEATURE_SIZE]):
                hand_results = (self.image_hands if image else self.hands).process(rgb)
                vector[:HAND_FEATURE_SIZE] = extract_hand_vector(
                    hand_results,
                    normalize=self.normalize_landmarks,
                )
            return vector
        results = (self.image_hands if image else self.hands).process(rgb)
        return extract_hand_vector(results, normalize=self.normalize_landmarks)

    def video_to_sequence(self, path, sequence_length, frame_stride):
        capture = cv2.VideoCapture(str(path))
        frames = []
        index = 0
        while capture.isOpened():
            ok, frame = capture.read()
            if not ok:
                break
            if index % max(frame_stride, 1) == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                vector = self.extract(rgb)
                if np.any(vector[:HAND_FEATURE_SIZE]):
                    frames.append(vector)
            index += 1
        capture.release()
        if len(frames) < self.min_landmark_frames:
            return None
        return normalize_sequence(frames, sequence_length=sequence_length, feature_size=self.feature_size)

    def image_to_sequence(self, path, sequence_length):
        frame = cv2.imread(str(path))
        if frame is None:
            return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        vector = self.extract(rgb, image=True)
        if not np.any(vector[:HAND_FEATURE_SIZE]):
            return None
        return normalize_sequence([vector], sequence_length=sequence_length, feature_size=self.feature_size)


def collect_isl_cslrt(max_classes, max_samples_per_class, rng, excluded_labels=None):
    excluded_labels = excluded_labels or set()
    root = DATA_DIR / "ISL_CSLRT_Corpus" / "ISL_CSLRT_Corpus" / "Videos_Sentence_Level"
    if not root.is_dir():
        return []
    samples = []
    buckets = []
    for class_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        videos = [path for path in class_dir.rglob("*") if path.is_file() and path.suffix in VIDEO_EXTENSIONS]
        if clean_label(class_dir.name) in excluded_labels:
            continue
        if videos:
            buckets.append((class_dir, videos))
    buckets.sort(key=lambda item: (-len(item[1]), clean_label(item[0].name)))
    for class_dir, videos in buckets[:max_classes]:
        rng.shuffle(videos)
        for video in videos[:max_samples_per_class]:
            samples.append({"path": video, "label": clean_label(class_dir.name), "source": "ISL_CSLRT", "kind": "video"})
    return samples


def collect_isl_signer_collection(max_classes, max_samples_per_class, rng, excluded_labels=None, included_labels=None):
    excluded_labels = excluded_labels or set()
    included_labels = included_labels or set()
    root = DATA_DIR / "isl_signer_collection"
    if not root.is_dir():
        return []
    buckets = {}
    for metadata_path in root.rglob("*.json"):
        if metadata_path.name == "coverage_report.json":
            continue
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        label = clean_label(metadata.get("sentence", ""))
        signer_code = str(metadata.get("signer_code") or "").strip()
        video_path = metadata_path.parent / str(metadata.get("video") or "")
        if (
            not label
            or label in excluded_labels
            or (included_labels and label not in included_labels)
            or not signer_code
            or not metadata.get("consent_confirmed")
            or metadata.get("quality_status") != "pass"
            or not video_path.is_file()
        ):
            continue
        buckets.setdefault(label, {})
        buckets[label].setdefault(
            signer_code,
            {
                "path": video_path,
                "label": label,
                "source": "ISL_Signer_Collection",
                "kind": "video",
                "signer_code": signer_code,
                "clip_id": metadata.get("clip_id"),
                "consent_version": metadata.get("consent_version"),
            },
        )

    samples = []
    ranked_labels = sorted(buckets, key=lambda label: (-len(buckets[label]), label))[:max_classes]
    for label in ranked_labels:
        signer_samples = list(buckets[label].values())
        rng.shuffle(signer_samples)
        samples.extend(signer_samples[:max_samples_per_class])
    return samples


def collect_asl_citizen(max_classes, max_samples_per_class, rng, splits=None, excluded_labels=None, included_labels=None):
    excluded_labels = excluded_labels or set()
    included_labels = included_labels or set()
    video_root = DATA_DIR / "ASL_Citizen" / "videos"
    if not video_root.is_dir():
        return []
    buckets = {}
    splits = splits or ["train"]
    for split in splits:
        split_path = DATA_DIR / "ASL_Citizen" / "splits" / f"{split}.csv"
        if not split_path.is_file():
            continue
        for row in read_csv(split_path):
            label = clean_label(row.get("Gloss", ""))
            video = video_root / row.get("Video file", "")
            if label and label not in excluded_labels and (not included_labels or label in included_labels) and video.is_file():
                buckets.setdefault(label, []).append(video)
    samples = []
    ranked_labels = sorted(buckets, key=lambda label: (-len(buckets[label]), label))
    for label in ranked_labels[:max_classes]:
        videos = buckets[label]
        rng.shuffle(videos)
        for video in videos[:max_samples_per_class]:
            samples.append({"path": video, "label": label, "source": "ASL_Citizen", "kind": "video"})
    return samples


def collect_image_folder(root, source, max_classes, max_samples_per_class, rng, excluded_labels=None):
    excluded_labels = excluded_labels or set()
    if not root.is_dir():
        return []
    class_dirs = sorted(path for path in root.iterdir() if path.is_dir())[:max_classes]
    samples = []
    for class_dir in class_dirs:
        if clean_label(class_dir.name) in excluded_labels:
            continue
        images = [path for path in class_dir.rglob("*") if path.is_file() and path.suffix in IMAGE_EXTENSIONS]
        rng.shuffle(images)
        for image in images[:max_samples_per_class]:
            samples.append({"path": image, "label": clean_label(class_dir.name), "source": source, "kind": "image"})
    return samples


def collect_processed_asl(max_classes, max_samples_per_class, rng, excluded_labels=None):
    root = DATA_DIR / "processed_asl_alphabet" / "train"
    return collect_image_folder(root, "processed_asl_alphabet", max_classes, max_samples_per_class, rng, excluded_labels=excluded_labels)


def collect_raw_asl(max_classes, max_samples_per_class, rng, excluded_labels=None):
    root = DATA_DIR / "asl_alphabet_train"
    return collect_image_folder(root, "asl_alphabet_train", max_classes, max_samples_per_class, rng, excluded_labels=excluded_labels)


def dataset_inventory():
    how2sign_root = DATA_DIR / "How2Sign"
    crdownload = DATA_DIR / "Unconfirmed 277654.crdownload"
    return {
        "how2sign_ready": how2sign_root.is_dir(),
        "how2sign_note": "download_how2sign.sh is a downloader; run it first before using How2Sign.",
        "incomplete_download_present": crdownload.is_file(),
        "incomplete_download_bytes": crdownload.stat().st_size if crdownload.is_file() else 0,
    }


def main():
    args = parse_args()
    rng = random.Random(args.seed)
    excluded_labels = load_excluded_labels(args.exclude_labels, args.exclude_labels_file)
    included_labels = load_included_labels(args.classes_path or args.include_labels_file)
    collectors = {
        "isl_cslrt": collect_isl_cslrt,
        "isl_signer_collection": collect_isl_signer_collection,
        "asl_citizen": collect_asl_citizen,
        "asl_alphabet": collect_raw_asl,
        "processed_asl_alphabet": collect_processed_asl,
    }

    samples = []
    for name in args.datasets:
        collector = collectors.get(name)
        if collector is None:
            print(f"Skipping unsupported dataset key: {name}")
            continue
        if name == "asl_citizen":
            found = collector(
                args.max_classes,
                args.max_samples_per_class,
                rng,
                splits=args.asl_splits,
                excluded_labels=excluded_labels,
                included_labels=included_labels,
            )
        elif name == "isl_signer_collection":
            found = collector(
                args.max_classes,
                args.max_samples_per_class,
                rng,
                excluded_labels=excluded_labels,
                included_labels=included_labels,
            )
        else:
            found = collector(args.max_classes, args.max_samples_per_class, rng, excluded_labels=excluded_labels)
        print(f"{name}: {len(found)} candidate samples")
        samples.extend(found)

    rng.shuffle(samples)
    inventory = dataset_inventory()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    save_json(args.output_dir / "dataset_inventory.json", inventory)

    if args.dry_run:
        save_json(args.output_dir / "dry_run_samples.json", [{**item, "path": str(item["path"])} for item in samples[:500]])
        print(f"Dry run complete. Candidates: {len(samples)}")
        return

    extractor = MediaPipeExtractor(
        normalize_landmarks=not args.raw_landmarks,
        min_landmark_frames=args.min_landmark_frames,
        detection_confidence=args.detection_confidence,
        tracking_confidence=args.tracking_confidence,
        model_complexity=args.model_complexity,
        feature_layout=args.feature_layout,
    )
    sequences = []
    labels = []
    metadata = []
    failed = []

    for index, sample in enumerate(samples, start=1):
        try:
            if sample["kind"] == "video":
                sequence = extractor.video_to_sequence(sample["path"], args.sequence_length, args.frame_stride)
            else:
                sequence = extractor.image_to_sequence(sample["path"], args.sequence_length)
            if sequence is None:
                failed.append({"path": str(sample["path"]), "reason": "no_landmarks"})
                continue
            sequences.append(sequence)
            labels.append(sample["label"])
            metadata.append({**sample, "path": str(sample["path"])})
            if index % 25 == 0:
                print(f"Processed {index}/{len(samples)} samples")
        except Exception as exc:
            failed.append({"path": str(sample["path"]), "reason": str(exc)})

    class_names = sorted(set(labels))
    class_to_index = {label: idx for idx, label in enumerate(class_names)}
    targets = np.asarray([class_to_index[label] for label in labels], dtype=np.int64)
    feature_size = extractor.feature_size
    features = np.stack(sequences).astype(np.float32) if sequences else np.empty((0, args.sequence_length, feature_size), dtype=np.float32)

    np.savez_compressed(
        args.output_dir / "signova_sequences.npz",
        sequences=features,
        labels=targets,
        class_names=np.asarray(class_names),
    )
    save_json(
        args.output_dir / "sequence_manifest.json",
        {
            "sequence_length": args.sequence_length,
            "feature_size": feature_size,
            "feature_layout": args.feature_layout,
            "feature_components": {
                "hands": HAND_FEATURE_SIZE,
                "upper_body": 27 if args.feature_layout == FEATURE_LAYOUT_MULTIMODAL_V2 else 0,
                "face_body_expression": 12 if args.feature_layout == FEATURE_LAYOUT_MULTIMODAL_V2 else 0,
            },
            "feature_normalization": "raw_mediapipe" if args.raw_landmarks else "wrist_centered_scale_normalized",
            "min_landmark_frames": args.min_landmark_frames,
            "frame_stride": args.frame_stride,
            "detection_confidence": args.detection_confidence,
            "tracking_confidence": args.tracking_confidence,
            "model_complexity": args.model_complexity,
            "asl_splits": args.asl_splits if "asl_citizen" in args.datasets else [],
            "excluded_labels": sorted(excluded_labels),
            "included_labels": sorted(included_labels),
            "samples": len(labels),
            "classes": class_names,
            "metadata": metadata,
            "failed": failed,
            "inventory": inventory,
        },
    )
    print(f"Saved {len(labels)} sequences across {len(class_names)} classes to {args.output_dir}")


if __name__ == "__main__":
    main()
