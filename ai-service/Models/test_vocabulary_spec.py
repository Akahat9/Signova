import unittest

from Models.validate_vocabulary_spec import validate_vocabulary_spec


CLASS_MAP = {"0": "hello", "1": "help"}
CLASS_SHA = "a" * 64


def definition(label, confusion):
    return {
        "label": label,
        "display_name": label.title(),
        "language": "ISL",
        "sign_type": "dynamic",
        "dominant_hand": "either",
        "handshape": "Reviewer-defined handshape specification",
        "palm_orientation": "Reviewer-defined palm orientation",
        "location": "Reviewer-defined signing-space location",
        "movement": "Reviewer-defined movement path",
        "non_manual_markers": "Neutral expression unless linguistic context requires otherwise",
        "start_pose": "Reviewer-defined start pose",
        "end_pose": "Reviewer-defined end pose",
        "minimum_frames": 8,
        "maximum_frames": 120,
        "known_confusions": [confusion],
        "disambiguation_notes": "Distinguish using reviewed movement and handshape cues",
        "source_reference_ids": ["review-source-v1"],
        "review_status": "approved",
    }


def valid_spec():
    return {
        "schema_version": 1,
        "task": "test-task",
        "class_map_sha256": CLASS_SHA,
        "review_status": "approved",
        "reviewed_by_role": "qualified-sign-language-reviewer",
        "reviewed_at": "2026-07-12T00:00:00Z",
        "sources": [{
            "id": "review-source-v1",
            "title": "Qualified reviewer controlled vocabulary",
            "publisher": "Test accessibility team",
            "version_or_date": "2026-07-12",
        }],
        "labels": [definition("hello", "help"), definition("help", "hello")],
    }


class VocabularySpecificationTests(unittest.TestCase):
    def test_complete_expert_reviewed_spec_passes(self):
        report = validate_vocabulary_spec(
            valid_spec(), CLASS_MAP,
            expected_task="test-task",
            expected_class_map_sha256=CLASS_SHA,
        )
        self.assertTrue(report["valid"])
        self.assertTrue(report["complete_coverage"])
        self.assertEqual(report["defined_label_count"], 2)

    def test_missing_extra_and_duplicate_labels_fail_exact_coverage(self):
        spec = valid_spec()
        spec["labels"] = [definition("hello", "help"), definition("hello", "help"), definition("unknown-extra", "help")]
        report = validate_vocabulary_spec(spec, CLASS_MAP, expected_task="test-task", expected_class_map_sha256=CLASS_SHA)
        self.assertFalse(report["valid"])
        self.assertIn("duplicate_label:hello", report["errors"])
        self.assertIn("label_missing:help", report["errors"])
        self.assertIn("unknown_label:unknown-extra", report["errors"])

    def test_pending_review_and_incomplete_phonology_fail(self):
        spec = valid_spec()
        spec["review_status"] = "pending"
        spec["labels"][0]["review_status"] = "pending"
        spec["labels"][0]["movement"] = ""
        report = validate_vocabulary_spec(spec, CLASS_MAP, expected_task="test-task", expected_class_map_sha256=CLASS_SHA)
        self.assertIn("expert_approval_required", report["errors"])
        self.assertIn("label_expert_approval_required:hello", report["errors"])
        self.assertIn("invalid_movement:hello", report["errors"])

    def test_unknown_fields_and_timezone_free_review_dates_fail(self):
        spec = valid_spec()
        spec["reviewer_email"] = "private@example.test"
        spec["reviewed_at"] = "2026-07-12"
        spec["labels"][0]["engineer_guess"] = True
        report = validate_vocabulary_spec(spec, CLASS_MAP, expected_task="test-task", expected_class_map_sha256=CLASS_SHA)
        self.assertIn("unknown_top_level_field:reviewer_email", report["errors"])
        self.assertIn("reviewed_at_invalid", report["errors"])
        self.assertIn("unknown_label_field:hello:engineer_guess", report["errors"])

    def test_confusions_and_source_references_must_be_controlled(self):
        spec = valid_spec()
        spec["labels"][0]["known_confusions"] = ["hello", "not-in-vocabulary"]
        spec["labels"][0]["source_reference_ids"] = ["missing-source"]
        report = validate_vocabulary_spec(spec, CLASS_MAP, expected_task="test-task", expected_class_map_sha256=CLASS_SHA)
        self.assertIn("invalid_known_confusion:hello:hello", report["errors"])
        self.assertIn("invalid_known_confusion:hello:not-in-vocabulary", report["errors"])
        self.assertIn("unknown_source_reference:hello:missing-source", report["errors"])


if __name__ == "__main__":
    unittest.main()
