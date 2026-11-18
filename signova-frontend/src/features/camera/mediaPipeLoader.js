export const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240';
export const MEDIAPIPE_HOLISTIC_VERSION = '0.5.1675471629';
export const MEDIAPIPE_DRAWING_VERSION = '0.3.1675466124';
export const MEDIAPIPE_HANDS_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}`;
export const MEDIAPIPE_HOLISTIC_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${MEDIAPIPE_HOLISTIC_VERSION}`;

export const MEDIAPIPE_SCRIPT_URLS = Object.freeze([
  `${MEDIAPIPE_HANDS_BASE_URL}/hands.js`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@${MEDIAPIPE_DRAWING_VERSION}/drawing_utils.js`,
]);

export const MEDIAPIPE_HOLISTIC_SCRIPT_URLS = Object.freeze([
  `${MEDIAPIPE_HOLISTIC_BASE_URL}/holistic.js`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@${MEDIAPIPE_DRAWING_VERSION}/drawing_utils.js`,
]);

const DEFAULT_SCRIPT_TIMEOUT_MS = 20_000;

function validateScriptUrl(src) {
  let url;
  try { url = new URL(String(src)); }
  catch { throw new Error('Invalid MediaPipe script URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.jsdelivr.net' || url.href.length > 500) {
    throw new Error('Untrusted MediaPipe script URL');
  }
  return url.href;
}

export function createMediaPipeLoader({
  documentProvider,
  globalProvider,
  scriptUrls = MEDIAPIPE_SCRIPT_URLS,
  timeoutMs = DEFAULT_SCRIPT_TIMEOUT_MS,
  runtime = 'hands',
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!documentProvider?.createElement || !documentProvider?.body) throw new Error('MediaPipe document is unavailable');
  const inFlight = new Map();

  function loadScript(source) {
    const src = validateScriptUrl(source);
    const pending = inFlight.get(src);
    if (pending) return pending;

    const existing = documentProvider.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true' || existing?.dataset.loadState === 'loaded') return Promise.resolve();
    if (existing?.dataset.loadState === 'failed') existing.remove();

    const script = existing?.isConnected ? existing : documentProvider.createElement('script');
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimer(timer);
        script.removeEventListener?.('load', handleLoad);
        script.removeEventListener?.('error', handleError);
        inFlight.delete(src);
        if (error) reject(error); else resolve();
      };
      const handleLoad = () => {
        script.dataset.loaded = 'true';
        script.dataset.loadState = 'loaded';
        finish();
      };
      const handleError = () => {
        script.dataset.loadState = 'failed';
        script.remove();
        finish(new Error('Required Signova media script failed to load'));
      };
      const timer = setTimer(() => {
        script.dataset.loadState = 'failed';
        script.remove();
        finish(new Error('Required Signova media script timed out'));
      }, Math.max(1000, Math.min(Number(timeoutMs) || DEFAULT_SCRIPT_TIMEOUT_MS, 60_000)));

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!existing?.isConnected) {
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.dataset.loadState = 'loading';
        documentProvider.body.appendChild(script);
      }
    });
    inFlight.set(src, promise);
    return promise;
  }

  async function load() {
    for (const src of scriptUrls) await loadScript(src);
    if (runtime === 'holistic') {
      if (typeof globalProvider?.Holistic !== 'function') throw new Error('MediaPipe Holistic unavailable');
    } else if (typeof globalProvider?.Hands !== 'function') {
      throw new Error('MediaPipe Hands unavailable');
    }
  }

  return { load, loadScript };
}

let browserLoader;
let holisticLoader;

export function loadMediaPipeScripts() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('MediaPipe browser runtime is unavailable'));
  }
  if (!browserLoader) browserLoader = createMediaPipeLoader({ documentProvider: document, globalProvider: window });
  return browserLoader.load();
}

export function loadMediaPipeHolisticScripts() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('MediaPipe browser runtime is unavailable'));
  }
  if (!holisticLoader) {
    holisticLoader = createMediaPipeLoader({
      documentProvider: document,
      globalProvider: window,
      scriptUrls: MEDIAPIPE_HOLISTIC_SCRIPT_URLS,
      runtime: 'holistic',
    });
  }
  return holisticLoader.load();
}
