import { useCallback, useEffect, useState } from 'react';
import { useSaving } from '../hooks/useSaving';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Repeat } from 'lucide-react';
import { Page, Tabs, Empty } from '../components/ui';
import { useSocketEvent } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';
import { fmtDateTime, timeUntil } from '../lib/format';

const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const [form, setForm] = useState({ text: '', remindAt: toLocalInput(new Date(Date.now() + 15 * 60e3)), repeat: 'none' });
  const [, tick] = useState(0);
  const toast = useToast();
  const [saving, run] = useSaving();

  const load = useCallback(() => api.get('/reminders').then((r) => setItems(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000); // keep countdowns fresh
    return () => clearInterval(t);
  }, []);
  useSocketEvent('data:changed', ({ kind }) => kind === 'reminders' && load());
  useSocketEvent('reminder:due', load);

  const add = run(async () => {
    try {
      await api.post('/reminders', { ...form, remindAt: new Date(form.remindAt).toISOString() });
      toast('Reminder set', { type: 'success', body: form.text });
      setForm({ ...form, text: '' });
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  });

  const remove = async (r) => {
    setItems((xs) => xs.filter((x) => x._id !== r._id));
    try {
      await api.delete(`/reminders/${r._id}`);
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
      load();
    }
  };

  const shown = items.filter((r) => (tab === 'upcoming' ? !r.delivered : r.delivered));

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Reminders</h1>
          <p>Delivered in-app, by voice, as browser notifications and through your Telegram / Discord / Slack bots.</p>
        </div>
        <Tabs id="rem" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Delivered' }]} />
      </div>

      <motion.form className="glass card row-wrap" style={{ marginBottom: 20 }} onSubmit={add} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <input className="input" style={{ flex: '2 1 240px' }} required placeholder="What should I remind you about?" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <input className="input" style={{ flex: '1 1 200px' }} type="datetime-local" required value={form.remindAt} onChange={(e) => setForm({ ...form, remindAt: e.target.value })} />
        <select className="select" style={{ flex: '0 1 130px' }} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
          <option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
        <button className="btn btn-primary" disabled={saving}><Plus size={16} /> {saving ? 'Adding…' : 'Add'}</button>
      </motion.form>

      <div className="grid">
        <AnimatePresence>
          {shown.map((r, i) => (
            <motion.div key={r._id} layout className="glass card row" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ delay: i * 0.04 }}>
              <motion.span style={{ fontSize: 24 }} animate={!r.delivered ? { rotate: [0, -12, 12, -6, 0] } : {}} transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.6 }}>⏰</motion.span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{r.text}</div>
                <div className="small muted">{fmtDateTime(r.remindAt)} {r.repeat !== 'none' && <span className="badge"><Repeat size={11} /> {r.repeat}</span>}</div>
              </div>
              {!r.delivered && <span className="badge">{timeUntil(r.remindAt)}</span>}
              <button className="icon-btn" onClick={() => remove(r)} aria-label="Delete reminder"><Trash2 size={16} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        {!shown.length && <Empty emoji={tab === 'upcoming' ? '🌙' : '📭'} title={tab === 'upcoming' ? 'No upcoming reminders' : 'Nothing delivered yet'}>Say “remind me to call mom in 20 minutes”.</Empty>}
      </div>
    </Page>
  );
}
