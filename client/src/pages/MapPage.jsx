import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin, ExternalLink, Plug } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Page } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { fmtMoney } from '../components/charts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const accentRgb = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '106,161,255';
const INDIA = { lat: 20.6, lng: 78.9 };

// Dark map styling for Google Maps in black mode.
const GOOGLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#0b0f17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa8bc' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2233' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050a14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a3a55' }] },
];

let googleLoading = null;
function loadGoogle(key) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!googleLoading) {
    googleLoading = new Promise((resolve, reject) => {
      window.__gkMapsReady = () => resolve(window.google.maps);
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__gkMapsReady`;
      s.async = true;
      s.onerror = () => {
        googleLoading = null;
        reject(new Error('Google Maps failed to load. Check the key and its website restriction.'));
      };
      document.head.appendChild(s);
    });
  }
  return googleLoading;
}

/** One small adapter so the page works the same on Google Maps and on OpenStreetMap (Leaflet). */
function createMap(el, cfg, dark) {
  if (cfg.provider === 'google') {
    return loadGoogle(cfg.browserKey).then((maps) => {
      const map = new maps.Map(el, { center: INDIA, zoom: 5, styles: dark ? GOOGLE_DARK : undefined, disableDefaultUI: false, mapTypeControl: false, streetViewControl: false });
      const markers = [];
      const info = new maps.InfoWindow();
      return {
        clear: () => markers.splice(0).forEach((m) => m.setMap(null)),
        pin: ({ lat, lng, label, html, big }) => {
          const m = new maps.Marker({
            position: { lat, lng },
            map,
            title: label,
            icon: { path: maps.SymbolPath.CIRCLE, scale: big ? 11 : 8, fillColor: `rgb(${accentRgb()})`, fillOpacity: 0.95, strokeColor: '#ffffff', strokeWeight: 2 },
          });
          m.addListener('click', () => {
            info.setContent(html);
            info.open({ map, anchor: m });
          });
          markers.push(m);
        },
        fly: (lat, lng, zoom = 11) => {
          map.panTo({ lat, lng });
          map.setZoom(zoom);
        },
        fit: (pts) => {
          if (!pts.length) return;
          const b = new maps.LatLngBounds();
          pts.forEach((p) => b.extend(p));
          map.fitBounds(b, 60);
        },
        destroy: () => {},
      };
    });
  }
  const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([INDIA.lat, INDIA.lng], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  return Promise.resolve({
    clear: () => layer.clearLayers(),
    pin: ({ lat, lng, html, big }) => {
      L.circleMarker([lat, lng], { radius: big ? 11 : 8, color: '#ffffff', weight: 2, fillColor: `rgb(${accentRgb()})`, fillOpacity: 0.95 }).bindPopup(html).addTo(layer);
    },
    fly: (lat, lng, zoom = 11) => map.flyTo([lat, lng], zoom, { duration: 0.8 }),
    fit: (pts) => pts.length && map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [60, 60], maxZoom: 9 }),
    destroy: () => map.remove(),
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default function MapPage() {
  const { user } = useAuth();
  const toast = useToast();
  const cur = user.preferences?.currency || 'INR';
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const [cfg, setCfg] = useState(null);
  const [places, setPlaces] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    api.get('/maps/config').then((r) => setCfg(r.data)).catch((e) => setMapError(errMsg(e)));
    api.get('/maps/places').then((r) => setPlaces(r.data.places)).catch(() => {});
  }, []);

  const drawPins = useCallback(
    (m, list, extra) => {
      m.clear();
      const pts = list.filter((p) => p.lat != null);
      pts.forEach((p) =>
        m.pin({
          lat: p.lat,
          lng: p.lng,
          label: p.city,
          html: `<strong>${esc(p.city)}</strong><br>${p.leads} leads · ${p.won} won<br>${esc(fmtMoney(p.value, cur))} pipeline<br><a href="${p.link}" target="_blank" rel="noreferrer">Open in Google Maps</a>`,
        })
      );
      if (extra) m.pin({ lat: extra.lat, lng: extra.lng, label: extra.name, big: true, html: `<strong>${esc(extra.name)}</strong><br><a href="${extra.link}" target="_blank" rel="noreferrer">Open in Google Maps</a>` });
      return pts;
    },
    [cur]
  );

  // Create the map once the config is known.
  useEffect(() => {
    if (!cfg || !elRef.current) return;
    let cancelled = false;
    let instance;
    createMap(elRef.current, cfg, document.documentElement.dataset.theme !== 'light')
      .then((m) => {
        if (cancelled) return m.destroy();
        instance = m;
        mapRef.current = m;
        const pts = drawPins(m, places);
        if (pts.length) m.fit(pts);
      })
      .catch((e) => setMapError(e.message));
    return () => {
      cancelled = true;
      instance?.destroy();
      mapRef.current = null;
    };
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw pins when the lead places arrive.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const pts = drawPins(m, places, found);
    if (!found && pts.length) m.fit(pts);
  }, [places]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim() || searching) return;
    setSearching(true);
    try {
      const { data } = await api.get('/maps/geocode', { params: { q } });
      setFound(data);
      if (mapRef.current) {
        drawPins(mapRef.current, places, data);
        mapRef.current.fly(data.lat, data.lng, 12);
      }
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setSearching(false);
    }
  };

  const focus = (p) => p.lat != null && mapRef.current?.fly(p.lat, p.lng, 10);

  return (
    <Page>
      <div className="page-header">
        <div>
          <h1>Map</h1>
          <p>Find any place and see where your leads are.</p>
        </div>
        {cfg && (
          <span className="pill" style={{ textTransform: 'none' }}>
            <span className="dot" style={{ background: cfg.provider === 'google' ? 'var(--status-good)' : 'var(--status-neutral)' }} />
            {cfg.provider === 'google' ? 'Google Maps' : 'OpenStreetMap (free)'}
          </span>
        )}
      </div>

      {cfg?.provider === 'osm' && (
        <motion.div className="glass banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <span style={{ fontSize: 22 }}>🗺️</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600 }}>Using the free OpenStreetMap</div>
            <div className="small muted">Connect a Google Maps API key to switch this page to Google Maps and Google's place search.</div>
          </div>
          <Link to="/connections" className="btn btn-primary"><Plug size={15} /> Connect Google Maps</Link>
        </motion.div>
      )}

      <div className="map-layout">
        <div className="glass map-card">
          <form className="map-search" onSubmit={search}>
            <Search size={16} className="muted" />
            <input className="input" style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '6px 4px' }} placeholder="Search a place, address or landmark…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search places" />
            <button className="btn btn-primary" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
          </form>
          {mapError ? <div className="empty" style={{ height: '100%' }}>⚠️ {mapError}</div> : <div ref={elRef} className="map-canvas" />}
        </div>

        <div className="glass card map-side">
          {found && (
            <div className="float-card" style={{ padding: 14, marginBottom: 14 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <MapPin size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{found.name}</div>
                  <div className="small muted mono-num">{found.lat.toFixed(5)}, {found.lng.toFixed(5)}</div>
                </div>
              </div>
              <a className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} href={found.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open in Google Maps</a>
            </div>
          )}
          <div className="card-title">Leads by city <span className="sub">{places.reduce((a, p) => a + p.leads, 0)} leads</span></div>
          {!places.length && <p className="small muted">Add a city to your leads (Sales & Marketing → Leads) to see them on the map.</p>}
          {places.map((p) => (
            <button key={p.city} className="list-row map-place" onClick={() => focus(p)} disabled={p.lat == null}>
              <span className="dot" style={{ background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{p.city}</span>
              <span className="small muted">{p.leads} leads</span>
              {p.link && (
                <a href={p.link} target="_blank" rel="noreferrer" className="icon-btn" style={{ width: 28, height: 28 }} onClick={(e) => e.stopPropagation()} aria-label={`Open ${p.city} in Google Maps`}>
                  <ExternalLink size={13} />
                </a>
              )}
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}
