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
