// Operation Blacksite — what people are made of. Every soldier's cloth, nylon gear, skin, hair, boots and helmet is drawn here on the fly
// (no image files ship) as three maps that work together: a colour map (kept near-white so each soldier's own colour can tint it),
// a bump ("normal") map so the weave, stitching and pores catch the light, and on some a patchy gloss map.
// All maps tile seamlessly. Parts are UV-mapped in metres (see boxUV in soldier.js), so each texture's repeat is simply 1 / its real size.
import * as THREE from "three";
import { cpuCanvas } from "./cpucanvas";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rngf(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// smooth value noise that repeats every cx x cy cells (so it tiles), summed over octaves
function field(w, h, cx, cy, seed) {
  const r = rngf(seed), lat = new Float32Array(cx * cy); for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * cy, y0 = Math.floor(fy), t0 = fy - y0, ty = t0 * t0 * (3 - 2 * t0), ya = (y0 % cy) * cx, yb = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * cx, x0 = Math.floor(fx), s0 = fx - x0, tx = s0 * s0 * (3 - 2 * s0), xa = x0 % cx, xb = (x0 + 1) % cx;
      const a = lat[ya + xa], b = lat[ya + xb], c = lat[yb + xa], d = lat[yb + xb];
      out[y * w + x] = a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
    }
  }
  return out;
}
function fbm(w, h, seed, cx, cy, oct = 4, gain = 0.5) {
  const out = new Float32Array(w * h); let amp = 1, tot = 0, ax = cx, ay = cy;
  for (let o = 0; o < oct; o++) { const f = field(w, h, ax, ay, seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += f[i] * amp; tot += amp; amp *= gain; ax *= 2; ay *= 2; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
const white = (w, h, seed) => { const r = rngf(seed), a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };

// height -> tangent-space normal map
function normalCanvas(w, h, H, strength) {
  const c = cpuCanvas(w, h), g = c.getContext("2d"), im = g.createImageData(w, h), d = im.data;
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), p = (y * w + x) * 4;
    d[p] = (-dx / l * 0.5 + 0.5) * 255; d[p + 1] = (dy / l * 0.5 + 0.5) * 255; d[p + 2] = (1 / l * 0.5 + 0.5) * 255; d[p + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function greyCanvas(w, h, V) { const c = cpuCanvas(w, h), g = c.getContext("2d"), im = g.createImageData(w, h), d = im.data; for (let i = 0; i < w * h; i++) { const v = clamp(V[i]) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); return c; }
function rgbCanvas(w, h, R, G, B) { const c = cpuCanvas(w, h), g = c.getContext("2d"), im = g.createImageData(w, h), d = im.data; for (let i = 0; i < w * h; i++) { d[i * 4] = clamp(R[i]) * 255; d[i * 4 + 1] = clamp(G[i]) * 255; d[i * 4 + 2] = clamp(B[i]) * 255; d[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); return c; }
function texture(c, srgb, sizeU, sizeV = sizeU) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / sizeU, 1 / sizeV); return t;
}

// ---- the surfaces ---------------------------------------------------------------------------------------------------------------------------
// Each returns { map, normalMap, roughnessMap?, nScale, rough, sheen } and is made once.
const cache = {};
const memo = (k, f) => cache[k] || (cache[k] = f());

// Uniform cloth: a twill (fine diagonal ribs) with slightly uneven threads, a little fading and lint. Tile = 4 cm.
function twill(kind) {
  return memo("tw" + kind, () => {
    const S = 256, H = new Float32Array(S * S), A = new Float32Array(S * S), un = fbm(S, S, 11 + kind.length, 4, 4, 3), fine = white(S, S, 5), fade = fbm(S, S, 41, 2, 2, 3);
    const ripstop = kind === "ripstop", period = kind === "denim" ? 10 : 6; const wr = fbm(S, S, 77 + kind.length, 3, 2, 3, 0.45); // soft creases a few cm long
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x; const diag = Math.sin(((x + y) / period) * Math.PI * 2) * 0.5 + 0.5; const warp = Math.sin((x / 3) * Math.PI) * 0.5 + 0.5;
      let h = diag * 0.7 + warp * 0.18 + (fine[i] - 0.5) * 0.12 + (un[i] - 0.5) * 0.25;
      if (ripstop) { const gx = Math.min(x % 42, 42 - (x % 42)), gy = Math.min(y % 42, 42 - (y % 42)); h += (gx < 2 ? 0.55 : 0) + (gy < 2 ? 0.55 : 0); }
      H[i] = h + wr[i] * 9; A[i] = 0.9 + (diag - 0.5) * 0.06 + (un[i] - 0.5) * 0.1 + (fade[i] - 0.5) * 0.12 - Math.max(0, 0.5 - wr[i]) * 0.1;
    }
    let Rc = A, Gc = A, Bc = A;
    if (kind === "denim") { Rc = new Float32Array(S * S); Gc = new Float32Array(S * S); Bc = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { const y = Math.floor(i / S), x = i % S; const d = Math.sin(((x + y) / period) * Math.PI * 2) * 0.5 + 0.5; const k = A[i] * (0.82 + d * 0.3) + (fade[i] - 0.5) * 0.35; Rc[i] = 0.2 * k + 0.05; Gc[i] = 0.28 * k + 0.06; Bc[i] = 0.46 * k + 0.08; } }
    return { map: texture(rgbCanvas(S, S, Rc, Gc, Bc), true, 0.07), normalMap: texture(normalCanvas(S, S, H, ripstop ? 1.0 : 0.8), false, 0.07), nScale: 0.75, rough: 0.92, sheen: 0.18 };
  });
}

// Woodland-style camouflage for the Nightfall trousers and jackets: soft organic blobs in four earth tones over the twill. Tile = 45 cm.
function camo(scheme) {
  return memo("camo" + scheme, () => {
    const S = 512, a = fbm(S, S, 71 + scheme, 3, 3, 4, 0.55), b = fbm(S, S, 93 + scheme, 4, 4, 4, 0.55), c2 = fbm(S, S, 117 + scheme, 6, 6, 3, 0.5), grain = white(S, S, 3);
    const P = scheme === 1 ? [[0.62, 0.55, 0.42], [0.47, 0.42, 0.3], [0.33, 0.3, 0.21], [0.24, 0.2, 0.15]] : [[0.5, 0.5, 0.38], [0.36, 0.38, 0.26], [0.27, 0.24, 0.17], [0.17, 0.17, 0.14]];
    const R = new Float32Array(S * S), G = new Float32Array(S * S), B = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      let col = P[0]; if (a[i] > 0.53) col = P[1]; if (b[i] > 0.57) col = P[2]; if (c2[i] > 0.62 && a[i] < 0.5) col = P[3];
      const n = 1 + (grain[i] - 0.5) * 0.08; R[i] = col[0] * n * 0.95; G[i] = col[1] * n * 0.95; B[i] = col[2] * n * 0.95;
    }
    const tw = twill("twill");
    return { map: texture(rgbCanvas(S, S, R, G, B), true, 0.45), normalMap: tw.normalMap, nScale: 0.55, rough: 0.92, sheen: 0.18 };
  });
}

// Fleece / jersey for hoodies: soft, fuzzy, almost no pattern. Tile = 5 cm.
function fleece() {
  return memo("fleece", () => { const S = 128, f = fbm(S, S, 201, 16, 16, 3, 0.6), w = white(S, S, 9), H = new Float32Array(S * S), A = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { H[i] = f[i] * 0.6 + w[i] * 0.4; A[i] = 0.88 + (f[i] - 0.5) * 0.12; } return { map: texture(greyCanvas(S, S, A), true, 0.05), normalMap: texture(normalCanvas(S, S, H, 1.1), false, 0.05), nScale: 0.6, rough: 0.97, sheen: 0.18 }; });
}

// Knitted wool (beanies, balaclavas): rows of little V stitches. Tile = 3 cm.
function knit() {
  return memo("knit", () => {
    const S = 128, H = new Float32Array(S * S), A = new Float32Array(S * S), w = white(S, S, 33);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const cx = (x % 8) - 4, cy = (y % 8) + Math.abs(cx) * 0.9; const v = Math.max(0, 1 - Math.abs(Math.sin((cy / 8) * Math.PI)) * 0.2 - Math.abs(cx) / 5); const i = y * S + x; H[i] = v * 0.8 + w[i] * 0.2; A[i] = 0.8 + v * 0.2; }
    return { map: texture(greyCanvas(S, S, A), true, 0.03), normalMap: texture(normalCanvas(S, S, H, 2.4), false, 0.03), nScale: 0.9, rough: 0.98, sheen: 0.18 };
  });
}

