// Blast Grid: all the pictures, drawn with code. Floor, wall and crate tiles are drawn once per garden and cached; the hero, bots, bombs and fire move every frame.
import { cached } from "../../core/draw";
import { circle, ellipse, fillRR, rr, poly, line, star, glow, gloss, text, OUT } from "../../core/draw";
import { TAU, shade, mix, rgba, hash2 } from "../../core/util";

// one look per world: floor, wall, crate and the colour of the glow around things
export const LOOKS = [
  { name: "yard", floorA: "#79d45f", floorB: "#6ac653", wall: "#9aa3bd", wallTop: "#c4cce4", wallDark: "#6b7390", crate: "#d9954a", band: "#8a5a2a", glow: "#fff3b0", grid: "rgba(30,90,30,.10)" },
  { name: "mines", floorA: "#4a4170", floorB: "#433a67", wall: "#5d5584", wallTop: "#8b83b8", wallDark: "#35305a", crate: "#c98450", band: "#6d4524", glow: "#9ef3ff", grid: "rgba(10,5,40,.18)" },
  { name: "docks", floorA: "#475a80", floorB: "#3f5176", wall: "#d8584a", wallTop: "#f58a7a", wallDark: "#8e3128", crate: "#d9b25a", band: "#6c5420", glow: "#9fe6ff", grid: "rgba(8,16,40,.22)" },
  { name: "core", floorA: "#4a3036", floorB: "#43292f", wall: "#2e2330", wallTop: "#5b4560", wallDark: "#1a1220", crate: "#b97a4a", band: "#5a3a1c", glow: "#ffb35a", grid: "rgba(0,0,0,.25)" },
];

const px = (s) => Math.max(1, Math.round(s));

export function floorTile(look, s, alt) {
  return cached(`bg-floor-${look.name}-${s}-${alt}`, s, s, (g) => {
    g.fillStyle = alt ? look.floorB : look.floorA; g.fillRect(0, 0, s, s);
    g.fillStyle = look.grid; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    const r = (i) => hash2(i, s + (alt ? 7 : 0), 3);
    if (look.name === "yard") { g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const x = r(i) * s * 0.9 + s * 0.05, y = r(i + 9) * s * 0.9 + s * 0.05; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.5, y - s * 0.09); g.moveTo(x, y); g.lineTo(x + 2, y - s * 0.08); g.stroke(); } }
    else if (look.name === "mines") { g.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 4; i++) g.fillRect(r(i) * s * 0.8, r(i + 5) * s * 0.8, 3, 2); g.fillStyle = "rgba(158,243,255,.08)"; g.fillRect(s * 0.18, s * 0.7, s * 0.14, 2); }
    else if (look.name === "docks") { g.fillStyle = "rgba(255,255,255,.07)"; for (const [x, y] of [[4, 4], [s - 6, 4], [4, s - 6], [s - 6, s - 6]]) g.fillRect(x, y, 2, 2); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, s - 3, s, 3); }
    else { g.strokeStyle = "rgba(255,120,40,.22)"; g.lineWidth = 1.5; g.beginPath(); const y0 = r(1) * s; g.moveTo(0, y0); g.lineTo(s * 0.4, y0 + s * 0.15); g.lineTo(s * 0.55, y0 - s * 0.1); g.lineTo(s, y0 + s * 0.1); g.stroke(); }
  });
}

