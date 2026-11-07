import http from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { createAdapter } from '@socket.io/mongo-adapter';
import { config, validateConfig } from './config.js';
import { connectDB, disconnectDB } from './db.js';
import { createApp } from './app.js';
import { setIO } from './services/realtime.js';
import { userFromToken } from './middleware/auth.js';
import { handleMessage } from './services/assistant.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { startTelegramPolling, stopTelegramPolling } from './bots/telegramBridge.js';
import { serverKeyConfigured, serverProvider } from './services/llm.js';
import { seedDemo, DEMO } from './services/demoSeed.js';
import { MongoRateStore } from './services/rateLimitStore.js';
import { markShuttingDown } from './routes/health.js';
import { log } from './services/logger.js';

// Fail fast on bad configuration (guide §03: validate config at startup).
for (const warning of validateConfig()) log.warn(warning);

await connectDB();
if (config.useMemoryDb || process.env.SEED_DEMO === 'true') {
  if (await seedDemo()) log.info(`Demo account created: ${DEMO.email} / ${DEMO.password}`);
}

const app = createApp();
const server = http.createServer(app);
// Never let a slow client hold a connection forever (guide §02/§05). Claude replies can take a while,
// so the request timeout is generous; keep-alive is above common load-balancer idle timeouts.
server.requestTimeout = 180_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 61_000;

const io = new Server(server, { cors: { origin: config.clientUrl }, maxHttpBufferSize: 1e6 });

// Several API instances: share Socket.IO events through MongoDB so a reminder or reply reaches the user
// whichever instance their browser is connected to (guide §03). Needs a replica set (change streams).
try {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName) {
    const name = 'socket_io_events';
    await mongoose.connection.db.createCollection(name, { capped: true, size: 5e6 }).catch(() => {});
    io.adapter(createAdapter(mongoose.connection.db.collection(name), { addCreatedAtField: true }));
    log.info('Socket.IO shared across instances via MongoDB', { replicaSet: hello.setName });
  } else {
    log.info('Socket.IO in single-instance mode (run MongoDB as a replica set to scale out)');
  }
} catch (err) {
  log.warn('Socket.IO adapter not enabled', { error: err.message });
}
setIO(io);

// Real-time channel: authenticate with the same JWT as the REST API.
io.use(async (socket, next) => {
  try {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

// The socket path skips the HTTP rate limiter, so it gets its own: 30 messages per minute per user.
const chatLimit = new MongoRateStore('ws-chat');
chatLimit.init({ windowMs: 60_000 });

io.on('connection', (socket) => {
  const user = socket.data.user;
  socket.join(`user:${user._id}`);
  socket.on('chat:send', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const { totalHits } = await chatLimit.increment(String(user._id)).catch(() => ({ totalHits: 0 }));
      if (totalHits > 30) return reply({ ok: false, error: 'You are sending messages too fast. Please wait a moment.' });
      const text = typeof payload?.text === 'string' ? payload.text : '';
      const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : undefined;
      const { conversation, userMessage, reply: answer } = await handleMessage(user, text, { conversationId });
      reply({ ok: true, conversation, messages: [userMessage, answer] });
    } catch (e) {
      reply({ ok: false, error: e.status ? e.message : e.name === 'CastError' ? 'Invalid conversation' : 'Something went wrong. Please try again.' });
      if (!e.status && e.name !== 'CastError') log.error('socket chat failed', { user: String(user._id), error: e.message });
    }
  });
});

startScheduler();
startTelegramPolling();

server.listen(config.port, () => {
  log.info(`API ready on http://localhost:${config.port}`, { serverAiKey: serverKeyConfigured(), serverAiProvider: serverProvider(), pid: process.pid });
});

// Graceful shutdown (guide §03/§10: zero-downtime deploys). Stop taking new work, let in-flight requests
// finish, release the Telegram lease so another instance takes over, then close the DB.
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  log.info('Shutting down', { signal });
  markShuttingDown(); // readiness probe now returns 503, so the load balancer stops sending traffic
  const force = setTimeout(() => {
    log.error('Forced exit after 15 s');
    process.exit(1);
  }, 15_000);
  force.unref();
  stopScheduler();
  await stopTelegramPolling().catch(() => {});
  io.close();
  server.close(async () => {
    await disconnectDB().catch(() => {});
    log.info('Shutdown complete');
    process.exit(0);
  });
  server.closeIdleConnections?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => log.error('unhandled promise rejection', { error: err?.message || String(err) }));
