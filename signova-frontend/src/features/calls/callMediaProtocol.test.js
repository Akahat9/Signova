import {
  buildCaptionSyncPayload,
  deriveLocalMediaState,
  getLiveMediaTrackKinds,
} from './callMediaProtocol';

function streamWith(...tracks) {
  return { getTracks: () => tracks };
}

test('derives media state from enabled live tracks instead of stale UI flags', () => {
  const stream = streamWith(
    { kind: 'video', readyState: 'live', enabled: false },
    { kind: 'audio', readyState: 'live', enabled: true },
    { kind: 'video', readyState: 'ended', enabled: true },
  );

  expect(deriveLocalMediaState({
    stream,
    cameraFallback: true,
    micFallback: false,
    translation: true,
  })).toEqual({ camera: false, mic: true, translation: true });
});

test('uses UI fallbacks only before a media stream exists', () => {
  expect(deriveLocalMediaState({ cameraFallback: true, micFallback: true }))
    .toEqual({ camera: true, mic: true, translation: false });
  expect(deriveLocalMediaState({ stream: streamWith(), cameraFallback: true, micFallback: true }))
    .toEqual({ camera: false, mic: false, translation: false });
});

test('normalizes unique remote media kinds and ignores invalid or ended tracks', () => {
  expect(getLiveMediaTrackKinds(streamWith(
    { kind: 'video', readyState: 'live', enabled: true },
    { kind: 'video', readyState: 'live', enabled: true },
    { kind: 'audio', readyState: 'ended', enabled: true },
    { kind: 'data', readyState: 'live', enabled: true },
  ))).toEqual(['video']);
});

test('builds a stable serializable caption protocol payload', () => {
  expect(buildCaptionSyncPayload({
    caption: 'Hello',
    sentence: 'Hello there',
    label: 'hello',
    confidence: '0.91',
    language: 'en',
    mode: 'sign-to-text',
    mediaState: { camera: 1, mic: 0, translation: true },
    sentAt: 42,
  })).toEqual({
    type: 'signova-caption',
    caption: 'Hello',
    sentence: 'Hello there',
    label: 'hello',
    confidence: 0.91,
    language: 'en',
    mode: 'sign-to-text',
    mediaState: { camera: true, mic: false, translation: true },
    sentAt: 42,
  });
});
