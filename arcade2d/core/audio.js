// Sound for the 2D kit: every effect and every music loop is made on the fly with the browser's Web Audio.
// There are no sound files to host. Muting uses the same switch as the rest of the site (lib/sound.js).
import { isMuted } from "@/lib/sound";
import { rng, clamp } from "./util";

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, comp = null;

function ensure() {
  if (ctx || typeof window === "undefined") return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try {
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    const len = ctx.sampleRate * 1.5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
export function unlock() { const c = ensure(); if (c && c.state === "suspended") c.resume().catch(() => {}); return !!c; }
const live = () => ctx && ctx.state === "running" && !isMuted();
export function applyMute() { if (musicBus && ctx) musicBus.gain.setTargetAtTime(isMuted() ? 0 : 0.32, ctx.currentTime, 0.02); }

// ---- building blocks -----------------------------------------------------------------------------------------------
export function tone({ type = "square", f0 = 440, f1 = null, dur = 0.15, vol = 0.2, delay = 0, attack = 0.004, detune = 0, bus = null, lp = 0 }) {
  if (!live()) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); node = f; }
  node.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.03);
}
export function noise({ dur = 0.2, vol = 0.2, delay = 0, filter = "lowpass", f0 = 2000, f1 = null, q = 1, bus = null, attack = 0.002 }) {
  if (!live()) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = filter; f.Q.value = q; f.frequency.setValueAtTime(Math.max(30, f0), t);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.03);
}
const notes = (arr, base = {}) => arr.forEach(([f, d, delay, vol]) => tone({ ...base, f0: f, dur: d, delay, vol: vol ?? base.vol ?? 0.15 }));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- named effects (r = tiny random pitch change so repeats do not sound identical) ------------------------------------
const R = () => 0.94 + Math.random() * 0.12;
const SFX = {
  click: () => tone({ type: "square", f0: 700, f1: 980, dur: 0.05, vol: 0.09 }),
  tick: () => tone({ type: "triangle", f0: 1400, dur: 0.025, vol: 0.08 }),
  back: () => tone({ type: "square", f0: 520, f1: 330, dur: 0.07, vol: 0.09 }),
  jump: () => { const r = R(); tone({ type: "square", f0: 300 * r, f1: 720 * r, dur: 0.15, vol: 0.1 }); },
  jump2: () => { const r = R(); tone({ type: "square", f0: 420 * r, f1: 900 * r, dur: 0.14, vol: 0.09 }); noise({ dur: 0.05, vol: 0.04, filter: "highpass", f0: 3000 }); },
  land: () => { tone({ type: "sine", f0: 140, f1: 55, dur: 0.09, vol: 0.18 }); noise({ dur: 0.06, vol: 0.06, f0: 700 }); },
  step: () => noise({ dur: 0.03, vol: 0.025, filter: "bandpass", f0: 900 * R(), q: 0.8 }),
  coin: () => { tone({ type: "square", f0: 988, dur: 0.07, vol: 0.09 }); tone({ type: "square", f0: 1319, dur: 0.16, vol: 0.09, delay: 0.07 }); },
  gem: () => notes([[880, 0.08, 0], [1175, 0.08, 0.06], [1568, 0.14, 0.12]], { type: "triangle", vol: 0.12 }),
  stomp: () => { tone({ type: "square", f0: 260, f1: 70, dur: 0.12, vol: 0.14 }); noise({ dur: 0.07, vol: 0.08, f0: 1500 }); },
  hurt: () => { tone({ type: "sawtooth", f0: 420, f1: 110, dur: 0.28, vol: 0.14 }); noise({ dur: 0.12, vol: 0.06, f0: 900 }); },
  die: () => notes([[392, 0.14, 0], [330, 0.14, 0.14], [262, 0.14, 0.28], [196, 0.4, 0.42]], { type: "sawtooth", vol: 0.12 }),
  kill: () => { const r = R(); tone({ type: "triangle", f0: 480 * r, f1: 1100 * r, dur: 0.1, vol: 0.14 }); noise({ dur: 0.08, vol: 0.06, filter: "bandpass", f0: 2200 }); },
  powerup: () => notes([[523, 0.08, 0], [659, 0.08, 0.07], [784, 0.08, 0.14], [1047, 0.08, 0.21], [1319, 0.2, 0.28]], { type: "square", vol: 0.1 }),
  heal: () => notes([[660, 0.1, 0], [880, 0.1, 0.09], [1320, 0.2, 0.18]], { type: "sine", vol: 0.16 }),
  spring: () => tone({ type: "sine", f0: 180, f1: 980, dur: 0.22, vol: 0.18 }),
  bump: () => tone({ type: "triangle", f0: 170, f1: 105, dur: 0.09, vol: 0.2 }),
  breakblock: () => { noise({ dur: 0.18, vol: 0.14, filter: "highpass", f0: 1200 }); tone({ type: "square", f0: 240, f1: 90, dur: 0.1, vol: 0.08 }); },
  checkpoint: () => notes([[587, 0.1, 0], [740, 0.1, 0.08], [880, 0.25, 0.16]], { type: "triangle", vol: 0.15 }),
  door: () => { tone({ type: "sawtooth", f0: 110, f1: 70, dur: 0.3, vol: 0.1 }); noise({ dur: 0.25, vol: 0.05, f0: 500 }); },
  key: () => notes([[1047, 0.07, 0], [1568, 0.14, 0.06]], { type: "triangle", vol: 0.14 }),
  pickup: () => tone({ type: "triangle", f0: 660, f1: 990, dur: 0.1, vol: 0.14 }),
  // guns and blasts
  pistol: () => { noise({ dur: 0.09, vol: 0.2, filter: "bandpass", f0: 2200, f1: 500, q: 0.7 }); tone({ type: "square", f0: 900, f1: 180, dur: 0.08, vol: 0.09 }); },
  smg: () => { noise({ dur: 0.06, vol: 0.16, filter: "bandpass", f0: 2600, f1: 700, q: 0.7 }); tone({ type: "square", f0: 1000 * R(), f1: 260, dur: 0.05, vol: 0.07 }); },
  shotgun: () => { noise({ dur: 0.28, vol: 0.3, filter: "lowpass", f0: 3500, f1: 250 }); tone({ type: "sine", f0: 130, f1: 45, dur: 0.22, vol: 0.28 }); },
  laser: () => { tone({ type: "sawtooth", f0: 1700, f1: 280, dur: 0.16, vol: 0.09 }); tone({ type: "square", f0: 850, f1: 140, dur: 0.14, vol: 0.05 }); },
  rocket: () => { noise({ dur: 0.4, vol: 0.18, filter: "lowpass", f0: 900, f1: 200 }); tone({ type: "sawtooth", f0: 160, f1: 90, dur: 0.3, vol: 0.1 }); },
  explode: () => { noise({ dur: 0.65, vol: 0.4, filter: "lowpass", f0: 1800, f1: 90 }); tone({ type: "sine", f0: 100, f1: 28, dur: 0.55, vol: 0.4 }); },
  boom: () => { noise({ dur: 1.0, vol: 0.5, filter: "lowpass", f0: 2200, f1: 70 }); tone({ type: "sine", f0: 80, f1: 22, dur: 0.9, vol: 0.5 }); },
  reload: () => { tone({ type: "square", f0: 300, dur: 0.03, vol: 0.1 }); tone({ type: "square", f0: 220, dur: 0.04, vol: 0.1, delay: 0.16 }); },
  empty: () => tone({ type: "square", f0: 200, dur: 0.04, vol: 0.09 }),
  impact: () => noise({ dur: 0.05, vol: 0.1, filter: "bandpass", f0: 3000, q: 1.2 }),
  swing: () => noise({ dur: 0.12, vol: 0.12, filter: "bandpass", f0: 600, f1: 2400, q: 1.5 }),
  punch: () => { noise({ dur: 0.07, vol: 0.2, filter: "lowpass", f0: 1400, f1: 300 }); tone({ type: "sine", f0: 170, f1: 70, dur: 0.1, vol: 0.2 }); },
  // physics-y thuds
  thudWood: () => { const r = R(); tone({ type: "sine", f0: 200 * r, f1: 90, dur: 0.11, vol: 0.2 }); noise({ dur: 0.07, vol: 0.09, filter: "bandpass", f0: 900 }); },
  thudStone: () => { const r = R(); tone({ type: "sine", f0: 130 * r, f1: 55, dur: 0.14, vol: 0.24 }); noise({ dur: 0.09, vol: 0.08, f0: 600 }); },
  thudGlass: () => { const r = R(); tone({ type: "triangle", f0: 2400 * r, f1: 1800, dur: 0.16, vol: 0.1 }); noise({ dur: 0.14, vol: 0.09, filter: "highpass", f0: 5000 }); },
  thudIce: () => { const r = R(); tone({ type: "triangle", f0: 1500 * r, f1: 900, dur: 0.14, vol: 0.1 }); noise({ dur: 0.1, vol: 0.07, filter: "highpass", f0: 3500 }); },
  crackWood: () => { noise({ dur: 0.2, vol: 0.2, filter: "bandpass", f0: 1100, f1: 400, q: 0.8 }); tone({ type: "square", f0: 190, f1: 70, dur: 0.12, vol: 0.09 }); },
  crackStone: () => { noise({ dur: 0.3, vol: 0.24, filter: "lowpass", f0: 1000, f1: 150 }); tone({ type: "sine", f0: 100, f1: 40, dur: 0.25, vol: 0.28 }); },
  shatter: () => { noise({ dur: 0.35, vol: 0.2, filter: "highpass", f0: 4500, f1: 2200 }); tone({ type: "triangle", f0: 3000, f1: 800, dur: 0.2, vol: 0.08 }); },
  launch: () => { tone({ type: "sine", f0: 260, f1: 980, dur: 0.18, vol: 0.2 }); noise({ dur: 0.22, vol: 0.12, filter: "bandpass", f0: 400, f1: 2600, q: 1 }); },
  stretch: () => tone({ type: "triangle", f0: 110, f1: 190, dur: 0.12, vol: 0.05 }),
  pop: () => { tone({ type: "sine", f0: 380, f1: 1250, dur: 0.12, vol: 0.2 }); noise({ dur: 0.1, vol: 0.08, filter: "bandpass", f0: 2400 }); },
  whoosh: () => noise({ dur: 0.25, vol: 0.1, filter: "bandpass", f0: 300, f1: 2000, q: 1.2 }),
  splash: () => { noise({ dur: 0.4, vol: 0.2, filter: "lowpass", f0: 2400, f1: 300 }); tone({ type: "sine", f0: 500, f1: 150, dur: 0.2, vol: 0.1 }); },
  bubble: () => tone({ type: "sine", f0: 400 * R(), f1: 900, dur: 0.09, vol: 0.12 }),
  place: () => { tone({ type: "square", f0: 330, f1: 440, dur: 0.07, vol: 0.1 }); },
  upgrade: () => notes([[440, 0.08, 0], [554, 0.08, 0.07], [659, 0.08, 0.14], [880, 0.2, 0.21]], { type: "triangle", vol: 0.14 }),
  card: () => { noise({ dur: 0.09, vol: 0.1, filter: "bandpass", f0: 1800, f1: 900 }); tone({ type: "triangle", f0: 520, f1: 640, dur: 0.06, vol: 0.06 }); },
  bell: () => { tone({ type: "sine", f0: 1568, dur: 0.6, vol: 0.14 }); tone({ type: "sine", f0: 2349, dur: 0.45, vol: 0.07 }); },
  star: () => { tone({ type: "sine", f0: 1318, dur: 0.5, vol: 0.14 }); tone({ type: "sine", f0: 1975, dur: 0.4, vol: 0.08 }); tone({ type: "triangle", f0: 2637, dur: 0.3, vol: 0.05, delay: 0.04 }); },
  win: () => notes([[523, 0.14, 0], [659, 0.14, 0.12], [784, 0.14, 0.24], [1047, 0.5, 0.36]], { type: "square", vol: 0.11 }),
  lose: () => notes([[392, 0.2, 0], [349, 0.2, 0.18], [311, 0.2, 0.36], [262, 0.5, 0.54]], { type: "triangle", vol: 0.16 }),
  alarm: () => { tone({ type: "square", f0: 880, dur: 0.12, vol: 0.07 }); tone({ type: "square", f0: 660, dur: 0.12, vol: 0.07, delay: 0.14 }); },
  combo: () => { tone({ type: "triangle", f0: 700, f1: 1400, dur: 0.1, vol: 0.12 }); },
  swap: () => { tone({ type: "triangle", f0: 400, f1: 560, dur: 0.07, vol: 0.1 }); },
  match: () => notes([[523, 0.08, 0], [659, 0.08, 0.06], [784, 0.12, 0.12]], { type: "triangle", vol: 0.13 }),
  fuse: () => noise({ dur: 0.12, vol: 0.05, filter: "highpass", f0: 4000 }),
};
export const sfx = new Proxy({}, { get: (_, name) => (...a) => { try { SFX[name] && SFX[name](...a); } catch {} } });

