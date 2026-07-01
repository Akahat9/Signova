const crypto = require('crypto');
const { readJson, sendJson } = require('./aiClient');
const { getFirebaseAdmin, verifyFirebaseRequest } = require('./firebaseAdmin');

const COLLECTION = 'privateAuthIdentities';
const HMAC_SECRET = process.env.SIGNOVA_IDENTITY_HMAC_SECRET || '';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const RATE_LIMIT_MAX = Number(process.env.SIGNOVA_IDENTITY_RATE_LIMIT || 20);
const attempts = new Map();

function getAdmin() {
  return getFirebaseAdmin();
}

function requireConfiguration() {
  if (HMAC_SECRET.length < 32) throw new Error('Private identity resolver is not configured');
  if (!FIREBASE_WEB_API_KEY) throw new Error('Private identity resolver is not configured');
  return getAdmin();
}

function normalize(type, value = '') {
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  if (type === 'username') return raw.replace(/^@+/, '');
  if (type === 'phone') return raw.replace(/[^\d+]/g, '');
  if (type === 'email') return raw;
  throw new Error('Unsupported identity type');
}

function inferType(value = '') {
  const raw = String(value).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return 'email';
  if (/^\+?[0-9\s()-]{8,20}$/.test(raw)) return 'phone';
  return 'username';
}

function keyFor(type, value) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`${type}:${normalize(type, value)}`).digest('hex');
}

function rateLimit(req) {
  const now = Date.now();
  const key = req.socket?.remoteAddress || 'unknown';
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  recent.push(now);
  attempts.set(key, recent);
  if (recent.length > RATE_LIMIT_MAX) throw new Error('Too many identity requests. Try again shortly.');
}

async function lookup(type, value) {
  const sdk = requireConfiguration();
  const snapshot = await sdk.firestore().collection(COLLECTION).doc(keyFor(type, value)).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function authenticatedUser(req) {
  requireConfiguration();
  return verifyFirebaseRequest(req);
}

async function handleIdentityCheck(req, res) {
  try {
    rateLimit(req);
    const { type, value } = await readJson(req);
    sendJson(res, 200, { exists: Boolean(await lookup(type, value)) });
  } catch (error) {
    sendJson(res, error.message.startsWith('Too many') ? 429 : 503, { error: error.message });
  }
}

async function handleIdentityRegister(req, res) {
  try {
    const token = await authenticatedUser(req);
    const { username, phone } = await readJson(req);
    const identities = [['username', username], ['phone', phone]].filter(([, value]) => value);
    const sdk = requireConfiguration();
    const db = sdk.firestore();
    await db.runTransaction(async (transaction) => {
      const rows = [];
      for (const [type, value] of identities) {
        const ref = db.collection(COLLECTION).doc(keyFor(type, value));
        rows.push({ type, ref, snapshot: await transaction.get(ref) });
      }
      for (const row of rows) {
        if (row.snapshot.exists && row.snapshot.data().uid !== token.uid) {
          throw new Error(`This ${row.type} is already linked to another account.`);
        }
      }
      for (const row of rows) {
        transaction.set(row.ref, {
          uid: token.uid,
          email: token.email || '',
          type: row.type,
          updatedAt: sdk.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
    sendJson(res, 200, { registered: true });
  } catch (error) {
    sendJson(res, error.message.includes('already linked') ? 409 : 401, { error: error.message });
  }
}

async function firebasePasswordLogin(email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error('Invalid username or password');
  return payload;
}

async function handleIdentityLogin(req, res) {
  try {
    rateLimit(req);
    const { identity, password } = await readJson(req);
    const type = inferType(identity);
    if (type === 'phone') throw new Error('Phone login uses OTP');
    const record = type === 'email' ? { email: normalize('email', identity) } : await lookup(type, identity);
    if (!record?.email || !password) throw new Error('Invalid username or password');
    const login = await firebasePasswordLogin(record.email, password);
    if (record.uid && record.uid !== login.localId) throw new Error('Invalid username or password');
    const customToken = await requireConfiguration().auth().createCustomToken(login.localId);
    sendJson(res, 200, { customToken });
  } catch (error) {
    sendJson(res, error.message.startsWith('Too many') ? 429 : 401, { error: error.message });
  }
}

async function handleIdentityRecovery(req, res) {
  try {
    rateLimit(req);
    const { identity } = await readJson(req);
    const type = inferType(identity);
    const record = type === 'email' ? { email: normalize('email', identity) } : await lookup(type, identity);
    if (record?.email) {
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: record.email }),
        signal: AbortSignal.timeout(12_000),
      });
    }
    sendJson(res, 200, { sent: true });
  } catch (error) {
    sendJson(res, error.message.startsWith('Too many') ? 429 : 503, { error: error.message });
  }
}

module.exports = { handleIdentityCheck, handleIdentityLogin, handleIdentityRecovery, handleIdentityRegister };
