import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true },
    remindAt: { type: Date, required: true, index: true },
    repeat: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
    delivered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Reminder', reminderSchema);
