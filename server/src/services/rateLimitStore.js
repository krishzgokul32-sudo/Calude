import mongoose from 'mongoose';
import { log } from './logger.js';

/**
 * express-rate-limit store backed by MongoDB, so every API instance shares the same counters
 * (guide §03: an in-memory limiter per server lets traffic through N times when you run N servers).
 * One atomic update per hit: the window resets itself when it has expired.
 */
let indexReady = false;

export class MongoRateStore {
  constructor(prefix) {
    this.prefix = prefix;
    // Rate-limit state is shared between instances, not local to this one.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  get coll() {
    return mongoose.connection.collection('ratelimits');
  }

  async ensureIndex() {
    if (indexReady) return;
    indexReady = true;
    await this.coll.createIndex({ resetAt: 1 }, { expireAfterSeconds: 60 }).catch((e) => log.warn('ratelimit index', { error: e.message }));
  }

  async increment(key) {
    await this.ensureIndex();
    const now = new Date();
    const expired = { $or: [{ $not: ['$resetAt'] }, { $lte: ['$resetAt', now] }] };
    const doc = await this.coll.findOneAndUpdate(
      { _id: `${this.prefix}:${key}` },
      [
        {
          $set: {
            hits: { $cond: [expired, 1, { $add: ['$hits', 1] }] },
            resetAt: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$resetAt'] },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' }
    );
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key) {
    await this.coll.updateOne({ _id: `${this.prefix}:${key}` }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await this.coll.deleteOne({ _id: `${this.prefix}:${key}` });
  }
}
