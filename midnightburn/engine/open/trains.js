// Midnight Burn — metro and bullet-train cars. Everything is built in code:
//  * a car body that is a real shaped tube (skirt, straight walls, rounded shoulders, a crowned roof), not a box
//  * one painted side map per kind of train: stainless panels, door leaves with their own windows, tinted window glass with a
//    sky reflection, destination boards, grime, rain streaks; a matching "lights on" map that lights the cabins from inside
//  * a cab nose (the metro's raked windscreen, the bullet train's long beak with a dark visor) with its own painted front
//  * bogies, wheels, underframe boxes, roof air-conditioners and a pantograph merged into one dark-metal mesh per car
// The line colour is not painted: it is a vertex colour on the livery stripe, so one texture serves every line.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry } from "./geo";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function tex(c, srgb = true, aniso = 16) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }

// sizes (metres). y is measured in the car's own frame; the rail is at `rail` (the render code puts the car that far above the track)
export const SPEC = {
  metro: { CL: 17.6, CW: 2.9, CH: 3.1, ybot: -1.45, rail: -2.0, Ln: 1.5, doors: 4, spacing: 18.4 },
  fast: { CL: 25, CW: 3.35, CH: 3.5, ybot: -1.6, rail: -2.3, Ln: 9.5, doors: 2, spacing: 25.6 },
};
const W = 2048, H = 512, WALLH = 384;           // side map: the wall in rows 0..384, the roof strip lower down
const NOSE = 512;                              // nose map: a front view of the cab

