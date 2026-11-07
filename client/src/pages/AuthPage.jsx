import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import ParticleSphere from '../components/ParticleSphere';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../lib/api';

const HEADLINE = 'Your life, on autopilot.'.split(' ');

export default function AuthPage() {
  const { authenticate } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, payload = form) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authenticate(mode === 'register' && payload === form ? 'register' : 'login', payload);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key, Icon, props) => (
    <div className="field" style={{ position: 'relative' }}>
      <Icon size={17} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
      <input className="input" style={{ paddingLeft: 42 }} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required {...props} />
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        {/* Orbit stage: the particle sphere with GK's work floating around it. */}
        <div className="orbit-stage">
          <div className="orbit-sphere">
            <ParticleSphere size={420} state={busy ? 'thinking' : 'idle'} />
          </div>

          <motion.div className="orbit-item" style={{ left: '2%', top: '6%' }} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, type: 'spring' }}>
            <motion.div className="pill-bubble" style={{ transform: 'rotate(-3deg)' }} animate={{ y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              Why are my invoices paid late?
            </motion.div>
          </motion.div>

          <motion.div className="orbit-item" style={{ left: '0%', top: '42%', width: 272 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, type: 'spring' }}>
            <motion.div className="float-card" style={{ padding: 18, textAlign: 'left' }} animate={{ y: [0, 6, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
              <span className="accent-dot">✦</span>
              <p style={{ margin: '12px 0 14px', fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
                Not a one-off: <strong style={{ color: 'var(--text)' }}>Bloom Studio</strong> pays <strong style={{ color: 'var(--text)' }}>3× later</strong> than your other clients. Terms are 15 days, they pay in 41.
              </p>
              <div className="float-card" style={{ padding: '12px 14px', background: 'var(--surface-2)', boxShadow: 'none' }}>
                <div className="row small" style={{ marginBottom: 10 }}>
                  <span className="muted">Bloom Studio · days to pay</span><span className="spacer" />
                  <span className="mono-num" style={{ color: 'var(--warning)', fontWeight: 700 }}>41 d</span>
                </div>
                <div className="range-track">
                  <div className="range-band" style={{ left: '8%', width: '22%' }} />
                  <div className="range-mark" style={{ left: '68%' }} />
                </div>
                <div className="row mono-num" style={{ fontSize: 10.5, marginTop: 8, color: 'var(--muted)' }}>
                  <span>0</span><span style={{ marginLeft: '6%', color: 'var(--primary)' }}>terms 5–18</span><span className="spacer" /><span style={{ color: 'var(--warning)' }}>Bloom</span><span className="spacer" /><span>60 d</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div className="orbit-item" style={{ right: '0%', top: '10%', width: 268 }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, type: 'spring' }}>
            <motion.div className="float-card" style={{ padding: 18, textAlign: 'left', transform: 'rotate(2.4deg)' }} animate={{ y: [0, -7, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--primary)' }}>✦</span><strong>Suggested follow-up</strong><span className="spacer" /><span className="small muted">Finance</span>
              </div>
              <div className="change-row"><span style={{ flex: 1 }}>Reminder</span><span className="from mono-num">none</span>→<span className="to mono-num">Mon 10:00</span></div>
              <div className="change-row"><span style={{ flex: 1 }}>WhatsApp note</span><span className="from mono-num">off</span>→<span className="to mono-num">draft</span></div>
              <div className="change-row"><span style={{ flex: 1 }}>Invoice terms</span><span className="from mono-num">15 d</span>→<span className="to mono-num">7 d</span></div>
              <div className="btn btn-primary" style={{ width: '100%', marginTop: 12, pointerEvents: 'none' }}>✦ Apply</div>
            </motion.div>
          </motion.div>

          <motion.div className="orbit-item row" style={{ right: '0%', top: '70%', gap: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}>
            <span className="chip">Show overdue invoices</span>
            <span className="chip">Compare clients</span>
          </motion.div>

          <motion.div className="orbit-greeting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <h1>
              {HEADLINE.map((w, i) => (
                <span key={i} className={i >= 2 ? 'gradient-text' : ''} style={{ marginRight: '0.25em' }}>{w}</span>
              ))}
            </h1>
            <p className="muted" style={{ marginTop: 8 }}>One assistant for your tasks, money, content and every bot you own.</p>
          </motion.div>
        </div>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
        <motion.div className="auth-card glass" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
          <Link to="/welcome" className="land-brand" style={{ marginBottom: 22, fontSize: 12 }}><span className="land-sigil" style={{ width: 28, height: 28, fontSize: 11 }}>GK</span>Agentic AI</Link>
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 style={{ fontSize: 28 }}>{mode === 'login' ? 'Welcome back' : 'Create your assistant'}</h2>
              <p className="muted" style={{ margin: '6px 0 22px' }}>{mode === 'login' ? 'Sign in to continue' : 'It takes 10 seconds'}</p>
              <form onSubmit={submit}>
                {mode === 'register' && field('name', User, { placeholder: 'Your name', autoComplete: 'name' })}
                {field('email', Mail, { type: 'email', placeholder: 'Email', autoComplete: 'email' })}
                {field('password', Lock, { type: 'password', placeholder: 'Password (min 6 chars)', minLength: 6, autoComplete: mode === 'login' ? 'current-password' : 'new-password' })}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} disabled={busy}>
                  {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17} />
                </button>
              </form>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={() => submit(null, { email: 'demo@assistant.dev', password: 'demo1234' })}>
                <Sparkles size={16} /> Try the demo account
              </button>
              <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
                {mode === 'login' ? 'New here? ' : 'Already have an account? '}
                <button style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
                  {mode === 'login' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
