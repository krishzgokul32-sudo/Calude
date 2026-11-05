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
    preferences: {
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      voice: { type: Boolean, default: true },
      city: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

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