// ---------------------------------------------------------------------------------------------------------------------------------
//  textures
// ---------------------------------------------------------------------------------------------------------------------------------
function sideTextures(kind) {
  const S = SPEC[kind], fast = kind === "fast", rnd = mulberry(fast ? 91 : 71);
  const col = cv(W, H), em = cv(W / 2, H / 2), a = col.getContext("2d"), b = em.getContext("2d"); b.scale(0.5, 0.5);
  const pxm = W / S.CL, wallM = S.CH - 0.12, ypm = WALLH / wallM;
  const Y = (yAbove) => WALLH - yAbove * ypm;                 // metres above the skirt -> row
  // ---- body panels
  const bg = a.createLinearGradient(0, 0, 0, WALLH);
  if (fast) { bg.addColorStop(0, "#eef1f4"); bg.addColorStop(0.6, "#f6f8fa"); bg.addColorStop(1, "#dfe3e8"); } else { bg.addColorStop(0, "#c9ced5"); bg.addColorStop(0.5, "#dde1e6"); bg.addColorStop(1, "#bfc4cb"); }
  a.fillStyle = bg; a.fillRect(0, 0, W, H); b.fillStyle = "#000"; b.fillRect(0, 0, W, H);
  // brushed-steel grain on the metro, long soft panel gaps on both
  if (!fast) for (let i = 0; i < 2600; i++) { const v = 150 + rnd() * 90 | 0; a.fillStyle = `rgba(${v},${v},${v + 4},0.1)`; a.fillRect(rnd() * W, rnd() * WALLH, 40 + rnd() * 220, 1); }
  for (let i = 1; i < (fast ? 6 : 8); i++) { const x = (i / (fast ? 6 : 8)) * W + (rnd() - 0.5) * 8; a.fillStyle = "rgba(40,44,52,0.28)"; a.fillRect(x, 0, 2, WALLH); a.fillStyle = "rgba(255,255,255,0.4)"; a.fillRect(x + 2, 0, 1.5, WALLH); }
  // ---- skirt (underframe cover)
  a.fillStyle = "#23262b"; a.fillRect(0, Y(0.2), W, WALLH - Y(0.2)); a.fillStyle = "rgba(255,255,255,0.18)"; a.fillRect(0, Y(0.2), W, 2);
  // ---- window + door helper
  const glass = (x, y, w, h, lit, seed) => {
    a.fillStyle = "#101216"; rr(a, x - 5, y - 5, w + 10, h + 10, 12); a.fill();                    // rubber gasket
    const g = a.createLinearGradient(x, y, x + w * 0.7, y + h); g.addColorStop(0, "#38506a"); g.addColorStop(0.45, "#1a2535"); g.addColorStop(1, "#0f1620"); a.fillStyle = g; rr(a, x, y, w, h, 9); a.fill();
    a.save(); rr(a, x, y, w, h, 9); a.clip(); a.fillStyle = "rgba(190,215,245,0.22)"; a.beginPath(); a.moveTo(x - 6, y + h); a.lineTo(x + w * 0.38, y); a.lineTo(x + w * 0.58, y); a.lineTo(x + w * 0.1, y + h); a.fill();
    a.fillStyle = "rgba(190,215,245,0.1)"; a.beginPath(); a.moveTo(x + w * 0.62, y + h); a.lineTo(x + w * 0.92, y); a.lineTo(x + w, y); a.lineTo(x + w, y + h * 0.4); a.lineTo(x + w * 0.8, y + h); a.fill(); a.restore();
    a.fillStyle = "rgba(10,10,12,0.3)"; a.fillRect(x, y + h - 6, w, 6);
    if (lit) { // the cabin seen from outside: ceiling lights, a bright wall opposite, strap-hangers and the odd passenger
      const ig = b.createLinearGradient(0, y, 0, y + h); ig.addColorStop(0, "#fff8e0"); ig.addColorStop(0.5, "#ffeec0"); ig.addColorStop(1, "#d9b87a"); b.fillStyle = ig; rr(b, x, y, w, h, 9); b.fill();
      b.save(); rr(b, x, y, w, h, 9); b.clip(); b.fillStyle = "rgba(255,255,255,0.95)"; b.fillRect(x, y, w, h * 0.08); b.strokeStyle = "rgba(60,50,40,0.75)"; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y + h * 0.2); b.lineTo(x + w, y + h * 0.2); b.stroke();
      for (let k = 0; k < 3; k++) { const hx = x + w * (0.15 + 0.35 * k + rnd() * 0.15); b.beginPath(); b.moveTo(hx, y + h * 0.2); b.lineTo(hx, y + h * 0.36); b.stroke(); b.beginPath(); b.arc(hx, y + h * 0.4, 5, 0, 7); b.stroke(); }
      const n = rnd() < 0.7 ? 1 + (rnd() * 3 | 0) : 0; for (let k = 0; k < n; k++) { const px = x + w * (0.12 + rnd() * 0.76), hs = h * (0.2 + rnd() * 0.1); b.fillStyle = `rgba(${30 + rnd() * 40 | 0},${24 + rnd() * 30 | 0},${28 + rnd() * 30 | 0},0.9)`; b.beginPath(); b.arc(px, y + h - hs * 1.55, hs * 0.38, 0, 7); b.fill(); rr(b, px - hs * 0.62, y + h - hs * 1.2, hs * 1.24, hs * 1.3, hs * 0.4); b.fill(); }
      b.restore();
      a.fillStyle = "rgba(255,238,200,0.22)"; rr(a, x, y, w, h, 9); a.fill();
    }
  };
  // ---- doors
  const dW = 1.3 * pxm, nD = S.doors, doorX = [];
  for (let i = 0; i < nD; i++) doorX.push(fast ? (i ? 0.84 : 0.16) * W : ((i + 0.5) / nD) * W);
  for (const cx of doorX) {
    const x = cx - dW / 2, y0 = Y(2.45), y1 = Y(0.22);
    a.fillStyle = "#12141a"; a.fillRect(x - 5, y0 - 5, dW + 10, y1 - y0 + 8);                          // door pocket
    for (const lf of [0, 1]) { const lx = x + lf * (dW / 2) + 1.5, lw = dW / 2 - 3; const g = a.createLinearGradient(lx, 0, lx + lw, 0); g.addColorStop(0, fast ? "#e6e9ed" : "#b9bfc7"); g.addColorStop(1, fast ? "#d8dce1" : "#a9b0b8"); a.fillStyle = g; a.fillRect(lx, y0, lw, y1 - y0); a.fillStyle = "rgba(0,0,0,0.25)"; a.fillRect(lx, y1 - 10, lw, 10); glass(lx + lw * 0.18, Y(2.25), lw * 0.64, 1.05 * ypm, rnd() < 0.92, 0); }
    a.fillStyle = "rgba(0,0,0,0.5)"; a.fillRect(cx - 1.2, y0, 2.4, y1 - y0);
    a.fillStyle = "#e8c020"; for (let k = 0; k < 6; k++) a.fillRect(x - 5, y1 - 6 - k * 9, 5, 5); // safety stripe at the door edge
    // door-closed indicator above
    b.fillStyle = "#3dff7a"; b.beginPath(); b.arc(cx, Y(2.58), 4.5, 0, 7); b.fill(); a.fillStyle = "#1f6a3a"; a.beginPath(); a.arc(cx, Y(2.58), 4.5, 0, 7); a.fill();
  }
  // ---- windows between the doors
  if (!fast) {
    for (let i = 0; i <= nD; i++) {
      const xa = i === 0 ? 0.75 * pxm : doorX[i - 1] + dW / 2 + 0.35 * pxm, xb = i === nD ? W - 0.75 * pxm : doorX[i] - dW / 2 - 0.35 * pxm; const span = xb - xa; if (span < 1.1 * pxm) continue;
      const n = Math.max(1, Math.round(span / (1.45 * pxm))), ww = (span - (n - 1) * 0.28 * pxm) / n;
      for (let k = 0; k < n; k++) glass(xa + k * (ww + 0.28 * pxm), Y(2.3), ww, 1.0 * ypm, rnd() < 0.93, k);
    }
  } else {
    for (let x = 0.9 * pxm; x < W - 0.6 * pxm; x += 1.15 * pxm) { if (doorX.some((d) => Math.abs(x + 0.4 * pxm - d) < dW * 0.75)) continue; glass(x, Y(2.62), 0.8 * pxm, 0.62 * ypm, rnd() < 0.95, 0); }
  }
  // ---- destination boards over each door, a roof-line trim
  for (const cx of doorX) { if (fast) continue; a.fillStyle = "#0b0c10"; rr(a, cx - 0.6 * pxm, Y(2.98), 1.2 * pxm, 0.3 * ypm, 5); a.fill(); b.fillStyle = "#06070a"; rr(b, cx - 0.6 * pxm, Y(2.98), 1.2 * pxm, 0.3 * ypm, 5); b.fill(); b.fillStyle = "#ffb43a"; b.font = `bold ${0.19 * ypm | 0}px Arial, sans-serif`; b.textAlign = "center"; b.textBaseline = "middle"; b.fillText("MUMBAI METRO", cx, Y(2.83)); }
  if (fast) { a.fillStyle = "#2a3344"; a.font = `bold ${0.22 * ypm | 0}px Arial, sans-serif`; a.textAlign = "center"; a.textBaseline = "middle"; for (const x of [0.5, 0.93]) a.fillText("BULLET EXPRESS", x * W, Y(0.98)); a.fillStyle = "rgba(60,70,90,0.55)"; a.fillRect(0, Y(2.42), W, 2); }
  // ---- white patch for the livery stripe geometry (vertex-coloured), reserved at the right edge
  a.fillStyle = "#ffffff"; a.fillRect(W - 12, 0, 12, WALLH);
  // ---- weathering: dark streaks below the glass, rain streaks from the roof edge, brake dust and road grime on the skirt, scuffs
  for (let i = 0; i < 160; i++) { const x = rnd() * (W - 20), y = Y(1.2 + rnd() * 1.3), h2 = 30 + rnd() * 140, w2 = 2 + rnd() * 7; const g = a.createLinearGradient(0, y, 0, y + h2); g.addColorStop(0, "rgba(30,28,26,0.0)"); g.addColorStop(0.2, `rgba(30,28,26,${0.1 + rnd() * 0.14})`); g.addColorStop(1, "rgba(30,28,26,0)"); a.fillStyle = g; a.fillRect(x, y, w2, h2); }
  { const g = a.createLinearGradient(0, Y(0.9), 0, Y(0.05)); g.addColorStop(0, "rgba(60,52,44,0)"); g.addColorStop(1, "rgba(60,52,44,0.55)"); a.fillStyle = g; a.fillRect(0, Y(0.9), W - 12, Y(0.05) - Y(0.9)); }
  for (let i = 0; i < 90; i++) { a.fillStyle = `rgba(20,20,22,${0.08 + rnd() * 0.18})`; a.fillRect(rnd() * (W - 20), Y(0.3 + rnd() * 2.2), 4 + rnd() * 30, 1 + rnd() * 2); }
  // ---- roof strip (rows 400..512)
  const rg = a.createLinearGradient(0, 400, 0, H); rg.addColorStop(0, "#9aa1aa"); rg.addColorStop(1, "#7f868f"); a.fillStyle = rg; a.fillRect(0, 400, W, H - 400);
  for (let i = 0; i < 1400; i++) { const v = 120 + rnd() * 60 | 0; a.fillStyle = `rgba(${v},${v},${v + 4},0.18)`; a.fillRect(rnd() * W, 400 + rnd() * 112, 6 + rnd() * 50, 1 + rnd() * 3); }
  for (let i = 0; i < 12; i++) { const x = (i / 12) * W; a.fillStyle = "rgba(20,22,26,0.4)"; a.fillRect(x, 400, 2, 112); }
  a.fillStyle = "rgba(255,255,255,0.1)"; a.fillRect(0, 400, W, 3);
  // slight dither so big flat areas don't band
  const im = a.getImageData(0, 0, W, H), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 8; d[i] += n; d[i + 1] += n; d[i + 2] += n; } a.putImageData(im, 0, 0);
  return { map: tex(col), em: tex(em, true, 8) };
}

