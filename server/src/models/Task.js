import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: Date,
    tags: [String],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    completedAt: Date,
  },
  { timestamps: true }
);

// Track when a task was finished, for the Projects analytics.
taskSchema.pre('save', function () {
  if (this.isModified('status')) this.completedAt = this.status === 'done' ? new Date() : undefined;
});
taskSchema.pre('findOneAndUpdate', function () {
  const status = this.getUpdate()?.status ?? this.getUpdate()?.$set?.status;
  if (status) this.set({ completedAt: status === 'done' ? new Date() : null });
});

// Indexes match the real queries (guide §01: slow queries).
taskSchema.index({ user: 1, status: 1, createdAt: -1 });
taskSchema.index({ user: 1, completedAt: -1 });

export default mongoose.model('Task', taskSchema);
