import { Router } from 'express';
import Lead from '../models/Lead.js';
import { geocode, googleKeyFor } from '../services/geo.js';

const router = Router();

// Which map to draw. Google's Maps JavaScript API needs the key in the browser; it is only sent to its
// owner, and Google recommends restricting it to your website in Cloud Console (see Connections help).
router.get('/config', async (req, res) => {
  const key = await googleKeyFor(req.user._id);
  res.json({ provider: key ? 'google' : 'osm', browserKey: key || undefined, homeCity: req.user.preferences?.city || '' });
});

router.get('/geocode', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) return res.status(400).json({ error: 'Type a place to search for' });
  const place = await geocode(req.user._id, q);
  if (!place) return res.status(404).json({ error: `No place found for "${q}"` });
  res.json(place);
});

// Leads grouped by city, with coordinates, for the map pins.
router.get('/places', async (req, res) => {
  const groups = await Lead.aggregate([
    { $match: { user: req.user._id, city: { $nin: [null, ''] } } },
    { $group: { _id: '$city', leads: { $sum: 1 }, value: { $sum: '$value' }, won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } } } },
    { $sort: { leads: -1 } },
    { $limit: 30 },
  ]);
  const places = [];
  for (const g of groups) {
    try {
      const geo = await geocode(req.user._id, g._id);
      places.push({ city: g._id, leads: g.leads, won: g.won, value: g.value, ...(geo ? { lat: geo.lat, lng: geo.lng, link: geo.link } : {}) });
    } catch {
      places.push({ city: g._id, leads: g.leads, won: g.won, value: g.value });
    }
  }
  res.json({ places });
});

export default router;
