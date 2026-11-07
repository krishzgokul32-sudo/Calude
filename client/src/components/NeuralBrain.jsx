import { useEffect, useRef } from 'react';

/**
 * A brain drawn as a glowing neural mesh, with "context rings" that light up as a wave of
 * memory travels outward through them. Original artwork, generated in code each load.
 * Colour follows --accent-rgb. Pauses off-screen; one still frame with reduced motion.
 */
const W = 760;
const H = 440;
// Side view of a brain facing left, with the brainstem below (native ~80..355 x 35..295).
const BRAIN = 'M80 190 C60 150 70 90 120 70 C150 40 210 35 250 50 C300 45 350 80 355 130 C370 170 345 210 310 220 C300 245 270 250 250 240 L246 282 C242 297 222 297 218 282 L212 246 C180 252 150 246 130 236 C100 236 80 215 80 190 Z';
const SCALE = 1.2;
const OX = -70;
const OY = 30;
const CX = 190;
const CY = 210;
const DEFAULT_RINGS = [['4K', 'tokens'], ['128K', 'tokens'], ['2M', 'tokens'], ['∞', 'GK memory']];

export default function NeuralBrain({ rings = DEFAULT_RINGS, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const path = new Path2D();
    path.addPath(new Path2D(BRAIN), new DOMMatrix().translate(OX, OY).scale(SCALE));

    // Seeded random so the mesh looks the same on every visit.
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts = [];
    let guard = 0;
    while (pts.length < 150 && guard++ < 20000) {
      const x = OX + (60 + rand() * 310) * SCALE;
      const y = OY + (30 + rand() * 270) * SCALE;
      if (!ctx.isPointInPath(path, x * dpr, y * dpr)) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 17)) continue;
      pts.push({ x, y, ph: rand() * Math.PI * 2 });
    }
    const edges = [];
    const seen = new Set();
    pts.forEach((p, i) => {
      pts
        .map((q, j) => [j, Math.hypot(p.x - q.x, p.y - q.y)])
        .filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .forEach(([j]) => {
          const k = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(k)) { seen.add(k); edges.push([i, j]); }
        });
    });
    const pulses = Array.from({ length: 14 }, () => ({ e: Math.floor(rand() * edges.length), t: rand() }));
    const radii = rings.map((_, i) => 200 + i * 86);

    let rgb = '245,196,92';
    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
      if (v) rgb = v.replace(/\s+/g, '');
    };
    readColor();
    const colorTimer = setInterval(readColor, 1000);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    const start0 = performance.now();

    const draw = (now) => {
      const t = (now - start0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const col = (a) => `rgba(${rgb},${a})`;

      // Halo behind the brain.
      const g = ctx.createRadialGradient(CX, CY - 20, 10, CX, CY - 20, 220);
      g.addColorStop(0, col(0.16));
      g.addColorStop(1, col(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Context rings + the memory wave travelling through them.
      const wave = 150 + ((t * 120) % 520);
      ctx.textAlign = 'center';
      radii.forEach((r, i) => {
        const hit = Math.max(0, 1 - Math.abs(wave - r) / 70);
        const span = Math.min(0.95, Math.asin(Math.min(1, (CY - 20) / r)));
        ctx.beginPath();
        ctx.arc(CX, CY, r, -span, span);
        ctx.strokeStyle = col(0.28 + hit * 0.7);
        ctx.lineWidth = 1.6 + hit * 2;
        ctx.shadowColor = col(0.9);
        ctx.shadowBlur = 8 + hit * 22;
        ctx.stroke();
        ctx.shadowBlur = 0;
        const lx = CX + r + 43;
        ctx.fillStyle = `rgba(255,255,255,${0.75 + hit * 0.25})`;
        ctx.font = '700 30px Inter, system-ui, sans-serif';
        ctx.fillText(rings[i][0], lx, CY + 4);
        ctx.fillStyle = col(0.85);
        ctx.font = '500 13px Inter, system-ui, sans-serif';
        ctx.fillText(rings[i][1], lx, CY + 24);
      });
      if (!reduce) {
        ctx.beginPath();
        ctx.arc(CX, CY, wave, -0.9, 0.9);
        ctx.strokeStyle = col(Math.max(0, 0.35 - wave / 2000));
        ctx.lineWidth = 10;
        ctx.stroke();
      }

      // Brain outline and mesh.
      ctx.save();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = col(0.55);
      ctx.shadowColor = col(0.8);
      ctx.shadowBlur = 12;
      ctx.stroke(path);
      ctx.restore();
      ctx.lineWidth = 0.8;
      for (const [a, b] of edges) {
        ctx.strokeStyle = col(0.32);
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }
      for (const p of pts) {
        const tw = 0.55 + 0.45 * Math.sin(t * 2 + p.ph);
        ctx.fillStyle = col(0.5 + tw * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3 + tw, 0, Math.PI * 2);
        ctx.fill();
      }
      // Signals running along the synapses.
      for (const s of pulses) {
        if (!reduce) s.t += 0.012;
        if (s.t > 1) { s.t = 0; s.e = Math.floor(Math.random() * edges.length); }
        const [a, b] = edges[s.e];
        const x = pts[a].x + (pts[b].x - pts[a].x) * s.t;
        const y = pts[a].y + (pts[b].y - pts[a].y) * s.t;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = col(1);
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };

    const start = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce) start();
    });
    io.observe(canvas);
    requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(colorTimer);
      io.disconnect();
    };
  }, [rings]);

  return <canvas ref={ref} className={`neural-brain ${className}`} style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}` }} aria-hidden />;
}