// Cordura nylon (pouches, straps): a tight basket weave with a faint sheen. Tile = 2 cm.
function cordura() {
  return memo("cordura", () => { const S = 128, H = new Float32Array(S * S), A = new Float32Array(S * S), u = fbm(S, S, 301, 4, 4, 3), w = white(S, S, 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; const bx = Math.sin((x / 2) * Math.PI), by = Math.sin((y / 2) * Math.PI); H[i] = (bx * by) * 0.35 + w[i] * 0.2 + u[i] * 0.3; A[i] = 0.88 + (u[i] - 0.5) * 0.14 + (w[i] - 0.5) * 0.05; } return { map: texture(greyCanvas(S, S, A), true, 0.02), normalMap: texture(normalCanvas(S, S, H, 1.2), false, 0.02), nScale: 0.5, rough: 0.8, sheen: 0.35 }; });
}

// Plate-carrier panels: Cordura with MOLLE webbing — rows of 1-inch strap, 1 inch apart, stitched down every 1.5 inch. Tile = 7.62 x 5.08 cm.
function molle() {
  return memo("molle", () => {
    const Wp = 240, Hp = 160, H = new Float32Array(Wp * Hp), A = new Float32Array(Wp * Hp), R = new Float32Array(Wp * Hp), w = white(Wp, Hp, 77), u = fbm(Wp, Hp, 333, 6, 4, 3);
    for (let y = 0; y < Hp; y++) for (let x = 0; x < Wp; x++) {
      const i = y * Wp + x; const inBand = y >= 40 && y < 120; const edge = inBand ? Math.min(y - 40, 119 - y) : 99; const tack = inBand && (x % 120 < 7);
      let h = Math.sin((x / 2) * Math.PI) * Math.sin((y / 2) * Math.PI) * 0.12 + w[i] * 0.08 + u[i] * 0.15;
      if (inBand) { h += 0.85 + Math.sin((y / 3) * Math.PI) * 0.06 - (edge < 3 ? (3 - edge) * 0.12 : 0); if (tack) h -= 0.25 + ((y % 6) < 3 ? 0.08 : 0); }
      H[i] = h; A[i] = (inBand ? 0.82 : 0.9) + (u[i] - 0.5) * 0.12 + (tack ? -0.05 : 0); R[i] = inBand ? 0.66 : 0.82;
      if (inBand && (edge === 4 || edge === 5) && x % 6 < 4) { A[i] += 0.05; H[i] += 0.05; } // stitching along the strap
    }
    return { map: texture(greyCanvas(Wp, Hp, A), true, 0.0762, 0.0508), normalMap: texture(normalCanvas(Wp, Hp, H, 3.2), false, 0.0762, 0.0508), roughnessMap: texture(greyCanvas(Wp, Hp, R), false, 0.0762, 0.0508), nScale: 0.9, rough: 1, sheen: 0.3 };
  });
}

