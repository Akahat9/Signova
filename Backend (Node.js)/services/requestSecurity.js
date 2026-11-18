const crypto = require('crypto');

const buckets = new Map();
const MAX_BUCKETS = Number(process.env.SIGNOVA_RATE_LIMIT_MAX_BUCKETS || 20_000);

function clientKey(req, identity = 'anonymous') {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';
  return crypto.createHash('sha256')
    .update(`${identity}:${remoteAddress}`)
    .digest('hex');
}

function enforceRateLimit(req, identity, options = {}) {
  const windowMs = options.windowMs || 60_000;
  const maximum = options.maximum || 60;
  const now = Date.now();
  const key = `${options.scope || 'api'}:${clientKey(req, identity)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > maximum) {
    const error = new Error('Too many requests. Try again shortly.');
    error.statusCode = 429;
    error.retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw error;
  }
}

function statusForError(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 504;
  if (error instanceof SyntaxError) return 400;
  return 500;
}

module.exports = {
  enforceRateLimit,
  statusForError,
};
