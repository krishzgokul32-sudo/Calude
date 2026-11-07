/**
 * GK's guardian: an original kneeling warrior in a crested helmet, drawn as SVG.
 * Mood: a single beam of light from above, black steel with cold rim light, a glowing
 * T visor, sword planted in front, round shield resting on the ground, fireflies.
 * Every glow uses the theme accent (--accent-rgb), so it follows blue / orange.
 */
const A = (o) => `rgba(var(--accent-rgb),${o})`;

function Limb({ d, w }) {
  // Solid strokes: a gradient stroke on a straight line has a zero-size box and would not render.
  return (
    <>
      <path d={d} stroke="rgba(255,255,255,0.16)" strokeWidth={w + 2.5} strokeLinecap="round" fill="none" />
      <path d={d} stroke="#12161d" strokeWidth={w} strokeLinecap="round" fill="none" />
      <path d={d} stroke="rgba(255,255,255,0.07)" strokeWidth={w * 0.4} strokeLinecap="round" fill="none" transform={`translate(${-w * 0.18} ${-w * 0.12})`} />
    </>
  );
}

export default function DarkWarrior({ className = '', style, beam = true }) {
  return (
    <svg className={`dark-warrior ${className}`} style={style} viewBox="0 0 400 540" role="img" aria-label="GK, a kneeling dark warrior">
      <defs>
        <linearGradient id="dwSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4250" />
          <stop offset="0.35" stopColor="#151a23" />
          <stop offset="1" stopColor="#05070a" />
        </linearGradient>
        <linearGradient id="dwPlate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a5262" />
          <stop offset="0.3" stopColor="#1a1f29" />
          <stop offset="0.75" stopColor="#090b10" />
          <stop offset="1" stopColor="#14181f" />
        </linearGradient>
        <linearGradient id="dwBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dwBlade" x1="0" x2="1">
          <stop offset="0" stopColor="#6c7383" />
          <stop offset="0.5" stopColor="#e8ecf3" />
          <stop offset="0.52" stopColor="#8b93a3" />
          <stop offset="1" stopColor="#2a2f39" />
        </linearGradient>
        <radialGradient id="dwShield" cx="0.45" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4b5262" />
          <stop offset="0.45" stopColor="#161a22" />
          <stop offset="1" stopColor="#040507" />
        </radialGradient>
        <radialGradient id="dwGround" cx="0.5" cy="0.2" r="0.7">
          <stop offset="0" stopColor="#2a2f38" stopOpacity="0.9" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id="dwGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="dwSoft" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id="dwGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" result="g" />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="gi" /></feMerge>
        </filter>
      </defs>

      {/* Beam of light from above, and the ground it falls on */}
      {beam && <path d="M176 0 L224 0 L372 540 L28 540 Z" fill="url(#dwBeam)" filter="url(#dwSoft)" />}
      <ellipse cx="200" cy="520" rx="200" ry="46" fill="url(#dwGround)" />
      {[[52, 506, 9], [96, 528, 6], [330, 512, 10], [292, 532, 5], [20, 530, 7], [372, 528, 6]].map(([x, y, r], i) => (
        <path key={i} d={`M${x - r * 1.6} ${y} Q${x - r} ${y - r * 1.4} ${x} ${y - r} Q${x + r * 1.2} ${y - r * 1.2} ${x + r * 1.7} ${y} Z`} fill="#0c0e12" stroke="rgba(255,255,255,0.08)" />
      ))}

      <g filter="url(#dwGrain)">
        {/* Cape pooling on the ground */}
        <path d="M128 214 Q70 300 34 520 Q200 548 366 520 Q330 300 272 214 Z" fill="#07090c" />
        <path d="M128 214 Q86 330 70 516 M272 214 Q314 330 330 516 M150 230 Q130 380 128 520 M250 230 Q270 380 272 520" stroke="rgba(255,255,255,0.05)" strokeWidth="2" fill="none" />

        {/* Thighs and knees (kneeling, coming toward us) */}
        <ellipse cx="128" cy="438" rx="62" ry="40" fill="url(#dwSteel)" transform="rotate(-12 128 438)" />
        <ellipse cx="272" cy="438" rx="62" ry="40" fill="url(#dwSteel)" transform="rotate(12 272 438)" />
        <ellipse cx="96" cy="452" rx="24" ry="22" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.18)" />
        <ellipse cx="304" cy="452" rx="24" ry="22" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.18)" />

        {/* Torso: muscled cuirass */}
        <path d="M126 222 Q200 206 274 222 L266 340 Q200 366 134 340 Z" fill="url(#dwPlate)" />
        <path d="M200 228 L200 352 M140 262 Q170 292 200 270 Q230 292 260 262 M146 312 Q200 330 254 312" stroke="rgba(255,255,255,0.13)" strokeWidth="1.6" fill="none" />
        <path d="M126 222 Q200 206 274 222" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" />
        {/* Leather pteruges at the waist */}
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={140 + i * 13.5} y={344 + Math.abs(i - 4) * -2} width="11" height="34" rx="2" fill="#0b0d12" stroke="rgba(255,255,255,0.07)" />
        ))}

        {/* Arms: upper arms down to the knees, forearms in to the grip */}
        <Limb d="M98 252 L112 372" w={44} />
        <Limb d="M302 252 L288 372" w={44} />
        <Limb d="M114 382 L184 336" w={34} />
        <Limb d="M286 382 L216 336" w={34} />
        {/* Bracers */}
        {[[132, 368, 150, 350], [150, 356, 168, 342], [268, 368, 250, 350], [250, 356, 232, 342]].map(([x1, y1, x2, y2], i) => (
          <path key={i} d={`M${x1} ${y1 - 16} L${x2} ${y2 + 16}`} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        ))}

        {/* Shoulders: pauldrons with medallions */}
        {[-1, 1].map((s) => (
          <g key={s} transform={`translate(${200 + s * 98} 238) scale(${s} 1)`}>
            <path d="M-42 -22 Q-2 -48 34 -16 Q42 10 30 34 Q-6 22 -36 30 Q-50 4 -42 -22 Z" fill="url(#dwPlate)" />
            <path d="M-42 -22 Q-2 -48 34 -16" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" fill="none" />
            <path d="M-38 6 Q-4 -6 32 10" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" fill="none" />
            <circle cx="-4" cy="-6" r="11" fill="#0c0e13" style={{ stroke: A(0.75) }} strokeWidth="1.6" />
            <circle cx="-4" cy="-6" r="5" style={{ fill: A(0.35) }} />
          </g>
        ))}

      </g>

      {/* Round shield resting on the ground */}
      <ellipse cx="200" cy="478" rx="98" ry="64" fill="url(#dwShield)" />
      <ellipse cx="200" cy="478" rx="98" ry="64" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeDasharray="190 420" strokeDashoffset="-250" />
      <ellipse cx="200" cy="478" rx="84" ry="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <ellipse cx="200" cy="470" rx="20" ry="13" fill="#20252e" style={{ stroke: A(0.5) }} />

      {/* Sword planted in front: pommel, grip, guard, blade */}
      <circle cx="200" cy="296" r="9" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.4)" />
      <rect x="196" y="304" width="8" height="40" fill="#14171d" />
      {/* Hands clasped over the grip */}
      <ellipse cx="190" cy="328" rx="20" ry="15" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.18)" />
      <ellipse cx="210" cy="328" rx="20" ry="15" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.18)" />
      <path d="M176 322 Q200 312 224 322" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" />
      <path d="M148 346 Q200 338 252 346 L252 354 Q200 348 148 354 Z" fill="url(#dwPlate)" stroke="rgba(255,255,255,0.4)" />
      <path d="M192 354 L208 354 L206 500 L200 512 L194 500 Z" fill="url(#dwBlade)" />
      <path d="M200 360 L200 500" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />

      {/* Helmet with crest, bowed */}
      <g filter="url(#dwGrain)">
        <path d="M150 112 Q160 36 214 22 Q262 16 284 54 Q246 40 224 66 Q206 88 214 112 Z" fill="#090a0d" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${160 + i * 4.5} 110 Q${168 + i * 6} ${50 - i} ${214 + i * 6} ${24 + i * 2.4}`} stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        ))}
        <path d="M152 112 Q160 40 214 24 Q262 18 284 54" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" fill="none" />
        <path d="M150 122 Q200 82 250 122 L256 178 Q250 208 224 244 L210 244 L207 186 L193 186 L190 244 L176 244 Q150 208 144 178 Z" fill="url(#dwPlate)" />
        <path d="M150 122 Q200 82 250 122" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" fill="none" />
        <path d="M150 140 Q200 120 250 140" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" fill="none" />
      </g>
      {/* Visor: T-shaped opening that glows */}
      <g className="dw-visor" filter="url(#dwGlow)">
        <path d="M160 152 Q178 150 194 158 L194 168 Q178 162 164 164 Z" style={{ fill: A(1) }} />
        <path d="M240 152 Q222 150 206 158 L206 168 Q222 162 236 164 Z" style={{ fill: A(1) }} />
        <path d="M194 158 L206 158 L206 186 L194 186 Z" style={{ fill: A(0.55) }} />
        <path d="M193 186 L207 186 L210 244 M193 186 L190 244" style={{ stroke: A(0.8) }} strokeWidth="1.6" fill="none" />
      </g>

      {/* Fireflies */}
      {[[70, 420], [330, 390], [46, 330], [356, 300], [110, 500], [300, 470], [250, 410], [150, 390]].map(([x, y], i) => (
        <circle key={i} className="dw-fly" cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.6} style={{ fill: A(1), animationDelay: `${i * 0.7}s` }} filter="url(#dwGlow)" />
      ))}
    </svg>
  );
}
