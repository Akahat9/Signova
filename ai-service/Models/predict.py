import argparse
import base64
import csv
from collections import defaultdict
import io
import json
import math
from pathlib import Path
import time

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from torchvision.models import ResNet18_Weights

try:
    from Models.Utils.Ladmark import LandmarkMLPPredictor
    from Models.multimodal_features import (
        BODY_FEATURE_SIZE,
        EXPRESSION_FEATURE_SIZE,
        HAND_FEATURE_SIZE,
        compact_body_vector,
        expression_features,
        non_manual_summary,
    )
    from Models.sequence_model import SignovaSequenceModel, SignovaTemporalCNNTransformerModel, SignovaTransformerModel, normalize_sequence
except ImportError:
    from Utils.Ladmark import LandmarkMLPPredictor
    from multimodal_features import (
        BODY_FEATURE_SIZE,
        EXPRESSION_FEATURE_SIZE,
        HAND_FEATURE_SIZE,
        compact_body_vector,
        expression_features,
        non_manual_summary,
    )
    from sequence_model import SignovaSequenceModel, SignovaTemporalCNNTransformerModel, SignovaTransformerModel, normalize_sequence


SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = SCRIPT_DIR.parent
DEFAULT_MODEL_PATH = SCRIPT_DIR / "asl_alphabet_resnet18.pth"
DEFAULT_CLASS_MAP_PATH = SCRIPT_DIR / "asl_alphabet_classes.json"
DEFAULT_ANN_DIR = AI_SERVICE_DIR / "Datasets" / "ann_train_val"
DEFAULT_CENTROIDS_PATH = SCRIPT_DIR / "gesture_landmark_centroids.json"
DEFAULT_LANDMARK_MODEL_PATH = SCRIPT_DIR / "landmark_mlp.pt"
DEFAULT_SEQUENCE_MODEL_PATH = SCRIPT_DIR / "signova_sequence_gru.pt"
DEFAULT_MODEL_REGISTRY_PATH = SCRIPT_DIR / "model_registry.json"


def active_model_checkpoint(task, fallback_name):
    fallback = SCRIPT_DIR / fallback_name
    try:
        registry = json.loads(DEFAULT_MODEL_REGISTRY_PATH.read_text(encoding="utf-8"))
        checkpoint_name = registry["tasks"][task]["active_checkpoint"]
        checkpoint = (SCRIPT_DIR / checkpoint_name).resolve()
        if checkpoint.parent == SCRIPT_DIR.resolve() and checkpoint.is_file():
            return checkpoint
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError):
        pass
    return fallback


DEFAULT_TRANSFORMER_MODEL_PATH = active_model_checkpoint("mixed", "signova_sequence_transformer.pt")
DEFAULT_ISL_SEQUENCE_MODEL_PATH = active_model_checkpoint("isl", "signova_isl_transformer_top10.pt")
DEFAULT_ASL_SEQUENCE_MODEL_PATH = active_model_checkpoint("asl_primary", "signova_asl_transformer_top200_clean_trainval_v3.pt")
DEFAULT_ASL_TOP300_SEQUENCE_MODEL_PATH = active_model_checkpoint("asl_top300", "signova_asl_transformer_top300_clean_trainval_v2.pt")
DEFAULT_ASL_TOP500_SEQUENCE_MODEL_PATH = active_model_checkpoint("asl_top500", "signova_asl_transformer_top500_clean_trainval_v2.pt")
DEFAULT_ALPHABET_SEQUENCE_MODEL_PATH = active_model_checkpoint("alphabet", "signova_alphabet_transformer.pt")
DEFAULT_ISL_GLOSSES_CSV = AI_SERVICE_DIR / "Data" / "ISL_CSLRT_Corpus" / "ISL_CSLRT_Corpus" / "corpus_csv_files" / "ISL Corpus sign glosses.csv"
ENGINE_NAME = "Signova AI Synapse Engine"

