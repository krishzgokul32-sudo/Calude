import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL } from '../lib/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!localStorage.getItem('pa_token')) return setLoading(false);
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Theme follows the user's preference.
  useEffect(() => {
    document.documentElement.dataset.theme = user?.preferences?.theme || localStorage.getItem('pa_theme') || 'dark';
    document.documentElement.dataset.accent = user?.preferences?.accent || localStorage.getItem('pa_accent') || 'blue';
  }, [user?.preferences?.theme, user?.preferences?.accent]);

  // One authenticated socket per session for live updates.
  useEffect(() => {
    if (!user) return;
    const s = io(API_URL || undefined, { auth: { token: localStorage.getItem('pa_token') } });
    s.on('reminder:due', (r) => {
      toastRef.current('Reminder', { type: 'reminder', body: r.text, duration: 10000 });
      if ('Notification' in window && Notification.permission === 'granted') new Notification('⏰ Reminder', { body: r.text });
      if (user.preferences?.voice && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(`Reminder: ${r.text}`));
    });
    setSocket(s);
    return () => s.disconnect();
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const authenticate = useCallback(async (mode, payload) => {
    const { data } = await api.post(`/auth/${mode}`, payload);
    localStorage.setItem('pa_token', data.token);
    setUser(data.user);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pa_token');
    setUser(null);
  }, []);

  const updateUser = useCallback(async (patch) => {
    const { data } = await api.patch('/auth/me', patch);
    setUser(data.user);
    try {
      if (data.user.preferences?.theme) localStorage.setItem('pa_theme', data.user.preferences.theme);
      if (data.user.preferences?.accent) localStorage.setItem('pa_accent', data.user.preferences.accent);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, socket, authenticate, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const { socket } = useAuth();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
