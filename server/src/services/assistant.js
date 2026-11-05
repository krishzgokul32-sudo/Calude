import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { findBotForMessage, dispatchToBot } from '../bots/botManager.js';
import { llmEnabled, runClaude } from './llm.js';
import { localReply } from './localBrain.js';
import { makeActions, toolDefinitions } from './actions.js';
import { pythonAI } from './pythonAI.js';
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
    const c = await Conversation.findOne({ user: user._id, channel, externalId });
    if (c) return c;
  }
  return Conversation.create({ user: user._id, channel, externalId });
}

/**
 * The single entry point for every message, whatever the channel
 * (web UI, Socket.IO, Telegram, the inbound bot API...).
 */
export async function handleMessage(user, text, opts = {}) {
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
      const result = llmEnabled()
        ? await runClaude({
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
        content: result.text,
        meta: { actions: result.actions, engine: llmEnabled() ? 'claude' : 'local' },
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
