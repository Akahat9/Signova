import base64
from collections import deque
import io
import os
import threading
import time

import cv2
import numpy as np

try:
    from Models.multimodal_features import non_manual_summary
except ImportError:
    from multimodal_features import non_manual_summary


BODY_SLICE = slice(0, 17)
FACE_SLICE = slice(23, 91)
LEFT_HAND_SLICE = slice(91, 112)
RIGHT_HAND_SLICE = slice(112, 133)


def decode_base64_frame(value):
    if "," in value:
        value = value.split(",", 1)[1]
    data = np.frombuffer(base64.b64decode(value), dtype=np.uint8)
    frame = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode video frame.")
    return frame


def normalize_points(points, scores, width, height, threshold=0.2):
    output = []
    for point, score in zip(points, scores):
        visible = bool(score >= threshold)
        output.append(
            {
                "x": round(float(point[0]) / max(width, 1), 6) if visible else 0.0,
                "y": round(float(point[1]) / max(height, 1), 6) if visible else 0.0,
                "z": 0.0,
                "score": round(float(score), 4),
                "visible": visible,
            }
        )
    return output


def visible_bbox(points, scores, threshold=0.2):
    mask = np.asarray(scores) >= threshold
    if not np.any(mask):
        return None
    visible = np.asarray(points)[mask]
    minimum = visible.min(axis=0)
    maximum = visible.max(axis=0)
    return [float(minimum[0]), float(minimum[1]), float(maximum[0]), float(maximum[1])]


