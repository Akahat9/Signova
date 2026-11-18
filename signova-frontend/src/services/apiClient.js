export class ApiRequestError extends Error {
  constructor(message, status = 0, code = 'request_failed') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export async function requestJson({
  baseUrl,
  path,
  options = {},
  getToken,
  timeoutMs = 20000,
  fetchImpl = fetch,
}) {
  if (!baseUrl) throw new ApiRequestError('Signova API is not configured. Set REACT_APP_SIGNOVA_API_URL for this deployment.', 0, 'api_not_configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(options.headers || {});
    if (!headers.has('X-Request-Id')) {
      const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      headers.set('X-Request-Id', requestId);
    }
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (getToken && !headers.has('Authorization')) {
      const token = await getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetchImpl(`${baseUrl}${path}`, { ...options, headers, signal: controller.signal });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      throw new ApiRequestError(
        `Signova API returned an invalid response (${response.status}). Check REACT_APP_SIGNOVA_API_URL.`,
        response.status,
        'invalid_api_response',
      );
    }
    const data = await response.json();
    if (!response.ok) throw new ApiRequestError(data.error || `Request failed with ${response.status}`, response.status);
    return { ...data, apiSource: 'backend' };
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiRequestError('Signova API request timed out.', 504, 'timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
