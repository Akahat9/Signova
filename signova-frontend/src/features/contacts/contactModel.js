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

export function formatUniversalPhone(countryCode = '+91', input = '') {
  const trimmed = String(input || '').trim();
  const defaultCountry = CONTACT_COUNTRIES.find((c) => c.code === countryCode) || CONTACT_COUNTRIES[0];
  if (!trimmed) {
    return {
      valid: true,
      countryCode: defaultCountry.code,
      country: defaultCountry.country,
      nationalNumber: '',
      fullNumber: '',
      formattedNumber: '',
      e164: '',
      error: '',
      lookupKeys: [],
    };
  }

  let activeCode = defaultCountry.code;
  let nationalRaw = trimmed;

  // Auto-detect country code if input starts with + or 00
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const rawDigits = trimmed.replace(/\D/g, '');
    const sorted = [...CONTACT_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      const codeDigits = c.code.replace(/\D/g, '');
      if (rawDigits.startsWith(codeDigits)) {
        activeCode = c.code;
        nationalRaw = rawDigits.slice(codeDigits.length);
        break;
      }
    }
  }

  const selectedCountry = CONTACT_COUNTRIES.find((c) => c.code === activeCode) || defaultCountry;
  let digits = nationalRaw.replace(/\D/g, '');

  // Strip leading 0 if local format entered with country code (e.g. 09876543210 -> 9876543210)
  if (digits.startsWith('0') && digits.length > (selectedCountry.digits || 10)) {
    digits = digits.replace(/^0+/, '');
  }

  const valid = digits.length >= 7 && digits.length <= 15;
  const error = (!valid && digits.length > 0)
    ? (digits.length < 7 ? 'Phone number kam se kam 7 digits ka hona chahiye.' : 'Phone number maximum 15 digits ka ho sakta hai.')
    : '';

  // Pretty spacing for readable display
  let formattedNational = digits;
  if (activeCode === '+91' && digits.length === 10) {
    formattedNational = `${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (activeCode === '+1' && digits.length === 10) {
    formattedNational = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (activeCode === '+44' && digits.length === 10) {
    formattedNational = `${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else if (digits.length > 6) {
    formattedNational = `${digits.slice(0, Math.ceil(digits.length / 2))} ${digits.slice(Math.ceil(digits.length / 2))}`;
  }

  const fullNumber = digits ? `${activeCode} ${digits}` : '';
  const formattedNumber = digits ? `${activeCode} ${formattedNational}` : '';
  const e164 = digits ? `${activeCode}${digits}` : '';
  const lookupKeys = extractLookupPhoneKeys(activeCode, digits);

  return {
    valid,
    countryCode: activeCode,
    country: selectedCountry.country,
    nationalNumber: digits,
    fullNumber,
    formattedNumber,
    e164,
    error,
    lookupKeys,
  };
}

export function normalizeContactPhone(countryCode, number) {
  const parsed = formatUniversalPhone(countryCode, number);
  return {
    valid: parsed.valid,
    countryCode: parsed.countryCode,
    nationalNumber: parsed.nationalNumber,
    fullNumber: parsed.fullNumber,
    formattedNumber: parsed.formattedNumber,
    country: parsed.country,
    error: parsed.error,
    lookupKeys: parsed.lookupKeys,
  };
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

  if (digits.startsWith('0') && digits.length >= 8) {
    keys.add(digits.replace(/^0+/, ''));
  }

  if (countryCode) {
    const codeDigits = String(countryCode).replace(/\D/g, '');
    keys.add(`${codeDigits}${digits}`);
    if (digits.startsWith('0')) {
      const stripped = digits.replace(/^0+/, '');
      keys.add(`${codeDigits}${stripped}`);
    }
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