HINDI_TRANSLATIONS = {
    "angry": "Gussa.",
    "call": "Mujhe call karo.",
    "dislike": "Mujhe yeh pasand nahi hai.",
    "fist": "Muthi.",
    "four": "Chaar.",
    "like": "Mujhe yeh pasand hai.",
    "mute": "Main bol nahi sakta.",
    "ok": "Theek hai.",
    "one": "Ek.",
    "palm": "Namaste.",
    "peace": "Shanti.",
    "peace_inverted": "Shanti.",
    "rock": "Rock gesture.",
    "stop": "Ruko.",
    "stop_inverted": "Ruko.",
    "three": "Teen.",
    "three2": "Teen.",
    "two_up": "Do.",
    "two_up_inverted": "Do.",
    "yes": "Haan.",
    "are_you_free_today": "Kya aap aaj free hain?",
    "are_you_hiding_something": "Kya aap kuch chhupa rahe hain?",
    "bring_water_for_me": "Mere liye paani lao.",
    "can_i_help_you": "Kya main aapki madad kar sakta hoon?",
    "can_you_repeat_that_please": "Kya aap kripya dobara bata sakte hain?",
    "comb_your_hair": "Apne baal kanghi karo.",
    "congratulations": "Badhai ho.",
    "could_you_please_talk_slower": "Kya aap thoda dheere bol sakte hain?",
    "do_me_a_favour": "Meri ek madad kar do.",
    "do_not_abuse_him": "Use gaali mat do.",
    "do_not_be_stubborn": "Zidd mat karo.",
    "do_not_hurt_me": "Mujhe chot mat pahunchao.",
    "do_not_make_me_angry": "Mujhe gussa mat dilao.",
    "do_not_take_it_to_the_heart": "Is baat ko dil par mat lo.",
    "do_not_worry": "Chinta mat karo.",
    "do_you_need_something": "Kya aapko kuch chahiye?",
    "go_and_sleep": "Jao aur so jao.",
    "had_your_food": "Kya aapne khana khaya?",
    "he_came_by_train": "Vah train se aaya.",
    "he_is_going_into_the_room": "Vah kamre me ja raha hai.",
    "he_is_on_the_way": "Vah raste me hai.",
    "he_she_is_my_friend": "Vah mera dost hai.",
    "he_would_be_coming_today": "Vah aaj aayega.",
    "help_me": "Meri madad karo.",
    "hi_how_are_you": "Namaste, aap kaise hain?",
    "how_are_things": "Sab kaisa chal raha hai?",
    "how_can_i_help_you": "Main aapki kaise madad kar sakta hoon?",
    "how_can_i_trust_you": "Main aap par kaise bharosa karun?",
    "how_dare_you": "Tumhari himmat kaise hui?",
    "how_old_are_you": "Aapki umar kya hai?",
    "i_am_age": "Meri umar itni hai.",
    "i_am_afraid_of_that": "Mujhe usse dar lagta hai.",
    "i_am_crying": "Main ro raha hoon.",
    "i_am_feeling_bored": "Mujhe bore ho raha hai.",
    "i_am_feeling_cold": "Mujhe thand lag rahi hai.",
    "i_am_fine_thank_you_sir": "Main theek hoon, dhanyavaad sir.",
    "i_am_hungry": "Mujhe bhook lagi hai.",
    "i_am_in_dilemma_what_to_do": "Main duvidha me hoon ki kya karun.",
    "i_am_not_really_sure": "Mujhe pakka nahi pata.",
    "i_am_really_grateful": "Main bahut aabhari hoon.",
    "i_am_sitting_in_the_class": "Main class me baitha hoon.",
    "i_am_so_sorry_to_hear_that": "Yeh sunkar mujhe bahut dukh hua.",
    "i_am_suffering_from_fever": "Mujhe bukhar hai.",
    "i_am_tired": "Main thak gaya hoon.",
    "i_am_very_happy": "Main bahut khush hoon.",
    "i_can_not_help_you_there": "Main wahan aapki madad nahi kar sakta.",
    "i_do_not_agree": "Main sehmat nahi hoon.",
    "i_do_not_like_it": "Mujhe yeh pasand nahi hai.",
    "i_do_not_mean_it": "Mera matlab woh nahi tha.",
    "i_dont_agree": "Main sehmat nahi hoon.",
    "i_enjoyed_a_lot": "Maine bahut maza kiya.",
    "i_got_hurt": "Mujhe chot lagi.",
    "i_like_you_i_love_you": "Mujhe tum pasand ho, main tumse pyaar karta hoon.",
    "i_need_water": "Mujhe paani chahiye.",
    "i_promise": "Main vaada karta hoon.",
    "i_really_appreciate_it": "Main iski sach me sarahana karta hoon.",
    "i_somehow_got_to_know_about_it": "Mujhe kisi tarah iske baare me pata chala.",
    "i_was_stopped_by_some_one": "Mujhe kisi ne rok diya.",
    "it_does_not_make_any_difference_to_me": "Mujhe isse koi farq nahi padta.",
    "it_was_nice_chatting_with_you": "Aapse baat karke achha laga.",
    "let_him_take_time": "Use samay lene do.",
    "my_name_is_xxxxxxxx": "Mera naam xxxxxxxx hai.",
    "nice_to_meet_you": "Aapse milkar achha laga.",
    "no_need_to_worry_dont_worry": "Chinta karne ki zaroorat nahi hai.",
    "now_onwards_he_will_never_hurt_you": "Ab se vah aapko kabhi chot nahi pahunchayega.",
    "pour_some_more_water_into_the_glass": "Glass me thoda aur paani dalo.",
    "prepare_the_bed": "Bistar taiyar karo.",
    "serve_the_food": "Khana paroso.",
    "shall_we_go_outside": "Kya hum bahar chalein?",
    "speak_softly": "Dheere bolo.",
    "take_care_of_yourself": "Apna khayal rakho.",
    "tell_me_truth": "Mujhe sach batao.",
    "thank_you_so_much": "Bahut bahut dhanyavaad.",
    "that_is_so_kind_of_you": "Yeh aapki bahut meherbani hai.",
    "this_place_is_beautiful": "Yeh jagah sundar hai.",
    "try_to_understand": "Samajhne ki koshish karo.",
    "turn_on_light_turn_off_light": "Light on karo, light off karo.",
    "we_are_all_with_you": "Hum sab aapke saath hain.",
    "wear_the_shirt": "Shirt pehno.",
    "what_are_you_doing": "Aap kya kar rahe hain?",
    "what_did_you_tell_him": "Aapne use kya bataya?",
    "what_do_you_do": "Aap kya karte hain?",
    "what_do_you_think": "Aap kya sochte hain?",
    "what_do_you_want_to_become": "Aap kya banna chahte hain?",
    "what_happened": "Kya hua?",
    "what_have_you_planned_for_your_career": "Aapne apne career ke liye kya plan kiya hai?",
    "what_is_your_phone_number": "Aapka phone number kya hai?",
    "what_you_want": "Aap kya chahte hain?",
    "when_will_the_train_leave": "Train kab niklegi?",
    "where_are_you_from": "Aap kahan se hain?",
    "which_college_school_are_you_from": "Aap kis college ya school se hain?",
    "who_are_you": "Aap kaun hain?",
    "why_are_you_angry": "Aap gussa kyun hain?",
    "why_are_you_crying": "Aap ro kyun rahe hain?",
    "why_are_you_disappointed": "Aap nirash kyun hain?",
    "you_are_bad": "Aap bure hain.",
    "you_are_good": "Aap achhe hain.",
    "you_are_welcome": "Aapka swagat hai.",
    "you_can_do_it": "Aap yeh kar sakte hain.",
    "you_do_anything_i_do_not_care": "Aap kuch bhi karo, mujhe farq nahi padta.",
    "you_need_a_medicine_take_this_one": "Aapko dawa chahiye, yeh le lijiye.",
}

GESTURE_PHRASES = {
    "call": "Call me",
    "dislike": "I dislike it",
    "fist": "Fist",
    "four": "Four",
    "like": "I like it",
    "mute": "I cannot speak",
    "ok": "OK",
    "one": "One",
    "palm": "Hello",
    "peace": "Peace",
    "peace_inverted": "Peace",
    "rock": "Rock",
    "stop": "Stop",
    "stop_inverted": "Stop",
    "three": "Three",
    "three2": "Three",
    "two_up": "Two",
    "two_up_inverted": "Two",
}


def normalize_landmarks(landmarks):
    points = np.asarray(landmarks, dtype=np.float32)
    if points.ndim != 2 or points.shape[0] < 21 or points.shape[1] < 2:
        raise ValueError("Expected at least 21 hand landmarks with x/y coordinates.")

    points = points[:21, :2]
    wrist = points[0].copy()
    points = points - wrist
    scale = float(np.linalg.norm(points, axis=1).max())
    if scale <= 1e-6:
        scale = 1.0
    return (points / scale).reshape(-1)


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def clean_translation_label(label):
    return "_".join(
        str(label)
        .strip()
        .lower()
        .replace("/", " ")
        .replace(",", " ")
        .replace(".", " ")
        .replace("(", " ")
        .replace(")", " ")
        .split()
    )


