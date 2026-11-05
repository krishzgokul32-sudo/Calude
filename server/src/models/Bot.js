import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const BOT_TYPES = ['builtin', 'ai', 'webhook', 'telegram', 'discord', 'slack'];
export const BUILTIN_SKILLS = ['calculator', 'weather', 'wikipedia', 'joke', 'echo'];

const botSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Mention handle, e.g. "weather" -> users type "@weather what's it like in Paris?"
    handle: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]{2,30}$/, 'Handle must be 2-30 chars: a-z, 0-9, _ or -'],
    },
    type: { type: String, enum: BOT_TYPES, required: true },
    description: { type: String, default: '' },
    avatar: { type: String, default: '🤖' },
    color: { type: String, default: '#8b5cf6' },
    // Words that route a message to this bot even without an @mention.
    triggers: [{ type: String, lowercase: true, trim: true }],
    enabled: { type: Boolean, default: true },
    // Deliver reminders/notifications through this bot (telegram/discord/slack).
    notify: { type: Boolean, default: false },
    // Type-specific settings:
    //  builtin  -> { skill }
    //  ai       -> { systemPrompt }
    //  webhook  -> { url, headers }
    //  telegram -> { token, chatId }   (chatId is learned automatically on first message)
    //  discord  -> { webhookUrl }      slack -> { webhookUrl }
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Secret used to sign outgoing webhooks and authenticate inbound API calls.
    apiKey: { type: String, default: () => 'pa_' + crypto.randomBytes(24).toString('hex'), select: false },
    stats: {
      messages: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
      lastActiveAt: Date,
    },
  },
  { timestamps: true }
);

botSchema.index({ user: 1, handle: 1 }, { unique: true });

// Never leak secrets (telegram token, api key) to the browser.
botSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.apiKey;
  if (obj.config?.token) obj.config = { ...obj.config, token: '••••' + String(obj.config.token).slice(-4) };
  return obj;
};

export default mongoose.model('Bot', botSchema);
