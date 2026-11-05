import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, CATEGORIES, resolveCategories, isToolAllowed, catalogForUi } from '../src/mcp/catalog.js';
import { toolDefinitions } from '../src/mcp/tools.js';
import { generateKey, hashKey } from '../src/mcp/keys.js';

const fakeUser = { _id: '000000000000000000000000', name: 'Test', assistantName: 'GK', preferences: {} };

test('every tool is in the catalog and every catalog tool exists', () => {
  const defined = toolDefinitions({ user: fakeUser }).map(([name]) => name).sort();
  assert.deepEqual(defined, Object.keys(TOOLS).sort());
});

test('every tool points at a real category, and every category has a tool', () => {
  const keys = new Set(CATEGORIES.map((c) => c.key));
  for (const [tool, cat] of Object.entries(TOOLS)) assert.ok(keys.has(cat), `${tool} → unknown category ${cat}`);
  for (const c of CATEGORIES) assert.ok(Object.values(TOOLS).includes(c.key), `${c.key} has no tools`);
});

test('only read categories are on by default; delete and send are off', () => {
  const enabled = resolveCategories({});
  for (const c of CATEGORIES) assert.equal(enabled[c.key], c.tier === 'read', c.key);
  assert.equal(isToolAllowed('delete_task', enabled), false);
  assert.equal(isToolAllowed('call_bot', enabled), false);
  assert.equal(isToolAllowed('list_tasks', enabled), true);
});

test('unknown tools are always refused (default-deny)', () => {
  const allOn = Object.fromEntries(CATEGORIES.map((c) => [c.key, true]));
  assert.equal(isToolAllowed('drop_database', allOn), false);
  assert.equal(catalogForUi(allOn).every((c) => c.enabled), true);
});

test('keys are random, prefixed and only their hash is kept', () => {
  const a = generateKey();
  const b = generateKey();
  assert.notEqual(a.key, b.key);
  assert.ok(a.key.startsWith('gk_mcp_'));
  assert.equal(a.hash, hashKey(a.key));
  assert.ok(!a.hash.includes(a.key));
});
