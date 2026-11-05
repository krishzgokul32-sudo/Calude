import { Router } from 'express';
import crypto from 'node:crypto';
import Bot from '../models/Bot.js';
import User from '../models/User.js';
import BotLog from '../models/BotLog.js';
import { handleMessage } from '../services/assistant.js';
import { handleTelegramUpdate, telegramSecret } from '../bots/telegramBridge.js';

// Public endpoints that external bots call. Authenticated per bot, not per user session.
const router = Router();

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Inbound bot API — connect ANY bot (Discord bot, WhatsApp bot, a Python script, Zapier...)
 * to the assistant. POST { text, sessionId? } with header X-Bot-Key: <bot api key>.
 */
router.post('/inbound/:botId', async (req, res) => {
  const bot = await Bot.findById(req.params.botId).select('+apiKey').catch(() => null);
  if (!bot || !bot.enabled || !safeEqual(req.get('X-Bot-Key'), bot.apiKey)) {
    return res.status(401).json({ error: 'Invalid bot id or key' });
  }
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: '"text" is required' });
  const owner = await User.findById(bot.user);
  await BotLog.create({ bot: bot._id, user: bot.user, direction: 'in', input: text });
  await Bot.updateOne({ _id: bot._id }, { $inc: { 'stats.messages': 1 }, $set: { 'stats.lastActiveAt': new Date() } });
  const { conversation, reply } = await handleMessage(owner, text, {
    channel: `bot:${bot.handle}`,
    externalId: String(req.body.sessionId || 'default'),
  });
  res.json({ reply: reply.content, conversationId: conversation._id, role: reply.role, meta: reply.meta });
});

/** Telegram webhook (used when PUBLIC_API_URL is https). */
router.post('/telegram/:botId', async (req, res) => {
  const bot = await Bot.findById(req.params.botId).select('+apiKey').catch(() => null);
  if (!bot || bot.type !== 'telegram' || !safeEqual(req.get('X-Telegram-Bot-Api-Secret-Token'), telegramSecret(bot))) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // ack fast; Telegram retries slow webhooks
  handleTelegramUpdate(bot, req.body).catch((e) => console.error('Telegram webhook:', e.message));
});

export default router;
