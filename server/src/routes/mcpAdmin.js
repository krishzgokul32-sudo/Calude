import { Router } from 'express';
import { McpKey, McpLog } from '../models/Mcp.js';
import { generateKey } from '../mcp/keys.js';
import { loadSettings, saveSettings } from '../mcp/settings.js';
import { catalogForUi, TIERS } from '../mcp/catalog.js';
import { config } from '../config.js';

// Settings → MCP. Every logged-in user manages their own switches and keys.
const router = Router();

const base = () => config.publicApiUrl.replace(/\/$/, '');
const keyOut = (k) => ({ id: k._id, name: k.name, display: `${k.keyPrefix}…${k.keyLast4}`, enabled: k.enabled, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt });
const settingsOut = (s) => ({ masterEnabled: s.masterEnabled, tiers: TIERS, catalog: catalogForUi(s.categories) });

router.get('/settings', async (req, res) => res.json(settingsOut(await loadSettings(req.user._id))));

router.put('/settings', async (req, res) => {
  const { masterEnabled, categories } = req.body || {};
  res.json(settingsOut(await saveSettings(req.user._id, { masterEnabled, categories })));
});

router.get('/keys', async (req, res) => {
  const keys = await McpKey.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ keys: keys.map(keyOut) });
});

// The ONLY response that ever contains the plain key.
router.post('/keys', async (req, res) => {
  if ((await McpKey.countDocuments({ user: req.user._id })) >= 20) return res.status(400).json({ error: 'You can have at most 20 keys. Delete one first.' });
  const name = String(req.body?.name || '').trim().slice(0, 80) || 'MCP key';
  const k = generateKey();
  const row = await McpKey.create({ user: req.user._id, name, keyHash: k.hash, keyPrefix: k.prefix, keyLast4: k.last4 });
  res.status(201).json({ key: keyOut(row), plainKey: k.key, connectUrl: `${base()}/api/mcp/${k.key}`, headerUrl: `${base()}/api/mcp` });
});

router.put('/keys/:id', async (req, res) => {
  const patch = {};
  if (typeof req.body?.enabled === 'boolean') patch.enabled = req.body.enabled;
  if (req.body?.name) patch.name = String(req.body.name).trim().slice(0, 80);
  const row = await McpKey.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, patch, { returnDocument: 'after' });
  if (!row) return res.status(404).json({ error: 'Key not found' });
  res.json({ key: keyOut(row) });
});

router.delete('/keys/:id', async (req, res) => {
  const row = await McpKey.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!row) return res.status(404).json({ error: 'Key not found' });
  res.json({ deleted: true });
});

router.get('/logs', async (req, res) => {
  const logs = await McpLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ logs });
});

// Connection details WITHOUT any key; the UI fills the key in only right after creating one.
router.get('/connect-info', (req, res) => {
  res.json({ urlTemplate: `${base()}/api/mcp/<your-key>`, headerUrl: `${base()}/api/mcp`, serverName: 'gk' });
});

export default router;
