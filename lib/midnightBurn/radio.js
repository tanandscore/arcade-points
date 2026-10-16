// Midnight Burn — the radio. Six original stations, all played live by the browser's audio engine: no music files and
// nothing borrowed. Every station has its own tempo, key, drum kit, bass, chords and tunes, and each one runs a long
// song form (intro, groove, build, drop, break) that reacts to how hard you are driving:
//
//   NEON TIDE      synthwave, 116 BPM    — wide chords, rolling bass, arpeggios, big drops
//   BOMBAY BASS    desi trap, 140 BPM    — 808s, tabla and dholak, a sitar line, flute, tanpura drone
//   SEA LINK DRIVE night house, 122 BPM  — warm piano chords, deep bass, shaker, rolling sea swells
//   PHONK 3AM      drift phonk, 150 BPM  — cowbell tune, distorted 808, chopped "ah" voices, hi-hat rolls
//   GHAT RUN       drum and bass, 174    — breakbeats, reese bass, stabs, long builds
//   MIDNIGHT STORM rain-soaked groove    — the original slow electric-piano piece
//
// The same scheduler drives the live game and the offline test render (renderPreview).
import { Soundtrack, MUSIC_BPM } from "./music";

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (x) => { x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const hit = (pat, s) => { const c = pat[s % pat.length]; return c === "X" ? 1 : c === "x" ? 0.7 : c === "o" ? 0.35 : 0; };

function noiseBuf(ctx, secs = 2) { const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate), d = b.getChannelData(0); let s = 4242; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; } return b; }
function impulse(ctx, secs, decay) { const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate); let s = 777; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; const w = (s / 4294967296) * 2 - 1; lp += (w - lp) * (0.55 - 0.4 * (i / n)); d[i] = lp * Math.pow(1 - i / n, decay); } } return b; }
function curve(k) { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k); } return c; }

// section map: 4-bar phrases, 8 phrases per song
const FORM = [["intro", 0.5], ["groove", 0.85], ["groove", 0.95], ["build", 1], ["drop", 1.15], ["drop", 1.15], ["break", 0.4], ["drop", 1.2]];
function section(bar) { const ph = Math.floor(bar / 4) % 8, b4 = bar % 4; const [kind, f] = FORM[ph]; return { kind, f, b4, ph, lastBar: b4 === 3, first: b4 === 0, phraseStart: b4 === 0 }; }

