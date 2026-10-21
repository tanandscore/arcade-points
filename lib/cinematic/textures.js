// Procedural surface textures (colour + normal + roughness) drawn on the fly,
// so the games ship no image files. Every texture tiles seamlessly.
import * as THREE from "three";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hex(c) { const col = new THREE.Color(c); return [col.r * 255, col.g * 255, col.b * 255]; }

// tileable value noise on an S x S grid
function noiseField(S, cells, seed) {
  const r = rng(seed); const n = cells;
  const lat = new Float32Array(n * n); for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(S * S);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) {
    const fy = (y / S) * n, y0 = Math.floor(fy), ty = sm(fy - y0), y1 = (y0 + 1) % n;
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * n, x0 = Math.floor(fx), tx = sm(fx - x0), x1 = (x0 + 1) % n;
      const a = lat[y0 * n + x0], b = lat[y0 * n + x1], c = lat[y1 * n + x0], d = lat[y1 * n + x1];
      out[y * S + x] = mix(mix(a, b, tx), mix(c, d, tx), ty);
    }
  }
  return out;
}
function fbm(S, seed, base = 4, oct = 5, gain = 0.5) {
  const out = new Float32Array(S * S); let amp = 1, tot = 0, cells = base;
  for (let o = 0; o < oct; o++) {
    const f = noiseField(S, cells, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += f[i] * amp;
    tot += amp; amp *= gain; cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

const MODES = {
  // [colour(x,y,i)->[r,g,b], height(x,y,i)->0..1, rough]
  grass(S, o) {
    const lo = fbm(S, o.seed, 3, 4), hi = fbm(S, o.seed + 7, 32, 3, 0.6), mid = fbm(S, o.seed + 3, 12, 3), dry = fbm(S, o.seed + 9, 5, 3);
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]), c2 = hex(o.colors[2] ?? o.colors[1]);
    return {
      color: (x, y, i) => { const t = clamp(lo[i] * 0.7 + mid[i] * 0.5 - 0.2 + (hi[i] - 0.5) * 0.7); const d = clamp((dry[i] - 0.5) * 3); const base = [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)]; return [mix(base[0], c2[0], d), mix(base[1], c2[1], d), mix(base[2], c2[2], d)]; },
      height: (x, y, i) => hi[i] * 0.8 + mid[i] * 0.2, rough: 0.95, bump: 3.2,
    };
  },
  dirt(S, o) {
    const lo = fbm(S, o.seed, 4, 5), hi = fbm(S, o.seed + 5, 40, 2), peb = fbm(S, o.seed + 2, 24, 2);
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    return {
      color: (x, y, i) => { const t = clamp(lo[i] * 1.3 - 0.15 + (hi[i] - 0.5) * 0.4); const p = peb[i] > 0.66 ? 0.8 : 1; return [mix(c0[0], c1[0], t) * p, mix(c0[1], c1[1], t) * p, mix(c0[2], c1[2], t) * p]; },
      height: (x, y, i) => lo[i] * 0.5 + hi[i] * 0.3 + (peb[i] > 0.66 ? 0.5 : 0), rough: 0.97, bump: 3.0,
    };
  },
  ash(S, o) {
    const lo = fbm(S, o.seed, 3, 5), hi = fbm(S, o.seed + 5, 64, 2), cr = fbm(S, o.seed + 6, 6, 4);
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    return {
      color: (x, y, i) => { const crack = Math.abs(cr[i] - 0.5) < 0.012 ? 0.35 : 1; const t = clamp(lo[i] * 1.2 + (hi[i] - 0.5) * 0.3); return [mix(c0[0], c1[0], t) * crack, mix(c0[1], c1[1], t) * crack, mix(c0[2], c1[2], t) * crack]; },
      height: (x, y, i) => lo[i] * 0.5 + hi[i] * 0.35 - (Math.abs(cr[i] - 0.5) < 0.012 ? 0.5 : 0), rough: 0.98, bump: 2.6,
    };
  },
  stone(S, o) {
    const lo = fbm(S, o.seed, 6, 4), hi = fbm(S, o.seed + 5, 48, 3), rows = o.rows ?? 5, cols = o.cols ?? 3;
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]); const r = rng(o.seed + 11);
    const tint = []; for (let i = 0; i < rows * (cols + 1); i++) tint.push(r());
    const bh = S / rows, bw = S / cols;
    const info = (x, y) => { const row = Math.floor(y / bh); const off = (row % 2) * bw * 0.5; const xx = (x + off) % S; const col = Math.floor(xx / bw); const lx = xx - col * bw, ly = y - row * bh; const edge = Math.min(lx, bw - lx, ly, bh - ly); return { t: tint[row * (cols + 1) + col], edge }; };
    return {
      color: (x, y, i) => { const b = info(x, y); const m = b.edge < 2.2 ? 0.38 : 1; const t = clamp(b.t * 0.6 + lo[i] * 0.5 + (hi[i] - 0.5) * 0.3); return [mix(c0[0], c1[0], t) * m, mix(c0[1], c1[1], t) * m, mix(c0[2], c1[2], t) * m]; },
      height: (x, y, i) => { const b = info(x, y); return (b.edge < 2.6 ? 0 : 0.55) + hi[i] * 0.3 + lo[i] * 0.15; }, rough: 0.9, bump: 4.0,
    };
  },
  marble(S, o) {
    const w1 = fbm(S, o.seed, 3, 5), w2 = fbm(S, o.seed + 4, 8, 4), tiles = o.cols ?? 2;
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]), cv_ = hex(o.colors[2] ?? "#6a7080");
    return {
      color: (x, y, i) => {
        const v = Math.abs(Math.sin((x / S) * 6.28318 * 2 + w1[i] * 9 + w2[i] * 3)); const vein = Math.pow(1 - v, 14); const t = clamp(w1[i] * 0.7 + w2[i] * 0.4 - 0.15);
        const g = Math.min(x % (S / tiles), y % (S / tiles)) < 1.6 ? 0.6 : 1;
        return [mix(mix(c0[0], c1[0], t), cv_[0], vein * 0.7) * g, mix(mix(c0[1], c1[1], t), cv_[1], vein * 0.7) * g, mix(mix(c0[2], c1[2], t), cv_[2], vein * 0.7) * g];
      },
      height: (x, y) => (Math.min(x % (S / tiles), y % (S / tiles)) < 1.6 ? 0 : 0.6), rough: 0.28, bump: 1.8,
    };
  },
  concrete(S, o) {
    const lo = fbm(S, o.seed, 4, 5), hi = fbm(S, o.seed + 3, 64, 2), st = fbm(S, o.seed + 8, 3, 3), cr = fbm(S, o.seed + 6, 5, 4);
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    return {
      color: (x, y, i) => { const crack = Math.abs(cr[i] - 0.5) < 0.008 ? 0.45 : 1; const stain = 1 - clamp((st[i] - 0.55) * 1.6) * 0.3; const t = clamp(lo[i] * 0.9 + (hi[i] - 0.5) * 0.45); return [mix(c0[0], c1[0], t) * crack * stain, mix(c0[1], c1[1], t) * crack * stain, mix(c0[2], c1[2], t) * crack * stain]; },
      height: (x, y, i) => lo[i] * 0.3 + hi[i] * 0.5 - (Math.abs(cr[i] - 0.5) < 0.008 ? 0.6 : 0), rough: 0.88, bump: 2.4,
    };
  },
  metal(S, o) {
    const lo = fbm(S, o.seed, 3, 4), hi = fbm(S, o.seed + 5, 90, 2), pan = o.cols ?? 4;
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    return {
      color: (x, y, i) => { const seam = Math.min(x % (S / pan), y % (S / pan)) < 1.5 ? 0.5 : 1; const t = clamp(lo[i] * 0.8 + (hi[i] - 0.5) * 0.35); return [mix(c0[0], c1[0], t) * seam, mix(c0[1], c1[1], t) * seam, mix(c0[2], c1[2], t) * seam]; },
      height: (x, y, i) => (Math.min(x % (S / pan), y % (S / pan)) < 1.5 ? 0 : 0.6) + hi[i] * 0.2, rough: 0.5, bump: 2.0,
    };
  },
  // shipping-container steel: vertical ribs, rust bleeding from the edges, scuffed paint
  corrugated(S, o) {
    const lo = fbm(S, o.seed, 3, 4), hi = fbm(S, o.seed + 5, 80, 2), rust = fbm(S, o.seed + 11, 7, 4), ribs = o.ribs ?? 14;
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    const rib = (x) => 0.5 + 0.5 * Math.sin((x / S) * ribs * Math.PI * 2);
    return {
      color: (x, y, i) => { const r = rib(x); const rs = clamp((rust[i] - 0.52) * 3.2) * (0.5 + 0.5 * (1 - y / S)); const t = clamp(lo[i] * 0.7 + (hi[i] - 0.5) * 0.3); const sh = 0.72 + r * 0.38; const base = [mix(c0[0], c1[0], t) * sh, mix(c0[1], c1[1], t) * sh, mix(c0[2], c1[2], t) * sh]; return [mix(base[0], 120, rs * 0.7), mix(base[1], 62, rs * 0.7), mix(base[2], 30, rs * 0.7)]; },
      height: (x, y, i) => rib(x) * 0.9 + hi[i] * 0.1, rough: 0.55, bump: 3.2,
    };
  },
  // cracked volcanic plates: dark rock cells split by glowing seams (the glow is baked into the colour map)
  lava(S, o) {
    const n = o.cells ?? 7; const r = rng(o.seed + 17); const px = [], py = [], tint = [];
    for (let i = 0; i < n * n; i++) { px.push(r()); py.push(r()); tint.push(r()); }
    const lo = fbm(S, o.seed, 3, 5), hi = fbm(S, o.seed + 5, 48, 2);
    const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    const edge = new Float32Array(S * S), cell = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = (x / S) * n, fy = (y / S) * n, cx = Math.floor(fx), cy = Math.floor(fy); let d1 = 9, d2 = 9, id = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy, wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n, k = wy * n + wx;
        const dx = gx + px[k] - fx, dy = gy + py[k] - fy, d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
      }
      edge[y * S + x] = d2 - d1; cell[y * S + x] = tint[id];
    }
    return {
      color: (x, y, i) => { const e = edge[i]; const glow = Math.pow(clamp(1 - e / 0.05), 1.7); const t = clamp(lo[i] * 0.8 + cell[i] * 0.5 + (hi[i] - 0.5) * 0.35); const rock = [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)]; return [rock[0] + glow * 260, rock[1] + glow * 90, rock[2] + glow * 10]; },
      height: (x, y, i) => lo[i] * 0.3 + hi[i] * 0.3 + clamp(edge[i] / 0.12) * 0.5, rough: 0.9, bump: 3.6,
    };
  },
  tiles(S, o) {
    const lo = fbm(S, o.seed, 5, 3), rows = o.rows ?? 8, cols = o.cols ?? 4; const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    const r = rng(o.seed + 3); const tint = []; for (let i = 0; i < rows * (cols + 1); i++) tint.push(r());
    const bh = S / rows, bw = S / cols;
    const info = (x, y) => { const row = Math.floor(y / bh); const off = (row % 2) * bw * 0.5; const xx = (x + off) % S; const col = Math.floor(xx / bw); const lx = xx - col * bw, ly = y - row * bh; return { t: tint[row * (cols + 1) + col], edge: Math.min(lx, bw - lx), low: ly / bh }; };
    return {
      color: (x, y, i) => { const b = info(x, y); const shade = (b.edge < 1.5 ? 0.55 : 1) * (0.8 + b.low * 0.3); const t = clamp(b.t * 0.7 + lo[i] * 0.4); return [mix(c0[0], c1[0], t) * shade, mix(c0[1], c1[1], t) * shade, mix(c0[2], c1[2], t) * shade]; },
      height: (x, y) => { const b = info(x, y); return (b.edge < 1.5 ? 0 : 0.4) + b.low * 0.5; }, rough: 0.8, bump: 3.0,
    };
  },
  wood(S, o) {
    const lo = fbm(S, o.seed, 3, 3), gr = fbm(S, o.seed + 2, 80, 2), planks = o.cols ?? 4; const c0 = hex(o.colors[0]), c1 = hex(o.colors[1]);
    const r = rng(o.seed + 3); const tint = []; for (let i = 0; i < planks + 1; i++) tint.push(r());
    return {
      color: (x, y, i) => { const p = Math.floor(x / (S / planks)); const lx = x % (S / planks); const seam = lx < 1.6 ? 0.45 : 1; const streak = Math.sin(y * 0.05 + gr[i] * 14 + tint[p] * 20) * 0.5 + 0.5; const t = clamp(tint[p] * 0.5 + streak * 0.35 + lo[i] * 0.25); return [mix(c0[0], c1[0], t) * seam, mix(c0[1], c1[1], t) * seam, mix(c0[2], c1[2], t) * seam]; },
      height: (x, y, i) => ((x % (S / planks)) < 1.6 ? 0 : 0.5) + gr[i] * 0.4, rough: 0.85, bump: 2.6,
    };
  },
  waternormal(S, o) {
    const a = fbm(S, o.seed, 6, 4, 0.55), b = fbm(S, o.seed + 9, 14, 3, 0.5);
    const c0 = hex(o.colors[0]);
    return { color: () => c0, height: (x, y, i) => a[i] * 0.7 + b[i] * 0.3, rough: 0.1, bump: 5.0 };
  },
};

