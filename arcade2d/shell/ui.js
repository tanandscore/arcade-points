// Look and feel of the menus that wrap every 2D game: one stylesheet + a few small pieces, so all games feel like one product.
import React from "react";

export const C = { deep: "#12092b", panel: "#1d1046", panel2: "#241154", panel3: "#2a1560", line: "rgba(190,180,255,.22)", text: "#f5f0ff", dim: "#c3bbea", cyan: "#3ee6e0", amber: "#ffb703", mag: "#ff3ea5", gold: "#ffc233" };
export const F = { display: "'Bricolage Grotesque','Space Grotesk',system-ui,sans-serif", pixel: "'Press Start 2P',monospace", body: "'Space Grotesk',system-ui,sans-serif", mono: "'JetBrains Mono',monospace" };

export const CSS = `
.k2d{font-family:${F.body};color:${C.text};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.k2d *{box-sizing:border-box}
.k2d button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.k2d-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:16px;font-family:${F.display};font-weight:800;letter-spacing:.01em;color:#0c0620;transition:transform .12s ease, filter .15s ease, box-shadow .2s ease}
.k2d-btn:hover{transform:translateY(-2px);filter:brightness(1.08)}
.k2d-btn:active{transform:translateY(1px) scale(.985)}
.k2d-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
.k2d-ghost{background:rgba(255,255,255,.07);color:${C.text};border:1.5px solid ${C.line};box-shadow:none}
.k2d-ghost:hover{background:rgba(255,255,255,.14)}
.k2d-card{background:linear-gradient(180deg,rgba(40,22,92,.94),rgba(22,12,54,.96));border:1.5px solid ${C.line};border-radius:22px;box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}
.k2d-lv{position:relative;border-radius:16px;border:1.5px solid ${C.line};background:linear-gradient(180deg,rgba(60,34,130,.75),rgba(30,16,72,.85));padding:10px 8px 8px;text-align:center;transition:transform .12s ease, border-color .15s ease, box-shadow .2s ease;color:${C.text}}
.k2d-lv:hover:not([disabled]),.k2d-lv.sel{transform:translateY(-3px);border-color:var(--ac);box-shadow:0 10px 28px -10px var(--ac)}
.k2d-lv[disabled]{opacity:.5;cursor:not-allowed}
.k2d-tab{border:1.5px solid ${C.line};background:rgba(255,255,255,.05);color:${C.dim};border-radius:999px;padding:7px 16px;font-family:${F.display};font-weight:700;font-size:14px}
.k2d-tab.on{background:var(--ac);color:#0c0620;border-color:var(--ac)}
.k2d-pop{animation:k2dPop .28s cubic-bezier(.2,1.4,.4,1) both}
@keyframes k2dPop{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:none}}
.k2d-fade{animation:k2dFade .35s ease both}
@keyframes k2dFade{from{opacity:0}to{opacity:1}}
.k2d-star{display:inline-block;animation:k2dStar .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes k2dStar{from{opacity:0;transform:scale(0) rotate(-90deg)}to{opacity:1;transform:none}}
.k2d-tc{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(20,10,50,.42);border:2px solid rgba(255,255,255,.35);color:#fff;font-family:${F.display};font-weight:800;touch-action:none;-webkit-user-select:none;user-select:none;backdrop-filter:blur(2px)}
.k2d-tc.on{background:rgba(255,255,255,.34)}
@media (prefers-reduced-motion:reduce){.k2d-pop,.k2d-fade,.k2d-star{animation:none}}
`;

export function Btn({ children, onClick, primary, accent = C.cyan, w, h = 56, size = 22, style, ghost, ...rest }) {
  const base = { width: w, height: h, fontSize: size, padding: "0 28px" };
  const look = ghost ? {} : { background: `linear-gradient(180deg, ${lighten(accent)}, ${accent})`, boxShadow: `0 10px 30px -10px ${accent}, inset 0 1px 0 rgba(255,255,255,.55)` };
  return <button type="button" className={`k2d-btn ${ghost ? "k2d-ghost" : ""}`} onClick={onClick} style={{ ...base, ...look, ...style }} {...rest}>{children}</button>;
}
export function lighten(hex) { // quick lighten for the button gradient
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, f = (v) => Math.min(255, Math.round(v + (255 - v) * 0.4));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function Stars({ got = 0, size = 26, delay = 0, anim = false, max = 3 }) {
  return (
    <span style={{ display: "inline-flex", gap: size * 0.18 }}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} className={anim && i < got ? "k2d-star" : ""} style={{ animationDelay: `${delay + i * 0.28}s` }} width={size} height={size} viewBox="-12 -12 24 24" aria-hidden>
          <path d="M0-10 3-3.2 10-3 4.6 1.6 6.2 8.6 0 5 -6.2 8.6 -4.6 1.6 -10-3 -3-3.2Z" fill={i < got ? "#ffc233" : "rgba(60,30,90,.8)"} stroke={i < got ? "#150a33" : "rgba(190,180,255,.4)"} strokeWidth="1.6" strokeLinejoin="round" />
          {i < got && <path d="M-2.6-5.6 0-8.6" stroke="#fff6c4" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
      ))}
    </span>
  );
}
export function Chip({ children, color = C.dim, style }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,.07)", border: `1px solid ${C.line}`, color, fontFamily: F.display, fontWeight: 700, fontSize: 13, ...style }}>{children}</span>;
}
export function Lock({ size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><rect x="5" y="10" width="14" height="10" rx="2.5" fill="#c3bbea" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#c3bbea" strokeWidth="2.2" /></svg>;
}
