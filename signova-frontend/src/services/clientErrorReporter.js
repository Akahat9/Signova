import { firebaseAuth } from '../firebase';
import { requestJson } from './apiClient';

const API_BASE_URL = String(process.env.REACT_APP_SIGNOVA_API_URL || '').trim().replace(/\/+$/, '');
const RELEASE = String(process.env.REACT_APP_SIGNOVA_RELEASE || process.env.REACT_APP_VERSION || 'web-dev')
  .replace(/[^A-Za-z0-9._-]/g, '-')
  .slice(0, 80) || 'web-dev';
const recentlyReported = new Map();
const DEDUPE_MS = 60_000;
const SAFE_ROUTES = new Set(['', 'settings', 'calls', 'chats', 'community', 'learn', 'practice', 'library', 'progress', 'profile', 'notifications', 'subscription', 'help']);

export function extractSafeStackFrames(stack) {
  const frames = [];
  String(stack || '').split('\n').forEach((line) => {
    const match = line.match(/([A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx)):(\d{1,8}):(\d{1,6})/);
    if (match) frames.push(`${match[1]}:${match[2]}:${match[3]}`);
  });
  return [...new Set(frames)].slice(0, 8);
}

function fallbackHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}${value.length.toString(16).padStart(8, '0')}`;
}

async function fingerprint(value) {
  if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') return fallbackHash(value);
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildClientErrorEnvelope(error, { source = 'runtime_error', componentStack = '' } = {}) {
  const normalizedError = error instanceof Error ? error : new Error(String(error || 'Unknown client error'));
  const frames = extractSafeStackFrames(`${normalizedError.stack || ''}\n${componentStack || ''}`);
  const errorName = String(normalizedError.name || 'Error').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) || 'Error';
  const routeSegment = String(window.location?.pathname || '/').split('/').filter(Boolean)[0] || '';
  const route = SAFE_ROUTES.has(routeSegment) ? `/${routeSegment}` : '/other';
  return {
    source,
    errorName,
    release: RELEASE,
    route,
    frames,
    fingerprint: await fingerprint(`${source}|${errorName}|${RELEASE}|${frames.join('|')}`),
  };
}

export async function reportClientError(error, context = {}) {
  try {
    const user = firebaseAuth?.currentUser;
    if (!API_BASE_URL || !user?.getIdToken) return false;
    const envelope = await buildClientErrorEnvelope(error, context);
    const lastReportedAt = recentlyReported.get(envelope.fingerprint) || 0;
    if (Date.now() - lastReportedAt < DEDUPE_MS) return false;
    recentlyReported.set(envelope.fingerprint, Date.now());
    if (recentlyReported.size > 100) recentlyReported.delete(recentlyReported.keys().next().value);
    await requestJson({
      baseUrl: API_BASE_URL,
      path: '/api/observability/client-errors',
      options: { method: 'POST', body: JSON.stringify(envelope) },
      getToken: () => user.getIdToken(),
      timeoutMs: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

export function installGlobalErrorReporting() {
  const handleError = (event) => {
    void reportClientError(event.error || new Error('Window runtime error'), { source: 'runtime_error' });
  };
  const handleRejection = (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled rejection'));
    void reportClientError(reason, { source: 'unhandled_rejection' });
  };
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
