import { Router } from 'express';
import Integration from '../models/Integration.js';
import { PROVIDERS, providerCatalog, explainError } from '../services/integrations.js';
import { encrypt, decrypt } from '../services/secrets.js';

// Connections page: store a user's credentials for each tool and test them.
const router = Router();

const view = (doc) => ({
  provider: doc.provider,
  settings: doc.settings,
  status: doc.status,
  account: doc.account,
  lastError: doc.lastError,
  lastCheckedAt: doc.lastCheckedAt,
  connectedAt: doc.createdAt,
});

async function runTest(provider, creds) {
  try {
    return { status: 'connected', account: String(await PROVIDERS[provider].test(creds)), lastError: '' };
  } catch (err) {
    return { status: 'error', account: '', lastError: explainError(err) };
  }
}

router.get('/', async (req, res) => {
  const docs = await Integration.find({ user: req.user._id });
  res.json({ providers: providerCatalog(), connections: docs.map(view) });
});

// Save (or replace) credentials, then test them right away.
router.put('/:provider', async (req, res) => {
  const p = PROVIDERS[req.params.provider];
  if (!p) return res.status(404).json({ error: 'Unknown tool' });
  const existing = await Integration.findOne({ user: req.user._id, provider: req.params.provider }).select('+secrets');
  const oldSecrets = existing?.secrets ? JSON.parse(decrypt(existing.secrets) || '{}') : {};
  const settings = {};
  const secrets = {};
  for (const f of p.fields) {
    const v = String(req.body?.[f.key] ?? '').trim();
    if (f.secret) secrets[f.key] = v || oldSecrets[f.key] || ''; // blank keeps the saved secret
    else settings[f.key] = v;
    if (!(f.secret ? secrets[f.key] : v)) return res.status(400).json({ error: `${f.label} is required` });
  }
  const result = await runTest(req.params.provider, { ...settings, ...secrets });
  const doc = await Integration.findOneAndUpdate(
    { user: req.user._id, provider: req.params.provider },
    { settings, secrets: encrypt(JSON.stringify(secrets)), ...result, lastCheckedAt: new Date() },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.json(view(doc));
});

router.post('/:provider/test', async (req, res) => {
  const doc = await Integration.findOne({ user: req.user._id, provider: req.params.provider }).select('+secrets');
  if (!doc || !PROVIDERS[doc.provider]) return res.status(404).json({ error: 'Not connected' });
  const secrets = JSON.parse(decrypt(doc.secrets) || '{}');
  Object.assign(doc, await runTest(doc.provider, { ...doc.settings, ...secrets }), { lastCheckedAt: new Date() });
  await doc.save();
  res.json(view(doc));
});

router.delete('/:provider', async (req, res) => {
  await Integration.deleteOne({ user: req.user._id, provider: req.params.provider });
  res.json({ ok: true });
});

export default router;