def title_from_label(label):
    return str(label).replace("_", " ").strip().capitalize()


def load_isl_translations(path=DEFAULT_ISL_GLOSSES_CSV):
    translations = {}
    path = Path(path)
    if not path.is_file():
        return translations

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            sentence = (row.get("Sentence") or "").strip()
            gloss = (row.get("SIGN GLOSSES") or "").strip()
            if not sentence:
                continue
            label = clean_translation_label(sentence)
            english = sentence[:1].upper() + sentence[1:]
            hindi = HINDI_TRANSLATIONS.get(label, english)
            translations[label] = {
                "label": label,
                "language": "ISL",
                "english": english,
                "hindi": hindi,
                "hinglish": hindi,
                "gloss": gloss or sentence.upper(),
            }
    return translations


ISL_TRANSLATIONS = load_isl_translations()


def translations_for_label(label, fallback=None):
    label = clean_translation_label(label)
    if label in ISL_TRANSLATIONS:
        return ISL_TRANSLATIONS[label]

    english = fallback or title_from_label(label)
    hindi = HINDI_TRANSLATIONS.get(label, english)
    return {
        "label": label,
        "language": "Unknown",
        "english": english,
        "hindi": hindi,
        "hinglish": hindi,
        "gloss": label.replace("_", " ").upper(),
    }


def landmark_quality(landmarks):
    points = np.asarray(landmarks, dtype=np.float32)
    if points.ndim != 2 or points.shape[0] < 21 or points.shape[1] < 2:
        return {"score": 0.0, "tips": ["Keep your full hand inside the frame."]}

    points = points[:21, :2]
    min_xy = points.min(axis=0)
    max_xy = points.max(axis=0)
    size = np.maximum(max_xy - min_xy, 0.0)
    area = float(size[0] * size[1])
    center = (min_xy + max_xy) / 2.0
    center_distance = float(np.linalg.norm(center - np.asarray([0.5, 0.5], dtype=np.float32)))

    size_score = min(1.0, area / 0.08)
    center_score = max(0.0, 1.0 - center_distance / 0.55)
    score = round((0.65 * size_score) + (0.35 * center_score), 4)

    tips = []
    if area < 0.035:
        tips.append("Move your hand closer to the camera.")
    if center_distance > 0.32:
        tips.append("Keep your hand closer to the center.")
    if not tips:
        tips.append("Good framing. Hold the sign steady.")

    return {"score": score, "tips": tips}


def smooth_feature_vectors(vectors, alpha=0.62):
    if not vectors:
        return vectors

    smoothed = []
    previous = None
    for vector in vectors:
        current = np.asarray(vector, dtype=np.float32)
        if previous is None:
            next_vector = current
        else:
            current_mask = np.abs(current) > 1e-7
            carried = np.where(current_mask, current, previous)
            next_vector = (alpha * carried) + ((1.0 - alpha) * previous)
        smoothed.append(next_vector.astype(np.float32))
        previous = next_vector
    return smoothed


def _hand_xy_from_vector(vector, hand_index=0):
    start = hand_index * 63
    end = start + 63
    if len(vector) < end:
        return None
    hand = np.asarray(vector[start:end], dtype=np.float32).reshape(21, 3)
    if np.count_nonzero(np.abs(hand[:, :2]) > 1e-7) < 8:
        return None
    return hand[:, :2]


def points_to_xyz(points, normalize=False):
    rows = []
    for point in (points or [])[:21]:
        if isinstance(point, dict):
            rows.append([point.get("x", 0.0), point.get("y", 0.0), point.get("z", 0.0)])
        else:
            row = list(point)
            rows.append([
                row[0] if len(row) > 0 else 0.0,
                row[1] if len(row) > 1 else 0.0,
                row[2] if len(row) > 2 else 0.0,
            ])
    if len(rows) < 21:
        rows.extend([[0.0, 0.0, 0.0] for _ in range(21 - len(rows))])
    points_array = np.asarray(rows[:21], dtype=np.float32)
    if normalize and np.count_nonzero(np.abs(points_array[:, :2]) > 1e-7) >= 6:
        wrist = points_array[0].copy()
        points_array = points_array - wrist
        xy_scale = float(np.linalg.norm(points_array[:, :2], axis=1).max())
        z_scale = float(np.max(np.abs(points_array[:, 2])))
        scale = max(xy_scale, z_scale, 1e-6)
        points_array = points_array / scale
    return points_array.reshape(-1)


def frame_to_feature_vector(frame, feature_size=126, feature_normalization="raw_mediapipe"):
    output = np.zeros(feature_size, dtype=np.float32)
    normalize = feature_normalization == "wrist_centered_scale_normalized"
    if isinstance(frame, dict):
        hands = frame.get("hands") or []
        if not hands and frame.get("landmarks"):
            hands = [frame.get("landmarks")]
    else:
        hands = [frame]

    for hand_index, hand in enumerate(hands[:2]):
        start = hand_index * 63
        end = min(start + 63, feature_size)
        vector = points_to_xyz(hand, normalize=normalize)
        output[start:end] = vector[: end - start]
    if isinstance(frame, dict) and feature_size > HAND_FEATURE_SIZE:
        body_start = HAND_FEATURE_SIZE
        body_end = min(body_start + BODY_FEATURE_SIZE, feature_size)
        body = compact_body_vector(frame.get("pose") or frame.get("body") or [])
        output[body_start:body_end] = body[: body_end - body_start]
        expression_start = HAND_FEATURE_SIZE + BODY_FEATURE_SIZE
        expression_end = min(expression_start + EXPRESSION_FEATURE_SIZE, feature_size)
        expression = expression_features(
            frame.get("face") or [],
            frame.get("pose") or frame.get("body") or [],
        )
        output[expression_start:expression_end] = expression[: expression_end - expression_start]
    return output


def aggregate_non_manual_features(frames):
    summaries = [
        non_manual_summary(
            frame.get("face") or [],
            frame.get("pose") or frame.get("body") or [],
        )
        for frame in frames
        if isinstance(frame, dict) and (frame.get("face") or frame.get("pose") or frame.get("body"))
    ]
    if not summaries:
        return {
            "available": False,
            "feature_layout": "hands_v1",
            "note": "Face/body datapoints were not supplied for this prediction.",
        }
    return {
        "available": True,
        "feature_layout": "multimodal_v2",
        "frames": len(summaries),
        "mean": {
            key: round(float(np.mean([row[key] for row in summaries])), 4)
            for key in summaries[0]
        },
    }


