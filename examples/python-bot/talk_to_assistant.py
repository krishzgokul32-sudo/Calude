"""Use the inbound bot API: any script/bot can talk to your assistant.

Get BOT_ID and BOT_API_KEY from Bot Hub → (any bot) → Connect.
Run:  BOT_ID=... BOT_API_KEY=... python talk_to_assistant.py "add task water the plants"
"""
import json
import os
import sys
import urllib.request

API = os.environ.get("API_URL", "http://localhost:5000")
BOT_ID = os.environ["BOT_ID"]
BOT_API_KEY = os.environ["BOT_API_KEY"]
text = " ".join(sys.argv[1:]) or "what can you do?"

req = urllib.request.Request(
    f"{API}/api/integrations/inbound/{BOT_ID}",
    data=json.dumps({"text": text, "sessionId": "python-cli"}).encode(),
    headers={"Content-Type": "application/json", "X-Bot-Key": BOT_API_KEY},
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    print(json.load(resp)["reply"])
