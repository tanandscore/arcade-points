// Midnight Burn — the soundtrack. Everything here is generated live with
// the browser's audio engine, so there are no music files to download and
// nothing to license. It is an ORIGINAL piece written for this game: a warm,
// bouncy, major-key groove (a jazzy electric-piano vamp, a bright marimba
// hook, a round sub-bass and a head-nodding drum beat) with just a light
// patter of rain and a far-off rumble of thunder. The mood is a rainy-window
// lounge record crossed with a drift-night street party, but the chords,
// rhythm and melody are our own.
//
// The same scheduler drives both the live game and the offline preview
// render used for testing, so what is tested is what plays.

const BPM = 100;
const STEP = 60 / BPM / 4; // one sixteenth note, in seconds
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// two bars per chord, eight bars in the loop (C major: ii - V - I - IV, all with colour notes)
const CHORDS = [
  { root: 38, keys: [53, 57, 60, 64], lead: [79, 76, 74, 76, 72, 74] }, // Dm9
  { root: 31, keys: [53, 59, 62, 64], lead: [74, 76, 79, 81, 79, 76] }, // G13
  { root: 36, keys: [55, 59, 62, 64], lead: [76, 79, 81, 79, 76, 72] }, // Cmaj9
  { root: 41, keys: [57, 60, 64, 67], lead: [81, 79, 76, 79, 72, 76] }, // Fmaj9
];
const KICK = new Set([0, 6, 10]); // boom ... bap-boom, a bouncy skip
const SNARE = new Set([4, 12]);

function makeNoise(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
  return buf;
}
function makeImpulse(ctx, seconds = 2.8, decay = 2.6) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let seed = 98765;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = ((seed / 4294967296) * 2 - 1) * Math.pow(1 - i / n, decay);
    }
  }
  return buf;
}
function driveCurve(amount = 3) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amount); }
  return c;
}

