import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListTodo, StickyNote, Bell, Bot, ArrowRight, Send, CheckCircle2 } from 'lucide-react';
import AssistantOrb from '../components/AssistantOrb';
import { Page, AnimatedNumber, rise, stagger, Empty } from '../components/ui';
import { useAuth, useSocketEvent } from '../context/AuthContext';
import { api } from '../lib/api';
import { greeting, timeUntil, timeAgo } from '../lib/format';

function Ring({ value, total }) {
  const pct = total ? value / total : 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg width="110" height="110" className="ring-progress">
      <defs>
        <linearGradient id="ringGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#4f8dff" />
          <stop offset="1" stopColor="#9cc0ff" />
        </linearGradient>
      </defs>
      <circle cx="55" cy="55" r={r} stroke="var(--surface-2)" strokeWidth="10" fill="none" />
      <motion.circle cx="55" cy="55" r={r} stroke="url(#ringGrad)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.4, ease: 'easeOut' }} />
    </svg>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [quick, setQuick] = useState('');

  const load = useCallback(() => api.get('/dashboard').then((r) => setData(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('data:changed', load);
  useSocketEvent('bot:activity', load);

  if (!data) return <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}><AssistantOrb size={70} state="thinking" /></div>;

  const totalTasks = data.tasks.todo + data.tasks.in_progress + data.tasks.done;
  const maxAct = Math.max(1, ...data.activity.map((a) => a.count));
  const stats = [
    { label: 'Open tasks', value: data.tasks.todo + data.tasks.in_progress, icon: ListTodo, to: '/tasks' },
    { label: 'Notes', value: data.notes, icon: StickyNote, to: '/notes' },
    { label: 'Upcoming reminders', value: data.upcoming.length, icon: Bell, to: '/reminders' },
    { label: 'Connected bots', value: data.bots.filter((b) => b.enabled).length, icon: Bot, to: '/bots' },
  ];

  return (
    <Page>
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid">
        <motion.div variants={rise} className="glass hero">
          <AssistantOrb size={110} state="idle" onClick={() => navigate('/chat')} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="muted">{greeting()}, {user.name.split(' ')[0]} 👋</p>
            <h1>I'm <span className="gradient-text">{user.assistantName}</span>. What's next?</h1>
            <form
              className="composer-box"
              style={{ marginTop: 18, maxWidth: 560 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (quick.trim()) navigate('/chat', { state: { prompt: quick } });
              }}
            >
              <input className="input" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }} value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Try "remind me to stretch in 30 minutes"' />
              <button className="btn btn-primary" aria-label="Ask"><Send size={16} /></button>
            </form>
            <div className="row-wrap" style={{ marginTop: 14 }}>
              {Object.entries(data.services).map(([k, on]) => (
                <span key={k} className="badge"><span className={`dot ${on ? 'on' : 'off'}`} /> {k === 'claude' ? 'AI brain' : k === 'python' ? 'Python NLP' : 'MongoDB'}</span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-4">
          {stats.map((s) => (
            <motion.div key={s.label} variants={rise} whileHover={{ y: -4, rotateX: 4, rotateY: -3, transformPerspective: 900 }}>
              <Link to={s.to} className="glass stat" style={{ display: 'block' }}>
                <div className="stat-icon"><s.icon size={20} /></div>
                <div className="value"><AnimatedNumber value={s.value} /></div>
                <div className="label-s">{s.label}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-2">
          <motion.div variants={rise} className="glass card">
            <div className="card-title">Activity <span className="sub">messages · last 7 days</span></div>
            <div className="bars">
              {data.activity.map((a, i) => (
                <div key={a.day + i} className="bar-col">
                  <span className="small muted">{a.count || ''}</span>
                  <motion.div className="bar" initial={{ height: 0 }} animate={{ height: `${(a.count / maxAct) * 100}%` }} transition={{ delay: 0.3 + i * 0.07, type: 'spring', stiffness: 90 }} />
                  <span className="small muted">{a.day}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={rise} className="glass card">
            <div className="card-title">Progress <span className="sub">{data.tasks.done}/{totalTasks} tasks done</span></div>
            <div className="row" style={{ gap: 24 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Ring value={data.tasks.done} total={totalTasks} />
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 20 }}>
                  {totalTasks ? Math.round((data.tasks.done / totalTasks) * 100) : 0}%
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {data.recentTasks.length ? data.recentTasks.map((t) => (
                  <div key={t._id} className="list-row">
                    <CheckCircle2 size={16} className="muted" />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span className={`badge ${t.priority}`}>{t.priority}</span>
                  </div>
                )) : <p className="muted">All clear ✨</p>}
              </div>
            </div>
          </motion.div>

          <motion.div variants={rise} className="glass card">
            <div className="card-title">Upcoming reminders <Link to="/reminders" className="small muted row">All <ArrowRight size={14} /></Link></div>
            {data.upcoming.length ? data.upcoming.map((r) => (
              <div key={r._id} className="list-row">
                <span>⏰</span>
                <span style={{ flex: 1 }}>{r.text}</span>
                <span className="badge">{timeUntil(r.remindAt)}</span>
              </div>
            )) : <Empty emoji="🌙" title="Nothing scheduled" />}
          </motion.div>

          <motion.div variants={rise} className="glass card">
            <div className="card-title">Bot fleet <Link to="/bots" className="small muted row">Manage <ArrowRight size={14} /></Link></div>
            {data.bots.slice(0, 5).map((b) => (
              <div key={b._id} className="list-row">
                <span style={{ fontSize: 20 }}>{b.avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{b.name} <span className="muted small">@{b.handle}</span></div>
                  <div className="small muted">{b.stats.messages} msgs · {b.stats.lastActiveAt ? timeAgo(b.stats.lastActiveAt) : 'never used'}</div>
                </div>
                <span className={`dot ${b.enabled ? 'on' : 'off'}`} />
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </Page>
  );
}