function noseTextures(kind) {
  const S = SPEC[kind], fast = kind === "fast", rnd = mulberry(fast ? 191 : 171), N = NOSE;
  const col = cv(N, N), em = cv(N / 2, N / 2), a = col.getContext("2d"), b = em.getContext("2d"); b.scale(0.5, 0.5);
  const U = (z) => (0.5 + z / (S.CW * 1.05)) * N, V = (yRel) => (1 - yRel / S.CH) * N, sx = N / (S.CW * 1.05), sy = N / S.CH;
  const bg = a.createLinearGradient(0, 0, 0, N); if (fast) { bg.addColorStop(0, "#f2f5f8"); bg.addColorStop(1, "#dde1e6"); } else { bg.addColorStop(0, "#d0d5dc"); bg.addColorStop(1, "#bfc4cb"); } a.fillStyle = bg; a.fillRect(0, 0, N, N); b.fillStyle = "#000"; b.fillRect(0, 0, N, N);
  a.fillStyle = "#23262b"; a.fillRect(0, V(0.2), N, N - V(0.2));                                       // skirt
  if (!fast) { // the cab front: a raked windscreen, a destination LED, headlight and tail-light housings, a coupler cover
    const wx0 = U(-1.05), wx1 = U(1.05), wy0 = V(2.62), wy1 = V(1.15);
    a.fillStyle = "#0c0d11"; rr(a, wx0 - 8, wy0 - 8, wx1 - wx0 + 16, wy1 - wy0 + 16, 26); a.fill();
    const g = a.createLinearGradient(wx0, wy0, wx1, wy1); g.addColorStop(0, "#41607c"); g.addColorStop(0.5, "#1b2736"); g.addColorStop(1, "#0f1620"); a.fillStyle = g; rr(a, wx0, wy0, wx1 - wx0, wy1 - wy0, 20); a.fill();
    a.save(); rr(a, wx0, wy0, wx1 - wx0, wy1 - wy0, 20); a.clip(); a.fillStyle = "rgba(200,222,248,0.2)"; a.beginPath(); a.moveTo(wx0, wy1); a.lineTo(wx0 + (wx1 - wx0) * 0.4, wy0); a.lineTo(wx0 + (wx1 - wx0) * 0.55, wy0); a.lineTo(wx0 + (wx1 - wx0) * 0.12, wy1); a.fill(); a.restore();
    a.fillStyle = "#2a2d33"; a.fillRect(U(-0.02), wy0, 4, wy1 - wy0);                                  // centre pillar
    a.fillStyle = "#0b0c10"; rr(a, U(-0.7), V(2.9), 1.4 * sx, 0.2 * sy, 5); a.fill(); b.fillStyle = "#06070a"; rr(b, U(-0.7), V(2.9), 1.4 * sx, 0.2 * sy, 5); b.fill(); b.fillStyle = "#ffb43a"; b.font = `bold ${0.15 * sy | 0}px Arial, sans-serif`; b.textAlign = "center"; b.textBaseline = "middle"; b.fillText("METRO", N / 2, V(2.8));
    for (const sgn of [-1, 1]) { a.fillStyle = "#15171b"; rr(a, U(sgn * 0.86) - 0.2 * sx, V(0.72), 0.4 * sx, 0.28 * sy, 8); a.fill(); a.fillStyle = "#2a1517"; rr(a, U(sgn * 0.48) - 0.1 * sx, V(0.72), 0.2 * sx, 0.2 * sy, 5); a.fill(); }
    a.fillStyle = "#3a3d44"; rr(a, U(-0.45), V(0.62), 0.9 * sx, 0.35 * sy, 8); a.fill();
    b.fillStyle = "rgba(255,230,180,0.12)"; rr(b, wx0, wy0, wx1 - wx0, wy1 - wy0, 20); b.fill();                // dim cab light behind the glass
  } else { // bullet train: a dark visor band across the upper nose, a lower intake, the livery sits on top as vertex-coloured strips
    const g = a.createLinearGradient(0, V(2.9), 0, V(1.5)); g.addColorStop(0, "#26384c"); g.addColorStop(0.5, "#101820"); g.addColorStop(1, "#0b0f14"); a.fillStyle = g; rr(a, U(-0.55 * S.CW), V(2.85), 1.1 * S.CW * sx, 1.28 * sy, 40); a.fill();
    a.fillStyle = "rgba(210,230,255,0.22)"; a.beginPath(); a.moveTo(U(-0.45 * S.CW), V(1.6)); a.lineTo(U(-0.05 * S.CW), V(2.85)); a.lineTo(U(0.12 * S.CW), V(2.85)); a.lineTo(U(-0.3 * S.CW), V(1.6)); a.fill();
    a.fillStyle = "#1b1e24"; rr(a, U(-0.35 * S.CW), V(0.75), 0.7 * S.CW * sx, 0.3 * sy, 12); a.fill();
    b.fillStyle = "rgba(255,235,200,0.08)"; rr(b, U(-0.55 * S.CW), V(2.85), 1.1 * S.CW * sx, 1.28 * sy, 40); b.fill();
  }
  a.fillStyle = "#ffffff"; a.fillRect(0, 0, 10, N);                                                    // white patch for vertex-coloured livery on the nose
  for (let i = 0; i < 700; i++) { a.fillStyle = `rgba(20,20,22,${0.04 + rnd() * 0.1})`; a.fillRect(rnd() * N, rnd() * N, 2 + rnd() * 20, 1 + rnd() * 2); }
  { const g = a.createLinearGradient(0, V(0.8), 0, V(0.05)); g.addColorStop(0, "rgba(60,52,44,0)"); g.addColorStop(1, "rgba(60,52,44,0.5)"); a.fillStyle = g; a.fillRect(10, V(0.8), N, V(0.05) - V(0.8)); }
  return { map: tex(col), em: tex(em, true, 8) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
//  geometry
// ---------------------------------------------------------------------------------------------------------------------------------
// the body cross-section from the centre of the floor round to the right-hand side and over the roof (z, y), as one half; mirrored for the other side
function halfProfile(S) {
  const a = S.CW / 2, yb = S.ybot, yt = S.ybot + S.CH, pts = [[0, yb], [a * 0.88, yb], [a * 0.97, yb + 0.1], [a, yb + 0.22]];
  const cy = yt - 0.5, cx = a * 0.64, rx = a - cx, ry = 0.5; for (let i = 0; i <= 5; i++) { const th = (i / 5) * (Math.PI / 2); pts.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th)]); }
  pts.push([cx * 0.5, yt + 0.025], [0, yt + 0.05]); return pts;
}
function ringProfile(S) { const h = halfProfile(S), r = h.map((p) => [p[0], p[1]]); const left = h.slice(1, -1).reverse().map(([z, y]) => [-z, y]); return r.concat(left); } // closed ring: floor centre -> right side -> roof -> left side -> floor

