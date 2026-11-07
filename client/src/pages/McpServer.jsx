import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Server, KeyRound, Plus, Trash2, Copy, Check, ShieldAlert, Activity } from 'lucide-react';
import { Page, Modal, Switch, Tabs, rise, stagger } from '../components/ui';
import { useSocketEvent } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useSaving } from '../hooks/useSaving';

const TIER_COLOR = { read: 'var(--status-good)', build: 'var(--series-1)', send: 'var(--status-warning)', destructive: 'var(--status-critical)' };

function CopyField({ value, mono = true }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`code-block ${mono ? 'mono' : ''}`}>
      <button
        type="button"
        className="icon-btn"
        style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30 }}
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <div style={{ paddingRight: 32 }}>{value}</div>
    </div>
  );
}

function ConnectSteps({ url }) {
  const [client, setClient] = useState('code');
  const local = /\/\/(localhost|127\.)/.test(url);
  const blocks = {
    code: {
      steps: ['Open a terminal and run:'],
      code: `claude mcp add --transport http --scope user gk "${url}"`,
      after: 'Then run claude mcp list. GK should show as Connected.',
    },
    desktop: local
      ? {
          steps: [
            'Your GK runs on localhost, so Claude Desktop connects through mcp-remote (needs Node.js).',
            'Open Claude Desktop → Settings → Developer → Edit Config, and add this inside "mcpServers" (keep any servers already there):',
          ],
          code: JSON.stringify({ gk: { command: 'npx', args: ['-y', 'mcp-remote', url] } }, null, 2),
          after: 'Save, then quit Claude Desktop fully and reopen it.',
        }
      : {
          steps: ['In Claude (desktop or web): Settings → Connectors → Add custom connector.', 'Name it GK, paste this URL, and leave the OAuth fields empty:'],
          code: url,
          after: 'Then turn on GK in a chat from the tools menu.',
        },
    cursor: { steps: ['Add to ~/.cursor/mcp.json:'], code: JSON.stringify({ mcpServers: { gk: { url } } }, null, 2), after: '' },
    vscode: { steps: ['Add to .vscode/mcp.json in your project:'], code: JSON.stringify({ servers: { gk: { type: 'http', url } } }, null, 2), after: '' },
  };
  const b = blocks[client];
  return (
    <div>
      <Tabs id="mcp-client" value={client} onChange={setClient} tabs={[{ value: 'code', label: 'Claude Code' }, { value: 'desktop', label: 'Claude Desktop' }, { value: 'cursor', label: 'Cursor' }, { value: 'vscode', label: 'VS Code' }]} />
      <div style={{ marginTop: 12 }}>
        {b.steps.map((s) => <p key={s} className="small" style={{ marginBottom: 6, color: 'var(--text-2)' }}>{s}</p>)}
        <CopyField value={b.code} />
        {b.after && <p className="small muted" style={{ marginTop: 8 }}>{b.after}</p>}
      </div>
    </div>
  );
}

