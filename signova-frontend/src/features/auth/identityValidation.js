export function normalizeUsername(value = '') {
  if (value == null) return '';
  const clean = String(value).trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
  return clean ? `@${clean}` : '';
}
