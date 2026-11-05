import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Banknote, Users, Eye, CheckCircle2, ArrowRight, Megaphone, Wallet, Clapperboard, FolderKanban } from 'lucide-react';
import { TeamShell, useAnalytics, useRange, rangeText } from '../../components/admin';
import { StatTile, ChartCard, LineChart, fmtMoney, fmtNum, fmtPct } from '../../components/charts';
import { useAuth } from '../../context/AuthContext';

export default function Overview() {
  const { user } = useAuth();
  const cur = user.preferences?.currency || 'INR';
  const [days, setDays] = useRange();
  const { data, loading, reload } = useAnalytics('overview', days);
  const k = data?.kpis;
  const money = (n) => fmtMoney(n, cur);
  const range = rangeText(days);

  const teams = data && [
    { to: '/admin/sales', name: 'Sales & Marketing', icon: Megaphone, stats: [['Open pipeline', money(data.teams.sales.pipeline.value)], ['Win rate', fmtPct(data.teams.sales.conversion)]] },
    { to: '/admin/finance', name: 'Finance', icon: Wallet, stats: [['Profit', money(data.teams.finance.profit)], ['Outstanding', `${money(data.teams.finance.outstanding.value)} · ${data.teams.finance.outstanding.count}`]] },
    { to: '/admin/content', name: 'Content', icon: Clapperboard, stats: [['Published', fmtNum(data.teams.content.published)], ['Engagement', fmtPct(data.teams.content.engagement)]] },
    { to: '/admin/projects', name: 'Projects', icon: FolderKanban, stats: [['Active projects', fmtNum(data.teams.projects.active)], ['Overdue tasks', fmtNum(data.teams.projects.overdue)]] },
  ];

  return (
    <TeamShell title="Business overview" subtitle={`Every team's live numbers, ${range}.`} days={days} setDays={setDays} data={data} loading={loading} reload={reload}>
      {() => (
      <>
      <div className="kpi-grid">
        <StatTile label="Revenue" icon={Banknote} value={money(k.revenue.value)} delta={k.revenue.delta} foot="vs previous period" spark={data.revenueTrend.series[0].values} />
        <StatTile label="New leads" icon={Users} value={fmtNum(k.newLeads.value)} delta={k.newLeads.delta} foot="vs previous period" spark={data.leadsTrend.series[0].values} />
        <StatTile label="Content views" icon={Eye} value={fmtNum(k.views.value)} delta={k.views.delta} foot="vs previous period" />
        <StatTile label="Tasks completed" icon={CheckCircle2} value={fmtNum(k.tasksCompleted.value)} delta={k.tasksCompleted.delta} foot="vs previous period" />
      </div>
      <div className="charts-grid">
        <ChartCard
          className="span-8"
          title="Revenue"
          sub={`Paid invoices, ${range}`}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'v', label: 'Revenue', num: true, format: money }], rows: data.revenueTrend.labels.map((label, i) => ({ label, v: data.revenueTrend.series[0].values[i] })) }}
        >
          <LineChart labels={data.revenueTrend.labels} series={data.revenueTrend.series} format={money} />
        </ChartCard>
        <ChartCard
          className="span-4"
          title="New leads"
          sub={range}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'v', label: 'Leads', num: true }], rows: data.leadsTrend.labels.map((label, i) => ({ label, v: data.leadsTrend.series[0].values[i] })) }}
        >
          <LineChart labels={data.leadsTrend.labels} series={data.leadsTrend.series} height={230} />
        </ChartCard>
      </div>
      <div className="team-cards">
        {teams.map((t, i) => (
          <motion.div key={t.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} whileHover={{ y: -3 }}>
            <Link to={t.to} className="glass team-card" style={{ display: 'flex' }}>
              <div className="t-head">
                <span className="t-icon"><t.icon size={17} /></span> {t.name}
                <ArrowRight size={16} className="muted" style={{ marginLeft: 'auto' }} />
              </div>
              {t.stats.map(([label, value]) => (
                <div key={label} className="t-stat"><span>{label}</span><strong>{value}</strong></div>
              ))}
            </Link>
          </motion.div>
        ))}
      </div>
      </>
      )}
    </TeamShell>
  );
}
