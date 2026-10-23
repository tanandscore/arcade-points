// Original, procedurally generated soundtracks for the flagship games. Nothing
// here is sampled or borrowed — every note is synthesised live by the browser's
// audio engine, so there are no files to download or license.
//
//   "ash"       Kingdoms of Ash   — slow, smoky, medieval: plucked harp, low strings,
//                                    war drums that wake up when raiders arrive.
//   "olympus"   Wrath of Olympus  — big and heroic: choir, timpani, brass, storm.
//   "blacksite" Operation Blacksite — tense and modern: pulsing sub-bass, ticking
//                                    clock, drums and arpeggios in a firefight,
//                                    and a heartbeat of beeps when the bomb is down.
//
// The same sequencer drives the live game and the offline test render.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate); const d = buf.getChannelData(0);
  let s = 1234567; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  return buf;
}
function makeImpulse(ctx, seconds, decay) {
  const n = Math.floor(ctx.sampleRate * seconds); const buf = ctx.createBuffer(2, n, ctx.sampleRate); let s = 98765;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / n, decay); } }
  return buf;
}
const drive = (amt) => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amt); } return c; };

const PRESETS = {
  ash: {
    bpm: 70, volume: 0.3, reverb: [3.4, 2.2], echo: 0.75,
    chords: [
      { root: 38, notes: [50, 53, 57, 62], motif: [69, 72, 74, 72, 69, 65] }, // Dm
      { root: 34, notes: [46, 50, 53, 58], motif: [70, 74, 72, 70, 65, 62] }, // Bb
      { root: 41, notes: [53, 57, 60, 65], motif: [72, 69, 65, 69, 72, 77] }, // F
      { root: 36, notes: [48, 52, 55, 60], motif: [67, 72, 71, 67, 64, 67] }, // C
    ],
  },
  olympus: {
    bpm: 80, volume: 0.3, reverb: [4.2, 2.0], echo: 0.5,
    chords: [
      { root: 36, notes: [48, 51, 55, 60], motif: [67, 72, 75, 72, 70, 67] }, // Cm
      { root: 32, notes: [44, 48, 51, 56], motif: [68, 72, 75, 77, 75, 72] }, // Ab
      { root: 39, notes: [51, 55, 58, 63], motif: [70, 74, 75, 79, 75, 74] }, // Eb
      { root: 34, notes: [46, 50, 53, 58], motif: [70, 74, 77, 74, 70, 65] }, // Bb
    ],
  },
  blacksite: {
    bpm: 104, volume: 0.26, reverb: [2.0, 2.8], echo: 0.375,
    chords: [
      { root: 28, notes: [52, 55, 59, 64], motif: [64, 67, 71, 67, 64, 59] }, // Em
      { root: 24, notes: [48, 52, 55, 60], motif: [64, 67, 72, 67, 64, 60] }, // C
      { root: 26, notes: [50, 54, 57, 62], motif: [66, 69, 74, 69, 66, 62] }, // D
      { root: 23, notes: [47, 50, 54, 59], motif: [66, 71, 74, 71, 66, 62] }, // Bm
    ],
  },
};

