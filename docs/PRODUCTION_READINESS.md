# GK production readiness

This is GK checked against the **TRACEN "10,000 users. Will your app survive?"** guide: what was fixed, the real load-test numbers, and an honest score on the guide's 31-item checklist.

**Score: 21 / 31, top of "Getting there"** (guide bands: 0–12 not ready · 13–22 getting there · 23–28 launch-ready · 29–31 production grade). Only items actually verified are counted.
The 10 items left are almost all things that live on your own server and accounts (scheduled off-site backups, a multi-node database, alerts, billing limits, error tracking, a rollback rehearsal). Each has exact steps at the end. Doing steps 1–3 there moves GK to "Launch-ready".

---

## 1. Load-test log (guide §16)

Measured on the development sandbox: **one API process, 4 CPU cores shared with MongoDB and the load generator**, using the demo account with sample data (521 leads, 337 invoices, 200 posts). Your server will give different numbers. Re-run with `loadtest/k6-load.js` on staging.

### Before vs after (50 concurrent connections, 8 s each)

| Endpoint | Before: req/s | Before: p99 | After: req/s | After: p99 | What changed |
|---|---:|---:|---:|---:|---|
| `GET /api/analytics/overview?days=90` | 44 | 1,574 ms | **844** | **93 ms** | load each collection once with only needed fields, indexes, 30 s per-user cache with jitter + coalescing |
| `GET /api/dashboard` | 152 | 526 ms | **723** | **180 ms** | 15 s per-user cache, cached sign-in lookup |
| `GET /api/leads` | 124 (up to 500 rows) | 535 ms | **705** (pages of 50) | **111 ms** | pagination, `.lean()`, indexes |
| `GET /api/tasks` | n/a | n/a | **755** | **103 ms** | same |

### Stress, spike and soak (mixed traffic over 7 endpoints)

| Run | Concurrent | req/s | p50 | p97.5 | p99 | Errors |
|---|---:|---:|---:|---:|---:|---:|
| Stress | 25 | 551 | 43 ms | 77 ms | 87 ms | 0 |
| Stress | 50 | 662 | 74 ms | 117 ms | 133 ms | 0 |
| Stress | 100 | 720 | 137 ms | 194 ms | 204 ms | 0 |
| Stress | 200 | 716 | 287 ms | 414 ms | 421 ms | 0 |
| Stress | 400 | 740 | 530 ms | 729 ms | 739 ms | 0 |
| **Spike** 0 → 800 at once | 800 | 746 | 1,108 ms | 1,553 ms | 1,563 ms | **0** |