def sequence_tracking_quality(vectors):
    if not vectors:
        return {
            "score": 0.0,
            "hands_visible_ratio": 0.0,
            "jitter": 1.0,
            "motion": 0.0,
            "tips": ["Show your hand clearly inside the camera frame."],
        }

    centers = []
    areas = []
    visible = 0
    two_hand_frames = 0

    for vector in vectors:
        hand_centers = []
        hand_areas = []
        for hand_index in range(2):
            hand = _hand_xy_from_vector(vector, hand_index)
            if hand is None:
                continue
            min_xy = hand.min(axis=0)
            max_xy = hand.max(axis=0)
            size = np.maximum(max_xy - min_xy, 0.0)
            hand_centers.append((min_xy + max_xy) / 2.0)
            hand_areas.append(float(size[0] * size[1]))
        if hand_centers:
            visible += 1
            centers.append(np.mean(np.vstack(hand_centers), axis=0))
            areas.append(float(np.mean(hand_areas)))
        if len(hand_centers) >= 2:
            two_hand_frames += 1

    visible_ratio = visible / len(vectors)
    if len(centers) >= 2:
        center_steps = np.linalg.norm(np.diff(np.vstack(centers), axis=0), axis=1)
        motion = float(np.clip(np.mean(center_steps) / 0.08, 0.0, 1.0))
        jitter = float(np.clip(np.std(center_steps) / 0.06, 0.0, 1.0))
    else:
        motion = 0.0
        jitter = 1.0

    avg_area = float(np.mean(areas)) if areas else 0.0
    size_score = float(np.clip(avg_area / 0.06, 0.0, 1.0))
    stability_score = max(0.0, 1.0 - jitter)
    score = round((0.42 * visible_ratio) + (0.26 * size_score) + (0.22 * stability_score) + (0.10 * min(1.0, motion + 0.25)), 4)

    tips = []
    if visible_ratio < 0.8:
        tips.append("Keep your hand visible for the full sign motion.")
    if avg_area < 0.025:
        tips.append("Move your hand closer to the camera.")
    if jitter > 0.55:
        tips.append("Move a little smoother or improve camera FPS.")
    if not tips:
        tips.append("Tracking is stable. Continue signing naturally.")

    return {
        "score": score,
        "hands_visible_ratio": round(visible_ratio, 4),
        "two_hand_ratio": round(two_hand_frames / len(vectors), 4),
        "jitter": round(jitter, 4),
        "motion": round(motion, 4),
        "average_hand_area": round(avg_area, 4),
        "tips": tips,
    }


MODEL_COMPLETION_TARGETS = {
    "alphabet": {
        "accuracy": 98.0,
        "f1_macro": 0.98,
        "classes": 28,
        "samples": 300,
    },
    "asl": {
        "accuracy": 80.0,
        "f1_macro": 0.78,
        "classes": 100,
        "samples": 500,
    },
    "isl": {
        "accuracy": 75.0,
        "f1_macro": 0.72,
        "classes": 10,
        "samples": 100,
    },
    "mixed": {
        "accuracy": 75.0,
        "classes": 88,
        "samples": 300,
    },
}


def model_readiness(name, metrics, class_count=0):
    target_name = "asl" if name.startswith("asl_") else name
    targets = MODEL_COMPLETION_TARGETS.get(target_name, MODEL_COMPLETION_TARGETS["mixed"])
    accuracy = float(metrics.get("accuracy") or metrics.get("best_validation_accuracy") or 0.0)
    f1_macro = metrics.get("f1_macro")
    f1_macro = float(f1_macro) if f1_macro is not None else None
    samples = int(metrics.get("samples") or 0)
    classes = int(metrics.get("classes") or class_count or 0)

    checks = {
        "accuracy": accuracy >= targets["accuracy"],
        "classes": classes >= targets["classes"],
        "samples": samples >= targets["samples"] if samples else target_name == "mixed",
    }
    if "f1_macro" in targets:
        checks["f1_macro"] = f1_macro is not None and f1_macro >= targets["f1_macro"]

    progress_parts = [
        min(1.0, accuracy / targets["accuracy"]) if targets["accuracy"] else 0.0,
        min(1.0, classes / targets["classes"]) if targets["classes"] else 0.0,
    ]
    if samples:
        progress_parts.append(min(1.0, samples / targets["samples"]))
    if "f1_macro" in targets and f1_macro is not None:
        progress_parts.append(min(1.0, f1_macro / targets["f1_macro"]))

    progress = round(100.0 * (sum(progress_parts) / len(progress_parts)), 2) if progress_parts else 0.0
    remaining = []
    if not checks["accuracy"]:
        remaining.append(f"Raise validation accuracy to {targets['accuracy']}%+.")
    if "f1_macro" in checks and not checks["f1_macro"]:
        remaining.append(f"Raise macro F1 to {targets['f1_macro']:.2f}+.")
    if not checks["classes"]:
        remaining.append(f"Cover {targets['classes']} classes.")
    if not checks["samples"]:
        remaining.append(f"Add at least {targets['samples']} validation samples.")

    return {
        "status": "complete" if all(checks.values()) else "training",
        "progress_percent": 100.0 if all(checks.values()) else progress,
        "checks": checks,
        "targets": targets,
        "remaining": remaining,
    }


