import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Reminder from '../models/Reminder.js';
import Bot from '../models/Bot.js';
import { dispatchToBot } from '../bots/botManager.js';
import { emitToUser } from './realtime.js';
import { parseWhen } from './timeParser.js';
import { pythonAI } from './pythonAI.js';

// The assistant's "hands". Used both by Claude (as tools) and by the rule-based brain.
export function makeActions(user, ctx = {}) {
  const uid = user._id;
  const changed = (kind) => emitToUser(uid, 'data:changed', { kind });

  return {
    async create_task({ title, priority = 'medium', due }) {
      const dueDate = due ? parseWhen(due)?.date || (isNaN(Date.parse(due)) ? undefined : new Date(due)) : undefined;
      const task = await Task.create({ user: uid, title, priority, dueDate });
      changed('tasks');
      return { id: task._id, title: task.title, priority: task.priority, dueDate: task.dueDate };
    },

    async list_tasks({ status } = {}) {
      const q = { user: uid };
      if (status) q.status = status;
      else q.status = { $ne: 'done' };
      const tasks = await Task.find(q).sort({ createdAt: -1 }).limit(20);
      return tasks.map((t) => ({ id: t._id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate }));
    },

    async complete_task({ title }) {
      const task = await Task.findOne({ user: uid, status: { $ne: 'done' }, title: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      if (!task) throw new Error(`No open task matching "${title}"`);
      task.status = 'done';
      await task.save();
      changed('tasks');
      return { id: task._id, title: task.title, status: 'done' };
    },

    async create_note({ title, content = '' }) {
      const analysis = content.length > 200 ? await pythonAI.summarize(content, 2) : null;
      const note = await Note.create({ user: uid, title, content, summary: analysis?.summary || '' });
      changed('notes');
      return { id: note._id, title: note.title };
    },

    async search_notes({ query }) {
      const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const notes = await Note.find({ user: uid, $or: [{ title: rx }, { content: rx }, { tags: rx }] }).limit(10);
      return notes.map((n) => ({ id: n._id, title: n.title, content: n.content.slice(0, 300) }));
    },

    async set_reminder({ text, when }) {
      const parsed = parseWhen(when) || (Date.parse(when) ? { date: new Date(when) } : null);
      if (!parsed) throw new Error(`I couldn't understand the time "${when}". Try "in 10 minutes" or "tomorrow at 9am".`);
      const reminder = await Reminder.create({ user: uid, text, remindAt: parsed.date });
      changed('reminders');
      return { id: reminder._id, text, remindAt: reminder.remindAt.toISOString() };
    },

    async list_reminders() {
      const rs = await Reminder.find({ user: uid, delivered: false }).sort({ remindAt: 1 }).limit(20);
      return rs.map((r) => ({ id: r._id, text: r.text, remindAt: r.remindAt }));
    },

    async list_bots() {
      const bots = await Bot.find({ user: uid });
      return bots.map((b) => ({ handle: b.handle, name: b.name, type: b.type, description: b.description, enabled: b.enabled }));
    },

    async call_bot({ handle, message }) {
      const bot = await Bot.findOne({ user: uid, handle: handle.replace(/^@/, '').toLowerCase(), enabled: true }).select('+apiKey');
      if (!bot) throw new Error(`No enabled bot with handle @${handle}`);
      const { reply, status } = await dispatchToBot(bot, message, { user, conversationId: ctx.conversationId });
      return { bot: bot.handle, status, reply };
    },

    async analyze_text({ text }) {
      const result = await pythonAI.analyze(text);
      if (!result) throw new Error('The Python AI service is offline');
      return result;
    },
  };
}

// JSON-schema tool definitions handed to Claude.
export const toolDefinitions = [
  {
    name: 'create_task',
    description: 'Add a task to the user\'s to-do list.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due: { type: 'string', description: 'Optional due time, natural language ("tomorrow at 5pm") or ISO date' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List the user\'s tasks. Without status, returns open (not done) tasks.',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['todo', 'in_progress', 'done'] } } },
  },
  {
    name: 'complete_task',
    description: 'Mark an open task as done, matched by (part of) its title.',
    input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'create_note',
    description: 'Save a note for the user.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'search_notes',
    description: 'Search the user\'s notes by keyword.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'set_reminder',
    description: 'Schedule a reminder. The user is notified in the app and through their notification bots.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind about' },
        when: { type: 'string', description: 'Natural language like "in 10 minutes", "at 5pm", "tomorrow at 9am", or an ISO timestamp' },
      },
      required: ['text', 'when'],
    },
  },
  { name: 'list_reminders', description: 'List upcoming reminders.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_bots', description: 'List the bots connected to this assistant.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'call_bot',
    description: 'Send a message to one of the user\'s connected bots (by handle) and get its reply. Use for weather, calculations, Wikipedia, custom AI bots, webhooks, or to post to Telegram/Discord/Slack.',
    input_schema: {
      type: 'object',
      properties: { handle: { type: 'string', description: 'Bot handle without @' }, message: { type: 'string' } },
      required: ['handle', 'message'],
    },
  },
  {
    name: 'analyze_text',
    description: 'Run sentiment, keyword and entity analysis on text using the Python AI service.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
];