// ==============================================================================================================================
function makeEngine(ctx, dest, opts = {}) {
  const noise = noiseBuf(ctx, 2), sat = curve(2.6), sat2 = curve(6);
  const master = ctx.createGain(); master.gain.value = opts.volume ?? 0.34;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.18;
  const lim = ctx.createWaveShaper(); lim.curve = curve(1.1);
  master.connect(comp); comp.connect(lim); lim.connect(dest);
  // shared effects: a hall reverb and a ping-pong style echo
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 1.9, 2.2); const revG = ctx.createGain(); revG.gain.value = 0.7; rev.connect(revG); revG.connect(master);
  const dly = ctx.createDelay(1.5); dly.delayTime.value = 0.38; const fb = ctx.createGain(); fb.gain.value = 0.38; const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2600;
  dly.connect(dlp); dlp.connect(fb); fb.connect(dly); const dlyG = ctx.createGain(); dlyG.gain.value = 0.6; dlp.connect(dlyG); dlyG.connect(master);

  const E = { ctx, intensity: 0.4, nitro: false, bus: null, stepDur: 0.13, mtof, hit, hash, section };

  function newBus() {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    const pump = ctx.createGain(); pump.connect(out); const drm = ctx.createGain(); drm.connect(out);
    return { out, pump, drm };
  }
  E.setBus = (b) => { E.bus = b; };

  const sendTo = (node, r, d, pan) => {
    let n = node; if (pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); n = p; }
    return n;
  };
  function route(g, o) {
    const bus = E.bus; const dst = o.bus === "drm" ? bus.drm : bus.pump; const n = sendTo(g, 0, 0, o.pan);
    n.connect(dst);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; n.connect(s); s.connect(rev); }
    if (o.dly) { const s = ctx.createGain(); s.gain.value = o.dly; n.connect(s); s.connect(dly); }
  }
  // one oscillator voice: layered, detuned, filtered, enveloped
  E.voice = (o) => {
    const t = o.t, dur = o.dur ?? 0.2, a = o.a ?? 0.004, peak = o.peak ?? 0.15, rel = o.rel ?? 0.06, det = o.det || [0];
    const end = t + dur + (o.perc ? 0 : rel);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (o.perc) g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else { g.gain.setValueAtTime(peak, Math.max(t + a, t + dur - 0.001)); g.gain.exponentialRampToValueAtTime(0.0001, end); }
    let head = g;
    if (o.drive) { const w = ctx.createWaveShaper(); w.curve = o.drive > 1 ? sat2 : sat; w.connect(g); head = w; }
    let f0 = head;
    if (o.hp) { const h = ctx.createBiquadFilter(); h.type = "highpass"; h.frequency.value = o.hp; h.connect(f0); f0 = h; }
    if (o.cut) { const f = ctx.createBiquadFilter(); f.type = o.ftype || "lowpass"; f.Q.value = o.q ?? 0.8; f.frequency.setValueAtTime(o.cut, t); if (o.cut2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cut2), t + (o.cutT ?? dur)); f.connect(f0); f0 = f; }
    const sc = 1 / Math.sqrt(det.length);
    for (const c of det) {
      const os = ctx.createOscillator(); os.type = o.type || "sawtooth"; os.detune.value = c; os.frequency.setValueAtTime(o.f0 ?? o.f, t);
      if (o.f0 != null && o.f0 !== o.f) os.frequency.exponentialRampToValueAtTime(o.f, t + (o.glide ?? 0.05));
      if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide2 ?? dur));
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibHz ?? 5.2; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.detune); l.start(t); l.stop(end + 0.1); }
      if (sc !== 1) { const og = ctx.createGain(); og.gain.value = sc; os.connect(og); og.connect(f0); } else os.connect(f0);
      os.start(t); os.stop(end + 0.08);
    }
    route(g, o); return g;
  };
  E.nz = (o) => {
    const t = o.t, dur = o.dur ?? 0.1, peak = o.peak ?? 0.1, a = o.a ?? 0.002;
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || "highpass"; f.Q.value = o.q ?? 0.7; f.frequency.setValueAtTime(o.f ?? 6000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (o.swell) { g.gain.linearRampToValueAtTime(peak, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur); } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); route(g, o); s.start(t, (t * 7.31) % 1.5); s.stop(t + dur + 0.05); return g;
  };
  // ---- drum kit ----
  E.kick = (t, v = 1, o = {}) => { E.voice({ t, type: "sine", f0: o.f0 ?? 165, f: o.f ?? 46, glide: 0.07, dur: o.dur ?? 0.34, peak: 0.55 * v, perc: true, bus: "drm", drive: o.drive }); E.nz({ t, dur: 0.012, f: 3200, peak: 0.1 * v, bus: "drm" }); };
  E.snare = (t, v = 1, o = {}) => { E.voice({ t, type: "triangle", f0: 230, f: 160, glide: 0.05, dur: 0.16, peak: 0.22 * v, perc: true, bus: "drm" }); E.nz({ t, dur: o.dur ?? 0.2, f: 1800, ftype: "highpass", peak: 0.26 * v, bus: "drm", rev: o.rev ?? 0.22 }); };
  E.clap = (t, v = 1, o = {}) => { for (let k = 0; k < 3; k++) E.nz({ t: t + k * 0.011, dur: 0.05, f: 1500, ftype: "bandpass", q: 1.1, peak: 0.2 * v, bus: "drm" }); E.nz({ t: t + 0.033, dur: o.dur ?? 0.22, f: 1400, ftype: "bandpass", q: 0.9, peak: 0.2 * v, bus: "drm", rev: o.rev ?? 0.35 }); };
  E.hat = (t, v = 1, open = false, pan = 0) => E.nz({ t, dur: open ? 0.2 : 0.045, f: 7600, peak: (open ? 0.1 : 0.09) * v, bus: "drm", pan });
  E.shaker = (t, v = 1, pan = 0) => E.nz({ t, dur: 0.07, f: 5200, ftype: "bandpass", q: 1.2, peak: 0.07 * v, a: 0.012, bus: "drm", pan });
  E.crash = (t, v = 1) => { E.nz({ t, dur: 2.4, f: 4200, peak: 0.16 * v, bus: "drm", rev: 0.5 }); E.voice({ t, type: "sine", f0: 90, f: 34, glide: 0.5, dur: 1.4, peak: 0.4 * v, perc: true, bus: "drm" }); };
  E.riser = (t, dur, v = 1) => { E.nz({ t, dur, f: 500, f2: 9000, q: 4, ftype: "bandpass", peak: 0.16 * v, a: dur * 0.8, bus: "drm", rev: 0.4 }); E.voice({ t, type: "sawtooth", f0: 200, f: 1600, glide: dur, dur, peak: 0.05 * v, a: dur * 0.9, cut: 2500, bus: "drm", rev: 0.3 }); };
  E.tom = (t, f, v = 1) => E.voice({ t, type: "sine", f0: f * 1.5, f, glide: 0.06, dur: 0.3, peak: 0.28 * v, perc: true, bus: "drm" });
  E.cowbell = (t, f, v = 1, pan = 0) => { for (const m of [1, 1.504]) E.voice({ t, type: "square", f: f * m, dur: 0.16, peak: 0.07 * v, perc: true, cut: 2400, ftype: "bandpass", q: 3, bus: "drm", pan, dly: 0.2 }); };
  // ---- bass & keys ----
  E.sub = (t, m, dur, v = 1, o = {}) => E.voice({ t, type: "sine", f0: o.slideFrom ? mtof(o.slideFrom) : mtof(m), f: mtof(m), glide: 0.07, dur, peak: 0.42 * v, a: 0.006, rel: 0.04, drive: o.drive, bus: "mus" });
  E.bassSaw = (t, m, dur, v = 1, cut = 700) => { E.voice({ t, type: "sawtooth", f: mtof(m), det: [-6, 6], dur, peak: 0.24 * v, a: 0.004, cut, cut2: 160, cutT: dur, q: 5, bus: "mus" }); E.voice({ t, type: "sine", f: mtof(m - 12 < 24 ? m : m - 12), dur, peak: 0.26 * v, bus: "mus" }); };
  E.reese = (t, m, dur, v = 1, wob = 0) => E.voice({ t, type: "sawtooth", f: mtof(m), det: [-18, -7, 8, 19], dur, peak: 0.2 * v, a: 0.03, cut: 420 + wob, cut2: 900 + wob * 2, cutT: dur, q: 3.5, drive: 1, bus: "mus" });
  E.pad = (t, notes, dur, v = 1, o = {}) => { for (const m of notes) E.voice({ t, type: "sawtooth", f: mtof(m), det: [-10, 10], dur, a: o.a ?? 0.9, rel: 1.2, peak: 0.032 * v, cut: o.cut ?? 900, cut2: o.cut2 ?? 2200, cutT: dur, q: 0.5, bus: "mus", rev: 0.55, pan: ((m % 7) - 3) * 0.12 }); };
  E.supersaw = (t, notes, dur, v = 1) => { for (const m of notes) E.voice({ t, type: "sawtooth", f: mtof(m), det: [-20, 0, 20], dur, a: 0.01, rel: 0.2, peak: 0.062 * v, cut: 3800, cut2: 1200, cutT: dur, bus: "mus", rev: 0.3, pan: ((m % 5) - 2) * 0.2 }); };
  E.epiano = (t, m, dur, v = 1, pan = 0) => { // soft electric-piano: a sine with a bell-like partial that fades fast
    E.voice({ t, type: "sine", f: mtof(m), dur, peak: 0.1 * v, perc: true, bus: "mus", rev: 0.35, dly: 0.15, pan });
    E.voice({ t, type: "sine", f: mtof(m) * 7.01, dur: Math.min(0.5, dur), peak: 0.035 * v, perc: true, bus: "mus", rev: 0.2, pan });
    E.voice({ t, type: "triangle", f: mtof(m) * 2, dur: dur * 0.6, peak: 0.035 * v, perc: true, bus: "mus", pan });
  };
  E.pluck = (t, m, dur, v = 1, o = {}) => E.voice({ t, type: o.type || "sawtooth", f: mtof(m), det: o.det || [-5, 5], dur, peak: 0.13 * v, perc: true, a: 0.003, cut: o.cut ?? 3600, cut2: o.cut2 ?? 500, cutT: dur * 0.8, q: 2.2, bus: "mus", rev: o.rev ?? 0.3, dly: o.dly ?? 0.35, pan: o.pan || 0 });
  E.sitar = (t, m, dur, v = 1, pan = 0) => { // plucked, buzzing, with a quick slide up into the note
    E.voice({ t, type: "sawtooth", f0: mtof(m) * 0.94, f: mtof(m), glide: 0.07, det: [-9, 0, 7], dur, peak: 0.14 * v, perc: true, a: 0.002, cut: 5200, cut2: 800, cutT: dur * 0.7, q: 7, drive: 1, bus: "mus", rev: 0.35, dly: 0.28, pan });
    E.voice({ t, type: "square", f: mtof(m) * 2.005, dur: dur * 0.5, peak: 0.03 * v, perc: true, cut: 3000, bus: "mus", pan });
  };
  E.flute = (t, m, dur, v = 1, pan = 0) => { E.voice({ t, type: "sine", f: mtof(m), dur, a: 0.09, rel: 0.35, peak: 0.1 * v, vib: 22, vibHz: 5.4, bus: "mus", rev: 0.6, dly: 0.25, pan }); E.voice({ t, type: "triangle", f: mtof(m) * 2, dur, a: 0.12, rel: 0.3, peak: 0.02 * v, bus: "mus", rev: 0.5, pan }); E.nz({ t, dur: dur * 0.9, f: mtof(m) * 2.2, ftype: "bandpass", q: 6, peak: 0.02 * v, a: 0.08, swell: true, bus: "mus", rev: 0.4, pan }); };
  E.tabla = (t, kind, v = 1) => {
    if (kind === "G") E.voice({ t, type: "sine", f0: 210, f: 98, glide: 0.11, dur: 0.34, peak: 0.34 * v, perc: true, bus: "drm", rev: 0.18 });
    else if (kind === "n") { E.voice({ t, type: "sine", f0: 820, f: 690, glide: 0.03, dur: 0.1, peak: 0.16 * v, perc: true, bus: "drm", rev: 0.15 }); E.nz({ t, dur: 0.02, f: 4000, peak: 0.07 * v, bus: "drm" }); }
    else if (kind === "t") { E.voice({ t, type: "sine", f0: 560, f: 470, glide: 0.04, dur: 0.2, peak: 0.17 * v, perc: true, bus: "drm", rev: 0.2 }); E.voice({ t, type: "sine", f: 1130, dur: 0.12, peak: 0.05 * v, perc: true, bus: "drm" }); }
    else if (kind === "D") { E.tabla(t, "G", v); E.tabla(t, "n", v * 0.8); }
  };
  E.tanpura = (t, m, v = 1) => E.voice({ t, type: "sawtooth", f: mtof(m), det: [-4, 3], dur: 2.8, peak: 0.05 * v, perc: true, a: 0.01, cut: 2600, cut2: 380, cutT: 2.4, q: 4, bus: "mus", rev: 0.6, pan: (m % 3) * 0.3 - 0.3 });
  E.chop = (t, m, v = 1, pan = 0) => { // a chopped sung "ah": a saw squeezed through two vowel filters
    const f = mtof(m); for (const [ff, q, gv] of [[780, 7, 1], [1250, 8, 0.7]]) E.voice({ t, type: "sawtooth", f, det: [-7, 7], dur: 0.17, peak: 0.1 * gv * v, perc: true, a: 0.006, cut: ff, ftype: "bandpass", q, bus: "mus", rev: 0.3, dly: 0.25, pan });
  };
  E.sweep = (t, dur, v = 1) => E.nz({ t, dur, f: 300, f2: 6000, ftype: "bandpass", q: 2, peak: 0.1 * v, swell: true, bus: "drm", rev: 0.5 });
  E.duck = (t, depth = 0.35, rel = 0.2) => { const p = E.bus.pump.gain; p.cancelScheduledValues(t - 0.001); p.setValueAtTime(1, t); p.linearRampToValueAtTime(depth, t + 0.008); p.linearRampToValueAtTime(1, t + rel); };
  E.setTempoFx = (bpm) => { dly.delayTime.value = clamp((60 / bpm) * 0.75, 0.12, 1.2); };
  E.master = master; E.sendLevel = (v) => { revG.gain.value = v; };
  return E;
}

