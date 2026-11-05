import { TrendingUp, TrendingDown, PiggyBank, Clock } from 'lucide-react';
import { TeamShell, useAnalytics, useRange, rangeText, RecordsTable, StatusPill } from '../../components/admin';
import { StatTile, ChartCard, LineChart, BarList, SegmentedBar, fmtMoney } from '../../components/charts';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLOR = { paid: 'var(--status-good)', sent: 'var(--series-1)', overdue: 'var(--status-critical)', draft: 'var(--status-neutral)' };

export default function Finance() {
  const { user } = useAuth();
  const cur = user.preferences?.currency || 'INR';
  const money = (n) => fmtMoney(n, cur);
  const [days, setDays] = useRange();
  const { data, loading, reload } = useAnalytics('finance', days);
  const k = data?.kpis;
  const range = rangeText(days);

  return (
    <TeamShell title="Finance" subtitle="Revenue, spending and invoices that still need to be paid." days={days} setDays={setDays} data={data} loading={loading} reload={reload}>
      {() => (
      <>
      <div className="kpi-grid">
        <StatTile label="Revenue" icon={TrendingUp} value={money(k.revenue.value)} delta={k.revenue.delta} foot="vs previous period" spark={data.trend.series[0].values} />
        <StatTile label="Expenses" icon={TrendingDown} value={money(k.expenses.value)} delta={k.expenses.delta} upIsGood={false} foot="vs previous period" />
        <StatTile label="Profit" icon={PiggyBank} value={money(k.profit.value)} delta={k.profit.delta} foot="revenue − expenses" />
        <StatTile label="Outstanding" icon={Clock} value={money(k.outstanding.value)} foot={`${k.outstanding.count} unpaid · ${k.outstanding.overdue} overdue`} />
      </div>
      <div className="charts-grid">
        <ChartCard
          className="span-8"
          title="Revenue vs expenses"
          sub={range}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'a', label: 'Revenue', num: true, format: money }, { key: 'b', label: 'Expenses', num: true, format: money }], rows: data.trend.labels.map((label, i) => ({ label, a: data.trend.series[0].values[i], b: data.trend.series[1].values[i] })) }}
        >
          <LineChart labels={data.trend.labels} series={data.trend.series} format={money} />
        </ChartCard>
        <ChartCard className="span-4" title="Invoices by status" sub="All income invoices, by amount" table={{ columns: [{ key: 'key', label: 'Status' }, { key: 'count', label: 'Invoices', num: true }, { key: 'amount', label: 'Amount', num: true, format: money }], rows: data.byStatus }}>
          <SegmentedBar parts={data.byStatus.map((s) => ({ key: s.key, value: s.amount, color: STATUS_COLOR[s.key], display: money(s.amount) }))} />
        </ChartCard>
        <ChartCard className="span-12" title="Expenses by category" sub={range} table={{ columns: [{ key: 'key', label: 'Category' }, { key: 'amount', label: 'Amount', num: true, format: money }], rows: data.expensesByCategory }}>
          <BarList items={data.expensesByCategory.map((c) => ({ key: c.key, value: c.amount }))} format={money} />
        </ChartCard>
      </div>
      <RecordsTable
        title="Invoices"
        endpoint="/invoices"
        searchKeys={['number', 'client', 'category']}
        defaults={{ kind: 'income', status: 'draft', category: 'services', issueDate: new Date().toISOString() }}
        fields={[
          { key: 'number', label: 'Number', required: true },
          { key: 'client', label: 'Client / payee', required: true },
          { key: 'kind', label: 'Type', type: 'select', options: ['income', 'expense'], render: (v) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: `Amount (${cur})`, type: 'number', required: true, render: (v) => money(v) },
          { key: 'status', label: 'Status', type: 'select', options: ['draft', 'sent', 'paid', 'overdue'], render: (v) => <StatusPill value={v} color={STATUS_COLOR[v]} /> },
          { key: 'issueDate', label: 'Issued', type: 'date' },
          { key: 'dueDate', label: 'Due', type: 'date', inTable: false },
          { key: 'paidAt', label: 'Paid on', type: 'date' },
        ]}
      />
      </>
      )}
    </TeamShell>
  );
}
