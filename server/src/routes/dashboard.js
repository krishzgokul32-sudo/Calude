import { Router } from 'express';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Reminder from '../models/Reminder.js';
import Bot from '../models/Bot.js';
import Message from '../models/Message.js';
import { llmAvailable } from '../services/llm.js';
import { pythonAI } from '../services/pythonAI.js';

const router = Router();

router.get('/', async (req, res) => {
  const user = req.user._id;
  const weekAgo = new Date(Date.now() - 6 * 864e5);
  weekAgo.setHours(0, 0, 0, 0);

  const claude = await llmAvailable(req.user);
  const [taskGroups, notes, upcoming, bots, perDay, aiHealth, recentTasks] = await Promise.all([
    Task.aggregate([{ $match: { user } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Note.countDocuments({ user }),
    Reminder.find({ user, delivered: false }).sort({ remindAt: 1 }).limit(5),
    Bot.find({ user }).sort({ 'stats.messages': -1 }),
    Message.aggregate([
      { $match: { user, role: 'user', createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    pythonAI.health(),
    Task.find({ user, status: { $ne: 'done' } }).sort({ createdAt: -1 }).limit(5),
  ]);

  const tasks = { todo: 0, in_progress: 0, done: 0 };
  taskGroups.forEach((g) => (tasks[g._id] = g.n));
  const activity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 864e5);
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: perDay.find((p) => p._id === key)?.n || 0 };
  });

  res.json({
    tasks,
    notes,
    upcoming,
    recentTasks,
    bots: bots.map((b) => b.toSafeJSON()),
    activity,
    services: { claude, python: Boolean(aiHealth?.status === 'ok'), mongo: true },
  });
});

export default router;
