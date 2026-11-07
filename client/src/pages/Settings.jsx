import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, KeyRound, Trash2, ExternalLink } from 'lucide-react';
import { Page, Switch, rise, stagger } from '../components/ui';
import AssistantOrb from '../components/AssistantOrb';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';

export default function Settings() {
  const { user, setUser, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, assistantName: user.assistantName, city: user.preferences?.city || '' });
  const [health, setHealth] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [ai, setAi] = useState({ provider: 'auto', model: '', baseUrl: '' });
  const [providers, setProviders] = useState([]);
  const [serverAi, setServerAi] = useState(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState('');

  const loadHealth = () => api.get('/dashboard').then((r) => setHealth(r.data.services)).catch(() => {});
  useEffect(() => {
    loadHealth();
    api.get('/auth/ai-providers').then((r) => { setProviders(r.data.providers); setServerAi(r.data.server); }).catch(() => {});
  }, []);
  const current = providers.find((p) => p.id === user.aiProvider);
  const picked = providers.find((p) => p.id === ai.provider);
  const keyNeeded = !picked?.keyOptional;
  const showBase = picked && (picked.needsBase || picked.id === 'ollama');

  const saveKey = async (e) => {
    e.preventDefault();
    setKeyBusy(true);
    setKeyError('');
    try {
      const { data } = await api.put('/auth/me/api-key', { apiKey, ...ai });
      setUser(data.user);
      setApiKey('');
      setAi({ provider: 'auto', model: '', baseUrl: '' });
      const name = providers.find((p) => p.id === data.user.aiProvider)?.label || 'AI';
      toast(`${name} connected`, { type: 'success', body: `GK will now think with ${data.user.aiModel || name}.` });
      loadHealth();
    } catch (err) {
      setKeyError(errMsg(err));
    } finally {
      setKeyBusy(false);
    }
  };

  const removeKey = async () => {
    const { data } = await api.delete('/auth/me/api-key');
    setUser(data.user);
    toast('API key removed', { type: 'info' });
    loadHealth();
  };

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
    { key: 'claude', name: 'AI brain', desc: 'Add a key from any provider above (or set ANTHROPIC_API_KEY / AI_API_KEY on the server) for full conversational AI with tool use. Otherwise a rule-based brain is used.' },
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
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Dark mode</div><div className="small muted">On: black Midnight Steel · Off: crisp white</div></div>
            <Switch on={prefs.theme !== 'light'} onChange={(v) => updateUser({ preferences: { theme: v ? 'dark' : 'light' } })} label="Dark mode" />
          </div>
          <div className="list-row">
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Accent colour</div><div className="small muted">Glow, buttons and the particle sphere</div></div>
            <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Accent colour">
              {[['blue', 'Dark blue', 'linear-gradient(180deg,#2b56d6,#172f86)'], ['orange', 'Orange', 'linear-gradient(180deg,#e2571c,#93310a)'], ['gold', 'Gold', 'linear-gradient(180deg,#c9921f,#74500c)']].map(([key, label, bg]) => {
                const on = (prefs.accent || 'blue') === key;
                return (
                  <button key={key} role="radio" aria-checked={on} className="chip" onClick={() => updateUser({ preferences: { accent: key } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderColor: on ? 'var(--primary)' : undefined, boxShadow: on ? '0 0 0 2px var(--primary)' : undefined }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: bg }} /> {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="list-row">
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Currency</div><div className="small muted">Used on the team dashboards</div></div>
            <select className="select" style={{ width: 120 }} value={prefs.currency || 'INR'} onChange={(e) => updateUser({ preferences: { currency: e.target.value } })} aria-label="Currency">
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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

        <motion.form variants={rise} className="glass card" style={{ gridColumn: '1 / -1' }} onSubmit={saveKey}>
          <div className="card-title">
            <span className="row"><KeyRound size={18} /> AI brain · any provider</span>
            <span className="badge">
              <span className={`dot ${user.anthropicKeyHint || (current?.keyOptional && user.aiBaseUrl) ? 'on' : 'off'}`} />{' '}
              {user.anthropicKeyHint || (current?.keyOptional && user.aiBaseUrl)
                ? `${current?.label || user.aiProvider}${user.aiModel ? ` · ${user.aiModel}` : ''}${user.anthropicKeyHint ? ` · …${user.anthropicKeyHint}` : ''}`
                : serverAi ? `Using the server's ${serverAi}` : 'Not connected'}
            </span>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Use a key from Claude, OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, a local Ollama, or any OpenAI-compatible service.
            The key is checked with the provider, stored encrypted, and never shown again.{' '}
            {picked?.docs && <a href={picked.docs} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{picked.keyOptional ? `Set up ${picked.label}` : `Get a ${picked.label} key`} <ExternalLink size={12} /></a>}
          </p>
          <div className="ai-form">
            <label className="field">
              <span className="small muted">Provider</span>
              <select className="select" value={ai.provider} onChange={(e) => setAi({ ...ai, provider: e.target.value, baseUrl: '' })}>
                <option value="auto">Auto-detect from the key</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span className="small muted">API key{picked?.keyOptional ? ' (optional)' : ''}</span>
              <input
                className="input mono"
                type="password"
                autoComplete="off"
                placeholder={user.anthropicKeyHint ? 'Paste a new key to replace the current one' : 'sk-ant-…, sk-…, AIza…, gsk_…, sk-or-…'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="small muted">Model (optional)</span>
              <input className="input mono" placeholder="Best default for the provider" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
            </label>
            {showBase && (
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span className="small muted">API address (base URL)</span>
                <input className="input mono" placeholder={picked.base || 'https://your-provider.com/v1'} value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} />
              </label>
            )}
          </div>
          <div className="row-wrap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" disabled={keyBusy || (keyNeeded && !apiKey.trim()) || (picked?.needsBase && !ai.baseUrl.trim())}>{keyBusy ? 'Checking…' : 'Connect'}</button>
            {(user.anthropicKeyHint || user.aiBaseUrl) && <button type="button" className="btn btn-danger" onClick={removeKey}><Trash2 size={15} /> Disconnect</button>}
          </div>
          {keyError && <p className="small" style={{ color: 'var(--danger)', marginTop: 10 }}>{keyError}</p>}
        </motion.form>

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
