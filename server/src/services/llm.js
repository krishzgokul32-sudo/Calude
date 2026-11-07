import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import User from '../models/User.js';
import { decrypt } from './secrets.js';
import { assertPublicUrl } from './urlGuard.js';

/**
 * GK's AI brain works with any provider.
 *  - Anthropic Claude through the official SDK.
 *  - Everything else through the OpenAI-compatible Chat Completions API, which OpenAI, Google Gemini,
 *    Groq, OpenRouter, Mistral, DeepSeek, xAI, Together and Ollama all speak.
 * A user's own key (saved in Settings) is used first; otherwise the server's key (AI_API_KEY or
 * ANTHROPIC_API_KEY). With neither, the assistant falls back to the rule-based brain (localBrain.js).
 * Every call has a timeout and retries 429/5xx/network errors with backoff (guide §07).
 */

export const PROVIDERS = {
  anthropic: { label: 'Anthropic Claude', docs: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', prefer: [/^gpt-4o-mini$/, /^gpt-4\.1-mini$/, /^gpt-4o$/, /^gpt-/], docs: 'https://platform.openai.com/api-keys' },
  gemini: { label: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', prefer: [/^gemini-[\d.]+-flash$/, /flash(?!.*(lite|image|tts|audio|live|exp|preview|thinking))/, /flash/, /gemini/], docs: 'https://aistudio.google.com/apikey' },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', prefer: [/llama-3\.3-70b-versatile/, /llama-3\.\d+-70b/, /llama/, /./], docs: 'https://console.groq.com/keys' },
  openrouter: { label: 'OpenRouter (any model)', base: 'https://openrouter.ai/api/v1', defaultModel: 'openrouter/auto', docs: 'https://openrouter.ai/keys' },
  mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', docs: 'https://console.mistral.ai/api-keys' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', docs: 'https://platform.deepseek.com/api_keys' },
  xai: { label: 'xAI Grok', base: 'https://api.x.ai/v1', prefer: [/grok.*mini/, /^grok-\d/, /grok/], docs: 'https://console.x.ai' },
  together: { label: 'Together AI', base: 'https://api.together.xyz/v1', prefer: [/Llama-3\.3-70B-Instruct-Turbo/i, /llama.*instruct/i], docs: 'https://api.together.ai/settings/api-keys' },
  ollama: { label: 'Ollama (local models)', base: 'http://host.docker.internal:11434/v1', keyOptional: true, docs: 'https://ollama.com' },
  custom: { label: 'Other (OpenAI-compatible)', needsBase: true, keyOptional: true },
};
export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** Guess the provider from the shape of the key. Returns null when it can't tell. */
export function detectProvider(key = '') {
  if (/^sk-ant-/.test(key)) return 'anthropic';
  if (/^sk-or-/.test(key)) return 'openrouter';
  if (/^gsk_/.test(key)) return 'groq';
  if (/^AIza/.test(key)) return 'gemini';
  if (/^xai-/.test(key)) return 'xai';
  if (/^sk-/.test(key)) return 'openai'; // DeepSeek keys look the same; the user can pick DeepSeek.
  return null;
}

// Short provider name for messages, e.g. "OpenRouter" rather than "OpenRouter (any model)".
const label = (p) => (p === 'custom' ? 'AI provider' : (PROVIDERS[p]?.label || p).replace(/\s*\(.*\)$/, ''));
const TIMEOUT = 90_000;
const CLIENT_OPTS = { timeout: TIMEOUT, maxRetries: 2 };
const anthropicClients = new Map(); // apiKey -> Anthropic client

function anthropicClient(apiKey) {
  if (!anthropicClients.has(apiKey)) {
    if (anthropicClients.size > 500) anthropicClients.clear();
    anthropicClients.set(apiKey, new Anthropic({ apiKey, ...CLIENT_OPTS }));
  }
  return anthropicClients.get(apiKey);
}

/** The server-wide brain from environment variables, if any. */
function serverBrain() {
  if (config.aiApiKey || (config.aiProvider && PROVIDERS[config.aiProvider]?.keyOptional && config.aiBaseUrl)) {
    const provider = config.aiProvider || detectProvider(config.aiApiKey) || 'openai';
    return { provider, key: config.aiApiKey, model: config.aiModel, base: config.aiBaseUrl || PROVIDERS[provider]?.base, server: true };
  }
  if (config.anthropicKey) return { provider: 'anthropic', key: config.anthropicKey, model: config.claudeModel, server: true };
  return null;
}
const SERVER = serverBrain();

export const serverKeyConfigured = () => Boolean(SERVER);
export const serverProvider = () => (SERVER ? label(SERVER.provider) : null);

/** Which brain this user should think with: their own key first, then the server's. Null if none. */
export async function brainFor(user) {
  if (user?._id) {
    const row = await User.findById(user._id).select('+anthropicKey aiProvider aiModel aiBaseUrl').lean();
    const provider = row?.aiProvider || 'anthropic';
    const key = row?.anthropicKey ? decrypt(row.anthropicKey) : '';
    if (key || (PROVIDERS[provider]?.keyOptional && row?.aiBaseUrl)) {
      return { provider, key, model: row.aiModel || (provider === 'anthropic' ? config.claudeModel : ''), base: row.aiBaseUrl || PROVIDERS[provider]?.base };
    }
  }
  return SERVER;
}

export const llmAvailable = async (user) => Boolean(await brainFor(user));

// ---------- OpenAI-compatible HTTP ----------

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function oaRequest(brain, path, body, { retries = 2, timeout = TIMEOUT } = {}) {
  const url = `${String(brain.base).replace(/\/+$/, '')}${path}`;
  const headers = { 'content-type': 'application/json' };
  if (brain.key) headers.authorization = `Bearer ${brain.key}`;
  if (brain.provider === 'openrouter') {
    headers['HTTP-Referer'] = config.clientUrl;
    headers['X-Title'] = 'GK Agentic AI';
  }
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout), redirect: 'error' });
    } catch (err) {
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt + Math.random() * 250);
        continue;
      }
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new ProviderError(timedOut ? `${label(brain.provider)} took too long to answer. Please try again.` : `Couldn't reach ${label(brain.provider)}. Check the address and the server's internet connection.`, 0);
    }
    if (res.ok) return res.json();
    const text = await res.text().catch(() => '');
    let detail = '';
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : '') || (Array.isArray(j) ? j[0]?.error?.message : '');
    } catch {
      detail = text.slice(0, 200);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 700 * 2 ** attempt;
      await sleep(Math.min(wait, 8000) + Math.random() * 250);
      continue;
    }
    throw new ProviderError(friendlyStatus(brain.provider, res.status, detail), res.status);
  }
}

