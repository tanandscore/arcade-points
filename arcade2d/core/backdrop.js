// Parallax backgrounds. Each theme is a sky gradient plus a few tileable silhouette layers that scroll at different
// speeds, drifting clouds and a little ambient weather (rain, snow, embers, fireflies...). Layers are drawn once into small
// canvases and then just stamped, so a rich background costs almost nothing per frame.
import { TAU, rng, lerp, mix, shade, rgba, clamp } from "./util";
import { makeCanvas, rr, circle, ellipse, lin, glow, vgrad } from "./draw";

const TILE_W = 1280;
const S = 1.25; // how sharp the cached layers are (1 = logical pixels)

// a smooth wavy line that repeats exactly every `w` pixels, so tiles join without a seam
function ridgeFn(r, w, amp, waves = 4) {
  const parts = []; for (let k = 1; k <= waves; k++) parts.push([k, r.range(0.4, 1) / k, r.range(0, TAU)]);
  const norm = parts.reduce((s, p) => s + p[1], 0);
  return (x) => { let v = 0; for (const [k, a, ph] of parts) v += a * Math.sin((TAU * k * x) / w + ph); return (v / norm) * amp; };
}
const wrap3 = (fn, w, x) => { fn(x); if (x < 200) fn(x + w); if (x > w - 200) fn(x - w); };

function cloud(g, x, y, s, color, shadeC) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const blobs = [[0, 0, 34], [34, 8, 26], [-34, 10, 24], [64, 14, 18], [-62, 16, 17], [14, -16, 26]];
  g.fillStyle = shadeC; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by + 5, br, 0, TAU); g.fill(); }
  g.fillStyle = color; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.restore();
}
function tree(g, x, y, s, c1, c2, kind) {
  if (kind === "pine") { g.fillStyle = c2; g.fillRect(x - 2 * s, y - 6 * s, 4 * s, 8 * s); for (let i = 0; i < 4; i++) { const w = (22 - i * 4) * s, ty = y - (8 + i * 11) * s; g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(x - w, ty); g.lineTo(x, ty - 20 * s); g.lineTo(x + w, ty); g.closePath(); g.fill(); } }
  else { g.fillStyle = c2; g.fillRect(x - 2.5 * s, y - 16 * s, 5 * s, 18 * s); g.fillStyle = c1; g.beginPath(); g.arc(x, y - 26 * s, 17 * s, 0, TAU); g.arc(x - 11 * s, y - 18 * s, 12 * s, 0, TAU); g.arc(x + 11 * s, y - 18 * s, 12 * s, 0, TAU); g.fill(); }
}

