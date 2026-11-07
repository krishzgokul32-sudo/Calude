import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true },
    remindAt: { type: Date, required: true },
    repeat: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
    delivered: { type: Boolean, default: false },
    // Set while one scheduler instance is delivering it, so two instances never send it twice.
    lockedUntil: Date,
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// The scheduler scans due, undelivered reminders every 30 s.
reminderSchema.index({ delivered: 1, remindAt: 1 });
reminderSchema.index({ user: 1, remindAt: 1 });

export default mongoose.model('Reminder', reminderSchema);
