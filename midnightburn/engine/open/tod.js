// Midnight Burn — time of day. One table says how the whole world looks at night, at dusk and at golden hour (Upgrade 23: the colour grade, glow and
// building colours were toned down for a more natural, photographic look):
// sky colours, the sun or moon, haze, how bright the street lamps / lit windows / signs are, the colour grade and the glow.
// render.js reads this table and applies it; nothing else in the game needs to know what time it is.
// Upgrade 23: the hours now pass by themselves (sunset -> dusk -> night -> back to sunset). TOD_CYCLE below is the timetable and
// blendTod() mixes two of these looks so the change is a slow fade, never a jump. Players can no longer pick the time.
import * as THREE from "three";

export const TOD_LIST = [["night", "NIGHT"], ["dusk", "DUSK"], ["golden", "GOLDEN HOUR"]];
const dir = (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };

export const TOD = {
  // ---------------------------------------------------------------- night: exactly what the game always looked like
  night: {
    name: "night", exposure: 1.18,
    bloom: { strength: 0.56, radius: 0.55, threshold: 0.78 },
    sky: { top: 0x03030c, mid: null, hor: 0x2a1830, glow: 0x000000, glowK: 0, curve: 0.45 },
    fog: { color: 0x0a0a1c, near: 120, far: 980 },
    ambient: { color: 0x7e84b0, i: 1.05, iLite: 1.45 }, hemi: { sky: 0x7080e0, ground: 0x30203a, i: 0.8, iLite: 0.9 },
    sun: { color: 0x8fa0ff, i: 1.5, iLite: 0.5, dir: [-200 / 396, 300 / 396, 120 / 396], bias: -0.0005, extent: 100 },
    disc: { show: true, color: 0xdfe6ff, radius: 120, I: 1, haloColor: 0x8fa0ff, haloOp: 0.32, haloSize: 1200, at: [-1800, 1400, -2500] },
    stars: 0.8, clouds: { color: 0x9fb0e0, op: 0.5 }, haze: 1,
    lampK: 1, winK: 1, shopK: 1, signK: 1, headK: 1, embers: 1, embColor: 0xffa860,
    sheen: 0.55, ground: 0x05080f, sea: 0x06202e, seaEnv: 1.2,
    grade: { shadow: [0.90, 1.0, 1.12], high: [1.08, 1.0, 0.92], teal: [0.82, 1.02, 1.22], tealK: 0.3, sat: 1.03, con: 1.07, vig: 0.42 },
    env: { top: 0x0b1230, mid: 0x4b1e55, hor: 0xff7a4a, low: 0x07080f, bandK: 1.5, skyK: 0.9, bld: 1, win: 1, lamp: 1, neon: 1, sun: null, box: [0xdde6ff, 2.4], strip: 1, floor: 0x07080d, moon: true },
  },
  // ---------------------------------------------------------------- dusk: the sun has just gone, the sky is orange to violet, the lamps are on
  dusk: {
    name: "dusk", exposure: 1.2,
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.84 },
    sky: { top: 0x0d1b45, mid: 0x5b3f86, hor: 0xff8f52, glow: 0xff6a2a, glowK: 1.15, curve: 0.55, glowW: 0.5 },
    fog: { color: 0x7a4f6e, near: 70, far: 1050 },
    ambient: { color: 0x8f86b4, i: 0.92, iLite: 1.2 }, hemi: { sky: 0x7d7fd0, ground: 0x4a3040, i: 0.95, iLite: 1.05 },
    sun: { color: 0xff9456, i: 2.1, iLite: 1.0, dir: dir(215, 7), bias: -0.0008, extent: 125 },
    disc: { show: true, color: 0xff7a3a, radius: 105, I: 5, haloColor: 0xff7a3a, haloOp: 0.7, haloSize: 3000, at: null },
    stars: 0.3, clouds: { color: 0xe08a70, op: 0.62 }, haze: 0.8,
    lampK: 1, winK: 0.85, shopK: 1, signK: 0.95, headK: 1, embers: 0.5, embColor: 0xffc890,
    sheen: 0.5, ground: 0x1a1426, sea: 0x1a2c48, seaEnv: 1.5,
    grade: { shadow: [0.92, 0.98, 1.1], high: [1.1, 1.0, 0.86], teal: [0.86, 1.0, 1.18], tealK: 0.22, sat: 1.06, con: 1.07, vig: 0.42 },
    env: { top: 0x1a2a66, mid: 0x7a4a92, hor: 0xffa060, low: 0x2a1c30, bandK: 1.6, skyK: 1.1, bld: 2.2, win: 0.8, lamp: 0.9, neon: 0.9, sun: { color: 0xff8a40, I: 38, r: 16, dir: dir(215, 7), d: 150 }, box: [0xffc9a0, 2.6], strip: 0.95, floor: 0x1a1218, moon: false },
  },
  // ---------------------------------------------------------------- golden hour: low warm sun, long shadows, haze, lamps still off
  golden: {
    name: "golden", exposure: 1.14,
    bloom: { strength: 0.34, radius: 0.65, threshold: 0.97 },
    sky: { top: 0x2c62b4, mid: 0x8fb4de, hor: 0xffc680, glow: 0xffb050, glowK: 1.6, curve: 0.5, glowW: 0.55 },
    fog: { color: 0xe3b685, near: 55, far: 1050 },
    ambient: { color: 0xdccbb8, i: 0.86, iLite: 1.0 }, hemi: { sky: 0xb0c0e2, ground: 0x9a7a54, i: 1.08, iLite: 1.0 },
    sun: { color: 0xffb468, i: 5.4, iLite: 3.1, dir: dir(215, 15), bias: -0.001, extent: 135 },
    disc: { show: true, color: 0xfff0cc, radius: 85, I: 7, haloColor: 0xffc070, haloOp: 0.85, haloSize: 3400, at: null },
    stars: 0, clouds: { color: 0xffd9ae, op: 0.5 }, haze: 0.25,
    lampK: 0.08, winK: 0.1, shopK: 0.45, signK: 0.5, headK: 0.0, embers: 0.4, embColor: 0xffe2b0,
    sheen: 0.42, ground: 0x6b5a46, sea: 0x1d4c62, seaEnv: 1.6,
    grade: { shadow: [0.95, 1.0, 1.07], high: [1.12, 1.0, 0.82], teal: [0.92, 1.0, 1.08], tealK: 0.1, sat: 1.0, con: 1.05, vig: 0.36 },
    env: { top: 0x3d7ad0, mid: 0x9ec0e6, hor: 0xffd29a, low: 0x6a5a48, bandK: 1.4, skyK: 1.7, bld: 5, win: 0.1, lamp: 0.1, neon: 0.2, sun: { color: 0xffcf96, I: 16, r: 14, dir: dir(215, 15), d: 150 }, box: [0xfff0dc, 3.2], strip: 0.8, floor: 0x5a4c3e, moon: false },
  },
};
export const todByName = (n) => TOD[n] || TOD.night;
export const todSunDir = (T) => T.sun.dir;

