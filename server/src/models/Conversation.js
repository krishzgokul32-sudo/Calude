import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation' },
    channel: { type: String, default: 'web' }, // web | telegram | api | ...
    externalId: { type: String, index: true }, // e.g. telegram chat id
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Conversation', conversationSchema);
