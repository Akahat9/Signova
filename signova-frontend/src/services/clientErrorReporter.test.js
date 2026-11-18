import { buildClientErrorEnvelope, extractSafeStackFrames } from './clientErrorReporter';

test('extracts only bounded source-file frames without URLs or messages', () => {
  expect(extractSafeStackFrames(`TypeError: private message
    at render (https://signova.test/static/main.js:123:9?token=secret)
    at App (C:\\private\\App.jsx:45:3)
    at duplicate (https://signova.test/static/main.js:123:9)`)).toEqual([
    'main.js:123:9',
    'App.jsx:45:3',
  ]);
});

test('builds privacy-safe crash metadata without raw error text or query data', async () => {
  window.history.pushState({}, '', '/settings?token=secret');
  const error = new TypeError('User typed private content');
  error.stack = 'TypeError: User typed private content\n at App (https://app.test/App.js:10:4)';
  const envelope = await buildClientErrorEnvelope(error, { source: 'react_boundary' });
  expect(envelope.source).toBe('react_boundary');
  expect(envelope.errorName).toBe('TypeError');
  expect(envelope.route).toBe('/settings');
  expect(envelope.frames).toEqual(['App.js:10:4']);
  expect(envelope.fingerprint).toMatch(/^[a-f0-9]{16,64}$/);
  expect(JSON.stringify(envelope)).not.toContain('private content');
  expect(JSON.stringify(envelope)).not.toContain('token=secret');
});

test('collapses unknown paths that may contain user identifiers', async () => {
  window.history.pushState({}, '', '/users/alice@example.test');
  const envelope = await buildClientErrorEnvelope(new Error('failure'));
  expect(envelope.route).toBe('/other');
  expect(JSON.stringify(envelope)).not.toContain('alice@example.test');
});