export function wallTile(look, s, seed) {
  return cached(`bg-wall-${look.name}-${s}-${seed % 3}`, s, s, (g) => {
    const d = s * 0.14;
    fillRR(g, 1, 3, s - 2, s - 3, s * 0.16, look.wallDark, null);
    fillRR(g, 1, 1, s - 2, s - d - 1, s * 0.16, look.wall, OUT, 2);
    g.save(); rr(g, 1, 1, s - 2, s - d - 1, s * 0.16); g.clip();
    g.fillStyle = look.wallTop; g.globalAlpha = 0.55; g.fillRect(2, 2, s - 4, s * 0.2); g.globalAlpha = 1;
    g.strokeStyle = rgba(look.wallDark, 0.55); g.lineWidth = 1.5;
    if (look.name === "yard") { g.beginPath(); g.moveTo(1, s * 0.46); g.lineTo(s, s * 0.46); g.moveTo(s * (0.34 + 0.1 * (seed % 3)), 0); g.lineTo(s * (0.34 + 0.1 * (seed % 3)), s * 0.46); g.moveTo(s * 0.66, s * 0.46); g.lineTo(s * 0.66, s); g.stroke(); }
    else if (look.name === "mines") { const c = ["#9ef3ff", "#ff8ad2", "#ffe066"][seed % 3]; poly(g, [[s * 0.5, s * 0.2], [s * 0.68, s * 0.5], [s * 0.5, s * 0.72], [s * 0.32, s * 0.5]], c, OUT, 1.5); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(s * 0.44, s * 0.3, s * 0.05, s * 0.16); }
    else if (look.name === "docks") { g.strokeStyle = rgba(look.wallDark, 0.7); for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(s * (i / 5), 2); g.lineTo(s * (i / 5), s - d); g.stroke(); } g.fillStyle = "#ffe9a8"; g.fillRect(s * 0.1, s * 0.1, s * 0.12, s * 0.06); }
    else { g.strokeStyle = "rgba(255,120,40,.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.2, s * 0.8); g.lineTo(s * 0.4, s * 0.55); g.lineTo(s * 0.34, s * 0.35); g.lineTo(s * 0.6, s * 0.15); g.stroke(); g.strokeStyle = "rgba(255,200,90,.45)"; g.lineWidth = 1; g.stroke(); }
    g.restore();
  });
}

export function crateTile(look, s, gem) {
  return cached(`bg-crate-${look.name}-${s}-${gem ? 1 : 0}`, s, s, (g) => {
    const m = s * 0.07, w = s - m * 2;
    fillRR(g, m, m + 2, w, w, s * 0.1, shade(look.crate, -0.4), null);
    fillRR(g, m, m, w, w - 1, s * 0.1, look.crate, OUT, 2);
    g.save(); rr(g, m, m, w, w - 1, s * 0.1); g.clip();
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(m, m, w, s * 0.12);
    g.strokeStyle = look.band; g.lineWidth = Math.max(2, s * 0.09);
    g.beginPath(); g.moveTo(m, m); g.lineTo(m + w, m + w); g.moveTo(m + w, m); g.lineTo(m, m + w); g.stroke();
    g.strokeStyle = shade(look.crate, 0.35); g.lineWidth = 1; g.strokeRect(m + s * 0.1, m + s * 0.1, w - s * 0.2, w - s * 0.2);
    g.restore();
    circle(g, m + s * 0.14, m + s * 0.14, s * 0.035, "#2b1a0a"); circle(g, s - m - s * 0.14, m + s * 0.14, s * 0.035, "#2b1a0a"); circle(g, m + s * 0.14, s - m - s * 0.15, s * 0.035, "#2b1a0a"); circle(g, s - m - s * 0.14, s - m - s * 0.15, s * 0.035, "#2b1a0a");
    if (gem) { star(g, s * 0.5, s * 0.5, s * 0.1, "#fff6c4", null, 0, 4, 0.35); }
  });
}

