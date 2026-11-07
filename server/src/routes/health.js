import { Router } from 'express';
import { dbReady, pingDB } from '../db.js';
import { metrics } from '../services/metrics.js';
import { serverKeyConfigured } from '../services/llm.js';
import { config } from '../config.js';

export const healthRoutes = Router();
let shuttingDown = false;
export const markShuttingDown = () => {
  shuttingDown = true;
};

// Liveness: the process is up. Never touches the DB, so a slow DB doesn't get the container killed.
healthRoutes.get('/', (req, res) => res.json({ status: 'ok', claude: serverKeyConfigured(), time: new Date().toISOString() }));

// Readiness: can this instance serve traffic right now? Load balancers stop routing to it on 503.
healthRoutes.get('/ready', async (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
  try {
    if (!dbReady()) throw new Error('not connected');
    const t = Date.now();
    await pingDB();
    res.json({ status: 'ready', db: { ok: true, pingMs: Date.now() - t } });
  } catch (err) {
    res.status(503).json({ status: 'db_unreachable', error: err.message });
  }
});

// Metrics: latency percentiles, RPS, errors, memory, event-loop delay.
// Open to localhost; elsewhere it needs `Authorization: Bearer <METRICS_TOKEN>`.
healthRoutes.get('/metrics', (req, res) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const ok = local || (config.metricsToken && req.headers.authorization === `Bearer ${config.metricsToken}`);
  if (!ok) return res.status(401).json({ error: 'Metrics need METRICS_TOKEN' });
  res.json(metrics.snapshot());
});
