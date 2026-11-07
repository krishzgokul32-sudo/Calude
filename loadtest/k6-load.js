// GK load test (TRACEN guide §15). Run against STAGING, never production:
//   k6 run -e BASE_URL=https://staging.example.com -e EMAIL=demo@assistant.dev -e PASSWORD=demo1234 loadtest/k6-load.js
// Raise TARGET step by step (100, 250, 500, 1000…) until p95 or the error rate goes red. That is today's ceiling.
// Tip: start the API with API_RATE_LIMIT set high, or every virtual user shares one account's 300/min limit.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const TARGET = Number(__ENV.TARGET || 100);

export const options = {
  stages: [
    { duration: '1m', target: TARGET }, // ramp up
    { duration: '3m', target: TARGET }, // hold
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500 ms
    http_req_failed: ['rate<0.01'], // under 1% errors
  },
};

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: __ENV.EMAIL || 'demo@assistant.dev', password: __ENV.PASSWORD || 'demo1234' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'logged in': (r) => r.status === 200 });
  return { token: res.json('token') };
}

// A realistic mix: what a person clicking around GK actually loads.
const PAGES = ['/api/dashboard', '/api/analytics/overview?days=30', '/api/analytics/sales?days=30', '/api/leads?limit=50', '/api/tasks', '/api/notes', '/api/chat/conversations'];

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };
  const res = http.get(`${BASE}${PAGES[Math.floor(Math.random() * PAGES.length)]}`, params);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
