import mongoose from 'mongoose';

export const LEAD_SOURCES = ['instagram', 'whatsapp', 'linkedin', 'website', 'referral', 'ads', 'other'];
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

const leadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    source: { type: String, enum: LEAD_SOURCES, default: 'other' },
    stage: { type: String, enum: LEAD_STAGES, default: 'new' },
    value: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
