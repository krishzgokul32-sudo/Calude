import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { log } from '../services/logger.js';

/**
 * Idempotency keys (guide §02 "double charges and submits", §06 "users click submit five times",
 * §07 "webhook processed twice").
 *
 * A POST that carries `Idempotency-Key: <unique id>` runs once. If the same caller sends the same key
 * again, it gets the stored response back (marked `Idempotent-Replayed: true`) instead of creating a
 * duplicate. While the first request is still running, a repeat gets 409. Keys are scoped to the caller
 * (their token or bot key) and the path, live in MongoDB (shared by every instance) and expire after 24 h.
 */
const TTL_SECONDS = 24 * 60 * 60;
let indexReady = false;
const coll = () => mongoose.connection.collection('idempotency');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function ensureIndex() {
  if (indexReady) return;
  indexReady = true;
  await coll().createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS }).catch((e) => log.warn('idempotency index', { error: e.message }));
}

// Responses on these paths contain secrets (login tokens, new bot / MCP keys) and must never be stored.
const SECRET_PATHS = [/^\/auth\//, /^\/bots\/?$/, /^\/bots\/[^/]+\/rotate-key$/, /^\/mcp-admin\/keys\/?$/];

export async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (req.method !== 'POST' || !key) return next();
  if (SECRET_PATHS.some((rx) => rx.test(req.path))) return next();
  if (typeof key !== 'string' || key.length > 200) return res.status(400).json({ error: 'Invalid Idempotency-Key' });

  const caller = req.headers.authorization || req.headers['x-bot-key'] || req.ip || '';
  const id = hash(`${hash(caller)}|${req.method}|${req.baseUrl}${req.path}|${key}`);
  await ensureIndex();

  try {
    await coll().insertOne({ _id: id, status: 'pending', createdAt: new Date() });
  } catch (err) {
    if (err.code !== 11000) return next(err);
    const prev = await coll().findOne({ _id: id });
    if (prev?.status === 'done') {
      res.set('Idempotent-Replayed', 'true');
      return res.status(prev.code).json(prev.body);
    }
    return res.status(409).json({ error: 'This request is already being processed.' });
  }

  // Capture the JSON response and store it once the request finishes.
  const json = res.json.bind(res);
  res.json = (body) => {
    res.locals.idemBody = body;
    return json(body);
  };
  let finished = false;
  res.on('close', () => {
    // Client went away before we answered: forget the key so a retry can run.
    if (!finished) coll().deleteOne({ _id: id }).catch(() => {});
  });
  res.on('finish', () => {
    finished = true;
    // Server errors are not stored, so the client may safely retry them.
    const done = res.statusCode < 500
      ? coll().updateOne({ _id: id }, { $set: { status: 'done', code: res.statusCode, body: res.locals.idemBody ?? null } })
      : coll().deleteOne({ _id: id });
    done.catch((e) => log.warn('idempotency store failed', { error: e.message }));
  });
  next();
}
