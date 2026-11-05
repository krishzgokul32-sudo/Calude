import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer;

export async function connectDB() {
  let uri = config.mongoUri;
  if (config.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('personal_assistant');
    console.log('🧪 Using in-memory MongoDB (data resets on restart)');
  }
  await mongoose.connect(uri);
  console.log('🍃 MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