// Boot leather: pebbled grain with creases. Tile = 6 cm.
function leather() {
  return memo("leather", () => { const S = 128, cell = fbm(S, S, 401, 24, 24, 2, 0.4), c2 = fbm(S, S, 405, 5, 5, 3), H = new Float32Array(S * S), A = new Float32Array(S * S), R = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { const pb = sstep(0.42, 0.62, cell[i]); H[i] = pb * 0.6 + c2[i] * 0.4; A[i] = 0.82 + pb * 0.1 + (c2[i] - 0.5) * 0.2; R[i] = 0.5 + (1 - pb) * 0.2 + (c2[i] - 0.5) * 0.2; } return { map: texture(greyCanvas(S, S, A), true, 0.06), normalMap: texture(normalCanvas(S, S, H, 2.0), false, 0.06), roughnessMap: texture(greyCanvas(S, S, R), false, 0.06), nScale: 0.7, rough: 1, sheen: 0 }; });
}

// Moulded polymer (helmet shells, knee and elbow pads, boot soles): a fine stipple. Tile = 3 cm.
function polymer() {
  return memo("polymer", () => { const S = 128, w = white(S, S, 501), f = fbm(S, S, 503, 8, 8, 2), H = new Float32Array(S * S), A = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { H[i] = w[i] * 0.5 + f[i] * 0.5; A[i] = 0.92 + (f[i] - 0.5) * 0.1; } return { map: texture(greyCanvas(S, S, A), true, 0.03), normalMap: texture(normalCanvas(S, S, H, 0.9), false, 0.03), nScale: 0.5, rough: 0.72, sheen: 0 }; });
}

// Skin away from the face (necks, forearms, hands): pores, faint freckles and blotches. Tile = 4 cm.
function skin() {
  return memo("skin", () => {
    const S = 256, p = white(S, S, 601), b = fbm(S, S, 603, 4, 4, 4), fr = white(S, S, 607), H = new Float32Array(S * S), Rr = new Float32Array(S * S), Gg = new Float32Array(S * S), Bb = new Float32Array(S * S), R = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) { const pore = p[i] > 0.93 ? -0.6 : 0; H[i] = pore + b[i] * 0.4; const red = (b[i] - 0.5) * 0.12, frk = fr[i] > 0.996 ? -0.1 : 0; Rr[i] = 0.96 + red * 0.4 + frk; Gg[i] = 0.93 - red * 0.6 + frk * 1.3; Bb[i] = 0.92 - red * 0.6 + frk * 1.5; R[i] = 0.52 + (b[i] - 0.5) * 0.25 + (pore ? 0.1 : 0); }
    return { map: texture(rgbCanvas(S, S, Rr, Gg, Bb), true, 0.04), normalMap: texture(normalCanvas(S, S, H, 0.9), false, 0.04), roughnessMap: texture(greyCanvas(S, S, R), false, 0.04), nScale: 0.35, rough: 1, sheen: 0.25 };
  });
}

