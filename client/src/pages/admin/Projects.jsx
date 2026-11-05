import { Link } from 'react-router-dom';
import { FolderKanban, CheckCircle2, ListTodo, AlertTriangle } from 'lucide-react';
import { TeamShell, useAnalytics, useRange, rangeText, RecordsTable, StatusPill } from '../../components/admin';
import { StatTile, ChartCard, LineChart, SegmentedBar, Meter, fmtMoney, fmtNum } from '../../components/charts';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLOR = { active: 'var(--series-1)', planning: 'var(--ramp-1)', on_hold: 'var(--status-warning)', done: 'var(--status-good)' };

export default function Projects() {
  const { user } = useAuth();
  const cur = user.preferences?.currency || 'INR';
  const [days, setDays] = useRange();
  const { data, loading, reload } = useAnalytics('projects', days);
  const k = data?.kpis;
  const range = rangeText(days);

  return (
    <TeamShell title="Project management" subtitle="Delivery progress across every project." days={days} setDays={setDays} data={data} loading={loading} reload={reload}>
      {() => (
      <>
      <div className="kpi-grid">
        <StatTile label="Active projects" icon={FolderKanban} value={fmtNum(k.active.value)} foot="in progress now" />
        <StatTile label="Tasks completed" icon={CheckCircle2} value={fmtNum(k.completed.value)} delta={k.completed.delta} foot="vs previous period" spark={data.trend.series[0].values} />
        <StatTile label="Open tasks" icon={ListTodo} value={fmtNum(k.open.value)} foot={<Link to="/tasks" style={{ color: 'var(--primary)' }}>Open task board</Link>} />
        <StatTile label="Overdue tasks" icon={AlertTriangle} value={fmtNum(k.overdue.value)} foot="past their due date" />
      </div>
      <div className="charts-grid">
        <ChartCard
          className="span-8"
          title="Tasks completed"
          sub={range}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'v', label: 'Completed', num: true }], rows: data.trend.labels.map((label, i) => ({ label, v: data.trend.series[0].values[i] })) }}
        >
          <LineChart labels={data.trend.labels} series={data.trend.series} />
        </ChartCard>
        <ChartCard className="span-4" title="Projects by status" table={{ columns: [{ key: 'key', label: 'Status' }, { key: 'count', label: 'Projects', num: true }], rows: data.byStatus }}>
          <SegmentedBar parts={data.byStatus.map((s) => ({ key: s.key, label: s.key.replace('_', ' '), value: s.count, color: STATUS_COLOR[s.key] }))} />
        </ChartCard>
        <ChartCard className="span-12" title="Progress by project" sub="Share of each project's tasks that are done" table={{ columns: [{ key: 'name', label: 'Project' }, { key: 'done', label: 'Done', num: true }, { key: 'total', label: 'Tasks', num: true }, { key: 'progress', label: 'Progress', num: true, format: (v) => `${v}%` }], rows: data.projects }}>
          {data.projects.length ? (
            data.projects.map((p) => (
              <div key={p._id} className="list-row" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="small muted">{p.client || '—'} · {p.deadline ? `due ${new Date(p.deadline).toLocaleDateString()}` : 'no deadline'}</div>
                </div>
                <StatusPill value={p.status} color={STATUS_COLOR[p.status]} />
                <div style={{ flex: '2 1 220px' }}>
                  <Meter value={p.progress} label={`${p.name} progress`} />
                </div>
                <span className="small" style={{ width: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{p.progress}%</strong> <span className="muted">{p.done}/{p.total}</span></span>
              </div>
            ))
          ) : (
            <p className="muted small">No projects yet.</p>
          )}
        </ChartCard>
      </div>
      <RecordsTable
        title="Projects"
        endpoint="/projects"
        searchKeys={['name', 'client']}
        defaults={{ status: 'planning', budget: 0 }}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'client', label: 'Client' },
          { key: 'status', label: 'Status', type: 'select', options: ['planning', 'active', 'on_hold', 'done'], render: (v) => <StatusPill value={v} color={STATUS_COLOR[v]} /> },
          { key: 'budget', label: `Budget (${cur})`, type: 'number', render: (v) => fmtMoney(v, cur) },
          { key: 'deadline', label: 'Deadline', type: 'date' },
        ]}
      />
      </>
      )}
    </TeamShell>
  );
}
