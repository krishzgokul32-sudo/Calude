import { useCallback, useEffect, useState } from 'react';
import { useSaving } from '../hooks/useSaving';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, Sparkles } from 'lucide-react';
import { Modal } from './ui';
import { api, errMsg } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../context/AuthContext';

export const RANGE_OPTIONS = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '12M' },
];
export const rangeText = (d) => ({ 7: 'last 7 days', 30: 'last 30 days', 90: 'last 90 days', 365: 'last 12 months' })[d];

const TEAM_LINKS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/sales', label: 'Sales & Marketing' },
  { to: '/admin/finance', label: 'Finance' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/projects', label: 'Projects' },
];

function Segmented({ value, onChange, options, id }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.div layoutId={`${id}-pill`} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Fetch a team's analytics for the chosen range; refetches when data changes. Keeps the old data while loading. */
export function useAnalytics(team, days) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    return api
      .get(`/analytics/${team}`, { params: { days } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [team, days]);
  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent('data:changed', load);
  return { data, loading, reload: load };
}

/** Page frame shared by every team dashboard: title, team tabs, one filter row. */
export function TeamShell({ title, subtitle, days, setDays, data, reload, loading, children }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const addSample = async () => {
    setBusy(true);
    try {
      await api.post('/analytics/sample-data');
      toast('Sample data added', { type: 'success', body: 'Explore the dashboards, then replace it with your own records.' });
      reload();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="toolbar">
        <Segmented id="range" value={days} onChange={setDays} options={RANGE_OPTIONS} />
        <div className="seg" style={{ overflowX: 'auto', maxWidth: '100%' }}>
          {TEAM_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {({ isActive }) => (
                <span style={{ position: 'relative', color: isActive ? 'var(--text)' : 'var(--text-2)' }}>
                  {l.label}
                  {isActive && <motion.span layoutId="team-underline" style={{ position: 'absolute', left: 0, right: 0, bottom: -5, height: 2, borderRadius: 2, background: 'var(--primary)' }} />}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      {data?.empty && (
        <motion.div className="glass banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Sparkles size={20} style={{ color: 'var(--primary)' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600 }}>No business data yet</div>
            <div className="small muted">Add leads, invoices, posts and projects below, or load sample data to see how the dashboards look.</div>
          </div>
          <button className="btn btn-primary" onClick={addSample} disabled={busy}>{busy ? 'Adding…' : 'Load sample data'}</button>
        </motion.div>
      )}
      <div style={{ opacity: loading && data ? 0.6 : 1, transition: 'opacity 0.2s' }}>{data ? (typeof children === 'function' ? children() : children) : null}</div>
    </motion.div>
  );
}

const toInput = (type, v) => {
  if (v == null || v === '') return '';
  if (type === 'date') return new Date(v).toISOString().slice(0, 10);
  return v;
};

/**
 * Generic records table with search, add/edit modal and delete.
 * fields: [{ key, label, type: 'text'|'number'|'select'|'date', options?, required?, inTable?, render? }]
 */
export function RecordsTable({ title, endpoint, fields, defaults = {}, sort, searchKeys = [] }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, run] = useSaving();

  const load = useCallback(() => api.get(endpoint).then((r) => setRows(sort ? [...r.data].sort(sort) : r.data)), [endpoint, sort]);
  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent('data:changed', load);

  const save = run(async () => {
    const body = {};
    for (const f of fields) {
      let v = editing[f.key];
      if (f.type === 'number') v = v === '' || v == null ? undefined : Number(v);
      if (f.type === 'date') v = v ? new Date(v).toISOString() : undefined;
      body[f.key] = v;
    }
    try {
      if (editing._id) await api.patch(`${endpoint}/${editing._id}`, body);
      else await api.post(endpoint, body);
      setEditing(null);
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
  });

  const remove = async (row) => {
    if (!confirm('Delete this record?')) return;
    try {
      await api.delete(`${endpoint}/${row._id}`);
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    }
    load();
  };

  const shown = rows.filter((r) => !q || searchKeys.some((k) => String(r[k] || '').toLowerCase().includes(q.toLowerCase())));
  const cols = fields.filter((f) => f.inTable !== false);

  return (
    <motion.div className="glass records" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="chart-head" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="chart-title">{title}</div>
          <div className="chart-sub">{rows.length} records</div>
        </div>
        <div className="row" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
          {searchKeys.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32, width: 200, padding: '8px 10px 8px 32px' }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setEditing({ ...defaults })}><Plus size={15} /> Add</button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="viz-table">
          <thead>
            <tr>
              {cols.map((f) => <th key={f.key} className={f.type === 'number' ? 'num' : ''}>{f.label}</th>)}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {shown.slice(0, 200).map((r) => (
                <motion.tr key={r._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {cols.map((f) => (
                    <td key={f.key} className={f.type === 'number' ? 'num' : ''}>
                      {f.render ? f.render(r[f.key], r) : f.type === 'date' ? (r[f.key] ? new Date(r[f.key]).toLocaleDateString() : '—') : r[f.key] ?? '—'}
                    </td>
                  ))}
                  <td style={{ width: 76, whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setEditing({ ...r })} aria-label="Edit"><Pencil size={14} /></button>
                    <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => remove(r)} aria-label="Delete"><Trash2 size={14} /></button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {!shown.length && <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>Nothing here yet.</p>}
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save}>
            <h3 style={{ marginBottom: 16 }}>{editing._id ? 'Edit' : 'Add'} {title.replace(/s$/, '').toLowerCase()}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {fields.map((f) => (
                <div key={f.key} className="field" style={{ marginBottom: 0 }}>
                  <label className="label">{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="select" value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}>
                      {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? String(o).replace('_', ' ')}</option>)}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      min={f.type === 'number' ? 0 : undefined}
                      required={f.required}
                      value={toInput(f.type, editing[f.key])}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}

export function StatusPill({ value, color }) {
  return (
    <span className="pill">
      <span className="dot" style={{ background: color || 'var(--status-neutral)' }} /> {String(value || '').replace('_', ' ')}
    </span>
  );
}

/** Selected date range, remembered per browser. */
export function useRange() {
  const [days, setDaysState] = useState(() => {
    try {
      return Number(localStorage.getItem('pa_range')) || 30;
    } catch {
      return 30;
    }
  });
  const setDays = (d) => {
    setDaysState(d);
    try {
      localStorage.setItem('pa_range', String(d));
    } catch {
      /* storage unavailable */
    }
  };
  return [days, setDays];
}