// Short hair: fine strands running one way (down the head), with bright and dark strands. Tile = 2 x 4 cm.
function hair() {
  return memo("hair", () => { const S = 128, H = new Float32Array(S * S), A = new Float32Array(S * S), st = fbm(S, S, 701, 64, 2, 2, 0.5), w = white(S, S, 703); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; H[i] = st[i] * 0.8 + w[i] * 0.2; A[i] = 0.7 + st[i] * 0.45; } return { map: texture(greyCanvas(S, S, A), true, 0.02, 0.04), normalMap: texture(normalCanvas(S, S, H, 2.6), false, 0.02, 0.04), nScale: 0.8, rough: 0.62, sheen: 0.18 }; });
}

// Rubber (soles, glove palms): matt and slightly gritty. Tile = 2 cm.
function rubber() {
  return memo("rubber", () => { const S = 64, w = white(S, S, 801), f = fbm(S, S, 803, 4, 4, 2), H = new Float32Array(S * S), A = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { H[i] = w[i] * 0.6 + f[i] * 0.4; A[i] = 0.9 + (f[i] - 0.5) * 0.1; } return { map: texture(greyCanvas(S, S, A), true, 0.02), normalMap: texture(normalCanvas(S, S, H, 0.8), false, 0.02), nScale: 0.4, rough: 0.9, sheen: 0 }; });
}

// Shemagh: a woven check with a thin tasselled stripe, in two colourways. Tile = 12 cm.
function shemagh(scheme) {
  return memo("shem" + scheme, () => {
    const S = 256, R = new Float32Array(S * S), G = new Float32Array(S * S), B = new Float32Array(S * S), w = white(S, S, 901);
    const ink = scheme === 0 ? [0.55, 0.1, 0.09] : scheme === 1 ? [0.08, 0.08, 0.08] : [0.32, 0.3, 0.2], base = scheme === 2 ? [0.5, 0.47, 0.37] : [0.66, 0.64, 0.58];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; const gx = x % 32, gy = y % 32; const diag = ((x + y) % 32 < 6) || ((x - y + 256) % 32 < 6); let on = (gx < 4 || gy < 4) || (diag && gx > 8 && gx < 24 && gy > 8 && gy < 24); if ((y % 128) < 3) on = true; const k = on ? ink : base; const n = 1 + (w[i] - 0.5) * 0.12; R[i] = k[0] * n; G[i] = k[1] * n; B[i] = k[2] * n; }
    return { map: texture(rgbCanvas(S, S, R, G, B), true, 0.12), normalMap: twill("twill").normalMap, nScale: 0.6, rough: 0.95, sheen: 0.18 };
  });
}

