import { contactInitial, extractLookupPhoneKeys, generateUsernameSlug, normalizeContactPhone, normalizeContactRecord, validateContactUsername } from './contactModel';

test('normalizes contact username and international phone data', () => {
  expect(validateContactUsername(' Sign.User ')).toMatchObject({ valid: true, username: '@sign.user' });
  expect(normalizeContactPhone('+44', '(7700) 900-123')).toMatchObject({ valid: true, nationalNumber: '7700900123', fullNumber: '+44 7700900123' });
  expect(normalizeContactPhone('+91', '123')).toMatchObject({ valid: false });
});

test('generates clean username slug from full name', () => {
  expect(generateUsernameSlug('Rohit Sharma')).toBe('@rohit.sharma');
  expect(generateUsernameSlug('  Priya   Singh  ')).toBe('@priya.singh');
  expect(generateUsernameSlug('')).toBe('');
});

test('extracts phone lookup keys', () => {
  expect(extractLookupPhoneKeys('+91', '9876543210')).toContain('9876543210');
  expect(extractLookupPhoneKeys('+91', '9876543210')).toContain('919876543210');
});

test('normalizes persisted contact visibility without exposing an absent number', () => {
  expect(normalizeContactRecord({ name: 'A', username: 'Alice', showNumber: true })).toMatchObject({ username: '@alice', showNumber: false, countryCode: '+91' });
  expect(contactInitial({ username: '@bob' })).toBe('@');
});

test('rejects repeated username separators', () => {
  expect(validateContactUsername('@a..b')).toMatchObject({ valid: false });
});

