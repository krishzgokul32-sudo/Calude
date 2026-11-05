import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Page, Modal, Empty } from '../components/ui';
import { useSocketEvent } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errMsg } from '../lib/api';
import { fmtDateTime } from '../lib/format';

const COLUMNS = [
  { key: 'todo', title: 'To do', emoji: '📝' },
  { key: 'in_progress', title: 'In progress', emoji: '⚡' },
  { key: 'done', title: 'Done', emoji: '✅' },
];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [over, setOver] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', project: '' });
  const [projects, setProjects] = useState([]);
  const toast = useToast();

  const load = useCallback(() => api.get('/tasks').then((r) => setTasks(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/projects').then((r) => setProjects(r.data)).catch(() => {}); }, []);
  useSocketEvent('data:changed', ({ kind }) => kind === 'tasks' && load());

  const update = async (task, patch) => {
    setTasks((ts) => ts.map((t) => (t._id === task._id ? { ...t, ...patch } : t)));
    try {
      await api.patch(`/tasks/${task._id}`, patch);
      if (patch.status === 'done') toast('Task completed', { type: 'success', body: task.title });
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
      load();
    }
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', { ...form, dueDate: form.dueDate || undefined, project: form.project || undefined });
      setOpen(false);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', project: '' });
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  };

  const remove = async (task) => {
    setTasks((ts) => ts.filter((t) => t._id !== task._id));
    await api.delete(`/tasks/${task._id}`);
  };

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p>Drag cards between columns · or just tell the assistant “add task …”</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New task</button>
      </div>

      <div className="kanban">
        {COLUMNS.map((col, ci) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <motion.div
              key={col.key}
              className={`glass column ${over === col.key ? 'drag-over' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.08 }}
              onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const task = tasks.find((t) => t._id === e.dataTransfer.getData('text/plain'));
                if (task && task.status !== col.key) update(task, { status: col.key });
              }}
            >
              <div className="column-head">
                <span>{col.emoji}</span> {col.title}
                <span className="badge" style={{ marginLeft: 'auto' }}>{items.length}</span>
              </div>
              <AnimatePresence>
                {items.map((t) => (
                  <motion.div
                    key={t._id}
                    layout
                    layoutId={t._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                    whileHover={{ y: -3, boxShadow: 'var(--glow)' }}
                    className={`task-card ${t.status === 'done' ? 'done' : ''}`}
                  >
                    <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t._id)}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={() => update(t, { status: t.status === 'done' ? 'todo' : 'done' })}
                          style={{ marginTop: 4, accentColor: '#8b5cf6' }}
                          aria-label="Toggle done"
                        />
                        <div style={{ flex: 1 }}>
                          <div className="t-title" style={{ fontWeight: 600 }}>{t.title}</div>
                          {t.description && <div className="small muted" style={{ marginTop: 4 }}>{t.description}</div>}
                        </div>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => remove(t)} aria-label="Delete task"><Trash2 size={14} /></button>
                      </div>
                      <div className="row-wrap" style={{ marginTop: 10 }}>
                        <span className={`badge ${t.priority}`}>{t.priority}</span>
                        {t.dueDate && <span className="badge"><Calendar size={12} /> {fmtDateTime(t.dueDate)}</span>}
                        {t.project && projects.find((p) => p._id === t.project) && <span className="badge">📁 {projects.find((p) => p._id === t.project).name}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!items.length && <Empty emoji={col.key === 'done' ? '🏆' : '🌱'} title="Nothing here" />}
            </motion.div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3>New task</h3>
        <p className="muted small" style={{ marginBottom: 18 }}>What do you want to get done?</p>
        <form onSubmit={create}>
          <div className="field"><label className="label">Title</label><input className="input" autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label className="label">Description</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="label">Due</label>
              <input className="input" type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          {projects.length > 0 && (
            <div className="field">
              <label className="label">Project</label>
              <select className="select" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }}>Create task</button>
        </form>
      </Modal>
    </Page>
  );
}
