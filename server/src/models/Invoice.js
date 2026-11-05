import mongoose from 'mongoose';

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'];

const invoiceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    number: { type: String, required: true, trim: true },
    client: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['income', 'expense'], default: 'income' },
    category: { type: String, default: 'services' },
    status: { type: String, enum: INVOICE_STATUSES, default: 'draft' },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    paidAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
