import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { calculate, extractExpression } from '../src/bots/calculator.js';
import { parseWhen } from '../src/services/timeParser.js';
import { detectIntent } from '../src/services/localBrain.js';
import { signPayload } from '../src/bots/botManager.js';

test('calculator evaluates safely', () => {
  assert.equal(calculate('(12+8)*3^2'), 180);
  assert.equal(calculate('2^3^2'), 512); // right-associative
  assert.equal(calculate('-4 + sqrt(16)'), 0);
  assert.equal(calculate('10 % 4'), 2);
  assert.throws(() => calculate('process.exit()'));
  assert.throws(() => calculate('1/0'));
  assert.equal(calculate(extractExpression('what is 7 * 6')), 42);
});

test('time parser understands relative and absolute times', () => {
  const now = new Date('2026-01-01T10:00:00');
  assert.equal(parseWhen('in 10 minutes', now).date.getTime(), now.getTime() + 10 * 60e3);
  assert.equal(parseWhen('in an hour', now).date.getTime(), now.getTime() + 36e5);
  const five = parseWhen('at 5pm', now).date;
  assert.equal(five.getHours(), 17);
  assert.equal(five.getDate(), 1);
  const early = parseWhen('at 9am', now).date; // already passed today -> tomorrow
  assert.equal(early.getDate(), 2);
  const tmr = parseWhen('tomorrow at 9:30', now).date;
  assert.deepEqual([tmr.getDate(), tmr.getHours(), tmr.getMinutes()], [2, 9, 30]);
  assert.equal(parseWhen('sometime', now), null);
});

test('local brain intents', () => {
  assert.equal(detectIntent('add task buy milk').intent, 'create_task');
  assert.equal(detectIntent('add task fix prod urgent').priority, 'high');
  const r = detectIntent('remind me to call mom in 20 minutes');
  assert.equal(r.intent, 'set_reminder');
  assert.equal(r.text, 'call mom');
  assert.equal(r.when, 'in 20 minutes');
  assert.equal(detectIntent('show my tasks').intent, 'list_tasks');
  assert.equal(detectIntent('note: wifi — password is blue').title, 'wifi');
  assert.equal(detectIntent('list bots').intent, 'list_bots');
  assert.equal(detectIntent('blorp').intent, 'unknown');
});

test('webhook signatures are HMAC-SHA256', () => {
  const expected = 'sha256=' + crypto.createHmac('sha256', 'secret').update('{"a":1}').digest('hex');
  assert.equal(signPayload('secret', '{"a":1}'), expected);
  assert.notEqual(signPayload('secret', 'x'), signPayload('other', 'x'));
});

test('saved API keys round-trip through encryption', async () => {
  const { encrypt, decrypt } = await import('../src/services/secrets.js');
  const stored = encrypt('sk-ant-api03-example');
  assert.ok(!stored.includes('sk-ant'));
  assert.notEqual(encrypt('sk-ant-api03-example'), stored); // random IV
  assert.equal(decrypt(stored), 'sk-ant-api03-example');
  assert.equal(decrypt(stored.slice(0, -4) + 'AAAA'), null); // tampered
});