// ==============================================================================================================================
//  THE STATIONS.  step(E, n, t, I): n counts sixteenth notes since the station began, t is the audio time, I the drive intensity
// ==============================================================================================================================
const lvl = (I, S) => clamp(I * S.f, 0, 1.4);

const NEON = {
  gain: 1.55, id: "neon", name: "NEON TIDE", tag: "Synthwave · 116 BPM", bpm: 116, swing: 0,
  roots: [33, 29, 36, 31], chords: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]],
  leadA: [[76, 0, 0, 0, 72, 0, 0, 0, 74, 0, 0, 0, 72, 0, 69, 0], [77, 0, 0, 0, 72, 0, 0, 0, 77, 0, 76, 0, 72, 0, 0, 0], [76, 0, 0, 0, 79, 0, 0, 0, 76, 0, 0, 0, 72, 0, 74, 76], [74, 0, 0, 0, 71, 0, 0, 0, 74, 0, 0, 0, 79, 0, 0, 0]],
  leadB: [[81, 0, 79, 0, 76, 0, 0, 0, 79, 0, 76, 0, 72, 0, 0, 0], [77, 0, 81, 0, 77, 0, 0, 72, 77, 0, 0, 0, 76, 0, 77, 0], [79, 0, 76, 0, 72, 0, 76, 0, 79, 0, 0, 83, 0, 0, 79, 0], [78, 0, 74, 0, 71, 0, 74, 0, 79, 0, 78, 0, 74, 0, 0, 0]],
  step(E, n, t, I) {
    const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), cb = bar % 4, S = E.section(bar), L = lvl(I, S), root = this.roots[cb], ch = this.chords[cb];
    if (s === 0) { E.pad(t, ch, sd * 16, 0.9 + (S.kind === "break" ? 0.5 : 0)); if (L > 0.75 && S.kind !== "intro") E.supersaw(t, ch.slice(0, 3).map((m) => m + 12), sd * 15, L > 1 ? 1 : 0.7); }
    if (S.kind === "drop" && S.first && s === 0) E.crash(t, 0.9);
    if (S.kind === "build" && S.lastBar && s === 0) E.riser(t, sd * 16);
    if (L > 0.22) { const idx = [0, 1, 2, 3, 2, 1, 2, 3][s % 8]; const note = ch[idx] + (s % 8 > 3 ? 12 : 0) + 12; E.pluck(t, note, sd * 1.6, (s % 4 === 0 ? 1 : 0.62) * clamp(L, 0.4, 1), { cut: 3200, cut2: 700, pan: Math.sin(n * 0.6) * 0.45, type: "square", det: [-4, 4] }); }
    const drums = S.kind !== "break" && L > 0.38;
    if (drums && s % 4 === 0) { E.kick(t, 1); E.duck(t, 0.32, sd * 3.4); }
    if (drums && L > 0.58 && (s === 4 || s === 12)) { E.snare(t, 0.9, { rev: 0.4 }); E.clap(t, 0.55); }
    if (drums && s % 4 === 2) E.hat(t, 0.9, true, 0.2);
    if (drums && L > 0.85 && s % 2 === 1) E.hat(t, 0.45, false, -0.2);
    if (S.kind === "build" && S.lastBar && L > 0.5) E.snare(t, 0.35 + (s / 16) * 0.8, { dur: 0.1, rev: 0.15 });
    if (L > 0.42 && S.kind !== "break" && s % 2 === 0) { const oct = (s === 6 || s === 14) ? 12 : 0; E.bassSaw(t, root + 12 + oct - (s % 4 === 0 ? 0 : 0), sd * 1.8, 0.85 + (s % 4 === 0 ? 0.2 : 0), 650 + L * 300); }
    if (L > 0.66 && (S.kind === "groove" || S.kind === "drop")) { const lead = ((S.ph % 2 && S.kind === "drop") ? this.leadB : this.leadA)[cb][s]; if (lead) E.voice({ t, type: "sawtooth", f: mtof(lead), det: [-8, 0, 8], dur: sd * 2.6, a: 0.01, rel: 0.12, peak: 0.07, cut: 3400, cut2: 1500, cutT: sd * 2.5, bus: "mus", rev: 0.4, dly: 0.45, vib: 8 }); }
    if (S.kind === "drop" && L > 0.95 && (s === 0 || s === 6 || s === 10)) E.supersaw(t, ch.slice(0, 3).map((m) => m + 12), sd * 1.3, 0.7);
  },
};

