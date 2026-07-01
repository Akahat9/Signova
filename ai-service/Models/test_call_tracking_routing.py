import unittest

from Models.predict import MultiSequencePredictor
from Models.rtmw_engine import WholeBodySession


def person(box, score=0.7):
    return {
        "bbox_pixels": list(box),
        "bbox": [value / 1000.0 for value in box],
        "left_hand": [],
        "right_hand": [],
        "quality": {
            "pose_visible": 17,
            "left_hand_visible": 12,
            "right_hand_visible": 12,
            "hand_visibility": 24 / 42,
        },
        "active_signer_score": score,
        "timestamp": 0.0,
    }


class FakeModel:
    def __init__(self, label, confidence=0.9, margin=0.3, tracking=0.8):
        self.label = label
        self.classes = [label]
        self.confidence = confidence
        self.margin = margin
        self.tracking = tracking

    def available(self):
        return True

    def predict(self, _frames):
        return {
            "label": self.label,
            "confidence": self.confidence,
            "confidence_margin": self.margin,
            "quality_score": self.tracking,
            "tracking": {"score": self.tracking},
            "model_metrics": {"accuracy": 80.0, "f1_macro": 0.8},
            "source": "fake_transformer",
        }


class TrackingTests(unittest.TestCase):
    def test_tracks_keep_identity_while_people_cross(self):
        session = WholeBodySession("crossing", min_active_seconds=0.0)
        session.update([person([100, 100, 300, 500]), person([700, 100, 900, 500])], 1.0)
        initial = {track_id: track.latest["bbox_pixels"] for track_id, track in session.tracks.items()}

        session.update([person([300, 100, 500, 500]), person([500, 100, 700, 500])], 1.2)
        session.update([person([520, 100, 720, 500]), person([280, 100, 480, 500])], 1.4)

        left_origin_id = min(initial, key=lambda track_id: initial[track_id][0])
        right_origin_id = max(initial, key=lambda track_id: initial[track_id][0])
        self.assertGreater(session.tracks[left_origin_id].latest["bbox_pixels"][0], 500)
        self.assertLess(session.tracks[right_origin_id].latest["bbox_pixels"][0], 300)

    def test_active_signer_requires_sustained_challenge(self):
        session = WholeBodySession(
            "switching",
            switch_margin=0.08,
            switch_hold_seconds=0.9,
            min_active_seconds=0.0,
            initial_acquire_seconds=0.0,
        )
        first = person([100, 100, 300, 500], 0.75)
        second = person([700, 100, 900, 500], 0.35)
        session.update([first, second], 1.0)
        session.tracks["person_1"].frames[-1]["hand_motion"] = 0.02
        _, active = session.result(1.0)

        session.update([person([105, 100, 305, 500], 0.35), person([695, 100, 895, 500], 0.9)], 1.2)
        _, still_active = session.result(1.2)
        session.update([person([110, 100, 310, 500], 0.35), person([690, 100, 890, 500], 0.9)], 2.2)
        _, switched = session.result(2.2)

        self.assertEqual(active, still_active)
        self.assertNotEqual(active, switched)
        self.assertEqual(session.switch_count, 1)

    def test_short_occlusion_does_not_create_new_identity(self):
        session = WholeBodySession("occlusion")
        session.update([person([100, 100, 300, 500])], 1.0)
        original_id = next(iter(session.tracks))
        session.update([], 1.4)
        session.update([person([130, 100, 330, 500])], 1.8)
        self.assertEqual(list(session.tracks), [original_id])

    def test_manual_lock_keeps_selected_signer(self):
        session = WholeBodySession("manual-lock", min_active_seconds=0.0)
        session.update([person([100, 100, 300, 500], 0.8), person([700, 100, 900, 500], 0.4)], 1.0)
        selected = min(session.tracks, key=lambda track_id: session.tracks[track_id].latest["bbox_pixels"][0])
        session.set_manual_person(selected)
        session.update([person([110, 100, 310, 500], 0.3), person([690, 100, 890, 500], 0.95)], 2.0)
        _, active = session.result(2.0)
        self.assertEqual(active, selected)

    def test_active_signer_survives_short_low_score_gap(self):
        session = WholeBodySession("low-score-gap", active_lost_seconds=1.2)
        session.update([person([100, 100, 300, 500], 0.8)], 1.0)
        _, selected = session.result(1.0)
        session.update([person([105, 100, 305, 500], 0.1)], 1.4)
        _, active = session.result(1.4)
        self.assertEqual(active, selected)

    def test_overlapping_duplicate_people_are_removed(self):
        from Models.rtmw_engine import RTMWWholeBodyEngine

        people = [
            person([100, 100, 300, 500]),
            person([105, 105, 305, 505]),
            person([700, 100, 900, 500]),
        ]
        self.assertEqual(len(RTMWWholeBodyEngine._deduplicate_people(people)), 2)

    def test_zero_based_video_timestamp_allows_switching(self):
        session = WholeBodySession(
            "zero-time-switch",
            switch_margin=0.08,
            switch_hold_seconds=0.5,
            min_active_seconds=0.5,
            initial_acquire_seconds=0.0,
        )
        session.update([person([100, 100, 300, 500], 0.8), person([700, 100, 900, 500], 0.35)], 0.0)
        session.tracks["person_1"].frames[-1]["hand_motion"] = 0.02
        _, initial = session.result(0.0)
        session.update([person([105, 100, 305, 500], 0.35), person([695, 100, 895, 500], 0.9)], 0.6)
        session.result(0.6)
        session.update([person([110, 100, 310, 500], 0.35), person([690, 100, 890, 500], 0.9)], 1.2)
        _, switched = session.result(1.2)
        self.assertNotEqual(initial, switched)

    def test_multi_person_waits_for_motion_before_selecting_signer(self):
        session = WholeBodySession("motion-first", min_active_seconds=0.0, initial_acquire_seconds=0.1)
        session.update([person([100, 100, 300, 500], 0.75), person([700, 100, 900, 500], 0.8)], 0.0)
        _, initial = session.result(0.0)
        self.assertIsNone(initial)
        moving = person([120, 100, 320, 500], 0.9)
        moving["hand_motion"] = 0.02
        still = person([700, 100, 900, 500], 0.8)
        still["hand_motion"] = 0.0
        session.tracks["person_1"].frames[-1]["hand_motion"] = 0.02
        session.tracks["person_2"].frames[-1]["hand_motion"] = 0.0
        session.result(0.1)
        _, selected = session.result(0.21)
        self.assertEqual(selected, "person_1")


class RoutingTests(unittest.TestCase):
    def make_predictor(self):
        predictor = MultiSequencePredictor.__new__(MultiSequencePredictor)
        predictor.models = {
            "mixed": FakeModel("mixed-label"),
            "isl": FakeModel("isl-label"),
            "asl": FakeModel("asl-label"),
            "asl_top300": FakeModel("top300-label"),
            "asl_top500": FakeModel("top500-label"),
            "alphabet": FakeModel("a"),
        }
        return predictor

    def test_explicit_model_is_never_silently_replaced(self):
        prediction = self.make_predictor().predict([{}], mode="word", language="English", preferred="isl")
        self.assertEqual(prediction["selected_model"], "isl")
        self.assertEqual(prediction["label"], "isl-label")
        self.assertTrue(prediction["routing_request"]["explicit_model"])

    def test_asl_request_uses_production_hierarchy(self):
        prediction = self.make_predictor().predict([{}], mode="word", language="asl", preferred="")
        self.assertEqual(prediction["selected_model"], "asl")
        self.assertTrue(prediction["router"]["accepted"])
        self.assertEqual(prediction["routing_request"]["language"], "asl")


if __name__ == "__main__":
    unittest.main()