export function drawGem(g, cx, cy, s, t, seed = 0) {
  const r = s * 0.27, bob = Math.sin(t * 3 + seed) * s * 0.03;
  g.save(); g.translate(cx, cy + bob);
  glow(g, 0, 0, s * 0.55, "#ffe27a", 0.35 + 0.15 * Math.sin(t * 4 + seed));
  poly(g, [[0, -r * 1.05], [r * 0.95, -r * 0.1], [0, r * 1.1], [-r * 0.95, -r * 0.1]], "#ffc233", OUT, 2);
  poly(g, [[0, -r * 1.05], [r * 0.95, -r * 0.1], [0, r * 0.15]], "#fff0a0", null);
  poly(g, [[0, -r * 1.05], [-r * 0.95, -r * 0.1], [0, r * 0.15]], "#ffd95c", null);
  poly(g, [[0, r * 1.1], [-r * 0.95, -r * 0.1], [0, r * 0.15]], "#e69a0c", null);
  g.restore();
}

export function drawDoor(g, x, y, s, open, t) {
  const m = s * 0.1;
  fillRR(g, x + m, y + m * 0.6, s - m * 2, s - m * 1.2, s * 0.2, "#2a1c52", OUT, 2);
  if (open) {
    glow(g, x + s / 2, y + s / 2, s * 0.9, "#7dffb0", 0.5 + 0.2 * Math.sin(t * 5));
    fillRR(g, x + m * 2, y + m * 1.5, s - m * 4, s - m * 3, s * 0.16, "#8dffc2", "#1f8f58", 2);
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; star(g, x + s / 2 + Math.cos(a) * s * 0.16, y + s / 2 + Math.sin(a) * s * 0.16, s * 0.07, "#ffffff", null, 0, 4, 0.4); }
    g.save(); g.translate(x + s / 2, y + s / 2); g.fillStyle = "#0e7a47"; g.beginPath(); g.moveTo(-s * 0.1, -s * 0.12); g.lineTo(s * 0.14, 0); g.lineTo(-s * 0.1, s * 0.12); g.closePath(); g.fill(); g.restore();
  } else {
    fillRR(g, x + m * 2, y + m * 1.5, s - m * 4, s - m * 3, s * 0.16, "#52467f", "#150a33", 2);
    g.fillStyle = "#ffc233"; g.fillRect(x + s * 0.38, y + s * 0.44, s * 0.24, s * 0.2); g.strokeStyle = "#ffc233"; g.lineWidth = Math.max(2, s * 0.05); g.beginPath(); g.arc(x + s / 2, y + s * 0.44, s * 0.09, Math.PI, 0); g.stroke();
    fillRR(g, x + s * 0.38, y + s * 0.44, s * 0.24, s * 0.2, 2, "#ffc233", OUT, 1.5);
  }
}

export function drawBomb(g, cx, cy, s, fuse, t, scale = 1) {
  const pulse = 1 + (fuse <= 1 ? 0.1 : 0.04) * Math.sin(t * (fuse <= 1 ? 22 : 9));
  const r = s * 0.31 * pulse * scale;
  g.save(); g.translate(cx, cy);
  ellipse(g, 0, r * 0.95, r * 0.9, r * 0.28, "rgba(0,0,0,.28)", null, 0);
  circle(g, 0, 0, r, fuse <= 1 ? "#5b1f2e" : "#2a2250", OUT, 2.2);
  gloss(g, 0, 0, r, 0.5);
  if (fuse <= 1) { g.globalCompositeOperation = "lighter"; circle(g, 0, 0, r * 0.95, "rgba(255,70,50,.35)", null, 0); g.globalCompositeOperation = "source-over"; }
  // cap and fuse
  fillRR(g, -r * 0.3, -r * 1.12, r * 0.6, r * 0.34, 2, "#9aa3bd", OUT, 1.5);
  g.strokeStyle = "#c9a56a"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -r * 1.1); g.quadraticCurveTo(r * 0.5, -r * 1.55, r * 0.7, -r * 1.35); g.stroke();
  const sp = 0.5 + 0.5 * Math.sin(t * 30);
  glow(g, r * 0.7, -r * 1.38, r * (0.5 + sp * 0.35), "#ffb347", 0.85); circle(g, r * 0.7, -r * 1.38, r * 0.14, "#fff7d6", null, 0);
  g.restore();
}

