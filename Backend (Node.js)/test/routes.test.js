const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');

const handler = require('../Index');

function request(path, method = 'GET') {
  return Object.assign(new EventEmitter(), {
    method,
    url: path,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  });
}

function response() {
  let resolveResult;
  const result = new Promise((resolve) => { resolveResult = resolve; });
  return {
    headersSent: false,
    signovaReq: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      resolveResult({ statusCode: this.statusCode, headers: this.headers, body: JSON.parse(body) });
    },
    destroy() {},
    result,
  };
}

for (const { path, method } of [
  { path: '/api/metrics', method: 'GET' },
  { path: '/api/wholebody/metrics', method: 'GET' },
  { path: '/api/prediction-telemetry', method: 'GET' },
  { path: '/api/calls/ice-config', method: 'GET' },
  { path: '/api/account/delete', method: 'POST' },
]) {
  test(`${path} preserves authentication status`, async () => {
    const req = request(path, method);
    const res = response();
    await handler(req, res);
    const result = await res.result;

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.error, 'Authentication is required');
    assert.ok(result.headers['X-Request-Id']);
  });
}
