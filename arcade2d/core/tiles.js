// Draws a TileMap with a chosen look. Every tile picture is painted once into a small canvas and then stamped.
import { hash2, shade, mix, rgba, rng } from "./util";
import { rr, cached, stamp, OUT, lin, text, FONT_DISPLAY, star, poly } from "./draw";

const P = { // palettes: top, top2 (cap shade), a, b (body gradient), spec (speckle), line (mortar/edge)
  meadow: { top: "#62d95c", top2: "#3fae43", a: "#a8714a", b: "#7c4f31", spec: "#5f3a22", pebble: "#c99a6b" },
  cave: { top: "#8f7bff", top2: "#6149d6", a: "#46347f", b: "#2e2160", spec: "#1d1448", pebble: "#6e5bc4" },
  sky: { top: "#ffffff", top2: "#e3d2ff", a: "#f4eaff", b: "#d9c4f7", spec: "#c4a8ee", pebble: "#ffffff" },
  volcano: { top: "#ff8a2a", top2: "#d9461b", a: "#4b2a30", b: "#2e1519", spec: "#1a0a0d", pebble: "#6a3b44" },
  snow: { top: "#ffffff", top2: "#cfe3ff", a: "#8aa9d8", b: "#6785b8", spec: "#516a9c", pebble: "#c1d6f6" },
  desert: { top: "#ffd98a", top2: "#e8b45c", a: "#e0a65e", b: "#c1823c", spec: "#a2652a", pebble: "#f3c98a" },
  city: { top: "#7d8bb5", top2: "#5c6a95", a: "#4a5478", b: "#343c5c", spec: "#262c47", pebble: "#6a769e" },
  candy: { top: "#ff9ad5", top2: "#f06fb6", a: "#c9a8ff", b: "#a98af0", spec: "#8e6ee0", pebble: "#e4d4ff" },
  forest: { top: "#5fd35a", top2: "#3a9f4a", a: "#8a5a3a", b: "#6a432a", spec: "#4a2e1c", pebble: "#b98a60" },
};
export const TILE_THEMES = Object.keys(P);

function blockPath(g, s, mask, r = 9) { // rounded only where two exposed sides meet
  const t = !(mask & 1), rt = !(mask & 2), b = !(mask & 4), l = !(mask & 8);
  const tl = t && l ? r : 0, tr = t && rt ? r : 0, br = b && rt ? r : 0, bl = b && l ? r : 0;
  g.beginPath(); g.moveTo(tl, 0); g.lineTo(s - tr, 0); tr ? g.quadraticCurveTo(s, 0, s, tr) : g.lineTo(s, 0); g.lineTo(s, s - br); br ? g.quadraticCurveTo(s, s, s - br, s) : g.lineTo(s, s); g.lineTo(bl, s); bl ? g.quadraticCurveTo(0, s, 0, s - bl) : g.lineTo(0, s); g.lineTo(0, tl); tl ? g.quadraticCurveTo(0, 0, tl, 0) : g.lineTo(0, 0); g.closePath();
}
function edges(g, s, mask) { // dark outline on exposed edges only
  g.strokeStyle = OUT; g.lineWidth = 3; g.lineCap = "round";
  g.beginPath(); if (!(mask & 1)) { g.moveTo(0, 1.5); g.lineTo(s, 1.5); } if (!(mask & 2)) { g.moveTo(s - 1.5, 0); g.lineTo(s - 1.5, s); } if (!(mask & 4)) { g.moveTo(0, s - 1.5); g.lineTo(s, s - 1.5); } if (!(mask & 8)) { g.moveTo(1.5, 0); g.lineTo(1.5, s); } g.stroke();
}
function speckles(g, s, pal, seed, n = 7) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const x = r.range(4, s - 4), y = r.range(14, s - 4), rad = r.range(1.2, 3.4); g.fillStyle = rgba(r() < 0.65 ? pal.spec : pal.pebble, r() < 0.65 ? 0.55 : 0.7); g.beginPath(); g.ellipse(x, y, rad * 1.3, rad, r.range(0, 3), 0, Math.PI * 2); g.fill(); }
}