const C = (h) => new THREE.Color(h);
// sky dome colours: horizon -> (mid) -> top, plus a glow round the sun
export function paintSky(geo, T) {
  const s = T.sky, pos = geo.attributes.position, top = C(s.top), hor = C(s.hor), mid = s.mid != null ? C(s.mid) : null, glow = C(s.glow), col = [];
  const sd = T.sun.dir, R = 3800, tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / R, y = pos.getY(i) / R, z = pos.getZ(i) / R; const t = Math.max(0, Math.min(1, y));
    if (mid) { const k = Math.pow(t, s.curve); if (k < 0.5) tmp.copy(hor).lerp(mid, k * 2); else tmp.copy(mid).lerp(top, (k - 0.5) * 2); } else tmp.copy(hor).lerp(top, Math.pow(t, s.curve));
    if (s.glowK) { const d = x * sd[0] + y * sd[1] + z * sd[2]; const a = Math.max(0, d); const g = (Math.pow(a, 6) * 0.7 + Math.pow(a, 24) * 0.9) * s.glowK * (1 - 0.7 * Math.min(1, Math.max(0, y) * 1.4)); tmp.r += glow.r * g; tmp.g += glow.g * g; tmp.b += glow.b * g; }
    // below the horizon the dome keeps the haze colour so the sea and far ground melt into it
    if (y < 0) tmp.copy(hor);
    col.push(tmp.r, tmp.g, tmp.b);
  }
  if (geo.attributes.color) { geo.attributes.color.array.set(col); geo.attributes.color.needsUpdate = true; } else geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
}

