import mongoose from 'mongoose';

// Each user controls their own MCP access: one settings doc, any number of keys, a call log.
const settingsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    masterEnabled: { type: Boolean, default: false },
    categories: { type: mongoose.Schema.Types.Mixed, default: {} }, // { tasks_read: true, ... }
  },
  { timestamps: true, minimize: false }
);

const keySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: 'MCP key', trim: true, maxlength: 80 },
    keyHash: { type: String, required: true, unique: true }, // sha256 of the full key
    keyPrefix: { type: String, required: true },
    keyLast4: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    lastUsedAt: Date,
  },
  { timestamps: true }
);

const logSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: mongoose.Schema.Types.ObjectId, ref: 'McpKey' },
    keyName: String,
    tool: String,
    ok: Boolean,
    error: String,
    ms: Number,
  },
  { timestamps: true }
);
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // keep 30 days

export const McpSettings = mongoose.model('McpSettings', settingsSchema);
export const McpKey = mongoose.model('McpKey', keySchema);
export const McpLog = mongoose.model('McpLog', logSchema);
