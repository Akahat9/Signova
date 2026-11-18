# Signova

Signova is a live sign-language translation app with three layers:

- `ai-service`: Python service for landmark and ASL image predictions.
- `Backend (Node.js)`: Node.js API gateway for frontend-safe routes.
- `signova-frontend`: React app for camera translation, WebRTC preview, text-to-speech, and sign learning.

The active web app is only `signova-frontend/src`. The local `Frontend (React/`
folder is a legacy experiment ignored by Git and is not served by the local
stack. Changes made there will not appear at `http://localhost:3000`.

## Run Locally

On a fresh Windows setup, install `uv` and Node.js 22 LTS, then run this once
from the repository root in PowerShell:

```powershell
.\scripts\setup-windows.ps1
```

The setup script installs Python 3.12.15, recreates `.venv`, syncs the locked
Python packages, and runs `npm ci` for the root, backend, and frontend. The
Python lock is in `ai-service/requirements-lock.txt`; update it deliberately
with `uv pip compile ai-service/requirements.txt --python-version 3.12 --output-file ai-service/requirements-lock.txt`.
Node.js 22.x is pinned in `.nvmrc`. For the optional GPU RTMW tracker, install
`ai-service/requirements-rtmw.txt` into `.venv` after the base setup; the
standard CPU setup can use the MediaPipe tracker.

In PowerShell, start the complete connected stack from the repository root
with `npm.cmd` (this avoids PowerShell blocking the `npm.ps1` shim):

```powershell
npm.cmd start
```

Keep that terminal open while using Signova. It starts and supervises the AI
service, Node API, and React frontend together. Press `Ctrl+C` to stop them.

To start each service separately instead, use the commands below.

Start the AI service:

```bash
cd ai-service
..\.venv\Scripts\python.exe signova.py --ai-only
```

Start the backend:

```bash
cd "Backend (Node.js)"
npm.cmd start
```

Start the frontend:

```bash
cd signova-frontend
npm.cmd start
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

For managed NAT traversal, set `SIGNOVA_TURN_PROVIDER=twilio` on the backend
and provide the server-only `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
The backend then requests short-lived Twilio Network Traversal tokens and
returns only temporary ICE credentials to authenticated callers. Never expose
Twilio credentials in the frontend. Coturn remains supported when the provider
is unset.
