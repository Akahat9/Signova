import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

const DEFAULT_WAVEFORM = Array.from({ length: 24 }, (_, idx) => (
  Number((0.24 + ((Math.sin(idx * 0.75) + 1) * 0.25)).toFixed(2))
));

export function pickSupportedAudioMimeType(MediaRecorderCtor = typeof window !== 'undefined' ? window.MediaRecorder : undefined) {
  if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== 'function') {
    return '';
  }
  return PREFERRED_AUDIO_MIME_TYPES.find((type) => {
    try {
      return MediaRecorderCtor.isTypeSupported(type);
    } catch {
      return false;
    }
  }) || '';
}

export function audioExtensionForMime(mimeType = '') {
  const lower = String(mimeType).toLowerCase();
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

export function formatVoiceTime(totalSeconds = 0) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60).toString().padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function useVoiceNoteRecorder({ setStatus, onBeforeStart } = {}) {
  const [voiceNote, setVoiceNote] = useState({ active: false, paused: false, seconds: 0 });
  const [voiceWaveform, setVoiceWaveform] = useState(DEFAULT_WAVEFORM);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const meterTimerRef = useRef(null);
  const capturedPeaksRef = useRef([]);

  const stopMeter = useCallback(() => {
    if (meterTimerRef.current) {
      window.clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close?.().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    stopMeter();
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopMeter]);

  useEffect(() => {
    if (!voiceNote.active || voiceNote.paused) return undefined;
    const timer = window.setInterval(() => {
      setVoiceNote((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [voiceNote.active, voiceNote.paused]);

  useEffect(() => () => {
    cleanupStream();
  }, [cleanupStream]);

  const startVoiceNote = useCallback(async () => {
    onBeforeStart?.();
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setStatus?.('Voice recording is not supported in this browser.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = pickSupportedAudioMimeType(window.MediaRecorder);
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
        : new window.MediaRecorder(stream);

      chunksRef.current = [];
      capturedPeaksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.start(250);

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          audioCtxRef.current = ctx;
          meterTimerRef.current = window.setInterval(() => {
            if (recorderRef.current?.state !== 'recording') return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((sum, val) => sum + val, 0) / Math.max(1, data.length);
            const normalized = Math.max(0.18, Math.min(1, Number((avg / 140).toFixed(2))));
            capturedPeaksRef.current.push(normalized);
            setVoiceWaveform((prev) => [...prev.slice(1), normalized]);
          }, 90);
        } catch {
          // Live waveform falls back to default animation if AudioContext is blocked
        }
      }

      setVoiceWaveform(DEFAULT_WAVEFORM);
      setVoiceNote({ active: true, paused: false, seconds: 0 });
      setStatus?.('Voice note recording started');
      return true;
    } catch {
      setStatus?.('Mic permission is needed to record a voice note.');
      return false;
    }
  }, [onBeforeStart, setStatus]);

  const toggleVoicePause = useCallback(() => {
    setVoiceNote((current) => {
      const nextPaused = !current.paused;
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording' && nextPaused) recorder.pause();
      if (recorder?.state === 'paused' && !nextPaused) recorder.resume();
      return { ...current, paused: nextPaused };
    });
  }, []);

  const deleteVoiceNote = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    cleanupStream();
    capturedPeaksRef.current = [];
    setVoiceWaveform(DEFAULT_WAVEFORM);
    setVoiceNote({ active: false, paused: false, seconds: 0 });
    setStatus?.('Voice note deleted');
  }, [cleanupStream, setStatus]);

  const stopAndCollectVoiceNote = useCallback(() => new Promise((resolve) => {
    const durationSeconds = voiceNote.seconds;
    const finalize = () => {
      const mimeType = chunksRef.current[0]?.type || recorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const rawPeaks = capturedPeaksRef.current;
      const waveformPeaks = rawPeaks.length >= 24
        ? Array.from({ length: 24 }, (_, idx) => rawPeaks[Math.min(rawPeaks.length - 1, Math.floor((idx / 24) * rawPeaks.length))])
        : DEFAULT_WAVEFORM;
      cleanupStream();
      capturedPeaksRef.current = [];
      setVoiceNote({ active: false, paused: false, seconds: 0 });
      resolve(blob.size > 0 ? { blob, mimeType, durationSeconds, waveformPeaks } : null);
    };

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = finalize;
      recorder.requestData?.();
      recorder.stop();
    } else if (chunksRef.current.length) {
      finalize();
    } else {
      cleanupStream();
      setVoiceNote({ active: false, paused: false, seconds: 0 });
      resolve(null);
    }
  }), [cleanupStream, voiceNote.seconds]);

  return {
    voiceNote,
    voiceWaveform,
    startVoiceNote,
    toggleVoicePause,
    deleteVoiceNote,
    stopAndCollectVoiceNote,
    formatVoiceTime,
  };
}
