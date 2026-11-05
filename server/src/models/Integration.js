import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    // Non-secret settings (ids), shown in the UI.
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Secret values, AES-GCM encrypted JSON. Never sent to the browser.
    secrets: { type: String, select: false },
    status: { type: String, enum: ['connected', 'error'], default: 'connected' },
    account: { type: String, default: '' }, // e.g. the connected page / channel / phone number
    lastError: { type: String, default: '' },
    lastCheckedAt: Date,
  },
  { timestamps: true }
);

integrationSchema.index({ user: 1, provider: 1 }, { unique: true });

export default mongoose.model('Integration', integrationSchema);
