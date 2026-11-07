import { log } from '../services/logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl.replace(/\/api\/mcp\/[^/?]+/, '/api/mcp/<key>')}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: `Already exists: ${Object.keys(err.keyValue || {}).join(', ')}` });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  // The database is overloaded or unreachable: tell the client to retry instead of a generic 500.
  if (['MongoServerSelectionError', 'MongoWaitQueueTimeoutError', 'MongoNetworkError', 'MongoPoolClearedError'].includes(err.name)) {
    log.error('database unavailable', { id: req.id, error: err.message });
    res.set('Retry-After', '5');
    return res.status(503).json({ error: 'The service is busy. Please try again in a few seconds.', requestId: req.id });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) log.error('unhandled error', { id: req.id, path: req.originalUrl, error: err.message, stack: err.stack });
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message, ...(status >= 500 ? { requestId: req.id } : {}) });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