export class Soundtrack {
  constructor(ctx, dest, opts = {}) {
    this.ctx = ctx;
    this.intensity = opts.intensity ?? 1;
    this.nitro = false;
    this.step = 0;
    this.noise = makeNoise(ctx);

    const master = ctx.createGain(); master.gain.value = opts.volume ?? 0.24;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(dest);
    this.master = master;

    // reverb and a dotted-eighth echo shared by the melodic parts
    const verb = ctx.createConvolver(); verb.buffer = makeImpulse(ctx);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(master);
    this.verb = verb;
    const echo = ctx.createDelay(2); echo.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const echoTone = ctx.createBiquadFilter(); echoTone.type = "lowpass"; echoTone.frequency.value = 2400;
    echo.connect(echoTone); echoTone.connect(fb); fb.connect(echo); echoTone.connect(master); echoTone.connect(verb);
    this.echo = echo;

    // buses
    this.drums = ctx.createGain(); this.drums.gain.value = 0.9; this.drums.connect(master);
    this.bassDuck = ctx.createGain(); this.bassDuck.gain.value = 1; // pumped by the kick
    this.bass = ctx.createGain(); this.bass.gain.value = 0.95; this.bass.connect(this.bassDuck); this.bassDuck.connect(master);
    this.keys = ctx.createGain(); this.keys.gain.value = 0.5;
    this.keys.connect(master); this.keys.connect(verb); this.keys.connect(echo);
    this.pad = ctx.createGain(); this.pad.gain.value = 0.0; this.pad.connect(master); this.pad.connect(verb);
    this.lead = ctx.createGain(); this.lead.gain.value = 0.0; this.lead.connect(master); this.lead.connect(verb); this.lead.connect(echo);
    this.snareVerb = ctx.createGain(); this.snareVerb.gain.value = 0.6; this.snareVerb.connect(verb);

    this._startRain();
    this.nextThunderBar = 6;
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    const t = this.ctx.currentTime;
    this.pad.gain.setTargetAtTime(0.5 * (1 - this.intensity) + 0.1, t, 0.6);
    this.lead.gain.setTargetAtTime(this.intensity > 0.55 ? 0.7 : 0, t, 0.5);
    this.drums.gain.setTargetAtTime(this.intensity > 0.45 ? 0.9 : 0.35, t, 0.3);
    this.rainGain.gain.setTargetAtTime(0.07 - this.intensity * 0.03, t, 0.8);
  }
  setNitro(on) {
    if (on === this.nitro) return;
    this.nitro = on;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(on ? 0.3 : 0.24, t, 0.1);
  }
  setVolume(v) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }

  _startRain() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
    const bp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = 5200; bp.gain.value = 6; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.055;
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this.rainGain = g; this.rainSrc = src;
  }

  // ---- instruments -------------------------------------------------------
  kick(t, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.15 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    // a short click on top so it cuts through
    const c = ctx.createBufferSource(); c.buffer = this.noise;
    const cf = ctx.createBiquadFilter(); cf.type = "bandpass"; cf.frequency.value = 2600; cf.Q.value = 0.8;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.35 * vel, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    o.connect(g); g.connect(this.drums); c.connect(cf); cf.connect(cg); cg.connect(this.drums);
    o.start(t); o.stop(t + 0.45); c.start(t, 0.1); c.stop(t + 0.03);
    // sidechain: the bass ducks and swells back around each kick
    const d = this.bassDuck.gain;
    d.cancelScheduledValues(t); d.setValueAtTime(1, t); d.linearRampToValueAtTime(0.25, t + 0.012); d.linearRampToValueAtTime(1, t + 0.26);
  }
  snare(t, vel = 1) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(f); f.connect(g); g.connect(this.drums); g.connect(this.snareVerb);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.1);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.5 * vel, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(og); og.connect(this.drums);
    n.start(t, 0.3); n.stop(t + 0.32); o.start(t); o.stop(t + 0.16);
  }
  hat(t, vel = 0.5, open = false) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
    const g = ctx.createGain(); const len = open ? 0.26 : 0.045;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(this.drums);
    n.start(t, Math.random() * 1.2); n.stop(t + len + 0.02);
  }
  sub(t, midi, dur, vel = 1) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.015);
    env.gain.setValueAtTime(vel, t + Math.max(0.02, dur - 0.08)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // true sub an octave down, a strong low-mid sine, and a driven saw for small speakers
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f / 2 < 33 ? f : f / 2;
    const g1 = ctx.createGain(); g1.gain.value = 0.9;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
    const g2 = ctx.createGain(); g2.gain.value = 0.8;
    const o3 = ctx.createOscillator(); o3.type = "sawtooth"; o3.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 3;
    lp.frequency.setValueAtTime(this.nitro ? 900 : 380, t); lp.frequency.exponentialRampToValueAtTime(this.nitro ? 260 : 150, t + dur);
    const sh = ctx.createWaveShaper(); sh.curve = driveCurve(2.5);
    const g3 = ctx.createGain(); g3.gain.value = 0.34;
    o1.connect(g1); g1.connect(env); o2.connect(g2); g2.connect(env);
    o3.connect(lp); lp.connect(sh); sh.connect(g3); g3.connect(env);
    env.connect(this.bass);
    for (const o of [o1, o2, o3]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  rhodes(t, midi, dur, vel = 0.6) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const car = ctx.createOscillator(); car.type = "sine"; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = "sine"; mod.frequency.value = f * 1;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.9);
    mod.connect(mg); mg.connect(car.frequency);
    // tine: a bright, quickly fading overtone
    const tine = ctx.createOscillator(); tine.type = "sine"; tine.frequency.value = f * 4;
    const tg = ctx.createGain(); tg.gain.setValueAtTime(0.1 * vel, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    tine.connect(tg);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.1 * vel, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // slow tremolo, the classic stage-piano wobble
    const trem = ctx.createGain(); trem.gain.value = 0.82;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.2; const lg = ctx.createGain(); lg.gain.value = 0.18;
    lfo.connect(lg); lg.connect(trem.gain);
    car.connect(g); tine.connect(g); g.connect(trem); trem.connect(this.keys);
    for (const o of [car, mod, tine, lfo]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  organ(t, midi, dur, vel = 0.5) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.04);
    g.gain.setValueAtTime(0.22 * vel, t + Math.max(0.05, dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = f * 0.004;
    lfo.connect(lg);
    const bars = [[1, 1], [2, 0.7], [3, 0.35], [4, 0.2], [0.5, 0.5]];
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
    const oscs = [lfo];
    for (const [h, a] of bars) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * h; lg.connect(o.frequency);
      const og = ctx.createGain(); og.gain.value = a * 0.5; o.connect(og); og.connect(lp); oscs.push(o);
    }
    lp.connect(g); g.connect(this.lead);
    for (const o of oscs) { o.start(t); o.stop(t + dur + 0.05); }
  }
  // a wooden marimba note: the bright hook of the piece
  marimba(t, midi, dur, vel = 0.6) {
    const ctx = this.ctx, f = mtof(midi);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.34 * vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur + 0.25, 0.7));
    const k = ctx.createOscillator(); k.type = "sine"; k.frequency.value = f * 3.97;
    const kg = ctx.createGain(); kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.12 * vel, t + 0.002); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    const tr = ctx.createOscillator(); tr.type = "triangle"; tr.frequency.value = f * 2;
    const tg = ctx.createGain(); tg.gain.setValueAtTime(0.0001, t); tg.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.003); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this.lead); k.connect(kg); kg.connect(this.lead); tr.connect(tg); tg.connect(this.lead);
    for (const x of [o, k, tr]) { x.start(t); x.stop(t + 0.8); }
  }
  padChord(t, notes, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1800, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(400, t + dur);
    lp.connect(g); g.connect(this.pad);
    for (const m of notes) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(m - 12); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  thunder(t) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + 3.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.1, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    n.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.verb);
    n.start(t); n.stop(t + 4.3);
  }

  // ---- the sequencer: schedule one sixteenth note ---------------------------
  scheduleStep(t, n) {
    const bar = Math.floor(n / 16) % 8;
    const s = n % 16;
    const ch = CHORDS[Math.floor(bar / 2)];
    const I = this.intensity;
    const drumsOn = I > 0.45;
    const swing = s % 2 ? STEP * 0.1 : 0;
    const tt = t + swing;

    if (drumsOn) {
      if (KICK.has(s)) this.kick(t, s === 0 ? 1 : 0.85);
      if (SNARE.has(s)) this.snare(t, 1);
      if (s % 2 === 0) this.hat(tt, s % 4 === 2 ? 0.7 : 0.45);
      else if (I > 0.8 && s % 4 === 3) this.hat(tt, 0.25);
      if (s === 14) this.hat(tt, 0.7, true);
    } else {
      if (s === 0) this.kick(t, 0.6);
      if (s === 8) this.hat(t, 0.4);
    }

    // heavy bass line
    if (s === 0) this.sub(t, ch.root, STEP * (drumsOn ? 5.5 : 14), 1);
    if (drumsOn) {
      if (s === 6) this.sub(t, ch.root, STEP * 3.4, 0.9);
      if (s === 10) this.sub(t, ch.root + (bar % 2 ? 7 : 0), STEP * 3.8, 0.95);
      if (s === 14 && I > 0.6) this.sub(t, ch.root + 12, STEP * 1.5, 0.6);
    }

    // electric piano: long chord on the bar, answering stabs
    const spread = (i) => i * 0.014;
    if (s === 0) ch.keys.forEach((m, i) => this.rhodes(t + spread(i), m, STEP * 12, 0.7));
    if (s === 6 && I > 0.3) ch.keys.slice(1).forEach((m, i) => this.rhodes(t + spread(i), m + 12, STEP * 3, 0.45));
    if (s === 10) ch.keys.slice(0, 3).forEach((m, i) => this.rhodes(t + spread(i), m, STEP * 5, 0.5));

    // pad (menu / calm sections) once per two bars
    if (s === 0 && bar % 2 === 0) this.padChord(t, ch.keys, STEP * 32);

    // a bright marimba hook over the first bar of each chord, answered by a softer echo of it in the second bar
    if (I > 0.55) {
      const pat = [[0, 0, 3], [3, 1, 2], [6, 2, 2], [8, 3, 3], [12, 4, 2], [14, 5, 2]];
      if (bar % 2 === 0) { for (const [st, idx, len] of pat) if (s === st) this.marimba(t, ch.lead[idx], STEP * len, 0.8); }
      else if (I > 0.7) { for (const [st, idx, len] of pat) if (s === st && idx % 2 === 0) this.marimba(t, ch.lead[idx] - 12, STEP * len, 0.45); }
    }
    // light percussion: a shaker on every sixteenth when the groove is up, a finger snap on the bar's last offbeat
    if (drumsOn && I > 0.6) { if (s % 2 === 1) this.hat(tt, 0.22); if (s === 11 && bar % 2) this.snare(t, 0.35); }

    // distant thunder every 8-16 bars
    const absBar = Math.floor(n / 16);
    if (s === 0 && absBar >= this.nextThunderBar) {
      this.thunder(t + 0.05);
      this.nextThunderBar = absBar + 16 + ((absBar * 7919) % 17);
    }
  }
}

