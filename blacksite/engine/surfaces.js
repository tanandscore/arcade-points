// Operation Blacksite — realistic ground, wall and prop surfaces, drawn on the fly (no image files ship).
// Aim: the quiet, grainy, sun-bleached look of a real place rather than a flat colour with a pattern on it. Every surface layers
//   slow colour drift  +  mid-size mottling  +  fine grit  +  dirt in the cracks and joints  +  stains / wear,
// and carries a matching bump map (so the sun rakes across it) and a patchy roughness map (so it shines a little unevenly).
// All floor textures tile seamlessly (one tile = one 2.5 m map cell).
import * as THREE from "three";
import { cpuCanvas } from "./cpucanvas";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rngf(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rgb = (c) => { const k = new THREE.Color(c); return [k.r * 255, k.g * 255, k.b * 255]; };
const mk = (w, h) => cpuCanvas(w, h);

// ---- noise ------------------------------------------------------------------------------------------------------------------------------
// smooth value noise on a w x h grid that repeats every cx x cy lattice cells (so it tiles)
function field(w, h, cx, cy, seed) {
  const r = rngf(seed), lat = new Float32Array(cx * cy); for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * cy, y0 = Math.floor(fy), ty0 = fy - y0, ty = ty0 * ty0 * (3 - 2 * ty0), ya = (y0 % cy) * cx, yb = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * cx, x0 = Math.floor(fx), tx0 = fx - x0, tx = tx0 * tx0 * (3 - 2 * tx0), xa = x0 % cx, xb = (x0 + 1) % cx;
      const a = lat[ya + xa], b = lat[ya + xb], c = lat[yb + xa], d = lat[yb + xb];
      out[y * w + x] = a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
    }
  }
  return out;
}
function fbm2(w, h, seed, cx, cy, oct = 4, gain = 0.5) {
  const out = new Float32Array(w * h); let amp = 1, tot = 0, ax = cx, ay = cy;
  for (let o = 0; o < oct; o++) {
    const f = field(w, h, ax, ay, seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += f[i] * amp;
    tot += amp; amp *= gain; ax *= 2; ay *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
// per-pixel white noise, then a light 3-tap blur so the grit has body instead of TV static
function grit(w, h, seed, soft = 0.5) {
  const r = rngf(seed), a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = r();
  if (soft <= 0) return a; const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, l = a[y * w + ((x + w - 1) % w)], rr = a[y * w + ((x + 1) % w)], u = a[((y + h - 1) % h) * w + x], d = a[((y + 1) % h) * w + x]; o[i] = a[i] * (1 - soft) + (l + rr + u + d) * 0.25 * soft; }
  return o;
}

// ---- output -----------------------------------------------------------------------------------------------------------------------------
// colour RGBA bytes + height + roughness -> three textures. Height becomes a normal map (strength = how pronounced the relief is).
function finish(w, h, rgba, height, rough, strength = 2.6, repeat = true) {
  const col = mk(w, h), nrm = mk(w, h), rgh = mk(w, h);
  col.getContext("2d").putImageData(new ImageData(rgba, w, h), 0, 0);
  const ni = new ImageData(w, h), ri = new ImageData(w, h);
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4; const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1);
    ni.data[p] = (-dx / l * 0.5 + 0.5) * 255; ni.data[p + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[p + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[p + 3] = 255;
    const v = clamp(rough[i], 0, 1) * 255; ri.data[p] = ri.data[p + 1] = ri.data[p + 2] = v; ri.data[p + 3] = 255;
  }
  nrm.getContext("2d").putImageData(ni, 0, 0); rgh.getContext("2d").putImageData(ri, 0, 0);
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: T(col, true), normalMap: T(nrm, false), roughnessMap: T(rgh, false) };
}
// build a texture straight from a 2D canvas that was drawn on (used for the tall wall skins)
export function surfaceFromCanvas(canvas, { strength = 2.2, rough = 0.92, repeat = false } = {}) {
  const w = canvas.width, h = canvas.height, g = canvas.getContext("2d"), src = g.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h), rg = new Float32Array(w * h);
  for (let i = 0; i < lum.length; i++) lum[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  // soften so only real features (cracks, chips, joints) make relief, not the film grain
  const blur = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let s = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) s += lum[clamp(y + oy, 0, h - 1) * w + clamp(x + ox, 0, w - 1)]; blur[i] = s / 9; rg[i] = rough - (lum[i] - 0.5) * 0.12; }
  return finish(w, h, new Uint8ClampedArray(src), blur, rg, strength, repeat);
}