// ---- layer painters: each draws one tile (width TILE_W) --------------------------------------------------------------------------
const PAINT = {
  hills(g, w, h, L, r) {
    const f = ridgeFn(r, w, L.amp || 50, 4), base = h * (L.base ?? 0.7);
    g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, base + f(x)); g.lineTo(w, h); g.closePath();
    g.fillStyle = lin(g, 0, base - (L.amp || 50), 0, h, [[0, L.color], [1, L.color2 || shade(L.color, -0.25)]]); g.fill();
    if (L.rim) { g.beginPath(); for (let x = 0; x <= w; x += 8) (x ? g.lineTo(x, base + f(x)) : g.moveTo(x, base + f(x))); g.lineWidth = 2; g.strokeStyle = L.rim; g.stroke(); }
    if (L.trees) { const n = L.trees; for (let i = 0; i < n; i++) { const x = r() * w, y = base + f(x) + 4, s = r.range(0.7, 1.25) * (L.treeScale || 1); wrap3((xx) => tree(g, xx, y, s, shade(L.color, -0.12), shade(L.color, -0.32), L.treeKind || "round"), w, x); } }
  },
  mountains(g, w, h, L, r) {
    const base = h * (L.base ?? 0.8), n = L.count || 6;
    for (let i = 0; i < n; i++) {
      const cx = (i + r.range(0.2, 0.8)) * (w / n), pw = r.range(150, 280), ph = r.range(90, L.amp || 170);
      wrap3((x) => {
        g.beginPath(); g.moveTo(x - pw, h); g.lineTo(x - pw, base); g.lineTo(x - pw * 0.28, base - ph * 0.8); g.lineTo(x, base - ph); g.lineTo(x + pw * 0.3, base - ph * 0.78); g.lineTo(x + pw, base); g.lineTo(x + pw, h); g.closePath();
        g.fillStyle = lin(g, 0, base - ph, 0, base, [[0, L.color], [1, L.color2 || shade(L.color, -0.2)]]); g.fill();
        if (L.snow) { g.fillStyle = L.snow; g.beginPath(); g.moveTo(x - pw * 0.3, base - ph * 0.77); g.lineTo(x, base - ph); g.lineTo(x + pw * 0.32, base - ph * 0.76); g.lineTo(x + pw * 0.14, base - ph * 0.66); g.lineTo(x, base - ph * 0.74); g.lineTo(x - pw * 0.12, base - ph * 0.64); g.closePath(); g.fill(); }
        g.fillStyle = rgba("#000", 0.13); g.beginPath(); g.moveTo(x, base - ph); g.lineTo(x + pw * 0.3, base - ph * 0.78); g.lineTo(x + pw, base); g.lineTo(x + pw * 0.1, base); g.closePath(); g.fill();
      }, w, cx);
    }
    g.fillStyle = L.color2 || shade(L.color, -0.2); g.fillRect(0, base, w, h - base);
  },
  skyline(g, w, h, L, r) {
    const base = h, minH = L.minH || 120, maxH = L.maxH || 340, night = L.night, wcol = L.windows || ["#ffd98a", "#8ff3ff", "#ffa6e0"];
    let x = -r.range(0, 30);
    while (x < w) {
      const bw = r.range(L.minW || 44, L.maxW || 110), bh = r.range(minH, maxH), top = base - bh, c = mix(L.color, L.color2 || shade(L.color, -0.3), r());
      g.fillStyle = lin(g, 0, top, 0, base, [[0, shade(c, 0.1)], [1, shade(c, -0.15)]]); g.fillRect(x, top, bw, bh);
      g.fillStyle = rgba("#fff", 0.07); g.fillRect(x, top, 3, bh); g.fillStyle = rgba("#000", 0.16); g.fillRect(x + bw - 5, top, 5, bh);
      const roof = r();
      if (roof < 0.25) { g.fillStyle = shade(c, -0.25); g.fillRect(x + bw * 0.45, top - 36, 3, 36); g.fillRect(x + bw * 0.45 - 6, top - 26, 15, 2); if (night) { g.fillStyle = "#ff3e5a"; g.fillRect(x + bw * 0.45 - 1, top - 40, 5, 5); } }
      else if (roof < 0.45) { g.fillStyle = shade(c, -0.2); g.fillRect(x + 8, top - 14, bw * 0.4, 14); g.fillRect(x + bw * 0.6, top - 9, bw * 0.25, 9); }
      else if (roof < 0.58) { g.fillStyle = shade(c, 0.05); g.beginPath(); g.moveTo(x + bw * 0.2, top); g.lineTo(x + bw * 0.5, top - 28); g.lineTo(x + bw * 0.8, top); g.closePath(); g.fill(); }
      const cols = Math.max(2, Math.floor((bw - 12) / 13)), rows = Math.floor((bh - 20) / 17);
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const lit = r() < (L.litChance ?? (night ? 0.28 : 0.55)); if (!lit && !night) continue;
        const wx = x + 8 + cx * ((bw - 16) / cols), wy = top + 12 + cy * 17;
        g.fillStyle = lit ? (night ? r.pick(wcol) : L.dayWindow || "rgba(190,230,255,.55)") : rgba("#000", 0.18); g.fillRect(wx, wy, 7, 9);
      }
      if (L.neon && r() < 0.28) { const nc = r.pick(L.neon), ny = top + r.range(20, Math.max(30, bh * 0.5)); g.save(); g.shadowColor = nc; g.shadowBlur = 14; g.fillStyle = nc; g.fillRect(x + bw - 10, ny, 4, r.range(30, 70)); g.restore(); }
      x += bw + r.range(0, L.gap ?? 6);
    }
  },
  // building tops that hang from the top edge (cave stalactites, ruined ceilings...)
  stalactites(g, w, h, L, r) {
    const n = L.count || 22; g.fillStyle = L.color;
    for (let i = 0; i < n; i++) {
      const x = r() * w, sw = r.range(20, 60), sh = r.range(40, L.amp || 160);
      wrap3((xx) => { g.beginPath(); g.moveTo(xx - sw, 0); g.lineTo(xx - sw * 0.2, sh * 0.75); g.lineTo(xx, sh); g.lineTo(xx + sw * 0.25, sh * 0.7); g.lineTo(xx + sw, 0); g.closePath(); g.fillStyle = lin(g, 0, 0, 0, sh, [[0, L.color], [1, L.color2 || shade(L.color, 0.12)]]); g.fill(); }, w, x);
    }
    g.fillStyle = L.color; g.fillRect(0, 0, w, L.cap ?? 24);
  },
  stalagmites(g, w, h, L, r) {
    const n = L.count || 18;
    for (let i = 0; i < n; i++) {
      const x = r() * w, sw = r.range(24, 70), sh = r.range(40, L.amp || 150);
      wrap3((xx) => { g.beginPath(); g.moveTo(xx - sw, h); g.lineTo(xx - sw * 0.15, h - sh * 0.8); g.lineTo(xx + sw * 0.05, h - sh); g.lineTo(xx + sw * 0.3, h - sh * 0.6); g.lineTo(xx + sw, h); g.closePath(); g.fillStyle = lin(g, 0, h - sh, 0, h, [[0, L.color2 || shade(L.color, 0.1)], [1, L.color]]); g.fill(); }, w, x);
    }
  },
  crystals(g, w, h, L, r) {
    const n = L.count || 14, cols = L.colors || ["#7c5cff", "#3ee6e0", "#ff3ea5"];
    for (let i = 0; i < n; i++) {
      const x = r() * w, base = h - r.range(0, 30), c = r.pick(cols), k = r.int(2, 4);
      wrap3((xx) => {
        glow(g, xx, base - 40, 90, c, 0.22);
        for (let j = 0; j < k; j++) {
          const cx = xx + (j - k / 2) * r.range(10, 18), ch = r.range(40, L.amp || 110), cw = r.range(9, 18), lean = r.range(-10, 10);
          g.beginPath(); g.moveTo(cx - cw / 2, base); g.lineTo(cx - cw / 2 + lean * 0.3, base - ch * 0.8); g.lineTo(cx + lean, base - ch); g.lineTo(cx + cw / 2 + lean * 0.3, base - ch * 0.8); g.lineTo(cx + cw / 2, base); g.closePath();
          g.fillStyle = lin(g, cx, base - ch, cx, base, [[0, shade(c, 0.45)], [1, shade(c, -0.25)]]); g.fill();
          g.fillStyle = rgba("#fff", 0.35); g.beginPath(); g.moveTo(cx - cw / 2 + 2, base - 4); g.lineTo(cx - cw / 2 + lean * 0.3 + 2, base - ch * 0.78); g.lineTo(cx + lean * 0.5, base - ch * 0.95); g.lineTo(cx - 1, base - ch * 0.5); g.closePath(); g.fill();
        }
      }, w, x);
    }
  },
  islands(g, w, h, L, r) {
    const n = L.count || 5;
    for (let i = 0; i < n; i++) {
      const x = (i + r.range(0.15, 0.85)) * (w / n), y = h * r.range(0.25, 0.75), iw = r.range(90, 190), ih = iw * r.range(0.35, 0.6);
      wrap3((xx) => {
        g.beginPath(); g.moveTo(xx - iw / 2, y); g.quadraticCurveTo(xx - iw * 0.3, y + ih * 0.9, xx, y + ih * 1.5); g.quadraticCurveTo(xx + iw * 0.3, y + ih * 0.9, xx + iw / 2, y); g.closePath();
        g.fillStyle = lin(g, 0, y, 0, y + ih * 1.5, [[0, L.rock], [1, shade(L.rock, -0.3)]]); g.fill();
        g.beginPath(); g.ellipse(xx, y, iw / 2, 12, 0, 0, TAU); g.fillStyle = L.grass; g.fill();
        for (let t = 0; t < 3; t++) tree(g, xx + (t - 1) * iw * 0.25, y - 2, r.range(0.6, 0.95), shade(L.grass, -0.1), shade(L.grass, -0.35), r.chance(0.4) ? "pine" : "round");
        if (r.chance(0.5)) { g.fillStyle = rgba("#bfe9ff", 0.7); g.fillRect(xx + iw * 0.18, y + 6, 6, ih * 1.6); }
      }, w, x);
    }
  },
  volcano(g, w, h, L, r) {
    const n = L.count || 3;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * (w / n) + r.range(-60, 60), pw = r.range(260, 400), ph = r.range(180, L.amp || 300), base = h;
      wrap3((x) => {
        g.beginPath(); g.moveTo(x - pw, base); g.lineTo(x - 40, base - ph); g.lineTo(x + 40, base - ph); g.lineTo(x + pw, base); g.closePath();
        g.fillStyle = lin(g, 0, base - ph, 0, base, [[0, L.color2 || "#2a0f1f"], [1, L.color]]); g.fill();
        glow(g, x, base - ph, 120, "#ff7a2d", 0.55);
        g.beginPath(); g.moveTo(x - 38, base - ph); g.quadraticCurveTo(x - 60, base - ph * 0.6, x - 90 + r.range(-20, 20), base - ph * 0.15); g.lineWidth = 5; g.strokeStyle = "#ff8a2a"; g.stroke();
        g.beginPath(); g.moveTo(x + 36, base - ph); g.quadraticCurveTo(x + 58, base - ph * 0.55, x + 80, base - ph * 0.1); g.lineWidth = 4; g.strokeStyle = "#ffb13d"; g.stroke();
      }, w, cx);
    }
  },
  pillars(g, w, h, L, r) { // ruins / temple columns / factory beams
    const n = L.count || 9;
    for (let i = 0; i < n; i++) {
      const x = (i + r.range(0.1, 0.9)) * (w / n), pw = r.range(26, 54), ph = r.range(120, L.amp || 320), broken = r.chance(0.4);
      wrap3((xx) => {
        const top = h - ph; g.fillStyle = lin(g, xx - pw / 2, 0, xx + pw / 2, 0, [[0, shade(L.color, 0.1)], [0.6, L.color], [1, shade(L.color, -0.25)]]); g.fillRect(xx - pw / 2, top, pw, ph);
        if (!broken) { g.fillStyle = shade(L.color, 0.15); g.fillRect(xx - pw * 0.7, top - 10, pw * 1.4, 12); g.fillRect(xx - pw * 0.6, h - 10, pw * 1.2, 10); }
        else { g.fillStyle = L.color; g.beginPath(); g.moveTo(xx - pw / 2, top); g.lineTo(xx - pw * 0.1, top - 14); g.lineTo(xx + pw * 0.25, top + 4); g.lineTo(xx + pw / 2, top - 6); g.lineTo(xx + pw / 2, top + 10); g.lineTo(xx - pw / 2, top + 10); g.closePath(); g.fill(); }
        g.strokeStyle = rgba("#000", 0.22); g.lineWidth = 2; for (let f = 1; f < 4; f++) { g.beginPath(); g.moveTo(xx - pw / 2 + (pw * f) / 4, top + 6); g.lineTo(xx - pw / 2 + (pw * f) / 4, h); g.stroke(); }
      }, w, x);
    }
  },
  pipes(g, w, h, L, r) { // sewer / industrial: horizontal pipes and arches
    for (let i = 0; i < (L.count || 4); i++) {
      const y = h * r.range(0.15, 0.85), th = r.range(14, 30);
      g.fillStyle = lin(g, 0, y, 0, y + th, [[0, shade(L.color, 0.18)], [0.5, L.color], [1, shade(L.color, -0.3)]]); g.fillRect(0, y, w, th);
      for (let x = r.range(0, 120); x < w; x += r.range(150, 280)) { g.fillStyle = shade(L.color, -0.12); g.fillRect(x, y - 4, 10, th + 8); }
      if (L.drips) for (let k = 0; k < 4; k++) { const x = r() * w; g.fillStyle = rgba(L.drips, 0.6); g.fillRect(x, y + th, 3, r.range(12, 50)); }
    }
  },
  waves(g, w, h, L, r) {
    const f = ridgeFn(r, w, L.amp || 14, 3), base = h * (L.base ?? 0.7);
    g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 6) g.lineTo(x, base + f(x)); g.lineTo(w, h); g.closePath(); g.fillStyle = lin(g, 0, base, 0, h, [[0, L.color], [1, L.color2 || shade(L.color, -0.3)]]); g.fill();
    g.strokeStyle = rgba("#fff", 0.28); g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 6) (x ? g.lineTo(x, base + f(x)) : g.moveTo(x, base + f(x))); g.stroke();
  },
  dunes(g, w, h, L, r) { PAINT.hills(g, w, h, { ...L, amp: L.amp || 60 }, r); },
  cranes(g, w, h, L, r) { // harbour / construction cranes + containers
    for (let i = 0; i < (L.count || 3); i++) {
      const x = r() * w, ch = r.range(220, 380);
      wrap3((xx) => {
        g.strokeStyle = L.color; g.lineWidth = 6; g.beginPath(); g.moveTo(xx, h); g.lineTo(xx, h - ch); g.stroke();
        g.lineWidth = 5; g.beginPath(); g.moveTo(xx - 40, h - ch + 6); g.lineTo(xx + 150, h - ch + 6); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(xx, h - ch); g.lineTo(xx + 150, h - ch + 6); g.moveTo(xx, h - ch - 40); g.lineTo(xx + 140, h - ch + 4); g.moveTo(xx, h - ch - 40); g.lineTo(xx - 40, h - ch + 6); g.moveTo(xx, h - ch); g.lineTo(xx, h - ch - 40); g.stroke();
        g.beginPath(); g.moveTo(xx + 120, h - ch + 6); g.lineTo(xx + 120, h - ch + 70); g.stroke(); g.fillStyle = L.color; g.fillRect(xx + 108, h - ch + 70, 24, 16);
      }, w, x);
    }
    let x = 0; const cols = L.boxes || ["#b5483a", "#3a6fb5", "#c9a13a", "#3aa57a"];
    while (x < w) { const cw = 64, rows = r.int(1, 3); for (let k = 0; k < rows; k++) { g.fillStyle = shade(r.pick(cols), -0.35); g.fillRect(x, h - (k + 1) * 26, cw - 2, 25); g.fillStyle = rgba("#000", 0.2); for (let s = 6; s < cw - 6; s += 8) g.fillRect(x + s, h - (k + 1) * 26 + 2, 2, 21); } x += cw + r.range(0, 40); }
  },
  bushes(g, w, h, L, r) { // low foreground foliage / rubble strip along the bottom
    const base = h * (L.base ?? 0.92);
    for (let i = 0; i < (L.count || 26); i++) { const x = r() * w, s = r.range(0.7, 1.5); wrap3((xx) => { g.fillStyle = r.chance(0.5) ? L.color : L.color2 || shade(L.color, -0.15); g.beginPath(); g.arc(xx, base, 26 * s, Math.PI, 0); g.arc(xx + 22 * s, base + 4, 20 * s, Math.PI, 0); g.fill(); }, w, x); }
    g.fillRect(0, base, w, h - base);
  },
};

