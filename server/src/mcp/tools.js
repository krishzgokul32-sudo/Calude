import { z } from 'zod';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Lead, { LEAD_SOURCES, LEAD_STAGES } from '../models/Lead.js';
import Invoice, { INVOICE_STATUSES } from '../models/Invoice.js';
import Post, { PLATFORMS, POST_STATUSES } from '../models/Post.js';
import Project, { PROJECT_STATUSES } from '../models/Project.js';
import { makeActions } from '../services/actions.js';
import { overviewAnalytics, projectAnalytics } from '../services/analytics.js';
import { parseWhen } from '../services/timeParser.js';
import { emitToUser } from '../services/realtime.js';

const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true });
const run = (fn) => async (args) => {
  try {
    return ok(await fn(args || {}));
  } catch (e) {
    if (e.name === 'CastError') return fail(`"${e.value}" is not a valid id. Use an id from a list tool.`);
    if (e.name === 'ValidationError') return fail(Object.values(e.errors).map((x) => x.message).join(', '));
    return fail(e.message || 'Tool failed');
  }
};

const id = z.string().min(1).describe('Record id from a list tool.');
const limit = z.number().int().min(1).max(100).optional().describe('Default 25.');
const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const toDate = (v) => {
  if (v == null || v === '') return v;
  const d = parseWhen(v)?.date || new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Couldn't understand the date "${v}". Use YYYY-MM-DD.`);
  return d;
};
// Copy only the fields the caller actually sent: omitted = leave alone, null = clear.
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// Only the fields a person sees on screen.
const taskOut = (t) => ({ id: String(t._id), title: t.title, description: t.description || undefined, status: t.status, priority: t.priority, dueDate: t.dueDate, projectId: t.project ? String(t.project) : undefined });
const noteOut = (n) => ({ id: String(n._id), title: n.title, content: n.content, pinned: n.pinned, updatedAt: n.updatedAt });
const leadOut = (l) => ({ id: String(l._id), name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, stage: l.stage, value: l.value, notes: l.notes, createdAt: l.createdAt });
const invoiceOut = (i) => ({ id: String(i._id), number: i.number, client: i.client, amount: i.amount, kind: i.kind, category: i.category, status: i.status, issueDate: i.issueDate, dueDate: i.dueDate, paidAt: i.paidAt });
const postOut = (p) => ({ id: String(p._id), title: p.title, platform: p.platform, status: p.status, scheduledAt: p.scheduledAt, publishedAt: p.publishedAt, views: p.views, likes: p.likes, comments: p.comments, shares: p.shares });

/**
 * Every tool as [name, meta, handler]. ctx.user is the GK user who owns the key;
 * every query is scoped to that user, exactly like the app's own routes.
 */
