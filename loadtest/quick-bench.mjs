// Quick local benchmark without installing k6:  npm i -g autocannon  (or npx), then
//   node loadtest/quick-bench.mjs http://localhost:5000
// Prints requests/second and p50/p97.5/p99 latency per endpoint. Start the API with API_RATE_LIMIT=100000000
// first, otherwise one test account hits its own rate limit (that 429 is the limiter working, not a failure).
import autocannon from 'autocannon';

const BASE = process.argv[2] || 'http://localhost:5000';
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.EMAIL || 'demo@assistant.dev', password: process.env.PASSWORD || 'demo1234' }),
}).then((r) => r.json());
if (!login.token) throw new Error(`Login failed: ${JSON.stringify(login)}`);

for (const path of ['/api/health', '/api/dashboard', '/api/analytics/overview?days=90', '/api/leads?limit=50', '/api/tasks']) {
  const r = await autocannon({ url: BASE + path, connections: 50, duration: 10, headers: { authorization: `Bearer ${login.token}` } });
  console.log(`${path.padEnd(34)} rps=${r.requests.average.toFixed(0).padStart(5)}  p50=${r.latency.p50}ms  p97.5=${r.latency.p97_5}ms  p99=${r.latency.p99}ms  errors=${r.errors} non2xx=${r.non2xx}`);
}
