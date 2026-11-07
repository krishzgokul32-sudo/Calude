import crypto from 'node:crypto';
import axios from 'axios';
import Bot from '../models/Bot.js';
import BotLog from '../models/BotLog.js';
import { builtinSkills } from './builtins.js';
import { telegram, postDiscord, postSlack } from './connectors.js';
import { llmAvailable, runClaude } from '../services/llm.js';
import { emitToUser } from '../services/realtime.js';
import { withRetry } from '../services/resilience.js';
import { takeAiQuota } from '../services/aiQuota.js';
import { assertPublicUrl } from '../services/urlGuard.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Decide whether a message should go to one of the user's bots.
 * 1. An explicit @handle mention always wins.
 * 2. Otherwise, the first enabled bot whose trigger word appears in the text.
 */
export async function findBotForMessage(userId, text) {
  const bots = await Bot.find({ user: userId, enabled: true }).select('+apiKey');
  const mention = text.match(/(?:^|\s)@([a-z0-9_-]{2,30})\b/i);
  if (mention) {
    const bot = bots.find((b) => b.handle === mention[1].toLowerCase());
    if (bot) return { bot, text: text.replace(mention[0], ' ').trim() || text };
  }
  for (const bot of bots) {
    if (bot.triggers?.some((t) => t && new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text))) {
      return { bot, text };
    }
  }
  return null;
}

export function signPayload(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function runBot(bot, text, ctx) {
  switch (bot.type) {
    case 'builtin': {
      const skill = builtinSkills[bot.config?.skill];
      if (!skill) throw new Error(`Unknown builtin skill "${bot.config?.skill}"`);
      return skill(text, ctx);
    }
    case 'ai': {
      const persona = bot.config?.systemPrompt || `You are ${bot.name}, a helpful bot.`;
      if (!(await llmAvailable(ctx.user))) {
        return `🤖 *${bot.name}* needs an AI key to think. Add one from any provider (Claude, OpenAI, Gemini, Groq…) in **Settings → AI brain**.`;
      }
      const quota = await takeAiQuota(bot.user);
      if (!quota.ok) return `🤖 *${bot.name}* has reached today's limit of ${quota.limit} AI messages. It resets at midnight UTC.`;
      const history = (ctx.history || []).slice(-10);
      const { text: reply } = await runClaude({
        user: ctx.user,
        system: `${persona}\nYou are a bot inside ${ctx.user?.name || 'the user'}'s personal assistant. Keep answers concise and use Markdown.`,
        messages: [...history, { role: 'user', content: text }],
      });
      return reply;
    }
    case 'webhook': {
      if (!bot.config?.url) throw new Error('Webhook URL not configured');
      const body = JSON.stringify({
        event: 'message',
        message: text,
        bot: { id: bot._id, handle: bot.handle, name: bot.name },
        user: { id: ctx.user?._id, name: ctx.user?.name },
        conversationId: ctx.conversationId,
        timestamp: new Date().toISOString(),
      });
      await assertPublicUrl(bot.config.url);
      const { data } = await axios.post(bot.config.url, body, {
        timeout: 10000,
        maxContentLength: 1_000_000, // a misbehaving bot can't flood memory (guide §02 huge payloads)
        maxRedirects: 0, // no redirect hops around the private-network check
        headers: {
          'Content-Type': 'application/json',
          'X-PA-Signature': signPayload(bot.apiKey, body),
          'X-PA-Bot': bot.handle,
          ...(bot.config.headers || {}),
        },
      });
      if (typeof data === 'string') return data.slice(0, 20000);
      return data?.reply ?? data?.text ?? data?.message ?? JSON.stringify(data);
    }
    case 'telegram': {
      if (!bot.config?.chatId) throw new Error('No Telegram chat linked yet — send your bot a message on Telegram first');
      await telegram.send(bot.config.token, bot.config.chatId, text);
      return `📨 Sent to Telegram via ${bot.name}`;
    }
    case 'discord':
      await assertPublicUrl(bot.config.webhookUrl);
      await postDiscord(bot.config.webhookUrl, text);
      return `📨 Posted to Discord via ${bot.name}`;
    case 'slack':
      await assertPublicUrl(bot.config.webhookUrl);
      await postSlack(bot.config.webhookUrl, text);
      return `📨 Posted to Slack via ${bot.name}`;
    default:
      throw new Error(`Unsupported bot type ${bot.type}`);
  }
}

/** Send a message to a bot, log it, update stats, return the reply text. */
export async function dispatchToBot(bot, text, ctx = {}) {
  const started = Date.now();
  let output;
  let status = 'ok';
  try {
    output = String(await runBot(bot, text, ctx));
  } catch (err) {
    status = 'error';
    output = `⚠️ ${bot.name} failed: ${err.response?.data?.description || err.message}`;
  }
  const latencyMs = Date.now() - started;
  await Promise.all([
    BotLog.create({ bot: bot._id, user: bot.user, direction: 'out', status, input: text, output, latencyMs }),
    Bot.updateOne(
      { _id: bot._id },
      { $inc: { 'stats.messages': 1, 'stats.errors': status === 'error' ? 1 : 0 }, $set: { 'stats.lastActiveAt': new Date() } }
    ),
  ]);
  emitToUser(bot.user, 'bot:activity', { botId: bot._id, status, latencyMs });
  return { reply: output, status, latencyMs };
}

/** Push a notification (e.g. a due reminder) through every bot with notify=true. */
export async function notifyThroughBots(userId, text) {
  const bots = await Bot.find({ user: userId, enabled: true, notify: true, type: { $in: ['telegram', 'discord', 'slack'] } });
  // Each bot gets up to 3 tries with backoff, so a brief Telegram/Discord/Slack hiccup doesn't lose a reminder.
  await Promise.allSettled(
    bots.map((b) =>
      withRetry(
        async () => {
          const r = await dispatchToBot(b, text, {});
          if (r.status === 'error') throw new Error(r.reply);
          return r;
        },
        { tries: 3, baseMs: 1000, label: `notify ${b.handle}` }
      )
    )
  );
  return bots.length;
}
