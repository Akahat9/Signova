import unittest

from Models.manage_model_registry import assess_candidate, validate_task_vocabulary_spec
from Models.evaluate_unknown_rejection import evaluate


POLICY = {
    "minimum_accuracy_gain": 0.01,
    "maximum_f1_regression": 0.005,
    "minimum_f1_macro": 0.8,
    "minimum_unknown_recall": 0.9,
    "maximum_unknown_false_accept_rate": 0.05,
    "minimum_validation_samples": 50,
    "require_equal_or_wider_vocabulary": True,
    "require_signer_disjoint_validation": True,
    "require_checkpoint_sha256": True,
}


def metrics(**overrides):
    value = {
        "checkpoint": __file__,
        "accuracy": 0.9,
        "f1_macro": 0.88,
        "classes": 100,
        "samples": 200,
        "unknown_recall": 0.95,
        "unknown_false_accept_rate": 0.02,
        "signer_disjoint_validation": True,
        "checksum_valid": True,
    }
    value.update(overrides)
    return value


class RegistryGateTests(unittest.TestCase):
    def test_complete_candidate_passes(self):
        qualified, reasons = assess_candidate(metrics(accuracy=0.85), metrics(accuracy=0.9), POLICY)
        self.assertTrue(qualified)
        self.assertEqual(reasons, [])

    def test_unknown_and_checksum_gates_are_mandatory(self):
        challenger = metrics(accuracy=0.9, unknown_recall=None, checksum_valid=False, signer_disjoint_validation=False)
        qualified, reasons = assess_candidate(metrics(accuracy=0.85), challenger, POLICY)
        self.assertFalse(qualified)
        self.assertIn("checkpoint_sha256_missing_or_mismatch", reasons)
        self.assertIn("signer_disjoint_validation_required", reasons)
        self.assertTrue(any(reason.startswith("unknown_recall_below") for reason in reasons))

    def test_unknown_rejection_metrics(self):
        report = evaluate([
            {"expected_label": "unknown", "predicted_label": "hello", "accepted": False},
            {"expected_label": "no_gesture", "predicted_label": "help", "accepted": True},
            {"expected_label": "hello", "predicted_label": "hello", "accepted": True},
        ])
        self.assertEqual(report["unknown_recall"], 0.5)
        self.assertEqual(report["unknown_false_accept_rate"], 0.5)
        self.assertEqual(report["known_end_to_end_accuracy"], 1.0)

    def test_missing_expert_vocabulary_spec_blocks_promotion(self):
        report = validate_task_vocabulary_spec("test-task", {
            "class_map": "signova_alphabet_classes.json",
            "class_map_sha256": "a" * 64,
        })
        self.assertFalse(report["valid"])
        self.assertIn("vocabulary_spec_missing", report["errors"])


if __name__ == "__main__":
    unittest.main()