function friendlyStatus(provider, status, detail) {
  const p = label(provider);
  if (status === 401 || (status === 400 && /api[ _-]?key/i.test(detail))) return `Your ${p} API key was rejected. Check it in Settings.`;
  if (status === 403) return `This ${p} key isn't allowed to do that${detail ? `: ${detail}` : '.'}`;
  if (status === 404) return `${p} couldn't find that model or address${detail ? `: ${detail}` : '.'}`;
  if (status === 402) return `${p} says the account has no credit left. Add credit or use another key.`;
  if (status === 429) return `${p} is rate-limiting this key right now. Try again in a moment.`;
  if (status >= 500) return `${p} is having trouble right now. Please try again in a minute.`;
  return `${p} returned an error (${status})${detail ? `: ${detail}` : ''}`;
}

async function listModels(brain) {
  const data = await oaRequest(brain, '/models', null, { retries: 1, timeout: 15_000 });
  const rows = Array.isArray(data) ? data : data?.data || data?.models || [];
  return rows.map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
}

function pickModel(provider, models) {
  const spec = PROVIDERS[provider] || {};
  if (spec.defaultModel) return spec.defaultModel;
  for (const re of spec.prefer || []) {
    const hit = models.find((m) => re.test(m));
    if (hit) return hit;
  }
  return models[0] || '';
}

/**
 * Check a key (and optional model / base URL) works. Returns the settings to save, with the model
 * filled in when the user left it blank. Throws an Error with a readable message.
 */
export async function verifyAiSettings({ provider, key, model, baseUrl }) {
  if (!PROVIDERS[provider]) throw new Error('Pick an AI provider.');
  const spec = PROVIDERS[provider];
  if (!key && !spec.keyOptional) throw new Error(`Paste your ${spec.label} API key.`);

  if (provider === 'anthropic') {
    const useModel = model || config.claudeModel;
    try {
      await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 }).models.retrieve(useModel);
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new Error('That API key was rejected by Anthropic. Check it and try again.');
      if (err instanceof Anthropic.PermissionDeniedError) throw new Error(`This key can't use ${useModel}.`);
      if (err instanceof Anthropic.NotFoundError) throw new Error(`Model ${useModel} wasn't found for this key.`);
      if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Anthropic to check the key. Check the server's internet connection.");
      throw new Error(`Couldn't verify the key: ${err.message}`);
    }
    return { provider, model: model || '', baseUrl: '' };
  }

  const base = (baseUrl || spec.base || '').trim();
  if (!base) throw new Error('Enter the API address (base URL) of your provider, e.g. https://api.example.com/v1');
  if (baseUrl) await assertPublicUrl(baseUrl).catch((e) => { throw new Error(`Base URL: ${e.message}`); });
  const brain = { provider, key, base };
  let models = [];
  try {
    models = await listModels(brain);
  } catch (err) {
    // Some compatible servers have no /models endpoint; a 404 there is not fatal if a model was given.
    if (!(err.status === 404 && model)) throw new Error(err.message);
  }
  if (model && models.length && !models.includes(model) && provider !== 'openrouter') {
    throw new Error(`Model "${model}" isn't available on this key. Some that are: ${models.slice(0, 6).join(', ')}`);
  }
  const chosen = model || pickModel(provider, models);
  if (!chosen) throw new Error('No models were found for this key. Enter a model name.');
  return { provider, model: chosen, baseUrl: base };
}

