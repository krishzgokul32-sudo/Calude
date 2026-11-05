// Example: connect YOUR OWN bot to the personal assistant (webhook type).
// 1. node server.js            (listens on :7001)
// 2. Bot Hub → Create bot → "My own bot (webhook)" → URL http://localhost:7001
// 3. Copy the bot's API key into BOT_API_KEY so signatures can be verified.
// 4. In chat: "@yourhandle hello"
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 7001;
const BOT_API_KEY = process.env.BOT_API_KEY || ''; // optional but recommended

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (BOT_API_KEY) {
        const expected = 'sha256=' + crypto.createHmac('sha256', BOT_API_KEY).update(raw).digest('hex');
        const got = req.headers['x-pa-signature'] || '';
        if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
          res.writeHead(401).end('bad signature');
          return;
        }
      }
      const { message, user } = JSON.parse(raw || '{}');
      // Your bot logic goes here: call your own APIs, databases, models...
      const reply = /order/i.test(message)
        ? `📦 ${user?.name || 'Friend'}, your last order #4821 shipped yesterday.`
        : `👋 Hi ${user?.name || 'there'}! My Node bot received: "${message}"`;
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ reply }));
    });
  })
  .listen(PORT, () => console.log(`Webhook bot listening on http://localhost:${PORT}`));
