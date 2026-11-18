"""MediaPipe Tasks Holistic tracker for Signova live-sign input.

It is intentionally a selectable tracker, not an unconditional RTMW replacement.
Both engines return the same session/sequence contract so their real-call
latency and hand visibility can be compared safely.
"""
from collections import deque
import os
from pathlib import Path
import threading
import time

import cv2
import numpy as np

try:
    from Models.multimodal_features import non_manual_summary
    from Models.rtmw_engine import WholeBodySession, decode_base64_frame, visible_bbox
except ImportError:
    from multimodal_features import non_manual_summary
    from rtmw_engine import WholeBodySession, decode_base64_frame, visible_bbox


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = SCRIPT_DIR / "holistic_landmarker.task"


def _normalized_points(landmarks):
    return [
        {
            "x": round(float(point.x), 6),
            "y": round(float(point.y), 6),
            "z": round(float(point.z), 6),
            "score": round(float(getattr(point, "visibility", None) or getattr(point, "presence", None) or 1.0), 4),
            "visible": bool((getattr(point, "visibility", None) or getattr(point, "presence", None) or 1.0) >= 0.2),
        }
        for point in (landmarks or [])
    ]


def _point_matrix(points, width, height):
    return np.asarray([[point["x"] * width, point["y"] * height] for point in points], dtype=np.float32)