// ---- materials --------------------------------------------------------------------------------------------------------------------------------
// quality: "low" uses plain matt materials with colour maps only; everything else gets the bump maps and, on fabric and skin, a soft sheen
// (the velvety edge light real cloth and skin have) through the physical material.
const mats = {};
function made(key, q, surf, extra = {}) {
  const k = key + "|" + q; if (mats[k]) return mats[k];
  const hi = q !== "low"; const s = surf; const { sheenTint, ...rest } = extra;
  const base = { map: s.map, vertexColors: true, roughness: s.rough, metalness: 0, ...rest };
  if (hi && s.normalMap) { base.normalMap = s.normalMap; base.normalScale = new THREE.Vector2(s.nScale, s.nScale); }
  if (hi && s.roughnessMap) base.roughnessMap = s.roughnessMap;
  let m;
  if (hi && s.sheen > 0) {
    // cloth sheen takes the cloth's own colour (three.js would otherwise add a flat white haze over dark fabric)
    m = new THREE.MeshPhysicalMaterial({ ...base, sheen: s.sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color(sheenTint ?? 0xffffff) });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <lights_physical_fragment>", THREE.ShaderChunk.lights_physical_fragment.replace("material.sheenColor = sheenColor;", "material.sheenColor = sheenColor * diffuseColor.rgb;")); };
    m.customProgramCacheKey = () => "bs-tinted-sheen";
  } else m = new THREE.MeshStandardMaterial(base);
  m.name = "bs-" + key; return (mats[k] = m);
}
export function bodyMaterial(key, q = "high") {
  switch (key) {
    case "twill": return made(key, q, twill("twill"));
    case "ripstop": return made(key, q, twill("ripstop"));
    case "denim": return made(key, q, twill("denim"));
    case "camo0": return made(key, q, camo(0));
    case "camo1": return made(key, q, camo(1));
    case "fleece": return made(key, q, fleece());
    case "knit": return made(key, q, knit());
    case "cordura": return made(key, q, cordura());
    case "molle": return made(key, q, molle());
    case "leather": return made(key, q, leather());
    case "polymer": return made(key, q, polymer());
    case "rubber": return made(key, q, rubber());
    case "skin": return made(key, q, skin(), { sheenTint: 0xff9a80 });
    case "hair": return made(key, q, hair());
    case "shem0": return made(key, q, shemagh(0));
    case "shem1": return made(key, q, shemagh(1));
    case "shem2": return made(key, q, shemagh(2));
    case "armband": return made(key, q, twill("twill"), { emissive: new THREE.Color(0x6a1a10), emissiveIntensity: 0.55 }); // brick-red cloth, faintly lit so the side reads at night
    case "polymerDS": return made(key, q, polymer(), { side: THREE.DoubleSide }); // helmet shells: seen from inside too
    case "cordDS": return made(key, q, cordura(), { side: THREE.DoubleSide });
    case "eyewhite": return mats["eyewhite"] || (mats["eyewhite"] = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
    case "lens": return lensMat("glasses");
    case "goggle": return lensMat("goggles");
    case "buckle": return mats["buckle"] || (mats["buckle"] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }));
    default: return null;
  }
}

// shooting glasses / goggles: a tinted, glossy lens you can still see the eyes through, cut to shape by an alpha map drawn over the
// lens strip's UVs (u runs across the face, v up it)
function lensMat(kind) {
  return memo("lens" + kind, () => {
    const c = cpuCanvas(256, 64), g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#fff";
    if (kind === "glasses") { for (const cx of [86, 170]) { g.beginPath(); g.moveTo(cx - 40, 14); g.quadraticCurveTo(cx, 4, cx + 40, 12); g.quadraticCurveTo(cx + 44, 44, cx + 22, 56); g.quadraticCurveTo(cx, 62, cx - 26, 54); g.quadraticCurveTo(cx - 44, 40, cx - 40, 14); g.fill(); } }
    else { g.beginPath(); g.moveTo(14, 12); g.quadraticCurveTo(128, 0, 242, 12); g.quadraticCurveTo(250, 50, 226, 58); g.quadraticCurveTo(170, 62, 140, 48); g.quadraticCurveTo(128, 40, 116, 48); g.quadraticCurveTo(86, 62, 30, 58); g.quadraticCurveTo(6, 50, 14, 12); g.fill(); }
    const a = new THREE.CanvasTexture(c);
    return new THREE.MeshPhysicalMaterial({ color: kind === "glasses" ? 0x2a2f33 : 0x3a4048, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: kind === "glasses" ? 0.62 : 0.5, alphaMap: a, alphaTest: 0.3, depthWrite: false, envMapIntensity: 0.9, side: THREE.DoubleSide });
  });
}

