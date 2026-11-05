import { Router } from 'express';

// Generic, user-scoped CRUD router for simple resources (tasks, notes, reminders).
export function crudRouter(Model, { allowed, sort = { createdAt: -1 }, onChange } = {}) {
  const router = Router();
  const pick = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => allowed.includes(k)));

  router.get('/', async (req, res) => {
    const q = { user: req.user._id };
    for (const [k, v] of Object.entries(req.query)) if (allowed.includes(k)) q[k] = v;
    res.json(await Model.find(q).sort(sort).limit(500));
  });

  router.post('/', async (req, res) => {
    const doc = await Model.create({ ...pick(req.body), user: req.user._id });
    onChange?.(req.user._id);
    res.status(201).json(doc);
  });

  router.patch('/:id', async (req, res) => {
    const doc = await Model.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, pick(req.body), { returnDocument: 'after', runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    onChange?.(req.user._id);
    res.json(doc);
  });

  router.delete('/:id', async (req, res) => {
    const doc = await Model.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    onChange?.(req.user._id);
    res.json({ ok: true });
  });

  return router;
}
