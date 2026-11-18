import copy
import json
from pathlib import Path
import unittest

from Models.check_model_release import assess_model_release


MODELS_DIR = Path(__file__).resolve().parent


class ModelReleaseReadinessTests(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((MODELS_DIR / "model_registry.json").read_text(encoding="utf-8"))

    def test_current_registry_is_safe_but_not_production_ready(self):
        report = assess_model_release(self.registry, MODELS_DIR)
        self.assertFalse(report["production_ready"])
        self.assertEqual(report["unsafe"], [])
        self.assertEqual(set(report["tasks"]), set(self.registry["tasks"]))
        for task in report["tasks"].values():
            self.assertFalse(task["ready"])
            self.assertIn("vocabulary_spec_missing", task["reasons"])
            self.assertIn("active_dataset_manifest_missing", task["reasons"])

    def test_disabling_a_mandatory_policy_is_an_unsafe_configuration(self):
        registry = copy.deepcopy(self.registry)
        registry["policy"]["require_vocabulary_spec"] = False
        report = assess_model_release(registry, MODELS_DIR)
        self.assertIn("mandatory_policy_disabled:require_vocabulary_spec", report["unsafe"])
        self.assertFalse(report["production_ready"])

    def test_frozen_class_map_drift_is_unsafe(self):
        registry = copy.deepcopy(self.registry)
        registry["tasks"]["alphabet"]["class_map_sha256"] = "0" * 64
        report = assess_model_release(registry, MODELS_DIR)
        self.assertIn("class_map_sha256_mismatch:alphabet", report["unsafe"])
        self.assertIn("class_map_sha256_mismatch", report["tasks"]["alphabet"]["reasons"])


if __name__ == "__main__":
    unittest.main()