const BOMBAY = {
  gain: 1.15, id: "bombay", name: "BOMBAY BASS", tag: "Desi trap · 140 BPM", bpm: 140, swing: 0.04,
  roots: [36, 36, 37, 31], // C phrygian dominant: C Db E F G Ab Bb
  sitarA: [[72, 0, 73, 0, 76, 0, 77, 76, 0, 73, 0, 72, 0, 0, 0, 0], [75, 0, 0, 73, 0, 72, 0, 0, 70, 0, 72, 0, 73, 0, 72, 0], [76, 0, 77, 0, 79, 0, 77, 76, 73, 0, 72, 0, 0, 0, 73, 72], [79, 0, 0, 77, 0, 76, 0, 73, 72, 0, 0, 0, 70, 0, 72, 0]],
  tabPat: ["D..n..t.G.t.n...", "G.n.t..nD...t.n.", "D..t.nG.n.t..nG.", "G..n.t.GD.n.tnt."],
  kickPat: ["x......x..x.....", "x.....x...x..x..", "x......x..x.x...", "x..x....x.x....."],
  bassPat: ["x......x..x.....", "x.....x...x..x..", "x......x.x...x..", "x..x..x...x....."],
  step(E, n, t0, I) {
    const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), cb = bar % 4, S = E.section(bar), L = lvl(I, S), root = this.roots[cb];
    const t = t0 + (s % 2 ? this.swing * sd : 0);
    if (s % 8 === 0) { const base = [48, 43, 48, 36]; E.tanpura(t0, base[(s / 8 + bar * 2) % 4 | 0], 0.8 + 0.4 * (S.kind === "break")); if (s === 0) E.tanpura(t0 + sd * 3, 55, 0.6); }
    if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 0.8);
    if (S.kind === "build" && S.lastBar && s === 0) { E.riser(t0, sd * 16, 0.9); }
    const drums = S.kind !== "break" && L > 0.34;
    if (drums) { const k = hit(this.kickPat[bar % 4], s); if (k) { E.kick(t, 0.9, { f0: 140, f: 52, dur: 0.3 }); E.duck(t, 0.4, sd * 3); } }
    if (L > 0.4 && S.kind !== "break") { const b = hit(this.bassPat[(bar + 1) % 4], s); if (b) { const slide = (s === 10 || (s === 7 && bar % 2)) ? root + 3 : 0; E.sub(t, root, sd * (s === 7 ? 2.4 : 3.2), 0.95, { slideFrom: slide || undefined, drive: 1 }); } }
    if (drums && (s === 8 || (L > 0.9 && s === 14 && bar % 2))) { E.clap(t, s === 8 ? 1 : 0.4, { rev: 0.45 }); if (s === 8) E.snare(t, 0.4, { rev: 0.3 }); }
    if (L > 0.3) { const k = this.tabPat[bar % 4][s]; if (k !== ".") E.tabla(t, k, clamp(0.7 + 0.4 * L, 0.6, 1.1)); }
    if (L > 0.45 && S.kind !== "break") { // trap hats with rolls
      const open = s === 6 || s === 14; const roll = (bar % 2 && s >= 12) || (S.kind === "build" && S.lastBar && s >= 8);
      if (roll) { for (let k = 0; k < 3; k++) E.hat(t + (k * sd) / 3, 0.35 + 0.3 * (s / 16) + k * 0.12, false, k - 1 > 0 ? 0.3 : -0.3); }
      else E.hat(t, s % 4 === 0 ? 0.9 : s % 2 ? 0.4 : 0.6, open, ((s % 4) - 1.5) * 0.15);
    }
    if (L > 0.5 && S.kind !== "intro") { const m = this.sitarA[(bar + (S.ph % 2 ? 1 : 0)) % 4][s]; if (m) E.sitar(t, m - (S.kind === "break" ? 0 : 0), sd * (m ? 4 : 2), 0.9, (s % 3 - 1) * 0.25); }
    if (L > 0.8 && S.kind === "drop" && s === 0) { const f = [[84, 8], [82, 6], [88, 8], [84, 8]][cb]; E.flute(t, f[0], sd * f[1], 0.9, 0.2); if (cb % 2) E.flute(t + sd * 8, 79, sd * 6, 0.7, -0.2); }
    if (S.kind === "break" || S.kind === "intro") { if (s === 0) E.pad(t0, [48, 51, 55, 60].map((m) => (m === 51 ? 52 : m)), sd * 16, 0.9, { cut: 700, cut2: 1500 }); if (s % 4 === 2 && L > 0.2) E.pluck(t, 84 - ((s * 3) % 5) * 2 - (s % 8 > 3 ? 1 : 0), sd * 3, 0.5, { cut: 5000, cut2: 800, pan: s % 8 > 3 ? 0.4 : -0.4, type: "triangle", det: [0] }); }
  },
};