// ---- music: small procedural band (bass, pad, arp, lead, drums) -----------------------------------------------------------
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], mixo: [0, 2, 4, 5, 7, 9, 10], lyd: [0, 2, 4, 6, 7, 9, 11] };
export const MUSIC = {
  sunny: { bpm: 138, root: 60, mode: "major", prog: [0, 4, 5, 3], seed: 11, lead: "square", feel: "bounce", drums: 2 },
  cave: { bpm: 104, root: 55, mode: "dorian", prog: [0, 5, 3, 4], seed: 21, lead: "triangle", feel: "walk", drums: 1 },
  sky: { bpm: 120, root: 62, mode: "lyd", prog: [0, 1, 4, 0], seed: 31, lead: "sine", feel: "float", drums: 1 },
  fire: { bpm: 150, root: 52, mode: "phrygian", prog: [0, 1, 0, 5], seed: 41, lead: "sawtooth", feel: "drive", drums: 3 },
  city: { bpm: 126, root: 45, mode: "minor", prog: [0, 5, 2, 6], seed: 51, lead: "sawtooth", feel: "drive", drums: 3 },
  tense: { bpm: 112, root: 43, mode: "phrygian", prog: [0, 0, 1, 5], seed: 61, lead: "square", feel: "walk", drums: 2 },
  boss: { bpm: 160, root: 40, mode: "minor", prog: [0, 5, 0, 6], seed: 71, lead: "sawtooth", feel: "drive", drums: 3 },
  calm: { bpm: 84, root: 57, mode: "pent", prog: [0, 3, 2, 4], seed: 81, lead: "sine", feel: "float", drums: 0 },
  snow: { bpm: 100, root: 64, mode: "major", prog: [0, 5, 3, 4], seed: 91, lead: "triangle", feel: "float", drums: 1 },
  spooky: { bpm: 96, root: 50, mode: "minor", prog: [0, 3, 5, 4], seed: 101, lead: "triangle", feel: "walk", drums: 1 },
  space: { bpm: 132, root: 52, mode: "dorian", prog: [0, 2, 5, 4], seed: 111, lead: "square", feel: "drive", drums: 2 },
  puzzle: { bpm: 92, root: 60, mode: "pent", prog: [0, 2, 3, 1], seed: 121, lead: "triangle", feel: "float", drums: 0 },
};
let mus = { theme: null, timer: 0, step: 0, next: 0, data: null, intensity: 0.6 };
function buildTheme(t) {
  const r = rng(t.seed), sc = SCALES[t.mode], deg = (d) => { const o = Math.floor(d / sc.length); return sc[((d % sc.length) + sc.length) % sc.length] + 12 * o; };
  const motif = []; let cur = r.int(0, 4);
  for (let i = 0; i < 16; i++) { if (r.chance(0.55)) { cur = clamp(cur + r.pick([-2, -1, -1, 1, 1, 2]), -2, 9); motif.push(cur); } else motif.push(null); }
  const motifB = motif.map((m, i) => (m != null && r.chance(0.35) ? m + r.pick([-1, 1, 2]) : m));
  return { ...t, deg, motif, motifB, arpPat: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1].map((x) => x) };
}
function playStep(m, s, time) {
  const t = m.data, bar = Math.floor(s / 16) % 4, st = s % 16, chord = t.prog[bar], I = mus.intensity;
  const root = t.root, f = (d, oct = 0) => mtof(root + t.deg(d) + 12 * oct);
  const when = time - ctx.currentTime;
  // bass
  const bassHit = t.feel === "drive" ? st % 2 === 0 : t.feel === "bounce" ? st % 4 === 0 || st % 8 === 6 : t.feel === "walk" ? st % 4 === 0 : st % 8 === 0;
  if (bassHit) tone({ type: t.feel === "drive" ? "sawtooth" : "triangle", f0: f(chord, -1) * (st % 8 === 6 ? 1.5 : 1), dur: t.feel === "float" ? 0.45 : 0.16, vol: 0.17, delay: when, bus: musicBus, lp: 700 });
  // pad
  if (st === 0) { for (const k of [0, 2, 4]) tone({ type: "sine", f0: f(chord + k, 0), dur: 60 / t.bpm * 4 * 0.95, vol: 0.045, attack: 0.25, delay: when, bus: musicBus }); }
  // arp
  if (I > 0.25 && t.feel !== "float" || (t.feel === "float" && st % 2 === 0 && I > 0.2)) { const k = t.arpPat[st]; tone({ type: "square", f0: f(chord + k * 2, 1), dur: 0.09, vol: 0.035, delay: when, bus: musicBus, lp: 2400 }); }
  // lead (second half of every 2nd bar is the variation)
  if (I > 0.45) { const mot = bar % 2 === 0 ? t.motif : t.motifB, n = mot[st]; if (n != null) tone({ type: t.lead, f0: f(n + chord, 1), dur: 0.14, vol: 0.06, delay: when, bus: musicBus, lp: 3200 }); }
  // drums
  if (t.drums > 0 && I > 0.2) {
    if (st % 4 === 0) tone({ type: "sine", f0: 150, f1: 42, dur: 0.13, vol: 0.2, delay: when, bus: musicBus });
    if (t.drums >= 2 && (st === 4 || st === 12)) noise({ dur: 0.1, vol: 0.09, filter: "bandpass", f0: 1800, q: 0.8, delay: when, bus: musicBus });
    if (t.drums >= 2 && st % 2 === 1) noise({ dur: 0.03, vol: 0.035, filter: "highpass", f0: 7000, delay: when, bus: musicBus });
    if (t.drums >= 3 && st % 2 === 0) noise({ dur: 0.025, vol: 0.03, filter: "highpass", f0: 8000, delay: when, bus: musicBus });
  }
}
export const music = {
  play(name = "sunny") {
    if (!unlock() || !ctx) return;
    if (mus.theme === name && mus.timer) return;
    this.stop(); const t = MUSIC[name] || MUSIC.sunny; mus.theme = name; mus.data = buildTheme(t); mus.step = 0; mus.next = ctx.currentTime + 0.08;
    mus.timer = setInterval(() => {
      if (!ctx || !mus.data) return;
      if (ctx.state !== "running" || isMuted()) { mus.next = ctx.currentTime + 0.1; return; }
      const stepLen = 60 / mus.data.bpm / 4;
      while (mus.next < ctx.currentTime + 0.22) { playStep(mus, mus.step, mus.next); mus.next += stepLen; mus.step++; }
    }, 55);
  },
  stop() { if (mus.timer) clearInterval(mus.timer); mus.timer = 0; mus.theme = null; },
  intensity(v) { mus.intensity = clamp(v, 0, 1); },
};