class SequenceSignPredictor:
    def __init__(self, model_path=DEFAULT_SEQUENCE_MODEL_PATH, transformer_model_path=None, name="sequence"):
        self.name = name
        self.model_path = Path(model_path)
        transformer_model_path = Path(transformer_model_path) if transformer_model_path else None
        if transformer_model_path and transformer_model_path.is_file():
            self.model_path = transformer_model_path
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.classes = []
        self.sequence_length = 40
        self.feature_size = 126
        self.feature_normalization = "raw_mediapipe"
        self.model_type = "none"
        self.metrics = {}
        self.warmup_ms = None
        self._load()

    def _load(self):
        if not self.model_path.is_file():
            return

        checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=True)
        self.classes = checkpoint.get("classes") or []
        if not self.classes:
            raise RuntimeError("Sequence model checkpoint is missing classes.")

        self.sequence_length = int(checkpoint.get("sequence_length") or 40)
        self.feature_size = int(checkpoint.get("input_size") or 126)
        self.feature_normalization = checkpoint.get("feature_normalization") or (checkpoint.get("dataset_metadata") or {}).get("feature_normalization") or "raw_mediapipe"
        self.model_type = checkpoint.get("model_type") or checkpoint.get("rnn_type") or "gru"
        self.metrics = checkpoint.get("metrics") or self._load_metrics_sidecar(checkpoint)
        if self.model_type in {"transformer", "cnn_transformer"}:
            model_class = SignovaTemporalCNNTransformerModel if self.model_type == "cnn_transformer" else SignovaTransformerModel
            self.model = model_class(
                input_size=self.feature_size,
                model_dim=int(checkpoint.get("model_dim") or 128),
                num_heads=int(checkpoint.get("num_heads") or 4),
                num_layers=int(checkpoint.get("num_layers") or 2),
                num_classes=len(self.classes),
                dropout=float(checkpoint.get("dropout") or 0.25),
                max_length=self.sequence_length,
            ).to(self.device)
        else:
            self.model = SignovaSequenceModel(
                input_size=self.feature_size,
                hidden_size=int(checkpoint.get("hidden_size") or 192),
                num_layers=int(checkpoint.get("num_layers") or 2),
                num_classes=len(self.classes),
                dropout=float(checkpoint.get("dropout") or 0.25),
                rnn_type=checkpoint.get("rnn_type") or "gru",
            ).to(self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()
        self._warmup()

    def _warmup(self):
        if self.model is None:
            return
        started = time.perf_counter()
        sample = torch.zeros((1, self.sequence_length, self.feature_size), dtype=torch.float32, device=self.device)
        with torch.inference_mode():
            self.model(sample)
        self.warmup_ms = round((time.perf_counter() - started) * 1000.0, 2)

    def available(self):
        return self.model is not None

    def _load_metrics_sidecar(self, checkpoint):
        metrics_path = self.model_path.with_suffix(".metrics.json")
        if metrics_path.is_file():
            try:
                return load_json(metrics_path)
            except (OSError, json.JSONDecodeError):
                pass
        accuracy = checkpoint.get("val_accuracy")
        if accuracy is None:
            return {}
        return {
            "accuracy": round(float(accuracy), 4),
            "best_validation_accuracy": round(float(accuracy), 4),
            "classes": len(checkpoint.get("classes") or []),
            "model_path": str(self.model_path),
            "model_type": checkpoint.get("model_type") or checkpoint.get("rnn_type") or "unknown",
        }

    def metric_summary(self):
        if not self.metrics:
            return {}
        keys = [
            "accuracy",
            "precision_macro",
            "recall_macro",
            "f1_macro",
            "specificity_macro",
            "roc_auc_ovr_macro",
            "log_loss",
            "mcc",
            "samples",
            "classes",
            "best_validation_accuracy",
        ]
        summary = {key: self.metrics[key] for key in keys if key in self.metrics}
        summary["readiness"] = model_readiness(self.name, self.metrics, class_count=len(self.classes))
        return summary

    def _points_to_xyz(self, points):
        return points_to_xyz(points, normalize=self.feature_normalization == "wrist_centered_scale_normalized")

    def _frame_to_vector(self, frame):
        return frame_to_feature_vector(frame, self.feature_size, feature_normalization=self.feature_normalization)

    def predict(self, frames):
        if self.model is None:
            return None
        vectors = [self._frame_to_vector(frame) for frame in frames if frame]
        if not vectors:
            return None
        vectors = smooth_feature_vectors(vectors)
        tracking = sequence_tracking_quality(vectors)
        sequence = normalize_sequence(vectors, sequence_length=self.sequence_length, feature_size=self.feature_size)
        tensor = torch.from_numpy(sequence).float().unsqueeze(0).to(self.device)
        with torch.no_grad():
            probabilities = torch.softmax(self.model(tensor), dim=1)[0]
        top_values, top_indices = torch.topk(probabilities, k=min(3, len(self.classes)))
        confidence = top_values[0]
        index = top_indices[0]
        label = self.classes[int(index)]
        translation = translations_for_label(label, title_from_label(label))
        phrase = translation["english"]
        alternatives = [
            {
                "label": self.classes[int(class_index)],
                "confidence": round(float(score), 4),
            }
            for score, class_index in zip(top_values, top_indices)
        ]
        margin = float(top_values[0] - top_values[1]) if len(top_values) > 1 else float(top_values[0])
        return {
            "label": label,
            "phrase": phrase,
            "translations": translation,
            "language": translation["language"],
            "gloss": translation["gloss"],
            "confidence": round(float(confidence), 4),
            "source": f"{self.name}_{self.model_type}",
            "model": self.name,
            "engine": ENGINE_NAME,
            "sequence_length": len(frames),
            "stability": round(max(0.0, 1.0 - tracking["jitter"]), 4),
            "quality_score": tracking["score"],
            "tracking": tracking,
            "alternatives": alternatives,
            "confidence_margin": round(margin, 4),
            "is_uncertain": float(confidence) < 0.55 or margin < 0.12 or tracking["score"] < 0.42,
            "feedback": tracking["tips"],
            "model_metrics": self.metric_summary(),
        }


class MultiSequencePredictor:
    ASL_CONTROL_LABELS = {"blank", "del", "delete", "no_gesture", "nothing", "space", "unknown"}
    ASL_ROUTER_GATES = {
        "asl": {"confidence": 0.59, "margin": 0.13, "tracking": 0.42},
        "asl_top300": {"confidence": 0.63, "margin": 0.15, "tracking": 0.42},
        "asl_top500": {"confidence": 0.68, "margin": 0.19, "tracking": 0.46},
    }

    def __init__(self):
        self.models = {
            "mixed": SequenceSignPredictor(
                DEFAULT_SEQUENCE_MODEL_PATH,
                transformer_model_path=DEFAULT_TRANSFORMER_MODEL_PATH,
                name="mixed",
            ),
            "isl": SequenceSignPredictor(DEFAULT_ISL_SEQUENCE_MODEL_PATH, name="isl"),
            "asl": SequenceSignPredictor(DEFAULT_ASL_SEQUENCE_MODEL_PATH, name="asl"),
            "asl_top300": SequenceSignPredictor(DEFAULT_ASL_TOP300_SEQUENCE_MODEL_PATH, name="asl_top300"),
            "asl_top500": SequenceSignPredictor(DEFAULT_ASL_TOP500_SEQUENCE_MODEL_PATH, name="asl_top500"),
            "alphabet": SequenceSignPredictor(DEFAULT_ALPHABET_SEQUENCE_MODEL_PATH, name="alphabet"),
        }

    def available(self):
        return any(model.available() for model in self.models.values())

    def available_models(self):
        return {
            name: {
                "available": model.available(),
                "classes": len(model.classes),
                "path": model.model_path.name,
                "type": model.model_type,
                "feature_normalization": model.feature_normalization,
                "warmup_ms": model.warmup_ms,
                "metrics": model.metric_summary(),
            }
            for name, model in self.models.items()
        }

    def metrics(self):
        return {
            name: model.metric_summary()
            for name, model in self.models.items()
            if model.available()
        }

    def max_sequence_length(self):
        lengths = [model.sequence_length for model in self.models.values() if model.available()]
        return max(lengths) if lengths else 40

    def classes(self):
        labels = set()
        for model in self.models.values():
            labels.update(model.classes)
        return sorted(labels)

    def asl_classes(self):
        labels = set()
        for name in self.ASL_ROUTER_GATES:
            model = self.models.get(name)
            if model and model.available():
                labels.update(model.classes)
        return sorted(labels)

    def asl_vocabulary_summary(self):
        classes = self.asl_classes()
        control_labels = sorted(set(classes) & self.ASL_CONTROL_LABELS)
        available = {
            name: len(self.models[name].classes)
            for name in self.ASL_ROUTER_GATES
            if name in self.models and self.models[name].available()
        }
        return {
            "unique_signs": len(classes) - len(control_labels),
            "unique_classes": len(classes),
            "control_labels": control_labels,
            "models": available,
            "routing_order": [name for name in self.ASL_ROUTER_GATES if name in available],
            "primary_model": "asl",
        }

    @classmethod
    def _candidate_passes_gate(cls, name, prediction):
        gate = cls.ASL_ROUTER_GATES[name]
        tracking = prediction.get("tracking") or {}
        return (
            float(prediction.get("confidence") or 0.0) >= gate["confidence"]
            and float(prediction.get("confidence_margin") or 0.0) >= gate["margin"]
            and float(tracking.get("score") or prediction.get("quality_score") or 0.0) >= gate["tracking"]
        )

    @staticmethod
    def _candidate_summary(name, prediction, accepted):
        metrics = prediction.get("model_metrics") or {}
        return {
            "model": name,
            "label": prediction.get("label"),
            "confidence": prediction.get("confidence"),
            "confidence_margin": prediction.get("confidence_margin"),
            "quality_score": prediction.get("quality_score"),
            "historical_accuracy": metrics.get("accuracy") or metrics.get("best_validation_accuracy"),
            "historical_f1_macro": metrics.get("f1_macro"),
            "accepted": accepted,
        }

    @staticmethod
    def _historical_reliability(prediction):
        metrics = prediction.get("model_metrics") or {}
        accuracy = float(metrics.get("accuracy") or metrics.get("best_validation_accuracy") or 0.0) / 100.0
        f1_macro = float(metrics.get("f1_macro") or 0.0)
        return max(0.0, min(1.0, (0.45 * accuracy) + (0.55 * f1_macro)))

    def _consensus_prediction(self, candidate_predictions):
        by_label = defaultdict(list)
        for name, prediction in candidate_predictions:
            by_label[prediction.get("label")].append((name, prediction))

        groups = [group for label, group in by_label.items() if label and len(group) >= 2]
        if not groups:
            return None

        def consensus_score(group):
            return sum(
                float(prediction.get("confidence") or 0.0) + (0.25 * self._historical_reliability(prediction))
                for _, prediction in group
            ) / len(group)

        group = max(groups, key=consensus_score)
        avg_confidence = sum(float(prediction.get("confidence") or 0.0) for _, prediction in group) / len(group)
        avg_margin = sum(float(prediction.get("confidence_margin") or 0.0) for _, prediction in group) / len(group)
        avg_tracking = sum(
            float((prediction.get("tracking") or {}).get("score") or prediction.get("quality_score") or 0.0)
            for _, prediction in group
        ) / len(group)
        if avg_confidence < 0.55 or avg_margin < 0.10 or avg_tracking < 0.42:
            return None

        selected_name, selected = max(
            group,
            key=lambda item: (
                self._historical_reliability(item[1]),
                float(item[1].get("confidence") or 0.0),
            ),
        )
        return selected_name, selected, {
            "agreeing_models": [name for name, _ in group],
            "average_confidence": round(avg_confidence, 4),
            "average_margin": round(avg_margin, 4),
            "average_tracking": round(avg_tracking, 4),
        }

    def predict_asl_hierarchy(self, frames):
        attempted = []
        candidates = []
        candidate_predictions = []
        fallback = None
        fallback_score = -1.0
        reliability_bonus = {"asl": 0.10, "asl_top300": 0.05, "asl_top500": 0.0}

        for name in self.ASL_ROUTER_GATES:
            model = self.models.get(name)
            if not model or not model.available():
                continue
            attempted.append(name)
            prediction = model.predict(frames)
            if not prediction:
                continue

            accepted = self._candidate_passes_gate(name, prediction)
            candidates.append(self._candidate_summary(name, prediction, accepted))
            candidate_predictions.append((name, prediction))
            confidence = float(prediction.get("confidence") or 0.0)
            margin = float(prediction.get("confidence_margin") or 0.0)
            tracking = float((prediction.get("tracking") or {}).get("score") or prediction.get("quality_score") or 0.0)
            history = self._historical_reliability(prediction)
            score = confidence + (0.35 * margin) + (0.15 * tracking) + (0.20 * history) + reliability_bonus[name]
            if score > fallback_score:
                fallback = prediction
                fallback_score = score

            if accepted:
                prediction["selected_model"] = name
                prediction["is_uncertain"] = False
                prediction["asl_vocabulary"] = self.asl_vocabulary_summary()
                prediction["router"] = {
                    "strategy": "confidence_hierarchy",
                    "accepted": True,
                    "selected_model": name,
                    "attempted_models": attempted,
                    "candidates": candidates,
                }
                return prediction

        consensus = self._consensus_prediction(candidate_predictions)
        if consensus:
            selected_name, selected, evidence = consensus
            selected["selected_model"] = selected_name
            selected["is_uncertain"] = False
            selected["asl_vocabulary"] = self.asl_vocabulary_summary()
            selected["router"] = {
                "strategy": "historical_model_consensus",
                "accepted": True,
                "selected_model": selected_name,
                "attempted_models": attempted,
                "candidates": candidates,
                "consensus": evidence,
            }
            return selected

        if fallback:
            fallback["selected_model"] = fallback.get("model") or "asl"
            fallback["is_uncertain"] = True
            fallback["asl_vocabulary"] = self.asl_vocabulary_summary()
            fallback["router"] = {
                "strategy": "confidence_hierarchy",
                "accepted": False,
                "selected_model": fallback["selected_model"],
                "attempted_models": attempted,
                "candidates": candidates,
                "reason": "No ASL model cleared its confidence, margin, and tracking-quality gate.",
            }
        return fallback

    def select_model_name(self, mode=None, language=None, preferred=None):
        preferred = (preferred or "").lower()
        mode = (mode or "").lower()
        language = (language or "").lower()
        if preferred in self.models and self.models[preferred].available():
            return preferred
        if mode in {"alphabet", "spell", "spelling"} and self.models["alphabet"].available():
            return "alphabet"
        if language in {"hindi", "hinglish", "isl", "isl gloss", "indian sign language"} and self.models["isl"].available():
            return "isl"
        if language == "asl" and self.models["asl"].available():
            return "asl"
        if mode == "word" and self.models["asl"].available():
            return "asl"
        if mode == "sentence" and self.models["isl"].available():
            return "isl"
        if self.models["mixed"].available():
            return "mixed"
        for name, model in self.models.items():
            if model.available():
                return name
        return "mixed"

    def predict(self, frames, mode=None, language=None, preferred=None):
        preferred_key = (preferred or "").lower()
        language_key = (language or "").lower()
        mode_key = (mode or "").lower()
        if preferred_key == "asl" or language_key == "asl" or (mode_key == "word" and not preferred_key):
            prediction = self.predict_asl_hierarchy(frames)
            if prediction:
                prediction["routing_request"] = {
                    "preferred_model": preferred_key or None,
                    "language": language_key or None,
                    "mode": mode_key or None,
                    "explicit_model": bool(preferred_key),
                }
            return prediction

        name = self.select_model_name(mode=mode, language=language, preferred=preferred)
        model = self.models.get(name)
        if not model:
            return None
        prediction = model.predict(frames)
        if prediction:
            prediction["selected_model"] = name
            prediction["routing_request"] = {
                "preferred_model": preferred_key or None,
                "language": language_key or None,
                "mode": mode_key or None,
                "explicit_model": bool(preferred_key),
            }
        return prediction


class LandmarkGesturePredictor:
    def __init__(
        self,
        ann_dir=DEFAULT_ANN_DIR,
        centroids_path=DEFAULT_CENTROIDS_PATH,
        mlp_model_path=DEFAULT_LANDMARK_MODEL_PATH,
        sequence_model_path=DEFAULT_SEQUENCE_MODEL_PATH,
        samples_per_label=600,
    ):
        self.ann_dir = Path(ann_dir)
        self.centroids_path = Path(centroids_path)
        self.samples_per_label = samples_per_label
        self.mlp_predictor = LandmarkMLPPredictor(mlp_model_path)
        self.sequence_predictor = MultiSequencePredictor()
        self.centroids = self._load_or_build_centroids()

    def _load_or_build_centroids(self):
        if self.centroids_path.is_file():
            payload = load_json(self.centroids_path)
            return {name: np.asarray(values, dtype=np.float32) for name, values in payload.items()}

        centroids = {}
        if not self.ann_dir.is_dir():
            return centroids

        for json_path in sorted(self.ann_dir.glob("*.json")):
            label_name = json_path.stem
            vectors = []
            data = load_json(json_path)

            for item in data.values():
                labels = item.get("labels") or []
                landmarks_groups = item.get("landmarks") or []
                for label, landmarks in zip(labels, landmarks_groups):
                    if label == "no_gesture":
                        continue
                    try:
                        vectors.append(normalize_landmarks(landmarks))
                    except ValueError:
                        continue
                    if len(vectors) >= self.samples_per_label:
                        break
                if len(vectors) >= self.samples_per_label:
                    break

            if vectors:
                centroids[label_name] = np.mean(np.vstack(vectors), axis=0)
                print(f"Built centroid for {label_name} from {len(vectors)} samples", flush=True)

        save_json(self.centroids_path, {name: values.tolist() for name, values in centroids.items()})
        return centroids

    def predict(self, landmarks):
        if self.mlp_predictor.available():
            prediction = self.mlp_predictor.predict(landmarks)
            if prediction:
                label = prediction["label"]
                phrase = GESTURE_PHRASES.get(label, label.replace("_", " ").title())
                translation = translations_for_label(label, phrase)
                return {
                    "label": label,
                    "phrase": translation["english"],
                    "translations": translation,
                    "language": translation["language"],
                    "gloss": translation["gloss"],
                    "confidence": prediction["confidence"],
                    "source": prediction["source"],
                    "engine": ENGINE_NAME,
                }

        if not self.centroids:
            return {
                "label": "unknown",
                "phrase": "No gesture model is available",
                "confidence": 0.0,
                "source": "landmarks",
            }

        vector = normalize_landmarks(landmarks)
        distances = {
            label: float(np.linalg.norm(vector - centroid))
            for label, centroid in self.centroids.items()
        }
        label, distance = min(distances.items(), key=lambda item: item[1])
        confidence = 1.0 / (1.0 + distance)
        phrase = GESTURE_PHRASES.get(label, label.replace("_", " ").title())
        translation = translations_for_label(label, phrase)
        return {
            "label": label,
            "phrase": translation["english"],
            "translations": translation,
            "language": translation["language"],
            "gloss": translation["gloss"],
            "confidence": round(confidence, 4),
            "distance": round(distance, 4),
            "source": "landmarks",
            "engine": ENGINE_NAME,
        }

    def predict_sequence(self, frames, options=None):
        options = options or {}
        preferred_model = (options.get("model") or options.get("preferred_model") or "").lower()
        max_frames = int(options.get("max_frames") or self.sequence_predictor.max_sequence_length() or 40)
        max_frames = max(12, min(max_frames, 90))
        sequence_frames = []
        clean_landmarks = []
        for frame in frames[-max_frames:]:
            landmarks = frame.get("landmarks") if isinstance(frame, dict) else frame
            if landmarks:
                sequence_frames.append(frame)
                clean_landmarks.append(landmarks)

        if not sequence_frames:
            return {
                "label": "unknown",
                "phrase": "Waiting for signs",
                "confidence": 0.0,
                "source": "temporal_landmarks",
                "sequence_length": 0,
                "quality_score": 0.0,
                "feedback": ["Show your hand clearly inside the camera frame."],
            }

        sequence_prediction = None
        explicit_sequence_context = bool(
            preferred_model
            or options.get("mode")
            or options.get("translation_mode")
            or options.get("language")
            or options.get("output_language")
        )
        if preferred_model not in {"basic", "quick", "gesture", "landmark", "landmarks"}:
            sequence_prediction = self.sequence_predictor.predict(
                sequence_frames,
                mode=options.get("mode") or options.get("translation_mode"),
                language=options.get("language") or options.get("output_language"),
                preferred=preferred_model,
            )
            if sequence_prediction:
                sequence_prediction["non_manual"] = aggregate_non_manual_features(sequence_frames)
                metrics = sequence_prediction.get("model_metrics") or {}
                accuracy = float(metrics.get("accuracy") or metrics.get("best_validation_accuracy") or 0.0)
                healthy_sequence_model = accuracy >= 20.0 or sequence_prediction.get("selected_model") in {"mixed", "asl"}
                if not sequence_prediction.get("is_uncertain") and healthy_sequence_model:
                    return sequence_prediction
                if explicit_sequence_context:
                    sequence_prediction["is_uncertain"] = True
                    sequence_prediction["fallback_rejected"] = "generic_quick_gesture"
                    sequence_prediction["feedback"] = list(dict.fromkeys(
                        (sequence_prediction.get("feedback") or [])
                        + ["Selected language/model stayed active; no generic gesture was substituted."]
                    ))[:3]
                    return sequence_prediction

        weighted_votes = defaultdict(float)
        predictions = []
        quality_scores = []
        feedback = []

        for landmarks in clean_landmarks:
            prediction = self.predict(landmarks)
            label = prediction.get("label", "unknown")
            confidence = float(prediction.get("confidence") or 0.0)
            weighted_votes[label] += max(confidence, 0.01)
            predictions.append((label, confidence))

            quality = landmark_quality(landmarks)
            quality_scores.append(float(quality["score"]))
            feedback.extend(quality["tips"])

        label, vote_score = max(weighted_votes.items(), key=lambda item: item[1])
        matching = [confidence for item_label, confidence in predictions if item_label == label]
        stability = len(matching) / len(predictions)
        avg_confidence = sum(matching) / len(matching) if matching else 0.0
        quality_score = sum(quality_scores) / len(quality_scores)
        fallback_vectors = smooth_feature_vectors([frame_to_feature_vector(frame) for frame in sequence_frames])
        tracking = sequence_tracking_quality(fallback_vectors)
        confidence = round(min(1.0, (0.68 * avg_confidence) + (0.22 * stability) + (0.10 * quality_score)), 4)
        translation = translations_for_label(label, GESTURE_PHRASES.get(label, label.replace("_", " ").title()))

        unique_feedback = []
        for tip in feedback:
            if tip not in unique_feedback:
                unique_feedback.append(tip)

        return {
            "label": label,
            "phrase": translation["english"],
            "translations": translation,
            "language": translation["language"],
            "gloss": translation["gloss"],
            "confidence": confidence,
            "source": "temporal_landmark_mlp" if self.mlp_predictor.available() else "temporal_landmarks",
            "engine": ENGINE_NAME,
            "sequence_length": len(clean_landmarks),
            "stability": round(stability, 4),
            "quality_score": round(quality_score, 4),
            "tracking": tracking,
            "non_manual": aggregate_non_manual_features(sequence_frames),
            "confidence_margin": 1.0,
            "is_uncertain": confidence < 0.45 or tracking["score"] < 0.38,
            "fallback_from": sequence_prediction.get("selected_model") if sequence_prediction else None,
            "feedback": (unique_feedback[:2] or tracking["tips"][:2] or ["Quick gesture fallback active. Hold the sign steady."]),
        }


class ASLImagePredictor:
    def __init__(self, model_path=DEFAULT_MODEL_PATH, class_map_path=DEFAULT_CLASS_MAP_PATH):
        self.model_path = Path(model_path)
        self.class_map_path = Path(class_map_path)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.transform = transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        self.model = None
        self.classes = []
        self._load()

    def _load(self):
        if not self.model_path.is_file():
            return

        checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=True)
        self.classes = checkpoint.get("classes") or []
        if not self.classes and self.class_map_path.is_file():
            class_map = load_json(self.class_map_path)
            self.classes = [class_map[str(index)] for index in range(len(class_map))]

        if not self.classes:
            raise RuntimeError("Model checkpoint is missing class labels.")

        self.model = models.resnet18(weights=ResNet18_Weights.DEFAULT)
        self.model.fc = nn.Linear(self.model.fc.in_features, len(self.classes))
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

    def available(self):
        return self.model is not None

    def predict_image(self, image):
        if self.model is None:
            return {
                "label": "model_not_trained",
                "phrase": "Image model is not trained yet",
                "confidence": 0.0,
                "source": "image",
            }

        if image.mode != "RGB":
            image = image.convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            probabilities = torch.softmax(self.model(tensor), dim=1)[0]
        confidence, index = torch.max(probabilities, dim=0)
        label = self.classes[int(index)]
        return {
            "label": label,
            "phrase": label.replace("_", " ").title(),
            "confidence": round(float(confidence), 4),
            "source": "image",
        }

    def predict_base64(self, image_base64):
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        return self.predict_image(image)


def main():
    parser = argparse.ArgumentParser(description="Run Signova predictions.")
    parser.add_argument("--landmarks-json", type=Path)
    parser.add_argument("--image", type=Path)
    parser.add_argument("--status", action="store_true", help="Print loaded model status without running a prediction.")
    args = parser.parse_args()

    if args.status or (not args.landmarks_json and not args.image):
        predictor = MultiSequencePredictor()
        print(json.dumps(
            {
                "engine": ENGINE_NAME,
                "message": "predict.py is a model utility. Use signova.py to run the API service.",
                "sequence_models": predictor.available_models(),
                "usage": [
                    "python ai-service\\Models\\predict.py --status",
                    "python ai-service\\Models\\predict.py --landmarks-json sample_landmarks.json",
                    "python ai-service\\Models\\predict.py --image sample.jpg",
                ],
            },
            indent=2,
        ))
    elif args.landmarks_json:
        payload = load_json(args.landmarks_json)
        predictor = LandmarkGesturePredictor()
        print(json.dumps(predictor.predict(payload["landmarks"]), indent=2))
    elif args.image:
        predictor = ASLImagePredictor()
        print(json.dumps(predictor.predict_image(Image.open(args.image)), indent=2))


if __name__ == "__main__":
    main()
