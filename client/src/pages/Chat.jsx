import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Plus, Send, Mic, MicOff, Trash2, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import AssistantOrb from '../components/AssistantOrb';
import { TypingDots } from '../components/ui';
import { useAuth, useSocketEvent } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useVoice } from '../hooks/useVoice';
import { api, errMsg } from '../lib/api';
import { timeAgo } from '../lib/format';

const SUGGESTIONS = [
  'What can you do?',
  'Add task prepare slides urgent',
  'Remind me to drink water in 1 minute',
  'Show my tasks',
  '@weather in Chennai',
  '@calc (24 * 7) / 3',
  'Tell me a joke',
  'Analyze: I love the new design but the app is slow',
];

const TOOL_LABELS = {
  create_task: '✅ task created', complete_task: '🏁 task completed', create_note: '📝 note saved', set_reminder: '⏰ reminder set',
  call_bot: '🤖 bot called', list_tasks: '📋 tasks read', search_notes: '🔎 notes searched', list_reminders: '⏰ reminders read',
  list_bots: '🤖 bots listed', analyze_text: '🧠 analyzed',
};

// Single newlines become Markdown line breaks (except before list items / blank lines).
const softBreaks = (t) => t.replace(/\n(?!\n|\s*[-*] |\s*\d+\. )/g, '  \n');

