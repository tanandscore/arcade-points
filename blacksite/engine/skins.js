// Operation Blacksite — wall skins. One tall sheet is stretched over each exposed wall face (2.5 m wide x 6.4 m tall), so it has to carry
// the whole look of a real facade: slow colour drift, fine grit, rain streaks down from the roofline, soot under the eaves, damp creeping up
// from the ground, sun-faded paint patches, hairline cracks, and places where the render has fallen off to show stone or brick underneath.
// Each sheet also gets a bump map (made from its own light/dark, so cracks, chips and mortar catch the sun).
import { fbm2, grit, rngf, rgb, clamp, surfaceFromCanvas } from "./surfaces";
import { cpuCanvas } from "./cpucanvas";

const W = 384, H = 960; // ~150 px per metre
const cv = () => cpuCanvas(W, H);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// irregular blob (a patch of fallen plaster): points once, then a smooth closed path from them
function blobPts(cx, cy, rx, ry, r, n = 13) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.62 + r() * 0.55; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return pts; }
function pathOf(g, pts) {
  const n = pts.length, m = (i) => pts[(i + n) % n]; g.beginPath(); g.moveTo((m(0)[0] + m(n - 1)[0]) / 2, (m(0)[1] + m(n - 1)[1]) / 2);
  for (let i = 0; i < n; i++) { const a = m(i), b = m(i + 1); g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } g.closePath();
}
// a hole in the render: show what is underneath, shade just inside the edge (the render has thickness), catch a thin light on the lip
function chipHole(g, kind, r, cx, cy, rx, ry) {
  const pts = blobPts(cx, cy, rx, ry, r);
  g.save(); pathOf(g, pts); g.clip(); underlay(g, kind, r, [cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6]);
  pathOf(g, pts); g.strokeStyle = "rgba(18,12,8,0.34)"; g.lineWidth = 8; g.stroke(); g.restore();
  pathOf(g, pts); g.strokeStyle = "rgba(255,246,226,0.14)"; g.lineWidth = 1.6; g.stroke();
}
// what shows through where the render has come off
function underlay(g, kind, r, box) {
  const [x0, y0, w, h] = box;
  if (kind === "brick") {
    g.fillStyle = "#4e443c"; g.fillRect(x0, y0, w, h);
    const bh = 15; for (let y = Math.floor(y0 / bh) * bh; y < y0 + h; y += bh) { const off = ((y / bh) % 2) * 24; for (let x = Math.floor(x0 / 48) * 48 - off; x < x0 + w; x += 48) { const t = 0.75 + r() * 0.5; g.fillStyle = `rgb(${(108 * t) | 0},${(82 * t) | 0},${(70 * t) | 0})`; g.fillRect(x + 1.5, y + 1.5, 45, bh - 3); } }
  } else {
    g.fillStyle = "#6a6050"; g.fillRect(x0, y0, w, h);
    const bh = 36; for (let y = Math.floor(y0 / bh) * bh; y < y0 + h; y += bh) { const off = ((y / bh) % 2) * 50; for (let x = Math.floor(x0 / 100) * 100 - off; x < x0 + w; x += 100) { const t = 0.8 + r() * 0.4; g.fillStyle = `rgb(${(150 * t) | 0},${(134 * t) | 0},${(108 * t) | 0})`; g.fillRect(x + 2, y + 2, 96, bh - 4); } }
  }
}

function crackLine(g, r, x, y, len, dir) {
  let cx = x, cy = y, a = dir;
  g.beginPath(); g.moveTo(cx, cy);
  const pts = [[cx, cy]];
  for (let i = 0; i < len; i++) { a += (r() - 0.5) * 0.9; cx += Math.cos(a) * (3 + r() * 5); cy += Math.sin(a) * (3 + r() * 5); pts.push([cx, cy]); g.lineTo(cx, cy); }
  g.strokeStyle = "rgba(34,26,20,0.62)"; g.lineWidth = 1 + r() * 0.9; g.stroke();
  g.beginPath(); g.moveTo(pts[0][0] + 1.2, pts[0][1]); for (const p of pts) g.lineTo(p[0] + 1.2, p[1]); g.strokeStyle = "rgba(255,248,232,0.14)"; g.lineWidth = 1; g.stroke();
  if (r() < 0.5 && pts.length > 6) { const q = pts[Math.floor(pts.length * 0.5)]; crackLine(g, r, q[0], q[1], Math.floor(len * 0.45), a + (r() < 0.5 ? 0.9 : -0.9)); }
}

