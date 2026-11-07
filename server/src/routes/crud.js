import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';

const MAX_LIMIT = 500;

/**
 * Generic, user-scoped CRUD router (tasks, notes, reminders, leads, invoices, posts, projects).
 * - Every query is filtered by the logged-in user (guide §08: users must never see others' data).
 * - Lists are paginated: ?limit (1–500, default 200) & ?offset. `X-Has-More: true` means there is another page.
 * - Filters only accept plain string values, so a query can't smuggle in Mongo operators.
 * - `validate(body, user)` runs before writes, e.g. to check a referenced record belongs to the user.
 */
export function crudRouter(Model, { allowed, sort = { createdAt: -1 }, onChange, validate } = {}) {
  const router = Router();
  const pick = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => allowed.includes(k)));

  router.get('/', async (req, res) => {
    const q = { user: req.user._id };
    for (const [k, v] of Object.entries(req.query)) if (allowed.includes(k) && typeof v === 'string') q[k] = v;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const rows = await Model.find(q).sort(sort).skip(offset).limit(limit + 1).lean();
    res.set('X-Has-More', String(rows.length > limit));
    res.json(rows.slice(0, limit));
  });

  router.post('/', async (req, res) => {
    const data = pick(req.body);
    await validate?.(data, req.user);
    const doc = await Model.create({ ...data, user: req.user._id });
    onChange?.(req.user._id);
    res.status(201).json(doc);
  });

  router.patch('/:id', async (req, res) => {
    const data = pick(req.body);
    await validate?.(data, req.user);
    const doc = await Model.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { returnDocument: 'after', runValidators: true });
    if (!doc) throw new HttpError(404, 'Not found');
    onChange?.(req.user._id);
    res.json(doc);
  });

  router.delete('/:id', async (req, res) => {
    const doc = await Model.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) throw new HttpError(404, 'Not found');
    onChange?.(req.user._id);
    res.json({ ok: true });
  });

  return router;
}
