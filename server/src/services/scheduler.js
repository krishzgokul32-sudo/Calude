import Reminder from '../models/Reminder.js';
import { emitToUser } from './realtime.js';
import { notifyThroughBots } from '../bots/botManager.js';
import { every } from './resilience.js';
import { log } from './logger.js';

const NEXT = { daily: 864e5, weekly: 6048e5 };
const LOCK_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;

/** Next occurrence strictly in the future, so a repeating reminder doesn't fire once per missed day. */
export function nextOccurrence(remindAt, repeat, now = new Date()) {
  const step = NEXT[repeat];
  let t = remindAt.getTime() + step;
  if (t <= now.getTime()) t += Math.ceil((now.getTime() - t + 1) / step) * step;
  return new Date(t);
}

/**
 * Atomically claim one due reminder. Two scheduler instances (or two overlapping runs) can never claim the
 * same reminder: the claim is a single findOneAndUpdate that only matches unlocked reminders (guide §13).
 */
function claimNext(now) {
  return Reminder.findOneAndUpdate(
    { delivered: false, remindAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
    { sort: { remindAt: 1 }, returnDocument: 'after' }
  );
}

export async function deliverDueReminders(now = new Date(), max = 200) {
  let count = 0;
  for (let i = 0; i < max; i++) {
    const r = await claimNext(now);
    if (!r) break;
    try {
      emitToUser(r.user, 'reminder:due', { id: r._id, text: r.text, remindAt: r.remindAt });
      await notifyThroughBots(r.user, `⏰ Reminder: ${r.text}`);
      const update =
        r.repeat !== 'none'
          ? { $set: { remindAt: nextOccurrence(r.remindAt, r.repeat, now), attempts: 0 }, $unset: { lockedUntil: 1 } }
          : { $set: { delivered: true }, $unset: { lockedUntil: 1 } };
      await Reminder.updateOne({ _id: r._id }, update);
      count++;
    } catch (err) {
      // Leave it locked; it is retried after the lock expires, up to MAX_ATTEMPTS, then parked.
      log.error('reminder delivery failed', { id: String(r._id), attempt: r.attempts, error: err.message });
      if (r.attempts >= MAX_ATTEMPTS) await Reminder.updateOne({ _id: r._id }, { $set: { delivered: true }, $unset: { lockedUntil: 1 } });
    }
  }
  return count;
}

let job;
export function startScheduler() {
  job = every(30_000, () => deliverDueReminders(), 'reminder scheduler');
  log.info('Reminder scheduler running (every 30 s, safe with multiple instances)');
}
export const stopScheduler = () => job?.stop();