// ---- themes -------------------------------------------------------------------------------------------------------------------------
const NEON = ["#ff3ea5", "#3ee6e0", "#ffb703", "#7c5cff"];
export const THEMES = {
  meadow: {
    sky: [[0, "#58c4ff"], [0.55, "#a8e6ff"], [1, "#fff1cf"]], sun: { x: 0.78, y: 0.2, r: 44, c: "#fff6b8" }, clouds: { n: 6, y: [0.06, 0.35], c: "#ffffff", s: "#d2eeff" },
    layers: [{ kind: "hills", px: 0.06, base: 0.62, amp: 36, color: "#b4e3e8", color2: "#d6f1ee" }, { kind: "mountains", px: 0.1, base: 0.74, amp: 150, count: 5, color: "#9fcbe0", snow: "#f4fbff" }, { kind: "hills", px: 0.2, base: 0.76, amp: 50, color: "#78d49c", trees: 14, treeKind: "round" }, { kind: "hills", px: 0.38, base: 0.88, amp: 40, color: "#46b56f", color2: "#2f9a5b", trees: 9, treeScale: 1.25, treeKind: "pine" }],
    ambient: { kind: "petals", n: 28, color: "#ffffff" }, below: "#2f9a5b",
  },
  cave: {
    sky: [[0, "#150d33"], [0.6, "#241552"], [1, "#2d1a62"]], clouds: null,
    layers: [{ kind: "crystals", px: 0.12, count: 8, amp: 140, colors: ["#7c5cff", "#3ee6e0"] }, { kind: "stalactites", px: 0.2, count: 12, amp: 190, color: "#1a1040", color2: "#2e1c6a", cap: 18 }, { kind: "stalagmites", px: 0.3, count: 12, amp: 170, color: "#1c1245", color2: "#3a2380" }, { kind: "stalactites", px: 0.5, count: 7, amp: 120, color: "#0f0830", color2: "#1d1250", cap: 14 }, { kind: "crystals", px: 0.55, count: 5, amp: 90, colors: ["#ff3ea5", "#7c5cff", "#3ee6e0"] }],
    ambient: { kind: "motes", n: 40, color: "#a89cff" }, below: "#0f0830",
  },
  sky: {
    sky: [[0, "#6f6bff"], [0.45, "#ff9ad5"], [1, "#ffe0b0"]], sun: { x: 0.2, y: 0.55, r: 64, c: "#fff0c2" }, clouds: { n: 9, y: [0.08, 0.7], c: "#fff6ff", s: "#e9b9f2" },
    layers: [{ kind: "islands", px: 0.08, count: 4, rock: "#c58ae8", grass: "#e6a8ff" }, { kind: "islands", px: 0.2, count: 4, rock: "#a56bd4", grass: "#7ee0a8" }, { kind: "hills", px: 0.4, base: 0.95, amp: 20, color: "#ffd0f0", color2: "#f6b2e0" }],
    ambient: { kind: "sparkles", n: 36, color: "#fff6c4" }, below: "#f6b2e0",
  },
  volcano: {
    sky: [[0, "#1c0710"], [0.5, "#5a1a22"], [1, "#c2461f"]], clouds: null,
    layers: [{ kind: "volcano", px: 0.08, count: 3, amp: 330, color: "#4a1822", color2: "#26090f" }, { kind: "mountains", px: 0.2, base: 0.88, amp: 190, count: 6, color: "#3a1219", color2: "#220a10" }, { kind: "hills", px: 0.4, base: 0.92, amp: 30, color: "#2a0d14", color2: "#1a060b", rim: "rgba(255,120,40,.55)" }],
    ambient: { kind: "embers", n: 70, color: "#ffb13d" }, below: "#1a060b",
  },
  snow: {
    sky: [[0, "#7fb4ff"], [0.6, "#cfe8ff"], [1, "#f4fbff"]], clouds: { n: 5, y: [0.05, 0.3], c: "#ffffff", s: "#cfe0f5" },
    layers: [{ kind: "mountains", px: 0.06, base: 0.7, amp: 190, count: 4, color: "#a8c4ec", snow: "#ffffff" }, { kind: "hills", px: 0.2, base: 0.82, amp: 44, color: "#dbeaff", trees: 12, treeKind: "pine" }, { kind: "hills", px: 0.4, base: 0.92, amp: 30, color: "#f1f7ff", color2: "#d7e6fb", trees: 6, treeKind: "pine", treeScale: 1.3 }],
    ambient: { kind: "snow", n: 90, color: "#ffffff" }, below: "#d7e6fb",
  },
  desert: {
    sky: [[0, "#ff9a5a"], [0.5, "#ffd27d"], [1, "#fff0c2"]], sun: { x: 0.7, y: 0.3, r: 56, c: "#fff6d0" }, clouds: { n: 3, y: [0.08, 0.25], c: "#fff3de", s: "#ffd9a8" },
    layers: [{ kind: "mountains", px: 0.06, base: 0.7, amp: 120, count: 5, color: "#e59a63", color2: "#c97b4a" }, { kind: "dunes", px: 0.2, base: 0.8, amp: 40, color: "#f0b36e", color2: "#dc9552" }, { kind: "dunes", px: 0.4, base: 0.92, amp: 34, color: "#e39f55", color2: "#c4803a" }],
    ambient: { kind: "dust", n: 24, color: "#ffe2b0" }, below: "#c4803a",
  },
  forest: {
    sky: [[0, "#3a8f7c"], [0.6, "#8fd3a3"], [1, "#e4f6c0"]], clouds: { n: 3, y: [0.05, 0.25], c: "#f2ffe6", s: "#bfe7c8" },
    layers: [{ kind: "hills", px: 0.06, base: 0.6, amp: 40, color: "#7cc79a", trees: 22, treeKind: "pine" }, { kind: "hills", px: 0.18, base: 0.74, amp: 40, color: "#4faa7c", trees: 22, treeKind: "pine", treeScale: 1.15 }, { kind: "hills", px: 0.36, base: 0.9, amp: 30, color: "#2f8a5f", color2: "#1f6c49", trees: 12, treeKind: "pine", treeScale: 1.5 }],
    ambient: { kind: "fireflies", n: 26, color: "#f4ff8a" }, below: "#1f6c49",
  },
  night_forest: {
    sky: [[0, "#070b24"], [0.6, "#15204a"], [1, "#27406a"]], moon: { x: 0.75, y: 0.2, r: 34, c: "#f2f2ff" }, stars: 90, clouds: null,
    layers: [{ kind: "hills", px: 0.06, base: 0.62, amp: 40, color: "#1b3a5e", trees: 20, treeKind: "pine" }, { kind: "hills", px: 0.2, base: 0.76, amp: 40, color: "#12304f", trees: 20, treeKind: "pine" }, { kind: "hills", px: 0.38, base: 0.9, amp: 30, color: "#0c2038", color2: "#071526", trees: 10, treeKind: "pine", treeScale: 1.5 }],
    ambient: { kind: "fireflies", n: 30, color: "#d6ff8a" }, below: "#071526",
  },
  // ---- cities -----------------------------------------------------------------------------------------------------------------------
  city_day: {
    sky: [[0, "#4fa8ff"], [0.6, "#a5d8ff"], [1, "#ffe9c4"]], sun: { x: 0.72, y: 0.22, r: 40, c: "#fff5bd" }, clouds: { n: 5, y: [0.05, 0.3], c: "#ffffff", s: "#cfe3f7" },
    layers: [{ kind: "skyline", px: 0.06, color: "#a9c4e6", color2: "#8eacd6", minH: 160, maxH: 380, litChance: 0.35, gap: 4 }, { kind: "skyline", px: 0.16, color: "#7f9bc9", color2: "#667fb0", minH: 140, maxH: 330, gap: 8 }, { kind: "skyline", px: 0.32, color: "#55709f", color2: "#3f5784", minH: 110, maxH: 260, gap: 12, maxW: 130 }],
    ambient: { kind: "dust", n: 16, color: "#ffffff" }, below: "#3f5784",
  },
  city_dusk: {
    sky: [[0, "#2a1458"], [0.45, "#a2377c"], [0.8, "#ff8a5c"], [1, "#ffd28a"]], sun: { x: 0.3, y: 0.62, r: 60, c: "#ffe3a6" }, clouds: { n: 4, y: [0.1, 0.45], c: "#ff9fb2", s: "#b6407c" },
    layers: [{ kind: "skyline", px: 0.06, color: "#7d3d86", color2: "#5a2a73", minH: 170, maxH: 390, night: true, litChance: 0.12, gap: 4 }, { kind: "skyline", px: 0.16, color: "#552464", color2: "#3d1a55", minH: 140, maxH: 340, night: true, litChance: 0.22, gap: 8, neon: NEON }, { kind: "skyline", px: 0.32, color: "#2c1244", color2: "#1d0b33", minH: 110, maxH: 270, night: true, litChance: 0.3, gap: 12, neon: NEON, maxW: 130 }],
    ambient: { kind: "dust", n: 20, color: "#ffd7b0" }, below: "#1d0b33",
  },
  city_night: {
    sky: [[0, "#06041a"], [0.5, "#150b3c"], [1, "#3a1a66"]], moon: { x: 0.8, y: 0.16, r: 30, c: "#f5f0ff" }, stars: 70, clouds: null,
    layers: [{ kind: "skyline", px: 0.06, color: "#2a2060", color2: "#1b1448", minH: 190, maxH: 420, night: true, litChance: 0.22, gap: 4 }, { kind: "skyline", px: 0.16, color: "#1d1650", color2: "#120d38", minH: 150, maxH: 360, night: true, litChance: 0.3, gap: 8, neon: NEON }, { kind: "skyline", px: 0.32, color: "#110c33", color2: "#0a0724", minH: 120, maxH: 280, night: true, litChance: 0.36, gap: 12, neon: NEON, maxW: 130 }],
    ambient: { kind: "rain", n: 0, color: "#a9b7ff" }, below: "#0a0724",
  },
  city_rain: {
    sky: [[0, "#0a0d24"], [0.6, "#1b2250"], [1, "#2f3a72"]], clouds: { n: 5, y: [0.02, 0.28], c: "#2c3566", s: "#1d2450" },
    layers: [{ kind: "skyline", px: 0.06, color: "#2b3566", color2: "#1d2650", minH: 200, maxH: 430, night: true, litChance: 0.2, gap: 4 }, { kind: "skyline", px: 0.16, color: "#1c2450", color2: "#121a3c", minH: 150, maxH: 360, night: true, litChance: 0.3, gap: 8, neon: NEON }, { kind: "skyline", px: 0.32, color: "#10163a", color2: "#090d28", minH: 120, maxH: 290, night: true, litChance: 0.36, gap: 12, neon: NEON, maxW: 130 }],
    ambient: { kind: "rain", n: 130, color: "#b9c6ff" }, below: "#090d28",
  },
  harbor: {
    sky: [[0, "#2b3d7a"], [0.55, "#e0788a"], [1, "#ffcb8a"]], sun: { x: 0.25, y: 0.58, r: 54, c: "#ffe9b5" }, clouds: { n: 4, y: [0.08, 0.4], c: "#ffb4a0", s: "#c1607a" },
    layers: [{ kind: "skyline", px: 0.06, color: "#8a5a8a", color2: "#6a416f", minH: 120, maxH: 260, night: true, litChance: 0.15 }, { kind: "cranes", px: 0.18, color: "#3a2756", count: 3 }, { kind: "waves", px: 0.3, base: 0.86, amp: 8, color: "#2a3f7a", color2: "#1b2b5c" }],
    ambient: { kind: "dust", n: 14, color: "#ffe9d0" }, below: "#1b2b5c",
  },
  sewer: {
    sky: [[0, "#0b1a1c"], [1, "#16363a"]], clouds: null,
    layers: [{ kind: "pillars", px: 0.1, count: 7, amp: 500, color: "#1e4a4f" }, { kind: "pipes", px: 0.22, count: 3, color: "#2b6a62", drips: "#7dffc0" }, { kind: "pillars", px: 0.45, count: 5, amp: 540, color: "#133335" }],
    ambient: { kind: "motes", n: 36, color: "#8fffd0" }, below: "#0b1a1c",
  },
  factory: {
    sky: [[0, "#1b1b2e"], [0.6, "#3a2c46"], [1, "#6e4a4a"]], clouds: { n: 4, y: [0.05, 0.3], c: "#4a3d55", s: "#2d2438" },
    layers: [{ kind: "skyline", px: 0.08, color: "#3e3250", color2: "#2c2340", minH: 160, maxH: 320, night: true, litChance: 0.15, windows: ["#ff9a4a", "#ffd98a"] }, { kind: "pipes", px: 0.24, count: 4, color: "#4d4058" }, { kind: "pillars", px: 0.42, count: 6, amp: 520, color: "#2a2038" }],
    ambient: { kind: "embers", n: 40, color: "#ff9a4a" }, below: "#2a2038",
  },
  ruins: {
    sky: [[0, "#e07a5f"], [0.5, "#f2cc8f"], [1, "#fff3d6"]], sun: { x: 0.65, y: 0.3, r: 50, c: "#fffbe0" }, clouds: { n: 3, y: [0.05, 0.3], c: "#fff3de", s: "#f2cc8f" },
    layers: [{ kind: "mountains", px: 0.06, base: 0.78, amp: 120, count: 4, color: "#d9a46a", color2: "#c58a52" }, { kind: "pillars", px: 0.22, count: 8, amp: 330, color: "#cdb48a" }, { kind: "dunes", px: 0.42, base: 0.94, amp: 22, color: "#d9b27a", color2: "#c29655" }],
    ambient: { kind: "dust", n: 26, color: "#ffe9c4" }, below: "#c29655",
  },
  space: {
    sky: [[0, "#05031a"], [0.5, "#150a3d"], [1, "#2a1060"]], stars: 140, clouds: null,
    layers: [{ kind: "crystals", px: 0.06, count: 4, amp: 100, colors: ["#7c5cff", "#ff3ea5"] }],
    ambient: { kind: "streaks", n: 40, color: "#cfd8ff" }, below: "#05031a",
  },
  dungeon: {
    sky: [[0, "#120d1d"], [1, "#241a38"]], clouds: null,
    layers: [{ kind: "pillars", px: 0.12, count: 6, amp: 520, color: "#3a2f55" }, { kind: "pillars", px: 0.32, count: 5, amp: 540, color: "#2a2142" }],
    ambient: { kind: "motes", n: 30, color: "#ffbf7a" }, below: "#120d1d",
  },
  candy: {
    sky: [[0, "#ff9ad5"], [0.5, "#ffd0ea"], [1, "#fff0c8"]], clouds: { n: 7, y: [0.05, 0.5], c: "#ffffff", s: "#ffc1e3" },
    layers: [{ kind: "hills", px: 0.08, base: 0.62, amp: 50, color: "#ffb3dd", color2: "#ff9ccf" }, { kind: "hills", px: 0.22, base: 0.78, amp: 50, color: "#c9a8ff", color2: "#b189f5", trees: 10, treeKind: "round" }, { kind: "hills", px: 0.4, base: 0.92, amp: 34, color: "#9ee8c8", color2: "#7fd6b0", trees: 7, treeKind: "round", treeScale: 1.3 }],
    ambient: { kind: "sparkles", n: 36, color: "#ffffff" }, below: "#7fd6b0",
  },
};

