export function inferSignLanguage(sign = {}, fallback = 'ISL') {
  const source = `${sign.source || ''} ${sign.sources || ''} ${sign.language || ''} ${sign.label || ''} ${sign.sign || ''}`.toLowerCase();
  if (source.includes('asl')) return 'ASL';
  if (source.includes('isl') || source.includes('cslrt')) return 'ISL';
  if (source.includes('bsl')) return 'BSL';
  if (source.includes('alphabet')) return 'English';
  return fallback;
}

export function normalizeSignText(value = '') { return String(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim(); }
export function getSignTokenCount(sign = {}) { const phrase = normalizeSignText(sign.sign || sign.label || ''); return phrase ? phrase.split(/\s+/).filter(Boolean).length : 0; }
export function getSignBookType(sign = {}) {
  const label = normalizeSignText(sign.label || sign.sign || '');
  const source = `${sign.source || ''} ${sign.language || ''}`.toLowerCase();
  const phrase = normalizeSignText(sign.sign || sign.label || '');
  const tokenCount = getSignTokenCount(sign);
  if (source.includes('alphabet') || /^[a-z]$/i.test(label) || /^[a-z]$/i.test(phrase) || ['space', 'del', 'delete'].includes(label.toLowerCase())) return 'letters';
  if (source.includes('sentence') || source.includes('isl') || source.includes('cslrt') || tokenCount >= 3) return 'sentences';
  return 'words';
}
export function buildSignUsage(sign = {}, bookType = 'words') {
  const phrase = normalizeSignText(sign.sign || sign.label || 'this sign');
  if (bookType === 'letters') return `Use ${phrase} for fingerspelling, spelling names, and building community-created words.`;
  if (bookType === 'sentences') return 'Use this sentence sign when the full meaning is needed in one steady gesture.';
  return `Use ${phrase} as daily vocabulary in word mode before joining it into a sentence.`;
}
export function buildSignPurpose(_sign = {}, bookType = 'words') {
  if (bookType === 'letters') return 'Purpose: trains handshape accuracy and helps users create new signs step by step.';
  if (bookType === 'sentences') return 'Purpose: supports sentence-mode practice for clearer call captions and voice output.';
  return 'Purpose: turns one useful concept into text or voice during live translation.';
}

export function formatConfidence(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}