class Mesh3 { constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; } quad(a, b, c, d, ua, ub, uc, ud, col) { const o = this.p.length / 3; for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]); for (const u of [ua, ub, uc, ud]) this.uv.push(u[0], u[1]); for (let k = 0; k < 4; k++) this.c.push(col[0], col[1], col[2]); this.i.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  tri(a, b, c, ua, ub, uc, col) { const o = this.p.length / 3; for (const v of [a, b, c]) this.p.push(v[0], v[1], v[2]); for (const u of [ua, ub, uc]) this.uv.push(u[0], u[1]); for (let k = 0; k < 3; k++) this.c.push(col[0], col[1], col[2]); this.i.push(o, o + 1, o + 2); }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeVertexNormals(); return g; } }

// wall rows for a point at height y (above the skirt): the wall map; roof map for anything above the shoulder
function sideV(S, y, isRoof, arc) { if (!isRoof) { const wallM = S.CH - 0.12, yAbove = Math.max(0, Math.min(wallM, y - S.ybot)); return 1 - ((WALLH - (yAbove / wallM) * WALLH) / H); } return 1 - (400 + 112 * arc) / H; }

export function bodyGeometry(kind, livery) {
  const S = SPEC[kind], ring = ringProfile(S), x0 = -S.CL / 2, x1 = S.CL / 2, white = [1, 1, 1], lc = new THREE.Color(livery), L = [lc.r, lc.g, lc.b], m = new Mesh3(), yt = S.ybot + S.CH, wallTop = yt - 0.12;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const A = ring[i], B = ring[(i + 1) % n]; const mid = (A[1] + B[1]) / 2, isRoof = mid > wallTop, right = (A[0] + B[0]) / 2 >= 0;
    if (i === 0 || i === n - 1 || (Math.abs(A[1] - S.ybot) < 1e-6 && Math.abs(B[1] - S.ybot) < 1e-6)) { // floor plate: dark, looks at the skirt texel
      const va = sideV(S, S.ybot, false), uvA = (x) => [(x - x0) / S.CL * 0.2, va]; m.quad([x0, A[1], A[0]], [x1, A[1], A[0]], [x1, B[1], B[0]], [x0, B[1], B[0]], uvA(x0), uvA(x1), uvA(x1), uvA(x0), white); continue; }
    const arcA = isRoof ? Math.min(1, Math.max(0, (A[1] - wallTop) / 0.3)) : 0, arcB = isRoof ? Math.min(1, Math.max(0, (B[1] - wallTop) / 0.3)) : 0;
    const vA = sideV(S, A[1], isRoof, arcA), vB = sideV(S, B[1], isRoof, arcB); const uA = (x) => (right ? (x - x0) / S.CL : 1 - (x - x0) / S.CL), u0 = uA(x0), u1 = uA(x1);
    m.quad([x0, A[1], A[0]], [x1, A[1], A[0]], [x1, B[1], B[0]], [x0, B[1], B[0]], [u0, vA], [u1, vA], [u1, vB], [u0, vB], white);
  }
  // end walls: the cars couple up against each other, so the ends are plain dark plates (the nose, where there is one, hides its own)
  { const uvd = [0.05, sideV(S, S.ybot + 0.1, false)]; let cy = S.ybot + S.CH * 0.5; for (const [x, dirx] of [[x1, 1], [x0, -1]]) for (let i = 0; i < n; i++) { const j = (i + 1) % n, p = ring[i], q = ring[j]; if (dirx > 0) m.tri([x, cy, 0], [x, q[1], q[0]], [x, p[1], p[0]], uvd, uvd, uvd, white); else m.tri([x, cy, 0], [x, p[1], p[0]], [x, q[1], q[0]], uvd, uvd, uvd, white); } }
  // livery stripe: a thin proud strip on both walls, vertex-coloured, sampling the white patch at the right edge of the side map
  const a = S.CW / 2 + 0.012, yA = S.ybot + (kind === "fast" ? 0.62 : 0.5), yB = S.ybot + (kind === "fast" ? 0.98 : 0.82), uv = (v) => [0.9985, v]; const vA = sideV(S, yA, false), vB = sideV(S, yB, false);
  m.quad([x0, yA, a], [x1, yA, a], [x1, yB, a], [x0, yB, a], uv(vA), uv(vA), uv(vB), uv(vB), L); m.quad([x0, yA, -a], [x0, yB, -a], [x1, yB, -a], [x1, yA, -a], uv(vA), uv(vB), uv(vB), uv(vA), L);
  if (kind === "fast") { const yC = S.ybot + 1.1, yD = S.ybot + 1.18, vC = sideV(S, yC, false), vD = sideV(S, yD, false); m.quad([x0, yC, a], [x1, yC, a], [x1, yD, a], [x0, yD, a], uv(vC), uv(vC), uv(vD), uv(vD), L); m.quad([x0, yC, -a], [x0, yD, -a], [x1, yD, -a], [x1, yC, -a], uv(vC), uv(vD), uv(vD), uv(vC), L); }
  return m.build();
}

