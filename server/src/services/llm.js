import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import User from '../models/User.js';
import { decrypt } from './secrets.js';

// Claude integration. A user's own API key (saved in Settings) is used first;
// otherwise the server's ANTHROPIC_API_KEY. With neither, the assistant falls
// back to the rule-based brain (localBrain.js).
const serverClient = config.anthropicKey ? new Anthropic({ apiKey: config.anthropicKey }) : null;
const userClients = new Map(); // apiKey -> Anthropic client

export const serverKeyConfigured = () => Boolean(serverClient);

export function makeClient(apiKey) {
  if (!userClients.has(apiKey)) {
    if (userClients.size > 500) userClients.clear();
    userClients.set(apiKey, new Anthropic({ apiKey }));
  }
  return userClients.get(apiKey);
}

/** The Claude client to use for this user, or null if no key is available. */
export async function clientFor(user) {
  if (user?._id) {
    const row = await User.findById(user._id).select('+anthropicKey').lean();
    const apiKey = row?.anthropicKey ? decrypt(row.anthropicKey) : null;
    if (apiKey) return makeClient(apiKey);
  }
  return serverClient;
}

export const llmAvailable = async (user) => Boolean(await clientFor(user));

/** Check a key works by looking up the configured model. Throws a readable error. */
export async function verifyKey(apiKey) {
  try {
    await new Anthropic({ apiKey, maxRetries: 0 }).models.retrieve(config.claudeModel);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('That API key was rejected by Anthropic. Check it and try again.');
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error(`This key can't use ${config.claudeModel}.`);
    if (err instanceof Anthropic.NotFoundError) throw new Error(`Model ${config.claudeModel} wasn't found for this key.`);
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Anthropic to check the key. Check the server's internet connection.");
    throw new Error(`Couldn't verify the key: ${err.message}`);
  }
}

const MAX_TOOL_ROUNDS = 6;

function baseParams() {
  return {
    model: config.claudeModel,
    max_tokens: 16000,
    // Chat is latency-sensitive; low effort keeps replies snappy.
    output_config: { effort: 'low' },
    // If a request is declined by a safety classifier, the API retries it on a
    // fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

function textOf(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new Error('Your Claude API key was rejected. Update it in Settings.');
  if (err instanceof Anthropic.RateLimitError) return new Error('Claude is rate-limiting this key right now. Try again in a moment.');
  if (err instanceof Anthropic.APIConnectionError) return new Error("Couldn't reach Claude. Check the server's internet connection.");
  return err;
}

/**
 * Run a conversation with optional tools (manual agentic loop).
 * @param {object} opts
 * @param {object} opts.user     The user whose API key should be used
 * @param {string} opts.system
 * @param {Array<{role:'user'|'assistant', content:string}>} opts.messages
 * @param {Array} [opts.tools]   Anthropic tool definitions
 * @param {(name:string, input:object)=>Promise<any>} [opts.executeTool]
 * @returns {Promise<{text:string, actions:Array}>}
 */
export async function runClaude({ user, system, messages, tools = [], executeTool }) {
  const client = await clientFor(user);
  if (!client) throw new Error('Claude is not configured. Add your API key in Settings.');
  const convo = [...messages];
  const actions = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await client.beta.messages.create({
        ...baseParams(),
        system,
        messages: convo,
        ...(tools.length ? { tools } : {}),
      });
    } catch (err) {
      throw friendlyError(err);
    }

    if (response.stop_reason === 'refusal') {
      return { text: "Sorry, I can't help with that request.", actions };
    }
    if (response.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: response.content });
      continue;
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !toolUses.length || !executeTool) {
      return { text: textOf(response) || 'Done.', actions };
    }

    // Keep the full assistant content (incl. thinking blocks) unchanged.
    convo.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(
      toolUses.map(async (tu) => {
        try {
          const result = await executeTool(tu.name, tu.input || {});
          actions.push({ tool: tu.name, input: tu.input, ok: true });
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result ?? { ok: true }) };
        } catch (err) {
          actions.push({ tool: tu.name, input: tu.input, ok: false, error: err.message });
          return { type: 'tool_result', tool_use_id: tu.id, content: `Error: ${err.message}`, is_error: true };
        }
      })
    );
    // All tool results go back in a single user message.
    convo.push({ role: 'user', content: results });
  }
  return { text: 'I hit my limit of steps for this request — could you rephrase or split it up?', actions };
}
