import crypto from 'node:crypto';
import { McpKey } from '../models/Mcp.js';

const PREFIX = 'gk_mcp_';
export const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

/** A new random key. The plain value is shown to the user once and never stored. */
export function generateKey() {
  const key = PREFIX + crypto.randomBytes(24).toString('base64url');
  return { key, hash: hashKey(key), prefix: key.slice(0, PREFIX.length + 4), last4: key.slice(-4) };
}

export async function authenticate(key) {
  if (!key || !key.startsWith(PREFIX)) return { ok: false, status: 401, message: 'Missing or invalid MCP key.' };
  const row = await McpKey.findOne({ keyHash: hashKey(key) });
  if (!row) return { ok: false, status: 401, message: 'Unknown or revoked MCP key.' };
  if (!row.enabled) return { ok: false, status: 403, message: 'This MCP key is switched off in GK → MCP server.' };
  McpKey.updateOne({ _id: row._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, keyRow: row };
}