export class GameScore {
  constructor(ctx, dest, name = "ash", opts = {}) {
    this.ctx = ctx; this.name = name; this.p = PRESETS[name]; this.STEP = 60 / this.p.bpm / 4;
    this.intensity = opts.intensity ?? 0.3; this.mood = ""; this.noise = makeNoise(ctx);
    const master = ctx.createGain(); master.gain.value = opts.volume ?? this.p.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -17; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.22;
    master.connect(comp); comp.connect(dest); this.master = master;
    const verb = ctx.createConvolver(); verb.buffer = makeImpulse(ctx, this.p.reverb[0], this.p.reverb[1]);
    const vo = ctx.createGain(); vo.gain.value = 0.6; verb.connect(vo); vo.connect(master); this.verb = verb;
    const echo = ctx.createDelay(2); echo.delayTime.value = this.STEP * 4 * this.p.echo * 2;
    const fb = ctx.createGain(); fb.gain.value = 0.33; const et = ctx.createBiquadFilter(); et.type = "lowpass"; et.frequency.value = 2200;
    echo.connect(et); et.connect(fb); fb.connect(echo); et.connect(master); et.connect(verb); this.echo = echo;
    const bus = (g, toVerb, toEcho) => { const n = ctx.createGain(); n.gain.value = g; n.connect(master); if (toVerb) n.connect(verb); if (toEcho) n.connect(echo); return n; };
    this.drums = bus(0.9, true, false); this.bass = ctx.createGain(); this.bass.gain.value = 0.95; this.duck = ctx.createGain(); this.bass.connect(this.duck); this.duck.connect(master);
    this.harm = bus(0.55, true, true); this.pad = bus(0.0, true, false); this.lead = bus(0.0, true, true); this.fx = bus(0.8, true, false);
    this.bed = ctx.createGain(); this.bed.gain.value = 1; this.bed.connect(master);
    this._startBed();
    this.nextThunder = 3; this.nextRiser = 6;
  }
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v)); const t = this.ctx.currentTime, I = this.intensity;
    this.pad.gain.setTargetAtTime(0.65 - 0.25 * I, t, 0.8);
    this.lead.gain.setTargetAtTime(I > 0.55 ? 0.7 : 0, t, 0.5);
    this.drums.gain.setTargetAtTime(I > 0.25 ? 0.95 : 0.3, t, 0.3);
    if (this.bedGain) this.bedGain.gain.setTargetAtTime(this.name === "blacksite" ? 0.03 : 0.08 * (1 - I * 0.5), t, 1.2);
  }
  setMood(m) { this.mood = m || ""; }
  setVolume(v) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }

  _startBed() {
    const ctx = this.ctx; const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    if (this.name === "ash") { f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.5; g.gain.value = 0.08; }       // wind
    else if (this.name === "olympus") { f.type = "bandpass"; f.frequency.value = 340; f.Q.value = 0.4; g.gain.value = 0.08; } // storm wind
    else { f.type = "lowpass"; f.frequency.value = 220; g.gain.value = 0.03; }                                             // room tone
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.bed); src.start(); this.bedGain = g;
  }

  // ---- instruments -----------------------------------------------------------
  kick(t, v = 1) {
    const c = this.ctx; const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.1 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.42);
    const d = this.duck.gain; d.cancelScheduledValues(t); d.setValueAtTime(1, t); d.linearRampToValueAtTime(0.3, t + 0.012); d.linearRampToValueAtTime(1, t + 0.25);
  }
  // deep war drum / timpani: a pitched thump with a skin slap
  taiko(t, v = 1, pitch = 62) {
    const c = this.ctx; const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(pitch * 1.9, t); o.frequency.exponentialRampToValueAtTime(pitch, t + 0.09);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.setValueAtTime(pitch * 2.6, t); o2.frequency.exponentialRampToValueAtTime(pitch * 1.4, t + 0.2);
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.004); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    const n = c.createBufferSource(); n.buffer = this.noise; const nf = c.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 1400; nf.Q.value = 0.7;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.35 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); o2.connect(g2); g.connect(this.drums); g2.connect(this.drums); n.connect(nf); nf.connect(ng); ng.connect(this.drums);
    o.start(t); o.stop(t + 1.2); o2.start(t); o2.stop(t + 0.4); n.start(t, 0.2); n.stop(t + 0.06);
  }
  snare(t, v = 1) {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this.noise; const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(f); f.connect(g); g.connect(this.drums); n.start(t, 0.3); n.stop(t + 0.25);
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = c.createGain(); og.gain.setValueAtTime(0.4 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(this.drums); o.start(t); o.stop(t + 0.12);
  }
  hat(t, v = 0.5, open = false) {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this.noise; const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7800;
    const len = open ? 0.22 : 0.04; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(this.drums); n.start(t, Math.random()); n.stop(t + len + 0.02);
  }
  tick(t, v = 1, hi = false) {
    const c = this.ctx; const o = c.createOscillator(); o.type = "square"; o.frequency.value = hi ? 2200 : 1500;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = hi ? 2200 : 1500; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(f); f.connect(g); g.connect(this.fx); o.start(t); o.stop(t + 0.05);
  }
  beep(t, v = 1, freq = 1900) {
    const c = this.ctx; const o = c.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.003); g.gain.setValueAtTime(0.28 * v, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + 0.12);
  }
  sub(t, midi, dur, v = 1, bright = 0) {
    const c = this.ctx; const f = mtof(midi); const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(v, t + 0.02); env.gain.setValueAtTime(v, t + Math.max(0.03, dur - 0.09)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = c.createOscillator(); o1.type = "sine"; o1.frequency.value = f < 33 ? f * 2 : f; const g1 = c.createGain(); g1.gain.value = 0.9;
    const o3 = c.createOscillator(); o3.type = "sawtooth"; o3.frequency.value = f * 2; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 3;
    lp.frequency.setValueAtTime(260 + bright * 900, t); lp.frequency.exponentialRampToValueAtTime(120 + bright * 200, t + dur);
    const sh = c.createWaveShaper(); sh.curve = drive(2.2); const g3 = c.createGain(); g3.gain.value = 0.3;
    o1.connect(g1); g1.connect(env); o3.connect(lp); lp.connect(sh); sh.connect(g3); g3.connect(env); env.connect(this.bass);
    for (const o of [o1, o3]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  // plucked string (harp / lute)
  pluck(t, midi, dur = 1.6, v = 0.6) {
    const c = this.ctx; const f = mtof(midi);
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f; const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.14 * v, t + 0.003); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.6);
    o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(this.harm); o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur * 0.4);
  }
  // a swell of low strings
  strings(t, notes, dur, v = 1) {
    const c = this.ctx; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.17 * v, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1900, t + dur * 0.55); lp.frequency.linearRampToValueAtTime(420, t + dur);
    lp.connect(g); g.connect(this.pad);
    for (const m of notes) for (const det of [-8, 8]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = det; const og = c.createGain(); og.gain.value = 0.22; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
  }
  // brass / horn: slow bloom saw through a moving low-pass
  brass(t, midi, dur, v = 0.7) {
    const c = this.ctx; const f = mtof(midi); const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26 * v, t + 0.09); g.gain.setValueAtTime(0.26 * v, t + Math.max(0.1, dur - 0.14)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 1.2; lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.16); lp.frequency.exponentialRampToValueAtTime(1100, t + dur);
    lp.connect(g); g.connect(this.lead);
    for (const det of [-6, 0, 6]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; const og = c.createGain(); og.gain.value = 0.34; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
  }
  // choir "ah": detuned saws pushed through vowel formants
  choir(t, notes, dur, v = 1) {
    const c = this.ctx; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const forms = [[780, 1.0, 9], [1180, 0.55, 10], [2600, 0.22, 12]];
    const fbus = c.createGain(); fbus.gain.value = 1;
    for (const [fr, a, q] of forms) { const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fr; bp.Q.value = q; const ga = c.createGain(); ga.gain.value = a * 2.4; fbus.connect(bp); bp.connect(ga); ga.connect(g); }
    g.connect(this.pad);
    const vib = c.createOscillator(); vib.frequency.value = 5.2; const vg = c.createGain(); vg.gain.value = 5; vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.1);
    for (const m of notes) for (const det of [-11, 0, 11]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = det; vg.connect(o.detune); const og = c.createGain(); og.gain.value = 0.16; o.connect(og); og.connect(fbus); o.start(t); o.stop(t + dur + 0.1); }
  }
  bell(t, midi, v = 0.5) {
    const c = this.ctx; const f = mtof(midi); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    for (const [r, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) { const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f * r; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 3.1); }
    g.connect(this.harm);
  }
  arp(t, midi, dur, v = 0.5) {
    const c = this.ctx; const f = mtof(midi); const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6;
    lp.frequency.setValueAtTime(2400 * (0.5 + this.intensity), t); lp.frequency.exponentialRampToValueAtTime(380, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.lead); o.start(t); o.stop(t + dur + 0.02);
  }
  riser(t, dur = 3) {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, t + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); g.connect(this.fx); n.start(t); n.stop(t + dur + 0.1);
  }
  thunder(t) {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + 3.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.3); g.gain.exponentialRampToValueAtTime(0.16, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    n.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.verb); n.start(t); n.stop(t + 4.3);
  }
  // a big one-shot hit for moments (wave start, victory, round start...)
  impact(t, kind = "hit") {
    this.taiko(t, 1.2, kind === "low" ? 46 : 55); this.thunder(t);
    if (kind === "win") [0, 4, 7, 12].forEach((s, i) => this.brass(t + i * 0.09, 60 + s, 2.2, 0.8));
    if (kind === "lose") [0, -1, -5].forEach((s, i) => this.brass(t + i * 0.2, 48 + s, 2.8, 0.7));
  }

  // ---- the sequencer: one sixteenth note -----------------------------------------
  scheduleStep(t, n) {
    const bar = Math.floor(n / 16) % 8, s = n % 16, absBar = Math.floor(n / 16), ch = this.p.chords[Math.floor(bar / 2)], I = this.intensity, STEP = this.STEP;
    const sw = s % 2 ? STEP * 0.08 : 0;
    if (this.name === "ash") this._ash(t, s, bar, absBar, ch, I, STEP, sw);
    else if (this.name === "olympus") this._olympus(t, s, bar, absBar, ch, I, STEP, sw);
    else this._blacksite(t, s, bar, absBar, ch, I, STEP, sw);
  }
  _ash(t, s, bar, absBar, ch, I, STEP, sw) {
    if (s === 0 && bar % 2 === 0) this.strings(t, ch.notes, STEP * 32);
    if (s === 0) this.sub(t, ch.root, STEP * 15, 0.9);
    // harp: rolling arpeggio, sparse when calm
    const arpPat = [0, 1, 2, 3, 2, 1, 2, 1]; if (s % 2 === 0 && (I > 0.2 || s % 4 === 0)) this.pluck(t + sw, ch.notes[arpPat[(s / 2) % 8] % 4] + 12, 1.8, 0.5 + 0.2 * (s === 0));
    // drums
    if (I > 0.25) { if (s === 0) this.taiko(t, 1, 58); if (s === 8) this.taiko(t, 0.7, 62); }
    if (I > 0.55) { if (s === 6 || s === 14) this.taiko(t, 0.45, 70); if (s === 4 || s === 12) this.hat(t, 0.35); }
    if (I > 0.85 && bar % 2 === 1 && s >= 12) this.taiko(t, 0.55 + (s - 12) * 0.1, 66); // war-roll into the next bar
    // horn melody over the first bar of each chord when threatened
    if (I > 0.55 && bar % 2 === 0) { const pat = [[0, 0, 6], [6, 1, 2], [8, 2, 4], [12, 3, 2], [14, 4, 2]]; for (const [st, i, len] of pat) if (s === st) this.brass(t, ch.motif[i] - 12, STEP * len * 0.95, 0.8); }
    else if (I <= 0.55 && bar % 2 === 0 && s === 8) this.bell(t, ch.motif[2], 0.35); // calm: a lone bell
    if (s === 0 && absBar >= this.nextThunder) { this.thunder(t + 0.1); this.nextThunder = absBar + 10 + ((absBar * 7919) % 8); }
  }
  _olympus(t, s, bar, absBar, ch, I, STEP, sw) {
    if (s === 0 && bar % 2 === 0) { this.choir(t, ch.notes.slice(1).map((m) => m + 12), STEP * 32, 0.9); this.strings(t, ch.notes, STEP * 32, 0.9); }
    if (s === 0) this.sub(t, ch.root, STEP * 15, 1);
    if (I > 0.2) { if (s === 0) this.taiko(t, 1, 52); if (s === 8) this.taiko(t, 0.75, 58); }
    if (I > 0.45 && s % 4 === 2) this.taiko(t, 0.35, 66);
    // strings ostinato: driving sixteenths in battle
    if (I > 0.5 && s % 2 === 0) { const k = [0, 2, 1, 3][(s / 2) % 4]; this.arp(t, ch.notes[k] + 12, STEP * 1.6, 0.55); }
    // brass fanfare on the bar line
    if (I > 0.62 && bar % 2 === 0) { const pat = [[0, 0, 4], [4, 1, 2], [6, 2, 2], [8, 3, 4], [12, 4, 2], [14, 5, 2]]; for (const [st, i, len] of pat) if (s === st) this.brass(t, ch.motif[i], STEP * len * 0.98, 0.9); }
    if (I > 0.8 && s === 0) this.hat(t, 0.8, true);
    if (s === 0 && absBar >= this.nextRiser && I > 0.4) { this.riser(t, STEP * 16 - 0.2); this.nextRiser = absBar + 8; }
    if (s === 0 && absBar >= this.nextThunder) { this.thunder(t + 0.05); this.nextThunder = absBar + 4 + ((absBar * 7919) % 6); }
  }
  _blacksite(t, s, bar, absBar, ch, I, STEP, sw) {
    const bomb = this.mood === "bomb";
    if (s === 0 && bar % 2 === 0) this.strings(t, ch.notes, STEP * 32, 0.7);
    // pulsing sub in eighths
    if (s % 2 === 0) this.sub(t, ch.root + (s === 10 ? 7 : 0), STEP * 1.9, I > 0.45 ? 0.85 : 0.6, I);
    // clock tick on the beat (the whole game is on a timer)
    if (s % 4 === 0) this.tick(t, I > 0.45 ? 0.6 : 0.9, s === 0);
    if (I > 0.25) { if (s === 0 || s === 8) this.kick(t, 0.95); if (s === 4 || s === 12) this.snare(t, 0.8); }
    if (I > 0.55) { if (s % 4 === 2) this.kick(t, 0.6); if (s % 2 === 0) this.hat(t + sw, s % 4 === 2 ? 0.7 : 0.4); if (s === 15) this.hat(t, 0.6, true); }
    // arpeggio in a firefight
    if (I > 0.5 && s % 2 === 0) { const k = [0, 1, 2, 3, 2, 1, 2, 3][(s / 2) % 8]; this.arp(t + sw, ch.notes[k] + 12 * (s % 8 === 6 ? 1 : 0), STEP * 1.7, 0.6); }
    if (I > 0.7 && bar % 2 === 0 && s === 0) this.brass(t, ch.motif[0] - 12, STEP * 12, 0.5);
    // bomb down: a heartbeat of beeps that tightens as the round bar counter rises
    if (bomb) { const every = 4; if (s % every === 0) this.beep(t, 0.9, s === 0 ? 2300 : 1900); if (s % 16 === 0) this.beep(t + STEP * 2, 0.9, 1300); }
    if (s === 0 && absBar >= this.nextRiser && I > 0.3) { this.riser(t, STEP * 16 - 0.2); this.nextRiser = absBar + 12; }
  }
  stinger(kind) {
    const t = this.ctx.currentTime + 0.02;
    if (this.name === "blacksite") {
      if (kind === "plant") { this.impact(t, "low"); this.setMood("bomb"); }
      else if (kind === "defuse") { this.setMood(""); [0, 3, 7, 12].forEach((s, i) => this.pluck(t + i * 0.09, 64 + s, 1.2, 0.7)); }
      else if (kind === "explode") { this.impact(t, "low"); this.thunder(t); this.setMood(""); }
      else if (kind === "win") this.impact(t, "win"); else if (kind === "lose") this.impact(t, "lose");
      else if (kind === "round") { this.riser(t, 0.9); this.taiko(t + 0.9, 1, 60); }
    } else if (kind === "win") this.impact(t, "win"); else if (kind === "lose") this.impact(t, "lose");
    else if (kind === "wave" || kind === "raid") { this.taiko(t, 1.1, 50); this.taiko(t + 0.3, 0.9, 50); this.brass(t + 0.3, 43, 1.6, 0.8); }
    else if (kind === "bolt") this.thunder(t);
  }
}

