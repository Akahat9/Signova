export const CAMERA_RESOLUTIONS = Object.freeze({
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
});

const FALLBACK_CONSTRAINT_ERRORS = new Set(['OverconstrainedError', 'ConstraintNotSatisfiedError']);

export function buildCameraConstraints(camera = {}, facingModeOverride = null) {
  const resolution = CAMERA_RESOLUTIONS[camera.resolution] || CAMERA_RESOLUTIONS['720p'];
  const requestedFps = Math.min(Math.max(Number(camera.fps) || 30, 1), 60);
  return {
    resolution,
    primary: {
      video: {
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
        frameRate: { ideal: requestedFps, max: Math.min(Math.max(requestedFps, 30), 60) },
        facingMode: facingModeOverride || camera.facingMode || 'user',
        aspectRatio: { ideal: 16 / 9 },
      },
      audio: false,
    },
    fallback: {
      video: { facingMode: facingModeOverride || camera.facingMode || 'user' },
      audio: false,
    },
  };
}

export async function acquireCameraStream(mediaDevices, camera, facingModeOverride = null) {
  if (!mediaDevices?.getUserMedia) throw Object.assign(new Error('Camera is unavailable in this browser'), { name: 'NotSupportedError' });
  const constraints = buildCameraConstraints(camera, facingModeOverride);
  try {
    return { stream: await mediaDevices.getUserMedia(constraints.primary), resolution: constraints.resolution, usedFallback: false };
  } catch (error) {
    if (!FALLBACK_CONSTRAINT_ERRORS.has(error?.name)) throw error;
    return { stream: await mediaDevices.getUserMedia(constraints.fallback), resolution: constraints.resolution, usedFallback: true };
  }
}

export async function attachMicrophoneTrack(mediaDevices, stream, microphone = {}) {
  if (!mediaDevices?.getUserMedia || !stream?.addTrack) return { added: false, error: new Error('Microphone is unavailable') };
  try {
    const audio = microphone.inputDevice === 'default' || !microphone.inputDevice
      ? { noiseSuppression: microphone.noiseSuppression !== false }
      : { deviceId: { exact: microphone.inputDevice }, noiseSuppression: microphone.noiseSuppression !== false };
    const audioStream = await mediaDevices.getUserMedia({ video: false, audio });
    const tracks = audioStream.getAudioTracks();
    tracks.forEach((track) => {
      track.enabled = true;
      stream.addTrack(track);
    });
    return { added: tracks.length > 0, error: null };
  } catch (error) {
    return { added: false, error };
  }
}

export async function configureVideoTrack(stream, resolution, requestedFps = 30) {
  const videoTrack = stream?.getVideoTracks?.()[0];
  if (!videoTrack) return { label: 'Camera standby', width: 0, height: 0, fps: 0 };
  videoTrack.contentHint = 'detail';
  try {
    await videoTrack.applyConstraints?.({
      width: { ideal: resolution.width },
      height: { ideal: resolution.height },
      frameRate: { ideal: requestedFps },
      advanced: [
        { width: resolution.width, height: resolution.height },
        { frameRate: requestedFps },
        { aspectRatio: 16 / 9 },
      ],
    });
  } catch {
    // Keep the browser-selected stream when a camera cannot apply preferred settings.
  }
  const actual = videoTrack.getSettings?.() || {};
  const width = Number(actual.width || resolution.width);
  const height = Number(actual.height || resolution.height);
  const fps = Math.round(Number(actual.frameRate || requestedFps));
  return {
    label: width >= 1920 ? 'Full HD' : width >= 1280 ? 'HD' : width >= 854 ? 'SD+' : 'Basic',
    width,
    height,
    fps,
  };
}

export function stopMediaStream(stream) {
  const tracks = stream?.getTracks?.() || [];
  tracks.forEach((track) => {
    try { track.stop(); } catch { /* A previously ended track is already safe. */ }
  });
  return tracks.length;
}

export function cameraErrorMessage(error) {
  const messages = {
    NotAllowedError: 'Camera permission denied',
    NotFoundError: 'No camera found',
    NotReadableError: 'Camera is busy in another app',
    SecurityError: 'Camera blocked by browser security',
    NotSupportedError: 'Camera is unavailable in this browser',
  };
  return messages[error?.name] || error?.message || 'Camera failed to start';
}
