import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Play, Plug, ScrollText, Pencil, Trash2, Copy, Check, RefreshCw, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { Page, Modal, Switch, Tabs, Empty, stagger, rise } from '../components/ui';
import { useSocketEvent } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';
import { timeAgo } from '../lib/format';

const TYPE_INFO = {
  builtin: { emoji: '🧩', label: 'Built-in skill' },
  ai: { emoji: '🧠', label: 'AI persona' },
  webhook: { emoji: '🔗', label: 'My own bot (webhook)' },
  telegram: { emoji: '✈️', label: 'Telegram' },
  discord: { emoji: '🎮', label: 'Discord' },
  slack: { emoji: '💼', label: 'Slack' },
};
const EMOJIS = ['🤖', '🦾', '🧠', '🛰️', '🐍', '🦉', '🌦️', '🧮', '📚', '🎧', '💼', '🎮', '✈️', '🔮', '🐙', '⚡'];
const COLORS = ['#4f8dff', '#2fd39a', '#94a3b8', '#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#fb7185'];
const SKILL_INFO = { calculator: 'Math expressions', weather: 'Live weather (Open-Meteo)', wikipedia: 'Wikipedia summaries', joke: 'Random jokes', echo: 'Echo back (testing)' };

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const blank = { type: '', name: '', handle: '', avatar: '🤖', color: '#4f8dff', description: '', triggers: '', notify: false, config: {} };

function CopyBox({ text, mono = true }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`code-block ${mono ? 'mono' : ''}`}>
      <button
        className="icon-btn"
        style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30 }}
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <div style={{ paddingRight: 30 }}>{text}</div>
    </div>
  );
}

const verifySnippet = `// Node.js — verify a request from your assistant
import crypto from 'node:crypto';
const expected = 'sha256=' + crypto.createHmac('sha256', BOT_API_KEY)
  .update(rawBody).digest('hex');
if (req.headers['x-pa-signature'] !== expected) return res.status(401).end();
res.json({ reply: \`You said: \${JSON.parse(rawBody).message}\` });`;

const pythonSnippet = `# Python — talk to your assistant from any bot
import requests
r = requests.post(INBOUND_URL, headers={"X-Bot-Key": BOT_API_KEY},
                  json={"text": "remind me to stretch in 10 minutes", "sessionId": "chat-42"})
print(r.json()["reply"])`;

function ConfigFields({ form, setForm, meta }) {
  const cfg = form.config || {};
  const set = (k, v) => setForm({ ...form, config: { ...cfg, [k]: v } });
  switch (form.type) {
    case 'builtin':
      return (
        <div className="field">
          <label className="label">Skill</label>
          <div className="type-grid">
            {meta.skills.map((s) => (
              <button type="button" key={s} className={`type-option ${cfg.skill === s ? 'sel' : ''}`} onClick={() => set('skill', s)}>
                <div className="t-name">{s}</div>
                <div className="t-desc">{SKILL_INFO[s]}</div>
              </button>
            ))}
          </div>
        </div>
      );
    case 'ai':
      return (
        <div className="field">
          <label className="label">Personality & instructions</label>
          <textarea className="textarea" style={{ minHeight: 140 }} value={cfg.systemPrompt || ''} placeholder="You are Chef, a friendly cooking expert. Suggest quick recipes with ingredients the user already has…" onChange={(e) => set('systemPrompt', e.target.value)} />
          <p className="small muted" style={{ marginTop: 6 }}>Powered by any AI (Claude, OpenAI, Gemini, Groq…) once you add a key in Settings.</p>
        </div>
      );
    case 'webhook':
      return (
        <>
          <div className="field">
            <label className="label">Your bot's endpoint URL</label>
            <input className="input" placeholder="https://my-bot.example.com/assistant" value={cfg.url || ''} onChange={(e) => set('url', e.target.value)} />
          </div>
          <p className="small muted">We POST <code>{'{ message, user, bot, conversationId }'}</code> signed with <code>X-PA-Signature</code>. Reply with <code>{'{ "reply": "..." }'}</code>.</p>
        </>
      );
    case 'telegram':
      return (
        <>
          <div className="field">
            <label className="label">Bot token from @BotFather</label>
            <input className="input mono" placeholder="123456789:AA..." value={cfg.token || ''} onChange={(e) => set('token', e.target.value)} />
          </div>
          <ol className="small muted" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Open Telegram → <b>@BotFather</b> → <code>/newbot</code> and copy the token.</li>
            <li>Paste it here and save.</li>
            <li>Send <code>/start</code> to your bot — that chat becomes linked to your assistant.</li>
          </ol>
        </>
      );
    case 'discord':
    case 'slack':
      return (
        <div className="field">
          <label className="label">{form.type === 'discord' ? 'Discord' : 'Slack'} incoming webhook URL</label>
          <input className="input mono" placeholder={form.type === 'discord' ? 'https://discord.com/api/webhooks/…' : 'https://hooks.slack.com/services/…'} value={cfg.webhookUrl || ''} onChange={(e) => set('webhookUrl', e.target.value)} />
        </div>
      );
    default:
      return null;
  }
}

