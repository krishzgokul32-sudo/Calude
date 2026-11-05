export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
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
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
