const MIN_LOOP_DELAY_MS = 8;
const MIN_FRAME_RATE = 1;
const MAX_FRAME_RATE = 120;

function frameRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 30;
  return Math.min(MAX_FRAME_RATE, Math.max(MIN_FRAME_RATE, numeric));
}

export function createCameraFrameLoop({
  isActive,
  isPaused = () => false,
  getVideo,
  getConfig,
  processFrame,
  onFrameError = () => {},
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof isActive !== 'function' || typeof getVideo !== 'function' || typeof getConfig !== 'function' || typeof processFrame !== 'function') {
    throw new Error('Camera frame loop dependencies are incomplete');
  }

  let timer = null;
  let running = false;
  let manualPaused = false;
  let processing = false;
  let frameCount = 0;
  let lastProcessedAt = -Infinity;
  let visibilityHandler = null;

  function isCurrentlyPaused() {
    if (manualPaused) return true;
    if (typeof isPaused === 'function' && isPaused()) return true;
    if (typeof document !== 'undefined' && document.hidden) return true;
    return false;
  }

  function schedule(delay) {
    if (!running) return;
    timer = setTimer(tick, Math.max(MIN_LOOP_DELAY_MS, delay));
  }

  async function tick() {
    timer = null;
    if (!running || !isActive()) {
      running = false;
      return;
    }

    if (isCurrentlyPaused()) {
      // Standby power-save cadence: throttle check when tab is hidden or paused
      schedule(500);
      return;
    }

    const config = getConfig() || {};
    const minFrameGap = 1000 / frameRate(config.frameRate);
    const frameModulo = config.frameSkipping
      ? Math.max(1, Math.round(Number(config.frameModulo) || 1))
      : 1;
    const startedAt = now();
    const video = getVideo();
    frameCount += 1;
    const shouldProcess = frameCount % frameModulo === 0
      && startedAt - lastProcessedAt >= minFrameGap;

    if (video && video.readyState >= 2 && !processing && shouldProcess) {
      processing = true;
      lastProcessedAt = startedAt;
      try { await processFrame(video); }
      catch (error) { onFrameError(error); }
      finally { processing = false; }
    }

    if (!running || !isActive()) {
      running = false;
      return;
    }
    const elapsed = Math.max(0, now() - startedAt);
    schedule(Math.max(MIN_LOOP_DELAY_MS, minFrameGap - elapsed));
  }

  function pause() {
    manualPaused = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function resume() {
    if (!running) return;
    manualPaused = false;
    schedule(0);
  }

  function stop() {
    running = false;
    manualPaused = false;
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function start() {
    stop();
    running = true;
    manualPaused = false;
    processing = false;
    frameCount = 0;
    lastProcessedAt = -Infinity;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      visibilityHandler = () => {
        if (!document.hidden && running && !manualPaused) {
          schedule(0);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    const config = getConfig() || {};
    schedule(1000 / frameRate(config.frameRate));
  }

  return {
    start,
    stop,
    pause,
    resume,
    isRunning: () => running,
    isPaused: () => isCurrentlyPaused(),
  };
}

export { MAX_FRAME_RATE, MIN_FRAME_RATE, MIN_LOOP_DELAY_MS };
