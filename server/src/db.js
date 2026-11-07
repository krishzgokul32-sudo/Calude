import mongoose from 'mongoose';
import { config } from './config.js';
import { log } from './services/logger.js';

let memoryServer;

// One shared connection pool for the whole process (guide §01: connection exhaustion).
const POOL = {
  maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 50, // stay below the DB's connection limit ÷ number of instances
  minPoolSize: 2,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 5_000, // fail fast instead of hanging requests when the DB is unreachable
  socketTimeoutMS: 45_000,
  waitQueueTimeoutMS: 5_000, // a request waits at most 5 s for a free connection, then errors
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectDB() {
  let uri = config.mongoUri;
  if (config.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('personal_assistant');
    log.warn('Using in-memory MongoDB (data resets on restart)');
  }
  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));

  // Retry with exponential backoff + jitter: in Docker the API often starts before MongoDB is ready.
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, POOL);
      log.info('MongoDB connected', { pool: POOL.maxPoolSize });
      return;
    } catch (err) {
      if (attempt >= 8) throw err;
      const wait = Math.min(2 ** attempt * 250, 8_000) + Math.random() * 250;
      log.warn('MongoDB not reachable, retrying', { attempt, waitMs: Math.round(wait), error: err.message });
      await sleep(wait);
    }
  }
}

export const dbReady = () => mongoose.connection.readyState === 1;

export async function pingDB() {
  await mongoose.connection.db.admin().command({ ping: 1 });
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
