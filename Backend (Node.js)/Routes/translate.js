const crypto = require('crypto');
const { callAi, readJson, sendJson } = require('../services/aiClient');
const { verifyFirebaseRequest } = require('../services/firebaseAdmin');
const { enforceRateLimit, statusForError } = require('../services/requestSecurity');

function scopedSessionId(uid, requestedSessionId) {
  return crypto.createHash('sha256')
    .update(`${uid}:${String(requestedSessionId || 'primary').slice(0, 128)}`)
    .digest('hex');
}

async function handleTranslate(req, res, path) {
  try {
    const token = await verifyFirebaseRequest(req);
    enforceRateLimit(req, token.uid, {
      scope: 'ai-inference',
      maximum: Number(process.env.SIGNOVA_AI_REQUESTS_PER_MINUTE || 90),
    });
    const payload = await readJson(req);
    payload.session_id = scopedSessionId(token.uid, payload.session_id || payload.sessionId);
    payload.include_landmarks = payload.include_landmarks === true;
    const targetPath = path.replace('/api', '');
    const result = await callAi(targetPath, payload);
    sendJson(res, result.statusCode, result.data);
  } catch (error) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
    sendJson(res, statusForError(error), { error: error.message });
  }
}

async function handleSentence(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    enforceRateLimit(req, token.uid, {
      scope: 'ai-sentence',
      maximum: Number(process.env.SIGNOVA_SENTENCE_REQUESTS_PER_MINUTE || 60),
    });
    const payload = await readJson(req);
    const result = await callAi('/sentence', payload);
    sendJson(res, result.statusCode, result.data);
  } catch (error) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
    sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = {
  handleSentence,
  handleTranslate,
};
