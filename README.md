# Signova

Signova is a live sign-language translation app with three layers:

- `ai-service`: Python service for landmark and ASL image predictions.
- `Backend (Node.js)`: Node.js API gateway for frontend-safe routes.
- `signova-frontend`: React app for camera translation, WebRTC preview, text-to-speech, and sign learning.

## Run Locally

Start the AI service:

```bash
cd ai-service
..\.venv\Scripts\python.exe signova.py
```

Start the backend:

```bash
cd "Backend (Node.js)"
npm start
```

Start the frontend:

```bash
cd signova-frontend
npm start
```

Default URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:5000`
- AI service: `http://127.0.0.1:8000`

## Key Endpoints

- `GET /api/health`
- `GET /api/signs`
- `POST /api/predict-landmarks`
- `POST /api/predict-image`
- `POST /api/sentence`

## Deploy the Node API to Vercel

The Vercel project root must be `Backend (Node.js)`. The backend exports the
same request handler for local Node and Vercel serverless execution.

Required production environment variables are documented in
`Backend (Node.js)/.env.example`. Never commit `.env`.

```bash
npx vercel --cwd "Backend (Node.js)" --prod
```

Use `GET /api/platform/health` to test the deployed Node/data service. AI
prediction endpoints also require `SIGNOVA_AI_URL` to point to a separately
deployed Python AI service; `127.0.0.1` is not reachable from Vercel.

## Public Translation Test on Render

Deploy `ai-service` as a second Docker web service. The public test image runs
the tracked landmark/centroid recognizer on CPU and intentionally disables the
GPU-only RTMW dependency.

Set these variables on the AI service:

```text
SIGNOVA_AI_HOST=0.0.0.0
SIGNOVA_AI_SERVICE_TOKEN=<long random value>
SIGNOVA_MAX_CONCURRENT_INFERENCES=1
SIGNOVA_RTMW_ENABLED=0
```

Set the same token and the deployed AI URL on the Node API:

```text
SIGNOVA_AI_URL=https://<ai-service>.onrender.com
SIGNOVA_AI_SERVICE_TOKEN=<same long random value>
SIGNOVA_AI_TIMEOUT_MS=45000
```

The trained `.pt`, `.pth`, and `.onnx` files are not stored in Git. Therefore
this public test service provides genuine but limited landmark recognition.
Full sequence/image-model testing requires versioned model artifacts from a
private model registry or object store.

The current WebRTC UI is a local loopback preview. Real calls between different
users require authenticated signaling plus STUN/TURN infrastructure and must
not be described as production calling until cross-device tests pass.
