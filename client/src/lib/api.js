import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('pa_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
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

export const errMsg = (e) => e?.response?.data?.error || e?.message || 'Something went wrong';