const PAINT = {
  ground(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask); g.clip();
    g.fillStyle = lin(g, 0, 0, 0, s, [[0, pal.a], [1, pal.b]]); g.fillRect(0, 0, s, s);
    speckles(g, s, pal, seed);
    if (!(mask & 1)) { // grass / frosting cap with scalloped lower edge
      g.fillStyle = pal.top; g.fillRect(0, 0, s, 11);
      g.beginPath(); g.moveTo(0, 9); for (let x = 0; x <= s; x += 8) g.quadraticCurveTo(x + 4, 17 + ((x / 8 + seed) % 3), x + 8, 9); g.lineTo(s, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.fillStyle = pal.top2; g.beginPath(); g.moveTo(0, 12); for (let x = 0; x <= s; x += 8) g.quadraticCurveTo(x + 4, 18 + ((x / 8 + seed) % 3), x + 8, 12); g.lineTo(s, 9); for (let x = s; x >= 0; x -= 8) g.quadraticCurveTo(x - 4, 15 + ((x / 8 + seed) % 3), x - 8, 9); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(3, 2, s - 6, 2.5);
    }
    if (!(mask & 8)) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, 0, 4, s); }
    if (!(mask & 2)) { g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(s - 5, 0, 5, s); }
    if (!(mask & 4)) { g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, s - 6, s, 6); }
    g.restore(); blockPath(g, s, mask); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
  stone(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 6); g.clip();
    g.fillStyle = lin(g, 0, 0, s, s, [[0, shade(pal.a, 0.1)], [1, shade(pal.b, -0.05)]]); g.fillRect(0, 0, s, s);
    g.strokeStyle = rgba("#000", 0.28); g.lineWidth = 2; g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.moveTo(s * 0.5 + (seed % 2 ? 8 : -8), 0); g.lineTo(s * 0.5 + (seed % 2 ? 8 : -8), s / 2); g.moveTo(s * 0.25, s / 2); g.lineTo(s * 0.25, s); g.moveTo(s * 0.75, s / 2); g.lineTo(s * 0.75, s); g.stroke();
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(2, 2, s / 2 - 5, 3); g.fillRect(s * 0.25 + 3, s / 2 + 3, s / 4 - 6, 3);
    speckles(g, s, pal, seed, 4);
    g.restore(); blockPath(g, s, mask, 6); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
  brick(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 5); g.clip(); g.fillStyle = "#d8774a"; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 3; r++) { const y = r * (s / 3), off = r % 2 ? s / 4 : 0; for (let c = -1; c < 3; c++) { const x = off + c * (s / 2); g.fillStyle = r % 2 ? "#e0845a" : "#cf6c40"; g.fillRect(x + 1.5, y + 1.5, s / 2 - 3, s / 3 - 3); g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(x + 2, y + 2, s / 2 - 4, 2.5); } }
    g.restore(); blockPath(g, s, mask, 5); g.save(); g.clip(); edges(g, s, 0); g.restore();
  },
  bonus(g, s) {
    rr(g, 1, 1, s - 2, s - 2, 8); g.fillStyle = lin(g, 0, 0, 0, s, [[0, "#ffe27a"], [1, "#f2a40f"]]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(6, 5, s - 12, 4);
    g.fillStyle = "#b8720a"; for (const [x, y] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { g.beginPath(); g.arc(x, y + 1, 2.4, 0, 6.3); g.fill(); }
    star(g, s / 2, s / 2 + 1, 12, "#fff6c9", "#a96a08", 2.5, 5, 0.46);
  },
  used(g, s) {
    rr(g, 1, 1, s - 2, s - 2, 8); g.fillStyle = lin(g, 0, 0, 0, s, [[0, "#9a7f6a"], [1, "#6f5a49"]]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = "#4e3d31"; for (const [x, y] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fill(); }
  },
  plank(g, s, mask, pal) {
    const h = 15; rr(g, 0, 0, s, h, 5); g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#d9a066"], [1, "#a8703a"]]); g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s * 0.33, 2); g.lineTo(s * 0.33, h - 2); g.moveTo(s * 0.66, 2); g.lineTo(s * 0.66, h - 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(4, 3, s - 8, 2);
    g.fillStyle = OUT; g.fillRect(s * 0.1, h, 3, 5); g.fillRect(s * 0.9 - 3, h, 3, 5);
  },
  spikes(g, s, mask, pal) {
    g.fillStyle = "#59506f"; g.fillRect(0, s - 8, s, 8); g.strokeStyle = OUT; g.lineWidth = 2.5; g.strokeRect(1, s - 8, s - 2, 7);
    for (let i = 0; i < 4; i++) { const x = i * (s / 4); poly(g, [[x + 1, s - 8], [x + s / 8, s * 0.38], [x + s / 4 - 1, s - 8]], lin(g, 0, s * 0.38, 0, s - 8, [[0, "#f4f1ff"], [1, "#9d93be"]]), OUT, 2.5); }
  },
  ice(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 7); g.clip(); g.fillStyle = lin(g, 0, 0, s, s, [[0, "#d9f4ff"], [1, "#7fc6ee"]]); g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(8, s - 10); g.lineTo(s - 12, 8); g.moveTo(14, s - 6); g.lineTo(s - 6, 16); g.stroke();
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, 0, s, 8);
    g.restore(); blockPath(g, s, mask, 7); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
  cloud(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 14); g.clip(); g.fillStyle = lin(g, 0, 0, 0, s, [[0, "#ffffff"], [1, "#e0cdf7"]]); g.fillRect(0, 0, s, s);
    g.fillStyle = "rgba(190,150,235,.28)"; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(8 + i * 11 + (seed % 3), s - 4 + (i % 2) * 3, 11, 0, 6.3); g.fill(); }
    g.restore(); blockPath(g, s, mask, 14); g.save(); g.clip(); g.strokeStyle = "#8a62c4"; g.lineWidth = 3; g.stroke(); g.restore();
  },
  steel(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 4); g.clip(); g.fillStyle = lin(g, 0, 0, s, s, [[0, "#8c97b8"], [0.5, "#6e7899"], [1, "#4f5877"]]); g.fillRect(0, 0, s, s);
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(0, 0, s, 4); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, s - 4, s, 4);
    g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 2; g.strokeRect(5, 5, s - 10, s - 10);
    g.fillStyle = "#2d3350"; for (const [x, y] of [[9, 9], [s - 9, 9], [9, s - 9], [s - 9, s - 9]]) { g.beginPath(); g.arc(x, y, 2.3, 0, 6.3); g.fill(); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(x - 1, y - 1.5, 1.4, 1.4); g.fillStyle = "#2d3350"; }
    g.restore(); blockPath(g, s, mask, 4); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
  concrete(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 4); g.clip(); g.fillStyle = lin(g, 0, 0, 0, s, [[0, pal.a], [1, pal.b]]); g.fillRect(0, 0, s, s);
    speckles(g, s, pal, seed, 9);
    g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 1.6; const r = rng(seed * 7 + 1); g.beginPath(); const x0 = r.range(8, s - 8); g.moveTo(x0, 0); g.lineTo(x0 + r.range(-8, 8), s * 0.35); g.lineTo(x0 + r.range(-10, 10), s * 0.6); g.stroke();
    if (!(mask & 1)) { g.fillStyle = pal.top; g.fillRect(0, 0, s, 7); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(0, 0, s, 2.5); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 7, s, 2); }
    g.restore(); blockPath(g, s, mask, 4); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
  crate(g, s) {
    rr(g, 1, 1, s - 2, s - 2, 5); g.fillStyle = lin(g, 0, 0, 0, s, [[0, "#d9a066"], [1, "#a8703a"]]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = "#7a4c22"; g.lineWidth = 4; g.strokeRect(7, 7, s - 14, s - 14); g.beginPath(); g.moveTo(7, 7); g.lineTo(s - 7, s - 7); g.moveTo(s - 7, 7); g.lineTo(7, s - 7); g.stroke();
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(4, 3, s - 8, 3);
  },
  crystal(g, s, mask, pal, seed) {
    g.save(); blockPath(g, s, mask, 8); g.clip(); g.fillStyle = lin(g, 0, 0, s, s, [[0, pal.a], [1, pal.b]]); g.fillRect(0, 0, s, s);
    if (!(mask & 1)) { g.fillStyle = pal.top; g.fillRect(0, 0, s, 8); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(0, 0, s, 3); }
    g.fillStyle = "rgba(255,255,255,.12)"; poly(g, [[6, s - 6], [s * 0.4, s * 0.3], [s * 0.55, s - 6]], "rgba(255,255,255,.1)"); speckles(g, s, pal, seed, 5);
    g.restore(); blockPath(g, s, mask, 8); g.save(); g.clip(); edges(g, s, mask); g.restore();
  },
};

