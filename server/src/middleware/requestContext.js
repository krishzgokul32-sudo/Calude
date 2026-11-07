import crypto from 'node:crypto';
import { log } from '../services/logger.js';
import { metrics } from '../services/metrics.js';

/** Gives every request an id (returned as X-Request-Id), logs it with its latency, records metrics. */
export function requestContext(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.record(res.statusCode, ms);
    if (req.path.startsWith('/api/health')) return;
    const fields = { id: req.id, method: req.method, path: req.originalUrl.replace(/\/api\/mcp\/[^/?]+/, '/api/mcp/<key>'), status: res.statusCode, ms: Math.round(ms) };
    if (res.statusCode >= 500) log.error('request', fields);
    else if (ms > 2000) log.warn('slow request', fields);
    else log.debug('request', fields);
  });
  next();
}

/** Remove keys like "$gt" or "a.b" from JSON bodies so they can't become Mongo operators (guide §08). */
export function sanitizeBody(req, res, next) {
  const clean = (v, depth = 0) => {
    if (depth > 20 || v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
    for (const k of Object.keys(v)) {
      if (k.startsWith('$') || k.includes('.')) delete v[k];
      else v[k] = clean(v[k], depth + 1);
    }
    return v;
  };
  if (req.body && typeof req.body === 'object') clean(req.body);
  next();
}
