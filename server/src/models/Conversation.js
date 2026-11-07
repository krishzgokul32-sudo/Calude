import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation' },
    channel: { type: String, default: 'web' }, // web | telegram | api | ...
    externalId: { type: String }, // e.g. telegram chat id
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, lastMessageAt: -1 });
// One conversation per external chat, even if two messages arrive at the same moment (guide §13).
conversationSchema.index({ user: 1, channel: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });

export default mongoose.model('Conversation', conversationSchema);