const SEA = {
  gain: 1.7, id: "sea", name: "SEA LINK DRIVE", tag: "Night house · 122 BPM", bpm: 122, swing: 0.03,
  roots: [38, 34, 41, 36], chords: [[62, 65, 69, 72, 76], [58, 62, 65, 69, 74], [60, 65, 69, 72, 76], [60, 64, 67, 72, 74]],
  stab: "x..x..x...x.x...", bass: "x..x..x.x..x..xo", arp: [0, 2, 4, 3, 2, 4, 3, 1],
  step(E, n, t0, I) {
    const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), cb = bar % 4, S = E.section(bar), L = lvl(I, S), root = this.roots[cb], ch = this.chords[cb];
    const t = t0 + (s % 2 ? this.swing * sd : 0);
    if (s === 0) { E.pad(t0, ch.slice(0, 4), sd * 16, 1, { a: 1.2, cut: 700, cut2: 1800 }); if (bar % 2 === 0) E.nz({ t: t0, dur: sd * 14, f: 500, f2: 1800, ftype: "bandpass", q: 0.6, peak: 0.07, swell: true, bus: "mus", rev: 0.5, pan: bar % 4 ? 0.3 : -0.3 }); }
    if (S.kind === "build" && S.lastBar && s === 0) E.riser(t0, sd * 16, 0.8);
    if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 0.6);
    const drums = S.kind !== "break" && L > 0.36;
    if (drums && s % 4 === 0) { E.kick(t0, 0.9, { f0: 140, f: 48, dur: 0.3 }); E.duck(t0, 0.4, sd * 3.2); }
    if (drums && L > 0.5 && (s === 4 || s === 12)) E.clap(t, 0.8, { rev: 0.4 });
    if (drums && s % 4 === 2) E.hat(t, 0.8, true, 0.25);
    if (L > 0.55 && S.kind !== "intro" && S.kind !== "break") E.shaker(t, s % 2 ? 0.55 : 0.85, ((s % 4) - 1.5) * 0.2);
    if (L > 0.3 && hit(this.stab, s)) { const dur = sd * 2.4; ch.forEach((m, i) => E.epiano(t, m, dur, 0.75 - i * 0.08 + (S.kind === "drop" ? 0.15 : 0), (i - 2) * 0.18)); }
    if (L > 0.4 && S.kind !== "break") { const b = hit(this.bass, s); if (b) E.bassSaw(t, root + 12 + ((s === 11 || s === 14) ? 7 : 0) - (s === 15 ? 2 : 0), sd * 2.2, 0.85 * (b === 0.35 ? 0.6 : 1), 520 + L * 300); }
    if (L > 0.5 && (S.kind === "groove" || S.kind === "drop" || S.kind === "build") && s % 2 === 0) { const i = this.arp[(s / 2) % 8]; E.pluck(t, ch[i % ch.length] + 12 + (i > 3 ? 12 : 0), sd * 2.2, 0.45 + 0.2 * (s % 8 === 0), { cut: 4200, cut2: 900, pan: ((s / 2) % 4 - 1.5) * 0.3, type: "triangle", det: [0], dly: 0.5, rev: 0.4 }); }
    if (L > 0.7 && S.kind === "drop" && s % 8 === 0) E.flute(t, ch[(bar + s) % 4] + 24, sd * 7, 0.55, s ? 0.3 : -0.3);
  },
};

