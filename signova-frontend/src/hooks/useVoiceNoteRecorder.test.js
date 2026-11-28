import { renderHook } from '@testing-library/react';
import useVoiceNoteRecorder, {
  audioExtensionForMime,
  formatVoiceTime,
  pickSupportedAudioMimeType,
} from './useVoiceNoteRecorder';

describe('useVoiceNoteRecorder', () => {
  test('picks preferred opus mimeType when supported', () => {
    const mockRecorder = {
      isTypeSupported: (type) => type === 'audio/webm;codecs=opus' || type === 'audio/webm',
    };
    expect(pickSupportedAudioMimeType(mockRecorder)).toBe('audio/webm;codecs=opus');
    expect(pickSupportedAudioMimeType(null)).toBe('');
  });

  test('maps audio mime types to file extensions and formats duration', () => {
    expect(audioExtensionForMime('audio/ogg;codecs=opus')).toBe('ogg');
    expect(audioExtensionForMime('audio/mp4')).toBe('m4a');
    expect(audioExtensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(formatVoiceTime(65)).toBe('01:05');
  });

  test('initializes with inactive voice note state and 24-bar waveform', () => {
    const { result } = renderHook(() => useVoiceNoteRecorder());
    expect(result.current.voiceNote).toEqual({ active: false, paused: false, seconds: 0 });
    expect(result.current.voiceWaveform).toHaveLength(24);
  });
});
