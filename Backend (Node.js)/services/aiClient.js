const AI_BASE_URL = process.env.SIGNOVA_AI_URL || 'http://127.0.0.1:8000';
const DEFAULT_ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? 'https://signova-6e929.web.app,https://signova-6e929.firebaseapp.com'
  : 'http://localhost:3000,http://127.0.0.1:3000';
const ALLOWED_ORIGINS = (process.env.SIGNOVA_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const MAX_REQUEST_BYTES = Number(process.env.SIGNOVA_MAX_REQUEST_BYTES || 5 * 1024 * 1024);
const AI_TIMEOUT_MS = Number(process.env.SIGNOVA_AI_TIMEOUT_MS || 15000);
const AI_SERVICE_TOKEN = process.env.SIGNOVA_AI_SERVICE_TOKEN || '';
const MAX_AI_RESPONSE_BYTES = Number(process.env.SIGNOVA_MAX_AI_RESPONSE_BYTES || 2 * 1024 * 1024);

function aiHeaders(extra = {}) {
  return AI_SERVICE_TOKEN
    ? { ...extra, Authorization: `Bearer ${AI_SERVICE_TOKEN}` }
    : extra;
}

function resolveCorsOrigin(req) {
  const origin = req?.headers?.origin;
  if (!origin) return null;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function safePayload(statusCode, payload) {
  if (statusCode < 500) return payload;
  return {
    error: payload?.error ? 'Internal service error' : undefined,
    status: payload?.status,
    service: payload?.service,
  };
}

function sendJson(res, statusCode, payload, req) {
  const sourceReq = req || res.signovaReq;
  const corsOrigin = resolveCorsOrigin(sourceReq);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store',
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(safePayload(statusCode, payload)));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.startsWith('application/json')) {
      const error = new Error('Content-Type must be application/json');
      error.statusCode = 415;
      reject(error);
      return;
    }

    const chunks = [];
    let receivedBytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_REQUEST_BYTES) {
        const error = new Error('Request body is too large');
        error.statusCode = 413;
        fail(error);
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', fail);
  });
}

async function readAiResponse(response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_AI_RESPONSE_BYTES) {
    throw new Error('AI service response is too large');
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_AI_RESPONSE_BYTES) {
    throw new Error('AI service response is too large');
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('AI service returned invalid JSON');
  }
}

async function callAi(path, payload) {
  const headers = aiHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  const data = await readAiResponse(response);
  return { statusCode: response.status, data };
}

async function health() {
  const response = await fetch(`${AI_BASE_URL}/health`, {
    headers: aiHeaders(),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  const data = await response.json();
  return { statusCode: response.status, data };
}

async function signs() {
  const response = await fetch(`${AI_BASE_URL}/signs`, { headers: aiHeaders(), signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
  const data = await response.json();
  return { statusCode: response.status, data };
}

async function metrics() {
  const response = await fetch(`${AI_BASE_URL}/metrics`, { headers: aiHeaders(), signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
  const data = await response.json();
  return { statusCode: response.status, data };
}

async function wholebodyMetrics() {
  const response = await fetch(`${AI_BASE_URL}/wholebody/metrics`, { headers: aiHeaders(), signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
  const data = await response.json();
  return { statusCode: response.status, data };
}

async function predictionTelemetry() {
  const response = await fetch(`${AI_BASE_URL}/prediction-telemetry`, { headers: aiHeaders(), signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
  const data = await response.json();
  return { statusCode: response.status, data };
}

module.exports = {
  callAi,
  health,
  metrics,
  predictionTelemetry,
  readJson,
  sendJson,
  signs,
  wholebodyMetrics,
};