// which painter + palette each map character uses, per look
export const LOOKS = {
  meadow: { "#": ["ground", "meadow"], X: ["stone", "meadow"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
  cave: { "#": ["ground", "cave"], X: ["crystal", "cave"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
  sky: { "#": ["cloud"], X: ["ground", "candy"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
  volcano: { "#": ["ground", "volcano"], X: ["stone", "volcano"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], C: ["crate"], i: ["ice"] },
  snow: { "#": ["ground", "snow"], X: ["stone", "snow"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
  city: { "#": ["concrete", "city"], X: ["steel"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], C: ["crate"], i: ["ice"] },
  forest: { "#": ["ground", "forest"], X: ["stone", "forest"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
  desert: { "#": ["ground", "desert"], X: ["stone", "desert"], B: ["brick"], "?": ["bonus"], u: ["used"], "=": ["plank"], "^": ["spikes"], i: ["ice"] },
};

export function solidMask(map, c, r, family) { // bit 1 = solid above, 2 = right, 4 = below, 8 = left
  const same = (cc, rr) => { const ch = map.ch(cc, rr); return family ? family.includes(ch) : map.solidSet.has(ch); };
  return (same(c, r - 1) ? 1 : 0) | (same(c + 1, r) ? 2 : 0) | (same(c, r + 1) ? 4 : 0) | (same(c - 1, r) ? 8 : 0);
}

export function drawTiles(g, map, cam, look = "meadow", t = 0) {
  const ts = map.ts, L = LOOKS[look] || LOOKS.meadow, c0 = Math.max(0, Math.floor(cam.x / ts)), c1 = Math.min(map.cols - 1, Math.floor((cam.x + cam.w) / ts)), r0 = Math.max(0, Math.floor(cam.y / ts)), r1 = Math.min(map.rows - 1, Math.floor((cam.y + cam.h) / ts));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const ch = map.cells[r][c]; if (ch === ".") continue; const spec = L[ch]; if (!spec) continue;
    const [kind, palName] = spec, pal = P[palName || "meadow"];
    const solidLike = map.solidSet.has(ch) && kind !== "bonus" && kind !== "used" && kind !== "crate" && kind !== "brick";
    const mask = solidLike ? solidMask(map, c, r, [...map.solidSet].filter((k) => L[k] && L[k][0] !== "bonus" && L[k][0] !== "used" && L[k][0] !== "crate" && L[k][0] !== "brick").join("")) : 0;
    const v = Math.floor(hash2(c, r, 5) * 4);
    const key = `${look}|${ch}|${kind}|${mask}|${v}`;
    const spr = cached(key, ts, ts, (gg, w) => PAINT[kind](gg, w, mask, pal, v + 1), 2);
    let y = r * ts; if (ch === "?" && map.bump && map.bump[c + "," + r]) y -= map.bump[c + "," + r];
    stamp(g, spr, c * ts, y, ts, ts);
    if (ch === "?") { g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.12 + 0.1 * Math.sin(t * 4 + c); g.fillStyle = "#fff6c9"; rr(g, c * ts + 3, y + 3, ts - 6, ts - 6, 6); g.fill(); g.restore(); }
  }
}
export { P as TILE_PALETTES, PAINT as TILE_PAINT };
