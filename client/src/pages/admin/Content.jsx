import { Send, Eye, Heart, CalendarClock } from 'lucide-react';
import { TeamShell, useAnalytics, useRange, rangeText, RecordsTable, StatusPill } from '../../components/admin';
import { StatTile, ChartCard, LineChart, BarList, SegmentedBar, fmtNum, fmtPct } from '../../components/charts';
import { fmtDateTime } from '../../lib/format';

const PLATFORMS = ['instagram', 'youtube', 'linkedin', 'facebook', 'x', 'blog'];
const STATUS_COLOR = { published: 'var(--status-good)', scheduled: 'var(--series-1)', draft: 'var(--ramp-1)', idea: 'var(--status-neutral)' };

export default function Content() {
  const [days, setDays] = useRange();
  const { data, loading, reload } = useAnalytics('content', days);
  const k = data?.kpis;
  const range = rangeText(days);

  return (
    <TeamShell title="Content" subtitle="What you published, how it performed, and what's coming up." days={days} setDays={setDays} data={data} loading={loading} reload={reload}>
      {() => (
      <>
      <div className="kpi-grid">
        <StatTile label="Posts published" icon={Send} value={fmtNum(k.published.value)} delta={k.published.delta} foot="vs previous period" />
        <StatTile label="Views" icon={Eye} value={fmtNum(k.views.value)} delta={k.views.delta} foot="vs previous period" spark={data.trend.series[0].values} />
        <StatTile label="Engagement rate" icon={Heart} value={fmtPct(k.engagement.value)} delta={k.engagement.delta} foot="likes, comments & shares ÷ views" />
        <StatTile label="Scheduled" icon={CalendarClock} value={fmtNum(k.scheduled.value)} foot="upcoming posts" />
      </div>
      <div className="charts-grid">
        <ChartCard
          className="span-8"
          title="Views"
          sub={`Views on posts published, ${range}`}
          table={{ columns: [{ key: 'label', label: 'Period' }, { key: 'v', label: 'Views', num: true, format: fmtNum }], rows: data.trend.labels.map((label, i) => ({ label, v: data.trend.series[0].values[i] })) }}
        >
          <LineChart labels={data.trend.labels} series={data.trend.series} />
        </ChartCard>
        <ChartCard className="span-4" title="Views by platform" sub={range} table={{ columns: [{ key: 'key', label: 'Platform' }, { key: 'posts', label: 'Posts', num: true }, { key: 'views', label: 'Views', num: true, format: fmtNum }], rows: data.byPlatform }}>
          <BarList items={data.byPlatform.map((p) => ({ key: p.key, value: p.views, note: `${p.posts} posts` }))} />
        </ChartCard>
        <ChartCard className="span-6" title="Content pipeline" sub="All posts by status" table={{ columns: [{ key: 'key', label: 'Status' }, { key: 'count', label: 'Posts', num: true }], rows: data.byStatus }}>
          <SegmentedBar parts={data.byStatus.map((s) => ({ key: s.key, value: s.count, color: STATUS_COLOR[s.key] }))} />
        </ChartCard>
        <ChartCard className="span-6" title="Coming up" sub="Next scheduled posts">
          {data.upcoming.length ? (
            data.upcoming.map((p) => (
              <div key={p._id} className="list-row">
                <StatusPill value={p.platform} color="var(--series-1)" />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span className="small muted">{fmtDateTime(p.scheduledAt)}</span>
              </div>
            ))
          ) : (
            <p className="muted small">Nothing scheduled.</p>
          )}
        </ChartCard>
      </div>
      <RecordsTable
        title="Posts"
        endpoint="/posts"
        searchKeys={['title', 'platform']}
        defaults={{ platform: 'instagram', status: 'idea' }}
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS, render: (v) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
          { key: 'status', label: 'Status', type: 'select', options: ['idea', 'draft', 'scheduled', 'published'], render: (v) => <StatusPill value={v} color={STATUS_COLOR[v]} /> },
          { key: 'scheduledAt', label: 'Scheduled for', type: 'date', inTable: false },
          { key: 'publishedAt', label: 'Published', type: 'date' },
          { key: 'views', label: 'Views', type: 'number', render: (v) => fmtNum(v) },
          { key: 'likes', label: 'Likes', type: 'number', render: (v) => fmtNum(v) },
          { key: 'comments', label: 'Comments', type: 'number', inTable: false },
          { key: 'shares', label: 'Shares', type: 'number', inTable: false },
        ]}
      />
      </>
      )}
    </TeamShell>
  );
}
