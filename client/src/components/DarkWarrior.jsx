/**
 * GK's guardian: an original armoured warrior, drawn as SVG so it stays sharp at any size.
 * Steel is near-black; every glowing edge, the visor and the chest core use the theme
 * accent (--accent-rgb), so the warrior is blue or orange with the rest of the app.
 */
export default function DarkWarrior({ className = '', style }) {
  const a = (o) => `rgba(var(--accent-rgb),${o})`;
  return (
    <svg className={`dark-warrior ${className}`} style={style} viewBox="0 0 400 540" role="img" aria-label="GK, the dark warrior">
      <defs>
        <linearGradient id="dwSteel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3346" />
          <stop offset="0.45" stopColor="#0d121c" />
          <stop offset="1" stopColor="#05070b" />
        </linearGradient>
        <linearGradient id="dwSteelHi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4660" />
          <stop offset="1" stopColor="#0a0e16" />
        </linearGradient>
        <linearGradient id="dwCape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0f18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dwBlade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: a(0.95) }} />
          <stop offset="0.5" style={{ stopColor: a(0.45) }} />
          <stop offset="1" style={{ stopColor: a(0) }} />
        </linearGradient>
        <radialGradient id="dwCore">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" style={{ stopColor: a(1) }} />
          <stop offset="1" style={{ stopColor: a(0) }} />
        </radialGradient>
        <filter id="dwGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Cape, falling behind the shoulders */}
      <path d="M78 205 Q200 150 322 205 L388 540 L12 540 Z" fill="url(#dwCape)" />
      <path d="M78 205 L40 540 M322 205 L360 540 M140 190 L110 540 M260 190 L290 540" stroke={a(0.08)} strokeWidth="2" fill="none" />

      {/* Hood */}
      <path d="M126 150 Q200 28 274 150 L296 236 Q200 206 104 236 Z" fill="#06080d" stroke={a(0.35)} strokeWidth="1.5" />

      {/* Torso / breastplate */}
      <path d="M118 236 L282 236 L300 392 L200 448 L100 392 Z" fill="url(#dwSteel)" stroke={a(0.5)} strokeWidth="1.5" />
      <path d="M200 244 L200 440 M128 300 Q200 330 272 300 M118 350 Q200 384 282 350" stroke={a(0.22)} strokeWidth="1.5" fill="none" />
      {/* Belt */}
      <path d="M106 392 L294 392 L298 410 L102 410 Z" fill="#0a0d14" stroke={a(0.4)} strokeWidth="1.2" />

      {/* Pauldrons: three layered plates per shoulder */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${200 + s * 92} 228) scale(${s} 1)`}>
          <path d="M-36 -18 Q10 -44 52 -6 L46 22 Q6 4 -30 14 Z" fill="url(#dwSteelHi)" stroke={a(0.6)} strokeWidth="1.5" />
          <path d="M-26 10 Q12 -4 50 18 L44 42 Q8 26 -22 34 Z" fill="url(#dwSteel)" stroke={a(0.45)} strokeWidth="1.2" />
          <path d="M-16 32 Q14 22 44 38 L38 58 Q10 46 -12 52 Z" fill="url(#dwSteel)" stroke={a(0.3)} strokeWidth="1" />
          <path d="M40 -8 L64 -30 L52 4 Z" fill="#0a0d14" stroke={a(0.6)} strokeWidth="1.2" />
        </g>
      ))}

      {/* Gorget */}
      <path d="M160 196 L240 196 L250 236 L150 236 Z" fill="url(#dwSteel)" stroke={a(0.4)} strokeWidth="1.2" />

      {/* Helmet */}
      <path d="M152 124 Q200 66 248 124 L256 186 Q200 222 144 186 Z" fill="url(#dwSteelHi)" stroke={a(0.6)} strokeWidth="1.6" />
      <path d="M200 76 L200 136" stroke={a(0.45)} strokeWidth="2" />
      <path d="M156 160 L176 196 M244 160 L224 196" stroke={a(0.25)} strokeWidth="1.2" />
      {/* Visor: a glowing T slit */}
      <g className="dw-visor" filter="url(#dwGlow)">
        <path d="M162 146 L238 146 L232 154 L168 154 Z" style={{ fill: a(1) }} />
        <path d="M197 154 L203 154 L202 184 L198 184 Z" style={{ fill: a(0.9) }} />
        <circle cx="180" cy="150" r="2.4" fill="#fff" />
        <circle cx="220" cy="150" r="2.4" fill="#fff" />
      </g>

      {/* Chest core */}
      <circle className="dw-core" cx="200" cy="262" r="22" fill="url(#dwCore)" />
      <path d="M200 250 L211 262 L200 274 L189 262 Z" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" />

      {/* Sword: point down, hands resting on the pommel */}
      <rect x="192" y="330" width="16" height="210" rx="3" fill="url(#dwBlade)" filter="url(#dwGlow)" />
      <path d="M200 330 L200 540" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <path d="M150 322 L250 322 L240 334 L160 334 Z" fill="url(#dwSteelHi)" stroke={a(0.7)} strokeWidth="1.4" />
      <rect x="194" y="292" width="12" height="32" fill="#0a0d14" stroke={a(0.4)} strokeWidth="1" />
      {/* Gauntlets */}
      <path d="M170 300 Q200 288 230 300 L232 324 Q200 330 168 324 Z" fill="url(#dwSteelHi)" stroke={a(0.55)} strokeWidth="1.4" />
      <path d="M178 310 L222 310" stroke={a(0.3)} strokeWidth="1" />
    </svg>
  );
}
