import mongoose from 'mongoose';

const botLogSchema = new mongoose.Schema(
  {
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    status: { type: String, enum: ['ok', 'error'], default: 'ok' },
    input: String,
    output: String,
    latencyMs: Number,
  },
  { timestamps: true }
);

botLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // keep 30 days

botLogSchema.index({ bot: 1, createdAt: -1 });

export default mongoose.model('BotLog', botLogSchema);
