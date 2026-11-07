import os from 'node:os';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { log } from './logger.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry with exponential backoff + jitter, a max number of tries (guide §02 retry storms, §07). */
export async function withRetry(fn, { tries = 3, baseMs = 500, shouldRetry = () => true, label = 'operation' } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn(i);
    } catch (err) {
      if (i >= tries - 1 || !shouldRetry(err)) throw err;
      const wait = 2 ** i * baseMs + Math.random() * 300;
      log.warn(`${label} failed, retrying`, { attempt: i + 1, waitMs: Math.round(wait), error: err.message });
      await sleep(wait);
    }
  }
}

/**
 * Circuit breaker (guide §02 cascading failures): after `threshold` failures in a row, stop calling the
 * dependency for `coolDownMs` and use the fallback immediately, instead of making every request wait
 * for a timeout. One trial call is let through after the cool-down.
 */
export function circuitBreaker(name, { threshold = 3, coolDownMs = 30_000 } = {}) {
  let failures = 0;
  let openUntil = 0;
  return {
    get open() {
      return Date.now() < openUntil;
    },
    async call(fn, fallback) {
      if (Date.now() < openUntil) return fallback;
      try {
        const out = await fn();
        if (failures >= threshold) log.info(`${name} recovered`);
        failures = 0;
        return out;
      } catch (err) {
        failures++;
        if (failures >= threshold) {
          if (failures === threshold) log.warn(`${name} is failing, pausing calls`, { coolDownMs, error: err.message });
          openUntil = Date.now() + coolDownMs;
        }
        return fallback;
      }
    },
  };
}

/**
 * Lease lock in MongoDB with expiry (guide §13: "locks with expiry"). Only one instance holds a lease at a
 * time; if that instance dies, the lease expires and another takes over. Used so that only one server
 * polls Telegram.
 */
const OWNER = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
export async function acquireLease(name, ttlMs) {
  const now = new Date();
  const coll = mongoose.connection.collection('locks');
  try {
    const doc = await coll.findOneAndUpdate(
      { _id: name, $or: [{ expiresAt: { $lt: now } }, { owner: OWNER }] },
      { $set: { owner: OWNER, expiresAt: new Date(now.getTime() + ttlMs) } },
      { upsert: true, returnDocument: 'after' }
    );
    return doc?.owner === OWNER;
  } catch (err) {
    if (err.code === 11000) return false; // someone else holds a live lease
    throw err;
  }
}

export async function releaseLease(name) {
  await mongoose.connection.collection('locks').deleteOne({ _id: name, owner: OWNER }).catch(() => {});
}

/** Run `fn` every `ms`, never overlapping itself (guide §09: jobs run twice). */
export function every(ms, fn, label) {
  let running = false;
  let stopped = false;
  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      log.error(`${label} failed`, { error: err.message });
    } finally {
      running = false;
    }
  }, ms);
  timer.unref?.();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    get running() {
      return running;
    },
  };
}
