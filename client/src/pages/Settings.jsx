import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { Page, Switch, rise, stagger } from '../components/ui';
import AssistantOrb from '../components/AssistantOrb';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, assistantName: user.assistantName, city: user.preferences?.city || '' });
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setHealth(r.data.services)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateUser({ name: form.name, assistantName: form.assistantName, preferences: { city: form.city } });
      toast('Settings saved', { type: 'success' });
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  };

  const prefs = user.preferences || {};
  const services = [
    { key: 'mongo', name: 'MongoDB', desc: 'Stores users, conversations, tasks, notes, reminders and bots.' },
    { key: 'claude', name: 'Claude AI brain', desc: 'Set ANTHROPIC_API_KEY on the server for full conversational AI with tool use. Otherwise a rule-based brain is used.' },
    { key: 'python', name: 'Python NLP service', desc: 'FastAPI service for sentiment, intent, entities and summaries (ai-service/).' },
  ];

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Personalise your assistant and check your integrations.</p>
        </div>
      </div>
      <motion.div className="grid grid-2" variants={stagger} initial="initial" animate="animate">
        <motion.form variants={rise} className="glass card" onSubmit={save}>
          <div className="row" style={{ marginBottom: 18 }}>
            <AssistantOrb size={40} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{form.assistantName || 'Assistant'}</div>
              <div className="small muted">Your assistant's identity</div>
            </div>
          </div>
          <div className="field"><label className="label">Your name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label className="label">Assistant name</label><input className="input" value={form.assistantName} onChange={(e) => setForm({ ...form, assistantName: e.target.value })} /></div>
          <div className="field"><label className="label">Home city (default for weather)</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Chennai" /></div>
          <button className="btn btn-primary"><Save size={16} /> Save</button>
        </motion.form>

        <motion.div variants={rise} className="glass card">
          <div className="card-title">Preferences</div>
          <div className="list-row">
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Dark mode</div><div className="small muted">Aurora glass, easy on the eyes</div></div>
            <Switch on={prefs.theme !== 'light'} onChange={(v) => updateUser({ preferences: { theme: v ? 'dark' : 'light' } })} label="Dark mode" />
          </div>
          <div className="list-row">
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Spoken reminders</div><div className="small muted">Read reminders aloud when they fire</div></div>
            <Switch on={prefs.voice !== false} onChange={(v) => updateUser({ preferences: { voice: v } })} label="Voice" />
          </div>
          <div className="list-row">
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Browser notifications</div><div className="small muted">{'Notification' in window ? Notification.permission : 'unsupported'}</div></div>
            <button className="btn btn-ghost" onClick={() => Notification.requestPermission().then(() => toast('Notification permission: ' + Notification.permission))}>Enable</button>
          </div>
        </motion.div>

        <motion.div variants={rise} className="glass card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-title">System status</div>
          {services.map((s) => (
            <div key={s.key} className="list-row">
              <span className={`dot ${health?.[s.key] ? 'on' : 'off'}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="small muted">{s.desc}</div>
              </div>
              <span className="badge">{health ? (health[s.key] ? 'online' : 'offline') : '…'}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </Page>
  );
}
