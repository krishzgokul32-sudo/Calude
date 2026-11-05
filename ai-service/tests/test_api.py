from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_sentiment_positive_and_negated():
    assert client.post("/sentiment", json={"text": "I really love this, it is awesome!"}).json()["label"] == "positive"
    assert client.post("/sentiment", json={"text": "This is not good, the app is slow and broken"}).json()["label"] == "negative"
    assert client.post("/sentiment", json={"text": "The meeting is on Tuesday"}).json()["label"] == "neutral"


def test_intent():
    assert client.post("/intent", json={"text": "remind me to drink water in 5 minutes"}).json()["intent"] == "set_reminder"
    assert client.post("/intent", json={"text": "add task buy milk"}).json()["intent"] == "create_task"
    assert client.post("/intent", json={"text": "what's the weather in Tokyo"}).json()["intent"] == "weather"


def test_analyze_entities_and_keywords():
    data = client.post("/analyze", json={"text": "Email bob@example.com tomorrow at 5pm about the $200 invoice @mybot"}).json()
    ents = data["entities"]
    assert ents["email"] == ["bob@example.com"]
    assert "tomorrow" in [d.lower() for d in ents["date"]]
    assert ents["money"] and ents["mention"] == ["@mybot"]
    assert "invoice" in data["keywords"]


def test_summarize():
    text = ("MongoDB stores documents. React renders the interface. Node runs the API server. "
            "Python adds NLP features like sentiment. The assistant connects bots from Telegram, Discord and Slack.")
    summary = client.post("/summarize", json={"text": text, "sentences": 2}).json()["summary"]
    assert summary.count(".") == 2


def test_validation():
    assert client.post("/analyze", json={"text": ""}).status_code == 422
