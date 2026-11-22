import { normalizeUsername } from '../auth/identityValidation';

export const CONTACT_COUNTRIES = Object.freeze([
  { code: '+91', country: 'India', flag: 'IN', digits: 10 },
  { code: '+1', country: 'United States / Canada', flag: 'US', digits: 10 },
  { code: '+44', country: 'United Kingdom', flag: 'GB', digits: 10 },
  { code: '+61', country: 'Australia', flag: 'AU', digits: 9 },
  { code: '+971', country: 'United Arab Emirates', flag: 'AE', digits: 9 },
  { code: '+49', country: 'Germany', flag: 'DE', digits: 10 },
  { code: '+33', country: 'France', flag: 'FR', digits: 9 },
]);

export function validateContactUsername(username) {
  const clean = normalizeUsername(username);
  if (!clean) return { valid: false, username: '', error: 'Username required hai.' };
  if (!/^@[a-z0-9](?:[a-z0-9._]{2,28}[a-z0-9])$/.test(clean)) {
    return { valid: false, username: clean, error: 'Username 4-30 characters ka hona chahiye, sirf letters, numbers, dot, underscore. Start/end letter ya number se ho.' };
  }
  if (clean.includes('..') || clean.includes('__') || clean.includes('._') || clean.includes('_.')) {
    return { valid: false, username: clean, error: 'Username me repeated dot/underscore pattern allowed nahi hai.' };
  }
  return { valid: true, username: clean, error: '' };
}

export function normalizeContactPhone(countryCode, number) {
  const selectedCountry = CONTACT_COUNTRIES.find((item) => item.code === countryCode) || CONTACT_COUNTRIES[0];
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return { valid: true, countryCode: selectedCountry.code, nationalNumber: '', fullNumber: '', country: selectedCountry.country, error: '' };
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, countryCode: selectedCountry.code, nationalNumber: digits, fullNumber: '', country: selectedCountry.country, error: 'Phone number 7-15 digits ka hona chahiye.' };
  }
  return { valid: true, countryCode: selectedCountry.code, nationalNumber: digits, fullNumber: `${selectedCountry.code} ${digits}`, country: selectedCountry.country, error: '' };
}

export function normalizeContactRecord(contact) {
  const phone = normalizeContactPhone(contact.countryCode || '+91', contact.nationalNumber || contact.number || '');
  return {
    ...contact,
    countryCode: phone.countryCode,
    country: contact.country || phone.country,
    nationalNumber: phone.nationalNumber,
    number: phone.fullNumber || contact.number || '',
    username: normalizeUsername(contact.username || ''),
    showUsername: contact.showUsername !== false,
    showNumber: contact.showNumber !== false && Boolean(phone.fullNumber || contact.number),
  };
}

export function contactInitial(contact) {
  return (contact?.name || contact?.username || 'S').trim().charAt(0).toUpperCase();
}

export function generateUsernameSlug(fullName) {
  const base = String(fullName || '').split('@')[0].trim().toLowerCase();
  const clean = base
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
  if (!clean) return '';
  const trimmed = clean.slice(0, 24);
  return `@${trimmed}`;
}

export function extractLookupPhoneKeys(countryCode, number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) return [];
  const keys = new Set();
  keys.add(digits);
  if (countryCode) {
    const codeDigits = String(countryCode).replace(/\D/g, '');
    keys.add(`${codeDigits}${digits}`);
  }
  if (digits.length > 10) {
    keys.add(digits.slice(-10));
  }
  return Array.from(keys);
}

export function areContactsDuplicate(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.firebaseUid && b.firebaseUid && a.firebaseUid === b.firebaseUid) return true;

  const userA = normalizeUsername(a.username || '');
  const userB = normalizeUsername(b.username || '');
  if (userA && userB && userA === userB) return true;

  const digitsA = String(a.nationalNumber || a.number || '').replace(/\D/g, '');
  const digitsB = String(b.nationalNumber || b.number || '').replace(/\D/g, '');
  if (digitsA.length >= 7 && digitsB.length >= 7) {
    if (digitsA === digitsB) return true;
    if (digitsA.length >= 10 && digitsB.length >= 10 && digitsA.slice(-10) === digitsB.slice(-10)) return true;
  }
  return false;
}

export function deduplicateContacts(contactsList = []) {
  const uniqueContacts = [];
  const removedDuplicates = [];

  for (const contact of contactsList) {
    if (!contact) continue;
    const existingIndex = uniqueContacts.findIndex((item) => areContactsDuplicate(item, contact));
    if (existingIndex === -1) {
      uniqueContacts.push(contact);
    } else {
      const existing = uniqueContacts[existingIndex];
      const preferredName = (existing.name && existing.name.length > 1 && existing.name[0] === existing.name[0].toUpperCase())
        ? existing.name
        : (contact.name || existing.name);
      const merged = {
        ...contact,
        ...existing,
        name: preferredName,
        firebaseUid: existing.firebaseUid || contact.firebaseUid || '',
        number: existing.number || contact.number || '',
        nationalNumber: existing.nationalNumber || contact.nationalNumber || '',
        countryCode: existing.countryCode || contact.countryCode || '+91',
        showNumber: Boolean(existing.showNumber || contact.showNumber),
        id: existing.id || contact.id,
      };
      uniqueContacts[existingIndex] = merged;
      removedDuplicates.push({ keptId: merged.id, duplicateId: contact.id });
    }
  }

  return { uniqueContacts, removedDuplicates };
}