// ====================================================================== the automatic day ======================================================================
// [from, to, seconds of play]. A row with the same look on both ends is a "hold"; any other row is a slow fade between two looks.
// Sunset opens every session, dusk follows as the lamps come on, then a long night, and the glow slowly returns.
export const TOD_CYCLE = [
  ["golden", "golden", 120], ["golden", "dusk", 100], ["dusk", "dusk", 50], ["dusk", "night", 110],
  ["night", "night", 330], ["night", "dusk", 90], ["dusk", "dusk", 30], ["dusk", "golden", 90],
];
// Upgrade 34: every session opens at dusk (the lamps are just coming on) instead of sunset, and the day then moves on by itself
export const TOD_START = 220;
export const TOD_CYCLE_LEN = TOD_CYCLE.reduce((a, r) => a + r[2], 0);
const SEG_LABEL = [["SUNSET", "SUNSET"], ["SUNSET", "DUSK"], ["DUSK", "DUSK"], ["DUSK", "NIGHT"], ["NIGHT", "NIGHT"], ["NIGHT", "PRE-DAWN"], ["PRE-DAWN", "PRE-DAWN"], ["PRE-DAWN", "DAWN"]];
const smooth = (x) => x * x * (3 - 2 * x);
// where in the day are we? t is seconds of play; returns the two looks to mix, how far between them (0..1), and a name for the clock
export function cycleAt(t) {
  let u = ((t % TOD_CYCLE_LEN) + TOD_CYCLE_LEN) % TOD_CYCLE_LEN;
  for (let i = 0; i < TOD_CYCLE.length; i++) {
    const [a, b, d] = TOD_CYCLE[i];
    if (u < d || i === TOD_CYCLE.length - 1) {
      const raw = Math.min(1, u / d), k = a === b ? 0 : smooth(raw);
      return { a, b, k, hold: a === b, seg: i, label: SEG_LABEL[i][raw < 0.5 ? 0 : 1], nearest: raw < 0.5 ? a : b };
    }
    u -= d;
  }
  return { a: "night", b: "night", k: 0, hold: true, seg: 0, label: "NIGHT", nearest: "night" };
}

const COLOR_KEYS = new Set(["top", "mid", "hor", "glow", "color", "haloColor", "sky", "ground", "sea", "low", "floor", "embColor"]);
const _ca = new THREE.Color(), _cb = new THREE.Color();
const mixHex = (x, y, k) => _ca.setHex(x).lerp(_cb.setHex(y), k).getHex();
function mixV(a, b, k, key) {
  if (a === b) return a;
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === "number") return COLOR_KEYS.has(key) ? mixHex(a, b, k) : a + (b - a) * k;
  if (Array.isArray(a)) return a.map((v, i) => mixV(v, b[i], k, key === "box" && i === 0 ? "color" : undefined));
  if (typeof a === "object") { const o = {}; for (const kk of new Set([...Object.keys(a), ...Object.keys(b)])) o[kk] = mixV(a[kk], b[kk], k, kk); return o; }
  return k < 0.5 ? a : b;
}
const discPos = (T) => (T.disc.at ? T.disc.at.slice() : T.sun.dir.map((v) => v * 3400));
// A smooth mix of two looks. The sky's two-colour night gradient is rewritten as the identical three-colour one so nothing pops at the start of a fade.
export function blendTod(A, B, k) {
  if (A === B || k <= 0) return A;
  if (k >= 1) return B;
  const three = (T) => (T.sky.mid != null ? T : { ...T, sky: { ...T.sky, mid: mixHex(T.sky.hor, T.sky.top, 0.5) } });
  const a = three(A), b = three(B);
  const o = mixV(a, b, k);
  o.name = k < 0.5 ? A.name : B.name;
  const d = o.sun.dir, n = Math.hypot(d[0], d[1], d[2]) || 1; o.sun.dir = [d[0] / n, d[1] / n, d[2] / n];
  o.env = k < 0.5 ? A.env : B.env; // the reflection map is only rebuilt once, half way through a fade
  o.disc.show = true;
  const moonA = !!A.disc.at, moonB = !!B.disc.at;
  if (moonA === moonB) { o.discPos = mixV(discPos(A), discPos(B), k); o.discFade = 1; }
  else {
    // the sun sinks out of sight and fades; then the moon rises and brightens (or the reverse)
    const pa = discPos(A), pb = discPos(B), low = (p) => [p[0], -380, p[2]];
    if (k < 0.5) { const e = smooth(k * 2); o.discPos = mixV(pa, low(pa), e); o.discFade = 1 - e; Object.assign(o.disc, A.disc, { show: true }); }
    else { const e = smooth((k - 0.5) * 2); o.discPos = mixV(low(pb), pb, e); o.discFade = e; Object.assign(o.disc, B.disc, { show: true }); }
  }
  return o;
}