function BotWizard({ open, onClose, meta, editing, onSaved }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    if (editing) {
      setForm({ ...editing, triggers: (editing.triggers || []).join(', ') });
      setStep(1);
    } else {
      setForm(blank);
      setStep(0);
    }
  }, [open, editing]);

  const save = async () => {
    setBusy(true);
    const payload = { ...form, triggers: form.triggers.split(',').map((t) => t.trim()).filter(Boolean) };
    try {
      if (editing) {
        await api.patch(`/bots/${editing._id}`, payload);
        toast('Bot updated', { type: 'success' });
        onSaved();
        onClose();
      } else {
        const { data } = await api.post('/bots', payload);
        if (data.warning) toast('Heads up', { type: 'error', body: data.warning, duration: 8000 });
        setCreated(data);
        onSaved();
      }
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const canNext = step === 0 ? form.type : step === 1 ? form.name && form.handle : true;

  return (
    <Modal open={open} onClose={onClose}>
      {created ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div style={{ fontSize: 56, textAlign: 'center' }} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
            {created.bot.avatar}
          </motion.div>
          <h3 style={{ textAlign: 'center' }}>{created.bot.name} is connected! 🎉</h3>
          <p className="muted small" style={{ textAlign: 'center', margin: '6px 0 18px' }}>
            Mention it in chat with <code>@{created.bot.handle}</code>. External bots can talk to your assistant using these credentials:
          </p>
          <label className="label">API key (keep it secret)</label>
          <CopyBox text={created.credentials.apiKey} />
          <label className="label" style={{ marginTop: 12 }}>Inbound endpoint</label>
          <CopyBox text={created.credentials.inboundUrl} />
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={onClose}>Done</button>
        </motion.div>
      ) : (
        <>
          <h3>{editing ? `Edit ${editing.name}` : 'Create a bot'}</h3>
          <p className="muted small">{['Choose what kind of bot', 'Give it an identity', 'Connect & configure'][step]}</p>
          <div className="steps">
            {[0, 1, 2].map((i) => (
              <div key={i} className="step"><motion.div initial={false} animate={{ width: step >= i ? '100%' : '0%' }} /></div>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
              {step === 0 && (
                <div className="type-grid">
                  {meta.types.map((t) => (
                    <motion.button
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      key={t}
                      className={`type-option ${form.type === t ? 'sel' : ''}`}
                      onClick={() => setForm({ ...form, type: t, avatar: TYPE_INFO[t].emoji, config: {} })}
                    >
                      <div className="t-emoji">{TYPE_INFO[t].emoji}</div>
                      <div className="t-name">{TYPE_INFO[t].label}</div>
                      <div className="t-desc">{meta.descriptions[t]}</div>
                    </motion.button>
                  ))}
                </div>
              )}
              {step === 1 && (
                <>
                  <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label">Name</label>
                      <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, handle: editing ? form.handle : slug(e.target.value) })} placeholder="e.g. Chef" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label">Handle</label>
                      <input className="input" value={form.handle} onChange={(e) => setForm({ ...form, handle: slug(e.target.value) })} placeholder="chef" />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Avatar</label>
                    <div className="emoji-pick">
                      {EMOJIS.map((e) => (
                        <button type="button" key={e} className={form.avatar === e ? 'sel' : ''} onClick={() => setForm({ ...form, avatar: e })}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Color</label>
                    <div className="color-dots">
                      {COLORS.map((c) => (
                        <button type="button" key={c} className={`color-dot ${form.color === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} aria-label={c} />
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Description</label>
                    <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this bot do?" />
                  </div>
                  <div className="field">
                    <label className="label">Trigger words (optional, comma separated)</label>
                    <input className="input" value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} placeholder="recipe, cook" />
                    <p className="small muted" style={{ marginTop: 6 }}>Messages containing these words go to this bot even without an @mention.</p>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <ConfigFields form={form} setForm={setForm} meta={meta} />
                  {['telegram', 'discord', 'slack'].includes(form.type) && (
                    <div className="row" style={{ marginTop: 8 }}>
                      <Switch on={form.notify} onChange={(v) => setForm({ ...form, notify: v })} label="Notify" />
                      <span className="small">Deliver my reminders through this bot</span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="row" style={{ marginTop: 22 }}>
            {step > 0 && !(editing && step === 1) && (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
            )}
            <div className="spacer" />
            {step < 2 ? (
              <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} /></button>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={save}><Zap size={16} /> {busy ? 'Connecting…' : editing ? 'Save changes' : 'Create & connect'}</button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function TestConsole({ bot, onClose }) {
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setHistory([]), [bot]);
  const run = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setBusy(true);
    const message = msg;
    setMsg('');
    try {
      const { data } = await api.post(`/bots/${bot._id}/test`, { message });
      setHistory((h) => [...h, { message, ...data }]);
    } catch (err) {
      setHistory((h) => [...h, { message, reply: errMsg(err), status: 'error' }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={Boolean(bot)} onClose={onClose}>
      {bot && (
        <>
          <h3>{bot.avatar} Test {bot.name}</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>Messages go straight to the bot, bypassing the assistant.</p>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
            {history.map((h, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 12 }}>
                <div className="small muted">→ {h.message}</div>
                <div className="code-block" style={{ marginTop: 4, borderColor: h.status === 'error' ? 'var(--danger)' : undefined }}>{h.reply}</div>
                {h.latencyMs !== undefined && <div className="small muted" style={{ marginTop: 2 }}>{h.status} · {h.latencyMs} ms</div>}
              </motion.div>
            ))}
          </div>
          <form className="row" onSubmit={run}>
            <input className="input" autoFocus value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Say something to the bot…" />
            <button className="btn btn-primary" disabled={busy}><Play size={16} /></button>
          </form>
        </>
      )}
    </Modal>
  );
}

function ConnectPanel({ bot, onClose }) {
  const [creds, setCreds] = useState(null);
  const toast = useToast();
  useEffect(() => {
    setCreds(null);
    if (bot) api.get(`/bots/${bot._id}/credentials`).then((r) => setCreds(r.data));
  }, [bot]);
  const rotate = async () => {
    const { data } = await api.post(`/bots/${bot._id}/rotate-key`);
    setCreds(data);
    toast('API key rotated', { type: 'success' });
  };
  return (
    <Modal open={Boolean(bot)} onClose={onClose}>
      {bot && (
        <>
          <h3>{bot.avatar} Connect {bot.name}</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>Let any external bot or script talk to your assistant as you.</p>
          {!creds ? <p className="muted">Loading…</p> : (
            <>
              <label className="label">API key</label>
              <CopyBox text={creds.apiKey} />
              <label className="label" style={{ marginTop: 12 }}>Inbound endpoint</label>
              <CopyBox text={creds.inboundUrl} />
              <label className="label" style={{ marginTop: 12 }}>Try it with curl</label>
              <CopyBox text={creds.curl} />
              <label className="label" style={{ marginTop: 12 }}>From Python</label>
              <CopyBox text={pythonSnippet} />
              {bot.type === 'webhook' && (
                <>
                  <label className="label" style={{ marginTop: 12 }}>Verifying our requests on your webhook</label>
                  <CopyBox text={verifySnippet} />
                </>
              )}
              {bot.type === 'telegram' && (
                <p className="small" style={{ marginTop: 12 }}>
                  {bot.config?.chatId ? `✅ Linked to Telegram chat ${bot.config.chatId}` : '⏳ Waiting for you to send /start to'} {bot.config?.username && <b>@{bot.config.username}</b>}
                </p>
              )}
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={rotate}><RefreshCw size={15} /> Rotate key</button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function LogsPanel({ bot, onClose }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    setLogs([]);
    if (bot) api.get(`/bots/${bot._id}/logs`).then((r) => setLogs(r.data));
  }, [bot]);
  return (
    <Modal open={Boolean(bot)} onClose={onClose}>
      {bot && (
        <>
          <h3>{bot.avatar} {bot.name} activity</h3>
          <p className="muted small" style={{ marginBottom: 12 }}>Last 50 events</p>
          {!logs.length && <Empty emoji="📭" title="No activity yet" />}
          {logs.map((l) => (
            <div key={l._id} className="log-row">
              <span>{l.direction === 'in' ? '📥' : l.status === 'error' ? '❌' : '📤'}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.input}</div>
                {l.output && <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {l.output}</div>}
              </div>
              <span className="muted">{l.latencyMs != null ? `${l.latencyMs}ms · ` : ''}{timeAgo(l.createdAt)}</span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

export default function Bots() {
  const [bots, setBots] = useState([]);
  const [meta, setMeta] = useState({ types: [], skills: [], descriptions: {} });
  const [filter, setFilter] = useState('all');
  const [wizard, setWizard] = useState({ open: false, editing: null });
  const [testBot, setTestBot] = useState(null);
  const [connectBot, setConnectBot] = useState(null);
  const [logsBot, setLogsBot] = useState(null);
  const [pulse, setPulse] = useState({});
  const toast = useToast();

  const load = useCallback(() => api.get('/bots').then((r) => setBots(r.data)), []);
  useEffect(() => {
    load();
    api.get('/bots/meta').then((r) => setMeta(r.data));
  }, [load]);
  useSocketEvent('bot:activity', ({ botId }) => {
    setPulse((p) => ({ ...p, [botId]: Date.now() }));
    load();
  });

  const patch = async (bot, body) => {
    setBots((bs) => bs.map((b) => (b._id === bot._id ? { ...b, ...body } : b)));
    try {
      await api.patch(`/bots/${bot._id}`, body);
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
      load();
    }
  };

  const remove = async (bot) => {
    if (!confirm(`Delete ${bot.name}? This cannot be undone.`)) return;
    await api.delete(`/bots/${bot._id}`);
    toast('Bot deleted', { type: 'info', body: bot.name });
    load();
  };

  const groups = { all: () => true, builtin: (b) => b.type === 'builtin', ai: (b) => b.type === 'ai', connected: (b) => ['webhook', 'telegram', 'discord', 'slack'].includes(b.type) };
  const shown = bots.filter(groups[filter]);

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Bot Hub</h1>
          <p>Create bots, connect your existing ones, and let {bots.length ? 'all of them' : 'them'} work together through your assistant.</p>
        </div>
        <div className="row-wrap">
          <Tabs id="botf" value={filter} onChange={setFilter} tabs={[{ value: 'all', label: 'All' }, { value: 'builtin', label: 'Skills' }, { value: 'ai', label: 'AI' }, { value: 'connected', label: 'Connected' }]} />
          <button className="btn btn-primary" onClick={() => setWizard({ open: true, editing: null })}><Plus size={16} /> Create bot</button>
        </div>
      </div>

      <motion.div className="grid grid-cards" variants={stagger} initial="initial" animate="animate" key={filter}>
        {shown.map((b) => (
          <motion.div key={b._id} variants={rise} layout className="glass bot-card" whileHover={{ y: -4, rotateX: 4, rotateY: -3, transformPerspective: 900 }} style={{ opacity: b.enabled ? 1 : 0.55 }}>
            <div className="glow" style={{ background: b.color }} />
            <div className="row">
              <motion.div
                key={pulse[b._id]}
                className="bot-avatar"
                style={{ background: `${b.color}22` }}
                animate={pulse[b._id] ? { scale: [1, 1.25, 1], boxShadow: [`0 0 0 0 ${b.color}`, `0 0 0 14px transparent`] } : {}}
                transition={{ duration: 0.6 }}
              >
                {b.avatar}
              </motion.div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{b.name}</div>
                <div className="small muted">@{b.handle}</div>
              </div>
              <Switch on={b.enabled} onChange={(v) => patch(b, { enabled: v })} label="Enabled" />
            </div>
            <div className="row-wrap">
              <span className="badge">{TYPE_INFO[b.type]?.emoji} {b.type === 'builtin' ? b.config?.skill : TYPE_INFO[b.type]?.label}</span>
              {b.triggers?.slice(0, 3).map((t) => <span key={t} className="badge">#{t}</span>)}
            </div>
            <p className="small muted" style={{ minHeight: 36 }}>{b.description || 'No description'}</p>
            {['telegram', 'discord', 'slack'].includes(b.type) && (
              <div className="row small">
                <Switch on={b.notify} onChange={(v) => patch(b, { notify: v })} label="Notifications" /> Send reminders here
              </div>
            )}
            <div className="row small muted">
              <span>💬 {b.stats?.messages || 0}</span>
              {b.stats?.errors > 0 && <span style={{ color: 'var(--danger)' }}>⚠️ {b.stats.errors}</span>}
              <span className="spacer" />
              <span>{b.stats?.lastActiveAt ? timeAgo(b.stats.lastActiveAt) : 'idle'}</span>
            </div>
            <div className="row" style={{ gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <button className="icon-btn" title="Test" onClick={() => setTestBot(b)}><Play size={16} /></button>
              <button className="icon-btn" title="Connect / API" onClick={() => setConnectBot(b)}><Plug size={16} /></button>
              <button className="icon-btn" title="Activity logs" onClick={() => setLogsBot(b)}><ScrollText size={16} /></button>
              <button className="icon-btn" title="Edit" onClick={() => setWizard({ open: true, editing: b })}><Pencil size={16} /></button>
              <span className="spacer" />
              <button className="icon-btn" title="Delete" onClick={() => remove(b)}><Trash2 size={16} /></button>
            </div>
          </motion.div>
        ))}
        <motion.button variants={rise} className="glass bot-card" style={{ alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', minHeight: 260 }} whileHover={{ scale: 1.02 }} onClick={() => setWizard({ open: true, editing: null })}>
          <motion.div animate={{ rotate: [0, 90, 0] }} transition={{ duration: 4, repeat: Infinity }} className="bot-avatar" style={{ background: 'var(--grad-soft)' }}><Plus /></motion.div>
          <div style={{ fontWeight: 600 }}>Add a bot</div>
          <div className="small muted">Skill · AI · Webhook · Telegram · Discord · Slack</div>
        </motion.button>
      </motion.div>

      <BotWizard open={wizard.open} editing={wizard.editing} meta={meta} onClose={() => setWizard({ open: false, editing: null })} onSaved={load} />
      <TestConsole bot={testBot} onClose={() => setTestBot(null)} />
      <ConnectPanel bot={connectBot} onClose={() => setConnectBot(null)} />
      <LogsPanel bot={logsBot} onClose={() => setLogsBot(null)} />
    </Page>
  );
}
