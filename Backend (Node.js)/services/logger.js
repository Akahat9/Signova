const crypto = require('crypto');

function requestId(req) {
  const supplied = String(req.headers?.['x-request-id'] || '').trim();
  if (/^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

function write(level, event, fields = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'signova-backend',
    event,
    ...fields,
  };
  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else console.log(output);
}

function instrumentRequest(req, res) {
  const id = requestId(req);
  const startedAt = Date.now();
  req.signovaRequestId = id;
  res.signovaRequestId = id;
  res.once?.('finish', () => {
    write('info', 'http_request_completed', {
      requestId: id,
      method: req.method,
      path: String(req.url || '').split('?')[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  return id;
}

module.exports = { instrumentRequest, requestId, write };