// a number in the middle of the bomb tells how many turns are left
export function fuseNumber(g, cx, cy, s, n) { text(g, String(n), cx, cy + s * 0.1, { size: s * 0.32, color: n <= 1 ? "#ff8a7a" : "#fff", align: "center", font: "'Bricolage Grotesque', system-ui, sans-serif", weight: 800 }); }

const EYE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function drawBot(g, cx, cy, s, type, dir, t, seed = 0, squash = 0) {
  g.save(); g.translate(cx, cy);
  const [ex, ey] = EYE[dir] || [0, 1], bob = Math.sin(t * 6 + seed) * s * 0.025;
  ellipse(g, 0, s * 0.32, s * 0.28, s * 0.07, "rgba(0,0,0,.28)", null, 0);
  g.translate(0, bob); g.scale(1 + squash * 0.18, 1 - squash * 0.18);
  if (type === "p") { // patrol slime: red, with little horns
    const r = s * 0.31;
    poly(g, [[-r * 0.6, -r * 0.6], [-r * 0.35, -r * 1.25], [-r * 0.05, -r * 0.75]], "#ffe066", OUT, 1.8); poly(g, [[r * 0.6, -r * 0.6], [r * 0.35, -r * 1.25], [r * 0.05, -r * 0.75]], "#ffe066", OUT, 1.8);
    g.beginPath(); g.moveTo(-r, s * 0.3); g.bezierCurveTo(-r * 1.15, -r * 0.9, r * 1.15, -r * 0.9, r, s * 0.3); g.closePath(); g.fillStyle = "#ff5d5d"; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
    gloss(g, -r * 0.1, -r * 0.1, r, 0.45);
    for (const sx of [-1, 1]) { circle(g, sx * r * 0.42 + ex * 2, -r * 0.1 + ey * 1.5, r * 0.3, "#fff", OUT, 1.6); circle(g, sx * r * 0.42 + ex * r * 0.16 + ex * 2, -r * 0.1 + ey * r * 0.16 + ey * 1.5, r * 0.13, "#150a33"); }
    line(g, -r * 0.8, -r * 0.55, -r * 0.1, -r * 0.35, OUT, 2.4); line(g, r * 0.8, -r * 0.55, r * 0.1, -r * 0.35, OUT, 2.4);
  } else if (type === "h") { // hunter ghost: purple, glowing eyes, wavy tail
    const r = s * 0.31, w = Math.sin(t * 8 + seed) * 2;
    glow(g, 0, 0, s * 0.55, "#c06bff", 0.35);
    g.beginPath(); g.moveTo(-r, s * 0.32); g.lineTo(-r, -r * 0.2); g.arc(0, -r * 0.2, r, Math.PI, 0); g.lineTo(r, s * 0.32);
    for (let i = 0; i < 3; i++) { const x0 = r - (i * 2 * r) / 3; g.quadraticCurveTo(x0 - r / 3, s * 0.32 + 5 + w * (i % 2 ? 1 : -1), x0 - (2 * r) / 3, s * 0.32); }
    g.closePath(); g.fillStyle = "#a45bff"; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
    gloss(g, -r * 0.1, -r * 0.5, r, 0.4);
    for (const sx of [-1, 1]) { ellipse(g, sx * r * 0.42 + ex * 2, -r * 0.2 + ey * 2, r * 0.22, r * 0.3, "#fff", OUT, 1.5); circle(g, sx * r * 0.42 + ex * r * 0.2 + ex * 2, -r * 0.2 + ey * r * 0.2 + ey * 2, r * 0.1, "#ff3e6c"); }
  } else { // sleeper: grey spiky ball with closed eyes
    const r = s * 0.27;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, a2 = a + TAU / 20; poly(g, [[Math.cos(a - 0.14) * r, Math.sin(a - 0.14) * r], [Math.cos(a2) * r * 1.5, Math.sin(a2) * r * 1.5], [Math.cos(a + 0.14) * r, Math.sin(a + 0.14) * r]], "#c9cde0", OUT, 1.6); }
    circle(g, 0, 0, r, "#8f93ac", OUT, 2.2); gloss(g, 0, 0, r, 0.4);
    for (const sx of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.arc(sx * r * 0.4, -r * 0.05, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    g.fillStyle = "#fff"; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + seed); g.font = `700 ${Math.round(s * 0.2)}px sans-serif`; g.fillText("z", r * 0.9, -r * 1.15); g.globalAlpha = 1;
  }
  g.restore();
}

