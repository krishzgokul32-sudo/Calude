// Integration tests against a real MongoDB. Run with: TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Reminder from '../src/models/Reminder.js';
import User from '../src/models/User.js';
import Conversation from '../src/models/Conversation.js';
import { deliverDueReminders } from '../src/services/scheduler.js';
import { acquireLease } from '../src/services/resilience.js';
import { MongoRateStore } from '../src/services/rateLimitStore.js';
import { takeAiQuota } from '../src/services/aiQuota.js';
import { config } from '../src/config.js';

const uri = process.env.TEST_MONGO_URI;
const skip = !uri && 'set TEST_MONGO_URI to run';
let user;

before(async () => {
  if (skip) return;
  await mongoose.connect(uri, { dbName: `gk_test_${process.pid}` });
  await Promise.all([Reminder.syncIndexes(), Conversation.syncIndexes()]);
  user = await User.create({ name: 'T', email: `t${Date.now()}@test.dev`, password: 'secret123' });
});
after(async () => {
  if (skip) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('two schedulers running at once deliver each reminder exactly once', { skip }, async () => {
  const due = new Date(Date.now() - 1000);
  await Reminder.insertMany(Array.from({ length: 30 }, (_, i) => ({ user: user._id, text: `r${i}`, remindAt: due })));
  const counts = await Promise.all([deliverDueReminders(), deliverDueReminders(), deliverDueReminders(), deliverDueReminders()]);
  assert.equal(counts.reduce((a, b) => a + b, 0), 30, `delivered ${counts.join('+')}`);
  assert.equal(await Reminder.countDocuments({ user: user._id, delivered: true }), 30);
  assert.equal(await deliverDueReminders(), 0, 'nothing left to send');
});

test('only one instance holds the poller lease', { skip }, async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => acquireLease(`lease-${Date.now()}`, 5000)));
  // Same process = same owner id, so simulate other owners by checking the stored owner is unique.
  assert.ok(results.some(Boolean));
  const name = `other-${Date.now()}`;
  await mongoose.connection.collection('locks').insertOne({ _id: name, owner: 'someone-else', expiresAt: new Date(Date.now() + 5000) });
  assert.equal(await acquireLease(name, 5000), false, 'a live lease held by another instance is respected');
  await mongoose.connection.collection('locks').updateOne({ _id: name }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal(await acquireLease(name, 5000), true, 'an expired lease is taken over');
});

test('shared rate-limit counter counts every hit exactly once under concurrency', { skip }, async () => {
  const store = new MongoRateStore(`t${Date.now()}`);
  store.init({ windowMs: 60_000 });
  const hits = await Promise.all(Array.from({ length: 50 }, () => store.increment('k')));
  assert.deepEqual(hits.map((h) => h.totalHits).sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1));
});

test('AI quota stops at the daily limit', { skip }, async () => {
  const saved = config.aiDailyLimit;
  config.aiDailyLimit = 3;
  try {
    const id = new mongoose.Types.ObjectId();
    const r = [];
    for (let i = 0; i < 4; i++) r.push((await takeAiQuota(id)).ok);
    assert.deepEqual(r, [true, true, true, false]);
  } finally {
    config.aiDailyLimit = saved;
  }
});

test('concurrent messages from one Telegram chat share one conversation', { skip }, async () => {
  const { handleMessage } = await import('../src/services/assistant.js');
  await Promise.all(Array.from({ length: 5 }, (_, i) => handleMessage(user, `hello ${i}`, { channel: 'telegram', externalId: '999' })));
  assert.equal(await Conversation.countDocuments({ user: user._id, channel: 'telegram', externalId: '999' }), 1);
});

test('cached sign-in keeps ids intact and profile changes are visible at once', { skip }, async () => {
  const { signToken, userFromToken } = await import('../src/middleware/auth.js');
  const token = signToken(user);
  const a = await userFromToken(token);
  const b = await userFromToken(token); // served from the cache
  assert.equal(String(b._id), String(user._id));
  assert.ok(b._id instanceof mongoose.Types.ObjectId, 'ObjectId survives the cache copy');
  b.preferences.city = 'mutated-in-request-b';
  assert.notEqual(a.preferences.city, 'mutated-in-request-b', 'requests never share one object');
  const fresh = await User.findById(user._id);
  fresh.preferences = { ...fresh.preferences.toObject(), currency: 'USD' };
  await fresh.save();
  assert.equal((await userFromToken(token)).preferences.currency, 'USD', 'saving clears the cache');
});
