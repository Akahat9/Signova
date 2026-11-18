import { normalizeUsername } from './identityValidation';

test('normalizes usernames consistently', () => {
  expect(normalizeUsername(' @@Demo User! ')).toBe('@demouser');
  expect(normalizeUsername(null)).toBe('');
});
