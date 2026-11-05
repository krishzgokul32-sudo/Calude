"""Example webhook bot in pure Python (no dependencies).

Run:  BOT_API_KEY=pa_xxx python webhook_bot.py   (listens on :7002)
Then create a "My own bot (webhook)" in the Bot Hub with URL http://localhost:7002
"""
import hashlib
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

BOT_API_KEY = os.environ.get("BOT_API_KEY", "")
PORT = int(os.environ.get("PORT", 7002))


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if BOT_API_KEY:
            expected = "sha256=" + hmac.new(BOT_API_KEY.encode(), raw, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, self.headers.get("X-PA-Signature", "")):
                self.send_response(401)
                self.end_headers()
                return
        data = json.loads(raw or b"{}")
        message = data.get("message", "")
        reply = f"🐍 Python bot here! Your message has {len(message.split())} words: “{message}”"
        body = json.dumps({"reply": reply}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Python webhook bot on http://localhost:{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
