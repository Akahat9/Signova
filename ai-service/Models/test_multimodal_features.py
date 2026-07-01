import unittest

import numpy as np

from Models.multimodal_features import (
    MULTIMODAL_FEATURE_SIZE,
    compact_body_vector,
    expression_features,
)
from Models.predict import frame_to_feature_vector


def point(x, y, score=1.0):
    return [x, y, 0.0, score]


class MultimodalFeatureTests(unittest.TestCase):
    def test_old_hand_layout_stays_126_values(self):
        hand = [[index / 100.0, index / 200.0, 0.0] for index in range(21)]
        vector = frame_to_feature_vector({"hands": [hand]}, feature_size=126)
        self.assertEqual(vector.shape, (126,))

    def test_multimodal_layout_appends_body_and_expression(self):
        hand = [[index / 100.0, index / 200.0, 0.0] for index in range(21)]
        pose = [point(0.5, 0.2) for _ in range(17)]
        pose[5], pose[6] = point(0.35, 0.4), point(0.65, 0.4)
        pose[11], pose[12] = point(0.42, 0.75), point(0.58, 0.75)
        face = [point(0.5, 0.35, 0.0) for _ in range(68)]
        for index, value in {
            0: (0.35, 0.35), 16: (0.65, 0.35),
            36: (0.42, 0.32), 39: (0.48, 0.32),
            42: (0.52, 0.32), 45: (0.58, 0.32),
            48: (0.44, 0.42), 54: (0.56, 0.42),
            62: (0.50, 0.415), 66: (0.50, 0.445),
        }.items():
            face[index] = point(*value)
        vector = frame_to_feature_vector(
            {"hands": [hand], "pose": pose, "face": face},
            feature_size=MULTIMODAL_FEATURE_SIZE,
        )
        self.assertEqual(vector.shape, (MULTIMODAL_FEATURE_SIZE,))
        self.assertGreater(np.count_nonzero(vector[126:]), 0)

    def test_missing_face_and_pose_are_safe_zero_vectors(self):
        self.assertEqual(np.count_nonzero(compact_body_vector([])), 0)
        self.assertEqual(np.count_nonzero(expression_features([], [])), 0)


if __name__ == "__main__":
    unittest.main()
