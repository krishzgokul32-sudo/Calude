import { Router } from 'express';
import Bot, { BOT_TYPES, BUILTIN_SKILLS } from '../models/Bot.js';
import BotLog from '../models/BotLog.js';
import { dispatchToBot } from '../bots/botManager.js';
import { connectTelegramBot } from '../bots/telegramBridge.js';
import { config } from '../config.js';
import crypto from 'node:crypto';

const router = Router();
const EDITABLE = ['name', 'handle', 'type', 'description', 'avatar', 'color', 'triggers', 'enabled', 'notify', 'config'];
const pick = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => EDITABLE.includes(k)));

function validateConfig(type, cfg = {}) {
  const need = (key, label) => {
    if (!cfg[key]) throw Object.assign(new Error(`${label} is required for ${type} bots`), { status: 400 });
  };
  if (type === 'builtin') {
    need('skill', 'Skill');
    if (!BUILTIN_SKILLS.includes(cfg.skill)) throw Object.assign(new Error(`Unknown skill ${cfg.skill}`), { status: 400 });
  }
  if (type === 'webhook') {
    need('url', 'Webhook URL');
    if (!/^https?:\/\//.test(cfg.url)) throw Object.assign(new Error('Webhook URL must start with http(s)://'), { status: 400 });
  }
  if (type === 'telegram') need('token', 'Bot token');
  if (type === 'discord' || type === 'slack') need('webhookUrl', 'Webhook URL');
}

const credentialsFor = (bot) => ({
  apiKey: bot.apiKey,
  inboundUrl: `${config.publicApiUrl}/api/integrations/inbound/${bot._id}`,
  curl: `curl -X POST ${config.publicApiUrl}/api/integrations/inbound/${bot._id} \\\n  -H "Content-Type: application/json" \\\n  -H "X-Bot-Key: ${bot.apiKey}" \\\n  -d '{"text":"add task review pull request","sessionId":"my-bot-chat-1"}'`,
});

router.get('/meta', (req, res) => {
  res.json({
    types: BOT_TYPES,
    skills: BUILTIN_SKILLS,
    descriptions: {
      builtin: 'Ready-made skills that run inside the assistant.',
      ai: 'An AI persona with its own personality and instructions (Claude).',
      webhook: 'Your own bot server. We POST each message, you reply with JSON.',
      telegram: 'Connect a Telegram bot: chat with your assistant from Telegram & get reminders there.',
      discord: 'Send messages and reminders to a Discord channel via webhook.',
      slack: 'Send messages and reminders to a Slack channel via webhook.',
    },
  });
});

router.get('/', async (req, res) => {
  const bots = await Bot.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json(bots.map((b) => b.toSafeJSON()));
});

router.post('/', async (req, res) => {
  const data = pick(req.body);
  validateConfig(data.type, data.config);
  const bot = await Bot.create({ ...data, user: req.user._id });
  let warning;
  if (bot.type === 'telegram') {
    try {
      const me = await connectTelegramBot(bot);
      bot.config = { ...bot.config, username: me.username };
      bot.markModified('config');
      await bot.save();
    } catch (e) {
      warning = `Saved, but Telegram connection failed: ${e.response?.data?.description || e.message}`;
    }
  }
  const full = await Bot.findById(bot._id).select('+apiKey');
  res.status(201).json({ bot: full.toSafeJSON(), credentials: credentialsFor(full), warning });
});

router.patch('/:id', async (req, res) => {
  const bot = await Bot.findOne({ _id: req.params.id, user: req.user._id });
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  const data = pick(req.body);
  if (data.config) {
    // Keep the existing secret token if the UI sends back the masked value.
    if (String(data.config.token || '').startsWith('••••')) data.config.token = bot.config.token;
    data.config = { ...bot.config, ...data.config };
    validateConfig(data.type || bot.type, data.config);
  }
  Object.assign(bot, data);
  bot.markModified('config');
  await bot.save();
  res.json(bot.toSafeJSON());
});

router.delete('/:id', async (req, res) => {
  const bot = await Bot.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  await BotLog.deleteMany({ bot: bot._id });
  res.json({ ok: true });
});

router.post('/:id/test', async (req, res) => {
  const bot = await Bot.findOne({ _id: req.params.id, user: req.user._id }).select('+apiKey');
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  const message = String(req.body?.message || 'Hello from the Bot Hub test console! 👋');
  res.json(await dispatchToBot(bot, message, { user: req.user }));
});

router.get('/:id/logs', async (req, res) => {
  const bot = await Bot.exists({ _id: req.params.id, user: req.user._id });
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  res.json(await BotLog.find({ bot: req.params.id }).sort({ createdAt: -1 }).limit(50));
});

router.get('/:id/credentials', async (req, res) => {
  const bot = await Bot.findOne({ _id: req.params.id, user: req.user._id }).select('+apiKey');
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  res.json(credentialsFor(bot));
});

router.post('/:id/rotate-key', async (req, res) => {
  const bot = await Bot.findOne({ _id: req.params.id, user: req.user._id }).select('+apiKey');
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  bot.apiKey = 'pa_' + crypto.randomBytes(24).toString('hex');
  await bot.save();
  if (bot.type === 'telegram') await connectTelegramBot(bot).catch(() => {});
  res.json(credentialsFor(bot));
});

export default router;
