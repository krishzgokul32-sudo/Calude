import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);
const ICONS = { success: '✅', error: '⚠️', info: '💡', reminder: '⏰', bot: '🤖' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((title, { type = 'info', body, duration = 4000 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="toast glass"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            >
              <div className="t-icon">{ICONS[t.type]}</div>
              <div>
                <div className="t-title">{t.title}</div>
                {t.body && <div className="small muted">{t.body}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
