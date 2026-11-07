import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, signToken, freshUser } from '../middleware/auth.js';
import { seedDefaultBots } from '../services/defaultBots.js';
import { loginLimiter, registerLimiter } from '../middleware/limits.js';
import { cache } from '../services/cache.js';
import { encrypt } from '../services/secrets.js';
import { verifyKey } from '../services/llm.js';

const router = Router();

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

router.post('/register', registerLimiter, async (req, res) => {
  const name = str(req.body?.name, 80);
  const email = str(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (password.length > 200) return res.status(400).json({ error: 'Password is too long' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });
  const user = await User.create({ name, email, password });
  await seedDefaultBots(user._id);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
  const user = email ? await User.findOne({ email }).select('+password') : null;
  if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.patch('/me', requireAuth, async (req, res) => {
  req.user = await freshUser(req);
  const name = str(req.body?.name, 80);
  const assistantName = str(req.body?.assistantName, 40);
  const preferences = req.body?.preferences;
  if (name) req.user.name = name;
  if (assistantName) req.user.assistantName = assistantName;
  if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
    const allowed = ['theme', 'voice', 'city', 'currency', 'accent'];
    const patch = Object.fromEntries(Object.entries(preferences).filter(([k]) => allowed.includes(k)));
    req.user.preferences = { ...req.user.preferences.toObject(), ...patch };
  }
  await req.user.save();
  cache.invalidateUser(req.user._id); // dashboard shows Claude status and currency
  res.json({ user: req.user });
});

// Save the user's own Claude API key (checked with Anthropic first, stored encrypted).
router.put('/me/api-key', requireAuth, async (req, res) => {
  req.user = await freshUser(req);
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!/^sk-ant-[\w-]{10,}$/.test(apiKey)) return res.status(400).json({ error: 'That doesn\'t look like an Anthropic API key (it starts with "sk-ant-").' });
  try {
    await verifyKey(apiKey);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  req.user.anthropicKey = encrypt(apiKey);
  req.user.anthropicKeyHint = apiKey.slice(-4);
  await req.user.save();
  cache.invalidateUser(req.user._id); // dashboard shows Claude status and currency
  res.json({ user: req.user });
});

router.delete('/me/api-key', requireAuth, async (req, res) => {
  req.user = await freshUser(req);
  req.user.anthropicKey = undefined;
  req.user.anthropicKeyHint = '';
  await req.user.save();
  cache.invalidateUser(req.user._id); // dashboard shows Claude status and currency
  res.json({ user: req.user });
});

export default router;
