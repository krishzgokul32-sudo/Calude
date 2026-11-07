import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import User, { setUserChangeHook } from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, config.jwtSecret, { expiresIn: '7d' });
}

// Signed-in users are looked up once per 15 s instead of on every request (guide §12: verify tokens
// efficiently). Each request still gets its own document (hydrated from a plain copy), so concurrent
// requests never share or mutate the same object. Saving a user clears its entry.
const USER_TTL_MS = 15_000;
const { BSON } = mongoose.mongo;
// Exact copy that keeps ObjectIds and Dates intact.
const copy = (doc) => BSON.deserialize(BSON.serialize(doc));
const userCache = new Map(); // id -> { data, expires }

/** Routes that change the user load a fresh document (the cached copy is read-only by design). */
export async function freshUser(req) {
  const user = await User.findById(req.user._id);
  if (!user) throw Object.assign(new Error('User not found'), { status: 401 });
  return user;
}

export function forgetUser(id) {
  userCache.delete(String(id));
}
setUserChangeHook(forgetUser);

export async function userFromToken(token) {
  const { id } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  const hit = userCache.get(id);
  if (hit && hit.expires > Date.now()) return User.hydrate(copy(hit.data));
  const data = await User.findById(id).lean();
  if (!data) {
    userCache.delete(id);
    return null;
  }
  if (userCache.size > 10_000) userCache.delete(userCache.keys().next().value);
  userCache.set(id, { data, expires: Date.now() + USER_TTL_MS });
  return User.hydrate(copy(data));
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
