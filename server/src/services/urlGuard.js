import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';

/**
 * Block user-supplied URLs (bot webhooks) from reaching private networks: the database, cloud metadata
 * at 169.254.169.254, other internal services (SSRF, guide §08). Allowed by default in development so
 * local example bots on localhost keep working; set ALLOW_PRIVATE_WEBHOOKS=true to allow in production.
 */
const allowPrivate = () => (process.env.ALLOW_PRIVATE_WEBHOOKS ? process.env.ALLOW_PRIVATE_WEBHOOKS === 'true' : !config.isProd);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

export async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are allowed');
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('That URL points to a private network address, which is not allowed');
  return url;
}
