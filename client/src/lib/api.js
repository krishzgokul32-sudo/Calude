import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 120_000 });

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('pa_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  // Every create carries a unique key, so a retried or double-clicked request runs only once (guide §06).
  if (cfg.method === 'post' && !cfg.headers['Idempotency-Key']) cfg.headers['Idempotency-Key'] = newKey();
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.startsWith('/auth/login')) {
      localStorage.removeItem('pa_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => {
  const status = e?.response?.status;
  if (status === 429) {
    const wait = Number(e.response.headers?.['retry-after']);
    return e.response.data?.error || `Too many requests. Try again ${wait ? `in ${wait < 120 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}` : 'shortly'}.`;
  }
  if (status === 503) return e.response.data?.error || 'The server is busy. Please try again in a few seconds.';
  if (e?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (!e?.response && e?.message === 'Network Error') return "Can't reach GK. Check your connection or whether the server is running.";
  return e?.response?.data?.error || e?.message || 'Something went wrong';
};

let reported = 0;
/** Send a frontend crash to the server log (rate-limited in the browser too). */
export function reportClientError(error, componentStack) {
  if (reported++ > 5) return;
  try {
    fetch(`${API_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: String(error?.message || error).slice(0, 500),
        stack: String(error?.stack || '').slice(0, 2000),
        componentStack: String(componentStack || '').slice(0, 2000),
        url: location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw from the reporter */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => reportClientError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportClientError(e.reason));
}