const PHONK = {
  gain: 0.85, id: "phonk", name: "PHONK 3AM", tag: "Drift phonk · 150 BPM", bpm: 150, swing: 0,
  roots: [29, 29, 32, 27], chords: [[65, 68, 72], [65, 68, 72], [67, 70, 74], [63, 67, 70]],
  bell: [[0, 0, 77, 0, 0, 80, 0, 0, 77, 0, 0, 75, 0, 0, 72, 0], [0, 0, 77, 0, 0, 80, 0, 0, 82, 0, 0, 80, 0, 0, 77, 0], [0, 0, 79, 0, 0, 82, 0, 0, 79, 0, 0, 77, 0, 0, 74, 0], [0, 0, 75, 0, 0, 79, 0, 0, 75, 0, 0, 74, 0, 0, 70, 0]],
  kick: ["x.....x.x.......", "x.....x.x...o...", "x..o..x.x.......", "x.....x.x..x...."],
  bass: ["x.....x.x.......", "x.....x.x..x....", "x.....x.xx......", "x.....x.x......o"],
  step(E, n, t, I) {
    const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), cb = bar % 4, S = E.section(bar), L = lvl(I, S), root = this.roots[cb], ch = this.chords[cb];
    if (s === 0) E.pad(t, ch.map((m) => m - 12), sd * 16, 0.6, { cut: 500, cut2: 1100, a: 0.5 });
    if (S.kind === "drop" && S.first && s === 0) E.crash(t, 0.9);
    if (S.kind === "build" && S.lastBar && s === 0) E.riser(t, sd * 16, 0.9);
    const drums = S.kind !== "break" && L > 0.34;
    if (drums) { const k = hit(this.kick[bar % 4], s); if (k) { E.kick(t, k, { f0: 150, f: 44, dur: 0.28, drive: 1 }); E.duck(t, 0.38, sd * 3); } }
    if (L > 0.4 && S.kind !== "break") { const b = hit(this.bass[bar % 4], s); if (b) E.sub(t, root, sd * (s === 6 ? 2 : 6), 1, { drive: 2, slideFrom: s === 8 ? root + 5 : root + 12 }); }
    if (drums && (s === 8)) { E.clap(t, 1, { rev: 0.5 }); E.snare(t, 0.35); }
    if (L > 0.45 && S.kind !== "break") { const triplet = s % 8 >= 6 || (S.kind === "build" && s >= 8); if (triplet && L > 0.55) for (let k = 0; k < 3; k++) E.hat(t + (k * sd) / 3 * 1.0, 0.3 + k * 0.15, false, k * 0.2 - 0.2); else E.hat(t, s % 4 === 0 ? 0.8 : 0.45, s === 14, ((s % 3) - 1) * 0.2); }
    if (L > 0.45 && S.kind !== "intro") { const m = this.bell[(bar + (S.ph % 2)) % 4][s]; if (m) E.cowbell(t, mtof(m) * 0.5, 1, ((s % 5) - 2) * 0.12); }
    if (L > 0.55 && (S.kind === "groove" || S.kind === "drop") && (s === 0 || s === 3 || s === 6 || s === 10 || (S.kind === "drop" && s === 13))) E.chop(t, ch[(s + bar) % 3] + 12 + (s === 6 ? 2 : 0), 0.85, (s % 2 ? 0.35 : -0.35));
    if (S.kind === "break" && s % 4 === 0) E.pluck(t, ch[(s / 4) % 3] + 24, sd * 4, 0.6, { cut: 4800, cut2: 800, type: "triangle", det: [0], pan: (s % 8 ? 0.3 : -0.3) });
    if (L > 0.9 && S.kind === "drop" && s % 16 === 15) E.voice({ t, type: "sawtooth", f0: 60, f: 40, glide: 0.2, dur: 0.3, peak: 0.12, perc: true, bus: "drm", drive: 2 });
  },
};

