import unittest
import tempfile
from pathlib import Path

import torch

from Models.predict import SequenceSignPredictor
from Models.sequence_model import MULTIMODAL_FEATURE_SIZE, SignovaMultimodalFusionTransformerModel


class MultimodalFusionModelTests(unittest.TestCase):
    def test_fuses_hand_pose_face_and_exposes_auxiliary_heads(self):
        model = SignovaMultimodalFusionTransformerModel(
            input_size=MULTIMODAL_FEATURE_SIZE,
            model_dim=96,
            num_heads=4,
            num_layers=2,
            num_classes=7,
            num_categories=4,
        )
        outputs = model.forward_with_auxiliary(torch.zeros(2, 40, MULTIMODAL_FEATURE_SIZE))
        self.assertEqual(tuple(outputs["logits"].shape), (2, 7))
        self.assertEqual(tuple(outputs["unknown_logits"].shape), (2,))
        self.assertEqual(tuple(outputs["category_logits"].shape), (2, 4))

    def test_rejects_hand_only_feature_layout(self):
        with self.assertRaises(ValueError):
            SignovaMultimodalFusionTransformerModel(input_size=126)

    def test_checkpoint_loads_and_returns_unknown_head_when_trained(self):
        model = SignovaMultimodalFusionTransformerModel(
            model_dim=96, num_heads=4, num_layers=2, num_classes=2, num_categories=4,
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fusion.pt"
            torch.save({
                "model_state_dict": model.state_dict(),
                "classes": ["sentence_one", "sentence_two"],
                "model_type": "multimodal_fusion_transformer",
                "input_size": MULTIMODAL_FEATURE_SIZE,
                "sequence_length": 40,
                "model_dim": 96,
                "num_heads": 4,
                "num_layers": 2,
                "num_categories": 4,
                "dropout": 0.2,
                "auxiliary_heads_trained": True,
                "category_labels": ["asl", "isl", "alphabet", "other"],
            }, path)
            predictor = SequenceSignPredictor(path, name="fusion-test")
            prediction = predictor.predict([{"hands": []} for _ in range(12)])
        self.assertIsNotNone(prediction)
        self.assertIn("unknown_probability", prediction)
        self.assertIn(prediction["predicted_category"], {"asl", "isl", "alphabet", "other"})


if __name__ == "__main__":
    unittest.main()
