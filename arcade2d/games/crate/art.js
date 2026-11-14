// Crate Courier: all the pictures, drawn with code. Floor, wall, ice and hole tiles are drawn once per size and cached; crates, pads and the courier move.
import { cached, circle, ellipse, fillRR, rr, poly, line, glow, gloss, OUT } from "../../core/draw";
import { TAU, shade, rgba, hash2 } from "../../core/util";

// one look per world
export const LOOKS = [
  { name: "row", floorA: "#c9b38a", floorB: "#bfa97f", wall: "#7f8aa6", wallTop: "#b4bedb", wallDark: "#4c5670", crate: "#d9954a", band: "#8a5a2a", pad: "#ffe27a", grid: "rgba(70,45,10,.14)" },
  { name: "dock", floorA: "#8fb1d4", floorB: "#86a8cc", wall: "#e8f2ff", wallTop: "#ffffff", wallDark: "#8aa3c8", crate: "#4aa0d9", band: "#1f5f8f", pad: "#ffe27a", grid: "rgba(20,50,100,.16)" },
  { name: "pits", floorA: "#5a3c3c", floorB: "#533636", wall: "#2f2430", wallTop: "#5d4561", wallDark: "#1a1220", crate: "#d17b3a", band: "#6b3a14", pad: "#7dffb0", grid: "rgba(0,0,0,.28)" },
  { name: "depot", floorA: "#3e4a74", floorB: "#374369", wall: "#5a4f9a", wallTop: "#8f84d6", wallDark: "#2d2760", crate: "#e0a43c", band: "#6c4c10", pad: "#ff9ae0", grid: "rgba(6,10,40,.3)" },
];

export function floorTile(look, s, alt) {
  return cached(`cc-floor-${look.name}-${s}-${alt}`, s, s, (g) => {
    g.fillStyle = alt ? look.floorB : look.floorA; g.fillRect(0, 0, s, s);
    g.fillStyle = look.grid; g.fillRect(0, 0, s, 1.5); g.fillRect(0, 0, 1.5, s);
    const r = (i) => hash2(i, s + (alt ? 7 : 0), 5);
    if (look.name === "row") { g.fillStyle = "rgba(255,255,255,.10)"; for (let i = 0; i < 3; i++) g.fillRect(r(i) * s * 0.8, r(i + 4) * s * 0.8, 3, 2); g.strokeStyle = "rgba(90,60,20,.12)"; g.beginPath(); g.moveTo(s * 0.1, s * 0.5); g.lineTo(s * 0.9, s * 0.5); g.stroke(); }
    else if (look.name === "dock") { g.fillStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < 3; i++) g.fillRect(r(i) * s * 0.8, r(i + 4) * s * 0.8, 4, 2); }
    else if (look.name === "pits") { g.strokeStyle = "rgba(255,110,40,.22)"; g.lineWidth = 1.5; g.beginPath(); const y0 = r(1) * s; g.moveTo(0, y0); g.lineTo(s * 0.4, y0 + s * 0.15); g.lineTo(s * 0.6, y0 - s * 0.1); g.lineTo(s, y0 + s * 0.05); g.stroke(); }
    else { g.fillStyle = "rgba(255,255,255,.09)"; for (const [x, y] of [[4, 4], [s - 6, 4], [4, s - 6], [s - 6, s - 6]]) g.fillRect(x, y, 2, 2); }
  });
}

