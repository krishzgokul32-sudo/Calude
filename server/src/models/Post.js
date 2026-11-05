import mongoose from 'mongoose';

export const PLATFORMS = ['instagram', 'youtube', 'linkedin', 'facebook', 'x', 'blog'];
export const POST_STATUSES = ['idea', 'draft', 'scheduled', 'published'];

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    platform: { type: String, enum: PLATFORMS, default: 'instagram' },
    status: { type: String, enum: POST_STATUSES, default: 'idea' },
    scheduledAt: Date,
    publishedAt: Date,
    views: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Post', postSchema);
