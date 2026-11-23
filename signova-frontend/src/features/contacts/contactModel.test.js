import {
  areContactsDuplicate,
  contactInitial,
  deduplicateContacts,
  extractLookupPhoneKeys,
  formatUniversalPhone,
  generateUsernameSlug,
  normalizeContactPhone,
  normalizeContactRecord,
  validateContactUsername,
} from './contactModel';

test('universal phone formatter handles raw, international, and local zero formats', () => {
  // Local leading zero
  const localZero = formatUniversalPhone('+91', '09876543210');
  expect(localZero.valid).toBe(true);
  expect(localZero.nationalNumber).toBe('9876543210');
  expect(localZero.countryCode).toBe('+91');
  expect(localZero.formattedNumber).toBe('+91 98765 43210');
  expect(localZero.lookupKeys).toContain('9876543210');
  expect(localZero.lookupKeys).toContain('919876543210');

  // Auto-detect pasted +1 international prefix
  const pastedUS = formatUniversalPhone('+91', '+1 (555) 234-5678');
  expect(pastedUS.valid).toBe(true);
  expect(pastedUS.countryCode).toBe('+1');
  expect(pastedUS.nationalNumber).toBe('5552345678');
  expect(pastedUS.formattedNumber).toBe('+1 (555) 234-5678');

  // UK with spaces and hyphens
  const uk = formatUniversalPhone('+44', '07700 900-123');
  expect(uk.valid).toBe(true);
  expect(uk.countryCode).toBe('+44');
  expect(uk.nationalNumber).toBe('7700900123');
  expect(uk.formattedNumber).toBe('+44 7700 900123');
});

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

test('detects duplicate contacts by username, phone number, and firebaseUid', () => {
  const contact1 = { id: 'u-1', name: 'Krisha', username: '@smilingsunshine824', number: '+91 9876543210', nationalNumber: '9876543210' };
  const contact2 = { id: 'u-2', name: 'krisha', username: '@smilingsunshine824', number: '+91 9876543210', nationalNumber: '9876543210' };
  const contact3 = { id: 'u-3', name: 'Different', username: '@different.user', number: '+91 9876543210', nationalNumber: '9876543210' };
  const contact4 = { id: 'u-4', name: 'Same UID', username: '@someone', firebaseUid: 'uid-abc' };
  const contact5 = { id: 'u-5', name: 'Other', username: '@someone.else', firebaseUid: 'uid-abc' };

  expect(areContactsDuplicate(contact1, contact2)).toBe(true);
  expect(areContactsDuplicate(contact1, contact3)).toBe(true); // Same phone
  expect(areContactsDuplicate(contact4, contact5)).toBe(true); // Same UID
  expect(areContactsDuplicate(contact1, contact4)).toBe(false);
});

test('deduplicates contacts list and preserves single unique contact', () => {
  const list = [
    { id: 'u-1', name: 'Krisha', username: '@smilingsunshine824', number: '+91 9876543210' },
    { id: 'u-2', name: 'krisha', username: '@smilingsunshine824', number: '+91 9876543210' },
    { id: 'u-3', name: 'Muskan', username: '@katochmuskan04', number: '+91 9999988888' },
  ];
  const { uniqueContacts, removedDuplicates } = deduplicateContacts(list);
  expect(uniqueContacts).toHaveLength(2);
  expect(uniqueContacts.map((c) => c.name)).toEqual(['Krisha', 'Muskan']);
  expect(removedDuplicates).toHaveLength(1);
  expect(removedDuplicates[0]).toEqual({ keptId: 'u-1', duplicateId: 'u-2' });
});