// the cab nose: the body ring lofted forward and shrunk; front-projected UVs; a front cap
export function noseGeometry(kind, livery) {
  const S = SPEC[kind], fast = kind === "fast", ring = ringProfile(S), m = new Mesh3(), x0 = S.CL / 2, yt = S.ybot + S.CH, white = [1, 1, 1], lc = new THREE.Color(livery), L = [lc.r, lc.g, lc.b];
  const nS = fast ? 16 : 6; const sec = [];
  for (let k = 0; k <= nS; k++) {
    const t = k / nS; let sz, top, bot;
    if (fast) { sz = Math.pow(Math.max(0.02, 1 - Math.pow(t, 2.3)), 0.62) * 0.97 + 0.03; top = yt - S.CH * 0.64 * Math.pow(t, 1.35); bot = S.ybot + S.CH * 0.05 * t; if (t > 0.985) { sz = 0.08; } }
    else { sz = 1 - 0.13 * (t * t * (3 - 2 * t)); top = yt - 0.32 * Math.pow(t, 1.4); bot = S.ybot + 0.12 * t; }
    const pts = ring.map(([z, y]) => { const f = (y - S.ybot) / S.CH; return [z * sz, bot + f * (top - bot)]; }); sec.push({ x: x0 + t * S.Ln * (fast ? 0.985 : 1), pts });
  }
  const U = (z) => 0.5 + z / (S.CW * 1.05), Vf = (y) => (y - S.ybot) / S.CH;
  const n = ring.length;
  for (let k = 0; k < nS; k++) { const A = sec[k], B = sec[k + 1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; const p1 = A.pts[i], p2 = A.pts[j], p3 = B.pts[j], p4 = B.pts[i];
      m.quad([A.x, p2[1], p2[0]], [A.x, p1[1], p1[0]], [B.x, p4[1], p4[0]], [B.x, p3[1], p3[0]], [U(p2[0]), Vf(p2[1])], [U(p1[0]), Vf(p1[1])], [U(p4[0]), Vf(p4[1])], [U(p3[0]), Vf(p3[1])], white); } }
  // front cap: a fan over the last ring
  const E = sec[nS], cz = 0, cy = (Math.max(...E.pts.map((p) => p[1])) + Math.min(...E.pts.map((p) => p[1]))) / 2;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; const p = E.pts[i], q = E.pts[j]; m.tri([E.x, cy, cz], [E.x, q[1], q[0]], [E.x, p[1], p[0]], [U(cz), Vf(cy)], [U(q[0]), Vf(q[1])], [U(p[0]), Vf(p[1])], white); }
  // livery over the nose: the band's slice of the wall followed along the loft
  const fY = fast ? [0.62, 0.98] : [0.5, 0.82];
  for (let k = 0; k < nS; k++) { const A = sec[k], B = sec[k + 1]; for (const sg of [1, -1]) { const q = (sec0, yy) => { const f = yy / S.CH; const zz = (sec0 === A ? A : B); const top = Math.max(...zz.pts.map((p) => p[1])), bot = Math.min(...zz.pts.map((p) => p[1])); const y = bot + f * (top - bot); const sz = Math.max(...zz.pts.map((p) => p[0])); return [sg * (sz + 0.012), y]; };
      const a1 = q(A, fY[0]), a2 = q(A, fY[1]), b1 = q(B, fY[0]), b2 = q(B, fY[1]); const uvp = [0.0095, 0.5]; const arrA = [A.x, a1[1], a1[0]], arrB = [A.x, a2[1], a2[0]], arrC = [B.x, b2[1], b2[0]], arrD = [B.x, b1[1], b1[0]];
      if (sg > 0) m.quad(arrA, arrD, arrC, arrB, uvp, uvp, uvp, uvp, L); else m.quad(arrA, arrB, arrC, arrD, uvp, uvp, uvp, uvp, L); } }
  return m.build();
}