const GHAT = {
  gain: 2.1, id: "ghat", name: "GHAT RUN", tag: "Drum & bass · 174 BPM", bpm: 174, swing: 0,
  roots: [28, 28, 24, 26], chords: [[52, 55, 59, 62], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62]],
  kick: "x.........x.....", snare: "....x.......x...", ghost: ".......o.o....o.",
  arp: [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 0],
  step(E, n, t, I) {
    const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), cb = bar % 4, S = E.section(bar), L = lvl(I, S), root = this.roots[cb], ch = this.chords[cb];
    if (s === 0) E.pad(t, ch.map((m) => m + 12), sd * 16, 0.9, { cut: 800, cut2: 2400, a: 0.4 });
    if (S.kind === "drop" && S.first && s === 0) E.crash(t, 1);
    if (S.kind === "build" && S.lastBar && s === 0) E.riser(t, sd * 16, 1);
    const drums = S.kind !== "break" && L > 0.3;
    if (drums) { const k = hit(this.kick, s) || ((S.kind === "drop" && bar % 2 && s === 3) ? 0.7 : 0); if (k) { E.kick(t, 0.95, { f0: 170, f: 52, dur: 0.22 }); E.duck(t, 0.55, sd * 2.2); } const sn = hit(this.snare, s); if (sn) E.snare(t, 1, { rev: 0.25, dur: 0.18 }); const gh = hit(this.ghost, s); if (gh && L > 0.5) E.snare(t, 0.3, { dur: 0.08, rev: 0.05 }); }
    if (L > 0.34 && S.kind !== "break") E.hat(t, s % 2 === 0 ? 0.75 : 0.4, s % 8 === 6, (s % 2 ? 0.25 : -0.25));
    if (L > 0.38 && S.kind !== "break") { if (s === 0 || s === 6 || s === 8 || s === 14) E.reese(t, root + (s === 6 ? 12 : s === 14 ? 7 : 0) + 12, sd * (s === 0 ? 5.5 : s === 8 ? 5.5 : 1.8), 0.9, ((bar + s) % 4) * 140); }
    if (L > 0.55 && S.kind !== "intro" && S.kind !== "break" && (s === 0 || s === 3 || s === 10) && S.kind === "drop") E.supersaw(t, ch.slice(0, 3).map((m) => m + 12), sd * 1.2, 0.6);
    if (L > 0.3 && (S.kind === "intro" || S.kind === "break" || S.kind === "groove")) { if (s % 2 === 0) E.pluck(t, ch[this.arp[s]] + 24, sd * 1.8, 0.4 + 0.15 * (s % 8 === 0), { cut: 3600, cut2: 700, type: "triangle", det: [0], pan: Math.sin(n * 0.5) * 0.4, dly: 0.5 }); }
    if (L > 0.75 && S.kind === "drop" && s % 4 === 0) E.pluck(t, ch[this.arp[(s + bar) % 16]] + 36 - (s % 8 ? 12 : 0), sd * 2, 0.5, { cut: 4800, cut2: 1200, pan: (s % 8 ? 0.4 : -0.4) });
  },
};

// the original slow rain groove, wrapped so it plays like the others
const STORM = {
  gain: 0.85, id: "storm", name: "MIDNIGHT STORM", tag: "Rain groove · 92 BPM", bpm: MUSIC_BPM, swing: 0,
  init(E) { this.tr = new Soundtrack(E.ctx, E.bus.out, { intensity: E.intensity, volume: 0.24 }); },
  step(E, n, t, I) { if (this.tr) { this.tr.setIntensity(I); this.tr.scheduleStep(t, n); } },
  setIntensity(v) { this.tr && this.tr.setIntensity(v); },
  setNitro(on) { this.tr && this.tr.setNitro(on); },
};

