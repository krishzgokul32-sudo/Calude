import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

// Claude integration. Enabled only when ANTHROPIC_API_KEY is set; otherwise the
// assistant falls back to the rule-based brain (localBrain.js).
const client = config.anthropicKey ? new Anthropic({ apiKey: config.anthropicKey }) : null;

export const llmEnabled = () => Boolean(client);

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

/**
 * Run a conversation with optional tools (manual agentic loop).
 * @param {object} opts
 * @param {string} opts.system
 * @param {Array<{role:'user'|'assistant', content:string}>} opts.messages
 * @param {Array} [opts.tools]   Anthropic tool definitions
 * @param {(name:string, input:object)=>Promise<any>} [opts.executeTool]
 * @returns {Promise<{text:string, actions:Array}>}
 */
export async function runClaude({ system, messages, tools = [], executeTool }) {
  if (!client) throw new Error('Claude is not configured');
  const convo = [...messages];
  const actions = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      ...baseParams(),
      system,
      messages: convo,
      ...(tools.length ? { tools } : {}),
    });

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