export function wallTile(look, s, seed) {
  return cached(`cc-wall-${look.name}-${s}-${seed % 3}`, s, s, (g) => {
    const d = s * 0.14;
    fillRR(g, 1, 3, s - 2, s - 3, s * 0.14, look.wallDark, null);
    fillRR(g, 1, 1, s - 2, s - d - 1, s * 0.14, look.wall, OUT, 2);
    g.save(); rr(g, 1, 1, s - 2, s - d - 1, s * 0.14); g.clip();
    g.fillStyle = look.wallTop; g.globalAlpha = 0.5; g.fillRect(2, 2, s - 4, s * 0.2); g.globalAlpha = 1;
    g.strokeStyle = rgba(look.wallDark, 0.55); g.lineWidth = 1.5;
    if (look.name === "row") { g.beginPath(); g.moveTo(1, s * 0.46); g.lineTo(s, s * 0.46); g.moveTo(s * (0.3 + 0.12 * (seed % 3)), 0); g.lineTo(s * (0.3 + 0.12 * (seed % 3)), s * 0.46); g.moveTo(s * 0.7, s * 0.46); g.lineTo(s * 0.7, s); g.stroke(); }
    else if (look.name === "dock") { g.fillStyle = "rgba(255,255,255,.7)"; for (let i = 0; i < 3; i++) { const x = s * (0.2 + 0.3 * i), h = s * (0.14 + 0.06 * ((seed + i) % 3)); poly(g, [[x, s * 0.5], [x + s * 0.1, s * 0.5 - h], [x + s * 0.2, s * 0.5]], "#ffffff", rgba(look.wallDark, 0.5), 1); } }
    else if (look.name === "pits") { g.strokeStyle = "rgba(255,120,40,.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.2, s * 0.8); g.lineTo(s * 0.4, s * 0.55); g.lineTo(s * 0.34, s * 0.35); g.lineTo(s * 0.6, s * 0.15); g.stroke(); }
    else { g.fillStyle = "#ffe066"; for (let i = 0; i < 4; i++) g.fillRect(s * (0.08 + i * 0.24), s * 0.55, s * 0.12, s * 0.16); g.fillStyle = "#2d2760"; for (let i = 0; i < 4; i++) g.fillRect(s * (0.2 + i * 0.24), s * 0.55, s * 0.12, s * 0.16); }
    g.restore();
  });
}

export function iceTile(look, s, alt) {
  return cached(`cc-ice-${look.name}-${s}-${alt}`, s, s, (g) => {
    const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, "#d8f4ff"); gr.addColorStop(1, "#8fd0f2");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(1.5, s * 0.05); g.lineCap = "round";
    g.beginPath(); g.moveTo(s * 0.18, s * 0.34); g.lineTo(s * 0.4, s * 0.16); g.moveTo(s * 0.55, s * 0.84); g.lineTo(s * 0.82, s * 0.6); g.stroke();
    g.strokeStyle = "rgba(60,130,190,.35)"; g.lineWidth = 1; g.strokeRect(0.5, 0.5, s - 1, s - 1);
  });
}

export function holeTile(s) {
  return cached(`cc-hole-${s}`, s, s, (g) => {
    g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, s, s);
    ellipse(g, s / 2, s / 2 + s * 0.04, s * 0.46, s * 0.4, "#0b0612", "#000", 2);
    const gr = g.createRadialGradient(s / 2, s / 2 + s * 0.06, 2, s / 2, s / 2 + s * 0.06, s * 0.4); gr.addColorStop(0, "#000"); gr.addColorStop(1, "#2a1738");
    g.fillStyle = gr; g.beginPath(); g.ellipse(s / 2, s / 2 + s * 0.05, s * 0.4, s * 0.33, 0, 0, TAU); g.fill();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(s / 2, s / 2 + s * 0.05, s * 0.4, s * 0.33, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  });
}

// the glowing pad a crate must reach (pulses a little)
export function drawPad(g, x, y, s, look, t, filled) {
  const pulse = 0.65 + 0.35 * Math.sin(t * 3.2 + x * 0.05), c = look.pad;
  g.save(); g.translate(x, y);
  glow(g, s / 2, s / 2, s * 0.75, c, filled ? 0.18 : 0.3 * pulse);
  fillRR(g, s * 0.12, s * 0.12, s * 0.76, s * 0.76, s * 0.14, rgba(c, 0.22 + 0.12 * pulse), c, Math.max(2, s * 0.06));
  g.strokeStyle = rgba(c, 0.9); g.lineWidth = Math.max(1.5, s * 0.05); g.setLineDash([s * 0.12, s * 0.1]); g.lineDashOffset = -t * 6;
  g.strokeRect(s * 0.24, s * 0.24, s * 0.52, s * 0.52); g.setLineDash([]);
  g.restore();
}

