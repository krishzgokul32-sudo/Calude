import { monitorEventLoopDelay } from 'node:perf_hooks';

// In-process request metrics: rolling window of recent latencies for p50/p95/p99,
// requests per second over the last minute, and error counts (guide §10, §15).
const WINDOW = 5000;
const latencies = new Float64Array(WINDOW);
let n = 0;
const perSecond = new Map(); // epoch second -> count
const status = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
const startedAt = Date.now();

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

export const metrics = {
  record(code, ms) {
    latencies[n++ % WINDOW] = ms;
    status[`${Math.floor(code / 100)}xx`] = (status[`${Math.floor(code / 100)}xx`] || 0) + 1;
    const s = Math.floor(Date.now() / 1000);
    perSecond.set(s, (perSecond.get(s) || 0) + 1);
    if (perSecond.size > 120) for (const k of perSecond.keys()) if (k < s - 60) perSecond.delete(k);
  },
  snapshot() {
    const sorted = Array.from(latencies.slice(0, Math.min(n, WINDOW))).sort((a, b) => a - b);
    const now = Math.floor(Date.now() / 1000);
    let lastMinute = 0;
    for (const [k, v] of perSecond) if (k > now - 60) lastMinute += v;
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      requests: { total: n, rpsLastMinute: Math.round((lastMinute / 60) * 10) / 10, status },
      latencyMs: { p50: Math.round(pct(sorted, 50)), p95: Math.round(pct(sorted, 95)), p99: Math.round(pct(sorted, 99)), sample: sorted.length },
      eventLoopDelayMs: { p50: Math.round(loop.percentile(50) / 1e6), p99: Math.round(loop.percentile(99) / 1e6) },
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
    };
  },
};
