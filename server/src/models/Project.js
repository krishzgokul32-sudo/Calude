import mongoose from 'mongoose';

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'done'];

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    client: { type: String, default: '' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planning' },
    budget: { type: Number, default: 0, min: 0 },
    deadline: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