// ---- live player ------------------------------------------------------------
export function createMusicPlayer() {
  let ctx = null, tr = null, timer = null, nextT = 0, stepN = 0;
  let enabled = true, intensity = 0.3, volume = 0.24;
  try { if (typeof localStorage !== "undefined" && localStorage.getItem("mb-music") === "off") enabled = false; } catch {}

  function build() {
    if (ctx) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      ctx = new C();
      tr = new Soundtrack(ctx, ctx.destination, { intensity, volume: enabled ? volume : 0 });
      nextT = ctx.currentTime + 0.15;
      timer = setInterval(() => {
        if (!ctx || ctx.state !== "running") return;
        while (nextT < ctx.currentTime + 0.2) { tr.scheduleStep(nextT, stepN++); nextT += STEP; }
      }, 30);
      return true;
    } catch { ctx = null; return false; }
  }
  return {
    // must be called from a click / key press
    start() { if (!build()) return; if (ctx.state === "suspended") ctx.resume(); },
    setIntensity(v) { intensity = v; tr && tr.setIntensity(v); },
    setNitro(on) { tr && tr.setNitro(on); },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem("mb-music", on ? "on" : "off"); } catch {}
      tr && tr.setVolume(on ? volume : 0);
      if (on) this.start();
    },
    isEnabled() { return enabled; },
    stop() { clearInterval(timer); timer = null; try { ctx && ctx.close(); } catch {} ctx = null; tr = null; },
  };
}

// ---- offline render (used by tests and the sample download) -------------------
export async function renderPreview(seconds = 40, intensity = 1, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const tr = new Soundtrack(ctx, ctx.destination, { intensity, volume: 0.24 });
  tr.nextThunderBar = 3;
  const steps = Math.ceil(seconds / STEP);
  for (let n = 0; n < steps; n++) tr.scheduleStep(0.05 + n * STEP, n);
  return ctx.startRendering();
}
export const MUSIC_BPM = BPM;
