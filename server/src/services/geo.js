import axios from 'axios';
import mongoose from 'mongoose';
import Integration from '../models/Integration.js';
import { decrypt } from './secrets.js';
import { log } from './logger.js';

// Place lookups (geocoding). Uses the user's Google Maps key when connected, otherwise free
// OpenStreetMap (Nominatim). Results are cached in MongoDB for 30 days, shared by every instance.
const http = axios.create({ timeout: 6000, headers: { 'User-Agent': 'GK-Personal-Assistant/1.0' } });
let indexReady = false;
const cacheColl = () => mongoose.connection.collection('geocache');

export async function googleKeyFor(userId) {
  const row = await Integration.findOne({ user: userId, provider: 'googleMaps', status: 'connected' }).select('+secrets').lean();
  if (!row?.secrets) return null;
  try {
    return JSON.parse(decrypt(row.secrets) || '{}').apiKey || null;
  } catch {
    return null;
  }
}

// Nominatim allows at most 1 request per second: space calls out on this instance.
let nextSlot = 0;
async function osmSlot() {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** Look up a place. Returns { name, lat, lng, provider, link } or null when nothing matches. */
export async function geocode(userId, query) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return null;
  const key = await googleKeyFor(userId);
  const provider = key ? 'google' : 'osm';
  const id = `${provider}:${q.toLowerCase()}`;
  if (!indexReady) {
    indexReady = true;
    await cacheColl().createIndex({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }).catch(() => {});
  }
  const hit = await cacheColl().findOne({ _id: id });
  if (hit) return hit.result ? { ...hit.result, link: mapsLink(hit.result.lat, hit.result.lng) } : null;

  let result = null;
  try {
    if (key) {
      const { data } = await http.get('https://maps.googleapis.com/maps/api/geocode/json', { params: { address: q, key } });
      if (data.status === 'OK') {
        const r = data.results[0];
        result = { name: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng, provider };
      } else if (data.status !== 'ZERO_RESULTS') {
        throw new Error(data.error_message || data.status);
      }
    } else {
      await osmSlot();
      const { data } = await http.get('https://nominatim.openstreetmap.org/search', { params: { q, format: 'json', limit: 1 } });
      if (data[0]) result = { name: data[0].display_name, lat: Number(data[0].lat), lng: Number(data[0].lon), provider };
    }
  } catch (err) {
    log.warn('geocode failed', { provider, error: err.message });
    throw Object.assign(new Error(`Couldn't look up that place right now (${provider === 'google' ? 'Google Maps' : 'OpenStreetMap'}).`), { status: 502, expose: true });
  }
  await cacheColl().updateOne({ _id: id }, { $set: { result, at: new Date() } }, { upsert: true });
  return result ? { ...result, link: mapsLink(result.lat, result.lng) } : null;
}
