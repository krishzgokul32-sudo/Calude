# GK outage runbook

When GK breaks in production, go through these in order, even at 2 AM (TRACEN guide §19).
Commands assume the Docker Compose setup in this repo, run from the `Calude` folder on the server.

## Fill this in before you need it

| | |
|---|---|
| Health check | `https://<your-domain>/api/health/ready` (200 = ready, 503 = DB unreachable or shutting down) |
| Metrics | `curl -H "Authorization: Bearer $METRICS_TOKEN" https://<your-domain>/api/health/metrics` |
| Error tracker | _add your Sentry / log store link_ |
| How to roll back | `git checkout <last-good-tag> && docker compose up -d --build` |
| Hosting status page | _add it_ |
| Database status page | _e.g. status.mongodb.com if you use Atlas_ |
| Where to tell users | _e.g. your WhatsApp group / status page_ |

## 1. Confirm it's real
```bash
curl -s https://<your-domain>/api/health/ready          # is the API ready?
docker compose ps                                       # any service unhealthy or restarting?
docker compose logs --since 15m server | grep -E '"level":"(error|warn)"' | tail -50
```
Every log line and every error response has a request ID (`X-Request-Id`), so a user's error report can be traced to its exact log lines.

## 2. Ask what changed
`git log -5 --oneline` (a deploy?), `.env` changes (config?), a traffic spike (`/api/health/metrics` → `rpsLastMinute`), or a provider outage (Anthropic, Telegram, your host).

## 3. Roll back first
If a deploy caused it, roll back now and debug later:
```bash
git checkout <last-good-tag>
docker compose up -d --build server client
```
Tag every release (`git tag v1.4.0 && git push --tags`) so there is always a known-good version to go back to.

## 4. Find the saturated layer
```bash
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://<your-domain>/api/health/metrics
docker stats --no-stream
```
- `latencyMs.p95` high, `eventLoopDelayMs.p99` high, CPU at 100% → the API is CPU-bound: scale out (step 6).
- `/api/health/ready` slow or 503, logs show `database unavailable` → MongoDB: check its CPU, connections and disk.
- Logs show `python-ai-service is failing, pausing calls` → the Python service is down. GK keeps working without it; restart it with `docker compose restart ai-service`.
- Users see "Claude is overloaded" or "rate-limiting" → Anthropic. GK retries automatically; check status.anthropic.com.
- `5xx` count rising in metrics while CPU is fine → read the error logs for the request IDs.

## 5. Shed load
- Lower `API_RATE_LIMIT` (per-user requests/minute) and `AI_DAILY_LIMIT` in `.env`, then `docker compose up -d server`.
- Turn off MCP access or noisy bots from the app if they're the source.

## 6. Scale the bottleneck
```bash
docker compose up -d --scale server=3     # more API copies; nginx balances between them
```
MongoDB runs as a replica set, so live updates, rate limits, reminders and the Telegram poller all work across copies. Keep `MONGO_POOL_SIZE × copies` below your database's connection limit.

## 7. Tell your users
A short message beats silence: what's affected, that you're on it, and when you'll update next.

## 8. Write the post-mortem
What happened, the root cause, the fix, and what will stop it happening again. Add the numbers to the load-test log in `docs/PRODUCTION_READINESS.md`.

---

## Backups
```bash
./scripts/backup.sh                                    # writes backups/gk-<date>.archive.gz, keeps the newest 14
./scripts/restore.sh backups/gk-<date>.archive.gz      # restores into a TEST database and prints counts
```
Schedule the backup daily with cron and copy `backups/` off the server. Test a restore once a month.