// ---- ambient weather ----------------------------------------------------------------------------------------------------------
function ambientDraw(g, A, t, w, h, camX, camY, seed) {
  if (!A || !A.n) return;
  const r = rng(seed + 7); g.save();
  for (let i = 0; i < A.n; i++) {
    const a = r(), b = r(), c = r(), d = r(); let x, y;
    switch (A.kind) {
      case "rain": { x = ((a * (w + 200) - t * 80 * (0.7 + c) - camX * 0.5) % (w + 200) + w + 200) % (w + 200) - 100; y = ((b * h + t * 780 * (0.7 + c)) % (h + 40)) - 20; g.strokeStyle = rgba(A.color, 0.35 + c * 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 14 + c * 8); g.stroke(); break; }
      case "snow": { x = (((a * w + Math.sin(t * 0.8 + d * 9) * 24 - camX * 0.25 * (0.4 + c)) % w) + w) % w; y = (b * h + t * (30 + c * 50)) % h; g.fillStyle = rgba(A.color, 0.5 + c * 0.4); g.beginPath(); g.arc(x, y, 1.2 + c * 2.2, 0, TAU); g.fill(); break; }
      case "embers": { x = (((a * w + Math.sin(t * 1.2 + d * 9) * 18 - camX * 0.3) % w) + w) % w; y = h - ((b * h + t * (30 + c * 70)) % h); const al = Math.min(1, y / 120) * (0.4 + 0.5 * Math.sin(t * 5 + d * 20) ** 2); g.globalCompositeOperation = "lighter"; g.fillStyle = rgba(A.color, al); g.beginPath(); g.arc(x, y, 1 + c * 2, 0, TAU); g.fill(); g.globalCompositeOperation = "source-over"; break; }
      case "fireflies": case "motes": case "sparkles": { x = (((a * w + Math.sin(t * 0.4 + d * 12) * 40 - camX * 0.35) % w) + w) % w; y = b * h * 0.9 + Math.sin(t * 0.6 + c * 12) * 22; const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (A.kind === "sparkles" ? 2.4 : 1.1) + d * 30)); g.globalCompositeOperation = "lighter"; g.fillStyle = rgba(A.color, tw * (A.kind === "motes" ? 0.5 : 0.85)); g.beginPath(); g.arc(x, y, (A.kind === "sparkles" ? 1.6 : 2) + c * 1.5, 0, TAU); g.fill(); if (A.kind !== "motes") { g.fillStyle = rgba(A.color, tw * 0.18); g.beginPath(); g.arc(x, y, 7 + c * 4, 0, TAU); g.fill(); } g.globalCompositeOperation = "source-over"; break; }
      case "petals": { x = (((a * w + t * (14 + c * 20) - camX * 0.3) % w) + w) % w; y = (b * h * 0.9 + Math.sin(t * 1.1 + d * 9) * 20 + t * 8) % (h * 0.95); g.fillStyle = rgba(A.color, 0.55); g.save(); g.translate(x, y); g.rotate(t * 1.5 + d * 6); g.beginPath(); g.ellipse(0, 0, 3.6, 1.8, 0, 0, TAU); g.fill(); g.restore(); break; }
      case "dust": { x = (((a * w + t * (8 + c * 14) - camX * 0.45) % w) + w) % w; y = b * h * 0.85 + Math.sin(t * 0.5 + d * 9) * 12; g.fillStyle = rgba(A.color, 0.22 + c * 0.2); g.beginPath(); g.arc(x, y, 1 + c * 1.6, 0, TAU); g.fill(); break; }
      case "streaks": { x = (((a * w - t * (180 + c * 380) - camX * 0.6) % w) + w) % w; y = b * h; g.strokeStyle = rgba(A.color, 0.15 + c * 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 + c * 40, y); g.stroke(); break; }
      default: break;
    }
  }
  g.restore();
}

