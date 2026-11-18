import unittest

from Models.assess_dataset_coverage import assess_dataset_coverage


POLICY = {
    "minimum_signers_per_split": 1,
    "minimum_train_signers_per_label": 2,
    "minimum_diversity_groups": 2,
    "minimum_lighting_categories": 2,
    "minimum_background_categories": 2,
    "minimum_handedness_categories": 2,
    "minimum_device_class_categories": 2,
    "require_capture_metadata": True,
}


def manifest():
    signers = [
        {"signer_id": "train-a", "diversity_groups": ["age-adult", "skin-tone-a"]},
        {"signer_id": "train-b", "diversity_groups": ["age-senior", "skin-tone-b"]},
        {"signer_id": "validation-a", "diversity_groups": ["age-adult"]},
        {"signer_id": "test-a", "diversity_groups": ["age-senior"]},
    ]
    captures = [
        {"lighting": "daylight", "background": "plain", "handedness": "left", "device_class": "mobile"},
        {"lighting": "indoor", "background": "cluttered", "handedness": "right", "device_class": "desktop"},
    ]
    samples = [
        {"signer_id": "train-a", "label": "hello", "split": "train", "capture": captures[0]},
        {"signer_id": "train-b", "label": "hello", "split": "train", "capture": captures[1]},
        {"signer_id": "validation-a", "label": "hello", "split": "validation", "capture": captures[0]},
        {"signer_id": "test-a", "label": "hello", "split": "test", "capture": captures[1]},
    ]
    return {"signers": signers, "samples": samples}


class DatasetCoverageTests(unittest.TestCase):
    def test_accepts_signer_and_capture_diversity_coverage(self):
        report = assess_dataset_coverage(manifest(), POLICY)
        self.assertTrue(report["ready"], report["reasons"])
        self.assertEqual(report["minimum_train_signers_by_label"], 2)

    def test_blocks_missing_capture_and_single_signer_label_bias(self):
        value = manifest()
        value["samples"][1]["label"] = "help"
        del value["samples"][0]["capture"]["lighting"]
        report = assess_dataset_coverage(value, POLICY)
        self.assertFalse(report["ready"])
        self.assertIn("train_signers_below_2:hello", report["reasons"])
        self.assertTrue(any(reason.startswith("missing_lighting_metadata") for reason in report["reasons"]))


if __name__ == "__main__":
    unittest.main()

