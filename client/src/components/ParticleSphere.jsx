import { useEffect, useRef } from 'react';

/**
 * A sphere made of glowing particles that slowly rotates in 3D.
 * Colour follows the theme accent (--accent-rgb), so it is blue or orange automatically.
 * States: idle (slow turn), thinking (faster + breathing), listening (pulse), speaking (ripple).
 * Pauses when off-screen or when the tab is hidden; draws one still frame with reduced motion.
 */
export default function ParticleSphere({ size = 320, state = 'idle', density = 1, className = '', style }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Evenly spread points on a sphere (Fibonacci lattice).
    const count = Math.round(Math.min(1400, Math.max(260, size * 3.2)) * density);
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      pts.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r, twinkle: Math.random() * Math.PI * 2, size: 0.6 + Math.random() * 0.9 });
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rgb = '106,161,255';
    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
      if (v) rgb = v.replace(/\s+/g, '');
    };
    readColor();
    const colorTimer = setInterval(readColor, 1000);

    let angle = 0;
    let raf = 0;
    let visible = true;
    let last = performance.now();

    const draw = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const s = stateRef.current;
      const speed = s === 'thinking' ? 0.0011 : s === 'speaking' ? 0.0007 : s === 'listening' ? 0.0005 : 0.00025;
      angle += speed * dt;
      const t = now / 1000;
      const breathe = s === 'thinking' ? 1 + Math.sin(t * 4) * 0.035 : s === 'listening' ? 1 + Math.sin(t * 6) * 0.05 : 1 + Math.sin(t * 1.2) * 0.012;
      const R = (size / 2) * 0.86 * breathe;
      const cx = size / 2;
      const cy = size / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tilt = 0.32;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      ctx.clearRect(0, 0, size, size);
      // Soft inner glow.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
      g.addColorStop(0, `rgba(${rgb},0.16)`);
      g.addColorStop(0.6, `rgba(${rgb},0.05)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
      ctx.fill();

      for (const p of pts) {
        // Rotate around Y, then tilt around X.
        let x = p.x * cosA + p.z * sinA;
        let z = -p.x * sinA + p.z * cosA;
        let y = p.y * cosT - z * sinT;
        z = p.y * sinT + z * cosT;
        let ripple = 1;
        if (s === 'speaking') ripple = 1 + Math.sin(t * 8 + p.y * 6) * 0.04;
        const depth = (z + 1) / 2; // 0 = back, 1 = front
        const persp = 1 / (1.9 - z * 0.45);
        const px = cx + x * R * ripple * persp * 1.35;
        const py = cy + y * R * ripple * persp * 1.35;
        const tw = 0.75 + 0.25 * Math.sin(t * 2 + p.twinkle);
        const alpha = (0.12 + depth * 0.78) * tw;
        const r = p.size * (0.45 + depth * 0.95) * (size / 320);
        ctx.fillStyle = depth > 0.82 ? `rgba(255,255,255,${alpha * 0.9})` : `rgba(${rgb},${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.35, r), 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden;
      if (visible && !reduce) start();
    });
    io.observe(canvas);
    const onVis = () => {
      visible = !document.hidden;
      if (visible && !reduce) start();
    };
    document.addEventListener('visibilitychange', onVis);
    if (reduce) requestAnimationFrame(draw);
    else start();

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(colorTimer);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [size, density]);

  return (
    <div className={`particle-sphere ${className}`} style={{ width: size, height: size, ...style }} aria-hidden>
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
    </div>
  );
}
