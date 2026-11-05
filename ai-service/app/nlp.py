"""Lightweight, dependency-free NLP for the personal assistant.

Everything here is pure Python so the service starts instantly and runs anywhere:
- sentiment: lexicon scoring with negation + intensifier handling
- keywords: stop-word filtered term frequency
- entities: regex extraction (emails, urls, times, dates, money, mentions)
- intent: a tiny multinomial Naive Bayes classifier trained on built-in examples
- summarize: frequency-based extractive summarization
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

STOPWORDS = set(
    """a an the and or but if then else when at by for with about against between into through during before after
    above below to from up down in out on off over under again further once here there all any both each few more most
    other some such no nor not only own same so than too very can will just don should now i me my myself we our ours
    you your yours he him his she her it its they them their what which who whom this that these those am is are was
    were be been being have has had having do does did doing would could ought im youre hes shes its were theyre ive
    youve weve theyve id youd hed shed wed theyd ill youll hell shell well theyll isnt arent wasnt werent hasnt havent
    hadnt doesnt dont didnt wont wouldnt shant shouldnt cant cannot couldnt mustnt lets thats whos whats heres theres
    whens wheres whys hows please also get got like really much one two""".split()
)

POSITIVE = {
    "good": 2, "great": 3, "awesome": 4, "amazing": 4, "love": 3, "loved": 3, "like": 2, "excellent": 4, "happy": 3,
    "nice": 2, "fantastic": 4, "wonderful": 4, "best": 3, "fast": 2, "easy": 2, "helpful": 2, "thanks": 2, "thank": 2,
    "cool": 2, "perfect": 4, "glad": 2, "enjoy": 2, "excited": 3, "beautiful": 3, "productive": 2, "win": 2, "smooth": 2,
}
NEGATIVE = {
    "bad": -2, "terrible": -4, "awful": -4, "hate": -3, "slow": -2, "bug": -2, "bugs": -2, "broken": -3, "sad": -2,
    "angry": -3, "worst": -4, "poor": -2, "hard": -1, "difficult": -2, "annoying": -3, "fail": -3, "failed": -3,
    "error": -2, "tired": -2, "stressed": -3, "late": -1, "problem": -2, "issue": -1, "crash": -3, "ugly": -3, "boring": -2,
}
NEGATIONS = {"not", "no", "never", "dont", "isnt", "wasnt", "cant", "wont", "didnt", "doesnt", "aint", "nothing"}
INTENSIFIERS = {"very": 1.5, "really": 1.5, "so": 1.3, "extremely": 2.0, "super": 1.5, "too": 1.2, "slightly": 0.5}

WORD_RE = re.compile(r"[a-zA-Z']+")


def tokenize(text: str) -> list[str]:
    return [w.replace("'", "") for w in WORD_RE.findall(text.lower())]


def sentiment(text: str) -> dict:
    tokens = tokenize(text)
    score = 0.0
    hits = 0
    for i, tok in enumerate(tokens):
        value = POSITIVE.get(tok) or NEGATIVE.get(tok)
        if not value:
            continue
        hits += 1
        window = tokens[max(0, i - 3) : i]
        if any(w in NEGATIONS for w in window):
            value = -value * 0.75
        if i > 0 and tokens[i - 1] in INTENSIFIERS:
            value *= INTENSIFIERS[tokens[i - 1]]
        score += value
    if "!" in text and score:
        score *= 1.1
    normalized = score / math.sqrt(score * score + 15) if score else 0.0  # squash to (-1, 1)
    label = "positive" if normalized > 0.15 else "negative" if normalized < -0.15 else "neutral"
    emoji = {"positive": "😊", "negative": "😟", "neutral": "😐"}[label]
    return {"label": label, "score": round(normalized, 3), "emoji": emoji, "matches": hits}


def keywords(text: str, top: int = 6) -> list[str]:
    tokens = [t for t in tokenize(text) if t not in STOPWORDS and len(t) > 2]
    return [w for w, _ in Counter(tokens).most_common(top)]


ENTITY_PATTERNS = {
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
    "url": re.compile(r"https?://\S+"),
    "mention": re.compile(r"(?<!\w)@[a-z0-9_-]{2,30}\b", re.I),
    "time": re.compile(r"\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b", re.I),
    "relative_time": re.compile(r"\bin\s+\d+\s*(?:seconds?|minutes?|mins?|hours?|days?|weeks?)\b", re.I),
    "date": re.compile(r"\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b", re.I),
    "money": re.compile(r"(?:[$€£₹]\s?\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s?(?:usd|eur|inr|rupees|dollars)\b)", re.I),
}


def entities(text: str) -> dict:
    found = {name: rx.findall(text) for name, rx in ENTITY_PATTERNS.items()}
    return {k: v for k, v in found.items() if v}


# --- Intent classification: multinomial Naive Bayes ------------------------------
TRAINING = {
    "create_task": ["add task buy milk", "create a todo for the report", "i need to finish the slides", "new task call the bank",
                     "put laundry on my to do list", "todo email the client", "add buy groceries to my tasks"],
    "list_tasks": ["show my tasks", "what is on my todo list", "list my todos", "what do i have to do today", "open tasks"],
    "set_reminder": ["remind me to call mom in 10 minutes", "set a reminder for 5pm", "remind me tomorrow at 9 to stretch",
                      "dont let me forget the meeting", "alert me in an hour"],
    "create_note": ["note that the wifi password is blue", "save a note about the meeting", "remember that john likes tea",
                     "write this down", "take a note"],
    "search_notes": ["find my notes about python", "search notes for wifi", "what did i write about the trip"],
    "weather": ["what is the weather in paris", "will it rain tomorrow", "how hot is it outside", "forecast for london"],
    "math": ["what is 12 times 8", "calculate 15 percent of 200", "how much is 3 plus 4", "solve 2 to the power of 10"],
    "greeting": ["hello", "hi there", "good morning", "hey assistant", "whats up"],
    "smalltalk": ["how are you", "tell me a joke", "who are you", "thank you so much", "you are awesome"],
}


def _features(text: str) -> list[str]:
    return [t for t in tokenize(text) if t not in STOPWORDS] or tokenize(text)


class NaiveBayes:
    ALPHA = 0.1  # Lidstone smoothing; small alpha keeps single strong words decisive

    def __init__(self, data: dict[str, list[str]]):
        self.word_counts: dict[str, Counter] = defaultdict(Counter)
        self.class_counts = Counter()
        self.vocab: set[str] = set()
        for label, examples in data.items():
            for ex in examples:
                toks = _features(ex)
                self.word_counts[label].update(toks)
                self.class_counts[label] += 1
                self.vocab.update(toks)
        self.total = sum(self.class_counts.values())

    def predict(self, text: str) -> dict:
        toks = [t for t in _features(text) if t in self.vocab]
        if not toks:
            return {"intent": "unknown", "confidence": 0.0, "ranking": []}
        log_probs = {}
        v = len(self.vocab)
        for label, count in self.class_counts.items():
            wc = self.word_counts[label]
            denom = sum(wc.values()) + self.ALPHA * v
            lp = math.log(count / self.total)
            for t in toks:
                lp += math.log((wc[t] + self.ALPHA) / denom)
            log_probs[label] = lp
        m = max(log_probs.values())
        exp = {k: math.exp(lp - m) for k, lp in log_probs.items()}
        z = sum(exp.values())
        ranking = sorted(((k, round(p / z, 3)) for k, p in exp.items()), key=lambda x: -x[1])
        best, conf = ranking[0]
        return {"intent": best if conf >= 0.3 else "unknown", "confidence": conf, "ranking": ranking[:3]}


_classifier = NaiveBayes(TRAINING)


def intent(text: str) -> dict:
    return _classifier.predict(text)


# --- Summarization --------------------------------------------------------------
SENT_RE = re.compile(r"(?<=[.!?])\s+")


def summarize(text: str, sentences: int = 3) -> str:
    parts = [s.strip() for s in SENT_RE.split(text.strip()) if s.strip()]
    if len(parts) <= sentences:
        return " ".join(parts)
    freq = Counter(t for t in tokenize(text) if t not in STOPWORDS)
    if not freq:
        return " ".join(parts[:sentences])
    peak = max(freq.values())
    scores = []
    for idx, s in enumerate(parts):
        toks = [t for t in tokenize(s) if t in freq]
        score = sum(freq[t] / peak for t in toks) / (len(toks) + 1) ** 0.5
        if idx == 0:
            score *= 1.2  # lead bias
        scores.append((score, idx))
    keep = sorted(idx for _, idx in sorted(scores, reverse=True)[:sentences])
    return " ".join(parts[i] for i in keep)
