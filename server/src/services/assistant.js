import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { findBotForMessage, dispatchToBot } from '../bots/botManager.js';
import { llmAvailable, runClaude } from './llm.js';
import { localReply } from './localBrain.js';
import { makeActions, toolDefinitions } from './actions.js';
import { pythonAI } from './pythonAI.js';
import { takeAiQuota } from './aiQuota.js';

export const MAX_MESSAGE_LENGTH = 8000;
import { emitToUser } from './realtime.js';

function systemPrompt(user) {
  return `You are ${user.assistantName}, the personal assistant of ${user.name}.
You manage their tasks, notes and reminders, and you can talk to the bots they have connected (call list_bots to see them, call_bot to use one).
Use tools to take real actions instead of only describing them. Be warm, concise and use Markdown.
Current time: ${new Date().toISOString()} (convert relative times like "in 2 hours" yourself or pass them as-is to set_reminder).`;
}

async function getConversation(user, { conversationId, channel = 'web', externalId }) {
  if (conversationId) {
    const c = await Conversation.findOne({ _id: conversationId, user: user._id });
    if (c) return c;
  }
  if (externalId) {
    // Atomic upsert + unique index: two messages arriving together can't create two conversations (guide §13).
    try {
      return await Conversation.findOneAndUpdate(
        { user: user._id, channel, externalId: String(externalId) },
        { $setOnInsert: { title: 'New conversation', lastMessageAt: new Date() } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      return Conversation.findOne({ user: user._id, channel, externalId: String(externalId) });
    }
  }
  return Conversation.create({ user: user._id, channel });
}

/**
 * The single entry point for every message, whatever the channel
 * (web UI, Socket.IO, Telegram, the inbound bot API...).
 */
export async function handleMessage(user, text, opts = {}) {
  text = String(text ?? '').trim();
  if (!text) throw Object.assign(new Error('Message text is required'), { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) throw Object.assign(new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`), { status: 400 });
  const conversation = await getConversation(user, opts);
  const isFirst = (await Message.countDocuments({ conversation: conversation._id })) === 0;

  const history = (await Message.find({ conversation: conversation._id, role: { $in: ['user', 'assistant', 'bot'] } }).sort({ createdAt: -1 }).limit(20))
    .reverse()
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

  const analysis = await pythonAI.analyze(text); // optional insights; null if service is down
  const userMessage = await Message.create({
    conversation: conversation._id,
    user: user._id,
    role: 'user',
    content: text,
    meta: { channel: opts.channel || 'web', sentiment: analysis?.sentiment },
  });
  emitToUser(user._id, 'assistant:status', { conversationId: conversation._id, status: 'thinking' });

  let reply;
  try {
    // 1) Direct bot routing (@mention or trigger word)
    const routed = await findBotForMessage(user._id, text);
    if (routed) {
      const { reply: botReply, status } = await dispatchToBot(routed.bot, routed.text, { user, conversationId: conversation._id, history });
      reply = await Message.create({
        conversation: conversation._id,
        user: user._id,
        role: 'bot',
        bot: routed.bot._id,
        content: botReply,
        meta: { botName: routed.bot.name, botHandle: routed.bot.handle, avatar: routed.bot.avatar, color: routed.bot.color, status },
      });
    } else {
      // 2) The assistant brain: Claude with tools, or the rule-based fallback
      const actions = makeActions(user, { conversationId: conversation._id });
      let useClaude = await llmAvailable(user);
      let quotaNote = '';
      if (useClaude) {
        const quota = await takeAiQuota(user._id);
        if (!quota.ok) {
          useClaude = false;
          quotaNote = `\n\n_You've used today's ${quota.limit} AI messages, so I answered with my basic brain. The limit resets at midnight UTC._`;
        }
      }
      const result = useClaude
        ? await runClaude({
            user,
            system: systemPrompt(user),
            messages: [...history, { role: 'user', content: text }],
            tools: toolDefinitions,
            executeTool: (name, input) => {
              if (!actions[name]) throw new Error(`Unknown tool ${name}`);
              return actions[name](input);
            },
          })
        : await localReply(user, text, actions);
      reply = await Message.create({
        conversation: conversation._id,
        user: user._id,
        role: 'assistant',
        content: result.text + quotaNote,
        meta: { actions: result.actions, engine: useClaude ? 'claude' : 'local' },
      });
    }
  } catch (err) {
    console.error('Assistant error:', err);
    reply = await Message.create({
      conversation: conversation._id,
      user: user._id,
      role: 'assistant',
      content: `⚠️ Something went wrong: ${err.message}`,
      meta: { error: true },
    });
  }

  conversation.lastMessageAt = new Date();
  if (isFirst) conversation.title = text.slice(0, 48) + (text.length > 48 ? '…' : '');
  await conversation.save();

  emitToUser(user._id, 'assistant:status', { conversationId: conversation._id, status: 'idle' });
  emitToUser(user._id, 'message:new', { conversationId: conversation._id, messages: [userMessage, reply] });
  return { conversation, userMessage, reply };
}