/** Back-compat: the old Settings call only checked Anthropic keys. */
export const verifyKey = (apiKey) => verifyAiSettings({ provider: 'anthropic', key: apiKey });

// ---------- Running a conversation ----------

const MAX_TOOL_ROUNDS = 6;
const STEP_LIMIT = { text: 'I hit my limit of steps for this request. Could you rephrase or split it up?' };

function friendlyAnthropic(err) {
  if (err instanceof Anthropic.AuthenticationError) return new Error('Your Claude API key was rejected. Update it in Settings.');
  if (err instanceof Anthropic.RateLimitError) return new Error('Claude is rate-limiting this key right now. Try again in a moment.');
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new Error('Claude took too long to answer. Please try again.');
  if (err instanceof Anthropic.APIConnectionError) return new Error("Couldn't reach Claude. Check the server's internet connection.");
  if (err instanceof Anthropic.InternalServerError || err?.status === 529) return new Error('Claude is overloaded right now. Please try again in a minute.');
  if (err instanceof Anthropic.NotFoundError) return new Error('That Claude model was not found. Check the model in Settings.');
  return err;
}

async function runAnthropic(brain, { system, messages, tools, executeTool }) {
  const client = anthropicClient(brain.key);
  const model = brain.model || config.claudeModel;
  // Effort control and the safety fallback are features of the default model; other Claude models get plain calls.
  const extras = model === config.claudeModel ? { output_config: { effort: 'low' }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
  const convo = [...messages];
  const actions = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      const params = { model, max_tokens: 16000, system, messages: convo, ...(tools.length ? { tools } : {}), ...extras };
      response = extras.betas ? await client.beta.messages.create(params) : await client.messages.create(params);
    } catch (err) {
      throw friendlyAnthropic(err);
    }
    if (response.stop_reason === 'refusal') return { text: "Sorry, I can't help with that request.", actions };
    if (response.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: response.content });
      continue;
    }
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !toolUses.length || !executeTool) {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text: text || 'Done.', actions };
    }
    convo.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(
      toolUses.map(async (tu) => {
        const out = await runTool(executeTool, tu.name, tu.input || {}, actions);
        return { type: 'tool_result', tool_use_id: tu.id, content: out.content, ...(out.error ? { is_error: true } : {}) };
      })
    );
    convo.push({ role: 'user', content: results });
  }
  return { ...STEP_LIMIT, actions };
}

async function runTool(executeTool, name, input, actions) {
  try {
    const result = await executeTool(name, input);
    actions.push({ tool: name, input, ok: true });
    return { content: JSON.stringify(result ?? { ok: true }) };
  } catch (err) {
    actions.push({ tool: name, input, ok: false, error: err.message });
    return { content: `Error: ${err.message}`, error: true };
  }
}

const toOpenAiTools = (tools) => tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema || { type: 'object', properties: {} } } }));

async function runOpenAiCompatible(brain, { system, messages, tools, executeTool }) {
  const convo = [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }))];
  const actions = [];
  let oaTools = tools.length && executeTool ? toOpenAiTools(tools) : null;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let data;
    try {
      data = await oaRequest(brain, '/chat/completions', { model: brain.model, messages: convo, max_tokens: 4096, ...(oaTools ? { tools: oaTools, tool_choice: 'auto' } : {}) });
    } catch (err) {
      // Some models don't support tool calling; answer without tools rather than failing.
      if (oaTools && err.status === 400 && /tool|function/i.test(err.message)) {
        oaTools = null;
        round--;
        continue;
      }
      throw new Error(err.message);
    }
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error(`${label(brain.provider)} sent an empty answer. Try again or pick another model.`);
    const calls = msg.tool_calls || [];
    if (!calls.length || !oaTools) return { text: (msg.content || '').trim() || 'Done.', actions };
    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });
    for (const call of calls) {
      let input = {};
      try {
        input = JSON.parse(call.function?.arguments || '{}') || {};
      } catch {
        input = {};
      }
      const out = await runTool(executeTool, call.function?.name, input, actions);
      convo.push({ role: 'tool', tool_call_id: call.id, content: out.content });
    }
  }
  return { ...STEP_LIMIT, actions };
}

/**
 * Run a conversation with optional tools (manual agentic loop) on whichever provider the user set up.
 * @param {object} opts
 * @param {object} opts.user     The user whose AI key should be used
 * @param {string} opts.system
 * @param {Array<{role:'user'|'assistant', content:string}>} opts.messages
 * @param {Array} [opts.tools]   Tool definitions ({ name, description, input_schema })
 * @param {(name:string, input:object)=>Promise<any>} [opts.executeTool]
 * @returns {Promise<{text:string, actions:Array}>}
 */
export async function runAI({ user, system, messages, tools = [], executeTool }) {
  const brain = await brainFor(user);
  if (!brain) throw new Error('No AI is connected. Add an API key in Settings → AI brain.');
  const opts = { system, messages, tools, executeTool };
  return brain.provider === 'anthropic' ? runAnthropic(brain, opts) : runOpenAiCompatible(brain, opts);
}

/** Old name kept so existing callers keep working. */
export const runClaude = runAI;