function Message({ m, user }) {
  const isUser = m.role === 'user';
  const isBot = m.role === 'bot';
  return (
    <motion.div
      layout
      className={`msg ${m.role}`}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <div
        className="msg-avatar"
        style={{
          background: isUser ? 'var(--grad)' : isBot ? `${m.meta?.color || '#8b5cf6'}33` : 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: '#fff',
        }}
      >
        {isUser ? user.name[0].toUpperCase() : isBot ? m.meta?.avatar || '🤖' : <AssistantOrb size={14} />}
      </div>
      <div style={{ minWidth: 0 }}>
        {isBot && (
          <div className="bot-tag" style={{ color: m.meta?.color }}>
            {m.meta?.botName} <span className="muted">@{m.meta?.botHandle}</span>
            {m.meta?.status === 'error' && <span className="chip-action err">error</span>}
          </div>
        )}
        <div className="bubble">
          {isUser ? m.content : <ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{softBreaks(m.content)}</ReactMarkdown>}
        </div>
        {m.meta?.actions?.length > 0 && (
          <div className="msg-meta">
            {m.meta.actions.map((a, i) => (
              <motion.span key={i} className={`chip-action ${a.ok ? '' : 'err'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + i * 0.08, type: 'spring' }}>
                {a.ok ? TOOL_LABELS[a.tool] || a.tool : `⚠️ ${a.tool}`}
              </motion.span>
            ))}
          </div>
        )}
        {isUser && m.meta?.sentiment && m.meta.sentiment.label !== 'neutral' && (
          <div className="msg-meta" style={{ justifyContent: 'flex-end' }}>
            <span className="small muted">{m.meta.sentiment.emoji} {m.meta.sentiment.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const { id } = useParams();
  const { user, socket } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [bots, setBots] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('pa_autospeak') === '1');
  const [mentionIdx, setMentionIdx] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const convoRef = useRef(id);
  convoRef.current = id;

  const send = useRef(null);
  const voice = useVoice({
    onResult: (t) => send.current?.(t),
    onError: (msg) => toast('Microphone problem', { type: 'error', body: msg, duration: 9000 }),
  });

  const loadConversations = useCallback(() => api.get('/chat/conversations').then((r) => setConversations(r.data)), []);

  useEffect(() => {
    loadConversations();
    api.get('/bots').then((r) => setBots(r.data.filter((b) => b.enabled)));
  }, [loadConversations]);

  useEffect(() => {
    if (!id) return setMessages([]);
    api.get(`/chat/conversations/${id}/messages`).then((r) => setMessages(r.data)).catch(() => navigate('/chat'));
  }, [id, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const addMessages = useCallback((incoming) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m._id));
      return [...prev.filter((m) => !m._id.startsWith('tmp-')), ...incoming.filter((m) => !seen.has(m._id))];
    });
  }, []);

  // Messages that arrive from other tabs/channels for the open conversation.
  useSocketEvent('message:new', ({ conversationId, messages: incoming }) => {
    if (conversationId === convoRef.current) addMessages(incoming);
    loadConversations();
  });

  send.current = async (raw) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    setText('');
    setBusy(true);
    setMessages((prev) => [...prev, { _id: `tmp-${Date.now()}`, role: 'user', content, meta: {} }]);
    try {
      const payload = { text: content, conversationId: id };
      const res = socket?.connected
        ? await new Promise((resolve, reject) =>
            socket.timeout(120000).emit('chat:send', payload, (err, r) => (err ? reject(err) : r.ok ? resolve(r) : reject(new Error(r.error))))
          )
        : (await api.post('/chat/message', payload)).data;
      addMessages(res.messages);
      if (!id) navigate(`/chat/${res.conversation._id}`, { replace: true });
      loadConversations();
      if (autoSpeak) voice.speak(res.messages[1].content);
    } catch (e) {
      toast('Message failed', { type: 'error', body: errMsg(e) });
      setMessages((prev) => prev.filter((m) => !m._id.startsWith('tmp-')));
      setText(content);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // Prompt handed over from the dashboard quick-ask box.
  useEffect(() => {
    if (location.state?.prompt) {
      const p = location.state.prompt;
      navigate(location.pathname, { replace: true, state: null });
      send.current(p);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mentionQuery = useMemo(() => {
    const m = text.match(/(?:^|\s)@([a-z0-9_-]*)$/i);
    return m ? m[1].toLowerCase() : null;
  }, [text]);
  const mentionBots = mentionQuery === null ? [] : bots.filter((b) => b.handle.startsWith(mentionQuery)).slice(0, 6);

  const pickMention = (bot) => {
    setText((t) => t.replace(/@([a-z0-9_-]*)$/i, `@${bot.handle} `));
    inputRef.current?.focus();
  };

  const removeConversation = async (cid) => {
    await api.delete(`/chat/conversations/${cid}`);
    if (cid === id) navigate('/chat');
    loadConversations();
  };

  const orbState = voice.listening ? 'listening' : busy ? 'thinking' : voice.speaking ? 'speaking' : 'idle';

  return (
    <div className="chat-layout">
      <motion.div className="glass convo-list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <button className="btn btn-primary" onClick={() => navigate('/chat')} style={{ marginBottom: 8 }}>
          <Plus size={16} /> New chat
        </button>
        <AnimatePresence>
          {conversations.map((c) => (
            <motion.div key={c._id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="row" style={{ gap: 2 }}>
              <button className={`convo-item ${c._id === id ? 'active' : ''}`} onClick={() => navigate(`/chat/${c._id}`)}>
                <MessageSquare size={15} />
                <span className="title">{c.title}</span>
                {c.channel !== 'web' && <span className="badge" style={{ fontSize: 10 }}>{c.channel.replace('bot:', '@')}</span>}
              </button>
              <button className="icon-btn" onClick={() => removeConversation(c._id)} aria-label="Delete conversation">
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <motion.div className="glass chat-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="chat-top">
          <AssistantOrb size={26} state={orbState} />
          <div style={{ marginLeft: -14 }}>
            <div style={{ fontWeight: 700 }}>{user.assistantName}</div>
            <div className="small muted">
              {voice.listening ? 'Listening…' : busy ? 'Thinking…' : voice.speaking ? 'Speaking…' : `Online · ${bots.length} bots connected`}
            </div>
          </div>
          <div className="spacer" />
          <button
            className="icon-btn"
            title="Read replies aloud"
            onClick={() => {
              localStorage.setItem('pa_autospeak', autoSpeak ? '0' : '1');
              setAutoSpeak(!autoSpeak);
            }}
          >
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <div className="messages">
          {messages.length === 0 && !busy && (
            <motion.div style={{ margin: 'auto', textAlign: 'center' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <AssistantOrb size={100} state={orbState} />
              <h2 style={{ marginTop: 6 }}>How can I help, <span className="gradient-text">{user.name.split(' ')[0]}</span>?</h2>
              <p className="muted" style={{ marginTop: 6 }}>Type, talk, or mention a bot with <code>@</code></p>
            </motion.div>
          )}
          {messages.map((m) => (
            <Message key={m._id} m={m} user={user} />
          ))}
          <AnimatePresence>
            {busy && (
              <motion.div className="msg assistant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="msg-avatar" style={{ background: 'var(--surface-2)' }}><AssistantOrb size={14} state="thinking" /></div>
                <div className="bubble" style={{ padding: 0 }}><TypingDots /></div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>

        <div className="composer" style={{ position: 'relative' }}>
          {messages.length < 2 && (
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={s} className="suggestion" onClick={() => send.current(s)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  {s}
                </motion.button>
              ))}
            </div>
          )}
          <AnimatePresence>
            {mentionBots.length > 0 && (
              <motion.div className="mention-menu glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                {mentionBots.map((b, i) => (
                  <button key={b._id} className={`palette-item ${i === mentionIdx ? 'active' : ''}`} onMouseEnter={() => setMentionIdx(i)} onClick={() => pickMention(b)}>
                    <span>{b.avatar}</span>
                    <span style={{ flex: 1 }}>{b.name}</span>
                    <span className="small muted">@{b.handle}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="composer-box">
            <textarea
              ref={inputRef}
              rows={1}
              value={voice.listening ? voice.interim || text : text}
              placeholder={`Ask ${user.assistantName} anything…`}
              onChange={(e) => {
                setText(e.target.value);
                setMentionIdx(0);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (mentionBots.length) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); return setMentionIdx((i) => (i + 1) % mentionBots.length); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); return setMentionIdx((i) => (i - 1 + mentionBots.length) % mentionBots.length); }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return pickMention(mentionBots[mentionIdx]); }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send.current();
                }
              }}
            />
            {(
              <motion.button
                className="icon-btn"
                animate={voice.listening ? { scale: [1, 1.15, 1], color: '#fb7185' } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
                onClick={() => (voice.listening ? voice.stop() : voice.listen())}
                aria-label="Voice input"
              >
                {voice.listening ? <MicOff size={18} /> : <Mic size={18} />}
              </motion.button>
            )}
            <motion.button className="btn btn-primary" whileTap={{ scale: 0.9 }} onClick={() => send.current()} disabled={busy || !text.trim()} aria-label="Send">
              <Send size={16} />
            </motion.button>
          </div>
          {conversations.find((c) => c._id === id) && (
            <div className="small muted" style={{ marginTop: 6, textAlign: 'right' }}>
              updated {timeAgo(conversations.find((c) => c._id === id).lastMessageAt)}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
