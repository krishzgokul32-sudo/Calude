import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import botRoutes from './routes/bots.js';
import integrationRoutes from './routes/integrations.js';
import dashboardRoutes from './routes/dashboard.js';
import { crudRouter } from './routes/crud.js';
import Task from './models/Task.js';
import Note from './models/Note.js';
import Reminder from './models/Reminder.js';
import Lead from './models/Lead.js';
import Invoice from './models/Invoice.js';
import Post from './models/Post.js';
import Project from './models/Project.js';
import analyticsRoutes from './routes/analytics.js';
import connectionRoutes from './routes/integrations-admin.js';
import { emitToUser } from './services/realtime.js';
import { serverKeyConfigured } from './services/llm.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', claude: serverKeyConfigured(), time: new Date().toISOString() }));

  app.use('/api/auth', rateLimit({ windowMs: 15 * 60e3, limit: 100 }), authRoutes);
  app.use('/api/integrations', rateLimit({ windowMs: 60e3, limit: 120 }), integrationRoutes);

  const changed = (kind) => (uid) => emitToUser(uid, 'data:changed', { kind });
  app.use('/api/chat', requireAuth, chatRoutes);
  app.use('/api/bots', requireAuth, botRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);
  app.use('/api/tasks', requireAuth, crudRouter(Task, { allowed: ['title', 'description', 'status', 'priority', 'dueDate', 'tags', 'project'], onChange: changed('tasks') }));
  app.use('/api/notes', requireAuth, crudRouter(Note, { allowed: ['title', 'content', 'color', 'pinned', 'tags'], sort: { pinned: -1, updatedAt: -1 }, onChange: changed('notes') }));
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/connections', requireAuth, connectionRoutes);
  app.use('/api/leads', requireAuth, crudRouter(Lead, { allowed: ['name', 'company', 'email', 'phone', 'source', 'stage', 'value', 'notes'], onChange: changed('leads') }));
  app.use('/api/invoices', requireAuth, crudRouter(Invoice, { allowed: ['number', 'client', 'amount', 'kind', 'category', 'status', 'issueDate', 'dueDate', 'paidAt'], sort: { issueDate: -1 }, onChange: changed('invoices') }));
  app.use('/api/posts', requireAuth, crudRouter(Post, { allowed: ['title', 'platform', 'status', 'scheduledAt', 'publishedAt', 'views', 'likes', 'comments', 'shares'], onChange: changed('posts') }));
  app.use('/api/projects', requireAuth, crudRouter(Project, { allowed: ['name', 'client', 'status', 'budget', 'deadline'], onChange: changed('projects') }));
  app.use('/api/reminders', requireAuth, crudRouter(Reminder, { allowed: ['text', 'remindAt', 'repeat', 'delivered'], sort: { remindAt: 1 }, onChange: changed('reminders') }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
