import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const BLOBS = [
  { color: '#1d4ed8', size: 520, x: ['-10%', '10%', '-5%'], y: ['-10%', '5%', '-10%'], left: '5%', top: '0%' },
  { color: '#0b1f5c', size: 440, x: ['0%', '-15%', '0%'], y: ['0%', '15%', '0%'], left: '60%', top: '10%' },
  { color: '#1e3a8a', size: 480, x: ['5%', '-5%', '5%'], y: ['10%', '-10%', '10%'], left: '30%', top: '55%' },
];

/** Aurora gradient blobs + an interactive constellation of particles. */
export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w, h, raf;
    const mouse = { x: -999, y: -999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
    };
    resize();
    const count = Math.min(70, Math.floor((innerWidth * innerHeight) / 22000));
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: (Math.random() * 1.6 + 0.4) * dpr,
    }));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const light = document.documentElement.dataset.theme === 'light';
      const rgb = light ? '26,58,168' : '147,187,255';
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const md = Math.hypot(dx, dy);
        if (md < 120 * dpr) {
          p.x += (dx / md) * 0.8;
          p.y += (dy / md) * 0.8;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},0.7)`;
        ctx.fill();
      }
      const max = 130 * dpr;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < max) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / max) * 0.18})`;
            ctx.lineWidth = dpr * 0.6;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onMove = (e) => {
      mouse.x = e.clientX * dpr;
      mouse.y = e.clientY * dpr;
    };
    addEventListener('resize', resize);
    addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <>
      <div className="aurora" aria-hidden>
        {BLOBS.map((b, i) => (
          <motion.span
            key={i}
            style={{ width: b.size, height: b.size, left: b.left, top: b.top, background: b.color }}
            animate={{ x: b.x, y: b.y, scale: [1, 1.15, 1] }}
            transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <canvas ref={canvasRef} className="bg-canvas" style={{ width: '100%', height: '100%' }} aria-hidden />
      <div className="noise" aria-hidden />
    </>
  );
}
