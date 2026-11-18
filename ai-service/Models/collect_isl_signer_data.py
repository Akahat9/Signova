import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import time

import cv2
import mediapipe as mp
import numpy as np


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = AI_SERVICE_DIR / "Data" / "isl_signer_collection"
DEFAULT_CLASSES_PATH = AI_SERVICE_DIR / "Models" / "signova_isl_gru_top30_clean_v3_classes.json"
CONSENT_VERSION = "signova-isl-training-consent-v1"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def safe_name(value):
    return "".join(char if char.isalnum() or char in "-_" else "-" for char in str(value).strip().lower()).strip("-")


def normalize_sentence(value):
    return "_".join(str(value).strip().lower().replace("/", " ").split())


def load_classes(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    values = payload.values() if isinstance(payload, dict) else payload
    return [str(value) for value in values]


def display_sentence(label):
    return str(label).replace("_", " ").replace(",", ", ").strip().capitalize()


def clip_id(sentence, signer_code, take):
    value = f"{sentence}|{signer_code}|{take}|{CONSENT_VERSION}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def inspect_clip(path):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        return None

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    sample_step = max(1, frames // 24)
    brightness = []
    sharpness = []
    hand_frames = 0
    two_hand_frames = 0
    face_frames = 0
    upper_body_frames = 0
    sampled_frames = 0
    hands = mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=2,
        model_complexity=1,
        min_detection_confidence=0.45,
    )
    holistic = mp.solutions.holistic.Holistic(
        static_image_mode=True,
        model_complexity=1,
        refine_face_landmarks=False,
        min_detection_confidence=0.45,
    )
    index = 0
    while capture.isOpened():
        ok, frame = capture.read()
        if not ok:
            break
        if index % sample_step == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness.append(float(gray.mean()))
            sharpness.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(rgb)
            wholebody = holistic.process(rgb)
            detected = len(results.multi_hand_landmarks or [])
            hand_frames += int(detected >= 1)
            two_hand_frames += int(detected >= 2)
            face_frames += int(wholebody.face_landmarks is not None)
            upper_body_frames += int(
                wholebody.pose_landmarks is not None
                and all(
                    wholebody.pose_landmarks.landmark[index].visibility >= 0.45
                    for index in (11, 12, 23, 24)
                )
            )
            sampled_frames += 1
        index += 1
    hands.close()
    holistic.close()
    capture.release()

    duration = frames / fps if fps else 0.0
    return {
        "fps": round(fps, 2),
        "frames": frames,
        "width": width,
        "height": height,
        "duration_seconds": round(duration, 2),
        "mean_brightness": round(float(np.mean(brightness)), 2) if brightness else 0.0,
        "mean_sharpness": round(float(np.mean(sharpness)), 2) if sharpness else 0.0,
        "hand_visibility_ratio": round(hand_frames / sampled_frames, 4) if sampled_frames else 0.0,
        "two_hand_ratio": round(two_hand_frames / sampled_frames, 4) if sampled_frames else 0.0,
        "face_visibility_ratio": round(face_frames / sampled_frames, 4) if sampled_frames else 0.0,
        "upper_body_visibility_ratio": round(upper_body_frames / sampled_frames, 4) if sampled_frames else 0.0,
        "sampled_frames": sampled_frames,
    }


def quality_issues(media, min_duration, max_duration):
    if not media:
        return ["video_unreadable"]
    issues = []
    if media["duration_seconds"] < min_duration:
        issues.append("video_too_short")
    if media["duration_seconds"] > max_duration:
        issues.append("video_too_long")
    if media["width"] < 640 or media["height"] < 360:
        issues.append("resolution_too_low")
    if media["fps"] < 20:
        issues.append("frame_rate_too_low")
    if media["mean_brightness"] < 35:
        issues.append("lighting_too_dark")
    if media["mean_sharpness"] < 35:
        issues.append("video_too_blurry")
    if media["hand_visibility_ratio"] < 0.65:
        issues.append("hands_not_visible_enough")
    if media["face_visibility_ratio"] < 0.65:
        issues.append("face_not_visible_enough")
    if media["upper_body_visibility_ratio"] < 0.65:
        issues.append("upper_body_not_visible_enough")
    return issues


def open_camera(camera_index, backend):
    """Open a Windows webcam with a backend that can sustain video capture."""
    choices = []
    if backend == "dshow":
        choices = [("DirectShow", cv2.CAP_DSHOW)]
    elif backend == "msmf":
        choices = [("Media Foundation", cv2.CAP_MSMF)]
    elif backend == "any":
        choices = [("default", None)]
    elif os.name == "nt":
        # Some laptop cameras report as opened through DirectShow but only
        # produce a black/stalled stream. Prefer OpenCV's default selection;
        # it produced stable frames in the local diagnostic.
        choices = [("default", None), ("Media Foundation", cv2.CAP_MSMF), ("DirectShow", cv2.CAP_DSHOW)]
    else:
        choices = [("default", None)]
    for name, api in choices:
        capture = cv2.VideoCapture(camera_index) if api is None else cv2.VideoCapture(camera_index, api)
        if capture.isOpened():
            return capture, name
        capture.release()
    raise RuntimeError(f"Could not open camera {camera_index} with backend={backend}.")


def read_with_retry(capture, deadline, retry_delay=0.03):
    """Avoid ending a take because a webcam temporarily returns one empty frame."""
    while time.perf_counter() < deadline:
        ok, frame = capture.read()
        if ok:
            return frame
        time.sleep(retry_delay)
    return None


def record_camera(args, output_path, sentence):
    capture, backend_name = open_camera(args.camera, args.camera_backend)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open camera {args.camera}.")
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    capture.set(cv2.CAP_PROP_FPS, args.fps)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or args.width)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or args.height)
    fps = float(capture.get(cv2.CAP_PROP_FPS) or args.fps)
    writer = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        capture.release()
        raise RuntimeError(f"Could not create video: {output_path}")

    print(f"Sentence: {display_sentence(sentence)}")
    print(f"Camera backend: {backend_name}")
    print("Keep face, upper body, and both hands visible. Sign naturally once.")
    # Some Windows drivers return a few stale frames just after opening.
    warmup_deadline = time.perf_counter() + 1.0
    while time.perf_counter() < warmup_deadline:
        capture.read()
    if args.headless_seconds:
        print(f"Headless recording starts in 3 seconds and runs for {args.headless_seconds:.1f} seconds.")
        time.sleep(3)
        started_at = time.perf_counter()
        deadline = started_at + args.headless_seconds
        frames = 0
        try:
            while time.perf_counter() < deadline:
                frame = read_with_retry(capture, deadline)
                if frame is None:
                    break
                writer.write(frame)
                frames += 1
        finally:
            writer.release()
            capture.release()
        if frames == 0:
            output_path.unlink(missing_ok=True)
            raise RuntimeError("No camera frames were captured.")
        minimum_frames = max(1, int(args.headless_seconds * max(1.0, fps) * 0.5))
        if frames < minimum_frames:
            output_path.unlink(missing_ok=True)
            raise RuntimeError(
                f"Camera stream stopped early: captured {frames} frames; expected at least {minimum_frames}. "
                "Try --camera-backend dshow or close another app using the camera."
            )
        return

    print("Press R to record, S to save, or Q to cancel.")
    started_at = None
    frames = 0
    cancelled = False
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            preview = frame.copy()
            recording = started_at is not None
            elapsed = time.perf_counter() - started_at if recording else 0.0
            if recording:
                writer.write(frame)
                frames += 1
            cv2.rectangle(preview, (0, 0), (width, 92), (8, 24, 40), -1)
            status = f"REC {elapsed:04.1f}s" if recording else "READY - press R"
            cv2.putText(preview, status, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (52, 225, 255), 2)
            cv2.putText(preview, display_sentence(sentence)[:72], (18, 61), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (245, 250, 255), 1)
            cv2.putText(preview, "Face, upper body and both hands visible", (18, 84), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (190, 225, 240), 1)
            cv2.imshow("Signova ISL Training Collector", preview)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                cancelled = True
                break
            if key == ord("r") and not recording:
                started_at = time.perf_counter()
            if key == ord("s") and recording:
                break
            if recording and elapsed >= args.max_duration:
                break
    except cv2.error as error:
        output_path.unlink(missing_ok=True)
        raise RuntimeError(
            "OpenCV preview windows are unavailable in this environment. "
            "Run again with --headless-seconds 5, or install a GUI-enabled OpenCV build."
        ) from error
    finally:
        writer.release()
        capture.release()
        try:
            cv2.destroyAllWindows()
        except cv2.error:
            pass
    if cancelled or frames == 0:
        output_path.unlink(missing_ok=True)
        raise RuntimeError("Recording cancelled or no frames captured.")