// ---- generators -------------------------------------------------------------------------------------------------------------------------
const GEN = {
  // open ground: dust, sand, packed earth — fine grit, small pebbles, faint wind ripples, optional dry cracks
  ground(o) {
    const S = o.size, sd = o.seed, lo = fbm2(S, S, sd, 3, 3, 4), mid = fbm2(S, S, sd + 5, 14, 14, 3, 0.55), hi = fbm2(S, S, sd + 9, 110, 110, 2, 0.7), g = grit(S, S, sd + 13, 0.35), pb = fbm2(S, S, sd + 17, 48, 48, 2, 0.6);
    const c0 = rgb(o.colors[0]), c1 = rgb(o.colors[1]); const rgba = new Uint8ClampedArray(S * S * 4), ht = new Float32Array(S * S), rh = new Float32Array(S * S);
    const crack = o.cracks ? crackField(S, sd + 21, o.cracks) : null;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, p = i * 4;
      const t = clamp(lo[i] * 1.25 + (mid[i] - 0.5) * 0.55 - 0.12); let k = 0.78 + hi[i] * 0.44; k *= 0.86 + g[i] * 0.28;
      if (o.ripple) k *= 0.965 + 0.07 * (0.5 + 0.5 * Math.sin(y * 0.11 + lo[i] * 22 + mid[i] * 4));
      let peb = 0; if (pb[i] > 0.7) { peb = sstep(0.7, 0.78, pb[i]); k *= mix(1, g[(i * 7) % g.length] > 0.5 ? 1.22 : 0.68, peb); }
      let r = mix(c0[0], c1[0], t) * k, gg = mix(c0[1], c1[1], t) * k, b = mix(c0[2], c1[2], t) * k;
      let cr = 0; if (crack) { cr = crack[i]; const dk = 1 - cr * 0.55; r *= dk; gg *= dk; b *= dk; }
      rgba[p] = r; rgba[p + 1] = gg; rgba[p + 2] = b; rgba[p + 3] = 255;
      ht[i] = hi[i] * 0.35 + mid[i] * 0.25 + peb * 0.5 - cr * 0.6 + g[i] * 0.12; rh[i] = 0.93 - peb * 0.05 + (g[i] - 0.5) * 0.06;
    }
    return finish(S, S, rgba, ht, rh, o.bump ?? 2.4);
  },
  // flagstones / pavers laid in running bond, worn edges, dirt in the joints, stained and chipped
  pave(o) {
    const S = o.size, sd = o.seed, rows = o.rows ?? 5, r = rngf(sd + 3), bh = S / rows;
    const lo = fbm2(S, S, sd, 4, 4, 4), mid = fbm2(S, S, sd + 5, 20, 20, 3, 0.55), hi = fbm2(S, S, sd + 9, 120, 120, 2, 0.7), g = grit(S, S, sd + 13, 0.3), st = fbm2(S, S, sd + 31, 3, 3, 3);
    const c0 = rgb(o.colors[0]), c1 = rgb(o.colors[1]); const jd = rgb(o.joint ?? "#6c6252");
    const brk = [], tints = []; // per row: sorted slab start positions and a tint per slab
    for (let rr = 0; rr < rows; rr++) { const n = (o.cols ?? 3) + (r() < 0.45 ? 1 : 0); const ws = []; let tot = 0; for (let k = 0; k < n; k++) { const w = 0.65 + r() * 0.7; ws.push(w); tot += w; } let at = r() * S; const arr = []; const tn = []; for (let k = 0; k < n; k++) { arr.push(at % S); tn.push(r()); at += (ws[k] / tot) * S; } const idx = arr.map((v, i) => i).sort((a, b) => arr[a] - arr[b]); brk.push(idx.map((i) => arr[i])); tints.push(idx.map((i) => tn[i])); }
    const jw = o.jw ?? S * 0.0035, bev = S * 0.012;
    const rgba = new Uint8ClampedArray(S * S * 4), ht = new Float32Array(S * S), rh = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / bh), ly = y - row * bh, ey = Math.min(ly, bh - ly), bs = brk[row], tn = tints[row], n = bs.length;
      for (let x = 0; x < S; x++) {
        const i = y * S + x, p = i * 4; let k = n - 1; for (let q = 0; q < n; q++) if (bs[q] <= x) k = q; else break;
        const start = bs[k] - (bs[k] > x ? S : 0), nextS = k + 1 < n ? bs[k + 1] : bs[0] + S, wslab = nextS - bs[k], lx = x - start, ex = Math.min(lx, wslab - lx);
        const edge = Math.min(ex, ey); const tint = tn[k];
        if (edge < jw) { const d = 0.5 + hi[i] * 0.8 + (g[i] - 0.5) * 0.3; rgba[p] = jd[0] * d; rgba[p + 1] = jd[1] * d; rgba[p + 2] = jd[2] * d; rgba[p + 3] = 255; ht[i] = 0; rh[i] = 0.98; continue; }
        const b = sstep(jw, jw + bev, edge);
        const t = clamp(tint * 0.55 + lo[i] * 0.5 + (mid[i] - 0.5) * 0.45 - 0.08); let kk = (0.8 + hi[i] * 0.4) * (0.88 + g[i] * 0.24) * (0.82 + 0.18 * b);
        kk *= 1 - clamp((st[i] - 0.6) * 2.2) * 0.3; if (hi[i] < 0.2) kk *= 0.82; // pits
        rgba[p] = mix(c0[0], c1[0], t) * kk; rgba[p + 1] = mix(c0[1], c1[1], t) * kk; rgba[p + 2] = mix(c0[2], c1[2], t) * kk; rgba[p + 3] = 255;
        ht[i] = b * 0.75 + (mid[i] - 0.5) * 0.12 + (hi[i] - 0.5) * 0.12 + tint * 0.04; rh[i] = (o.glossy ?? 0.82) + (hi[i] - 0.5) * 0.12 - b * 0.04;
      }
    }
    return finish(S, S, rgba, ht, rh, o.bump ?? 3.0);
  },
  // poured concrete / road: pores, speckle, stains, hairline cracks, optional expansion seams
  concrete(o) {
    const S = o.size, sd = o.seed, lo = fbm2(S, S, sd, 3, 3, 4), mid = fbm2(S, S, sd + 5, 16, 16, 3, 0.55), hi = fbm2(S, S, sd + 9, 128, 128, 2, 0.7), g = grit(S, S, sd + 13, 0.25), st = fbm2(S, S, sd + 31, 4, 4, 3), pit = fbm2(S, S, sd + 41, 70, 70, 1);
    const c0 = rgb(o.colors[0]), c1 = rgb(o.colors[1]); const rgba = new Uint8ClampedArray(S * S * 4), ht = new Float32Array(S * S), rh = new Float32Array(S * S); const crack = crackField(S, sd + 21, o.cracks ?? 0.7);
    const seam = o.seam ?? 0; const aggr = !!o.aggregate;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, p = i * 4; const t = clamp(lo[i] * 1.1 + (mid[i] - 0.5) * 0.5 - 0.05); let k = (0.86 + hi[i] * 0.28) * (0.9 + g[i] * 0.2);
      k *= 1 - clamp((st[i] - 0.58) * 2.4) * 0.28; let pt = 0; if (pit[i] > 0.74) { pt = sstep(0.74, 0.8, pit[i]); k *= 1 - pt * 0.3; }
      if (aggr) { const a = g[(i * 13) % g.length]; if (a > 0.86) k *= 1.25; else if (a < 0.1) k *= 0.7; }
      const cr = crack[i]; k *= 1 - cr * 0.5; let sm = 0; if (seam) { const dx = Math.min(x % (S / seam), S / seam - (x % (S / seam))), dy = Math.min(y % (S / seam), S / seam - (y % (S / seam))); sm = (Math.min(dx, dy) < S * 0.004) ? 1 : 0; k *= 1 - sm * 0.55; }
      rgba[p] = mix(c0[0], c1[0], t) * k; rgba[p + 1] = mix(c0[1], c1[1], t) * k; rgba[p + 2] = mix(c0[2], c1[2], t) * k; rgba[p + 3] = 255;
      ht[i] = hi[i] * 0.4 + mid[i] * 0.2 - pt * 0.5 - cr * 0.7 - sm * 0.8 + g[i] * 0.1; rh[i] = (o.rough ?? 0.9) + (hi[i] - 0.5) * 0.1 - st[i] * 0.05;
    }
    return finish(S, S, rgba, ht, rh, o.bump ?? 2.6);
  },
  // weathered planks: grain, knots, splits, silvered where the sun hits
  wood(o) {
    const S = o.size, sd = o.seed, planks = o.cols ?? 5, pw = S / planks, r = rngf(sd + 3); const tint = [], off = []; for (let i = 0; i < planks; i++) { tint.push(r()); off.push(r() * S); }
    const grain = fbm2(S, S, sd, 90, 3, 3, 0.55), lo = fbm2(S, S, sd + 5, 5, 5, 3), g = grit(S, S, sd + 13, 0.2), kn = fbm2(S, S, sd + 9, 7, 7, 2); const c0 = rgb(o.colors[0]), c1 = rgb(o.colors[1]);
    const rgba = new Uint8ClampedArray(S * S * 4), ht = new Float32Array(S * S), rh = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, p = i * 4, pl = Math.min(planks - 1, Math.floor(x / pw)), lx = x - pl * pw, ed = Math.min(lx, pw - lx);
      const gy = (y + off[pl]) % S; const gi = Math.floor(gy) * S + x; const gr = grain[gi];
      const ring = 0.5 + 0.5 * Math.sin(lx * 0.35 + gr * 9 + tint[pl] * 12 + kn[i] * 6);
      const t = clamp(tint[pl] * 0.45 + ring * 0.3 + lo[i] * 0.3); let k = (0.84 + gr * 0.3) * (0.94 + g[i] * 0.12);
      if (kn[i] > 0.74) k *= 1 - sstep(0.74, 0.82, kn[i]) * 0.4; let seam = 0; if (ed < S * 0.006) { seam = 1; k *= 0.35; }
      rgba[p] = mix(c0[0], c1[0], t) * k; rgba[p + 1] = mix(c0[1], c1[1], t) * k; rgba[p + 2] = mix(c0[2], c1[2], t) * k; rgba[p + 3] = 255;
      ht[i] = gr * 0.5 + (ring - 0.5) * 0.2 - seam * 0.8 - (kn[i] > 0.74 ? 0.25 : 0); rh[i] = 0.82 + (gr - 0.5) * 0.15 + seam * 0.1;
    }
    return finish(S, S, rgba, ht, rh, o.bump ?? 2.4);
  },
  // painted steel: ribs optional, chipped paint showing rust, scuffs and edge wear
  steel(o) {
    const S = o.size, sd = o.seed, ribs = o.ribs ?? 0, lo = fbm2(S, S, sd, 3, 3, 4), mid = fbm2(S, S, sd + 5, 18, 18, 3, 0.55), hi = fbm2(S, S, sd + 9, 110, 110, 2, 0.7), g = grit(S, S, sd + 13, 0.2), rust = fbm2(S, S, sd + 11, 6, 6, 4), sc = fbm2(S, S, sd + 19, 60, 3, 2, 0.6);
    const c0 = rgb(o.colors[0]), c1 = rgb(o.colors[1]); const rgba = new Uint8ClampedArray(S * S * 4), ht = new Float32Array(S * S), rh = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, p = i * 4; const rb = ribs ? 0.5 + 0.5 * Math.sin((x / S) * ribs * Math.PI * 2) : 0.5;
      const t = clamp(lo[i] * 0.9 + (mid[i] - 0.5) * 0.4); let k = (0.86 + hi[i] * 0.26) * (0.94 + g[i] * 0.12) * (ribs ? 0.74 + rb * 0.36 : 1);
      const rs = clamp((rust[i] - 0.56) * 3.4) * (0.4 + 0.6 * (1 - y / S)) * (o.rust ?? 1); if (sc[i] > 0.72) k *= 1.15; // scuffed paint reads lighter
      let r = mix(c0[0], c1[0], t) * k, gg = mix(c0[1], c1[1], t) * k, b = mix(c0[2], c1[2], t) * k;
      r = mix(r, 118 * k, rs * 0.75); gg = mix(gg, 62 * k, rs * 0.75); b = mix(b, 34 * k, rs * 0.75);
      rgba[p] = r; rgba[p + 1] = gg; rgba[p + 2] = b; rgba[p + 3] = 255; ht[i] = (ribs ? rb * 1.1 : 0) + hi[i] * 0.2 + rs * 0.3 + g[i] * 0.05; rh[i] = 0.5 + rs * 0.4 + (hi[i] - 0.5) * 0.15 + (sc[i] > 0.72 ? 0.12 : 0);
    }
    return finish(S, S, rgba, ht, rh, o.bump ?? 2.4);
  },
};
// thin meandering cracks (value 1 on the crack, 0 elsewhere, soft falloff)
function crackField(S, seed, amount = 0.7) {
  const n = 7, r = rngf(seed), px = [], py = []; for (let i = 0; i < n * n; i++) { px.push(r()); py.push(r()); }
  const warp = fbm2(S, S, seed + 3, 8, 8, 2), out = new Float32Array(S * S); const w = S * 0.0028;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = (x / S) * n + (warp[y * S + x] - 0.5) * 0.35, fy = (y / S) * n + (warp[((y + 17) % S) * S + x] - 0.5) * 0.35, cx = Math.floor(fx), cy = Math.floor(fy); let d1 = 9, d2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const gx = cx + ox, gy = cy + oy, k = (((gy % n) + n) % n) * n + (((gx % n) + n) % n); const dx = gx + px[k] - fx, dy = gy + py[k] - fy, d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = (d2 - d1) * (S / n); out[y * S + x] = clamp(1 - e / w) * (warp[y * S + x] < amount ? 1 : 0);
  }
  return out;
}

const cache = new Map();
// kind: "ground" | "pave" | "concrete" | "wood" | "steel".  opts: { seed, colors:[dark, light], size, ...kind options }
export function makeReal(kind, opts = {}) {
  const key = kind + JSON.stringify(opts); if (cache.has(key)) return cache.get(key);
  const o = { seed: 1, colors: ["#6a6458", "#a8a090"], size: 512, ...opts }; const out = GEN[kind](o); cache.set(key, out); return out;
}
export function cloneReal(s, rx, ry = rx) { const out = {}; for (const k of Object.keys(s)) { const t = s[k].clone(); t.needsUpdate = true; t.repeat.set(rx, ry); out[k] = t; } return out; }
export { fbm2, field, grit, rngf, sstep, mix, clamp, rgb };
