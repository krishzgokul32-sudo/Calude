import { McpSettings } from '../models/Mcp.js';
import { CATEGORIES, resolveCategories } from './catalog.js';

export async function loadSettings(userId) {
  const doc = await McpSettings.findOne({ user: userId }).lean();
  return { masterEnabled: Boolean(doc?.masterEnabled), categories: resolveCategories(doc?.categories) };
}

export async function saveSettings(userId, { masterEnabled, categories }) {
  const current = await loadSettings(userId);
  const next = { ...current.categories };
  for (const c of CATEGORIES) if (typeof categories?.[c.key] === 'boolean') next[c.key] = categories[c.key];
  await McpSettings.updateOne(
    { user: userId },
    { $set: { masterEnabled: typeof masterEnabled === 'boolean' ? masterEnabled : current.masterEnabled, categories: next } },
    { upsert: true }
  );
  return loadSettings(userId);
}
