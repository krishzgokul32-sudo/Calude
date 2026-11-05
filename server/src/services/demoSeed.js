import User from '../models/User.js';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Reminder from '../models/Reminder.js';
import { seedDefaultBots } from './defaultBots.js';
import { createSampleData } from './sampleData.js';

export const DEMO = { email: 'demo@assistant.dev', password: 'demo1234' };

/** Create the demo account (demo@assistant.dev / demo1234) if it doesn't exist. */
export async function seedDemo() {
  if (await User.exists({ email: DEMO.email })) return false;
  const user = await User.create({ name: 'Demo User', ...DEMO, preferences: { city: 'Chennai' } });
  await seedDefaultBots(user._id);
  await Task.insertMany([
    { user: user._id, title: 'Design the onboarding flow', priority: 'high', status: 'in_progress' },
    { user: user._id, title: 'Connect my Telegram bot', priority: 'medium' },
    { user: user._id, title: 'Read 20 pages', priority: 'low', status: 'done' },
  ]);
  await Note.create({ user: user._id, title: 'Welcome 👋', content: 'This is your personal assistant. Try chatting: "remind me to drink water in 1 minute".', pinned: true });
  await createSampleData(user._id);
  await Reminder.create({ user: user._id, text: 'Stand up and stretch', remindAt: new Date(Date.now() + 2 * 60e3) });
  return true;
}