export function drawCrate(g, x, y, s, look, onPad, t, squash = 0) {
  g.save(); g.translate(x + s / 2, y + s / 2); g.scale(1 + squash * 0.1, 1 - squash * 0.1);
  const m = s * 0.5 - s * 0.08, w = m * 2; g.translate(-s / 2, -s / 2);
  const body = onPad ? "#7dffb0" : look.crate, band = onPad ? "#1c8a55" : look.band;
  if (onPad) glow(g, s / 2, s / 2, s * 0.8, "#7dffb0", 0.35 + 0.15 * Math.sin(t * 4));
  fillRR(g, s * 0.08, s * 0.12, w, w, s * 0.12, shade(body, -0.3), null);
  fillRR(g, s * 0.08, s * 0.06, w, w, s * 0.12, body, OUT, 2);
  g.save(); rr(g, s * 0.08, s * 0.06, w, w, s * 0.12); g.clip();
  g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(s * 0.08, s * 0.06, w, s * 0.14);
  g.strokeStyle = band; g.lineWidth = Math.max(2, s * 0.09);
  g.beginPath(); g.moveTo(s * 0.12, s * 0.1); g.lineTo(s * 0.88, s * 0.86); g.moveTo(s * 0.88, s * 0.1); g.lineTo(s * 0.12, s * 0.86); g.stroke();
  g.strokeStyle = shade(body, -0.35); g.lineWidth = 1; g.strokeRect(s * 0.2, s * 0.18, w - s * 0.24, w - s * 0.24);
  g.restore();
  if (onPad) { g.fillStyle = "#fff"; g.font = `900 ${s * 0.34}px sans-serif`; g.textAlign = "center"; g.fillText("✓", s / 2, s * 0.58); }
  g.restore();
}

// the courier: a little person in a cap and hi-vis vest. dir 0 up, 1 right, 2 down, 3 left
export function drawCourier(g, cx, cy, s, dir, t, walk = 0, push = 0) {
  const bob = Math.sin(walk * Math.PI) * s * 0.05, lean = push * s * 0.05, dx = [0, 1, 0, -1][dir] * lean, dy = [-1, 0, 1, 0][dir] * lean;
  g.save(); g.translate(cx + dx, cy + dy - bob);
  ellipse(g, 0, s * 0.34, s * 0.3, s * 0.1, "rgba(0,0,0,.28)", null, 0);
  const sw = Math.sin(walk * Math.PI * 2) * s * 0.07;
  fillRR(g, -s * 0.2, s * 0.14 + sw, s * 0.16, s * 0.2, s * 0.06, "#2c3a66", OUT, 1.5);
  fillRR(g, s * 0.04, s * 0.14 - sw, s * 0.16, s * 0.2, s * 0.06, "#2c3a66", OUT, 1.5);
  fillRR(g, -s * 0.27, -s * 0.12, s * 0.54, s * 0.38, s * 0.14, "#ff9d2e", OUT, 2);
  g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(-s * 0.27, s * 0.02, s * 0.54, s * 0.06);
  circle(g, 0, -s * 0.22, s * 0.22, "#ffd9b0", OUT, 2);
  const back = dir === 0;
  if (!back) {
    const ex = dir === 1 ? s * 0.05 : dir === 3 ? -s * 0.05 : 0;
    circle(g, -s * 0.08 + ex, -s * 0.22, s * 0.03, "#2a1a14", null, 0); circle(g, s * 0.08 + ex, -s * 0.22, s * 0.03, "#2a1a14", null, 0);
  }
  g.fillStyle = "#e34a4a"; g.beginPath(); g.ellipse(0, -s * 0.34, s * 0.23, s * 0.13, 0, Math.PI, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  const vx = dir === 1 ? s * 0.12 : dir === 3 ? -s * 0.12 : 0;
  fillRR(g, -s * 0.24 + vx, -s * 0.36, s * 0.48, s * 0.07, s * 0.03, "#c73a3a", OUT, 1.5);
  g.restore();
}
