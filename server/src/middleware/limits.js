import crypto from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { MongoRateStore } from '../services/rateLimitStore.js';
import { config } from '../config.js';

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
const ip = (req) => ipKeyGenerator(req.ip || '');

// Who is calling: the logged-in user's token if there is one, otherwise the IP address.
const callerKey = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? `t:${hash(h.slice(7))}` : `ip:${ip(req)}`;
};

const make = (prefix, opts) =>
  rateLimit({
    standardHeaders: 'draft-7', // RateLimit + Retry-After headers (guide §02)
    legacyHeaders: false,
    store: new MongoRateStore(prefix),
    passOnStoreError: true, // if the DB hiccups, don't lock every user out
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
    ...opts,
  });

/** Every API call: API_RATE_LIMIT (default 300) per minute per user, or per IP when logged out. */
export const apiLimiter = make('api', { windowMs: 60_000, limit: config.apiRateLimit, keyGenerator: callerKey });

/** Brute-force protection: 10 failed logins per 15 minutes per IP + email (guide §08, §12). */
export const loginLimiter = make('login', {
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.email || '').toLowerCase().slice(0, 200)}`,
  message: { error: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
});

/** Account creation: 5 per hour per IP. */
export const registerLimiter = make('register', { windowMs: 60 * 60_000, limit: 5, keyGenerator: (req) => ip(req) });

/** Public bot endpoints (inbound API, Telegram webhook): 120 per minute per bot. */
export const integrationLimiter = make('integrations', { windowMs: 60_000, limit: 120, keyGenerator: (req) => `${req.path}:${ip(req)}` });

/** MCP: 120 calls per minute per key (keyed by the key, not the IP — guide §architecture traps). */
export const mcpLimiter = make('mcp', {
  windowMs: 60_000,
  limit: 120,
  keyGenerator: (req) => {
    const h = req.headers.authorization || '';
    const key = req.path.split('/')[1] || (h.startsWith('Bearer ') ? h.slice(7) : '');
    return key ? hash(key) : `ip:${ip(req)}`;
  },
});
