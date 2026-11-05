# 🤖 Bot Integration Guide

This guide covers how to **create bots** inside GK and how to **connect bots you already have**, so everything runs through one personal assistant.

```
   You ──chat──▶ GK ──@mention / trigger / call_bot──▶ Your bots   (outbound)
   Your bots ──POST /integrations/inbound/:botId──▶ GK            (inbound)
```

---

## 1. How messages are routed

For every message, `handleMessage()` picks a destination in this order:

1. **`@handle` mention**, e.g. `@weather in Paris`. It goes to that bot, and the mention is stripped from the text.
2. **Trigger word**: a bot with `triggers: ["recipe"]` receives "any good recipe for tonight?".
3. **The brain.** With Claude enabled, the assistant may still call bots itself through the `call_bot` tool, e.g. "check the weather in Paris and add a task to pack an umbrella if it rains".

Disabled bots are skipped. Every bot call is logged (`BotLog`) with its latency and status, and shows up live in the Bot Hub.

---

## 2. Bot types

### 🧩 Built-in skills
Skills that run inside the server: `calculator`, `weather` (Open-Meteo, no key), `wikipedia`, `joke`, `echo`.
To add your own, write a function in `server/src/bots/builtins.js` and add its name to `BUILTIN_SKILLS` in `server/src/models/Bot.js`:

```js
// builtins.js
export const builtinSkills = {
  // ...
  async dice(text) {
    return `🎲 You rolled a ${1 + Math.floor(Math.random() * 6)}`;
  },
};
```

### 🧠 AI personas
Give a bot a personality with a system prompt. It replies with Claude, using the last 10 messages of the conversation as context. This needs `ANTHROPIC_API_KEY` on the server.

```
Name: Chef   Handle: chef   Triggers: recipe, cook
Prompt: You are Chef, a friendly cooking expert. Suggest quick recipes using what the user has.
```

### 🔗 Webhook: your own bot
Use this type to plug in **any bot you've built**, in any language.

**Request we send to your URL:**

```http
POST https://your-bot.example.com/assistant
Content-Type: application/json
X-PA-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with the bot's API key>
X-PA-Bot: yourhandle

{
  "event": "message",
  "message": "hello there",
  "bot": { "id": "…", "handle": "yourhandle", "name": "Your Bot" },
  "user": { "id": "…", "name": "Krish" },
  "conversationId": "…",
  "timestamp": "2026-11-05T14:00:00.000Z"
}
```

**Reply with** `{ "reply": "text (Markdown OK)" }`. A plain string, `text` or `message` field also works. The timeout is 10 s.

**Verify the signature** (strongly recommended):

```js
// Node.js
const expected = 'sha256=' + crypto.createHmac('sha256', BOT_API_KEY).update(rawBody).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(req.headers['x-pa-signature']), Buffer.from(expected))) reject();
```

```python
# Python
expected = "sha256=" + hmac.new(BOT_API_KEY.encode(), raw_body, hashlib.sha256).hexdigest()
if not hmac.compare_digest(expected, request.headers["X-PA-Signature"]): reject()
```

Working examples: [`examples/node-webhook-bot/server.js`](../examples/node-webhook-bot/server.js) and [`examples/python-bot/webhook_bot.py`](../examples/python-bot/webhook_bot.py).

### ✈️ Telegram
1. In Telegram, message **@BotFather** → `/newbot` → copy the token.
2. Go to Bot Hub → Create bot → **Telegram**, paste the token, and optionally enable **"Deliver my reminders through this bot"**.
3. Send `/start` to your bot. That chat is now **linked** to your assistant.
4. Chat with GK from Telegram: "add task buy milk", "@weather in Chennai"… Replies come back to Telegram, and the conversation also appears in the web app.

**Delivery mode:**
- `PUBLIC_API_URL` starts with `https://`: Telegram **webhooks** are registered automatically and verified with a secret token.
- Otherwise (e.g. localhost): the server **long-polls** Telegram every 3 s. No public URL is needed.

> 🔒 Only the first chat that messages the bot can use it. Other chats get "This assistant is private."

### 🎮 Discord / 💼 Slack
Create an **incoming webhook** (Discord: Channel → Integrations → Webhooks; Slack: an app with Incoming Webhooks) and paste its URL.
- `@yourdiscordbot deploy finished ✅` posts that text to the channel.
- With **notify** enabled, every reminder is posted there too.

---

## 3. Inbound API: connect *any* bot to the assistant

Every bot has an **API key** and an **inbound endpoint** (Bot Hub → 🔌 Connect). Any program can talk to your assistant as you:

```http
POST /api/integrations/inbound/:botId
X-Bot-Key: pa_xxxxxxxxx
Content-Type: application/json

{ "text": "remind me to stretch in 10 minutes", "sessionId": "chat-42" }
```

Response:

```json
{
  "reply": "⏰ I'll remind you to **stretch** on Thu, Nov 5, 2:40 PM.",
  "conversationId": "6aec…",
  "role": "assistant",
  "meta": { "actions": [{ "tool": "set_reminder", "ok": true }], "engine": "local" }
}
```

- `sessionId` keeps separate conversation threads. Use your platform's chat or user id.
- Messages can mention other bots, so one bot can call another through the assistant: `"@weather in Oslo"`.
- The endpoint returns `401` for a wrong key or a disabled bot, and is rate-limited to 120 requests/min.

**Ideas:** a WhatsApp/Twilio bot, a Discord bot (discord.js) that forwards DMs, an Alexa skill, a Raspberry Pi button, Zapier/Make/n8n automations, or a cron script that sends you a daily briefing.

```python
# examples/python-bot/talk_to_assistant.py
r = requests.post(f"{API}/api/integrations/inbound/{BOT_ID}",
                  headers={"X-Bot-Key": BOT_API_KEY},
                  json={"text": "show my tasks", "sessionId": "python-cli"})
print(r.json()["reply"])
```

---

## 4. Managing bots

| Action | Where |
| --- | --- |
| Enable / disable | Toggle on the bot card |
| Test without the assistant | ▶️ Test console (`POST /api/bots/:id/test`) |
| Credentials, curl & code snippets | 🔌 Connect |
| Rotate API key | 🔌 Connect → Rotate key (Telegram webhooks are re-registered automatically) |
| Activity history | 📜 Logs (kept for 30 days) |
| Edit identity, triggers, config | ✏️ Edit |

---

## 5. Adding a brand-new bot type

1. Add the type to `BOT_TYPES` in `server/src/models/Bot.js`.
2. Handle it in `runBot()` in `server/src/bots/botManager.js`.
3. Validate its config in `validateConfig()` in `server/src/routes/bots.js`.
4. Add a label and emoji to `TYPE_INFO` and a config form in `ConfigFields` in `client/src/pages/Bots.jsx`.