// ---- live player -----------------------------------------------------------------
export function createGameMusic(name = "ash", storageKey = "g-music") {
  let ctx = null, sc = null, timer = null, nextT = 0, stepN = 0;
  let enabled = true, intensity = 0.25; const volume = PRESETS[name].volume; const STEP = 60 / PRESETS[name].bpm / 4;
  try { if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey) === "off") enabled = false; } catch {}
  function build() {
    if (ctx) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      ctx = new C(); sc = new GameScore(ctx, ctx.destination, name, { intensity, volume: enabled ? volume : 0 }); sc.setIntensity(intensity);
      nextT = ctx.currentTime + 0.15;
      timer = setInterval(() => { if (!ctx || ctx.state !== "running") return; while (nextT < ctx.currentTime + 0.2) { sc.scheduleStep(nextT, stepN++); nextT += STEP; } }, 30);
      return true;
    } catch { ctx = null; return false; }
  }
  return {
    start() { if (!build()) return; if (ctx.state === "suspended") ctx.resume(); },
    setIntensity(v) { intensity = v; sc && sc.setIntensity(v); },
    setMood(m) { sc && sc.setMood(m); },
    stinger(k) { if (sc && enabled && ctx && ctx.state === "running") sc.stinger(k); },
    setEnabled(on) { enabled = on; try { localStorage.setItem(storageKey, on ? "on" : "off"); } catch {} sc && sc.setVolume(on ? volume : 0); if (on) this.start(); },
    isEnabled() { return enabled; },
    stop() { clearInterval(timer); timer = null; try { ctx && ctx.close(); } catch {} ctx = null; sc = null; },
  };
}

export async function renderPreview(name = "ash", seconds = 40, intensity = 0.8, sampleRate = 44100, mood = "") {
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const sc = new GameScore(ctx, ctx.destination, name, { intensity }); sc.setIntensity(intensity); sc.setMood(mood); sc.nextThunder = 3;
  const STEP = sc.STEP; const steps = Math.ceil(seconds / STEP);
  for (let n = 0; n < steps; n++) sc.scheduleStep(0.05 + n * STEP, n);
  return ctx.startRendering();
}

// Adapter for games that already report a mood ("day" | "night" | "combat" ...): the mood maps to
// how full the music is. Same small interface the older game music had, plus on/off.
export function createMoodMusic(name, storageKey, moodMap = {}) {
  const m = createGameMusic(name, storageKey);
  return {
    ...m,
    setMood(mood) { const v = moodMap[mood]; if (v !== undefined) m.setIntensity(v); },
    levelUpFanfare() { m.stinger("win"); },
    resumeIfNeeded() { m.start(); },
  };
}