const cache = new Map();
export function makeSurface(mode, opts = {}) {
  const key = mode + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const o = { seed: 1, colors: ["#555", "#888"], size: 256, ...opts };
  const S = o.size; const m = MODES[mode](S, o);
  const col = cv(S, S), rgh = cv(S, S), nrm = cv(S, S);
  const cx = col.getContext("2d"), rx = rgh.getContext("2d"), nx = nrm.getContext("2d");
  const ci = cx.createImageData(S, S), ri = rx.createImageData(S, S), ni = nx.createImageData(S, S);
  const Hs = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; Hs[i] = m.height(x, y, i); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, p = i * 4; const c = m.color(x, y, i);
    ci.data[p] = clamp(c[0], 0, 255); ci.data[p + 1] = clamp(c[1], 0, 255); ci.data[p + 2] = clamp(c[2], 0, 255); ci.data[p + 3] = 255;
    const R = clamp((m.rough + (Hs[i] - 0.5) * 0.18) * 255, 0, 255);
    ri.data[p] = ri.data[p + 1] = ri.data[p + 2] = R; ri.data[p + 3] = 255;
    const H = (xx, yy) => Hs[((yy + S) % S) * S + ((xx + S) % S)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * m.bump, dy = (H(x, y + 1) - H(x, y - 1)) * m.bump;
    const l = Math.hypot(dx, dy, 1);
    ni.data[p] = (-dx / l * 0.5 + 0.5) * 255; ni.data[p + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[p + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[p + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); rx.putImageData(ri, 0, 0); nx.putImageData(ni, 0, 0);
  const tex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const out = { map: tex(col, true), roughnessMap: tex(rgh, false), normalMap: tex(nrm, false) };
  cache.set(key, out);
  return out;
}
export function repeatAll(surface, rx, ry = rx) { for (const k of Object.keys(surface)) surface[k].repeat.set(rx, ry); return surface; }
// Texture sets are cached and shared, so clone before changing the tiling
export function cloneSurface(surface, rx, ry = rx) {
  const out = {}; for (const k of Object.keys(surface)) { const t = surface[k].clone(); t.needsUpdate = true; t.repeat.set(rx, ry); out[k] = t; }
  return out;
}
