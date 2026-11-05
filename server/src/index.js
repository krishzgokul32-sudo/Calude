import http from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { connectDB } from './db.js';
import { createApp } from './app.js';
import { setIO } from './services/realtime.js';
import { userFromToken } from './middleware/auth.js';
import { handleMessage } from './services/assistant.js';
import { startScheduler } from './services/scheduler.js';
import { startTelegramPolling } from './bots/telegramBridge.js';
import { llmEnabled } from './services/llm.js';
import { seedDemo, DEMO } from './services/demoSeed.js';

await connectDB();
if (config.useMemoryDb || process.env.SEED_DEMO === 'true') {
  if (await seedDemo()) console.log(`🌱 Demo account: ${DEMO.email} / ${DEMO.password}`);
}

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrl } });
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

io.on('connection', (socket) => {
  const user = socket.data.user;
  socket.join(`user:${user._id}`);
  socket.on('chat:send', async ({ text, conversationId } = {}, ack) => {
    try {
      if (!text?.trim()) throw new Error('Empty message');
      const { conversation, userMessage, reply } = await handleMessage(user, text.trim(), { conversationId });
      ack?.({ ok: true, conversation, messages: [userMessage, reply] });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  });
});

startScheduler();
startTelegramPolling();

server.listen(config.port, () => {
  console.log(`🚀 API ready on http://localhost:${config.port}  (brain: ${llmEnabled() ? 'Claude ' + config.claudeModel : 'rule-based'})`);
});
