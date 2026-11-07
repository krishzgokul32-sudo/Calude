import mongoose from 'mongoose';
import { config } from '../config.js';

/**
 * Per-user daily cap on Claude calls (guide §14: "AI API costs explode"). One atomic $inc per call in a
 * MongoDB counter that expires after two days, shared by every API instance.
 */
let indexReady = false;
const coll = () => mongoose.connection.collection('ai_usage');

export async function takeAiQuota(userId) {
  if (!config.aiDailyLimit) return { ok: true };
  if (!indexReady) {
    indexReady = true;
    await coll().createIndex({ day: 1 }, { expireAfterSeconds: 2 * 24 * 3600 }).catch(() => {});
  }
  const day = new Date().toISOString().slice(0, 10);
  const doc = await coll().findOneAndUpdate(
    { _id: `${userId}:${day}` },
    { $inc: { count: 1 }, $setOnInsert: { day: new Date(`${day}T00:00:00Z`) } },
    { upsert: true, returnDocument: 'after' }
  );
  return { ok: doc.count <= config.aiDailyLimit, used: doc.count, limit: config.aiDailyLimit };
}
