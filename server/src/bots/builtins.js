import axios from 'axios';
import { calculate, extractExpression } from './calculator.js';

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs. 🐛',
  'I told my assistant to remind me to stop procrastinating. It said: "Later." ⏰',
  'There are 10 kinds of people: those who understand binary and those who don\'t.',
  'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?"',
  'Why did the bot go to therapy? Too many unresolved promises. 🤖',
  'My MongoDB and I have a great relationship — it never asks for a schema. 🍃',
];

const WEATHER_CODES = {
  0: 'clear sky ☀️', 1: 'mainly clear 🌤️', 2: 'partly cloudy ⛅', 3: 'overcast ☁️', 45: 'fog 🌫️', 48: 'rime fog 🌫️',
  51: 'light drizzle 🌦️', 53: 'drizzle 🌦️', 55: 'heavy drizzle 🌧️', 61: 'light rain 🌧️', 63: 'rain 🌧️', 65: 'heavy rain 🌧️',
  71: 'light snow 🌨️', 73: 'snow 🌨️', 75: 'heavy snow ❄️', 80: 'rain showers 🌦️', 81: 'rain showers 🌧️', 82: 'violent showers ⛈️',
  95: 'thunderstorm ⛈️', 96: 'thunderstorm with hail ⛈️', 99: 'severe thunderstorm ⛈️',
};

const http = axios.create({ timeout: 6000, headers: { 'User-Agent': 'PersonalAssistant/1.0' } });

export const builtinSkills = {
  async calculator(text) {
    const expr = extractExpression(text);
    if (!expr) return 'Give me something to calculate, e.g. `@calc (12 + 8) * 3`';
    try {
      return `🧮 ${expr} = **${calculate(expr)}**`;
    } catch (e) {
      return `I couldn't calculate that: ${e.message}`;
    }
  },

  async weather(text, ctx) {
    const cityMatch = text.match(/\b(?:in|at|for)\s+([a-zA-Z\s.-]+?)(?:\?|$|\s+(?:today|now|tomorrow))/i);
    const city = (cityMatch?.[1] || text.replace(/weather|what'?s|how'?s|the|is|it|like|\?/gi, '').trim() || ctx?.user?.preferences?.city || '').trim();
    if (!city) return 'Which city? Try `@weather in Chennai`';
    const geo = await http.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: city, count: 1 } });
    const place = geo.data?.results?.[0];
    if (!place) return `I couldn't find a place called "${city}".`;
    const { data } = await http.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: place.latitude, longitude: place.longitude, current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code', daily: 'temperature_2m_max,temperature_2m_min', timezone: 'auto', forecast_days: 1 },
    });
    const c = data.current;
    return `**${place.name}, ${place.country}** — ${WEATHER_CODES[c.weather_code] || 'weather'}\n` +
      `🌡️ ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C) · 💧 ${c.relative_humidity_2m}% · 💨 ${c.wind_speed_10m} km/h\n` +
      `Today: ${data.daily.temperature_2m_min[0]}° → ${data.daily.temperature_2m_max[0]}°C`;
  },

  async wikipedia(text) {
    const topic = text.replace(/^(who|what)\s+(is|are|was|were)\s+/i, '').replace(/[?]/g, '').replace(/^(tell me about|search|wiki)\s+/i, '').trim();
    if (!topic) return 'What should I look up? e.g. `@wiki Alan Turing`';
    try {
      const { data } = await http.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
      return `📚 **${data.title}**\n${data.extract}\n${data.content_urls?.desktop?.page || ''}`;
    } catch {
      return `No Wikipedia article found for "${topic}".`;
    }
  },

  async joke() {
    return JOKES[Math.floor(Math.random() * JOKES.length)];
  },

  async echo(text) {
    return `🔁 ${text}`;
  },
};
