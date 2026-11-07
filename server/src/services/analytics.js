import Lead, { LEAD_STAGES, LEAD_SOURCES } from '../models/Lead.js';
import Invoice, { INVOICE_STATUSES } from '../models/Invoice.js';
import Post, { PLATFORMS, POST_STATUSES } from '../models/Post.js';
import Project, { PROJECT_STATUSES } from '../models/Project.js';
import Task from '../models/Task.js';

const DAY = 864e5;
export const RANGES = { 7: 'day', 30: 'day', 90: 'week', 365: 'month' };

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Buckets covering the last `days` days (daily, weekly or monthly). */
function makeBuckets(days, now = new Date()) {
  const unit = RANGES[days] || 'day';
  const buckets = [];
  if (unit === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 12; i++) {
      const start = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const end = new Date(first.getFullYear(), first.getMonth() + i + 1, 1);
      buckets.push({ start, end, label: start.toLocaleDateString('en-US', { month: 'short' }) });
    }
  } else {
    const step = unit === 'week' ? 7 : 1;
    const count = Math.ceil(days / step);
    const end0 = new Date(startOfDay(now).getTime() + DAY);
    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(end0.getTime() - i * step * DAY);
      const start = new Date(end.getTime() - step * DAY);
      buckets.push({ start, end, label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
  }
  return { unit, buckets, from: buckets[0].start, to: buckets[buckets.length - 1].end };
}

function series(buckets, items, dateOf, valueOf = () => 1) {
  const out = buckets.map(() => 0);
  const first = buckets[0].start.getTime();
  const last = buckets[buckets.length - 1].end.getTime();
  for (const it of items) {
    const d = dateOf(it);
    if (!d) continue;
    const t = new Date(d).getTime();
    if (t < first || t >= last) continue;
    const i = buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    if (i >= 0) out[i] += valueOf(it);
  }
  return out;
}

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const inRange = (d, from, to) => d && new Date(d) >= from && new Date(d) < to;
const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

/** Percentage change vs the previous period of the same length; null when there's no base. */
const delta = (cur, prev) => (prev ? round(((cur - prev) / prev) * 100) : null);

function periods(days) {
  const { unit, buckets, from, to } = makeBuckets(days);
  const len = to.getTime() - from.getTime();
  return { unit, buckets, from, to, prevFrom: new Date(from.getTime() - len), prevTo: from };
}

const labels = (buckets) => buckets.map((b) => b.label);

export async function salesAnalytics(user, days) {
  const p = periods(days);
  const all = await Lead.find({ user }).select('stage source value createdAt updatedAt').lean();
  const leads = all.filter((l) => l.createdAt >= p.prevFrom);
  const cur = leads.filter((l) => inRange(l.createdAt, p.from, p.to));
  const prev = leads.filter((l) => inRange(l.createdAt, p.prevFrom, p.prevTo));
  const won = (xs) => xs.filter((l) => l.stage === 'won');
  const closed = (xs) => xs.filter((l) => ['won', 'lost'].includes(l.stage));
  const rate = (xs) => (closed(xs).length ? round((won(xs).length / closed(xs).length) * 100) : 0);
  const openPipeline = all.filter((l) => !['won', 'lost'].includes(l.stage));

  // Funnel: how many of this period's leads reached at least each stage.
  const order = ['new', 'contacted', 'qualified', 'proposal', 'won'];
  const reached = (l) => (l.stage === 'lost' ? 0 : order.indexOf(l.stage));
  const funnel = order.map((stage, i) => ({ stage, count: cur.filter((l) => reached(l) >= i).length }));

  return {
    range: { days, unit: p.unit },
    kpis: {
      newLeads: { value: cur.length, delta: delta(cur.length, prev.length) },
      wonValue: { value: sum(won(cur), (l) => l.value), delta: delta(sum(won(cur), (l) => l.value), sum(won(prev), (l) => l.value)) },
      conversion: { value: rate(cur), delta: delta(rate(cur), rate(prev)) },
      pipeline: { value: sum(openPipeline, (l) => l.value), count: openPipeline.length },
    },
    trend: {
      labels: labels(p.buckets),
      series: [
        { key: 'leads', name: 'New leads', values: series(p.buckets, cur, (l) => l.createdAt) },
        { key: 'won', name: 'Won', values: series(p.buckets, won(cur), (l) => l.updatedAt) },
      ],
    },
    funnel,
    bySource: LEAD_SOURCES.map((s) => ({ key: s, count: cur.filter((l) => l.source === s).length })).filter((x) => x.count).sort((a, b) => b.count - a.count),
    byStage: LEAD_STAGES.map((s) => ({ key: s, count: all.filter((l) => l.stage === s).length })),
  };
}

export async function financeAnalytics(user, days) {
  const p = periods(days);
  const all = await Invoice.find({ user }).select('kind status amount category issueDate paidAt').lean();
  const revenueIn = (from, to) => sum(all.filter((i) => i.kind === 'income' && i.status === 'paid' && inRange(i.paidAt, from, to)), (i) => i.amount);
  const expenseIn = (from, to) => sum(all.filter((i) => i.kind === 'expense' && inRange(i.issueDate, from, to)), (i) => i.amount);
  const revenue = revenueIn(p.from, p.to);
  const expenses = expenseIn(p.from, p.to);
  const prevRevenue = revenueIn(p.prevFrom, p.prevTo);
  const prevExpenses = expenseIn(p.prevFrom, p.prevTo);
  const outstanding = all.filter((i) => i.kind === 'income' && ['sent', 'overdue'].includes(i.status));
  const incomeInv = all.filter((i) => i.kind === 'income');
  const expenseInv = all.filter((i) => i.kind === 'expense' && inRange(i.issueDate, p.from, p.to));
  const cats = {};
  expenseInv.forEach((i) => (cats[i.category] = (cats[i.category] || 0) + i.amount));

  return {
    range: { days, unit: p.unit },
    kpis: {
      revenue: { value: revenue, delta: delta(revenue, prevRevenue) },
      expenses: { value: expenses, delta: delta(expenses, prevExpenses) },
      profit: { value: revenue - expenses, delta: delta(revenue - expenses, prevRevenue - prevExpenses) },
      outstanding: { value: sum(outstanding, (i) => i.amount), count: outstanding.length, overdue: outstanding.filter((i) => i.status === 'overdue').length },
    },
    trend: {
      labels: labels(p.buckets),
      series: [
        { key: 'revenue', name: 'Revenue', values: series(p.buckets, all.filter((i) => i.kind === 'income' && i.status === 'paid'), (i) => i.paidAt, (i) => i.amount) },
        { key: 'expenses', name: 'Expenses', values: series(p.buckets, all.filter((i) => i.kind === 'expense'), (i) => i.issueDate, (i) => i.amount) },
      ],
    },
    byStatus: INVOICE_STATUSES.map((s) => ({ key: s, count: incomeInv.filter((i) => i.status === s).length, amount: sum(incomeInv.filter((i) => i.status === s), (i) => i.amount) })),
    expensesByCategory: Object.entries(cats).map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export async function contentAnalytics(user, days) {
  const p = periods(days);
  const all = await Post.find({ user }).select('title platform status views likes comments shares publishedAt scheduledAt').lean();
  const published = (from, to) => all.filter((x) => x.status === 'published' && inRange(x.publishedAt, from, to));
  const cur = published(p.from, p.to);
  const prev = published(p.prevFrom, p.prevTo);
  const views = (xs) => sum(xs, (x) => x.views);
  const engagement = (xs) => (views(xs) ? round((sum(xs, (x) => x.likes + x.comments + x.shares) / views(xs)) * 100) : 0);
  const upcoming = all.filter((x) => x.status === 'scheduled' && x.scheduledAt && new Date(x.scheduledAt) >= new Date());

  return {
    range: { days, unit: p.unit },
    kpis: {
      published: { value: cur.length, delta: delta(cur.length, prev.length) },
      views: { value: views(cur), delta: delta(views(cur), views(prev)) },
      engagement: { value: engagement(cur), delta: delta(engagement(cur), engagement(prev)) },
      scheduled: { value: upcoming.length },
    },
    trend: {
      labels: labels(p.buckets),
      series: [{ key: 'views', name: 'Views', values: series(p.buckets, cur, (x) => x.publishedAt, (x) => x.views) }],
    },
    byPlatform: PLATFORMS.map((pl) => ({ key: pl, posts: cur.filter((x) => x.platform === pl).length, views: views(cur.filter((x) => x.platform === pl)) }))
      .filter((x) => x.posts)
      .sort((a, b) => b.views - a.views),
    byStatus: POST_STATUSES.map((s) => ({ key: s, count: all.filter((x) => x.status === s).length })),
    upcoming: upcoming.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 5),
  };
}

export async function projectAnalytics(user, days) {
  const p = periods(days);
  const [projects, tasks] = await Promise.all([
    Project.find({ user }).select('name client status deadline budget').lean(),
    Task.find({ user }).select('status project dueDate completedAt updatedAt').lean(),
  ]);
  const doneIn = (from, to) => tasks.filter((t) => t.status === 'done' && inRange(t.completedAt || t.updatedAt, from, to));
  const now = new Date();
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now);

  const perProject = projects.map((pr) => {
    const own = tasks.filter((t) => String(t.project) === String(pr._id));
    const done = own.filter((t) => t.status === 'done').length;
    return {
      _id: pr._id,
      name: pr.name,
      client: pr.client,
      status: pr.status,
      deadline: pr.deadline,
      budget: pr.budget,
      total: own.length,
      done,
      progress: own.length ? Math.round((done / own.length) * 100) : 0,
    };
  });

  return {
    range: { days, unit: p.unit },
    kpis: {
      active: { value: projects.filter((x) => x.status === 'active').length },
      completed: { value: doneIn(p.from, p.to).length, delta: delta(doneIn(p.from, p.to).length, doneIn(p.prevFrom, p.prevTo).length) },
      open: { value: tasks.filter((t) => t.status !== 'done').length },
      overdue: { value: overdue.length },
    },
    trend: {
      labels: labels(p.buckets),
      series: [{ key: 'completed', name: 'Tasks completed', values: series(p.buckets, doneIn(p.from, p.to), (t) => t.completedAt || t.updatedAt) }],
    },
    projects: perProject,
    byStatus: PROJECT_STATUSES.map((s) => ({ key: s, count: projects.filter((x) => x.status === s).length })),
  };
}

export async function overviewAnalytics(user, days) {
  const [sales, finance, content, projects] = await Promise.all([
    salesAnalytics(user, days),
    financeAnalytics(user, days),
    contentAnalytics(user, days),
    projectAnalytics(user, days),
  ]);
  return {
    range: sales.range,
    kpis: {
      revenue: finance.kpis.revenue,
      newLeads: sales.kpis.newLeads,
      views: content.kpis.views,
      tasksCompleted: projects.kpis.completed,
    },
    revenueTrend: { labels: finance.trend.labels, series: [finance.trend.series[0]] },
    leadsTrend: { labels: sales.trend.labels, series: [sales.trend.series[0]] },
    teams: {
      sales: { pipeline: sales.kpis.pipeline, conversion: sales.kpis.conversion.value },
      finance: { profit: finance.kpis.profit.value, outstanding: finance.kpis.outstanding },
      content: { published: content.kpis.published.value, engagement: content.kpis.engagement.value },
      projects: { active: projects.kpis.active.value, overdue: projects.kpis.overdue.value },
    },
  };
}
