import {
  acquireCameraStream,
  attachMicrophoneTrack,
  buildCameraConstraints,
  cameraErrorMessage,
  configureVideoTrack,
  stopMediaStream,
} from './cameraMediaService';

test('builds bounded camera constraints and honors facing override', () => {
  const result = buildCameraConstraints({ resolution: '1080p', fps: 120, facingMode: 'user' }, 'environment');
  expect(result.primary.video).toMatchObject({
    width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 }, facingMode: 'environment',
  });
});

test('falls back only after an unsupported exact camera constraint', async () => {
  const stream = { id: 'fallback' };
  const error = Object.assign(new Error('too large'), { name: 'OverconstrainedError' });
  const getUserMedia = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(stream);
  await expect(acquireCameraStream({ getUserMedia }, { resolution: '1440p', fps: 60 })).resolves.toMatchObject({ stream, usedFallback: true });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  const deniedMedia = { getUserMedia: jest.fn().mockRejectedValue(denied) };
  await expect(acquireCameraStream(deniedMedia, {})).rejects.toBe(denied);
  expect(deniedMedia.getUserMedia).toHaveBeenCalledTimes(1);
});

test('merges selected microphone tracks without failing the camera on denial', async () => {
  const track = { enabled: false };
  const stream = { addTrack: jest.fn() };
  const success = await attachMicrophoneTrack({
    getUserMedia: jest.fn().mockResolvedValue({ getAudioTracks: () => [track] }),
  }, stream, { inputDevice: 'mic-a', noiseSuppression: true });
  expect(success.added).toBe(true);
  expect(track.enabled).toBe(true);
  expect(stream.addTrack).toHaveBeenCalledWith(track);
  const failure = await attachMicrophoneTrack({ getUserMedia: jest.fn().mockRejectedValue(new Error('denied')) }, stream);
  expect(failure.added).toBe(false);
});

test('reports actual video quality and tolerates unsupported preferred constraints', async () => {
  const track = {
    applyConstraints: jest.fn().mockRejectedValue(new Error('unsupported')),
    getSettings: () => ({ width: 1280, height: 720, frameRate: 29.7 }),
  };
  await expect(configureVideoTrack({ getVideoTracks: () => [track] }, { width: 1920, height: 1080 }, 60)).resolves.toEqual({
    label: 'HD', width: 1280, height: 720, fps: 30,
  });
  expect(track.contentHint).toBe('detail');
});

test('cleanup stops every track idempotently and errors map to user-safe text', () => {
  const first = { stop: jest.fn() };
  const second = { stop: jest.fn(() => { throw new Error('already stopped'); }) };
  expect(stopMediaStream({ getTracks: () => [first, second] })).toBe(2);
  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/another app/i);
});
