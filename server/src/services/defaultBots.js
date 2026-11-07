import Bot from '../models/Bot.js';

// Every new user starts with a small fleet of ready-to-use bots.
export const DEFAULT_BOTS = [
  { name: 'Weather', handle: 'weather', type: 'builtin', avatar: '🌦️', color: '#38bdf8', triggers: ['weather', 'forecast'], description: 'Live weather for any city (Open-Meteo).', config: { skill: 'weather' } },
  { name: 'Calculator', handle: 'calc', type: 'builtin', avatar: '🧮', color: '#f59e0b', triggers: ['calculate'], description: 'Safe math evaluator.', config: { skill: 'calculator' } },
  { name: 'Wikipedia', handle: 'wiki', type: 'builtin', avatar: '📚', color: '#a3a3a3', triggers: ['wikipedia'], description: 'Summaries from Wikipedia.', config: { skill: 'wikipedia' } },
  { name: 'Maps', handle: 'map', type: 'builtin', avatar: '🗺️', color: '#4f8dff', triggers: [], description: 'Find any place and get a Google Maps link.', config: { skill: 'map' } },
  { name: 'Jester', handle: 'joke', type: 'builtin', avatar: '🃏', color: '#f472b6', triggers: ['joke'], description: 'Tells a (nerdy) joke.', config: { skill: 'joke' } },
  { name: 'Coach', handle: 'coach', type: 'ai', avatar: '🏋️', color: '#22c55e', triggers: [], description: 'AI productivity coach persona.', config: { systemPrompt: 'You are Coach, an upbeat productivity coach. Give short, practical, motivating advice with concrete next steps.' } },
];

export async function seedDefaultBots(userId) {
  await Bot.insertMany(DEFAULT_BOTS.map((b) => ({ ...b, user: userId })), { ordered: false }).catch(() => {});
}
