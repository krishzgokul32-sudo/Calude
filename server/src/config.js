import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(env.PORT) || 5000,
  clientUrl: env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/personal_assistant',
  useMemoryDb: env.USE_MEMORY_DB === 'true',
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-me',
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  claudeModel: env.CLAUDE_MODEL || 'claude-opus-5-5',
  // Any other AI provider for the whole server (optional): openai, gemini, groq, openrouter, mistral,
  // deepseek, xai, together, ollama or custom. The provider is guessed from the key when not set.
  aiProvider: (env.AI_PROVIDER || '').toLowerCase(),
  aiApiKey: env.AI_API_KEY || '',
  aiModel: env.AI_MODEL || '',
  aiBaseUrl: env.AI_BASE_URL || '',
  aiServiceUrl: env.AI_SERVICE_URL || 'http://localhost:8000',
  publicApiUrl: env.PUBLIC_API_URL || 'http://localhost:5000',
  // Number of proxies in front of the API (nginx, a load balancer). Needed for correct client IPs.
  trustProxy: env.TRUST_PROXY ? (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY)) : false,
  // Claude messages one user may send per day (guide §14: cap AI spend per user). 0 = unlimited.
  aiDailyLimit: env.AI_DAILY_LIMIT === undefined ? 200 : Number(env.AI_DAILY_LIMIT),
  metricsToken: env.METRICS_TOKEN || '',
  // Requests per minute per user (or IP) on the API. Raise for load tests or busy integrations.
  apiRateLimit: Number(env.API_RATE_LIMIT) || 300,
};

/** Validate configuration once at startup (guide §03: config drift). Returns warnings; throws on fatal problems. */
export function validateConfig() {
  const errors = [];
  const warnings = [];
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errors.push(`PORT "${env.PORT}" is not a valid port`);
  if (!/^mongodb(\+srv)?:\/\//.test(config.mongoUri) && !config.useMemoryDb) errors.push('MONGO_URI must start with mongodb:// or mongodb+srv://');
  for (const [name, value] of [['CLIENT_URL', config.clientUrl], ['PUBLIC_API_URL', config.publicApiUrl], ['AI_SERVICE_URL', config.aiServiceUrl], ...(config.aiBaseUrl ? [['AI_BASE_URL', config.aiBaseUrl]] : [])]) {
    try {
      new URL(value);
    } catch {
      errors.push(`${name} "${value}" is not a valid URL`);
    }
  }
  const knownProviders = ['anthropic', 'openai', 'gemini', 'groq', 'openrouter', 'mistral', 'deepseek', 'xai', 'together', 'ollama', 'custom'];
  if (config.aiProvider && !knownProviders.includes(config.aiProvider)) errors.push(`AI_PROVIDER "${config.aiProvider}" is not one of: ${knownProviders.join(', ')}`);
  if (config.aiProvider === 'custom' && !config.aiBaseUrl) errors.push('AI_PROVIDER=custom needs AI_BASE_URL');
  if (Number.isNaN(config.aiDailyLimit) || config.aiDailyLimit < 0) errors.push('AI_DAILY_LIMIT must be 0 or a positive number');
  if (isProd && config.jwtSecret === 'dev-secret-change-me') errors.push('JWT_SECRET must be set in production');
  else if (config.jwtSecret.length < 32 || /change-me/i.test(config.jwtSecret)) warnings.push('JWT_SECRET is short or a placeholder. Use 32+ random characters before going live (e.g. `openssl rand -hex 32`).');
  if (errors.length) throw new Error(`Invalid configuration:\n- ${errors.join('\n- ')}`);
  return warnings;
}
