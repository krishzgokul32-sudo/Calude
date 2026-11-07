import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    assistantName: { type: String, default: 'GK' },
    // The user's own Anthropic API key, AES-GCM encrypted. Never sent to the browser.
    anthropicKey: { type: String, select: false },
    anthropicKeyHint: { type: String, default: '' }, // last 4 characters, for display
    sampleDataAt: Date, // set once when sample business data is loaded
    preferences: {
      theme: { type: String, enum: ['dark', 'light'], default: 'light' },
      currency: { type: String, default: 'INR' },
      voice: { type: Boolean, default: true },
      city: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

// Keep the auth cache honest: any change to a user clears its cached copy on this instance.
userSchema.post('save', (doc) => onUserChanged?.(doc._id));
userSchema.post('findOneAndUpdate', (doc) => doc && onUserChanged?.(doc._id));
userSchema.post('updateOne', function () {
  const id = this.getQuery?.()._id;
  if (id) onUserChanged?.(id);
});
let onUserChanged = null;
export const setUserChangeHook = (fn) => {
  onUserChanged = fn;
};

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.anthropicKey;
  return obj;
};

export default mongoose.model('User', userSchema);
