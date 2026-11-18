import unittest

from Models.validate_dataset_manifest import validate_manifest


def sample_manifest():
    signers = []
    samples = []
    for index, split in enumerate(("train", "validation", "test"), start=1):
        signer_id = f"signer-{index}"
        signers.append({
            "signer_id": signer_id,
            "consent_record_id": f"consent-{index}",
            "consent_for_training": True,
            "consent_version": "2026-07",
        })
        samples.append({
            "sample_id": f"sample-{index}",
            "signer_id": signer_id,
            "label": "hello",
            "split": split,
            "sha256": str(index) * 64,
            "relative_path": f"private/{split}/sample-{index}.npz",
        })
    return {
        "schema_version": 1,
        "dataset_id": "asl-private-v1",
        "task": "asl_primary",
        "created_at": "2026-07-11T00:00:00Z",
        "signers": signers,
        "samples": samples,
    }


class DatasetManifestTests(unittest.TestCase):
    def test_accepts_consent_aware_signer_disjoint_manifest(self):
        report = validate_manifest(sample_manifest())
        self.assertTrue(report["valid"], report["errors"])
        self.assertTrue(report["signer_disjoint"])
        self.assertEqual(report["counts"]["splits"], {"test": 1, "train": 1, "validation": 1})

    def test_rejects_signer_leakage_across_splits(self):
        manifest = sample_manifest()
        manifest["samples"][1]["signer_id"] = "signer-1"
        report = validate_manifest(manifest)
        self.assertFalse(report["valid"])
        self.assertIn("signer_split_leakage:signer-1:train,validation", report["errors"])

    def test_rejects_missing_consent_raw_identity_and_unsafe_paths(self):
        manifest = sample_manifest()
        manifest["signers"][0]["consent_for_training"] = False
        manifest["signers"][0]["email"] = "must-not-be-in-manifest@example.test"
        manifest["samples"][0]["relative_path"] = "../outside.npz"
        report = validate_manifest(manifest)
        self.assertFalse(report["valid"])
        self.assertTrue(any(error.startswith("training_consent_required:") for error in report["errors"]))
        self.assertTrue(any(error.startswith("raw_identity_fields_forbidden:") for error in report["errors"]))
        self.assertTrue(any(error.startswith("unsafe_relative_path:") for error in report["errors"]))

    def test_rejects_freeform_sensitive_diversity_and_capture_metadata(self):
        manifest = sample_manifest()
        manifest["signers"][0]["diversity_groups"] = ["email-person@example.test"]
        manifest["samples"][0]["capture"] = {
            "lighting": "studio-secret-location",
            "background": "plain",
            "handedness": "right",
            "device_class": "mobile",
            "gps": "forbidden",
        }
        report = validate_manifest(manifest)
        self.assertFalse(report["valid"])
        self.assertTrue(any(error.startswith("invalid_diversity_group:") for error in report["errors"]))
        self.assertTrue(any(error.startswith("unknown_capture_fields:") for error in report["errors"]))
        self.assertTrue(any(error.startswith("invalid_capture_value:") for error in report["errors"]))


if __name__ == "__main__":
    unittest.main()
