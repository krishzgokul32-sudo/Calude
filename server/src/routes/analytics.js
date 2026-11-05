import { Router } from 'express';
import { RANGES, salesAnalytics, financeAnalytics, contentAnalytics, projectAnalytics, overviewAnalytics } from '../services/analytics.js';
import { createSampleData, hasBusinessData } from '../services/sampleData.js';

const router = Router();
const HANDLERS = { overview: overviewAnalytics, sales: salesAnalytics, finance: financeAnalytics, content: contentAnalytics, projects: projectAnalytics };

router.post('/sample-data', async (req, res) => {
  if (await hasBusinessData(req.user._id)) return res.status(409).json({ error: 'You already have business data, so no sample data was added.' });
  res.status(201).json(await createSampleData(req.user._id));
});

router.get('/:team', async (req, res) => {
  const handler = HANDLERS[req.params.team];
  if (!handler) return res.status(404).json({ error: 'Unknown team' });
  const days = Number(req.query.days) in RANGES ? Number(req.query.days) : 30;
  const data = await handler(req.user._id, days);
  res.json({ ...data, empty: !(await hasBusinessData(req.user._id)) });
});

export default router;
