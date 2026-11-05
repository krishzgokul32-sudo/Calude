import axios from 'axios';
import { config } from '../config.js';

// Client for the optional Python AI micro-service. Every call degrades gracefully:
// if the service is down the assistant keeps working, just without those insights.
const http = axios.create({ baseURL: config.aiServiceUrl, timeout: 3000 });

async function safe(fn, fallback = null) {
  try {
    const { data } = await fn();
    return data;
  } catch {
    return fallback;
  }
}

export const pythonAI = {
  health: () => safe(() => http.get('/health')),
  analyze: (text) => safe(() => http.post('/analyze', { text })),
  summarize: (text, sentences = 3) => safe(() => http.post('/summarize', { text, sentences })),
  intent: (text) => safe(() => http.post('/intent', { text })),
};