class MediaPipeHolisticEngine:
    """One-person holistic tracker with the RTMW-compatible session API."""

    def __init__(self):
        self.enabled = os.getenv("SIGNOVA_HOLISTIC_ENABLED", "1").lower() not in {"0", "false", "no"}
        self.model_path = Path(os.getenv("SIGNOVA_HOLISTIC_MODEL_PATH", str(DEFAULT_MODEL_PATH)))
        self.max_frame_dimension = int(os.getenv("SIGNOVA_HOLISTIC_MAX_FRAME_DIMENSION", "960"))
        self.session_ttl = float(os.getenv("SIGNOVA_RTMW_SESSION_TTL", "120"))
        self.buffer_size = int(os.getenv("SIGNOVA_RTMW_BUFFER_SIZE", "48"))
        self.model = None
        self.error = None
        self.sessions = {}
        self.inference_latencies = deque(maxlen=240)
        self.lock = threading.RLock()
        self.inference_lock = threading.Lock()

    def _load(self):
        if self.model is not None or self.error is not None or not self.enabled:
            return
        if not self.model_path.is_file():
            self.error = f"Holistic model asset is missing: {self.model_path}"
            return
        try:
            import mediapipe as mp

            options = mp.tasks.vision.HolisticLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(self.model_path)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                min_face_detection_confidence=0.45,
                min_face_landmarks_confidence=0.45,
                min_pose_detection_confidence=0.45,
                min_pose_landmarks_confidence=0.45,
                min_hand_landmarks_confidence=0.40,
                output_face_blendshapes=False,
            )
            self.model = mp.tasks.vision.HolisticLandmarker.create_from_options(options)
            self._mp = mp
        except Exception as exc:
            self.error = str(exc)

    def available(self):
        self._load()
        return self.model is not None

    def _cleanup(self, now):
        stale = [key for key, value in self.sessions.items() if now - value.last_seen > self.session_ttl]
        for key in stale:
            del self.sessions[key]

    def clear_session(self, session_id):
        with self.lock:
            return self.sessions.pop(session_id, None) is not None

    def _person_from_result(self, result, width, height, timestamp):
        pose = _normalized_points(result.pose_landmarks)
        left_hand = _normalized_points(result.left_hand_landmarks)
        right_hand = _normalized_points(result.right_hand_landmarks)
        face = _normalized_points(result.face_landmarks)
        all_points = pose + left_hand + right_hand
        if not all_points:
            return None
        keypoints = _point_matrix(all_points, width, height)
        scores = np.asarray([point["score"] for point in all_points], dtype=np.float32)
        box = visible_bbox(keypoints, scores, 0.2)
        if not box:
            return None
        pose_visible = sum(point["visible"] for point in pose)
        left_visible = sum(point["visible"] for point in left_hand)
        right_visible = sum(point["visible"] for point in right_hand)
        hand_visibility = (left_visible + right_visible) / 42.0
        return {
            "bbox_pixels": box,
            "bbox": [round(box[0] / width, 6), round(box[1] / height, 6), round(box[2] / width, 6), round(box[3] / height, 6)],
            "pose": pose,
            "face": face,
            "left_hand": left_hand,
            "right_hand": right_hand,
            "non_manual": non_manual_summary(face, pose),
            "quality": {
                "pose_visible": pose_visible,
                "left_hand_visible": left_visible,
                "right_hand_visible": right_visible,
                "hand_visibility": round(hand_visibility, 4),
            },
            "active_signer_score": round((0.70 * hand_visibility) + (0.30 * min(pose_visible / 33.0, 1.0)), 6),
            "timestamp": timestamp,
        }

    def sequence_frames(self, session_id, person_id=None):
        with self.lock:
            session = self.sessions.get(session_id)
            if not session:
                return [], person_id
            people, active_person_id = session.result()
            track = session.tracks.get(person_id or active_person_id)
            if not track:
                return [], person_id or active_person_id
            frames = []
            for person in track.frames:
                hands = [[ [item["x"], item["y"], item["z"]] for item in person.get(key, []) ] for key in ("left_hand", "right_hand")]
                frames.append({
                    "hands": hands,
                    "landmarks": hands[0] if hands[0] else hands[1],
                    "pose": [[item["x"], item["y"], item["z"], item["score"]] for item in person.get("pose", [])],
                    "face": [[item["x"], item["y"], item["z"], item["score"]] for item in person.get("face", [])],
                    "feature_layout": "multimodal_v2", "person_id": person.get("person_id"), "timestamp": person.get("timestamp"),
                })
            return frames, track.track_id

    def process_base64(self, image_base64, session_id="default", timestamp=None, include_landmarks=True, person_id=None, lock_person=False):
        self._load()
        if self.model is None:
            raise RuntimeError(self.error or "MediaPipe Holistic is unavailable.")
        frame = decode_base64_frame(image_base64)
        if max(frame.shape[:2]) > self.max_frame_dimension:
            ratio = self.max_frame_dimension / max(frame.shape[:2])
            frame = cv2.resize(frame, None, fx=ratio, fy=ratio, interpolation=cv2.INTER_AREA)
        timestamp = float(time.time() if timestamp is None else timestamp)
        image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        started = time.perf_counter()
        with self.inference_lock:
            result = self.model.detect_for_video(image, int(timestamp * 1000))
        inference_ms = (time.perf_counter() - started) * 1000.0
        height, width = frame.shape[:2]
        person = self._person_from_result(result, width, height, timestamp)
        with self.lock:
            self._cleanup(timestamp)
            session = self.sessions.setdefault(session_id, WholeBodySession(session_id, self.buffer_size))
            session.update([person] if person else [], timestamp)
            if lock_person:
                session.set_manual_person(person_id)
            people, active_person_id = session.result(timestamp)
            self.inference_latencies.append(inference_ms)
        active = next((item for item in people if item.get("person_id") == active_person_id), None)
        response_people = people if include_landmarks else [{
            "person_id": item["person_id"], "bbox": item.get("bbox"), "quality": item.get("quality"),
            "non_manual": item.get("non_manual"), "active_signer_score": item.get("active_signer_score"),
        } for item in people]
        reliable_hands = sum(int(item["quality"]["left_hand_visible"] >= 6) + int(item["quality"]["right_hand_visible"] >= 6) for item in people)
        return {
            "engine": "MediaPipe HolisticLandmarker", "session_id": session_id, "timestamp": timestamp,
            "frame": {"width": width, "height": height}, "people": response_people, "people_count": len(people),
            "detected_hands": sum(int(item["quality"]["left_hand_visible"] > 0) + int(item["quality"]["right_hand_visible"] > 0) for item in people),
            "reliable_hands": reliable_hands, "active_person_id": active_person_id,
            "active_person_score": active.get("active_signer_score") if active else None,
            "tracking_state": "active" if active_person_id else "searching",
            "recommended_interval_ms": int(min(1200, max(260, inference_ms * 1.2))),
            "latency": {"inference_ms": round(inference_ms, 2)},
        }

    def status(self):
        latencies = list(self.inference_latencies)
        return {
            "enabled": self.enabled, "available": self.available(), "model": "MediaPipe HolisticLandmarker Tasks",
            "model_path": self.model_path.name, "session_count": len(self.sessions),
            "runtime": {"inference_mean_ms": round(float(np.mean(latencies)), 2) if latencies else None},
            "error": self.error, "privacy": "Frames are processed in memory and are not saved.",
        }

    def runtime_metrics(self):
        return self.status()["runtime"]
