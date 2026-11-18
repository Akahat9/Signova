const crypto = require('crypto');
const { sendJson } = require('./aiClient');
const { verifyFirebaseRequest } = require('./firebaseAdmin');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

function parseUrls(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateTurnEnvironment(env = process.env) {
  const twilioEnabled = String(env.SIGNOVA_TURN_PROVIDER || '').toLowerCase() === 'twilio';
  if (twilioEnabled) {
    const issues = [];
    if (!/^AC[a-z0-9]{32}$/i.test(String(env.TWILIO_ACCOUNT_SID || ''))) {
      issues.push('TWILIO_ACCOUNT_SID must be a valid Twilio Account SID.');
    }
    if (String(env.TWILIO_AUTH_TOKEN || '').length < 20) {
      issues.push('TWILIO_AUTH_TOKEN is required.');
    }
    return { ready: issues.length === 0, issues, urls: [], provider: 'twilio' };
  }
  const urls = parseUrls(env.SIGNOVA_TURN_URLS);
  const secret = String(env.SIGNOVA_TURN_SHARED_SECRET || '');
  const issues = [];
  if (!urls.length) issues.push('SIGNOVA_TURN_URLS is required.');
  if (urls.some((url) => !/^turns?:[^\s]+$/i.test(url))) issues.push('TURN URLs must use turn: or turns:.');
  if (secret.length < 32) issues.push('SIGNOVA_TURN_SHARED_SECRET must contain at least 32 characters.');
  const hasUdp = urls.some((url) => /^turn:/i.test(url) && /transport=udp/i.test(url));
  const hasTcpOrTls = urls.some((url) => /transport=tcp/i.test(url) || /^turns:/i.test(url));
  if (urls.length && !hasUdp) issues.push('At least one UDP TURN URL is required.');
  if (urls.length && !hasTcpOrTls) issues.push('At least one TCP or TLS TURN URL is required.');
  return { ready: issues.length === 0, issues, urls };
}

function normalizeTwilioIceServers(servers) {
  if (!Array.isArray(servers)) return [];
  return servers.map((server) => {
    const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
    const normalizedUrls = urls.filter((url) => /^stun:|^turns?:/i.test(String(url || '')));
    if (!normalizedUrls.length) return null;
    const result = { urls: normalizedUrls.length === 1 ? normalizedUrls[0] : normalizedUrls };
    if (server.username && server.credential) {
      result.username = String(server.username);
      result.credential = String(server.credential);
      result.credentialType = 'password';
    }
    return result;
  }).filter(Boolean);
}

async function buildTwilioIceConfig(nowMs = Date.now(), fetchImpl = globalThis.fetch) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '');
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '');
  if (!accountSid || !authToken || typeof fetchImpl !== 'function') {
    throw new Error('Twilio Network Traversal credentials are not configured.');
  }
  const requestedTtl = Number(process.env.SIGNOVA_TURN_CREDENTIAL_TTL_SECONDS || 3600);
  const ttlSeconds = Math.min(86400, Math.max(300, Number.isFinite(requestedTtl) ? requestedTtl : 3600));
  const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `Ttl=${encodeURIComponent(ttlSeconds)}`,
    signal: AbortSignal.timeout(Number(process.env.SIGNOVA_TWILIO_TIMEOUT_MS || 8000)),
  });
  if (!response.ok) throw new Error(`Twilio Network Traversal token request failed (${response.status}).`);
  const payload = await response.json();
  const iceServers = normalizeTwilioIceServers(payload.ice_servers);
  const hasTurn = iceServers.some((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => /^turns?:/i.test(url)));
  if (!iceServers.length || !hasTurn) throw new Error('Twilio returned no usable TURN servers.');
  const actualTtl = Math.min(86400, Math.max(300, Number(payload.ttl) || ttlSeconds));
  return {
    iceServers,
    turnConfigured: true,
    provider: 'twilio',
    expiresAt: new Date(nowMs + (actualTtl * 1000)).toISOString(),
  };
}

function buildIceConfig(uid, nowMs = Date.now()) {
  const stunUrls = parseUrls(process.env.SIGNOVA_STUN_URLS || 'stun:stun.l.google.com:19302');
  const turnUrls = parseUrls(process.env.SIGNOVA_TURN_URLS);
  const sharedSecret = String(process.env.SIGNOVA_TURN_SHARED_SECRET || '');
  const requestedTtl = Number(process.env.SIGNOVA_TURN_CREDENTIAL_TTL_SECONDS || 3600);
  const ttlSeconds = Math.min(86400, Math.max(300, Number.isFinite(requestedTtl) ? requestedTtl : 3600));
  const iceServers = stunUrls.length ? [{ urls: stunUrls }] : [];
  const expiresAt = new Date(nowMs + (ttlSeconds * 1000));

  if (turnUrls.length && sharedSecret.length >= 32) {
    const username = `${Math.floor(expiresAt.getTime() / 1000)}:${uid}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
    iceServers.push({ urls: turnUrls, username, credential, credentialType: 'password' });
  }

  return {
    iceServers,
    turnConfigured: turnUrls.length > 0 && sharedSecret.length >= 32,
    expiresAt: expiresAt.toISOString(),
  };
}

async function handleIceConfig(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    enforceRateLimit(req, token.uid, { scope: 'call-ice-config', maximum: 20 });
    const config = String(process.env.SIGNOVA_TURN_PROVIDER || '').toLowerCase() === 'twilio'
      ? await buildTwilioIceConfig()
      : buildIceConfig(token.uid);
    sendJson(res, 200, config);
  } catch (error) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
    sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = {
  buildIceConfig,
  buildTwilioIceConfig,
  handleIceConfig,
  validateTurnEnvironment,
};