export default function McpServer() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [info, setInfo] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [naming, setNaming] = useState(false);
  const [keyName, setKeyName] = useState('Claude Desktop');
  const [saving, run] = useSaving();

  const loadKeys = useCallback(() => api.get('/mcp-admin/keys').then((r) => setKeys(r.data.keys)), []);
  const loadLogs = useCallback(() => api.get('/mcp-admin/logs').then((r) => setLogs(r.data.logs)), []);
  useEffect(() => {
    api.get('/mcp-admin/settings').then((r) => setSettings(r.data));
    api.get('/mcp-admin/connect-info').then((r) => setInfo(r.data));
    loadKeys();
    loadLogs();
  }, [loadKeys, loadLogs]);
  useSocketEvent('mcp:call', () => {
    loadLogs();
    loadKeys();
  });

  const save = async (patch) => {
    try {
      const { data } = await api.put('/mcp-admin/settings', patch);
      setSettings(data);
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  };

  const createKey = run(async () => {
    try {
      const { data } = await api.post('/mcp-admin/keys', { name: keyName });
      setNaming(false);
      setNewKey(data);
      loadKeys();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  });

  const toggleKey = async (k) => {
    setKeys((ks) => ks.map((x) => (x.id === k.id ? { ...x, enabled: !k.enabled } : x)));
    await api.put(`/mcp-admin/keys/${k.id}`, { enabled: !k.enabled });
  };

  const deleteKey = async (k) => {
    if (!confirm(`Delete "${k.name}"? Any app using it stops working immediately.`)) return;
    await api.delete(`/mcp-admin/keys/${k.id}`);
    loadKeys();
  };

  if (!settings) return null;
  const on = settings.masterEnabled;
  const enabledTools = settings.catalog.filter((c) => c.enabled).reduce((n, c) => n + c.tools.length, 0);

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>MCP server</h1>
          <p>Let Claude, Cursor or VS Code read and act on your GK data. You choose exactly which tools they get.</p>
        </div>
      </div>

      <motion.div className="grid" variants={stagger} initial="initial" animate="animate">
        <motion.div variants={rise} className="glass card row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <span className="t-icon" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--grad-soft)', border: '1px solid var(--border)', color: 'var(--primary)' }}><Server size={20} /></span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>MCP access is {on ? 'on' : 'off'}</div>
            <div className="small muted">{on ? `${enabledTools} tools available to connected apps · changes apply instantly` : 'Connected apps get nothing until you turn this on.'}</div>
          </div>
          <Switch on={on} onChange={(v) => save({ masterEnabled: v })} label="MCP access" />
        </motion.div>

        <div className="grid grid-2">
          <motion.div variants={rise} className="glass card">
            <div className="card-title">What connected apps may do</div>
            {settings.catalog.map((c) => (
              <div key={c.key} className="list-row" style={{ alignItems: 'flex-start', opacity: on ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <span className="pill" style={{ textTransform: 'none' }}><span className="dot" style={{ background: TIER_COLOR[c.tier] }} /> {c.tierLabel}</span>
                  </div>
                  <div className="small muted" style={{ margin: '2px 0 6px' }}>{c.description}</div>
                  <div className="row-wrap" style={{ gap: 4 }}>
                    {c.tools.map((t) => <code key={t} className="mono" style={{ fontSize: 11, padding: '1px 6px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>{t}</code>)}
                  </div>
                </div>
                <Switch on={c.enabled} onChange={(v) => save({ categories: { [c.key]: v } })} label={c.label} />
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 10 }}><ShieldAlert size={13} style={{ verticalAlign: -2 }} /> Only "Reads only" groups start on. Turn on edit, send and delete groups one at a time, once you trust the app.</p>
          </motion.div>

          <div className="grid" style={{ alignContent: 'start' }}>
            <motion.div variants={rise} className="glass card">
              <div className="card-title">
                <span className="row"><KeyRound size={17} /> Keys</span>
                <button className="btn btn-primary" onClick={() => setNaming(true)}><Plus size={15} /> New key</button>
              </div>
              {!keys.length && <p className="small muted">No keys yet. Create one for each app you connect, so you can switch them off separately.</p>}
              {keys.map((k) => (
                <div key={k.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{k.name}</div>
                    <div className="small muted mono">{k.display} · {k.lastUsedAt ? `used ${timeAgo(k.lastUsedAt)}` : 'never used'}</div>
                  </div>
                  <Switch on={k.enabled} onChange={() => toggleKey(k)} label={`Enable ${k.name}`} />
                  <button className="icon-btn" onClick={() => deleteKey(k)} aria-label={`Delete ${k.name}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </motion.div>

            <motion.div variants={rise} className="glass card">
              <div className="card-title">Connect an app</div>
              {info && <ConnectSteps url={info.urlTemplate} />}
              <p className="small muted" style={{ marginTop: 10 }}>Replace <code>&lt;your-key&gt;</code> with a key. Creating a key shows these steps with the key already filled in.</p>
            </motion.div>

            <motion.div variants={rise} className="glass card">
              <div className="card-title"><span className="row"><Activity size={17} /> Recent calls</span><span className="sub">last 50</span></div>
              {!logs.length && <p className="small muted">No calls yet.</p>}
              <AnimatePresence initial={false}>
                {logs.slice(0, 12).map((l) => (
                  <motion.div key={l._id} className="list-row small" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                    <span className="dot" style={{ background: l.ok ? 'var(--status-good)' : 'var(--status-critical)', flexShrink: 0 }} />
                    <code className="mono" style={{ fontSize: 12 }}>{l.tool}</code>
                    <span className="muted" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ok ? l.keyName : l.error}</span>
                    <span className="muted">{timeAgo(l.createdAt)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <Modal open={naming} onClose={() => setNaming(false)}>
        <form onSubmit={createKey}>
          <h3>New MCP key</h3>
          <p className="small muted" style={{ margin: '4px 0 14px' }}>Name it after the app that will use it.</p>
          <input className="input" autoFocus value={keyName} onChange={(e) => setKeyName(e.target.value)} maxLength={80} />
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={saving}>{saving ? 'Creating…' : 'Create key'}</button>
        </form>
      </Modal>

      <Modal open={Boolean(newKey)} onClose={() => setNewKey(null)}>
        {newKey && (
          <div>
            <h3>{newKey.key.name} is ready</h3>
            <p className="small" style={{ margin: '6px 0 12px', color: 'var(--delta-down)', fontWeight: 600 }}>
              <ShieldAlert size={14} style={{ verticalAlign: -2 }} /> This URL is a password. Anyone who has it can use the tools you switched on. It is shown only once.
            </p>
            <label className="label">Connection URL</label>
            <CopyField value={newKey.connectUrl} />
            {!on && <p className="small" style={{ marginTop: 10 }}>MCP access is off. Turn it on at the top of this page before connecting.</p>}
            <div style={{ marginTop: 16 }}><ConnectSteps url={newKey.connectUrl} /></div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => setNewKey(null)}>I've copied it</button>
          </div>
        )}
      </Modal>
    </Page>
  );
}
