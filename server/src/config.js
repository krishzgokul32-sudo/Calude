import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/personal_assistant',
  useMemoryDb: process.env.USE_MEMORY_DB === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:5000',
};

if (config.jwtSecret === 'dev-secret-change-me' && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
