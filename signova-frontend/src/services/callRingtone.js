// Web Audio API Ringtone & Ringback Tone Generator for Signova Calls
let audioCtx = null;
let activeToneInterval = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playOutgoingRingback() {
  stopCallAudio();
  const ctx = getAudioContext();
  if (!ctx) return;

  function playPulse() {
    try {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      osc1.type = 'sine';
      osc2.type = 'sine';

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch {}
  }

  playPulse();
  activeToneInterval = setInterval(playPulse, 3200);
}

export function playIncomingRingtone() {
  stopCallAudio();
  const ctx = getAudioContext();
  if (!ctx) return;

  function playMelody() {
    try {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, offset: 0, dur: 0.22 },     // C5
        { freq: 659.25, offset: 0.16, dur: 0.22 },  // E5
        { freq: 783.99, offset: 0.32, dur: 0.25 },  // G5
        { freq: 1046.50, offset: 0.48, dur: 0.4 },  // C6
      ];
      notes.forEach(({ freq, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.07, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + dur);
      });
    } catch {}
  }

  playMelody();
  activeToneInterval = setInterval(playMelody, 2600);
}

export function stopCallAudio() {
  if (activeToneInterval) {
    clearInterval(activeToneInterval);
    activeToneInterval = null;
  }
}
