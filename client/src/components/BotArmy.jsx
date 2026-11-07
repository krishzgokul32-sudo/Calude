import { motion } from 'framer-motion';

/**
 * Battle line: GK's bots stand together on the left, the horde of everyday chaos
 * (emails, invoices, meetings) marches in from the right, a foggy city behind them
 * and lightning in a stormy sky. Original silhouettes; glow follows --accent-rgb.
 */
const A = (o) => `rgba(var(--accent-rgb),${o})`;
const STEEL = '#0b0e14';
const RIM = 'rgba(255,255,255,0.18)';

// Each bot is drawn in a 100-unit tall box, feet at y=100, centred on x=0.
function Bot({ pose = 'stand', wide = 1 }) {
  const arms = {
    stand: ['M-20 30 L-30 62', 'M20 30 L30 62'],
    raise: ['M-20 30 L-36 4', 'M20 30 L30 62'],
    point: ['M-20 30 L-30 62', 'M20 30 L52 26'],
    guard: ['M-20 30 L-34 44 L-20 52', 'M20 30 L34 44 L20 52'],
  }[pose];
  return (
    <g>
      {arms.map((d, i) => (
        <path key={i} d={d} stroke={STEEL} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      <path d={`M${-9 * wide} 62 L${-16 * wide} 100 M${9 * wide} 62 L${16 * wide} 100`} stroke={STEEL} strokeWidth="10" strokeLinecap="round" />
      <path d="M-21 26 Q0 20 21 26 L16 64 L-16 64 Z" fill={STEEL} stroke={RIM} strokeWidth="1" />
      <rect x="-12" y="2" width="24" height="20" rx="7" fill={STEEL} stroke={RIM} strokeWidth="1" />
      <rect className="army-eye" x="-8" y="9" width="16" height="4" rx="2" style={{ fill: A(1) }} filter="url(#armyGlow)" />
      <path d="M0 2 L0 -6" stroke={STEEL} strokeWidth="2" />
      <circle cx="0" cy="-7" r="2.2" style={{ fill: A(0.9) }} />
      <circle cx="0" cy="44" r="3.4" style={{ fill: A(0.6) }} />
    </g>
  );
}

// A hooded phantom of the horde, 100 units tall.
function Phantom() {
  return (
    <g>
      <path d="M-14 100 L-18 40 Q-16 6 0 2 Q16 6 18 40 L14 100 Z" fill="#07080b" />
      <circle cx="-4" cy="22" r="1.6" fill="#ff3b3b" />
      <circle cx="4" cy="22" r="1.6" fill="#ff3b3b" />
    </g>
  );
}

const ARMY = [
  { x: 150, h: 120, pose: 'raise', name: '@assistant' },
  { x: 245, h: 104, pose: 'guard', name: '@sales', wide: 1.3 },
  { x: 330, h: 112, pose: 'stand', name: '@finance' },
  { x: 410, h: 96, pose: 'point', name: '@content' },
  { x: 490, h: 106, pose: 'guard', name: '@map', wide: 1.2 },
  { x: 565, h: 92, pose: 'stand', name: '@telegram' },
];
const HORDE_LABELS = [
  [886, '248 unread emails'],
  [1010, '12 overdue invoices'],
  [1134, '9 clashing meetings'],
];

export default function BotArmy() {
  const horde = [];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 15; i++) {
      const x = 830 + i * 23 + row * 10 + ((i * 7) % 5);
      const s = 0.62 - row * 0.12 + ((i * 3) % 4) * 0.02;
      horde.push({ x, y: 352 - row * 10, s, d: (i + row) % 5 });
    }
  }
  return (
    <svg className="bot-army" viewBox="0 0 1200 430" role="img" aria-label="GK's bots standing against the chaos of emails, invoices and meetings">
      <defs>
        <linearGradient id="armySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#11141b" />
          <stop offset="0.55" stopColor="#2a2f3a" />
          <stop offset="0.72" stopColor="#3c4250" />
          <stop offset="1" stopColor="#06070a" />
        </linearGradient>
        <linearGradient id="armyGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1d24" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <radialGradient id="armyHorizon" cx="0.35" cy="0.72" r="0.5">
          <stop offset="0" style={{ stopColor: A(0.35) }} />
          <stop offset="1" style={{ stopColor: A(0) }} />
        </radialGradient>
        <filter id="armyGlow" x="-100%" y="-300%" width="300%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="armyCloud" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="22" /></filter>
        <filter id="armyBlur" x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>

      <rect width="1200" height="430" fill="url(#armySky)" />
      <rect width="1200" height="430" fill="url(#armyHorizon)" />
      {/* Storm clouds: long soft streaks */}
      <g filter="url(#armyCloud)">
        {[[200, 30, 340, 30, 0.9], [760, 18, 420, 26, 0.85], [1080, 60, 300, 34, 0.8], [420, 96, 380, 14, 0.5], [900, 128, 340, 12, 0.4], [140, 150, 260, 10, 0.35]].map(([cx, cy, rx, ry, o]) => (
          <ellipse key={cx + '-' + cy} cx={cx} cy={cy} rx={rx} ry={ry} fill="#05060a" opacity={o} />
        ))}
      </g>
      {/* Lightning */}
      <path className="army-bolt" d="M88 0 L104 46 L92 50 L118 104 L106 108 L138 170" stroke="#fff" strokeWidth="2.4" fill="none" filter="url(#armyGlow)" />
      <rect className="army-flash" width="1200" height="430" fill="#fff" />

      {/* Distant city in the fog */}
      <g fill="#505867" opacity="0.55">
        {[[660, 50], [690, 80], [722, 60], [752, 120], [790, 70], [826, 96], [862, 58], [900, 86], [936, 64], [972, 110], [1010, 72], [1046, 90], [1084, 60], [1120, 76], [1160, 54]].map(([x, h]) => (
          <rect key={x} x={x} y={312 - h} width="30" height={h} />
        ))}
        <path d="M752 192 L766 120 L780 192 Z" />
        {[[40, 40], [76, 64], [108, 46], [600, 44], [628, 58]].map(([x, h]) => (
          <rect key={x} x={x} y={312 - h} width="28" height={h} opacity="0.7" />
        ))}
      </g>
      <rect y="250" width="1200" height="90" fill="#2c313c" opacity="0.5" filter="url(#armyBlur)" />

      {/* Ground */}
      <rect y="312" width="1200" height="118" fill="url(#armyGround)" />
      <ellipse cx="360" cy="372" rx="340" ry="26" style={{ fill: A(0.18) }} filter="url(#armyBlur)" />

      {/* The horde of chaos (right) */}
      {[...horde].reverse().map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y - 100 * p.s}) scale(${p.s})`}>
          <g className="army-march" style={{ animationDelay: `${p.d * 0.3}s` }}><Phantom /></g>
        </g>
      ))}
      {HORDE_LABELS.map(([x, t]) => (
        <g key={t} transform={`translate(${x} 398)`}>
          <rect x="-60" y="-13" width="120" height="22" rx="11" fill="rgba(0,0,0,0.6)" stroke="rgba(255,80,80,0.45)" />
          <text textAnchor="middle" y="3" fill="#ffb4b4" fontSize="10.5" fontWeight="600">{t}</text>
        </g>
      ))}

      {/* GK's army (left) */}
      {ARMY.map((b, i) => (
        <motion.g key={b.name} initial={{ opacity: 0, x: -60 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * i, type: 'spring', damping: 16 }}>
          <g transform={`translate(${b.x} ${370 - b.h * 1.1}) scale(${b.h / 100 * 1.1})`}>
            <Bot pose={b.pose} wide={b.wide} />
          </g>
          <text x={b.x} y="400" textAnchor="middle" fontSize="13" fontWeight="700" style={{ fill: A(1) }}>{b.name}</text>
        </motion.g>
      ))}
    </svg>
  );
}
