import { createCameraFrameLoop } from './cameraFrameLoop';

function createHarness(overrides = {}) {
  let scheduled = null;
  let timerId = 0;
  let currentTime = 1000;
  const clearTimer = jest.fn((id) => { if (scheduled?.id === id) scheduled = null; });
  const processFrame = jest.fn(async () => {});
  const onFrameError = jest.fn();
  const state = { active: true, config: { frameRate: 20, frameSkipping: false, frameModulo: 1 }, video: { readyState: 2 } };
  const loop = createCameraFrameLoop({
    isActive: () => state.active,
    getVideo: () => state.video,
    getConfig: () => state.config,
    processFrame,
    onFrameError,
    now: () => currentTime,
    setTimer: (callback, delay) => {
      timerId += 1;
      scheduled = { id: timerId, callback, delay };
      return timerId;
    },
    clearTimer,
    ...overrides,
  });
  return {
    loop,
    state,
    processFrame,
    onFrameError,
    clearTimer,
    next: async (advance = 50) => {
      const task = scheduled;
      scheduled = null;
      currentTime += advance;
      await task.callback();
      return task;
    },
    scheduled: () => scheduled,
  };
}

test('starts at configured cadence, processes a ready frame, and stops its owned timer', async () => {
  const harness = createHarness();
  harness.loop.start();
  expect(harness.scheduled().delay).toBe(50);
  await harness.next();
  expect(harness.processFrame).toHaveBeenCalledWith(harness.state.video);
  expect(harness.scheduled().delay).toBeGreaterThanOrEqual(8);
  harness.loop.stop();
  expect(harness.loop.isRunning()).toBe(false);
  expect(harness.clearTimer).toHaveBeenCalled();
});

test('applies frame skipping and dynamic configuration without rebuilding the loop', async () => {
  const harness = createHarness();
  harness.state.config = { frameRate: 30, frameSkipping: true, frameModulo: 2 };
  harness.loop.start();
  await harness.next(34);
  expect(harness.processFrame).not.toHaveBeenCalled();
  await harness.next(34);
  expect(harness.processFrame).toHaveBeenCalledTimes(1);
  harness.state.config = { frameRate: 10, frameSkipping: false, frameModulo: 9 };
  await harness.next(100);
  expect(harness.processFrame).toHaveBeenCalledTimes(2);
});

test('isolates frame errors and continues scheduling without overlapping work', async () => {
  const harness = createHarness({ processFrame: jest.fn(async () => { throw new Error('frame failed'); }) });
  harness.loop.start();
  await harness.next();
  expect(harness.onFrameError).toHaveBeenCalledWith(expect.objectContaining({ message: 'frame failed' }));
  expect(harness.scheduled()).not.toBeNull();
});

test('stops cleanly when the stream becomes inactive and skips unready video', async () => {
  const harness = createHarness();
  harness.state.video.readyState = 1;
  harness.loop.start();
  await harness.next();
  expect(harness.processFrame).not.toHaveBeenCalled();
  harness.state.active = false;
  await harness.next();
  expect(harness.loop.isRunning()).toBe(false);
  expect(harness.scheduled()).toBeNull();
});

test('pauses and throttles processing in standby without terminating the loop', async () => {
  let paused = false;
  const harness = createHarness({ isPaused: () => paused });
  harness.loop.start();
  await harness.next();
  expect(harness.processFrame).toHaveBeenCalledTimes(1);

  // Enter paused / hidden tab state
  paused = true;
  await harness.next();
  // Frame should not be processed
  expect(harness.processFrame).toHaveBeenCalledTimes(1);
  // Loop remains running with power-saving standby cadence (500ms)
  expect(harness.loop.isRunning()).toBe(true);
  expect(harness.loop.isPaused()).toBe(true);
  expect(harness.scheduled().delay).toBe(500);

  // Resume / tab active again
  paused = false;
  await harness.next();
  expect(harness.processFrame).toHaveBeenCalledTimes(2);
  expect(harness.loop.isPaused()).toBe(false);
  harness.loop.stop();
});

test('supports manual pause and resume', async () => {
  const harness = createHarness();
  harness.loop.start();
  await harness.next();
  expect(harness.processFrame).toHaveBeenCalledTimes(1);

  harness.loop.pause();
  expect(harness.loop.isPaused()).toBe(true);
  expect(harness.scheduled()).toBeNull();

  harness.loop.resume();
  expect(harness.loop.isPaused()).toBe(false);
  expect(harness.scheduled()).not.toBeNull();
  await harness.next();
  expect(harness.processFrame).toHaveBeenCalledTimes(2);
  harness.loop.stop();
});
