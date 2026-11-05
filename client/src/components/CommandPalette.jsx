import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Modal } from './ui';
import { NAV } from '../lib/nav';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

/** Ctrl/Cmd+K: jump anywhere, or send any command straight to the assistant. */
export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const items = useMemo(() => {
    const nav = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({
      key: n.to,
      label: `Go to ${n.label}`,
      icon: n.icon,
      run: () => navigate(n.to),
    }));
    const ask = q.trim()
      ? [{
          key: 'ask',
          label: `Ask assistant: “${q}”`,
          icon: Sparkles,
          run: async () => {
            try {
              const { data } = await api.post('/chat/message', { text: q });
              toast('Assistant', { type: 'success', body: data.messages[1].content.slice(0, 160), duration: 7000 });
            } catch {
              toast('Assistant failed', { type: 'error' });
            }
          },
        }]
      : [];
    return [...ask, ...nav];
  }, [q, navigate, toast]);

  const run = (item) => {
    onClose();
    item?.run();
  };

  return (
    <Modal open={open} onClose={onClose} className="palette">
      <input
        autoFocus
        value={q}
        placeholder="Type a command or ask anything… (e.g. add task call Sam)"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter') run(items[active]);
        }}
      />
      <div className="palette-list">
        {items.map((item, i) => (
          <button key={item.key} className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => run(item)}>
            <item.icon size={18} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {i === active && <ArrowRight size={16} />}
          </button>
        ))}
      </div>
    </Modal>
  );
}