// a cloth patch with a word on it (e.g. SENTINEL across the back of a plate carrier): grey reflective-style letters on dark cloth.
const patchMats = {};
export function patchMaterial(text, bg = "#15171a", fg = "#b9c0c8", glow = 0) {
  const k = text + bg + fg + glow; if (patchMats[k]) return patchMats[k];
  const c = cpuCanvas(512, 128), g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  const r = rngf(text.length * 13); for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`; g.fillRect(r() * 512, r() * 128, 1.5, 1.5); }
  g.strokeStyle = "rgba(255,255,255,0.18)"; g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeRect(8, 8, 496, 112); g.setLineDash([]);
  g.font = "800 78px Arial Black, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = fg; g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0, emissive: new THREE.Color(0xffffff), emissiveMap: t, emissiveIntensity: glow });
  return (patchMats[k] = m);
}

// ---- faces ------------------------------------------------------------------------------------------------------------------------------------
// One 512 px face per look, painted onto the front of the head: real skin colour drift (warmer cheeks, nose and ears, a cooler jaw where stubble
// grows, darker round the eyes), eyelid creases and lashes (the eyes themselves are separate glossy balls), brows drawn hair by hair, natural lips,
// beards in strokes, and for balaclavas the knitted wool with an eye slot. A shared bump map carries pores and a few lines.
const faceCache = {};
const hx = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
// where the features sit on the head, in head units (the head is ~0.156 wide before the bone's scale). soldier.js sculpts the same places.
export const FACE = { eyeX: 0.0262, eyeY: 0.01, eyeR: 0.0118, noseY: -0.024, mouthY: -0.044, chinY: -0.078 };
export function faceMaps(look) {
  if (faceCache[look.key]) return faceCache[look.key];
  const S = 512, c = cpuCanvas(S, S), g = c.getContext("2d"), r = rngf(look.seed * 7 + 11);
  const L = hx(look.skinPair[0]);
  // head UVs: u = 0.5 + X / 0.164, v = 0.52 + Y / 0.236 (see headGeo). K = pixels per head unit across, KY = down.
  const K = S / 0.164, KY = S / 0.236; const P = (X, Y) => [(0.5 + X / 0.164) * S, (1 - (0.52 + Y / 0.236)) * S];
  const eyeL = P(-FACE.eyeX, FACE.eyeY), eyeR = P(FACE.eyeX, FACE.eyeY), nose = P(0, FACE.noseY), mouth = P(0, FACE.mouthY), chin = P(0, FACE.chinY);
  const im = g.createImageData(S, S), d = im.data; const blot = fbm(S, S, look.seed + 3, 6, 6, 4), grain = white(S, S, look.seed + 9);
  const eyeW = 0.0135 * K, lidH = 0.0052 * KY;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, p = i * 4; let k = 1 + (blot[i] - 0.5) * 0.1 + (grain[i] - 0.5) * 0.03; let rr = 0, gg = 0, bb = 0;
    // warmer (redder) cheeks, nose tip and lips area; a slightly cooler jaw; darker skin round the eyes
    const cheek = Math.min(Math.hypot((x - eyeL[0]) / 1.2, y - (eyeL[1] + 0.022 * KY)), Math.hypot((x - eyeR[0]) / 1.2, y - (eyeR[1] + 0.022 * KY)));
    const warm = Math.max(0, 1 - cheek / (0.02 * K)) * 0.09 + Math.max(0, 1 - Math.hypot(x - nose[0], y - nose[1]) / (0.013 * K)) * 0.08;
    rr += warm; gg -= warm * 0.45; bb -= warm * 0.5;
    const eyeD = Math.min(Math.hypot((x - eyeL[0]) / 1.4, (y - eyeL[1]) * 1.1), Math.hypot((x - eyeR[0]) / 1.4, (y - eyeR[1]) * 1.1)); const ring = Math.max(0, 1 - eyeD / (0.016 * K));
    k *= 1 - ring * 0.18; bb += ring * 0.015; rr += ring * 0.01;
    const jaw = sstep(mouth[1] - 0.012 * KY, chin[1], y) * sstep(0.2 * S, 0.34 * S, Math.min(x, S - x));
    if (look.beard) { k *= 1 - jaw * 0.1 * look.beard; } else { k *= 1 - jaw * 0.04; bb += jaw * 0.012; gg += jaw * 0.004; }
    d[p] = clamp(L[0] * k + rr) * 255; d[p + 1] = clamp(L[1] * k + gg) * 255; d[p + 2] = clamp(L[2] * k + bb) * 255; d[p + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const H = hx(look.hair); const hairCss = (a) => `rgba(${(H[0] * 255) | 0},${(H[1] * 255) | 0},${(H[2] * 255) | 0},${a})`;
  if (!look.mask) {
    // beard or stubble: short strokes along the jaw, chin and upper lip
    if (look.beard) {
      const n = look.beard === 2 ? 9000 : 4200, mw = 0.021 * K;
      for (let i = 0; i < n; i++) {
        const x = S * 0.18 + r() * S * 0.64, y = mouth[1] - 0.016 * KY + r() * (chin[1] - mouth[1] + 0.035 * KY);
        const half = S * 0.33 - Math.max(0, y - mouth[1]) * 0.55; if (Math.abs(x - S / 2) > half) continue;
        if (Math.abs(x - S / 2) < mw && y > mouth[1] - 0.004 * KY && y < mouth[1] + 0.007 * KY) continue; // keep the lips clear
        if (y < mouth[1] - 0.004 * KY && Math.abs(x - S / 2) > mw * 1.15) continue; // only a moustache above the lip
        g.strokeStyle = hairCss(look.beard === 2 ? 0.45 + r() * 0.45 : 0.18 + r() * 0.24); g.lineWidth = 0.8 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - S / 2) * 0.01 + (r() - 0.5) * 2, y + 1.5 + r() * (look.beard === 2 ? 6 : 2.5)); g.stroke();
      }
    }
    // lips: soft, a touch darker and redder than the skin, with the line between them
    const lc = `rgba(${Math.min(255, L[0] * 210 + 28) | 0},${(L[1] * 130) | 0},${(L[2] * 125) | 0},`;
    const mw = 0.0205 * K, ul = 0.0042 * KY, ll = 0.0058 * KY;
    g.fillStyle = lc + "0.5)"; g.beginPath(); g.moveTo(mouth[0] - mw, mouth[1]); g.quadraticCurveTo(mouth[0] - mw * 0.4, mouth[1] - ul * 1.4, mouth[0], mouth[1] - ul * 0.9); g.quadraticCurveTo(mouth[0] + mw * 0.4, mouth[1] - ul * 1.4, mouth[0] + mw, mouth[1]); g.quadraticCurveTo(mouth[0], mouth[1] + 2, mouth[0] - mw, mouth[1]); g.fill();
    g.fillStyle = lc + "0.42)"; g.beginPath(); g.moveTo(mouth[0] - mw * 0.92, mouth[1] + 1); g.quadraticCurveTo(mouth[0], mouth[1] + ll * 2.2, mouth[0] + mw * 0.92, mouth[1] + 1); g.quadraticCurveTo(mouth[0], mouth[1] + 3, mouth[0] - mw * 0.92, mouth[1] + 1); g.fill();
    g.strokeStyle = "rgba(60,24,20,0.7)"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(mouth[0] - mw, mouth[1] + 0.5); g.quadraticCurveTo(mouth[0], mouth[1] + 3.5, mouth[0] + mw, mouth[1] + 0.5); g.stroke();
    g.fillStyle = "rgba(255,240,230,0.08)"; g.beginPath(); g.ellipse(mouth[0], mouth[1] + ll * 1.2, mw * 0.4, ll * 0.4, 0, 0, Math.PI * 2); g.fill(); // light on the lower lip
    // nostrils and the soft shadow under the nose; smile lines
    const nx = 0.0085 * K, ny = nose[1] + 0.004 * KY;
    g.fillStyle = "rgba(35,16,12,0.45)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(nose[0] + s * nx, ny, 0.0034 * K, 0.0018 * KY, s * 0.35, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(60,28,20,0.12)"; g.beginPath(); g.ellipse(nose[0], ny + 0.006 * KY, 0.012 * K, 0.004 * KY, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(70,34,24,0.13)"; g.lineWidth = 6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(nose[0] + s * 0.013 * K, nose[1] + 0.001 * KY); g.quadraticCurveTo(nose[0] + s * 0.024 * K, mouth[1] - 0.004 * KY, nose[0] + s * 0.024 * K, mouth[1] + 0.01 * KY); g.stroke(); }
  } else {
    // balaclava: knitted wool everywhere except the eye slot
    const mc = hx(look.maskColor); g.save(); g.beginPath(); g.rect(0, 0, S, S);
    const t = eyeL[1] - 0.009 * KY, b = eyeL[1] + 0.011 * KY, l = eyeL[0] - 0.02 * K, rr2 = eyeR[0] + 0.02 * K;
    g.moveTo(l, t + 8); g.quadraticCurveTo(S / 2, t - 10, rr2, t + 8); g.quadraticCurveTo(rr2 + 8, b, rr2 - 14, b + 4); g.quadraticCurveTo(S / 2, b - 6, l + 14, b + 4); g.quadraticCurveTo(l - 8, b, l, t + 8); g.clip("evenodd");
    g.fillStyle = `rgb(${(mc[0] * 255) | 0},${(mc[1] * 255) | 0},${(mc[2] * 255) | 0})`; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 6) for (let x = (y / 6) % 2 ? 0 : 3.5; x < S; x += 7) { g.fillStyle = "rgba(255,255,255,0.07)"; g.beginPath(); g.ellipse(x, y, 2.4, 3.4, 0.45, 0, 7); g.fill(); g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x + 1, y + 2.5, 2.5, 1.2); }
    g.restore(); g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 5; g.beginPath(); g.moveTo(l, t + 8); g.quadraticCurveTo(S / 2, t - 10, rr2, t + 8); g.stroke();
  }
  // eyes: socket shade, eyelid crease, the dark lash line along the upper lid, a faint lower lid (the eyeballs are real glossy balls)
  for (const [ex, ey] of [eyeL, eyeR]) {
    const so = g.createRadialGradient(ex, ey, eyeW * 0.4, ex, ey, eyeW * 1.45); so.addColorStop(0, "rgba(45,20,16,0.26)"); so.addColorStop(1, "rgba(45,20,16,0)"); g.fillStyle = so; g.beginPath(); g.ellipse(ex, ey, eyeW * 1.5, eyeW * 1.15, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(70,32,24,0.4)"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(ex - eyeW * 1.05, ey - lidH * 0.3); g.quadraticCurveTo(ex, ey - lidH * 2.7, ex + eyeW * 1.1, ey - lidH * 0.3); g.stroke();
    g.strokeStyle = "rgba(14,7,5,0.95)"; g.lineWidth = 4; g.beginPath(); g.moveTo(ex - eyeW, ey + lidH * 0.15); g.quadraticCurveTo(ex - eyeW * 0.2, ey - lidH * 1.7, ex + eyeW, ey); g.stroke();
    g.strokeStyle = "rgba(80,40,30,0.35)"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(ex - eyeW * 0.9, ey + lidH * 0.4); g.quadraticCurveTo(ex, ey + lidH * 1.6, ex + eyeW * 0.9, ey + lidH * 0.35); g.stroke();
  }
  // eyebrows, drawn hair by hair from the inner end outwards
  for (const [ex, ey, s] of [[eyeL[0], eyeL[1], -1], [eyeR[0], eyeR[1], 1]]) {
    const inner = ex - s * 0.012 * K, outer = ex + s * 0.02 * K, by0 = ey - 0.0175 * KY;
    for (let i = 0; i < 420; i++) { const t = r(); const bx = inner + (outer - inner) * t, by = by0 - Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.75) * 0.0035 * KY + (1 - t) * 3 + (r() - 0.5) * (8 - t * 4); g.strokeStyle = hairCss(look.mask ? 0.55 : 0.3 + r() * 0.55); g.lineWidth = 1 + r() * 0.9; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + s * (4 + r() * 6) * (0.4 + t), by - 2 - r() * 2.5 + t * 2.5); g.stroke(); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  // shared bump for faces: pores and a couple of forehead lines
  const nrm = memo("faceN", () => { const S2 = 512, w = white(S2, S2, 1001), f = fbm(S2, S2, 1003, 12, 12, 3), H2 = new Float32Array(S2 * S2); for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) { const i = y * S2 + x; H2[i] = (w[i] > 0.92 ? -0.45 : 0) + f[i] * 0.35 + (y > 80 && y < 130 && Math.abs(Math.sin(y * 0.31)) < 0.06 ? -0.18 : 0); } const t = new THREE.CanvasTexture(normalCanvas(S2, S2, H2, 1.1)); t.anisotropy = 8; return t; });
  return (faceCache[look.key] = { map, normalMap: nrm });
}

// the coloured part of an eye (iris with fibres, a dark limbal ring, the pupil) on a white ball, mapped onto a sphere's UVs
const irisCache = {};
export function irisTexture(col) {
  if (irisCache[col]) return irisCache[col];
  const S = 128, c = cpuCanvas(S, S), g = c.getContext("2d"); const C = hx(col);
  g.fillStyle = "#e9e2d6"; g.fillRect(0, 0, S, S);
  // sphere UVs: u runs round the ball (front, facing -Z, is u = 0.75), v from top to bottom. A round iris therefore spans twice as much v as u.
  const cx = S * 0.75, cy = S * 0.5, R = S * 0.083;
  const veins = rngf(col); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(175,70,60,${0.06 + veins() * 0.1})`; g.lineWidth = 0.6; g.beginPath(); const a = veins() * 6.28; g.moveTo(cx + Math.cos(a) * S * 0.24, cy + Math.sin(a) * S * 0.45); g.lineTo(cx + Math.cos(a) * R * 1.5, cy + Math.sin(a) * R * 3); g.stroke(); }
  g.save(); g.translate(cx, cy); g.scale(1, 2);
  const gr = g.createRadialGradient(0, 0, R * 0.25, 0, 0, R); gr.addColorStop(0, `rgb(${(C[0] * 150) | 0},${(C[1] * 150) | 0},${(C[2] * 130) | 0})`); gr.addColorStop(0.65, `rgb(${(C[0] * 255) | 0},${(C[1] * 255) | 0},${(C[2] * 255) | 0})`); gr.addColorStop(0.9, `rgb(${(C[0] * 110) | 0},${(C[1] * 110) | 0},${(C[2] * 110) | 0})`); gr.addColorStop(1, "rgba(18,12,8,0.95)");
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 44; i++) { const a = (i / 44) * 6.28; g.strokeStyle = "rgba(255,255,255,0.13)"; g.lineWidth = 0.5; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38); g.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85); g.stroke(); }
  g.fillStyle = "#040303"; g.beginPath(); g.arc(0, 0, R * 0.36, 0, Math.PI * 2); g.fill(); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (irisCache[col] = t);
}
const eyeMats = {};
export function eyeMaterial(col, q = "high") {
  const k = col + q; if (eyeMats[k]) return eyeMats[k];
  return (eyeMats[k] = q === "low" ? new THREE.MeshStandardMaterial({ map: irisTexture(col), roughness: 0.3 }) : new THREE.MeshPhysicalMaterial({ map: irisTexture(col), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 }));
}
