import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant', 'bot', 'system'], required: true },
    content: { type: String, required: true },
    bot: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot' }, // set when a bot answered
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // actions taken, sentiment, source...
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ user: 1, role: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
