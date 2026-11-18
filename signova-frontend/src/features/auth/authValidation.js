const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'support', 'moderator', 'official', 'verified', 'firebase', 'google', 'signova', 'signovaai', 'signova.ai', 'system', 'root']);
const BLOCKED_PROFILE_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nude', 'porn', 'sex',
  'chutiya', 'madarchod', 'bhenchod', 'bsdk', 'gandu', 'randi', 'harami',
];
const BLOCKED_EMAIL_DOMAINS = new Set(['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'trashmail.com']);

export function normalizeAuthIdentity(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

export function normalizeAuthUsername(value = '') {
  const clean = normalizeAuthIdentity(value).replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '');
  return `@${clean || 'signova.user'}`;
}

export function normalizeAuthPhone(value = '') {
  const digits = String(value).trim().replace(/[^\d+]/g, '');
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits.startsWith('+') ? digits : digits ? `+${digits}` : '';
}

export function splitAuthName(name = 'Signova User') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || 'Signova', lastName: parts.slice(1).join(' ') || 'User' };
}

function hasBlockedProfileLanguage(value = '') {
  const words = String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/);
  return BLOCKED_PROFILE_WORDS.some((word) => words.includes(word));
}

export function validateAuthEmail(email) {
  const normalized = normalizeAuthIdentity(email);
  if (!EMAIL_PATTERN.test(normalized)) throw new Error('Enter a valid email address.');
  if (BLOCKED_EMAIL_DOMAINS.has(normalized.split('@')[1])) throw new Error('Temporary email addresses are not allowed.');
  return normalized;
}

export function validateAuthPhone(phone) {
  const normalized = normalizeAuthPhone(phone);
  if (!E164_PHONE_PATTERN.test(normalized)) throw new Error('Enter a valid phone number with country code, like +91XXXXXXXXXX.');
  return normalized;
}

export function validateOptionalAuthPhone(phone) {
  return String(phone || '').trim() ? validateAuthPhone(phone) : '';
}

export function validateAuthUsername(username) {
  const normalized = normalizeAuthUsername(username);
  const raw = normalized.replace(/^@/, '');
  if (!/^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/.test(raw)) throw new Error('Username must be 3-20 characters and use only letters, numbers, dot, underscore, or dash.');
  if (/[._-]{2,}/.test(raw)) throw new Error('Username cannot use repeated symbols.');
  if (RESERVED_USERNAMES.has(raw) || raw.includes('signova')) throw new Error('This username is reserved.');
  if (hasBlockedProfileLanguage(raw)) throw new Error('Choose a respectful username.');
  return normalized;
}

export function validateAuthName(name) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 40) throw new Error('Name must be 2-40 characters.');
  if (/https?:\/\//i.test(trimmed) || EMAIL_PATTERN.test(trimmed) || /\+?\d{7,}/.test(trimmed)) throw new Error('Name cannot contain links, emails, or phone numbers.');
  if (!/^[\p{L}\p{M}' .-]+$/u.test(trimmed)) throw new Error('Name can use letters, spaces, apostrophe, dot, or dash only.');
  if (hasBlockedProfileLanguage(trimmed)) throw new Error('Choose a respectful display name.');
  return trimmed;
}

export function validateAuthPassword(password, confirmation, requireConfirmation = false) {
  const clean = String(password || '').trim();
  if (clean.length < 6) throw new Error('Password must be at least 6 characters.');
  if (requireConfirmation && clean !== String(confirmation || '').trim()) throw new Error('Confirm password does not match.');
  return clean;
}

export function validateAuthForm(form, mode = 'login') {
  const password = validateAuthPassword(form?.pin, form?.confirmPin, mode === 'signup');
  const email = validateAuthEmail(form?.email);
  if (mode !== 'signup') return { email, password };
  return { email, password, username: validateAuthUsername(form?.username), phone: validateOptionalAuthPhone(form?.phone), name: validateAuthName(form?.name) };
}

export function getFriendlyFirebaseAuthError(error, fallback = 'Authentication failed. Please try again.') {
  const messages = {
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
    'auth/quota-exceeded': 'Firebase email quota/rate limit reached. Wait, then try again from one device.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/operation-not-allowed': 'Firebase Email/Password provider is not enabled for this project.',
    'auth/unauthorized-continue-uri': 'Firebase authorized domain/action URL is not configured for this public website.',
    'auth/invalid-continue-uri': 'Firebase authorized domain/action URL is not configured for this public website.',
    'auth/missing-continue-uri': 'Verification link settings are missing a continue URL.',
    'auth/email-already-in-use': 'This email already has a Signova account. Use Login or resend verification.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Network issue while contacting Firebase. Check connection and try again.',
  };
  return messages[error?.code] || error?.message || fallback;
}
