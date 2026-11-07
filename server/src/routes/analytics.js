import User from '../models/User.js';
import { Router } from 'express';
import { RANGES, salesAnalytics, financeAnalytics, contentAnalytics, projectAnalytics, overviewAnalytics } from '../services/analytics.js';
import { createSampleData, hasBusinessData } from '../services/sampleData.js';
import { cache } from '../services/cache.js';
import { emitToUser } from '../services/realtime.js';

const TTL_MS = 30_000;

const router = Router();
const HANDLERS = { overview: overviewAnalytics, sales: salesAnalytics, finance: financeAnalytics, content: contentAnalytics, projects: projectAnalytics };

router.post('/sample-data', async (req, res) => {
  // Atomic claim on the user, so a double click can't insert the sample data twice (guide §13).
  const claimed = await User.findOneAndUpdate({ _id: req.user._id, sampleDataAt: { $exists: false } }, { $set: { sampleDataAt: new Date() } });
  if (!claimed || (await hasBusinessData(req.user._id))) {
    if (claimed) await User.updateOne({ _id: req.user._id }, { $unset: { sampleDataAt: 1 } });
    return res.status(409).json({ error: 'You already have business data, so no sample data was added.' });
  }
  try {
    const result = await createSampleData(req.user._id);
    emitToUser(req.user._id, 'data:changed', { kind: 'all' });
    res.status(201).json(result);
  } catch (err) {
    await User.updateOne({ _id: req.user._id }, { $unset: { sampleDataAt: 1 } });
    throw err;
  }
});

router.get('/:team', async (req, res) => {
  const handler = HANDLERS[req.params.team];
  if (!handler) return res.status(404).json({ error: 'Unknown team' });
  const days = Number(req.query.days) in RANGES ? Number(req.query.days) : 30;
  const data = await cache.getOrLoad(req.user._id, `analytics:${req.params.team}:${days}`, TTL_MS, async () => ({
    ...(await handler(req.user._id, days)),
    empty: !(await hasBusinessData(req.user._id)),
  }));
  res.set('Cache-Control', 'private, max-age=0');
  res.json(data);
});

export default router;
