import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Bot from '../models/Bot.js';
import User from '../models/User.js';
import BotLog from '../models/BotLog.js';
import { telegram } from './connectors.js';
import { config } from '../config.js';
import { handleMessage } from '../services/assistant.js';
import { acquireLease, releaseLease, every } from '../services/resilience.js';
import { log } from '../services/logger.js';

// Telegram's secret_token only allows [A-Za-z0-9_-]; derive it from the bot's api key.
export const telegramSecret = (bot) => crypto.createHash('sha256').update(bot.apiKey).digest('hex').slice(0, 48);

export const useWebhookMode = () => config.publicApiUrl.startsWith('https://');

/**
 * Remember which updates were handled. Telegram re-sends webhooks it thinks failed, and a poller can see
 * an update twice around a restart: each update_id is processed exactly once (guide §07, §09).
 */
let dedupeIndex = false;
async function firstTime(botId, updateId) {
  const coll = mongoose.connection.collection('processed_updates');
  if (!dedupeIndex) {
    dedupeIndex = true;
    await coll.createIndex({ at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }).catch(() => {});
  }
  try {
    await coll.insertOne({ _id: `tg:${botId}:${updateId}`, at: new Date() });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

/**
 * Handle one Telegram update: the bot owner talks to their assistant from Telegram.
 * The first chat that messages the bot is linked; other chats are refused (private assistant).
 */
export async function handleTelegramUpdate(bot, update) {
  if (update?.update_id !== undefined && !(await firstTime(bot._id, update.update_id))) return;
  const msg = update.message || update.edited_message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);

  if (!bot.config?.chatId) {
    // Link atomically: if two chats write at the same moment, only one wins (guide §13).
    const linked = await Bot.findOneAndUpdate(
      { _id: bot._id, 'config.chatId': { $exists: false } },
      { $set: { 'config.chatId': chatId } },
      { returnDocument: 'after' }
    );
    bot.config = { ...bot.config, chatId: linked?.config?.chatId ?? (await Bot.findById(bot._id).lean())?.config?.chatId };
  }
  if (bot.config.chatId !== chatId) {
    await telegram.send(bot.config.token, chatId, '🔒 This assistant is private.');
    return;
  }

  if (msg.text === '/start') {
    await telegram.send(bot.config.token, chatId, '👋 Connected! You can now talk to your personal assistant right here.');
    return;
  }

  const owner = await User.findById(bot.user);
  if (!owner) return;
  await BotLog.create({ bot: bot._id, user: bot.user, direction: 'in', input: msg.text.slice(0, 2000) });
  const { reply } = await handleMessage(owner, msg.text.slice(0, 8000), { channel: 'telegram', externalId: chatId });
  await telegram.send(bot.config.token, chatId, reply.content);
}

/** Configure a newly created/updated Telegram bot: verify the token and connect delivery. */
export async function connectTelegramBot(bot) {
  const me = await telegram.getMe(bot.config.token); // throws on a bad token
  if (useWebhookMode()) {
    const full = await Bot.findById(bot._id).select('+apiKey');
    await telegram.setWebhook(bot.config.token, bot._id, telegramSecret(full));
  } else {
    // Local development: no public URL, so we long-poll instead.
    await telegram.deleteWebhook(bot.config.token).catch(() => {});
  }
  return me;
}

// ---- Long-polling (used when PUBLIC_API_URL is not https) --------------------
// Telegram allows only one getUpdates consumer per bot, so with several API instances only the
// instance holding the "telegram-poller" lease polls; another takes over if it dies.
const LEASE = 'telegram-poller';
const LEASE_MS = 20_000;
let job;

async function pollOnce() {
  if (!(await acquireLease(LEASE, LEASE_MS))) return;
  const bots = await Bot.find({ type: 'telegram', enabled: true, 'config.token': { $exists: true } }).select('+apiKey');
  await Promise.allSettled(
    bots.map(async (bot) => {
      const data = await telegram.getUpdates(bot.config.token, bot.config.offset || 0);
      if (!data.ok) return;
      for (const update of data.result) {
        await handleTelegramUpdate(bot, update).catch((e) => log.error('telegram update failed', { bot: String(bot._id), error: e.message }));
        // Move the offset forward even if handling failed, so one bad update can't block the bot forever.
        await Bot.updateOne({ _id: bot._id }, { $max: { 'config.offset': update.update_id + 1 } });
        bot.config.offset = update.update_id + 1;
      }
    })
  );
}

export function startTelegramPolling() {
  if (useWebhookMode() || job) return;
  job = every(3000, pollOnce, 'telegram poller');
  log.info('Telegram long-polling enabled (set an https PUBLIC_API_URL to use webhooks)');
}

export async function stopTelegramPolling() {
  job?.stop();
  await releaseLease(LEASE);
}
