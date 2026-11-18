import { createMediaPipeLoader, MEDIAPIPE_HANDS_BASE_URL } from './mediaPipeLoader';

const SCRIPT = `${MEDIAPIPE_HANDS_BASE_URL}/hands.js`;

afterEach(() => {
  document.body.querySelectorAll('script[src*="cdn.jsdelivr.net"]').forEach((script) => script.remove());
});

test('deduplicates concurrent loads and resolves an already loaded script', async () => {
  const loader = createMediaPipeLoader({ documentProvider: document, globalProvider: { Hands() {} }, scriptUrls: [SCRIPT] });
  const first = loader.load();
  const second = loader.load();
  const scripts = document.body.querySelectorAll(`script[src="${SCRIPT}"]`);
  expect(scripts).toHaveLength(1);
  scripts[0].dispatchEvent(new Event('load'));
  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  await expect(loader.load()).resolves.toBeUndefined();
  expect(document.body.querySelectorAll(`script[src="${SCRIPT}"]`)).toHaveLength(1);
});

test('removes a failed script and permits a clean retry', async () => {
  const loader = createMediaPipeLoader({ documentProvider: document, globalProvider: { Hands() {} }, scriptUrls: [SCRIPT] });
  const failed = loader.load();
  document.body.querySelector(`script[src="${SCRIPT}"]`).dispatchEvent(new Event('error'));
  await expect(failed).rejects.toThrow(/failed to load/i);
  expect(document.body.querySelector(`script[src="${SCRIPT}"]`)).toBeNull();

  const retry = loader.load();
  const replacement = document.body.querySelector(`script[src="${SCRIPT}"]`);
  replacement.dispatchEvent(new Event('load'));
  await expect(retry).resolves.toBeUndefined();
});

test('fails closed for untrusted URLs and a missing Hands runtime', async () => {
  const unsafe = createMediaPipeLoader({ documentProvider: document, globalProvider: {}, scriptUrls: ['http://example.com/hands.js'] });
  await expect(unsafe.load()).rejects.toThrow(/untrusted/i);

  const loader = createMediaPipeLoader({ documentProvider: document, globalProvider: {}, scriptUrls: [SCRIPT] });
  const loading = loader.load();
  document.body.querySelector(`script[src="${SCRIPT}"]`).dispatchEvent(new Event('load'));
  await expect(loading).rejects.toThrow(/Hands unavailable/i);

  const holisticLoader = createMediaPipeLoader({
    documentProvider: document,
    globalProvider: {},
    scriptUrls: [SCRIPT],
    runtime: 'holistic',
  });
  const holisticLoading = holisticLoader.load();
  document.body.querySelector(`script[src="${SCRIPT}"]`).dispatchEvent(new Event('load'));
  await expect(holisticLoading).rejects.toThrow(/Holistic unavailable/i);
});

test('times out stalled scripts, removes them, and clears the timer', async () => {
  let timeoutHandler;
  const clearTimer = jest.fn();
  const loader = createMediaPipeLoader({
    documentProvider: document,
    globalProvider: { Hands() {} },
    scriptUrls: [SCRIPT],
    timeoutMs: 1000,
    setTimer: (handler) => { timeoutHandler = handler; return 42; },
    clearTimer,
  });
  const loading = loader.load();
  timeoutHandler();
  await expect(loading).rejects.toThrow(/timed out/i);
  expect(clearTimer).toHaveBeenCalledWith(42);
  expect(document.body.querySelector(`script[src="${SCRIPT}"]`)).toBeNull();
});
