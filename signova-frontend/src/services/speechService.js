const MAX_SPEECH_TEXT_LENGTH = 2000;

const SPEECH_LOCALES = Object.freeze({
  English: 'en-IN',
  Hindi: 'hi-IN',
  Hinglish: 'hi-IN',
  'ISL Gloss': 'en-IN',
});

export function resolveSpeechLocale(language = 'English') {
  const value = String(language || 'English').trim();
  if (/^[a-z]{2,3}-[A-Z]{2}$/.test(value)) return value;
  return SPEECH_LOCALES[value] || 'en-IN';
}

function boundedNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
}

export function speakAccessibleText(text, language = 'English', {
  speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null,
  Utterance = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null,
  rate = 1.12,
  pitch = 1,
} = {}) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText || normalizedText.length > MAX_SPEECH_TEXT_LENGTH || !speechSynthesis || typeof Utterance !== 'function') return false;

  try {
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    const utterance = new Utterance(normalizedText);
    utterance.lang = resolveSpeechLocale(language);
    utterance.rate = boundedNumber(rate, 1.12, 0.5, 2);
    utterance.pitch = boundedNumber(pitch, 1, 0, 2);
    const voices = typeof speechSynthesis.getVoices === 'function' ? speechSynthesis.getVoices() || [] : [];
    const exactVoice = voices.find((voice) => String(voice.lang || '').toLowerCase() === utterance.lang.toLowerCase());
    const languageVoice = voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase()));
    if (exactVoice || languageVoice) utterance.voice = exactVoice || languageVoice;
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export { MAX_SPEECH_TEXT_LENGTH, SPEECH_LOCALES };