export class Backdrop {
  constructor(name = "meadow", seed = 1, override = null) {
    this.name = name; this.seed = seed; this.def = { ...(THEMES[name] || THEMES.meadow), ...(override || {}) };
    const r = rng(seed * 131 + 7); this.tiles = [];
    for (const L of this.def.layers) {
      const h = L.kind === "stalactites" ? 520 : 540, c = makeCanvas(TILE_W * S, h * S), g = c.getContext("2d"); g.scale(S, S);
      PAINT[L.kind] && PAINT[L.kind](g, TILE_W, h, L, rng(Math.floor(r() * 1e9)));
      this.tiles.push({ c, L, h });
    }
    this.cloudSeed = rng(seed + 3);
    this.clouds = this.def.clouds ? Array.from({ length: this.def.clouds.n }, () => ({ x: this.cloudSeed() * 2400, y: lerp(this.def.clouds.y[0], this.def.clouds.y[1], this.cloudSeed()), s: 0.6 + this.cloudSeed() * 0.9, v: 4 + this.cloudSeed() * 8, px: 0.04 + this.cloudSeed() * 0.07 })) : [];
    this.stars = this.def.stars ? Array.from({ length: this.def.stars }, () => ({ x: this.cloudSeed(), y: this.cloudSeed() * 0.8, s: 0.5 + this.cloudSeed() * 1.6, p: this.cloudSeed() * 9 })) : [];
    this.skyCanvas = null; this.skyKey = "";
  }
  // w,h = view size in logical px; camX/camY = camera position in the world
  draw(g, camX, camY, t, w = 960, h = 540, opts = {}) {
    const D = this.def;
    g.fillStyle = lin(g, 0, 0, 0, h, D.sky.map(([o, c]) => [o, c])); g.fillRect(0, 0, w, h);
    if (D.sun) glow(g, w * D.sun.x, h * D.sun.y, D.sun.r * 3.2, D.sun.c, 0.5), circle(g, w * D.sun.x, h * D.sun.y, D.sun.r, D.sun.c);
    if (D.moon) { glow(g, w * D.moon.x, h * D.moon.y, D.moon.r * 3, "#9fb4ff", 0.35); circle(g, w * D.moon.x, h * D.moon.y, D.moon.r, D.moon.c); g.fillStyle = "rgba(120,130,190,.28)"; for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.45, 0.16]]) { g.beginPath(); g.arc(w * D.moon.x + cx * D.moon.r, h * D.moon.y + cy * D.moon.r, cr * D.moon.r, 0, TAU); g.fill(); } }
    if (this.stars.length) { g.fillStyle = "#fff"; for (const s of this.stars) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + s.p)); g.fillRect(s.x * w, s.y * h, s.s, s.s); } g.globalAlpha = 1; }
    const cy = opts.camYFactor ?? 0.3;
    for (const c of this.clouds) { const x = (((c.x + t * c.v - camX * c.px) % (w + 300)) + w + 300) % (w + 300) - 150; cloud(g, x, c.y * h - camY * c.px * cy, c.s, D.clouds.c, D.clouds.s); }
    for (const { c, L, h: th } of this.tiles) {
      const off = -(((camX * L.px) % TILE_W) + TILE_W) % TILE_W; const yy = h - th + (L.kind === "stalactites" ? 0 : 0) - camY * L.px * cy;
      const top = L.kind === "stalactites" ? -camY * L.px * cy : yy;
      for (let x = off; x < w; x += TILE_W) g.drawImage(c, x, top, TILE_W, th);
      if (L.kind !== "stalactites" && top + th < h) { g.fillStyle = D.below || "#000"; g.fillRect(0, top + th - 1, w, h - top - th + 2); }
    }
    ambientDraw(g, D.ambient && D.ambient.kind === "rain" && !D.ambient.n ? { ...D.ambient, n: 90 } : D.ambient, t, w, h, camX, camY, this.seed);
  }
}
export const THEME_NAMES = Object.keys(THEMES);