def bbox_center(box):
    return np.asarray([(box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0], dtype=np.float32)


def bbox_diagonal(box):
    return max(float(np.linalg.norm(np.asarray(box[2:]) - np.asarray(box[:2]))), 1.0)


def bbox_iou(first, second):
    left = max(first[0], second[0])
    top = max(first[1], second[1])
    right = min(first[2], second[2])
    bottom = min(first[3], second[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    first_area = max(0.0, first[2] - first[0]) * max(0.0, first[3] - first[1])
    second_area = max(0.0, second[2] - second[0]) * max(0.0, second[3] - second[1])
    union = first_area + second_area - intersection
    return intersection / union if union > 0.0 else 0.0


def hand_motion(previous, current):
    if not previous:
        return 0.0
    motions = []
    for key in ("left_hand", "right_hand"):
        old = [point for point in previous.get(key, []) if point.get("visible")]
        new = [point for point in current.get(key, []) if point.get("visible")]
        if len(old) != len(new) or not old:
            continue
        old_xy = np.asarray([[point["x"], point["y"]] for point in old], dtype=np.float32)
        new_xy = np.asarray([[point["x"], point["y"]] for point in new], dtype=np.float32)
        motions.append(float(np.linalg.norm(new_xy - old_xy, axis=1).mean()))
    return float(np.mean(motions)) if motions else 0.0


def model_hand_points(points):
    return [
        [float(point.get("x") or 0.0), float(point.get("y") or 0.0), float(point.get("z") or 0.0)]
        for point in points
    ]


def model_points(points):
    return [
        [
            float(point.get("x") or 0.0),
            float(point.get("y") or 0.0),
            float(point.get("z") or 0.0),
            float(point.get("score") or 0.0),
        ]
        for point in points
    ]


class PersonTrack:
    def __init__(self, track_id, person, timestamp, buffer_size):
        self.track_id = track_id
        self.last_seen = timestamp
        self.frames = deque(maxlen=buffer_size)
        self.motion_ema = 0.0
        self.center_velocity = np.zeros(2, dtype=np.float32)
        self.update(person, timestamp)

    def update(self, person, timestamp):
        previous = self.frames[-1] if self.frames else None
        motion = hand_motion(previous, person)
        self.motion_ema = (0.65 * motion) + (0.35 * self.motion_ema)
        if previous and previous.get("bbox_pixels") and person.get("bbox_pixels"):
            elapsed = max(float(timestamp) - float(self.last_seen), 1e-3)
            measured_velocity = (
                bbox_center(person["bbox_pixels"]) - bbox_center(previous["bbox_pixels"])
            ) / elapsed
            self.center_velocity = (0.55 * measured_velocity) + (0.45 * self.center_velocity)
        person["person_id"] = self.track_id
        person["hand_motion"] = round(self.motion_ema, 6)
        self.frames.append(person)
        self.last_seen = timestamp

    @property
    def latest(self):
        return self.frames[-1]

    def predicted_box(self, timestamp):
        box = self.latest.get("bbox_pixels")
        if not box:
            return None
        elapsed = min(max(float(timestamp) - float(self.last_seen), 0.0), 0.75)
        shift = self.center_velocity * elapsed
        return [
            float(box[0] + shift[0]),
            float(box[1] + shift[1]),
            float(box[2] + shift[0]),
            float(box[3] + shift[1]),
        ]


class WholeBodySession:
    def __init__(
        self,
        session_id,
        buffer_size=48,
        switch_margin=0.08,
        switch_hold_seconds=0.9,
        min_active_seconds=1.8,
        active_lost_seconds=1.2,
        active_score_minimum=0.28,
        multi_person_motion_minimum=0.003,
        initial_acquire_seconds=0.4,
    ):
        self.session_id = session_id
        self.buffer_size = buffer_size
        self.tracks = {}
        self.next_track_id = 1
        self.last_seen = time.time()
        self.active_person_id = None
        self.active_since = 0.0
        self.candidate_person_id = None
        self.candidate_since = 0.0
        self.manual_person_id = None
        self.switch_count = 0
        self.switch_margin = switch_margin
        self.switch_hold_seconds = switch_hold_seconds
        self.min_active_seconds = min_active_seconds
        self.active_lost_seconds = active_lost_seconds
        self.active_score_minimum = active_score_minimum
        self.multi_person_motion_minimum = multi_person_motion_minimum
        self.initial_acquire_seconds = initial_acquire_seconds

    def _new_track(self, person, timestamp):
        track_id = f"person_{self.next_track_id}"
        self.next_track_id += 1
        self.tracks[track_id] = PersonTrack(track_id, person, timestamp, self.buffer_size)

    def update(self, people, timestamp):
        unmatched_tracks = set(self.tracks)
        unmatched_people = set(range(len(people)))
        candidates = []
        for track_id, track in self.tracks.items():
            old_box = track.predicted_box(timestamp)
            if not old_box:
                continue
            for index, person in enumerate(people):
                box = person.get("bbox_pixels")
                if not box:
                    continue
                distance = float(np.linalg.norm(bbox_center(old_box) - bbox_center(box)))
                normalized_distance = distance / max(bbox_diagonal(old_box), bbox_diagonal(box))
                overlap_penalty = 1.0 - bbox_iou(old_box, box)
                scale_change = abs(np.log(bbox_diagonal(box) / bbox_diagonal(old_box)))
                association_cost = (
                    (0.68 * normalized_distance)
                    + (0.22 * overlap_penalty)
                    + (0.10 * min(scale_change, 1.0))
                )
                candidates.append((association_cost, normalized_distance, track_id, index))

        for cost, distance, track_id, index in sorted(candidates):
            if (cost > 0.72 and distance > 0.42) or distance > 0.85 or track_id not in unmatched_tracks or index not in unmatched_people:
                continue
            self.tracks[track_id].update(people[index], timestamp)
            unmatched_tracks.remove(track_id)
            unmatched_people.remove(index)

        for index in unmatched_people:
            self._new_track(people[index], timestamp)

        stale = [track_id for track_id, track in self.tracks.items() if timestamp - track.last_seen > 2.0]
        for track_id in stale:
            del self.tracks[track_id]
        if self.manual_person_id not in self.tracks:
            self.manual_person_id = None
        self.last_seen = timestamp

    def set_manual_person(self, person_id):
        self.manual_person_id = person_id if person_id in self.tracks else None
        if self.manual_person_id:
            self.active_person_id = self.manual_person_id
            self.active_since = time.time()
            self.candidate_person_id = None
        return self.manual_person_id

    def _resolve_active(self, people, timestamp):
        available = {person["person_id"]: person for person in people}
        if self.manual_person_id in available:
            return self.manual_person_id

        ranked = sorted(
            (person for person in people if float(person.get("active_signer_score") or 0.0) >= self.active_score_minimum),
            key=lambda item: item.get("active_signer_score", 0.0),
            reverse=True,
        )
        best = ranked[0] if ranked else None
        current = available.get(self.active_person_id)

        if current is None and len(available) > 1:
            moving = [
                person for person in available.values()
                if float(person.get("hand_motion") or 0.0) >= self.multi_person_motion_minimum
            ]
            if moving:
                best = max(
                    moving,
                    key=lambda person: (
                        float(person.get("hand_motion") or 0.0)
                        * max(float((person.get("quality") or {}).get("hand_visibility") or 0.0), 0.1)
                    ),
                )
                if self.candidate_person_id != best["person_id"]:
                    self.candidate_person_id = best["person_id"]
                    self.candidate_since = timestamp
                    if self.initial_acquire_seconds > 0:
                        return None
                if timestamp - self.candidate_since < self.initial_acquire_seconds:
                    return None
                self.active_person_id = best["person_id"]
                self.active_since = timestamp
                self.candidate_person_id = None
                return self.active_person_id
            return None

        if not best:
            self.candidate_person_id = None
            current_track = self.tracks.get(self.active_person_id)
            if current and current_track and timestamp - current_track.last_seen <= self.active_lost_seconds:
                return self.active_person_id
            self.active_person_id = None
            return None
        if current is None:
            self.active_person_id = best["person_id"]
            self.active_since = timestamp
            self.candidate_person_id = None
            return self.active_person_id
        if best["person_id"] == self.active_person_id:
            self.candidate_person_id = None
            return self.active_person_id

        current_track = self.tracks.get(self.active_person_id)
        current_recent = current_track and timestamp - current_track.last_seen <= self.active_lost_seconds
        held_long_enough = timestamp - self.active_since >= self.min_active_seconds
        score_advantage = float(best.get("active_signer_score", 0.0)) - float(current.get("active_signer_score", 0.0))
        can_challenge = (not current_recent) or (held_long_enough and score_advantage >= self.switch_margin)
        if not can_challenge:
            self.candidate_person_id = None
            return self.active_person_id

        if self.candidate_person_id != best["person_id"]:
            self.candidate_person_id = best["person_id"]
            self.candidate_since = timestamp
            return self.active_person_id
        if timestamp - self.candidate_since < self.switch_hold_seconds:
            return self.active_person_id

        self.active_person_id = best["person_id"]
        self.active_since = timestamp
        self.candidate_person_id = None
        self.switch_count += 1
        return self.active_person_id

    def result(self, timestamp=None):
        people = [track.latest for track in self.tracks.values()]
        people.sort(key=lambda item: item["person_id"])
        resolved_timestamp = time.time() if timestamp is None else float(timestamp)
        active_person_id = self._resolve_active(people, resolved_timestamp)
        return people, active_person_id


class RTMWWholeBodyEngine:
    def __init__(self):
        self.enabled = os.getenv("SIGNOVA_RTMW_ENABLED", "1").lower() not in {"0", "false", "no"}
        self.requested_mode = os.getenv("SIGNOVA_RTMW_MODE", "auto").lower()
        self.mode = self.requested_mode
        self.backend = os.getenv("SIGNOVA_RTMW_BACKEND", "onnxruntime")
        self.requested_device = os.getenv("SIGNOVA_RTMW_DEVICE", "cuda")
        self.device = self.requested_device
        self.providers = []
        self.score_threshold = float(os.getenv("SIGNOVA_RTMW_SCORE_THRESHOLD", "0.2"))
        self.session_ttl = float(os.getenv("SIGNOVA_RTMW_SESSION_TTL", "120"))
        self.buffer_size = int(os.getenv("SIGNOVA_RTMW_BUFFER_SIZE", "48"))
        self.max_sessions = int(os.getenv("SIGNOVA_RTMW_MAX_SESSIONS", "32"))
        self.max_people = int(os.getenv("SIGNOVA_RTMW_MAX_PEOPLE", "8"))
        self.max_frame_dimension = int(os.getenv("SIGNOVA_RTMW_MAX_FRAME_DIMENSION", "1280"))
        self.switch_margin = float(os.getenv("SIGNOVA_RTMW_SWITCH_MARGIN", "0.08"))
        self.switch_hold_seconds = float(os.getenv("SIGNOVA_RTMW_SWITCH_HOLD_MS", "900")) / 1000.0
        self.min_active_seconds = float(os.getenv("SIGNOVA_RTMW_MIN_ACTIVE_MS", "1800")) / 1000.0
        self.active_lost_seconds = float(os.getenv("SIGNOVA_RTMW_ACTIVE_LOST_MS", "1200")) / 1000.0
        self.active_score_minimum = float(os.getenv("SIGNOVA_RTMW_ACTIVE_SCORE_MIN", "0.28"))
        self.multi_person_motion_minimum = float(os.getenv("SIGNOVA_RTMW_MULTI_PERSON_MOTION_MIN", "0.003"))
        self.initial_acquire_seconds = float(os.getenv("SIGNOVA_RTMW_INITIAL_ACQUIRE_MS", "400")) / 1000.0
        self.model = None
        self.error = None
        self.sessions = {}
        self.total_frames = 0
        self.total_people = 0
        self.max_people_seen = 0
        self.max_reliable_hands_seen = 0
        self.inference_latencies = deque(maxlen=240)
        self.lock = threading.RLock()
        self.inference_lock = threading.Lock()

    def available(self):
        self._load()
        return self.model is not None

    def _load(self):
        if self.model is not None or self.error is not None or not self.enabled:
            return
        try:
            from rtmlib import Wholebody
            import onnxruntime as ort

            self.providers = ort.get_available_providers()
            if self.device == "cuda" and "CUDAExecutionProvider" not in self.providers:
                self.device = "cpu"
            if self.requested_mode == "auto":
                self.mode = "balanced" if self.device == "cuda" else "lightweight"
            self.model = Wholebody(mode=self.mode, backend=self.backend, device=self.device, to_openpose=False)
        except Exception as exc:
            self.error = str(exc)

    def runtime_metrics(self):
        with self.lock:
            latencies = list(self.inference_latencies)
            ordered = sorted(latencies)
            p95_index = max(0, int(round((len(ordered) - 1) * 0.95))) if ordered else 0
            active_switches = sum(session.switch_count for session in self.sessions.values())
            return {
                "frames_processed": self.total_frames,
                "average_people_per_frame": round(self.total_people / self.total_frames, 3) if self.total_frames else 0.0,
                "max_people_seen": self.max_people_seen,
                "max_reliable_hands_seen": self.max_reliable_hands_seen,
                "active_signer_switches": active_switches,
                "latency_window_frames": len(latencies),
                "inference_mean_ms": round(float(np.mean(latencies)), 2) if latencies else None,
                "inference_p95_ms": round(float(ordered[p95_index]), 2) if ordered else None,
                "sessions": {
                    session_id: {
                        "people": len(session.tracks),
                        "active_person_id": session.active_person_id,
                        "switch_candidate_id": session.candidate_person_id,
                        "active_signer_switches": session.switch_count,
                        "manual_lock": session.manual_person_id,
                    }
                    for session_id, session in self.sessions.items()
                },
            }

    def status(self):
        return {
            "enabled": self.enabled,
            "available": self.available(),
            "model": "RTMW WholeBody 133",
            "mode": self.mode,
            "requested_mode": self.requested_mode,
            "backend": self.backend,
            "device": self.device,
            "requested_device": self.requested_device,
            "providers": self.providers,
            "session_count": len(self.sessions),
            "max_sessions": self.max_sessions,
            "max_people": self.max_people,
            "signer_switching": {
                "margin": self.switch_margin,
                "hold_ms": round(self.switch_hold_seconds * 1000),
                "minimum_active_ms": round(self.min_active_seconds * 1000),
                "lost_grace_ms": round(self.active_lost_seconds * 1000),
                "minimum_active_score": self.active_score_minimum,
                "multi_person_motion_minimum": self.multi_person_motion_minimum,
                "initial_acquire_ms": round(self.initial_acquire_seconds * 1000),
            },
            "runtime": self.runtime_metrics(),
            "error": self.error,
            "privacy": "Frames are processed in memory and are not saved.",
        }

    def _cleanup(self, now):
        stale = [session_id for session_id, session in self.sessions.items() if now - session.last_seen > self.session_ttl]
        for session_id in stale:
            del self.sessions[session_id]
        while len(self.sessions) >= self.max_sessions:
            oldest = min(self.sessions, key=lambda item: self.sessions[item].last_seen)
            del self.sessions[oldest]

    def clear_session(self, session_id):
        with self.lock:
            return self.sessions.pop(session_id, None) is not None

    def sequence_frames(self, session_id, person_id=None):
        with self.lock:
            session = self.sessions.get(session_id)
            if not session:
                return [], None
            people, active_person_id = session.result()
            selected_id = person_id or active_person_id
            track = session.tracks.get(selected_id)
            if not track:
                return [], selected_id
            frames = []
            for person in track.frames:
                hands = [
                    model_hand_points(person.get("left_hand") or []),
                    model_hand_points(person.get("right_hand") or []),
                ]
                frames.append(
                    {
                        "hands": hands,
                        "landmarks": hands[0] if hands[0] else hands[1],
                        "pose": model_points(person.get("pose") or []),
                        "face": model_points(person.get("face") or []),
                        "non_manual": person.get("non_manual"),
                        "feature_layout": "multimodal_v2",
                        "person_id": selected_id,
                        "timestamp": person.get("timestamp"),
                    }
                )
            return frames, selected_id

    def _person_from_keypoints(self, keypoints, scores, width, height, timestamp):
        tracking_box = visible_bbox(keypoints[BODY_SLICE], scores[BODY_SLICE], self.score_threshold)
        crop_box = visible_bbox(keypoints, scores, self.score_threshold)
        if not tracking_box:
            tracking_box = crop_box
        if not crop_box:
            crop_box = tracking_box
        if not tracking_box or not crop_box:
            return None
        left_scores = scores[LEFT_HAND_SLICE]
        right_scores = scores[RIGHT_HAND_SLICE]
        left_visible = int(np.count_nonzero(left_scores >= self.score_threshold))
        right_visible = int(np.count_nonzero(right_scores >= self.score_threshold))
        pose_visible = int(np.count_nonzero(scores[BODY_SLICE] >= self.score_threshold))
        hand_visibility = (left_visible + right_visible) / 42.0
        pose = normalize_points(keypoints[BODY_SLICE], scores[BODY_SLICE], width, height, self.score_threshold)
        face = normalize_points(keypoints[FACE_SLICE], scores[FACE_SLICE], width, height, self.score_threshold)
        return {
            "bbox_pixels": [round(item, 2) for item in tracking_box],
            "bbox": [
                round(crop_box[0] / width, 6),
                round(crop_box[1] / height, 6),
                round(crop_box[2] / width, 6),
                round(crop_box[3] / height, 6),
            ],
            "pose": pose,
            "face": face,
            "non_manual": non_manual_summary(face, pose),
            "left_hand": normalize_points(keypoints[LEFT_HAND_SLICE], left_scores, width, height, self.score_threshold),
            "right_hand": normalize_points(keypoints[RIGHT_HAND_SLICE], right_scores, width, height, self.score_threshold),
            "quality": {
                "pose_visible": pose_visible,
                "left_hand_visible": left_visible,
                "right_hand_visible": right_visible,
                "hand_visibility": round(hand_visibility, 4),
            },
            "active_signer_score": round(hand_visibility, 4),
            "timestamp": timestamp,
        }

    @staticmethod
    def _deduplicate_people(people, overlap_threshold=0.55):
        def detection_quality(person):
            quality = person.get("quality") or {}
            return (
                float(quality.get("pose_visible") or 0.0)
                + float(quality.get("left_hand_visible") or 0.0)
                + float(quality.get("right_hand_visible") or 0.0)
            )

        kept = []
        for person in sorted(people, key=detection_quality, reverse=True):
            box = person.get("bbox_pixels")
            if box and any(
                existing.get("bbox_pixels")
                and bbox_iou(box, existing["bbox_pixels"]) >= overlap_threshold
                for existing in kept
            ):
                continue
            kept.append(person)
        return kept

    def process_base64(self, image_base64, session_id="default", timestamp=None, include_landmarks=True, person_id=None, lock_person=False):
        self._load()
        if self.model is None:
            raise RuntimeError(self.error or "RTMW engine is unavailable.")
        frame = decode_base64_frame(image_base64)
        if max(frame.shape[:2]) > self.max_frame_dimension:
            scale = self.max_frame_dimension / max(frame.shape[:2])
            frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        timestamp = float(time.time() if timestamp is None else timestamp)
        started = time.perf_counter()
        with self.inference_lock:
            keypoints, scores = self.model(frame)
        inference_ms = (time.perf_counter() - started) * 1000.0
        keypoints = np.asarray(keypoints)
        scores = np.asarray(scores)
        height, width = frame.shape[:2]
        people = []
        for person_keypoints, person_scores in zip(keypoints[: self.max_people], scores[: self.max_people]):
            person = self._person_from_keypoints(person_keypoints, person_scores, width, height, timestamp)
            if person:
                people.append(person)
        people = self._deduplicate_people(people)

        with self.lock:
            self._cleanup(timestamp)
            session = self.sessions.setdefault(
                session_id,
                WholeBodySession(
                    session_id,
                    self.buffer_size,
                    self.switch_margin,
                    self.switch_hold_seconds,
                    self.min_active_seconds,
                    self.active_lost_seconds,
                    self.active_score_minimum,
                    self.multi_person_motion_minimum,
                    self.initial_acquire_seconds,
                ),
            )
            session.update(people, timestamp)
            for track in session.tracks.values():
                person = track.latest
                quality = person.get("quality") or {}
                hand_visibility = float(quality.get("hand_visibility") or 0.0)
                pose_visibility = min(float(quality.get("pose_visible") or 0.0) / 17.0, 1.0)
                reliable_hand_fraction = (
                    int(int(quality.get("left_hand_visible") or 0) >= 6)
                    + int(int(quality.get("right_hand_visible") or 0) >= 6)
                ) / 2.0
                motion_score = min(float(person.get("hand_motion") or 0.0) * 24.0, 1.0) * hand_visibility
                person["active_signer_score"] = round(
                    (0.55 * motion_score)
                    + (0.20 * hand_visibility)
                    + (0.15 * reliable_hand_fraction)
                    + (0.10 * pose_visibility),
                    6,
                )
            if lock_person:
                session.set_manual_person(person_id)
            elif person_id == "":
                session.set_manual_person(None)
            tracked_people, active_person_id = session.result(timestamp)

        response_people = tracked_people
        active_person = next(
            (person for person in tracked_people if person.get("person_id") == active_person_id),
            None,
        )
        if not include_landmarks:
            response_people = [
                {
                    "person_id": person["person_id"],
                    "bbox": person.get("bbox"),
                    "quality": person.get("quality"),
                    "non_manual": person.get("non_manual"),
                    "hand_motion": person.get("hand_motion"),
                    "active_signer_score": person.get("active_signer_score"),
                    "timestamp": person.get("timestamp"),
                }
                for person in tracked_people
            ]
        stable_scene = len(tracked_people) <= 1 and not session.candidate_person_id
        base_interval_ms = 1000 if stable_scene else 500
        recommended_interval_ms = int(min(1800, max(base_interval_ms, inference_ms * 1.35)))
        reliable_hands = sum(
            int(person["quality"]["left_hand_visible"] >= 6) + int(person["quality"]["right_hand_visible"] >= 6)
            for person in tracked_people
        )
        with self.lock:
            self.total_frames += 1
            self.total_people += len(tracked_people)
            self.max_people_seen = max(self.max_people_seen, len(tracked_people))
            self.max_reliable_hands_seen = max(self.max_reliable_hands_seen, reliable_hands)
            self.inference_latencies.append(inference_ms)
        return {
            "engine": "RTMW WholeBody 133",
            "session_id": session_id,
            "timestamp": timestamp,
            "frame": {"width": width, "height": height},
            "people": response_people,
            "people_count": len(tracked_people),
            "detected_hands": sum(
                int(person["quality"]["left_hand_visible"] > 0) + int(person["quality"]["right_hand_visible"] > 0)
                for person in tracked_people
            ),
            "reliable_hands": reliable_hands,
            "active_person_id": active_person_id,
            "active_person_score": active_person.get("active_signer_score") if active_person else None,
            "active_person_locked": bool(session.manual_person_id),
            "switch_candidate_id": session.candidate_person_id,
            "tracking_state": (
                "manual_lock"
                if session.manual_person_id
                else "switch_pending"
                if session.candidate_person_id
                else "active"
                if active_person_id
                else "searching"
            ),
            "recommended_interval_ms": recommended_interval_ms,
            "latency": {"inference_ms": round(inference_ms, 2)},
        }