// bogies, wheels, underframe boxes, roof air-conditioners, a pantograph: one dark-metal mesh per car (vertex-coloured)
export function detailGeometry(kind, motor) {
  const S = SPEC[kind], parts = []; const yt = S.ybot + S.CH; const add = (g, c) => { const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; } g.setAttribute("color", new THREE.BufferAttribute(col, 3)); if (g.index) g = g.toNonIndexed(); g.deleteAttribute("uv"); parts.push(g); };
  const box = (cx, cy, cz, sx, sy, sz, c, rz = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(cx, cy, cz); add(g, c); };
  const cylZ = (cx, cy, cz, r, len, c) => { const g = new THREE.CylinderGeometry(r, r, len, 14); g.rotateX(Math.PI / 2); g.translate(cx, cy, cz); add(g, c); };
  const rail = S.rail, wr = 0.46, wy = rail + wr + 0.04, dark = [0.1, 0.1, 0.12], metal = [0.28, 0.29, 0.32], grey = [0.74, 0.76, 0.79];
  for (const bx of [-S.CL * 0.3, S.CL * 0.3]) {
    box(bx, wy + 0.12, 0, 2.7, 0.3, 2.1, dark); box(bx, wy + 0.12, 0.98, 2.7, 0.2, 0.18, metal); box(bx, wy + 0.12, -0.98, 2.7, 0.2, 0.18, metal); // bogie frame and side beams
    for (const ax of [-0.95, 0.95]) { cylZ(bx + ax, wy, 0.72, wr, 0.16, metal); cylZ(bx + ax, wy, -0.72, wr, 0.16, metal); cylZ(bx + ax, wy, 0, 0.1, 1.6, dark); box(bx + ax, wy + 0.3, 0.78, 0.5, 0.3, 0.24, [0.16, 0.16, 0.18]); box(bx + ax, wy + 0.3, -0.78, 0.5, 0.3, 0.24, [0.16, 0.16, 0.18]); } // wheels, axle, axle boxes
    box(bx, wy + 0.5, 0, 1.2, 0.3, 0.9, [0.2, 0.2, 0.24]); // traction motor / gearbox housing
  }
  box(0, S.ybot - 0.05, 0, S.CL * 0.38, 0.4, S.CW * 0.55, dark); box(S.CL * 0.28, S.ybot - 0.05, 0, 2.2, 0.36, S.CW * 0.5, [0.18, 0.18, 0.2]); box(-S.CL * 0.28, S.ybot - 0.05, 0, 1.8, 0.34, S.CW * 0.5, [0.2, 0.2, 0.22]);   // underfloor equipment
  // roof: two air-conditioning units, a cable duct, and on motor cars a folded pantograph
  if (kind === "metro") { for (const rx of [-S.CL * 0.27, S.CL * 0.27]) { box(rx, yt + 0.2, 0, 3.4, 0.34, 1.7, grey); box(rx, yt + 0.42, 0, 3.1, 0.1, 1.5, [0.62, 0.64, 0.68]); for (let k = -1; k <= 1; k++) cylZ(rx + k * 1.0, yt + 0.5, 0, 0.3, 0.05, [0.12, 0.12, 0.14]); }
    box(0, yt + 0.1, 0, S.CL * 0.5, 0.08, 0.35, [0.3, 0.3, 0.33]);
    if (motor) { box(-1.2, yt + 0.12, 0, 1.4, 0.16, 1.2, dark); const arm = (x, y, ang, len) => box(x, y, 0.0, len, 0.07, 0.07, [0.16, 0.16, 0.18], ang); arm(-0.9, yt + 0.62, 0.9, 1.45); arm(-0.1, yt + 0.62, -0.9, 1.45); box(-0.52, yt + 1.18, 0, 0.1, 0.07, 1.7, [0.1, 0.1, 0.12]); box(-0.52, yt + 1.2, 0, 0.5, 0.04, 1.6, [0.25, 0.25, 0.28]); } }
  else { for (const rx of [-S.CL * 0.28, S.CL * 0.1]) box(rx, yt + 0.1, 0, 2.6, 0.2, 1.3, grey); box(0, yt + 0.05, 0, S.CL * 0.55, 0.06, 0.3, [0.32, 0.33, 0.36]); }
  const g = mergeGeometries(parts, false); g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
