const assert = require('node:assert/strict');
const test = require('node:test');
const { anonymizeUid, handleClientError, sanitizeClientError } = require('../services/clientErrors');

function responseRecorder() {
  return {
    headersSent: false,
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(body) { this.body = JSON.parse(body); },
  };
}

test('sanitizes client crash metadata and discards unsafe frames', () => {
  assert.deepEqual(sanitizeClientError({
    source: 'react_boundary',
    errorName: 'TypeError',
    release: 'web-1.2.3',
    route: '/settings?token=secret#account',
    fingerprint: 'a'.repeat(32),
    frames: ['App.js:12:4', 'https://example.test/private.js:2:1', 'App.js:12:4'],
  }), {
    source: 'react_boundary',
    errorName: 'TypeError',
    release: 'web-1.2.3',
    route: '/settings',
    fingerprint: 'a'.repeat(32),
    frames: ['App.js:12:4'],
  });
});

test('rejects unsupported sources and malformed fingerprints', () => {
  assert.throws(() => sanitizeClientError({
    source: 'console_log', errorName: 'Error', release: 'web', fingerprint: 'bad',
  }), /Unsupported/);
  assert.throws(() => sanitizeClientError({
    source: 'runtime_error', errorName: 'Error', release: 'web', fingerprint: 'bad',
  }), /fingerprint/);
});

test('collapses unknown or potentially identifying paths', () => {
  const result = sanitizeClientError({
    source: 'runtime_error', errorName: 'Error', release: 'web',
    route: '/users/alice@example.test', fingerprint: 'c'.repeat(32),
  });
  assert.equal(result.route, '/other');
});

test('authenticated ingestion logs anonymous bounded metadata', async () => {
  const entries = [];
  const res = responseRecorder();
  await handleClientError({ headers: {}, socket: {}, signovaRequestId: 'request-123' }, res, {
    verifyFirebaseRequest: async () => ({ uid: 'private-user-id' }),
    enforceRateLimit: () => undefined,
    readJson: async () => ({
      source: 'runtime_error', errorName: 'TypeError', release: 'web-1', route: '/calls',
      fingerprint: 'b'.repeat(32), frames: ['main.js:10:2'],
    }),
    log: (level, event, fields) => entries.push({ level, event, fields }),
  });
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { accepted: true });
  assert.equal(entries[0].event, 'client_application_error');
  assert.equal(entries[0].fields.userRef, anonymizeUid('private-user-id'));
  assert.equal(JSON.stringify(entries[0]).includes('private-user-id'), false);
});

test('authentication failure is returned without parsing or logging payload', async () => {
  let parsed = false;
  let logged = false;
  const res = responseRecorder();
  await handleClientError({ headers: {}, socket: {} }, res, {
    verifyFirebaseRequest: async () => { const error = new Error('Authentication is required'); error.statusCode = 401; throw error; },
    readJson: async () => { parsed = true; return {}; },
    log: () => { logged = true; },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(parsed, false);
  assert.equal(logged, false);
});
