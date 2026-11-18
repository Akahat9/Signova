import { MAX_SPEECH_TEXT_LENGTH, resolveSpeechLocale, speakAccessibleText } from './speechService';

class FakeUtterance {
  constructor(text) { this.text = text; }
}

test('maps product languages and preserves valid explicit locales', () => {
  expect(resolveSpeechLocale('English')).toBe('en-IN');
  expect(resolveSpeechLocale('Hindi')).toBe('hi-IN');
  expect(resolveSpeechLocale('Hinglish')).toBe('hi-IN');
  expect(resolveSpeechLocale('ISL Gloss')).toBe('en-IN');
  expect(resolveSpeechLocale('en-US')).toBe('en-US');
  expect(resolveSpeechLocale('unknown')).toBe('en-IN');
});

test('cancels current speech, selects an exact locale voice, and clamps controls', () => {
  const exact = { lang: 'hi-IN', name: 'Hindi voice' };
  const synthesis = { speaking: true, cancel: jest.fn(), speak: jest.fn(), getVoices: () => [{ lang: 'hi', name: 'Generic' }, exact] };
  expect(speakAccessibleText(' नमस्ते ', 'Hindi', { speechSynthesis: synthesis, Utterance: FakeUtterance, rate: 8, pitch: -2 })).toBe(true);
  expect(synthesis.cancel).toHaveBeenCalledTimes(1);
  const utterance = synthesis.speak.mock.calls[0][0];
  expect(utterance).toMatchObject({ text: 'नमस्ते', lang: 'hi-IN', rate: 2, pitch: 0, voice: exact });
});

test('uses a primary-language voice fallback without cancelling idle synthesis', () => {
  const fallback = { lang: 'en-GB' };
  const synthesis = { speaking: false, cancel: jest.fn(), speak: jest.fn(), getVoices: () => [fallback] };
  expect(speakAccessibleText('Hello', 'en-IN', { speechSynthesis: synthesis, Utterance: FakeUtterance })).toBe(true);
  expect(synthesis.cancel).not.toHaveBeenCalled();
  expect(synthesis.speak.mock.calls[0][0].voice).toBe(fallback);
});

test('fails safely for unavailable, invalid, oversized, or throwing browser APIs', () => {
  expect(speakAccessibleText('', 'English', { speechSynthesis: {}, Utterance: FakeUtterance })).toBe(false);
  expect(speakAccessibleText('x'.repeat(MAX_SPEECH_TEXT_LENGTH + 1), 'English', { speechSynthesis: {}, Utterance: FakeUtterance })).toBe(false);
  expect(speakAccessibleText('Hello', 'English', { speechSynthesis: null, Utterance: FakeUtterance })).toBe(false);
  expect(speakAccessibleText('Hello', 'English', { speechSynthesis: {}, Utterance: null })).toBe(false);
  const throwing = { speaking: false, getVoices: () => [], speak: () => { throw new Error('blocked'); } };
  expect(speakAccessibleText('Hello', 'English', { speechSynthesis: throwing, Utterance: FakeUtterance })).toBe(false);
});
