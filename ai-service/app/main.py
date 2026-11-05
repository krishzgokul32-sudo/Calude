"""Personal Assistant — Python AI micro-service (FastAPI)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import nlp

app = FastAPI(title="Personal Assistant AI Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class TextIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)


class SummarizeIn(TextIn):
    sentences: int = Field(3, ge=1, le=10)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}


@app.post("/analyze")
def analyze(body: TextIn):
    return {
        "sentiment": nlp.sentiment(body.text),
        "keywords": nlp.keywords(body.text),
        "entities": nlp.entities(body.text),
        "intent": nlp.intent(body.text),
        "stats": {"characters": len(body.text), "words": len(nlp.tokenize(body.text))},
    }


@app.post("/intent")
def classify(body: TextIn):
    return nlp.intent(body.text)


@app.post("/sentiment")
def get_sentiment(body: TextIn):
    return nlp.sentiment(body.text)


@app.post("/summarize")
def summarize(body: SummarizeIn):
    return {"summary": nlp.summarize(body.text, body.sentences)}
