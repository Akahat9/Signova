import json
import os
from collections import Counter, defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import threading
import time
from urllib.parse import urlparse
import urllib.request
import webbrowser


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))

from Models.predict import ASLImagePredictor, LandmarkGesturePredictor, GESTURE_PHRASES, translations_for_label  # noqa: E402
from Models.rtmw_engine import RTMWWholeBodyEngine  # noqa: E402


HOST = os.getenv("SIGNOVA_AI_HOST", "127.0.0.1")
PORT = int(os.getenv("SIGNOVA_AI_PORT", "8000"))
ENGINE_NAME = "Signova AI Synapse Engine"
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("SIGNOVA_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]
MAX_REQUEST_BYTES = int(os.getenv("SIGNOVA_MAX_REQUEST_BYTES", str(5 * 1024 * 1024)))
AI_SERVICE_TOKEN = os.getenv("SIGNOVA_AI_SERVICE_TOKEN", "")
MAX_CONCURRENT_INFERENCES = max(1, int(os.getenv("SIGNOVA_MAX_CONCURRENT_INFERENCES", "2")))
INFERENCE_ACQUIRE_TIMEOUT = float(os.getenv("SIGNOVA_INFERENCE_ACQUIRE_TIMEOUT", "0.25"))

landmark_predictor = None
image_predictor = None
wholebody_engine = None
prediction_telemetry = None
predictor_init_lock = threading.RLock()
inference_slots = threading.BoundedSemaphore(MAX_CONCURRENT_INFERENCES)

PREFERRED_SIGN_LABELS = [
    "help_me",
    "thank_you_so_much",
    "i_need_water",
    "yes",
    "i_am_very_happy",
    "i_am_crying",
    "angry",
    "palm",
    "stop",
    "ok",
    "call",
    "mute",
    "like",
    "dislike",
    "peace",
    "one",
    "two_up",
]

PLANNED_MULTIMODAL_SIGNS = {
    "thank_you_so_much",
    "i_need_water",
    "i_am_very_happy",
    "i_am_crying",
    "angry",
}

SIGN_HINTS = {
    "angry": "Use the trained hand motion with a clear angry facial expression",
    "call": "Phone hand near face",
    "dislike": "Thumb down",
    "like": "Thumb up",
    "mute": "Muted mouth gesture",
    "ok": "Circle with thumb and finger",
    "one": "One finger up",
    "palm": "Open palm",
    "peace": "Two fingers up",
    "stop": "Open palm forward",
    "two_up": "Two fingers up",
    "fist": "Closed fist",
    "four": "Four fingers up",
    "help_me": "Perform the trained help gesture with face and upper body visible",
    "i_am_crying": "Perform the trained crying phrase with matching facial expression",
    "i_am_very_happy": "Perform the trained happy phrase with a natural smile",
    "i_need_water": "Perform the trained water request phrase",
    "peace_inverted": "Two fingers, palm inward",
    "rock": "Rock hand gesture",
    "stop_inverted": "Stop sign, palm inward",
    "three": "Three fingers up",
    "three2": "Three fingers variant",
    "thank_you_so_much": "Perform the trained thank-you phrase with natural head and face movement",
    "two_up_inverted": "Two fingers, palm inward",
    "yes": "Perform the trained yes motion with natural head movement",
}


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def get_landmark_predictor():
    global landmark_predictor
    if landmark_predictor is None:
        with predictor_init_lock:
            if landmark_predictor is None:
                landmark_predictor = LandmarkGesturePredictor()
    return landmark_predictor


def get_image_predictor():
    global image_predictor
    if image_predictor is None:
        with predictor_init_lock:
            if image_predictor is None:
                image_predictor = ASLImagePredictor()
    return image_predictor


def get_wholebody_engine():
    global wholebody_engine
    if wholebody_engine is None:
        with predictor_init_lock:
            if wholebody_engine is None:
                wholebody_engine = RTMWWholeBodyEngine()
    return wholebody_engine


class PredictionTelemetry:
    def __init__(self):
        self.lock = threading.RLock()
        self.total = 0
        self.accepted = 0
        self.uncertain = 0
        self.labels = defaultdict(lambda: {
            "attempts": 0,
            "accepted": 0,
            "uncertain": 0,
            "confidence_total": 0.0,
            "margin_total": 0.0,
            "quality_total": 0.0,
            "models": Counter(),
            "contexts": Counter(),
            "books": Counter(),
            "sign_number": None,
            "vocabulary_size": 0,
        })

    def record(self, prediction):
        if not prediction:
            return prediction
        label = str(prediction.get("label") or "unknown")[:120]
        uncertain = bool(prediction.get("is_uncertain"))
        accepted = bool((prediction.get("router") or {}).get("accepted", not uncertain)) and not uncertain
        model = str(prediction.get("selected_model") or prediction.get("source") or "unknown")[:80]
        context = str(prediction.get("vocabulary_context") or prediction.get("active_language") or "Unknown")[:80]
        book = str(prediction.get("active_book") or "Unknown")[:80]
        with self.lock:
            self.total += 1
            self.accepted += int(accepted)
            self.uncertain += int(uncertain)
            row = self.labels[label]
            row["attempts"] += 1
            row["accepted"] += int(accepted)
            row["uncertain"] += int(uncertain)
            row["confidence_total"] += float(prediction.get("confidence") or 0.0)
            row["margin_total"] += float(prediction.get("confidence_margin") or 0.0)
            row["quality_total"] += float(prediction.get("quality_score") or (prediction.get("tracking") or {}).get("score") or 0.0)
            row["models"][model] += 1
            row["contexts"][context] += 1
            row["books"][book] += 1
            row["sign_number"] = prediction.get("sign_number")
            row["vocabulary_size"] = int(prediction.get("vocabulary_size") or 0)
        return prediction

    def report(self, predictor):
        with self.lock:
            rows = []
            for label, stats in self.labels.items():
                attempts = stats["attempts"]
                accepted_rate = stats["accepted"] / attempts if attempts else 0.0
                mean_confidence = stats["confidence_total"] / attempts if attempts else 0.0
                mean_margin = stats["margin_total"] / attempts if attempts else 0.0
                mean_quality = stats["quality_total"] / attempts if attempts else 0.0
                weakness_score = (
                    (0.45 * (1.0 - accepted_rate))
                    + (0.30 * (1.0 - mean_confidence))
                    + (0.15 * (1.0 - mean_margin))
                    + (0.10 * (1.0 - mean_quality))
                )
                rows.append({
                    "label": label,
                    "sign_number": stats["sign_number"],
                    "vocabulary_size": stats["vocabulary_size"],
                    "attempts": attempts,
                    "accepted": stats["accepted"],
                    "uncertain": stats["uncertain"],
                    "accepted_rate": round(accepted_rate, 4),
                    "mean_confidence": round(mean_confidence, 4),
                    "mean_margin": round(mean_margin, 4),
                    "mean_quality": round(mean_quality, 4),
                    "weakness_score": round(weakness_score, 4),
                    "diagnostic_status": (
                        "insufficient_samples"
                        if attempts < 5
                        else "weak"
                        if weakness_score >= 0.5
                        else "watch"
                        if weakness_score >= 0.35
                        else "healthy"
                    ),
                    "models": dict(stats["models"]),
                    "contexts": dict(stats["contexts"]),
                    "books": dict(stats["books"]),
                })
            rows.sort(key=lambda item: (-item["weakness_score"], -item["attempts"], item["label"]))
            return {
                "privacy": "Aggregate prediction statistics only. No video, landmarks, identity, or transcript is stored.",
                "vocabulary": {
                    "note": "Vocabulary is resolved per selected model, language, and translation mode.",
                    "available_models": predictor.sequence_predictor.available_models(),
                },
                "predictions": self.total,
                "accepted": self.accepted,
                "uncertain": self.uncertain,
                "accepted_rate": round(self.accepted / self.total, 4) if self.total else 0.0,
                "observed_signs": len(rows),
                "weak_signs": rows[:25],
                "signs": rows,
            }


def get_prediction_telemetry():
    global prediction_telemetry
    if prediction_telemetry is None:
        prediction_telemetry = PredictionTelemetry()
    return prediction_telemetry


def _active_book(mode):
    mode = str(mode or "").strip().lower()
    if mode in {"alphabet", "letter", "letters", "spell", "spelling"}:
        return "Letter Signs Book"
    if mode in {"sentence", "sentences", "phrase", "phrases"}:
        return "Sentence Level Signs Book"
    return "Word Level Signs Book"


def _prediction_context(prediction, options=None):
    options = options or {}
    predictor = get_landmark_predictor()
    sequence_predictor = predictor.sequence_predictor
    mode = str(options.get("mode") or options.get("translation_mode") or prediction.get("active_mode") or "word").strip().lower()
    requested_language = str(options.get("language") or options.get("output_language") or prediction.get("active_language") or "").strip()
    preferred = str(options.get("model") or options.get("preferred_model") or "").strip().lower()
    selected_model = str(prediction.get("selected_model") or "").strip().lower()
    source = str(prediction.get("source") or "").strip().lower()

    if not selected_model:
        if preferred in sequence_predictor.models:
            selected_model = preferred
        elif source.startswith("alphabet"):
            selected_model = "alphabet"
        elif source.startswith("isl"):
            selected_model = "isl"
        elif source.startswith("asl"):
            selected_model = "asl"
        elif source.startswith("mixed"):
            selected_model = "mixed"
        elif preferred in {"basic", "quick", "gesture", "landmark", "landmarks"}:
            selected_model = "basic"
        else:
            selected_model = sequence_predictor.select_model_name(mode=mode, language=requested_language, preferred=preferred)

    if selected_model in sequence_predictor.ASL_ROUTER_GATES:
        classes = [
            label for label in sequence_predictor.asl_classes()
            if label not in sequence_predictor.ASL_CONTROL_LABELS
        ]
        language = "ASL"
        context = "ASL production hierarchy"
    elif selected_model in sequence_predictor.models and sequence_predictor.models[selected_model].available():
        classes = [
            label for label in sorted(set(sequence_predictor.models[selected_model].classes))
            if label not in sequence_predictor.ASL_CONTROL_LABELS
        ]
        language = {
            "alphabet": "Alphabet",
            "isl": "ISL",
            "mixed": "Mixed signs",
        }.get(selected_model, requested_language or selected_model.upper())
        context = f"{language} · {selected_model}"
    else:
        classes = sorted(set(GESTURE_PHRASES) | set(PREFERRED_SIGN_LABELS))
        selected_model = selected_model or "basic"
        language = "Quick gestures" if selected_model == "basic" else (requested_language or selected_model.upper())
        context = f"{language} · {selected_model}"

    return {
        "classes": classes,
        "active_model": selected_model,
        "active_language": language,
        "active_mode": mode,
        "active_book": _active_book(mode),
        "vocabulary_context": context,
    }


def enrich_prediction(prediction, options=None):
    if not prediction:
        return prediction
    context = _prediction_context(prediction, options)
    classes = context.pop("classes")
    label = prediction.get("label")
    prediction["sign_number"] = (classes.index(label) + 1) if label in classes else None
    prediction["vocabulary_size"] = len(classes)
    prediction.update(context)
    prediction["telemetry"] = {
        "accepted": bool((prediction.get("router") or {}).get("accepted", not prediction.get("is_uncertain"))) and not prediction.get("is_uncertain"),
        "privacy": "aggregate_only",
    }
    return get_prediction_telemetry().record(prediction)


def choose_translation(payload, output_language):
    language = (output_language or "English").lower()
    if language in {"hindi", "hi"}:
        return payload.get("hindi") or payload.get("english")
    if language in {"hinglish", "mixed", "mixed hindi english"}:
        return payload.get("hinglish") or payload.get("hindi") or payload.get("english")
    if language in {"isl", "isl gloss", "indian sign language", "gloss"}:
        return payload.get("gloss") or payload.get("english")
    return payload.get("english")


def sentence_from_labels(labels, output_language="English"):
    cleaned = [label for label in labels if label and label not in {"unknown", "no_gesture"}]
    if not cleaned:
        return "Waiting for signs"

    translated = []
    for label in cleaned:
        payload = translations_for_label(label)
        translated.append(choose_translation(payload, output_language))

    if any(translated):
        return " ".join(item for item in translated if item)

    words = []
    for label in cleaned:
        if label == "space":
            words.append(" ")
        elif label == "del":
            if words:
                words.pop()
        elif len(label) == 1:
            words.append(label)
        else:
            words.append(label.replace("_", " "))

    sentence = "".join(words) if all(len(item.strip()) <= 1 for item in words if item.strip()) else " ".join(words)
    return " ".join(sentence.split()).capitalize()


def get_supported_signs():
    predictor = get_landmark_predictor()
    model_classes = {}
    sequence_models = getattr(predictor.sequence_predictor, "models", {})
    for model_name, model in sequence_models.items():
        if model.available():
            model_classes[model_name] = set(model.classes)
    available_labels = sorted(
        set(predictor.centroids.keys())
        | set(getattr(predictor.mlp_predictor, "classes", []))
        | set(predictor.sequence_predictor.classes())
        | set(GESTURE_PHRASES.keys())
        | PLANNED_MULTIMODAL_SIGNS
    )
    preferred = [label for label in PREFERRED_SIGN_LABELS if label in available_labels]
    remaining = [label for label in available_labels if label not in preferred]
    signs = []

    for label in preferred + remaining:
        sources = []
        if label in GESTURE_PHRASES or label in predictor.centroids or label in getattr(predictor.mlp_predictor, "classes", []):
            sources.append("quick_gesture")
        for model_name in ("isl", "asl", "asl_top300", "asl_top500", "alphabet", "mixed"):
            labels = model_classes.get(model_name, set())
            if label in labels:
                sources.append(f"{model_name}_transformer")

        translation = translations_for_label(label)
        if label in model_classes.get("alphabet", set()):
            language = "Alphabet"
        elif any(label in model_classes.get(name, set()) for name in ("asl", "asl_top300", "asl_top500")):
            language = "ASL"
        elif translation.get("language") == "ISL" or label in model_classes.get("isl", set()):
            language = "ISL"
        else:
            language = "Mixed"

        recognition_status = "available" if sources else "training_required"
        signs.append(
            {
                "label": label,
                "sign": GESTURE_PHRASES.get(label, translation.get("english") or label.replace("_", " ").title()),
                "hint": SIGN_HINTS.get(label, translation.get("gloss") or label.replace("_", " ").title()),
                "language": language,
                "source": sources[0] if sources else "multimodal_training_queue",
                "sources": sources or ["multimodal_training_queue"],
                "recognition_status": recognition_status,
                "feature_layout": "multimodal_v2" if label in PLANNED_MULTIMODAL_SIGNS else "hands_v1",
            }
        )

    return signs


def get_supported_labels():
    return [item["label"] for item in get_supported_signs()]


class SignovaHandler(BaseHTTPRequestHandler):
    def _cors_origin(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            return origin
        return None

    def _authorized(self):
        if not AI_SERVICE_TOKEN:
            return HOST in {"127.0.0.1", "localhost", "::1"}
        return self.headers.get("Authorization") == f"Bearer {AI_SERVICE_TOKEN}"

    def _send_json(self, status, payload):
        safe_payload = payload
        if status >= 500 and "error" in payload:
            safe_payload = {"error": "Internal AI service error"}
        body = json.dumps(safe_payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        cors_origin = self._cors_origin()
        if cors_origin:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Vary", "Origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Invalid Content-Length") from exc
        if length < 0:
            raise ValueError("Invalid Content-Length")
        if length == 0:
            return {}
        if length > MAX_REQUEST_BYTES:
            raise ValueError("Request body is too large")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            path = path[4:]
        if path == "/health":
            self._send_json(200, {"service": "Signova AI", "status": "ok"})
            return
        if not self._authorized():
            self._send_json(401, {"error": "Authentication required"})
            return
        if path == "/":
            self._send_json(
                200,
                {
                    "service": "Signova AI",
                    "engine": ENGINE_NAME,
                    "status": "ok",
                    "endpoints": ["/health", "/signs", "/metrics", "/prediction-telemetry", "/wholebody/status", "/wholebody/metrics", "/wholebody/frame", "/predict-sequence", "/predict-sequence-v2", "/predict-landmarks", "/predict-image", "/sentence"],
                },
            )
            return
        if path == "/ready":
            image = get_image_predictor()
            supported_labels = get_supported_labels()
            self._send_json(
                200,
                {
                    "service": "Signova AI",
                    "engine": ENGINE_NAME,
                    "status": "ok",
                    "image_model_available": image.available(),
                    "landmark_model_available": get_landmark_predictor().mlp_predictor.available(),
                    "sequence_model_available": get_landmark_predictor().sequence_predictor.available(),
                    "sequence_models": get_landmark_predictor().sequence_predictor.available_models(),
                    "asl_vocabulary": get_landmark_predictor().sequence_predictor.asl_vocabulary_summary(),
                    "supported_label_count": len(supported_labels),
                    "sign_catalog_endpoint": "/signs",
                    "wholebody": get_wholebody_engine().status(),
                },
            )
            return
        if path == "/metrics":
            predictor = get_landmark_predictor()
            self._send_json(
                200,
                {
                    "engine": ENGINE_NAME,
                    "primary_metric": "f1_macro",
                    "note": "Macro F1 is the best headline metric for imbalanced sign datasets.",
                    "sequence_models": predictor.sequence_predictor.available_models(),
                    "metrics": predictor.sequence_predictor.metrics(),
                    "asl_vocabulary": predictor.sequence_predictor.asl_vocabulary_summary(),
                },
            )
            return
        if path == "/signs":
            predictor = get_landmark_predictor()
            self._send_json(
                200,
                {
                    "engine": ENGINE_NAME,
                    "asl_vocabulary": predictor.sequence_predictor.asl_vocabulary_summary(),
                    "signs": get_supported_signs(),
                },
            )
            return
        if path == "/wholebody/status":
            self._send_json(200, get_wholebody_engine().status())
            return
        if path == "/wholebody/metrics":
            self._send_json(200, get_wholebody_engine().runtime_metrics())
            return
        if path == "/prediction-telemetry":
            self._send_json(200, get_prediction_telemetry().report(get_landmark_predictor()))
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            path = path[4:]
        acquired_slot = False
        try:
            if not self._authorized():
                self._send_json(401, {"error": "Authentication required"})
                return
            acquired_slot = inference_slots.acquire(timeout=INFERENCE_ACQUIRE_TIMEOUT)
            if not acquired_slot:
                self._send_json(503, {"error": "AI service is busy"})
                return
            payload = self._read_json()
            if path.startswith("/wholebody/") or path == "/predict-sequence-v2":
                session_id = str(payload.get("session_id") or "")
                if not session_id or len(session_id) > 128:
                    self._send_json(400, {"error": "A valid session_id is required"})
                    return
            if path == "/predict-landmarks":
                landmarks = payload.get("landmarks")
                if not landmarks:
                    self._send_json(400, {"error": "Missing landmarks"})
                    return
                self._send_json(200, enrich_prediction(get_landmark_predictor().predict(landmarks), payload))
                return

            if path == "/predict-sequence":
                frames = payload.get("frames") or []
                if not frames:
                    self._send_json(400, {"error": "Missing frames"})
                    return
                self._send_json(200, enrich_prediction(get_landmark_predictor().predict_sequence(frames, payload), payload))
                return

            if path == "/wholebody/frame":
                image_base64 = payload.get("image")
                if not image_base64:
                    self._send_json(400, {"error": "Missing image"})
                    return
                result = get_wholebody_engine().process_base64(
                    image_base64,
                    session_id=str(payload.get("session_id") or ""),
                    timestamp=payload.get("timestamp"),
                    include_landmarks=payload.get("include_landmarks", False) is True,
                    person_id=payload.get("person_id"),
                    lock_person=bool(payload.get("lock_person")),
                )
                if payload.get("predict"):
                    frames, person_id = get_wholebody_engine().sequence_frames(
                        result["session_id"],
                        payload.get("person_id") or result.get("active_person_id"),
                    )
                    if frames:
                        prediction = enrich_prediction(get_landmark_predictor().predict_sequence(frames, payload), payload)
                        prediction["person_id"] = person_id
                        result["prediction"] = prediction
                self._send_json(200, result)
                return

            if path == "/predict-sequence-v2":
                session_id = str(payload.get("session_id") or "")
                frames, person_id = get_wholebody_engine().sequence_frames(session_id, payload.get("person_id"))
                if not frames:
                    self._send_json(400, {"error": "No tracked sequence for this session/person"})
                    return
                prediction = enrich_prediction(get_landmark_predictor().predict_sequence(frames, payload), payload)
                prediction["session_id"] = session_id
                prediction["person_id"] = person_id
                prediction["tracking_source"] = "rtmw_active_signer"
                prediction["sequence_frame_count"] = len(frames)
                self._send_json(200, prediction)
                return

            if path == "/wholebody/session/clear":
                session_id = str(payload.get("session_id") or "")
                self._send_json(200, {"session_id": session_id, "cleared": get_wholebody_engine().clear_session(session_id)})
                return

            if path == "/predict-image":
                image_base64 = payload.get("image")
                if not image_base64:
                    self._send_json(400, {"error": "Missing image"})
                    return
                self._send_json(200, get_image_predictor().predict_base64(image_base64))
                return

            if path == "/sentence":
                self._send_json(
                    200,
                    {"sentence": sentence_from_labels(payload.get("labels", []), payload.get("output_language", "English"))},
                )
                return

            self._send_json(404, {"error": "Not found"})
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "Invalid request"})
        except Exception:
            print("AI request failed", file=sys.stderr)
            self._send_json(500, {"error": "Internal AI service error"})
        finally:
            if acquired_slot:
                inference_slots.release()


def run():
    try:
        server = ReusableThreadingHTTPServer((HOST, PORT), SignovaHandler)
    except OSError as exc:
        print(f"Could not start Signova AI service on http://{HOST}:{PORT}: {exc}", file=sys.stderr)
        print("Another Signova AI process may already be running. Check http://127.0.0.1:8000/health or stop the old python process.", file=sys.stderr)
        raise
    print(f"Signova AI service running at http://{HOST}:{PORT}")
    print("Endpoints: GET /health, GET /signs, GET /metrics, GET /prediction-telemetry, GET /wholebody/status, GET /wholebody/metrics, POST /wholebody/frame, POST /predict-sequence-v2, POST /predict-sequence, POST /predict-landmarks, POST /predict-image, POST /sentence")
    server.serve_forever()


def wait_for_url(url, timeout=45):
    started = time.time()
    while time.time() - started < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def launch_process(command, cwd, name):
    log_dir = PROJECT_ROOT / ".signova-logs"
    log_dir.mkdir(exist_ok=True)
    log_file = open(log_dir / f"{name.lower()}.log", "a", encoding="utf-8")
    log_file.write(f"\n\n--- Starting {name}: {' '.join(command)} ---\n")
    log_file.flush()
    env = os.environ.copy()
    if name == "Frontend":
        env.setdefault("BROWSER", "none")
        env.setdefault("PORT", "3000")

    kwargs = {
        "cwd": str(cwd),
        "stdout": log_file,
        "stderr": subprocess.STDOUT,
        "stdin": subprocess.DEVNULL,
        "env": env,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(command, **kwargs)


def launch_stack(open_browser=True):
    backend_dir = PROJECT_ROOT / "Backend (Node.js)"
    frontend_dir = PROJECT_ROOT / "signova-frontend"
    python_exe = sys.executable
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

    services = [
        ("AI", [python_exe, str(ROOT / "signova.py"), "--ai-only"], ROOT, f"http://{HOST}:{PORT}/health"),
        ("Backend", ["node", "Index.js"], backend_dir, "http://127.0.0.1:5000/api/health"),
        ("Frontend", [npm_cmd, "start"], frontend_dir, "http://localhost:3000"),
    ]

    print("Starting Signova app stack...")
    for name, command, cwd, url in services:
        if wait_for_url(url, timeout=2):
            print(f"{name} already running: {url}")
            continue
        process = launch_process(command, cwd, name)
        print(f"{name} starting: {url}")
        if wait_for_url(url, timeout=75):
            print(f"{name} ready: {url}")
            continue
        if process.poll() is not None:
            print(f"{name} stopped during startup. Check .signova-logs/{name.lower()}.log")
        else:
            print(f"{name} is still starting. Check .signova-logs/{name.lower()}.log if it does not become ready.")

    frontend_ready = wait_for_url("http://localhost:3000", timeout=60)
    if open_browser and frontend_ready:
        webbrowser.open("http://localhost:3000")
        print("Opened Signova in browser: http://localhost:3000")
    elif not frontend_ready:
        print("Frontend is still starting. Open http://localhost:3000 when ready.")

    print("Signova stack launched.")


def main():
    if "--ai-only" in sys.argv:
        run()
        return
    launch_stack(open_browser="--no-browser" not in sys.argv)


if __name__ == "__main__":
    main()
