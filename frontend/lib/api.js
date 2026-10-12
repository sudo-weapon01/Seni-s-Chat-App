const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('seni_token');
}

export function setStoredToken(token) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('seni_token', token);
  else window.localStorage.removeItem('seni_token');
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const auth = token || getStoredToken();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const networkError = new Error('Unable to connect to server. Please ensure the backend is running.');
    networkError.status = 0;
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }
  return data;
}
