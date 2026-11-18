import { buildSignPurpose, buildSignUsage, getSignBookType, inferSignLanguage, normalizeSignText } from './signPresentation';

test('classifies letters, words, and sentence signs consistently', () => {
  expect(getSignBookType({ label: 'A', source: 'alphabet' })).toBe('letters');
  expect(getSignBookType({ sign: 'thank_you' })).toBe('words');
  expect(getSignBookType({ sign: 'how are you' })).toBe('sentences');
  expect(normalizeSignText('  how_are   you ')).toBe('how are you');
});

test('infers sign language and builds learning copy', () => {
  expect(inferSignLanguage({ source: 'WLASL' })).toBe('ASL');
  expect(inferSignLanguage({ source: 'CSLRT sentence' })).toBe('ISL');
  expect(buildSignUsage({ sign: 'A' }, 'letters')).toContain('fingerspelling');
  expect(buildSignPurpose({}, 'sentences')).toContain('call captions');
});

