import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import AssistantOrb from '../components/AssistantOrb';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../lib/api';

const FEATURES = ['🧠 Claude-powered brain', '🤖 Connect any bot', '✈️ Telegram', '💬 Discord & Slack', '⏰ Smart reminders', '🐍 Python NLP', '🎙️ Voice mode'];
const HEADLINE = 'Your life, on autopilot.'.split(' ');

export default function AuthPage() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState('login');
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
        <AssistantOrb size={150} state={busy ? 'thinking' : 'idle'} />
        <h1>
          {HEADLINE.map((w, i) => (
            <motion.span
              key={i}
              className={i >= 2 ? 'gradient-text' : ''}
              style={{ display: 'inline-block', marginRight: '0.25em' }}
              initial={{ opacity: 0, y: 30, rotateX: -60 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.2 + i * 0.12, type: 'spring', stiffness: 120 }}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p className="muted" style={{ maxWidth: 460, fontSize: 17 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          One assistant for your tasks, notes and reminders — with every bot you own plugged in.
        </motion.p>
        <div className="feature-pills">
          {FEATURES.map((f, i) => (
            <motion.span key={f} className="badge" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 + i * 0.07, type: 'spring' }}>
              {f}
            </motion.span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
        <motion.div className="auth-card glass" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
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
