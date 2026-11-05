import { useEffect, useState } from 'react';
import { AnimatePresence, motion, animate } from 'framer-motion';
import { X } from 'lucide-react';

export const pageMotion = {
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.2 } },
};

export const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
export const rise = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export function Page({ children }) {
  return (
    <motion.div variants={pageMotion} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

export function Modal({ open, onClose, children, className = 'modal' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            className={`${className} glass`}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {className === 'modal' && (
              <button className="icon-btn" style={{ float: 'right' }} onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Switch({ on, onChange, label }) {
  return (
    <button type="button" className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} aria-label={label}>
      <motion.div className="knob" layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} style={{ left: on ? 20 : 2 }} />
    </button>
  );
}

export function Tabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)} role="tab" aria-selected={value === t.value}>
          {value === t.value && <motion.div layoutId={`${id}-pill`} className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
}

export function TypingDots() {
  return (
    <div className="typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  );
}

export function Empty({ emoji, title, children }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.div className="big" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
        {emoji}
      </motion.div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {children && <div className="small" style={{ marginTop: 4 }}>{children}</div>}
    </motion.div>
  );
}
