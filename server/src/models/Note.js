import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    color: { type: String, default: 'violet' },
    pinned: { type: Boolean, default: false },
    tags: [String],
    summary: { type: String, default: '' },
  },
  { timestamps: true }
);

noteSchema.index({ title: 'text', content: 'text', tags: 'text' });

noteSchema.index({ user: 1, pinned: -1, updatedAt: -1 });

export default mongoose.model('Note', noteSchema);
