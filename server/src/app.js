import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { notFound, errorHandler, HttpError } from './middleware/errors.js';
import { requestContext, sanitizeBody } from './middleware/requestContext.js';
import { idempotency } from './middleware/idempotency.js';
import { apiLimiter, integrationLimiter, mcpLimiter } from './middleware/limits.js';
import { healthRoutes } from './routes/health.js';
import { log } from './services/logger.js';
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
import mcpAdminRoutes from './routes/mcpAdmin.js';
import { mcpEndpoint } from './mcp/endpoint.js';
import { emitToUser } from './services/realtime.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet());
  app.use(compression()); // gzip responses (guide §05: bandwidth)

  // Liveness/readiness probes for Docker and load balancers (guide §05, §10). No auth, no rate limit.
  app.use('/api/health', healthRoutes);

  // Public MCP endpoint (Claude, Cursor, VS Code…). Mounted before the app's strict CORS and
  // JSON parser: any origin, no cookies, a larger body limit, rate-limited per key.
  const mcpCors = cors({ origin: true, credentials: false, exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'] });
  app.use('/api/mcp', mcpCors, mcpLimiter, express.json({ limit: '5mb' }), sanitizeBody);
  app.all('/api/mcp', mcpEndpoint); // Authorization: Bearer <key>
  app.all('/api/mcp/:key', mcpEndpoint); // key in the URL (Claude custom connectors)

  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' })); // guide §02: enforce body size limits
  app.use(sanitizeBody);
  app.use('/api', apiLimiter); // every API route: 300/min per user or IP
  app.use('/api', idempotency); // POST + Idempotency-Key header runs once

  // Frontend crash reports (guide §06/§10: errors you'd otherwise never see).
  app.post('/api/client-errors', (req, res) => {
    const b = req.body || {};
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);
    log.warn('client error', { id: req.id, message: str(b.message, 500), url: str(b.url, 200), stack: str(b.stack, 2000), componentStack: str(b.componentStack, 1000) });
    res.status(204).end();
  });

  app.use('/api/auth', authRoutes); // login/register have their own stricter limits
  app.use('/api/integrations', integrationLimiter, integrationRoutes);

  const changed = (kind) => (uid) => emitToUser(uid, 'data:changed', { kind });
  app.use('/api/chat', requireAuth, chatRoutes);
  app.use('/api/bots', requireAuth, botRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);
  // A task may only be linked to one of the same user's projects.
  const ownProject = async (data, user) => {
    if (data.project === '' || data.project === undefined) {
      if (data.project === '') data.project = null;
      return;
    }
    if (data.project !== null && !(await Project.exists({ _id: data.project, user: user._id }))) throw new HttpError(400, 'Project not found');
  };
  app.use('/api/tasks', requireAuth, crudRouter(Task, { allowed: ['title', 'description', 'status', 'priority', 'dueDate', 'tags', 'project'], onChange: changed('tasks'), validate: ownProject }));
  app.use('/api/notes', requireAuth, crudRouter(Note, { allowed: ['title', 'content', 'color', 'pinned', 'tags'], sort: { pinned: -1, updatedAt: -1 }, onChange: changed('notes') }));
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/connections', requireAuth, connectionRoutes);
  app.use('/api/mcp-admin', requireAuth, mcpAdminRoutes);
  app.use('/api/leads', requireAuth, crudRouter(Lead, { allowed: ['name', 'company', 'email', 'phone', 'source', 'stage', 'value', 'notes'], onChange: changed('leads') }));
  app.use('/api/invoices', requireAuth, crudRouter(Invoice, { allowed: ['number', 'client', 'amount', 'kind', 'category', 'status', 'issueDate', 'dueDate', 'paidAt'], sort: { issueDate: -1 }, onChange: changed('invoices') }));
  app.use('/api/posts', requireAuth, crudRouter(Post, { allowed: ['title', 'platform', 'status', 'scheduledAt', 'publishedAt', 'views', 'likes', 'comments', 'shares'], onChange: changed('posts') }));
  app.use('/api/projects', requireAuth, crudRouter(Project, { allowed: ['name', 'client', 'status', 'budget', 'deadline'], onChange: changed('projects') }));
  app.use('/api/reminders', requireAuth, crudRouter(Reminder, { allowed: ['text', 'remindAt', 'repeat', 'delivered'], sort: { remindAt: 1 }, onChange: changed('reminders') }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
