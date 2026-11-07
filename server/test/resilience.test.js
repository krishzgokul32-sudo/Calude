import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, circuitBreaker, every } from '../src/services/resilience.js';
import { cache } from '../src/services/cache.js';
import { nextOccurrence } from '../src/services/scheduler.js';
import { validateConfig, config } from '../src/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('withRetry retries with backoff, then gives up', async () => {
  let calls = 0;
  const out = await withRetry(async () => {
    if (++calls < 3) throw new Error('flaky');
    return 'ok';
  }, { tries: 3, baseMs: 1 });
  assert.equal(out, 'ok');
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new Error('down'); }, { tries: 2, baseMs: 1 }), /down/);
  assert.equal(calls, 2);
});

test('circuit breaker opens after repeated failures and skips the call', async () => {
  const b = circuitBreaker('test', { threshold: 2, coolDownMs: 50 });
  let calls = 0;
  const fail = async () => { calls++; throw new Error('x'); };
  assert.equal(await b.call(fail, 'fallback'), 'fallback');
  assert.equal(await b.call(fail, 'fallback'), 'fallback');
  assert.equal(b.open, true);
  assert.equal(await b.call(fail, 'fallback'), 'fallback');
  assert.equal(calls, 2, 'no call while open');
  await sleep(60);
  assert.equal(await b.call(async () => 'back', 'fallback'), 'back');
  assert.equal(b.open, false);
});

test('every() never overlaps a slow run', async () => {
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  const job = every(5, async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    runs++;
    await sleep(30);
    active--;
  }, 'test job');
  await sleep(100);
  job.stop();
  await sleep(40);
  assert.equal(maxActive, 1);
  assert.ok(runs >= 2);
});

test('cache coalesces concurrent misses and invalidates per user', async () => {
  let loads = 0;
  const loader = async () => { loads++; await sleep(20); return { n: loads }; };
  const results = await Promise.all(Array.from({ length: 10 }, () => cache.getOrLoad('u1', 'k', 1000, loader)));
  assert.equal(loads, 1, 'ten concurrent requests, one computation');
  assert.ok(results.every((r) => r.n === 1));
  await cache.getOrLoad('u1', 'k', 1000, loader);
  assert.equal(loads, 1, 'served from cache');
  cache.invalidateUser('u1');
  await cache.getOrLoad('u1', 'k', 1000, loader);
  assert.equal(loads, 2, 'reloaded after invalidation');
});

test('a failed load is not cached', async () => {
  await assert.rejects(cache.getOrLoad('u2', 'k', 1000, async () => { throw new Error('db down'); }));
  assert.equal(await cache.getOrLoad('u2', 'k', 1000, async () => 'fine'), 'fine');
});

test('repeating reminders skip missed days instead of firing once per day', () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const next = nextOccurrence(new Date('2026-01-01T09:00:00Z'), 'daily', now);
  assert.equal(next.toISOString(), '2026-01-11T09:00:00.000Z');
  assert.equal(nextOccurrence(new Date('2026-01-10T09:00:00Z'), 'daily', now).toISOString(), '2026-01-11T09:00:00.000Z');
  assert.equal(nextOccurrence(new Date('2026-01-10T09:00:00Z'), 'weekly', now).toISOString(), '2026-01-17T09:00:00.000Z');
});

test('config validation rejects bad values', () => {
  const saved = { ...config };
  try {
    config.port = 99999;
    assert.throws(() => validateConfig(), /PORT/);
    config.port = 5000;
    config.publicApiUrl = 'not a url';
    assert.throws(() => validateConfig(), /PUBLIC_API_URL/);
  } finally {
    Object.assign(config, saved);
  }
});

test('private network addresses are recognised for the webhook guard', async () => {
  const { isPrivateIp, assertPublicUrl } = await import('../src/services/urlGuard.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.9', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '100.64.0.1']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
  process.env.ALLOW_PRIVATE_WEBHOOKS = 'false';
  try {
    await assert.rejects(assertPublicUrl('http://169.254.169.254/latest/meta-data'), /private network/);
    await assert.rejects(assertPublicUrl('http://127.0.0.1:27017'), /private network/);
    await assert.rejects(assertPublicUrl('ftp://example.com'), /http/);
  } finally {
    delete process.env.ALLOW_PRIVATE_WEBHOOKS;
  }
});
