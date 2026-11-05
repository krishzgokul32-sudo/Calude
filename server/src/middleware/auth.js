import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, config.jwtSecret, { expiresIn: '7d' });
}

export async function userFromToken(token) {
  const { id } = jwt.verify(token, config.jwtSecret);
  return User.findById(id);
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
