import { ApiRequestError, requestJson } from './apiClient';

function response(payload, { status = 200, contentType = 'application/json' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => payload,
  };
}

test('injects auth and returns backend JSON', async () => {
  const fetchImpl = jest.fn(async (url, options) => {
    expect(url).toBe('https://api.example.test/api/health');
    expect(options.headers.get('Authorization')).toBe('Bearer token-a');
    expect(options.headers.get('X-Request-Id')).toBeTruthy();
    return response({ status: 'ok' });
  });
  await expect(requestJson({
    baseUrl: 'https://api.example.test', path: '/api/health', getToken: async () => 'token-a', fetchImpl,
  })).resolves.toMatchObject({ status: 'ok', apiSource: 'backend' });
});

test('preserves API status and rejects non-JSON responses', async () => {
  await expect(requestJson({
    baseUrl: 'https://api.example.test',
    path: '/api/protected',
    fetchImpl: async () => response({ error: 'Authentication is required' }, { status: 401 }),
  })).rejects.toMatchObject({ status: 401, message: 'Authentication is required' });
  await expect(requestJson({
    baseUrl: 'https://api.example.test',
    path: '/api/broken',
    fetchImpl: async () => response({}, { status: 200, contentType: 'text/html' }),
  })).rejects.toBeInstanceOf(ApiRequestError);
});
