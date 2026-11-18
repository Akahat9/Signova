export function getLiveMediaTrackKinds(stream, { requireEnabled = false } = {}) {
  const tracks = stream?.getTracks?.() || [];
  return [...new Set(tracks
    .filter((track) => track?.readyState === 'live' && (!requireEnabled || track.enabled))
    .map((track) => track.kind)
    .filter((kind) => kind === 'audio' || kind === 'video'))];
}

export function deriveLocalMediaState({
  stream,
  cameraFallback = false,
  micFallback = false,
  translation = false,
} = {}) {
  const kinds = getLiveMediaTrackKinds(stream, { requireEnabled: true });
  return {
    camera: kinds.includes('video') || (!stream && Boolean(cameraFallback)),
    mic: kinds.includes('audio') || (!stream && Boolean(micFallback)),
    translation: Boolean(translation),
  };
}

export function buildCaptionSyncPayload({
  caption = '',
  sentence = '',
  label = '',
  confidence = 0,
  language = '',
  mode = '',
  mediaState,
  sentAt = Date.now(),
  type = 'signova-caption',
  ...override
} = {}) {
  return {
    type,
    caption,
    sentence,
    label,
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
    language,
    mode,
    mediaState: {
      camera: Boolean(mediaState?.camera),
      mic: Boolean(mediaState?.mic),
      translation: Boolean(mediaState?.translation),
    },
    sentAt,
    ...override,
  };
}