export function drawHero(g, cx, cy, s, dir, t, o = {}) {
  const { walk = 0, squash = 0, dead = 0 } = o, [ex, ey] = EYE[dir] || [0, 1];
  g.save(); g.translate(cx, cy);
  ellipse(g, 0, s * 0.33, s * 0.26, s * 0.07, "rgba(0,0,0,.3)", null, 0);
  if (dead) { g.rotate(dead * 1.4); g.globalAlpha = Math.max(0, 1 - dead * 0.6); g.scale(1 - dead * 0.3, 1 - dead * 0.3); }
  const hop = Math.abs(Math.sin(walk * Math.PI)) * s * 0.08, r = s * 0.3;
  g.translate(0, -hop); g.scale(1 + squash * 0.12, 1 - squash * 0.12);
  // feet
  for (const sx of [-1, 1]) ellipse(g, sx * r * 0.45, s * 0.28 + Math.sin(walk * Math.PI * 2 + (sx > 0 ? 1.6 : 0)) * 1.5, r * 0.3, r * 0.2, "#ffffff", OUT, 1.8);
  // body
  circle(g, 0, 0, r, "#3ee6e0", OUT, 2.4);
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip(); g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(-r, r * 0.3, r * 2, r); g.restore();
  // helmet stripe and antenna
  g.strokeStyle = "#ffc233"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 0.82, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  line(g, 0, -r, 0, -r * 1.4, OUT, 2.4); circle(g, 0, -r * 1.48, r * 0.17, Math.sin(t * 8) > 0 ? "#ff5d5d" : "#ff9a9a", OUT, 1.6);
  // face visor
  fillRR(g, -r * 0.7 + ex * 2, -r * 0.42 + ey * 2, r * 1.4, r * 0.84, r * 0.4, "#f4fdff", OUT, 1.8);
  for (const sx of [-1, 1]) { circle(g, sx * r * 0.28 + ex * 3.2, -r * 0.02 + ey * 2.4, r * 0.16, "#150a33"); circle(g, sx * r * 0.28 + ex * 3.2 - 1, -r * 0.08 + ey * 2.4, r * 0.05, "#fff"); }
  gloss(g, -r * 0.1, -r * 0.2, r, 0.45);
  g.restore();
}

// one square of flame. `kind`: core, h (horizontal arm), v (vertical arm), end:(dx,dy)
export function drawFlame(g, x, y, s, a, t, seed = 0) {
  const k = Math.max(0, Math.min(1, a)), cx = x + s / 2, cy = y + s / 2, w = 1 + Math.sin(t * 40 + seed) * 0.06;
  g.save(); g.globalAlpha = Math.min(1, k * 1.4);
  glow(g, cx, cy, s * 0.85 * w, "#ff9a2d", 0.75);
  g.beginPath(); g.arc(cx, cy, s * 0.46 * w * (0.7 + 0.3 * k), 0, TAU); g.fillStyle = "#ff7a2d"; g.fill();
  g.beginPath(); g.arc(cx, cy, s * 0.33 * w * (0.7 + 0.3 * k), 0, TAU); g.fillStyle = "#ffc233"; g.fill();
  g.beginPath(); g.arc(cx, cy, s * 0.17 * w, 0, TAU); g.fillStyle = "#fff7d6"; g.fill();
  g.restore();
}
