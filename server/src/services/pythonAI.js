import axios from 'axios';
import { config } from '../config.js';
import { circuitBreaker } from './resilience.js';

// Client for the optional Python AI micro-service. Every call degrades gracefully:
// if the service is down the assistant keeps working, just without those insights.
// The circuit breaker stops calling it for 30 s after 3 failures in a row, so a dead service doesn't
// add a timeout to every chat message (guide §02 cascading failures).
const http = axios.create({ baseURL: config.aiServiceUrl, timeout: 3000 });
const breaker = circuitBreaker('python-ai-service', { threshold: 3, coolDownMs: 30_000 });

const safe = (fn, fallback = null) => breaker.call(async () => (await fn()).data, fallback);

export const pythonAI = {
  health: () => safe(() => http.get('/health', { timeout: 1500 })),
  analyze: (text) => safe(() => http.post('/analyze', { text: String(text).slice(0, 20000) })),
  summarize: (text, sentences = 3) => safe(() => http.post('/summarize', { text: String(text).slice(0, 20000), sentences })),
  intent: (text) => safe(() => http.post('/intent', { text: String(text).slice(0, 20000) })),
  get available() {
    return !breaker.open;
  },
};
