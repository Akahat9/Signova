const crypto = require('crypto');
const { readJson, sendJson } = require('./aiClient');
const { verifyFirebaseRequest } = require('./firebaseAdmin');
const { write: log } = require('./logger');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

const SOURCES = new Set(['react_boundary', 'runtime_error', 'unhandled_rejection']);
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
const RELEASE = /^[A-Za-z0-9._-]{1,80}$/;
const FRAME = /^[A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx):\d{1,8}:\d{1,6}$/;
const ROUTES = new Set(['', 'settings', 'calls', 'chats', 'community', 'learn', 'practice', 'library', 'progress', 'profile', 'notifications', 'subscription', 'help']);

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sanitizeClientError(payload = {}) {
  const source = String(payload.source || '');
  const errorName = String(payload.errorName || '');
  const release = String(payload.release || 'unknown');
  const rawRoute = String(payload.route || '/').split('?')[0].split('#')[0];
  const fingerprint = String(payload.fingerprint || '');
  if (!SOURCES.has(source)) throw invalid('Unsupported client error source');
  if (!ERROR_NAME.test(errorName)) throw invalid('Invalid client error name');
  if (!RELEASE.test(release)) throw invalid('Invalid client release');
  if (!rawRoute.startsWith('/') || rawRoute.length > 160 || /[\r\n]/.test(rawRoute)) throw invalid('Invalid client route');
  if (!/^[a-f0-9]{16,64}$/.test(fingerprint)) throw invalid('Invalid client error fingerprint');
  const frames = Array.isArray(payload.frames)
    ? [...new Set(payload.frames.map(String).filter((frame) => FRAME.test(frame)))].slice(0, 8)
    : [];
  const firstRouteSegment = rawRoute.split('/').filter(Boolean)[0] || '';
  const route = ROUTES.has(firstRouteSegment) ? `/${firstRouteSegment}` : '/other';
  return { source, errorName, release, route, fingerprint, frames };
}

function anonymizeUid(uid) {
  return crypto.createHash('sha256').update(String(uid)).digest('hex').slice(0, 20);
}

async function handleClientError(req, res, dependencies = {}) {
  const authenticate = dependencies.verifyFirebaseRequest || verifyFirebaseRequest;
  const parseJson = dependencies.readJson || readJson;
  const writeLog = dependencies.log || log;
  const limit = dependencies.enforceRateLimit || enforceRateLimit;
  try {
    const token = await authenticate(req);
    limit(req, token.uid, { scope: 'client-errors', maximum: 20, windowMs: 60_000 });
    const error = sanitizeClientError(await parseJson(req));
    writeLog('error', 'client_application_error', {
      requestId: req.signovaRequestId,
      userRef: anonymizeUid(token.uid),
      ...error,
    });
    sendJson(res, 202, { accepted: true });
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = { anonymizeUid, handleClientError, sanitizeClientError };
