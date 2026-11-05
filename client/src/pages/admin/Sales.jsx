import { Users, Trophy, Percent, Briefcase } from 'lucide-react';
import { TeamShell, useAnalytics, useRange, rangeText, RecordsTable, StatusPill } from '../../components/admin';
import { StatTile, ChartCard, LineChart, BarList, Funnel, fmtMoney, fmtNum, fmtPct } from '../../components/charts';
import { useAuth } from '../../context/AuthContext';

const SOURCES = ['instagram', 'whatsapp', 'linkedin', 'website', 'referral', 'ads', 'other'];
const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const STAGE_COLOR = { won: 'var(--status-good)', lost: 'var(--status-critical)', proposal: 'var(--ramp-4)', qualified: 'var(--ramp-3)', contacted: 'var(--ramp-2)', new: 'var(--ramp-1)' };

export default function Sales() {
  const { user } = useAuth();
  const cur = user.preferences?.currency || 'INR';
  const money = (n) => fmtMoney(n, cur);
  const [days, setDays] = useRange();
  const { data, loading, reload } = useAnalytics('sales', days);
  const k = data?.kpis;
  const range = rangeText(days);

  return (
    <TeamShell title="Sales & Marketing" subtitle="Leads, pipeline and where your customers come from." days={days} setDays={setDays} data={data} loading={loading} reload={reload}>
      {() => (
      <>
      <div className="kpi-grid">
        <StatTile label="New leads" icon={Users} value={fmtNum(k.newLeads.value)} delta={k.newLeads.delta} foot="vs previous period" spark={data.trend.series[0].values} />
        <StatTile label="Won revenue" icon={Trophy} value={money(k.wonValue.value)} delta={k.wonValue.delta} foot="vs previous period" />
        <StatTile label="Win rate" icon={Percent} value={fmtPct(k.conversion.value)} delta={k.conversion.delta} foot="won ÷ closed leads" />
        <StatTile label="Open pipeline" icon={Briefcase} value={money(k.pipeline.value)} foot={`${k.pipeline.count} open deals`} />
      </div>
      <div className="charts-grid">
        <ChartCard
          className="span-8"
          title="Leads over time"
          sub={range}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'a', label: 'New leads', num: true }, { key: 'b', label: 'Won', num: true }], rows: data.trend.labels.map((label, i) => ({ label, a: data.trend.series[0].values[i], b: data.trend.series[1].values[i] })) }}
        >
          <LineChart labels={data.trend.labels} series={data.trend.series} />
        </ChartCard>
        <ChartCard className="span-4" title="Pipeline funnel" sub={`Leads from ${range} that reached each stage`} table={{ columns: [{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Leads', num: true }], rows: data.funnel }}>
          <Funnel stages={data.funnel} />
        </ChartCard>
        <ChartCard className="span-6" title="Leads by source" sub={range} table={{ columns: [{ key: 'key', label: 'Source' }, { key: 'count', label: 'Leads', num: true }], rows: data.bySource }}>
          <BarList items={data.bySource.map((s) => ({ key: s.key, value: s.count }))} />
        </ChartCard>
        <ChartCard className="span-6" title="All leads by stage" sub="Current stage of every lead" table={{ columns: [{ key: 'key', label: 'Stage' }, { key: 'count', label: 'Leads', num: true }], rows: data.byStage }}>
          <BarList items={data.byStage.map((s) => ({ key: s.key, value: s.count }))} />
        </ChartCard>
      </div>
      <RecordsTable
        title="Leads"
        endpoint="/leads"
        searchKeys={['name', 'company', 'email', 'phone']}
        defaults={{ source: 'website', stage: 'new', value: 0 }}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'company', label: 'Company' },
          { key: 'email', label: 'Email', inTable: false },
          { key: 'phone', label: 'Phone', inTable: false },
          { key: 'source', label: 'Source', type: 'select', options: SOURCES, render: (v) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
          { key: 'stage', label: 'Stage', type: 'select', options: STAGES, render: (v) => <StatusPill value={v} color={STAGE_COLOR[v]} /> },
          { key: 'value', label: `Deal value (${cur})`, type: 'number', render: (v) => money(v) },
          { key: 'notes', label: 'Notes', inTable: false },
        ]}
      />
      </>
      )}
    </TeamShell>
  );
}