// one facade sheet. kind: "bazaar" | "harbor" | "quarter"; variant picks the style (0..4)
export function wallSkin(seed, baseHex, kind, variant = 0) {
  const r = rngf(seed * 7 + 3), base = rgb(baseHex), c = cv(), g = c.getContext("2d");
  // ---- 1. colour drift, fine grit, rain streaks, soot, rising damp (per pixel) ----------------------------------------------------------
  const lo = fbm2(W, H, seed, 3, 7, 3), mid = fbm2(W, H, seed + 4, 10, 25, 3, 0.55), wash = fbm2(W, H, seed + 9, 38, 2, 2, 0.6), gr = grit(W, H, seed + 13, 0.3), blot = fbm2(W, H, seed + 21, 4, 9, 3);
  const im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) {
    const yy = y / H, damp = clamp((yy - 0.84) / 0.16), soot = clamp((0.1 - yy) / 0.1), salt = Math.abs(yy - 0.835) < 0.006 ? 1.08 : 1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4; let k = 0.93 + (lo[i] - 0.5) * 0.3 + (mid[i] - 0.5) * 0.2 + (gr[i] - 0.5) * 0.13;
      k *= 1 - clamp((wash[i] - 0.52) * 2.6) * 0.2 * (0.35 + 0.65 * (1 - yy)); // rain washing down
      k *= 1 - damp * (0.22 + 0.3 * mid[i]); k *= 1 - soot * 0.18; k *= salt; k *= 1 - clamp((blot[i] - 0.6) * 2.2) * 0.14; // stains
      const warm = (lo[i] - 0.5) * 0.06;
      d[p] = base[0] * k * (1 + warm); d[p + 1] = base[1] * k; d[p + 2] = base[2] * k * (1 - warm); d[p + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const tone = (k, a) => css(mul(base, k), a);

  if (kind === "bazaar") {
    // ---- cut sandstone: full ashlar, a stone plinth under rendered wall, or rendered wall with holes --------------------------------------
    const mode = variant % 3; const courseH = 76;
    const ashlar = (yTop, yBot) => {
      for (let y = yTop; y < yBot; y += courseH) {
        const off = r() * 120, row = Math.round(y / courseH);
        for (let x = -off; x < W; ) {
          const bw = 116 + r() * 96; const t = (r() - 0.5);
          g.fillStyle = t > 0 ? `rgba(255,244,216,${t * 0.16})` : `rgba(60,44,28,${-t * 0.22})`; g.fillRect(x, y, bw, courseH);
          g.fillStyle = "rgba(48,36,24,0.55)"; g.fillRect(x, y, 2.4, courseH); g.fillRect(x, y, bw, 2.4); g.fillStyle = "rgba(255,246,222,0.2)"; g.fillRect(x + 2.4, y + 2.4, bw, 1.6); // joint + chamfer light
          for (let q = 0; q < 14; q++) { g.fillStyle = r() < 0.5 ? "rgba(60,44,28,0.14)" : "rgba(255,246,222,0.12)"; g.fillRect(x + 4 + r() * (bw - 8), y + 4 + r() * (courseH - 8), 2 + r() * 8, 1 + r() * 5); }
          x += bw;
        }
      }
    };
    if (mode === 0) ashlar(0, H); else if (mode === 1) { const top = Math.floor(H * (0.5 + r() * 0.14) / courseH) * courseH; ashlar(top, H); const ge = g.createLinearGradient(0, top - 22, 0, top + 6); ge.addColorStop(0, "rgba(40,30,20,0)"); ge.addColorStop(1, "rgba(40,30,20,0.34)"); g.fillStyle = ge; g.fillRect(0, top - 22, W, 28); g.fillStyle = "rgba(255,246,222,0.22)"; g.fillRect(0, top - 2, W, 2.5); }
    else { for (let i = 0; i < 3; i++) chipHole(g, "stone", r, r() * W, H * (0.5 + r() * 0.45), 28 + r() * 46, 24 + r() * 52); }
  } else if (kind === "harbor") {
    // ---- painted concrete panels, brick, corrugated sheet ---------------------------------------------------------------------------------
    const mode = variant % 5;
    if (mode === 3) { g.fillStyle = "rgba(0,0,0,0.0)"; const bh = 15; for (let y = 0; y < H; y += bh) { const off = ((y / bh) % 2) * 24; for (let x = -off; x < W; x += 48) { const t = (r() - 0.5); g.fillStyle = t > 0 ? `rgba(255,220,200,${t * 0.2})` : `rgba(20,8,4,${-t * 0.3})`; g.fillRect(x + 1.5, y + 1.5, 45, bh - 3); } g.fillStyle = "rgba(30,24,20,0.5)"; g.fillRect(0, y, W, 1.8); for (let x = -off; x < W; x += 48) g.fillRect(x, y, 1.8, bh); } }
    else if (mode === 2 || mode === 4) { for (let x = 0; x < W; x += 10) { g.fillStyle = (x / 10) % 2 ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.12)"; g.fillRect(x, 0, 5, H); g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x + 5, 0, 1.4, H); } for (let k = 0; k < 6; k++) { const cx = r() * W, cy = H * (0.4 + r() * 0.55); const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 34 + r() * 40); gr.addColorStop(0, "rgba(120,60,28,0.55)"); gr.addColorStop(1, "rgba(120,60,28,0)"); g.fillStyle = gr; g.fillRect(cx - 80, cy - 80, 160, 160); } }
    else { // poured panels with seams and tie-holes
      g.fillStyle = "rgba(20,20,20,0.5)"; for (let y = 320; y < H; y += 320) g.fillRect(0, y, W, 2.6); g.fillRect(W / 2 - 1.3, 0, 2.6, H); g.fillStyle = "rgba(255,255,255,0.1)"; for (let y = 320; y < H; y += 320) g.fillRect(0, y + 2.6, W, 1.6);
      for (let y = 80; y < H; y += 160) for (let x = 48; x < W; x += 96) { g.fillStyle = "rgba(20,20,22,0.55)"; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.arc(x + 0.8, y + 0.8, 3.2, 0.3, 3.4); g.stroke(); }
    }
    // safety band along the foot, scuffed
    const by = H - 118; g.fillStyle = "rgba(214,170,30,0.9)"; g.fillRect(0, by, W, 30); g.fillStyle = "rgba(24,24,24,0.9)"; for (let x = -30; x < W + 30; x += 44) { g.beginPath(); g.moveTo(x, by + 30); g.lineTo(x + 22, by + 30); g.lineTo(x + 44, by); g.lineTo(x + 22, by); g.fill(); }
    const fade = g.createLinearGradient(0, by - 4, 0, H); fade.addColorStop(0, "rgba(30,26,22,0)"); fade.addColorStop(1, "rgba(30,26,22,0.45)"); g.fillStyle = fade; g.fillRect(0, by - 4, W, H - by + 4);
    for (let k = 0; k < 90; k++) { g.fillStyle = r() < 0.5 ? "rgba(30,26,22,0.35)" : "rgba(235,215,150,0.35)"; g.fillRect(r() * W, by + r() * 30, 2 + r() * 8, 1 + r() * 2); }
  } else {
    // ---- warm rendered plaster, chipped to the brick; a painted plinth ------------------------------------------------------------------
    const nChips = 2 + (variant % 3);
    for (let i = 0; i < nChips; i++) chipHole(g, "brick", r, r() * W, H * (0.5 + r() * 0.45), 18 + r() * 40, 16 + r() * 44);
    const py = H - 150; g.fillStyle = css(mul(base, 0.72), 0.55); g.fillRect(0, py, W, 150); g.fillStyle = "rgba(30,22,16,0.4)"; g.fillRect(0, py, W, 2.6); g.fillStyle = "rgba(255,244,224,0.2)"; g.fillRect(0, py + 2.6, W, 1.8);
    const ftop = g.createLinearGradient(0, H - 150, 0, H); ftop.addColorStop(0, "rgba(40,28,20,0)"); ftop.addColorStop(1, "rgba(40,28,20,0.36)"); g.fillStyle = ftop; g.fillRect(0, py, W, 150);
  }
  // ---- sun-faded / re-painted patches, cracks ---------------------------------------------------------------------------------------------
  for (let i = 0; i < 2 + (variant % 3); i++) { const x = r() * W * 0.8, y = r() * H * 0.6, w = 70 + r() * 150, h = 80 + r() * 240; const k = r() < 0.5 ? 1.1 : 0.88; g.fillStyle = tone(k, 0.16 + r() * 0.1); g.fillRect(x, y, w, h); g.fillStyle = "rgba(30,24,18,0.07)"; g.fillRect(x, y + h - 2, w, 2); }
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) crackLine(g, r, r() * W, r() * H * 0.6, 14 + Math.floor(r() * 16), Math.PI / 2 + (r() - 0.5) * 1.2);
  // a few bullet pocks / chips in the plaster at shoulder height
  for (let i = 0; i < 9; i++) { const x = r() * W, y = H * (0.38 + r() * 0.5), s = 2.2 + r() * 3.4; g.fillStyle = "rgba(34,26,20,0.55)"; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.fillStyle = "rgba(255,246,226,0.25)"; g.beginPath(); g.arc(x - 0.6, y - s * 0.9, s * 0.8, 0, 7); g.fill(); g.fillStyle = "rgba(20,14,10,0.7)"; g.beginPath(); g.arc(x, y, s * 0.55, 0, 7); g.fill(); }
  // gradients at the very top and bottom so every sheet seats into the ground and roofline
  const gb = g.createLinearGradient(0, H - 70, 0, H); gb.addColorStop(0, "rgba(46,34,24,0)"); gb.addColorStop(1, "rgba(46,34,24,0.4)"); g.fillStyle = gb; g.fillRect(0, H - 70, W, 70);
  const gt = g.createLinearGradient(0, 0, 0, 80); gt.addColorStop(0, "rgba(30,24,16,0.26)"); gt.addColorStop(1, "rgba(30,24,16,0)"); g.fillStyle = gt; g.fillRect(0, 0, W, 80);
  return surfaceFromCanvas(c, { strength: 2.4, rough: 0.94 });
}
