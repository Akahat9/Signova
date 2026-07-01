import math

import numpy as np


HAND_FEATURE_SIZE = 126
BODY_FEATURE_SIZE = 27
EXPRESSION_FEATURE_SIZE = 12
MULTIMODAL_FEATURE_SIZE = HAND_FEATURE_SIZE + BODY_FEATURE_SIZE + EXPRESSION_FEATURE_SIZE
FEATURE_LAYOUT_HANDS_V1 = "hands_v1"
FEATURE_LAYOUT_MULTIMODAL_V2 = "multimodal_v2"

# COCO body order used by RTMW: nose, shoulders, elbows, wrists, and hips.
BODY_INDICES = (0, 5, 6, 7, 8, 9, 10, 11, 12)


def _point_row(point):
    if isinstance(point, dict):
        visible = bool(point.get("visible", True))
        score = float(point.get("score", 1.0) or 0.0)
        return np.asarray(
            [
                float(point.get("x", 0.0) or 0.0),
                float(point.get("y", 0.0) or 0.0),
                float(point.get("z", 0.0) or 0.0),
                score if visible else 0.0,
            ],
            dtype=np.float32,
        )
    values = list(point or [])
    return np.asarray(
        [
            float(values[0]) if len(values) > 0 else 0.0,
            float(values[1]) if len(values) > 1 else 0.0,
            float(values[2]) if len(values) > 2 else 0.0,
            float(values[3]) if len(values) > 3 else 1.0,
        ],
        dtype=np.float32,
    )


def point_array(points):
    rows = [_point_row(point) for point in (points or [])]
    return np.asarray(rows, dtype=np.float32) if rows else np.empty((0, 4), dtype=np.float32)


def _distance(points, first, second):
    if max(first, second) >= len(points):
        return 0.0
    if points[first, 3] <= 0.0 or points[second, 3] <= 0.0:
        return 0.0
    return float(np.linalg.norm(points[first, :2] - points[second, :2]))


def _safe_ratio(numerator, denominator):
    return float(numerator / denominator) if denominator > 1e-6 else 0.0


def _angle(first, second):
    delta = second - first
    return float(math.atan2(float(delta[1]), float(delta[0])) / math.pi)


def compact_body_vector(pose):
    points = point_array(pose)
    output = np.zeros(BODY_FEATURE_SIZE, dtype=np.float32)
    if len(points) <= max(BODY_INDICES):
        return output
    selected = points[list(BODY_INDICES), :3].copy()
    visible = points[list(BODY_INDICES), 3] > 0.0
    if np.count_nonzero(visible) < 4:
        return output
    if visible[1] and visible[2]:
        origin = (selected[1] + selected[2]) / 2.0
        scale = float(np.linalg.norm(selected[1, :2] - selected[2, :2]))
    else:
        origin = selected[visible].mean(axis=0)
        span = np.ptp(selected[visible, :2], axis=0)
        scale = float(np.linalg.norm(span))
    scale = max(scale, 1e-6)
    selected[visible] = (selected[visible] - origin) / scale
    selected[~visible] = 0.0
    return selected.reshape(-1).astype(np.float32)


def expression_features(face, pose):
    face_points = point_array(face)
    pose_points = point_array(pose)
    features = np.zeros(EXPRESSION_FEATURE_SIZE, dtype=np.float32)
    if len(face_points) >= 68:
        visible_ratio = float(np.count_nonzero(face_points[:, 3] > 0.0) / len(face_points))
        face_width = _distance(face_points, 0, 16)
        mouth_width = _distance(face_points, 48, 54)
        mouth_open = _distance(face_points, 62, 66)
        left_eye_width = _distance(face_points, 36, 39)
        right_eye_width = _distance(face_points, 42, 45)
        left_eye_open = (_distance(face_points, 37, 41) + _distance(face_points, 38, 40)) / 2.0
        right_eye_open = (_distance(face_points, 43, 47) + _distance(face_points, 44, 46)) / 2.0
        left_brow = (_distance(face_points, 19, 37) + _distance(face_points, 20, 38)) / 2.0
        right_brow = (_distance(face_points, 23, 43) + _distance(face_points, 24, 44)) / 2.0
        mouth_corner_lift = 0.0
        if min(face_points[48, 3], face_points[54, 3], face_points[57, 3]) > 0.0:
            mouth_corner_lift = float(
                ((face_points[48, 1] + face_points[54, 1]) / 2.0) - face_points[57, 1]
            )
        features[:9] = [
            visible_ratio,
            np.clip(_safe_ratio(mouth_width, face_width), 0.0, 1.5),
            np.clip(_safe_ratio(mouth_open, mouth_width), 0.0, 1.5),
            np.clip(_safe_ratio(left_eye_open, left_eye_width), 0.0, 1.5),
            np.clip(_safe_ratio(right_eye_open, right_eye_width), 0.0, 1.5),
            np.clip(_safe_ratio(left_brow, face_width), 0.0, 1.5),
            np.clip(_safe_ratio(right_brow, face_width), 0.0, 1.5),
            np.clip(mouth_corner_lift / max(face_width, 1e-6), -1.0, 1.0),
            np.clip(_angle(face_points[36, :2], face_points[45, :2]), -1.0, 1.0),
        ]
    if len(pose_points) >= 13:
        left_shoulder, right_shoulder = pose_points[5], pose_points[6]
        left_hip, right_hip = pose_points[11], pose_points[12]
        if min(left_shoulder[3], right_shoulder[3]) > 0.0:
            features[9] = np.clip(_angle(left_shoulder[:2], right_shoulder[:2]), -1.0, 1.0)
        if min(left_shoulder[3], right_shoulder[3], left_hip[3], right_hip[3]) > 0.0:
            shoulder_mid = (left_shoulder[:2] + right_shoulder[:2]) / 2.0
            hip_mid = (left_hip[:2] + right_hip[:2]) / 2.0
            torso = shoulder_mid - hip_mid
            torso_scale = max(float(np.linalg.norm(torso)), 1e-6)
            features[10] = np.clip(float(torso[0] / torso_scale), -1.0, 1.0)
            features[11] = np.clip(float(torso[1] / torso_scale), -1.0, 1.0)
    return features.astype(np.float32)


def non_manual_summary(face, pose):
    values = expression_features(face, pose)
    names = (
        "face_visible_ratio",
        "mouth_width",
        "mouth_openness",
        "left_eye_openness",
        "right_eye_openness",
        "left_brow_raise",
        "right_brow_raise",
        "mouth_corner_lift",
        "head_tilt",
        "shoulder_tilt",
        "torso_lean_x",
        "torso_direction_y",
    )
    return {name: round(float(value), 4) for name, value in zip(names, values)}