def main():
    parser = argparse.ArgumentParser(description="Collect consented multi-signer ISL sentence training clips.")
    parser.add_argument("--sentence", required=True, help="Sentence label from the configured ISL class list.")
    parser.add_argument("--signer-code", required=True, help="Pseudonymous signer code. Do not use name, email, or phone.")
    parser.add_argument("--take", type=int, default=1)
    parser.add_argument("--input-video", type=Path, help="Import a consented existing video instead of recording.")
    parser.add_argument("--classes-path", type=Path, default=DEFAULT_CLASSES_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument(
        "--camera-backend", choices=["auto", "dshow", "msmf", "any"], default="auto",
        help="Windows capture backend. Auto tries DirectShow, Media Foundation, then the default backend.",
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--min-duration", type=float, default=2.0)
    parser.add_argument("--max-duration", type=float, default=12.0)
    parser.add_argument(
        "--headless-seconds", type=float, default=0.0,
        help="Record a fixed duration without an OpenCV preview window; use when cv2.imshow is unavailable.",
    )
    parser.add_argument("--consent", action="store_true", help="Confirm the signer consented to recording and model training.")
    args = parser.parse_args()

    if not args.consent:
        raise SystemExit("Collection stopped: pass --consent only after the signer agrees to recording and model training.")
    if args.headless_seconds < 0 or args.headless_seconds > args.max_duration:
        raise SystemExit("--headless-seconds must be between 0 and --max-duration.")
    classes = load_classes(args.classes_path)
    sentence = normalize_sentence(args.sentence)
    if sentence not in classes:
        raise SystemExit(f"Unknown sentence label: {sentence}. Use one of the labels in {args.classes_path}.")
    signer_code = safe_name(args.signer_code)
    if not signer_code or signer_code in {"anonymous", "unknown", "test"}:
        raise SystemExit("Use a stable pseudonymous signer code so independent signer coverage can be measured.")

    sentence_dir = args.output_dir / sentence
    sentence_dir.mkdir(parents=True, exist_ok=True)
    identifier = clip_id(sentence, signer_code, args.take)
    output_path = sentence_dir / f"{signer_code}__take-{args.take:02d}__{identifier}.mp4"
    metadata_path = output_path.with_suffix(".json")
    if output_path.exists() or metadata_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing clip: {output_path}")

    if args.input_video:
        if not args.input_video.is_file() or args.input_video.suffix.lower() not in VIDEO_EXTENSIONS:
            raise FileNotFoundError(args.input_video)
        shutil.copy2(args.input_video, output_path)
        source = "imported"
    else:
        record_camera(args, output_path, sentence)
        source = "camera"

    media = inspect_clip(output_path)
    issues = quality_issues(media, args.min_duration, args.max_duration)
    payload = {
        "clip_id": identifier,
        "video": output_path.name,
        "sentence": sentence,
        "display_sentence": display_sentence(sentence),
        "signer_code": signer_code,
        "take": args.take,
        "source": source,
        "consent_confirmed": True,
        "consent_version": CONSENT_VERSION,
        "privacy": "Pseudonymous training clip. Do not publish or share outside approved Signova training use.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "media": media,
        "quality_status": "pass" if not issues else "needs_review",
        "quality_issues": issues,
    }
    metadata_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"video": str(output_path), "metadata": str(metadata_path), **payload}, indent=2))
    raise SystemExit(0 if not issues else 2)


if __name__ == "__main__":
    main()
