import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import User from '../models/User.js';
import { McpLog } from '../models/Mcp.js';
import { authenticate } from './keys.js';
import { loadSettings } from './settings.js';
import { TOOLS, isToolAllowed } from './catalog.js';
import { toolDefinitions } from './tools.js';
import { emitToUser } from '../services/realtime.js';

const rpcError = (res, status, message) => res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });

function keyFrom(req) {
  if (req.params.key) return req.params.key;
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Log every tool call (shown on Settings → MCP). */
function withLog(ctx, name, handler) {
  return async (args, extra) => {
    const started = Date.now();
    const result = await handler(args, extra);
    const error = result.isError ? String(result.content?.[0]?.text || '').slice(0, 300) : undefined;
    McpLog.create({ user: ctx.user._id, key: ctx.key._id, keyName: ctx.key.name, tool: name, ok: !result.isError, error, ms: Date.now() - started }).catch(() => {});
    emitToUser(ctx.user._id, 'mcp:call', { tool: name, ok: !result.isError });
    return result;
  };
}

export function buildServer(ctx, enabled) {
  const server = new McpServer({ name: 'gk-assistant', version: '1.0.0' });
  for (const [name, meta, handler] of toolDefinitions(ctx)) {
    if (!TOOLS[name]) {
      console.error(`[mcp] tool "${name}" is not in the catalog, refused`);
      continue;
    }
    if (!isToolAllowed(name, enabled)) continue; // the one gate, by name, at registration
    server.registerTool(name, meta, withLog(ctx, name, handler));
  }
  return server;
}

export async function mcpEndpoint(req, res) {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return rpcError(res, 405, 'Use POST.');
  }
  try {
    const auth = await authenticate(keyFrom(req));
    if (!auth.ok) return rpcError(res, auth.status, auth.message);

    const user = await User.findById(auth.keyRow.user);
    if (!user) return rpcError(res, 403, 'The account behind this key no longer exists.');

    const settings = await loadSettings(user._id); // read every request, so toggles apply instantly
    if (!settings.masterEnabled) return rpcError(res, 403, 'MCP access is switched off. Turn it on in GK → MCP server.');

    const server = buildServer({ user, key: auth.keyRow }, settings.categories);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request failed:', err.message);
    if (!res.headersSent) rpcError(res, 500, 'Internal error');
  }
}
