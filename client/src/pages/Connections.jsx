import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plug, RefreshCw, Trash2, CheckCircle2, AlertCircle, ExternalLink, Bot } from 'lucide-react';
import { Page, Modal, stagger, rise } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';
import { timeAgo } from '../lib/format';

const BOT_HUB_TOOLS = [
  { icon: '✈️', name: 'Telegram', description: 'Chat with GK from Telegram and get reminders there.' },
  { icon: '🎮', name: 'Discord', description: 'Post messages and reminders to a channel.' },
  { icon: '💼', name: 'Slack', description: 'Post messages and reminders to a channel.' },
  { icon: '🔗', name: 'Your own bot', description: 'Any bot you built, over a signed webhook.' },
];

function StatusBadge({ conn }) {
  if (!conn) return <span className="pill" style={{ textTransform: "none" }}><span className="dot" style={{ background: 'var(--status-neutral)' }} /> Not connected</span>;
  if (conn.status === 'connected') return <span className="pill" style={{ color: 'var(--delta-up)', textTransform: 'none' }}><CheckCircle2 size={13} /> Connected</span>;
  return <span className="pill" style={{ color: 'var(--delta-down)', textTransform: 'none' }}><AlertCircle size={13} /> Needs attention</span>;
}

export default function Connections() {
  const toast = useToast();
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState({});
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState('');

  const load = useCallback(
    () =>
      api.get('/connections').then((r) => {
        setProviders(r.data.providers);
        setConnections(Object.fromEntries(r.data.connections.map((c) => [c.provider, c])));
      }),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const openFor = (p) => {
    setOpen(p);
    setForm({ ...(connections[p.key]?.settings || {}) });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(open.key);
    try {
      const { data } = await api.put(`/connections/${open.key}`, form);
      setConnections((c) => ({ ...c, [open.key]: data }));
      if (data.status === 'connected') {
        toast(`${open.name} connected`, { type: 'success', body: data.account });
        setOpen(null);
      }
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusy('');
    }
  };

  const retest = async (p) => {
    setBusy(p.key);
    try {
      const { data } = await api.post(`/connections/${p.key}/test`);
      setConnections((c) => ({ ...c, [p.key]: data }));
      toast(data.status === 'connected' ? `${p.name} is working` : `${p.name} failed`, { type: data.status === 'connected' ? 'success' : 'error', body: data.account || data.lastError });
    } finally {
      setBusy('');
    }
  };

  const disconnect = async (p) => {
    if (!confirm(`Disconnect ${p.name}? The saved keys will be deleted.`)) return;
    await api.delete(`/connections/${p.key}`);
    setConnections((c) => {
      const next = { ...c };
      delete next[p.key];
      return next;
    });
  };

  const current = open && connections[open.key];
  const connectedCount = Object.values(connections).filter((c) => c.status === 'connected').length;

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Connections</h1>
          <p>Plug your tools into GK. Keys are checked with each tool, stored encrypted, and never shown again.</p>
        </div>
        <span className="pill" style={{ textTransform: "none" }}><Plug size={13} /> {connectedCount} of {providers.length} connected</span>
      </div>

      <motion.div className="team-cards" variants={stagger} initial="initial" animate="animate">
        {providers.map((p) => {
          const conn = connections[p.key];
          return (
            <motion.div key={p.key} variants={rise} className="glass team-card" whileHover={{ y: -4, rotateX: 4, rotateY: -3, transformPerspective: 900 }}>
              <div className="t-head">
                <span className="t-icon" style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ flex: 1 }}>{p.name}</span>
                <StatusBadge conn={conn} />
              </div>
              <p className="small muted" style={{ minHeight: 38 }}>{p.description}</p>
              {conn?.status === 'connected' && <div className="small"><strong>{conn.account}</strong> <span className="muted">· checked {timeAgo(conn.lastCheckedAt)}</span></div>}
              {conn?.status === 'error' && <div className="small" style={{ color: 'var(--delta-down)' }}>{conn.lastError}</div>}
              <div className="row" style={{ marginTop: 'auto', paddingTop: 6 }}>
                <button className={`btn ${conn ? 'btn-ghost' : 'btn-primary'}`} onClick={() => openFor(p)}>{conn ? 'Edit' : 'Connect'}</button>
                {conn && (
                  <>
                    <button className="icon-btn" title="Test connection" onClick={() => retest(p)} disabled={busy === p.key} aria-label="Test connection">
                      <RefreshCw size={16} className={busy === p.key ? 'spin' : ''} />
                    </button>
                    <button className="icon-btn" title="Disconnect" onClick={() => disconnect(p)} aria-label="Disconnect"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <h3 style={{ margin: '28px 0 12px' }}>Bots & messaging</h3>
      <div className="team-cards">
        {BOT_HUB_TOOLS.map((t) => (
          <Link key={t.name} to="/bots" className="glass team-card">
            <div className="t-head"><span className="t-icon" style={{ fontSize: 18 }}>{t.icon}</span> {t.name}</div>
            <p className="small muted">{t.description}</p>
            <span className="small row" style={{ color: 'var(--primary)', fontWeight: 600 }}><Bot size={14} /> Set up in Bot Hub</span>
          </Link>
        ))}
      </div>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)}>
        {open && (
          <form onSubmit={save}>
            <h3>{open.icon} Connect {open.name}</h3>
            <p className="muted small" style={{ margin: '4px 0 14px' }}>{open.description}</p>
            <ol className="small muted" style={{ paddingLeft: 18, lineHeight: 1.7, marginBottom: 16 }}>
              {open.help.map((h) => <li key={h}>{h}</li>)}
            </ol>
            {open.fields.map((f) => (
              <div key={f.key} className="field">
                <label className="label">{f.label}</label>
                <input
                  className="input mono"
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  required={!f.secret || !current}
                  placeholder={f.secret && current ? 'Saved — leave blank to keep it' : ''}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            {current?.status === 'error' && <p className="small" style={{ color: 'var(--delta-down)', marginBottom: 12 }}>{current.lastError}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy === open.key}>
              {busy === open.key ? 'Testing connection…' : 'Save & test'}
            </button>
            <p className="small muted" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              <ExternalLink size={12} /> GK only makes a read-only call to check the keys.
            </p>
          </form>
        )}
      </Modal>
    </Page>
  );
}
