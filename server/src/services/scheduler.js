import cron from 'node-cron';
import Reminder from '../models/Reminder.js';
import { emitToUser } from './realtime.js';
import { notifyThroughBots } from '../bots/botManager.js';

const NEXT = { daily: 864e5, weekly: 6048e5 };

export async function deliverDueReminders(now = new Date()) {
  const due = await Reminder.find({ delivered: false, remindAt: { $lte: now } }).limit(100);
  for (const r of due) {
    const text = `⏰ Reminder: ${r.text}`;
    emitToUser(r.user, 'reminder:due', { id: r._id, text: r.text, remindAt: r.remindAt });
    await notifyThroughBots(r.user, text);
    if (r.repeat !== 'none') {
      r.remindAt = new Date(r.remindAt.getTime() + NEXT[r.repeat]);
    } else {
      r.delivered = true;
    }
    await r.save();
  }
  return due.length;
}

export function startScheduler() {
  // Every 30 seconds.
  cron.schedule('*/30 * * * * *', () => deliverDueReminders().catch((e) => console.error('Scheduler:', e.message)));
  console.log('⏱️  Reminder scheduler running');
}