//  kit: textures + materials once per kind, geometries cached per line colour
// ---------------------------------------------------------------------------------------------------------------------------------
export function createTrainKit(envMap) {
  const cache = {}; const geoCache = new Map();
  const get = (kind) => {
    if (cache[kind]) return cache[kind];
    const s = sideTextures(kind), n = noseTextures(kind);
    const body = new THREE.MeshStandardMaterial({ map: s.map, emissiveMap: s.em, emissive: 0xffffff, emissiveIntensity: 0.95, vertexColors: true, roughness: 0.38, metalness: kind === "fast" ? 0.45 : 0.6, envMap, envMapIntensity: 0.85, fog: false });
    const nose = new THREE.MeshStandardMaterial({ map: n.map, emissiveMap: n.em, emissive: 0xffffff, emissiveIntensity: 0.95, vertexColors: true, roughness: 0.34, metalness: 0.5, envMap, envMapIntensity: 0.9, fog: false });
    const detail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.55, envMap, envMapIntensity: 0.4, fog: false });
    return (cache[kind] = { body, nose, detail });
  };
  const geo = (kind, livery) => { const k = kind + livery; let v = geoCache.get(k); if (!v) { v = { body: bodyGeometry(kind, livery), nose: noseGeometry(kind, livery) }; geoCache.set(k, v); } return v; };
  const details = {}; const det = (kind, motor) => { const k = kind + (motor ? "m" : ""); return details[k] || (details[k] = detailGeometry(kind, motor)); };
  return { mats: cache, get, geo, det };
}
