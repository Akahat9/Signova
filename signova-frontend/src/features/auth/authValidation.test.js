import { getFriendlyFirebaseAuthError, normalizeAuthPhone, splitAuthName, validateAuthEmail, validateAuthForm, validateAuthName, validateAuthUsername } from './authValidation';

test('normalizes a complete signup form once', () => {
  expect(validateAuthForm({ email: ' Demo@Example.COM ', pin: ' secret1 ', confirmPin: 'secret1', username: 'Demo.User', phone: '98765 43210', name: '  Akshat   Sharma ' }, 'signup')).toEqual({
    email: 'demo@example.com', password: 'secret1', username: '@demo.user', phone: '+919876543210', name: 'Akshat Sharma',
  });
  expect(normalizeAuthPhone('9876543210')).toBe('+919876543210');
  expect(splitAuthName('Akshat Sharma')).toEqual({ firstName: 'Akshat', lastName: 'Sharma' });
});

test('rejects disposable email, reserved username, unsafe name, and password mismatch', () => {
  expect(() => validateAuthEmail('user@mailinator.com')).toThrow(/temporary/i);
  expect(() => validateAuthUsername('admin')).toThrow(/reserved/i);
  expect(() => validateAuthName('https://example.test')).toThrow(/cannot contain/i);
  expect(() => validateAuthForm({ email: 'a@example.com', pin: 'secret1', confirmPin: 'different', username: 'good.user', phone: '+919876543210', name: 'Good User' }, 'signup')).toThrow(/does not match/i);
});

test('login validation does not require profile fields', () => {
  expect(validateAuthForm({ email: 'USER@example.com', pin: 'secret1' }, 'login')).toEqual({ email: 'user@example.com', password: 'secret1' });
});

test('signup accepts an omitted optional phone number', () => {
  expect(validateAuthForm({
    email: 'user@example.com', pin: 'secret1', confirmPin: 'secret1',
    username: 'good.user', phone: '', name: 'Good User',
  }, 'signup').phone).toBe('');
});

test('maps Firebase errors without exposing implementation details', () => {
  expect(getFriendlyFirebaseAuthError({ code: 'auth/invalid-credential', message: 'internal' })).toBe('Email or password is incorrect.');
  expect(getFriendlyFirebaseAuthError({ code: 'auth/network-request-failed' })).toMatch(/network/i);
  expect(getFriendlyFirebaseAuthError({}, 'fallback')).toBe('fallback');
});
