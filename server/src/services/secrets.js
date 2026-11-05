import crypto from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM encryption for secrets stored in MongoDB (e.g. users' API keys).
// The key comes from ENCRYPTION_KEY, falling back to JWT_SECRET.
const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || config.jwtSecret).digest();

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

/** Returns null if the value can't be decrypted (e.g. the secret changed). */
export function decrypt(stored) {
  try {
    const [iv, tag, data] = stored.split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