export function toolDefinitions(ctx) {
  const user = ctx.user;
  const uid = user._id;
  const actions = makeActions(user);
  const changed = (kind) => emitToUser(uid, 'data:changed', { kind });

  return [
    ['get_workspace_info', {
      title: 'Workspace info',
      description: "Call first. Returns the user's name, assistant name, currency, current time, the allowed values for every status/stage/priority field, and projects (id, name). Use these values in the create and update tools.",
      inputSchema: {},
    }, run(async () => ({
      user: user.name,
      assistant: user.assistantName,
      currency: user.preferences?.currency || 'INR',
      now: new Date().toISOString(),
      allowedValues: {
        taskStatus: TASK_STATUSES, priority: PRIORITIES, leadStage: LEAD_STAGES, leadSource: LEAD_SOURCES,
        invoiceStatus: INVOICE_STATUSES, invoiceKind: ['income', 'expense'], postPlatform: PLATFORMS, postStatus: POST_STATUSES, projectStatus: PROJECT_STATUSES,
      },
      projects: (await Project.find({ user: uid }).sort({ createdAt: -1 }).lean()).map((p) => ({ id: String(p._id), name: p.name })),
    }))],

    ['get_business_summary', {
      title: 'Business summary',
      description: 'Headline numbers for every team over a period: revenue, new leads, content views, tasks completed (each with % change vs the previous period), open pipeline, win rate, profit, outstanding invoices, engagement, active projects and overdue tasks.',
      inputSchema: { days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).optional().describe('Period length in days. Default 30.') },
    }, run(async ({ days }) => {
      const d = await overviewAnalytics(uid, days || 30);
      return { periodDays: days || 30, currency: user.preferences?.currency || 'INR', kpis: d.kpis, teams: d.teams };
    })],

    ['list_tasks', {
      title: 'List tasks',
      description: 'List tasks, newest first. Without status, returns open tasks (not done). Returns [{ id, title, status, priority, dueDate, projectId }]. Pass id to update_task.',
      inputSchema: {
        status: z.enum(TASK_STATUSES).optional(),
        search: z.string().optional().describe('Words in the title.'),
        projectId: z.string().optional().describe('Only tasks in this project (id from get_workspace_info).'),
        limit,
      },
    }, run(async ({ status, search, projectId, limit: n }) => {
      const q = { user: uid, status: status || { $ne: 'done' } };
      if (search) q.title = rx(search);
      if (projectId) q.project = projectId;
      return (await Task.find(q).sort({ createdAt: -1 }).limit(n || 25).lean()).map(taskOut);
    })],

    ['create_task', {
      title: 'Create a task',
      description: 'Add a task. Returns the new task with its id. Confirm the title with the user before calling.',
      inputSchema: {
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        priority: z.enum(PRIORITIES).optional(),
        dueDate: z.string().optional().describe('YYYY-MM-DD, or natural language like "tomorrow at 5pm".'),
        projectId: z.string().optional(),
      },
    }, run(async (a) => {
      const task = await Task.create({ user: uid, title: a.title, description: a.description, priority: a.priority, dueDate: toDate(a.dueDate), project: a.projectId });
      changed('tasks');
      return taskOut(task);
    })],

    ['update_task', {
      title: 'Update a task',
      description: 'Change fields on a task, e.g. status "done" to complete it. Omit a field to leave it alone; send null for dueDate or projectId to clear it. Returns the updated task.',
      inputSchema: {
        id,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        status: z.enum(TASK_STATUSES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        dueDate: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
      },
    }, run(async ({ id: taskId, ...a }) => {
      const patch = pick(a, ['title', 'description', 'status', 'priority']);
      if (a.dueDate !== undefined) patch.dueDate = a.dueDate === null ? null : toDate(a.dueDate);
      if (a.projectId !== undefined) patch.project = a.projectId;
      const task = await Task.findOneAndUpdate({ _id: taskId, user: uid }, patch, { returnDocument: 'after', runValidators: true });
      if (!task) throw new Error(`Task ${taskId} not found`);
      changed('tasks');
      return taskOut(task);
    })],

    ['search_notes', {
      title: 'Search notes',
      description: 'Find notes whose title, text or tags contain the query. Leave query empty for the latest notes. Returns [{ id, title, content, pinned, updatedAt }].',
      inputSchema: { query: z.string().optional(), limit },
    }, run(async ({ query, limit: n }) => {
      const q = { user: uid };
      if (query) q.$or = [{ title: rx(query) }, { content: rx(query) }, { tags: rx(query) }];
      return (await Note.find(q).sort({ pinned: -1, updatedAt: -1 }).limit(n || 25).lean()).map(noteOut);
    })],

    ['create_note', {
      title: 'Save a note',
      description: 'Save a note. Returns its id and title.',
      inputSchema: { title: z.string().min(1).max(200), content: z.string().max(20000).optional() },
    }, run((a) => actions.create_note(a))],

    ['list_reminders', {
      title: 'List reminders',
      description: 'Upcoming reminders that have not fired yet, soonest first. Returns [{ id, text, remindAt }].',
      inputSchema: {},
    }, run(() => actions.list_reminders())],

    ['set_reminder', {
      title: 'Set a reminder',
      description: 'Schedule a reminder. GK notifies the user in the app and through their notification bots. Returns { id, text, remindAt }.',
      inputSchema: {
        text: z.string().min(1).max(500).describe('What to remind about.'),
        when: z.string().min(1).describe('"in 20 minutes", "at 5pm", "tomorrow at 9:30" or an ISO timestamp.'),
      },
    }, run((a) => actions.set_reminder(a))],

    ['list_leads', {
      title: 'List leads',
      description: 'Sales leads, newest first, optionally filtered by stage, source or a search on name/company/email/phone. Returns [{ id, name, company, source, stage, value, ... }]. Pass id to update_lead.',
      inputSchema: { stage: z.enum(LEAD_STAGES).optional(), source: z.enum(LEAD_SOURCES).optional(), search: z.string().optional(), limit },
    }, run(async ({ stage, source, search, limit: n }) => {
      const q = { user: uid };
      if (stage) q.stage = stage;
      if (source) q.source = source;
      if (search) q.$or = ['name', 'company', 'email', 'phone'].map((k) => ({ [k]: rx(search) }));
      return (await Lead.find(q).sort({ createdAt: -1 }).limit(n || 25).lean()).map(leadOut);
    })],

    ['create_lead', {
      title: 'Add a lead',
      description: 'Add a sales lead. Returns the new lead with its id.',
      inputSchema: {
        name: z.string().min(1).max(200),
        company: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        phone: z.string().max(50).optional(),
        source: z.enum(LEAD_SOURCES).optional(),
        stage: z.enum(LEAD_STAGES).optional(),
        value: z.number().min(0).optional().describe('Deal value in the workspace currency.'),
        notes: z.string().max(5000).optional(),
      },
    }, run(async (a) => {
      const lead = await Lead.create({ user: uid, ...a });
      changed('leads');
      return leadOut(lead);
    })],

    ['update_lead', {
      title: 'Update a lead',
      description: 'Change fields on a lead, e.g. move it to stage "won". Omit a field to leave it alone. Returns the updated lead.',
      inputSchema: {
        id,
        name: z.string().min(1).max(200).optional(),
        company: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        phone: z.string().max(50).optional(),
        source: z.enum(LEAD_SOURCES).optional(),
        stage: z.enum(LEAD_STAGES).optional(),
        value: z.number().min(0).optional(),
        notes: z.string().max(5000).optional(),
      },
    }, run(async ({ id: leadId, ...a }) => {
      const lead = await Lead.findOneAndUpdate({ _id: leadId, user: uid }, pick(a, ['name', 'company', 'email', 'phone', 'source', 'stage', 'value', 'notes']), { returnDocument: 'after', runValidators: true });
      if (!lead) throw new Error(`Lead ${leadId} not found`);
      changed('leads');
      return leadOut(lead);
    })],

    ['list_invoices', {
      title: 'List invoices',
      description: 'Invoices and expenses, newest first. Filter by status (e.g. "overdue") or kind. Returns [{ id, number, client, amount, kind, status, issueDate, dueDate, paidAt }]. Pass id to update_invoice.',
      inputSchema: { status: z.enum(INVOICE_STATUSES).optional(), kind: z.enum(['income', 'expense']).optional(), search: z.string().optional().describe('Invoice number or client.'), limit },
    }, run(async ({ status, kind, search, limit: n }) => {
      const q = { user: uid };
      if (status) q.status = status;
      if (kind) q.kind = kind;
      if (search) q.$or = [{ number: rx(search) }, { client: rx(search) }];
      return (await Invoice.find(q).sort({ issueDate: -1 }).limit(n || 25).lean()).map(invoiceOut);
    })],

    ['create_invoice', {
      title: 'Log an invoice or expense',
      description: 'Record an invoice (kind "income") or an expense (kind "expense"). Returns it with its id.',
      inputSchema: {
        number: z.string().min(1).max(50),
        client: z.string().min(1).max(200).describe('Client for income, payee for an expense.'),
        amount: z.number().min(0),
        kind: z.enum(['income', 'expense']).optional(),
        category: z.string().max(80).optional(),
        status: z.enum(INVOICE_STATUSES).optional(),
        issueDate: z.string().optional().describe('YYYY-MM-DD. Default today.'),
        dueDate: z.string().optional().describe('YYYY-MM-DD.'),
      },
    }, run(async (a) => {
      const inv = await Invoice.create({
        user: uid,
        ...pick(a, ['number', 'client', 'amount', 'kind', 'category', 'status']),
        issueDate: a.issueDate ? toDate(a.issueDate) : new Date(),
        dueDate: toDate(a.dueDate),
        paidAt: a.status === 'paid' ? new Date() : undefined,
      });
      changed('invoices');
      return invoiceOut(inv);
    })],

    ['update_invoice', {
      title: 'Update an invoice',
      description: 'Change an invoice, e.g. status "paid" to mark it paid (paidAt defaults to now). Omit a field to leave it alone. Returns the updated invoice.',
      inputSchema: {
        id,
        status: z.enum(INVOICE_STATUSES).optional(),
        amount: z.number().min(0).optional(),
        dueDate: z.string().nullable().optional(),
        paidAt: z.string().nullable().optional(),
      },
    }, run(async ({ id: invId, ...a }) => {
      const patch = pick(a, ['status', 'amount']);
      if (a.dueDate !== undefined) patch.dueDate = a.dueDate === null ? null : toDate(a.dueDate);
      if (a.paidAt !== undefined) patch.paidAt = a.paidAt === null ? null : toDate(a.paidAt);
      else if (a.status === 'paid') patch.paidAt = new Date();
      const inv = await Invoice.findOneAndUpdate({ _id: invId, user: uid }, patch, { returnDocument: 'after', runValidators: true });
      if (!inv) throw new Error(`Invoice ${invId} not found`);
      changed('invoices');
      return invoiceOut(inv);
    })],

    ['list_posts', {
      title: 'List content posts',
      description: 'Content posts, newest first, filtered by status or platform. Returns [{ id, title, platform, status, scheduledAt, publishedAt, views, likes, comments, shares }].',
      inputSchema: { status: z.enum(POST_STATUSES).optional(), platform: z.enum(PLATFORMS).optional(), limit },
    }, run(async ({ status, platform, limit: n }) => {
      const q = { user: uid };
      if (status) q.status = status;
      if (platform) q.platform = platform;
      return (await Post.find(q).sort({ createdAt: -1 }).limit(n || 25).lean()).map(postOut);
    })],

    ['create_post', {
      title: 'Plan a post',
      description: 'Add a content post idea, draft or scheduled post. Returns it with its id.',
      inputSchema: {
        title: z.string().min(1).max(300),
        platform: z.enum(PLATFORMS).optional(),
        status: z.enum(POST_STATUSES).optional(),
        scheduledAt: z.string().optional().describe('YYYY-MM-DD or "tomorrow at 10am", for scheduled posts.'),
      },
    }, run(async (a) => {
      const post = await Post.create({ user: uid, ...pick(a, ['title', 'platform', 'status']), scheduledAt: toDate(a.scheduledAt) });
      changed('posts');
      return postOut(post);
    })],

    ['list_projects', {
      title: 'List projects',
      description: 'Every project with status, client, deadline, budget and progress (done/total tasks). Returns [{ id, name, status, progress, done, total, ... }]. Pass id as projectId to list_tasks or create_task.',
      inputSchema: {},
    }, run(async () => (await projectAnalytics(uid, 30)).projects.map(({ _id, ...p }) => ({ id: String(_id), ...p })))],

    ['list_bots', {
      title: 'List bots',
      description: 'Bots connected to GK. Returns [{ handle, name, type, description, enabled }]. Pass handle to call_bot.',
      inputSchema: {},
    }, run(() => actions.list_bots())],

    ['call_bot', {
      title: 'Message a bot',
      description: 'Send a message to one of the user\'s bots and get its reply. Telegram, Discord and Slack bots deliver it to real people, so confirm the exact text with the user first. Returns { bot, status, reply }.',
      inputSchema: { handle: z.string().min(1).describe('Bot handle from list_bots, without @.'), message: z.string().min(1).max(4000) },
    }, run((a) => actions.call_bot(a))],

    ['delete_task', {
      title: 'Delete a task',
      description: 'Permanently delete a task. There is no undo: always ask the user to confirm the exact task first.',
      inputSchema: { id },
    }, run(async ({ id: taskId }) => {
      const t = await Task.findOneAndDelete({ _id: taskId, user: uid });
      if (!t) throw new Error(`Task ${taskId} not found`);
      changed('tasks');
      return { deleted: taskId, title: t.title };
    })],

    ['delete_note', {
      title: 'Delete a note',
      description: 'Permanently delete a note. There is no undo: always ask the user to confirm the exact note first.',
      inputSchema: { id },
    }, run(async ({ id: noteId }) => {
      const n = await Note.findOneAndDelete({ _id: noteId, user: uid });
      if (!n) throw new Error(`Note ${noteId} not found`);
      changed('notes');
      return { deleted: noteId, title: n.title };
    })],

    ['delete_lead', {
      title: 'Delete a lead',
      description: 'Permanently delete a lead. There is no undo: always ask the user to confirm the exact lead first.',
      inputSchema: { id },
    }, run(async ({ id: leadId }) => {
      const l = await Lead.findOneAndDelete({ _id: leadId, user: uid });
      if (!l) throw new Error(`Lead ${leadId} not found`);
      changed('leads');
      return { deleted: leadId, name: l.name };
    })],
  ];
}