export const STATIONS = [NEON, BOMBAY, SEA, PHONK, GHAT, STORM];

// ==============================================================================================================================
//  the scheduler shared by the live player and the offline render
// ==============================================================================================================================
export function createRadio(ctx, dest, opts = {}) {
  const E = makeEngine(ctx, dest, opts); let cur = null, curBus = null, n = 0, nextT = 0, idx = -1; let barsPlayed = 0;
  const fadeLen = 1.4;
  function setStation(i, now = ctx.currentTime, instant = false) {
    i = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length; if (i === idx && cur) return;
    const old = curBus; const nb = { out: null }; const bus = (function () { const out = ctx.createGain(); out.gain.value = 0; out.connect(E.master); const pump = ctx.createGain(); pump.connect(out); const drm = ctx.createGain(); drm.connect(out); return { out, pump, drm }; })();
    const stg = STATIONS[i].gain || 1; bus.out.gain.setValueAtTime(0.0001, now); bus.out.gain.linearRampToValueAtTime(stg, now + (instant ? 0.05 : fadeLen));
    if (old) { old.out.gain.cancelScheduledValues(now); old.out.gain.setValueAtTime(old.out.gain.value, now); old.out.gain.linearRampToValueAtTime(0, now + fadeLen); setTimeout(() => { try { old.out.disconnect(); } catch {} }, (fadeLen + 3.5) * 1000); }
    E.setBus(bus); curBus = bus; cur = STATIONS[i]; idx = i; n = 0; barsPlayed = 0; E.stepDur = 60 / cur.bpm / 4; E.setTempoFx(cur.bpm); nextT = Math.max(nextT, now + 0.06);
    if (cur.init) cur.init(E); void nb;
    return cur;
  }
  function run(until) {
    if (!cur) return;
    while (nextT < until) { E.intensity = opts.getIntensity ? opts.getIntensity() : E.intensity; cur.step(E, n, nextT, E.intensity); n++; nextT += E.stepDur; if (n % 16 === 0) barsPlayed++; }
  }
  return {
    E, setStation, run, get station() { return cur; }, get index() { return idx; }, get bars() { return barsPlayed; },
    setIntensity(v) { E.intensity = v; if (cur && cur.setIntensity) cur.setIntensity(v); },
    setNitro(on) { E.nitro = on; if (cur && cur.setNitro) cur.setNitro(on); },
    setVolume(v) { E.master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
  };
}

// ---- live player ------------------------------------------------------------------------------------------------------------
export function createRadioPlayer() {
  let ctx = null, radio = null, timer = null, enabled = true, intensity = 0.8, idx = 0, listeners = new Set(), auto = true, lastAutoBar = 0; const volume = 0.8;
  try { if (localStorage.getItem("mb-music") === "off") enabled = false; const s = localStorage.getItem("mb-station"); if (s != null && !isNaN(+s)) idx = (+s | 0) % STATIONS.length; else idx = Math.floor(Math.random() * STATIONS.length); } catch { idx = 0; }
  const emit = () => { const st = STATIONS[idx]; listeners.forEach((f) => { try { f(st, idx); } catch {} }); };
  function build() {
    if (ctx) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      ctx = new C(); radio = createRadio(ctx, ctx.destination, { volume: enabled ? volume : 0 });
      radio.setIntensity(intensity); radio.setStation(idx, ctx.currentTime, true); emit();
      timer = setInterval(() => { if (!ctx || ctx.state !== "running") return; radio.run(ctx.currentTime + 0.22); if (auto && radio.bars - lastAutoBar >= 80) { lastAutoBar = 0; go(1); } }, 30);
      return true;
    } catch { ctx = null; return false; }
  }
  function go(d) { idx = (idx + d + STATIONS.length) % STATIONS.length; try { localStorage.setItem("mb-station", String(idx)); } catch {} if (radio) { radio.setStation(idx); lastAutoBar = 0; } emit(); }
  return {
    start() { if (!build()) return; if (ctx.state === "suspended") ctx.resume(); },
    setIntensity(v) { intensity = 0.45 + 0.75 * clamp(v, 0, 1); radio && radio.setIntensity(intensity); },
    setNitro(on) { radio && radio.setNitro(on); },
    setEnabled(on) { enabled = on; try { localStorage.setItem("mb-music", on ? "on" : "off"); } catch {} radio && radio.setVolume(on ? volume : 0); if (on) this.start(); },
    isEnabled() { return enabled; },
    next() { go(1); this.start(); }, prev() { go(-1); this.start(); },
    setStation(i) { idx = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length; try { localStorage.setItem("mb-station", String(idx)); } catch {} radio && radio.setStation(idx); emit(); },
    station() { return STATIONS[idx]; }, index() { return idx; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    stop() { clearInterval(timer); timer = null; try { ctx && ctx.close(); } catch {} ctx = null; radio = null; listeners.clear(); },
  };
}

// ---- offline render for tests -----------------------------------------------------------------------------------------------
export async function renderStation(i, seconds = 30, intensity = 1, sampleRate = 32000) {
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const r = createRadio(ctx, ctx.destination, { volume: 0.34 }); r.setIntensity(intensity); r.setStation(i, 0, true); r.run(seconds + 0.2);
  return ctx.startRendering();
}
