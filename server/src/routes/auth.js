import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { seedDefaultBots } from '../services/defaultBots.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already registered' });
  const user = await User.create({ name, email, password });
  await seedDefaultBots(user._id);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password || ''))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.patch('/me', requireAuth, async (req, res) => {
  const { name, assistantName, preferences } = req.body || {};
  if (name) req.user.name = name;
  if (assistantName) req.user.assistantName = assistantName;
  if (preferences) req.user.preferences = { ...req.user.preferences.toObject(), ...preferences };
  await req.user.save();
  res.json({ user: req.user });
});

export default router;
