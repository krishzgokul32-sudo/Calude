import { useCallback, useEffect, useState } from 'react';
import { useSaving } from '../hooks/useSaving';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Pin, Search, Trash2 } from 'lucide-react';
import { Page, Modal, Empty } from '../components/ui';
import { useSocketEvent } from '../context/AuthContext';
import { api, errMsg } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { timeAgo } from '../lib/format';

const COLORS = { violet: '#8b5cf6', pink: '#ec4899', cyan: '#22d3ee', green: '#34d399', amber: '#fbbf24', red: '#fb7185' };
const blank = { title: '', content: '', color: 'violet', pinned: false };

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, run] = useSaving();
  const toast = useToast();

  const load = useCallback(() => api.get('/notes').then((r) => setNotes(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('data:changed', ({ kind }) => kind === 'notes' && load());

  const save = run(async () => {
    const { _id, title, content, color, pinned } = editing;
    try {
      if (_id) await api.patch(`/notes/${_id}`, { title, content, color, pinned });
      else await api.post('/notes', { title, content, color, pinned });
      setEditing(null);
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  });

  const togglePin = async (n, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notes/${n._id}`, { pinned: !n.pinned });
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
    load();
  };

  const remove = async () => {
    try {
      await api.delete(`/notes/${editing._id}`);
      setEditing(null);
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
    load();
  };

  const filtered = notes.filter((n) => (n.title + n.content).toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Notes</h1>
          <p>Capture anything. Long notes get an automatic summary from the Python service.</p>
        </div>
        <div className="row">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 36, width: 220 }} placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setEditing({ ...blank })}><Plus size={16} /> New</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty emoji="🗒️" title={q ? 'No matching notes' : 'No notes yet'}>Try telling the assistant “note: groceries — eggs, milk”.</Empty>
      ) : (
        <div className="notes-masonry">
          <AnimatePresence>
            {filtered.map((n, i) => (
              <motion.div
                key={n._id}
                layout
                className="glass note"
                initial={{ opacity: 0, y: 20, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -4, rotate: 0.4 }}
                onClick={() => setEditing({ ...n })}
              >
                <div className="note-bar" style={{ background: COLORS[n.color] || COLORS.violet }} />
                <button className="icon-btn" style={{ position: 'absolute', right: 10, top: 10, color: n.pinned ? COLORS.amber : undefined }} onClick={(e) => togglePin(n, e)} aria-label="Pin">
                  <Pin size={15} fill={n.pinned ? COLORS.amber : 'none'} />
                </button>
                <h4>{n.title}</h4>
                <p>{n.content.length > 280 ? n.content.slice(0, 280) + '…' : n.content}</p>
                {n.summary && <p className="small" style={{ marginTop: 10, fontStyle: 'italic' }}>✨ {n.summary}</p>}
                <div className="small muted" style={{ marginTop: 12 }}>{timeAgo(n.updatedAt)}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save}>
            <h3>{editing._id ? 'Edit note' : 'New note'}</h3>
            <div className="field" style={{ marginTop: 16 }}><input className="input" placeholder="Title" required autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div className="field"><textarea className="textarea" style={{ minHeight: 180 }} placeholder="Write something…" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></div>
            <div className="row" style={{ marginBottom: 18 }}>
              <div className="color-dots">
                {Object.entries(COLORS).map(([k, c]) => (
                  <button type="button" key={k} className={`color-dot ${editing.color === k ? 'sel' : ''}`} style={{ background: c }} onClick={() => setEditing({ ...editing, color: k })} aria-label={k} />
                ))}
              </div>
              <div className="spacer" />
              <label className="row small"><input type="checkbox" checked={editing.pinned} onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })} /> Pinned</label>
            </div>
            <div className="row">
              {editing._id && <button type="button" className="btn btn-danger" onClick={remove}><Trash2 size={15} /> Delete</button>}
              <div className="spacer" />
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}
      </Modal>
    </Page>
  );
}