**What broke first:** CPU on this single API process. Requests/second stop rising at about **720–740** while latency keeps climbing (the guide's "you've hit a ceiling" signal). The p95 < 500 ms target holds up to about **200 concurrent connections**. Under the 800-connection spike nothing failed and nothing crashed. It only got slower, and it recovered as soon as the spike ended.

**Scaling out:** two API instances behind nginx were run and verified *functionally* (below). A throughput gain could **not** be measured here, because the load generator, nginx, both API copies and MongoDB all share the same 4 cores. Measure it on real servers.

### What 10,000 users means for GK (guide §18)

Using the guide's maths with GK's measured numbers:

- 10,000 users at once × 5 requests each ÷ 10 s = **5,000 req/s** → about **7 API instances** at ~720 req/s each (more for headroom), plus a MongoDB sized for it.
- 10,000 *daily* users are far lighter: if each opens GK 10 times a day and loads 7 endpoints, that's 700,000 requests a day, about **8 req/s on average** and maybe **50–80 req/s at peak**. One instance handles that comfortably.
- MongoDB connections: GK uses a pool of 50 per API instance (`MONGO_POOL_SIZE`). Keep `pool × instances` below your database plan's connection limit (for example MongoDB Atlas M10 allows 1,500).

### Claude cost (guide §14 calculator)

`AI_DAILY_LIMIT` (default **200** messages per user per day) caps the worst case. Example: 1,000 daily users × 10 Claude messages × your measured cost per message = daily cost. Multiply by 30 for the month, then do it again for 10× the users. Users who add their own key in Settings pay for their own usage.

---

## 2. What was done, by guide section

| Guide area | Fixed in GK | Where |
|---|---|---|
| **01 Database** | One connection pool (50, wait-queue timeout 5 s, server-selection timeout 5 s), connect retry with backoff + jitter, compound indexes for every hot query, `.lean()` + projections, paginated lists, unique index so one chat can't create two conversations, backup + **tested restore** scripts | `server/src/db.js`, `models/*`, `routes/crud.js`, `scripts/backup.sh`, `scripts/restore.sh` |
| **02 Backend & API** | Rate limit on every API route (300/min per user, stored in MongoDB so it holds across instances, `RateLimit` + `Retry-After` headers), 1 MB body limit (5 MB for MCP), timeouts on every outbound call, retries with exponential backoff + jitter, circuit breaker on the Python service, **idempotency keys** on POSTs, 503 + `Retry-After` when the DB is busy | `middleware/limits.js`, `middleware/idempotency.js`, `services/resilience.js`, `services/pythonAI.js`, `middleware/errors.js` |
| **03 Architecture** | Stateless API (JWT), rate limits / idempotency / locks / AI quotas all in MongoDB, Socket.IO shared across instances via MongoDB, config validated at startup, readiness probe, graceful shutdown. **Two instances tested together** | `index.js`, `config.js`, `routes/health.js` |
| **04 Cache** | Per-user analytics (30 s) and dashboard (15 s) cache with TTL jitter, request coalescing, invalidation on every write, bounded size; failed loads are not cached | `services/cache.js` |
| **05 Server & infra** | gzip/brotli, `/api/health` (liveness), `/api/health/ready` (DB ping), `/api/health/metrics` (RPS, p50/p95/p99, errors, memory, event-loop delay), Docker health checks + memory limits + restart policies, non-root containers | `routes/health.js`, `services/metrics.js`, `docker-compose.yml`, `*/Dockerfile` |
| **06 Frontend** | Error boundary (no blank screen; auto-reload once after a deploy), crash reports sent to the server log, buttons disabled while saving + idempotency key on every create, code splitting, hashed assets cached for a year with `index.html` always fresh, error messages for 429/503/timeouts | `client/src/components/ErrorBoundary.jsx`, `lib/api.js`, `hooks/useSaving.js`, `client/nginx.conf` |
| **07 Third-party & AI** | Claude: 90 s timeout, 2 SDK retries with backoff, readable errors for overload / rate limit / timeout, server-side fallback model on refusals. Telegram: 4,096-character split, each update handled once (dedupe by `update_id`). Bot notifications retried 3× with backoff | `services/llm.js`, `bots/connectors.js`, `bots/telegramBridge.js`, `bots/botManager.js` |
| **08 Security** | Login brute-force limit (10 failures / 15 min per IP + email), sign-up limit (5/hour/IP), Mongo-operator stripping on every body, string-only query filters, ownership checks on every read/write (incl. linking tasks to projects), JWT algorithm pinned, **webhook URLs can't reach private networks in production (SSRF)**, webhook replies capped at 1 MB, secrets encrypted at rest, secret-bearing responses never stored | `middleware/*`, `services/urlGuard.js`, `routes/auth.js` |
| **09 Background jobs** | Reminders claimed atomically: **4 schedulers at once delivered 30 reminders exactly once**. Retries up to 5× then parked; daily/weekly repeats skip missed days instead of firing once per missed day; jobs never overlap themselves; Telegram polled by exactly one instance via a lease that fails over in about 5 s | `services/scheduler.js`, `services/resilience.js`, `bots/telegramBridge.js` |
| **10 Deploy & monitoring** | Structured JSON logs with request IDs (passed through nginx), client-side errors logged, CI on every push (unit + integration tests on real MongoDB, API boot check, client lint + build, Python tests), zero-downtime-friendly shutdown | `services/logger.js`, `middleware/requestContext.js`, `.github/workflows/ci.yml` |
| **11 Uploads** | Not applicable: GK has no file uploads | |
| **12 Auth** | Signed-in user cached 15 s per instance (cleared on change), login/sign-up limits, password length caps | `middleware/auth.js` |
| **13 Concurrency** | Atomic reminder claims, atomic Telegram chat linking, atomic "load sample data" (5 parallel clicks → 1 success), atomic counters, idempotency keys, unique indexes | see above |
| **14 Cost** | Per-user daily Claude cap (`AI_DAILY_LIMIT`), short chat history (20 messages), max 6 tool rounds per message, cache before compute | `services/aiQuota.js`, `services/assistant.js` |

### Bugs found and fixed while doing this

1. **Reminders could be sent twice** when two server copies run, or when one scheduler run overlapped the next.
2. **Repeating reminders fired once per missed day** after downtime.
3. **The Telegram poller could overlap itself** and process the same message twice; it had no timeout.
4. **Long replies failed on Telegram** (over 4,096 characters).
5. **Failed notifications were lost**: a Telegram/Discord/Slack hiccup marked the reminder as sent anyway.
6. **Login and sign-up crashed (500)** when the password field wasn't text.
7. **nginx dropped client IPs and request IDs on `/api/`** (a location-level `proxy_set_header` disables inherited headers). Behind nginx every user would have shared one IP, so 10 failed logins by anyone would have blocked everyone.
8. **The live chat connection skipped the message length check and all rate limits.**
9. **Saving a note had no error handling**: a failed save showed nothing.
10. **Two servers starting together both tried to create the demo account**, and one crashed.
11. **Double-clicking "Load sample data"** could insert it twice.
12. **Webhook bots could be pointed at private network addresses** (SSRF).

---

## 3. Verified: two instances together (guide §03)

Two API copies on one MongoDB replica set:

| Check | Result |
|---|---|
| A change made through server B reaches a browser connected to server A | ✅ |
| A due reminder with both schedulers running is delivered | ✅ exactly once |
| Wrong logins alternating between A and B | ✅ blocked after 10 (shared limiter) |
| Only one copy polls Telegram | ✅ (lease held by one process) |
| Stopping the copy that polls Telegram (SIGTERM) | ✅ clean shutdown; the other took over within 5 s |
| Both copies seeding the demo account at once | ✅ one created it, the other skipped |

## 4. Tests

- `server/test/*.test.js`: **24 tests**. Unit tests for retries, circuit breaker, non-overlapping jobs, cache coalescing/invalidation, reminder repeats, config validation, the SSRF guard and the MCP catalog. Integration tests on real MongoDB for exactly-once reminders, the Telegram lease, the shared rate-limit counter under concurrency, the AI quota, one-conversation-per-chat under concurrency, and the sign-in cache. Run: `TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test` in `server/`.
- `ai-service/tests`: 6 tests.
- Browser walkthroughs of every page (desktop, phone, light/dark), MCP and Connections flows, mic error messages, and the error boundary with a failed code file: all passed with no console errors and no server errors.

---

## 5. The guide's checklist (§20), scored honestly

✅ verified · ⚠️ partly done or needs your setup · ❌ not done

**1. Database**
- ✅ Connection pooling configured
- ✅ Slow queries found and optimised (analytics 44 → 844 req/s)
- ✅ Indexes reviewed on filtered and sorted columns
- ⚠️ Max connection limit known and respected: the pool is configurable; you must check `MONGO_POOL_SIZE × instances` against your database plan
- ⚠️ Backups automated and a restore tested: restore **tested**; scheduling `scripts/backup.sh` (cron) and copying backups off the machine is yours to set up

**2. Backend and APIs**
- ✅ Rate limiting on public endpoints
- ✅ Timeouts set on every outbound call
- ✅ Retries use backoff and jitter
- ⚠️ Heavy work moved to background jobs: reminders and Telegram run in the background; a Claude reply is answered within the request by design, and loading sample data takes about 1 s inline
- ✅ Every list endpoint is paginated

**3. Architecture**
- ✅ App instances are stateless
- ✅ Sessions in shared storage (tokens)
- ✅ Load balancer health checks enabled
- ✅ Running two or more instances has been tested
- ⚠️ Single points of failure reviewed: MongoDB is one node in Docker Compose; use a 3-node replica set or a managed database (Atlas) in production

**4. Infrastructure and cost**
- ⚠️ CPU and memory monitored with alerts: metrics endpoint and container limits exist; alerts need a monitoring tool (for example Prometheus + Grafana or your host's alerts)
- ❌ Disk and network monitored
- ❌ Autoscaling configured with a max limit (scale is manual: `docker compose up -d --scale server=3`)
- ❌ Cloud quotas and billing alerts set (your hosting and Anthropic accounts)
- ✅ AI and third-party API usage capped

**5. Security**
- ✅ Authorisation checked on every sensitive action
- ✅ All input validated, queries parameterised
- ✅ Secrets stored outside the code
- ✅ Login and OTP endpoints rate limited (GK has no OTP)
- ✅ No API keys exposed in the frontend

**6. Testing and monitoring**
- ✅ Load test completed at expected traffic (on the dev sandbox; repeat on staging)
- ✅ Stress test found the breaking point (~720–740 req/s per instance here)
- ✅ Spike test passed (800 at once, 0 errors)
- ✅ p95 and p99 latency measured
- ⚠️ Centralised logs and error tracking live: JSON logs with request IDs + client crash reports; connect a log store / Sentry on your server
- ❌ Rollback tested end to end

**Counted as done: 21 of 31** (⚠️ items are not counted).

### To reach "production grade" (29+), on your server

1. Schedule `scripts/backup.sh` daily and copy `backups/` to cloud storage; test `scripts/restore.sh` monthly.
2. Use a managed MongoDB (Atlas) or a 3-node replica set; set `MONGO_POOL_SIZE` so `pool × instances` fits its limit.
3. Point uptime monitoring at `/api/health/ready`, scrape `/api/health/metrics` (set `METRICS_TOKEN`), and alert on CPU/memory/disk.
4. Add error tracking (Sentry free tier) and ship the JSON logs somewhere searchable.
5. Set billing alerts on your hosting and Anthropic accounts (50%, 80%, 100%).
6. Tag every release (`git tag v1.2.0`) and rehearse a rollback once (see the runbook).
7. Run `loadtest/k6-load.js` against staging and add the numbers to the log above.
