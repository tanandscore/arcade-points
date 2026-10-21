// Drawn scenes for the four big games on the homepage and dashboard.
// Pure SVG: no image files to download, so the section appears instantly, stays sharp on any screen and costs the page almost nothing.
// Every scene uses the game's own accent colour on the site's usual deep purple.

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function Frame({ id, c, children }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c0620" />
          <stop offset="0.65" stopColor="#241154" />
          <stop offset="1" stopColor={c} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={c} stopOpacity="0.9" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#sky-${id})`} />
      {children}
    </svg>
  );
}

function City({ c }) {
  const bars = Array.from({ length: 22 }, (_, i) => { const w = 14 + rnd(i) * 16, h = 34 + rnd(i + 40) * 74; return { x: i * 19 - 6, w, h }; });
  return (
    <Frame id="mb" c={c}>
      <circle cx="285" cy="104" r="60" fill="url(#glow-mb)" />
      <circle cx="285" cy="110" r="26" fill={c} opacity="0.85" />
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={140 - b.h} width={b.w} height={b.h + 6} fill="#0c0620" opacity="0.95" />
          {Array.from({ length: 5 }, (_, k) => rnd(i * 7 + k) > 0.55 && <rect key={k} x={b.x + 3 + (k % 2) * 6} y={140 - b.h + 6 + Math.floor(k / 2) * 12} width="3" height="4" fill="#ffd1ec" opacity="0.8" />)}
        </g>
      ))}
      <polygon points="150,140 250,140 400,200 0,200" fill="#120a2c" />
      <polygon points="150,140 250,140 400,200 330,200" fill="#1a0f3d" />
      <polygon points="195,140 205,140 214,200 186,200" fill="#0c0620" opacity="0.5" />
      {[148, 160, 176, 198].map((y, i) => <rect key={y} x={197 - i * 0.6} y={y} width={2 + i * 1.3} height={4 + i * 3} fill="#ffe6a8" opacity="0.9" />)}
      <path d="M0 178 L120 160 M400 172 L270 158" stroke={c} strokeWidth="2.5" opacity="0.9" strokeLinecap="round" />
      <path d="M0 188 L90 176 M400 184 L300 172" stroke="#3ee6e0" strokeWidth="1.6" opacity="0.8" strokeLinecap="round" />
    </Frame>
  );
}

function Scope({ c }) {
  return (
    <Frame id="bs" c={c}>
      <g stroke="#a99fd6" strokeOpacity="0.14" strokeWidth="1">
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="200" />)}
        {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 40} x2="400" y2={i * 40} />)}
      </g>
      <g fill="none" stroke={c} strokeWidth="1.6">
        <circle cx="270" cy="100" r="64" opacity="0.8" />
        <circle cx="270" cy="100" r="43" opacity="0.55" />
        <circle cx="270" cy="100" r="22" opacity="0.9" />
        <path d="M270 26v148M196 100h148" opacity="0.7" />
      </g>
      <path d="M270 100 L270 36 A64 64 0 0 1 324 66 Z" fill={c} opacity="0.22" />
      <circle cx="312" cy="72" r="5" fill="#ff3b3b" />
      <circle cx="312" cy="72" r="12" fill="none" stroke="#ff3b3b" strokeWidth="1.5" opacity="0.7" />
      <g stroke="#f5f0ff" strokeWidth="2" opacity="0.7" fill="none">
        <path d="M14 30v-16h16M386 30v-16h-16M14 170v16h16M386 170v16h-16" />
      </g>
      
    </Frame>
  );
}

function Castle({ c }) {
  return (
    <Frame id="ka" c={c}>
      <circle cx="320" cy="48" r="22" fill="#fff2d0" opacity="0.9" />
      <circle cx="320" cy="48" r="46" fill="url(#glow-ka)" opacity="0.5" />
      {Array.from({ length: 34 }, (_, i) => <circle key={i} cx={rnd(i) * 400} cy={60 + rnd(i + 9) * 120} r={0.8 + rnd(i + 3) * 1.8} fill={rnd(i + 5) > 0.5 ? c : "#ff7a2f"} opacity={0.35 + rnd(i + 11) * 0.6} />)}
      <path d="M0 160 Q100 138 200 152 T400 146 V200 H0Z" fill="#150a33" />
      <g fill="#0c0620">
        <rect x="120" y="92" width="26" height="70" /><rect x="254" y="86" width="26" height="76" /><rect x="154" y="110" width="92" height="52" />
        <polygon points="116,92 133,64 150,92" /><polygon points="250,86 267,56 284,86" />
        {[154, 170, 186, 202, 218, 234].map((x) => <rect key={x} x={x} y="104" width="9" height="8" />)}
        <rect x="192" y="124" width="16" height="38" rx="8" />
      </g>
      <rect x="126" y="108" width="6" height="10" fill={c} opacity="0.9" /><rect x="260" y="104" width="6" height="10" fill={c} opacity="0.9" />
      <path d="M0 166 Q100 150 200 162 T400 158 V200 H0Z" fill="#0c0620" opacity="0.8" />
    </Frame>
  );
}

function Temple({ c }) {
  return (
    <Frame id="wo" c={c}>
      <ellipse cx="90" cy="30" rx="130" ry="34" fill="#150a33" opacity="0.9" />
      <ellipse cx="330" cy="22" rx="110" ry="30" fill="#150a33" opacity="0.9" />
      <polygon points="238,0 214,78 236,78 206,168 276,66 250,66 270,0" fill={c} opacity="0.35" />
      <polyline points="238,0 214,78 236,78 206,168" stroke="#fff6c8" strokeWidth="3.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points="238,0 214,78 236,78 206,168" stroke={c} strokeWidth="9" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.28" />
      <g fill="#0c0620">
        <polygon points="40,98 140,98 90,68" /><rect x="34" y="98" width="112" height="8" />
        {[44, 62, 80, 98, 116, 130].map((x) => <rect key={x} x={x} y="106" width="8" height="54" />)}
        <rect x="30" y="160" width="120" height="8" /><rect x="22" y="168" width="136" height="32" />
      </g>
      <path d="M0 176 H400 V200 H0Z" fill="#0c0620" opacity="0.85" />
    </Frame>
  );
}

const SCENES = { midnightburn: City, operationblacksite: Scope, kingdomsofash: Castle, wrathofolympus: Temple };

export default function FlagshipArt({ slug, color, icon }) {
  const Scene = SCENES[slug];
  if (!Scene) {
    return (
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 40%, ${color}66 0%, #1d1046 70%)` }}>
        <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-80">{icon}</span>
      </div>
    );
  }
  return <Scene c={color} />;
}
