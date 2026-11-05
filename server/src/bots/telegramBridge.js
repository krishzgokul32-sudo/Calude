import crypto from 'node:crypto';
import Bot from '../models/Bot.js';
import User from '../models/User.js';
import BotLog from '../models/BotLog.js';
import { telegram } from './connectors.js';
import { config } from '../config.js';
import { handleMessage } from '../services/assistant.js';

// Telegram's secret_token only allows [A-Za-z0-9_-]; derive it from the bot's api key.
export const telegramSecret = (bot) => crypto.createHash('sha256').update(bot.apiKey).digest('hex').slice(0, 48);

export const useWebhookMode = () => config.publicApiUrl.startsWith('https://');

/**
 * Handle one Telegram update: the bot owner talks to their assistant from Telegram.
 * The first chat that messages the bot is linked; other chats are refused (private assistant).
 */
export async function handleTelegramUpdate(bot, update) {
  const msg = update.message || update.edited_message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);

  if (!bot.config.chatId) {
    bot.config = { ...bot.config, chatId };
    bot.markModified('config');
    await bot.save();
  } else if (bot.config.chatId !== chatId) {
    await telegram.send(bot.config.token, chatId, '🔒 This assistant is private.');
    return;
  }

  if (msg.text === '/start') {
    await telegram.send(bot.config.token, chatId, `👋 Connected! You can now talk to your personal assistant right here.`);
    return;
  }

  const owner = await User.findById(bot.user);
  if (!owner) return;
  await BotLog.create({ bot: bot._id, user: bot.user, direction: 'in', input: msg.text });
  const { reply } = await handleMessage(owner, msg.text, { channel: 'telegram', externalId: chatId });
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
    await fetch(telegram.api(bot.config.token, 'deleteWebhook')).catch(() => {});
  }
  return me;
}

// ---- Long-polling (used when PUBLIC_API_URL is not https) --------------------
let polling = false;
export function startTelegramPolling() {
  if (useWebhookMode() || polling) return;
  polling = true;
  const tick = async () => {
    const bots = await Bot.find({ type: 'telegram', enabled: true, 'config.token': { $exists: true } }).select('+apiKey');
    await Promise.allSettled(
      bots.map(async (bot) => {
        const offset = bot.config.offset || 0;
        const res = await fetch(telegram.api(bot.config.token, `getUpdates?timeout=0&offset=${offset}`));
        const data = await res.json();
        if (!data.ok) return;
        for (const update of data.result) {
          await handleTelegramUpdate(bot, update).catch((e) => console.error('Telegram:', e.message));
          await Bot.updateOne({ _id: bot._id }, { $set: { 'config.offset': update.update_id + 1 } });
          bot.config.offset = update.update_id + 1;
        }
      })
    );
  };
  setInterval(() => tick().catch(() => {}), 3000);
  console.log('📡 Telegram long-polling enabled (set an https PUBLIC_API_URL to use webhooks)');
}
