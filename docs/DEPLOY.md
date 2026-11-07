# Put GK live on your domain (g5tech.in)

When you're done, GK opens at **https://g5tech.in** with a free, auto-renewing HTTPS certificate.
`www.g5tech.in` redirects there too.

How it fits together:

```
Browser ──https──▶ Caddy (ports 80/443, gets the certificate)
                     └──▶ client (nginx: the React app, /api, /socket.io)
                            └──▶ server (Node API) ──▶ MongoDB · ai-service (Python)
```

You need three things:

1. **A server (VPS)** that runs all the time. Get Ubuntu 24.04 with at least **2 GB RAM** (4 GB is comfortable) from DigitalOcean, Hetzner, AWS Lightsail, Hostinger VPS or similar. Note its **public IP address**.
2. **Access to your domain's DNS** at the place you bought `g5tech.in` (GoDaddy, Hostinger, BigRock, Namecheap, Cloudflare…).
3. **An email address** for certificate notices.

---

## 1. Point the domain at the server

In your domain's DNS settings, add (or edit) these records. Replace `203.0.113.10` with your server's IP:

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| A | `@` | `203.0.113.10` | 600 (or Auto) |
| A | `www` | `203.0.113.10` | 600 (or Auto) |

Delete any other `A` or `AAAA` records for `@` and `www` (for example a "parked" page). If you use
Cloudflare, set both records to **DNS only** (grey cloud) for the first start, so Caddy can get the
certificate.

Check it worked (can take a few minutes, sometimes an hour):

```bash
nslookup g5tech.in      # should show your server's IP
```

## 2. Prepare the server

Log in (`ssh root@203.0.113.10`) and run:

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh

# Firewall: SSH and web only
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

## 3. Get the code

The repository is private, so use a GitHub **personal access token** (GitHub → Settings → Developer
settings → Fine-grained tokens → read access to `Calude`) as the password when asked:

```bash
git clone https://github.com/krishzgokul32-sudo/Calude.git gk
cd gk
git checkout main     # or claude/personal-assistant-end-to-end-bfqlug until PR #3 is merged
```

## 4. Settings (.env)

```bash
cp .env.example .env
nano .env
```

Fill in at least:

```ini
DOMAIN=g5tech.in
ACME_EMAIL=you@example.com
JWT_SECRET=<paste the output of: openssl rand -hex 32>
```

Optional:

```ini
# One AI key for everyone (users can still add their own in Settings → AI brain):
ANTHROPIC_API_KEY=            # Claude
AI_API_KEY=                   # or any other provider (OpenAI, Gemini, Groq, OpenRouter…)
AI_PROVIDER=                  # guessed from the key when blank
# A public demo account (demo@assistant.dev / demo1234). Off by default in production:
SEED_DEMO=false
```

Keep `.env` private. It is in `.gitignore`.

## 5. Start GK

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The first build takes a few minutes. Then:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps         # all "running"/"healthy"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs caddy # "certificate obtained successfully"
curl -s https://g5tech.in/api/health                                       # {"status":"ok",...}
```

Open **https://g5tech.in**. Create your account with **Enlist now**, then go to **Settings → AI brain**
and connect your AI key.

Tip: save typing with an alias:

```bash
echo "alias gk='docker compose -f docker-compose.yml -f docker-compose.prod.yml'" >> ~/.bashrc && source ~/.bashrc
gk ps
```

## 6. After it's live

- **Telegram bots** switch to webhooks automatically, because the site is now https.
- **MCP server** connection URLs now show `https://g5tech.in/api/mcp`, so Claude Desktop, Cursor and VS Code
  can connect to it over https from anywhere.
- **Google Maps key:** in Google Cloud Console, restrict the key to the websites `https://g5tech.in/*` and
  `https://www.g5tech.in/*`.
- **Backups:** `scripts/backup.sh` dumps MongoDB. Run it daily with cron and copy the files off the
  server. See `docs/RUNBOOK.md`.

## Updating to a new version

```bash
cd ~/gk
git pull
gk up -d --build
```

## If something goes wrong

| What you see | Fix |
|---|---|
| Browser says "not secure" or the certificate fails | DNS isn't pointing at the server yet (`nslookup g5tech.in`), or ports 80/443 are blocked (cloud firewall / `ufw`). Check `gk logs caddy`. |
| `DOMAIN` / `ACME_EMAIL` / `JWT_SECRET` "must be set" | Fill them in `.env` (no `#` in front, no quotes). |
| `!reset` error when starting | Your Docker Compose is older than 2.24. Update Docker with `curl -fsSL https://get.docker.com \| sh`. |
| Page loads but sign-in fails | `gk logs server`. Usually MongoDB is still starting; wait a minute. |
| Server runs out of memory | Use a VPS with more RAM (2 GB minimum, 4 GB recommended). |
