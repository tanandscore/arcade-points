// Midnight Burn: Tokyo Drift — the Tokyo radio. Thirty-six original tracks in three styles, all played live by the browser (no music files, nothing borrowed):
//
//   LO-FI            dusty jazz-chord loops at 68-86 BPM: warm electric piano with a tape wobble, soft lazy drums, vinyl crackle, a koto-like pluck that
//                    follows a Japanese pentatonic scale, a round sub bass and a little rain on the window
//   SYNTHWAVE        retro night-drive at 98-118 BPM: pulsing 8th-note bass, gated snare with a big room, arpeggiated analog-style synths, wide pad
//                    chords, a singing lead with vibrato, risers and tom fills
//   CHILL ELECTRONIC downtempo / deep-house at 104-122 BPM: soft four-on-the-floor, shaker and rim, warm ducking sub, plucked chord stabs,
//                    glassy bell arpeggios, airy pads and filtered sweeps
//
// Every track is built from its own key, mode, chord loop, bass line, drum pattern and tune, chosen by a seeded random generator, so each one sounds
// different and always plays the same way. Each has the usual shape: step(E, n, t, I) is called once per sixteenth note.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const hash = (x) => { x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const hitc = (pat, s) => { const c = pat[s % pat.length]; return c === "X" ? 1 : c === "x" ? 0.72 : c === "o" ? 0.36 : 0; };

const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
const MODE_LABEL = { dorian: "Dorian", aeolian: "Minor", ionian: "Major", lydian: "Lydian", mixo: "Mixolydian", phrygian: "Phrygian" };
const degNote = (root, mode, d) => { const m = MODES[mode]; const o = Math.floor(d / 7); return root + m[((d % 7) + 7) % 7] + 12 * o; };
const chordOf = (root, mode, d, ext = 0) => [degNote(root, mode, d), degNote(root, mode, d + 2), degNote(root, mode, d + 4), degNote(root, mode, d + 6), ...(ext ? [degNote(root, mode, d + 8)] : [])];
// Japanese pentatonic scales (semitones above the key): yo (bright, folk) and in (darker, temple-bell). Used for the koto-style tunes.
const YO = [0, 2, 5, 7, 9], IN = [0, 1, 5, 7, 8];
const penta = (root, scale, i) => root + scale[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PROGS = {
  lofi: [[1, 4, 0, 5], [0, 5, 1, 4], [3, 4, 2, 5], [1, 4, 0, 0], [5, 1, 4, 0], [0, 2, 3, 4], [3, 2, 1, 0], [1, 5, 3, 4]],
  synth: [[5, 3, 0, 4], [0, 5, 3, 4], [0, 3, 5, 4], [5, 4, 3, 4], [0, 4, 5, 3], [5, 3, 4, 0], [0, 2, 5, 4], [3, 4, 0, 5]],
  chill: [[1, 4, 0, 3], [0, 3, 1, 4], [3, 1, 4, 0], [0, 2, 1, 3], [1, 0, 3, 4], [0, 4, 3, 1], [5, 3, 0, 4], [2, 1, 3, 0]],
};
const BASS_PATS = ["x..x..x...x..x.o", "x.x...x.x.x...x.", "x..o..x.x..x.x..", "x.x..x..x.x..x.o", "x...x.x...x.x...", "x..x.x..x..x..xo", "X..o..x.o.x..x..", "x.x.o.x.x...o.xx"];
const KICKS = ["x.....x.x.......", "x.....o.x.....x.", "x..o..x...x.....", "x.......x.x...o.", "X.....x.x.....x."];
const LOFI_KICKS = ["x.....x...x.....", "x......x..x..o..", "x..o....x.x.....", "x.....x.x......o"];
const EIGHTH = ["x.x.x.x.x.x.x.x.", "x.x.x.xxx.x.x.xx", "x.xxx.x.x.xxx.x.", "xxx.x.xxx.x.xxx."];
const TUNE_RHY = ["x..x..x...x.x...", "x.x..x..x..x..x.", "x..x.x..x.x.....", "..x.x.x...x..x.x", "x...x.x.x...x...", "x.xx..x.x......."];

// a tune of 32 steps (two bars) over a scale: a statement, a partial repeat and an answer that settles on a calm note
function makeTune(r, density, span = 9) {
  const out = new Array(32).fill(null); const rh = [pick(r, TUNE_RHY), pick(r, TUNE_RHY)]; let p = 4 + Math.floor(r() * 3); const first = [];
  for (let s = 0; s < 16; s++) if (rh[0][s] === "x" || (rh[0][s] === "." && r() < density * 0.05)) { p = clamp(p + pick(r, [-2, -1, -1, 0, 1, 1, 2, 3, -3]), 2, span); out[s] = p; first.push(s); }
  const on = []; for (let s = 0; s < 16; s++) if (rh[1][s] === "x") on.push(s);
  on.forEach((s, k) => { if (k < Math.ceil(on.length / 2) && first[k] != null) out[16 + s] = out[first[k]]; else { p = clamp(p + pick(r, [-2, -1, -1, 1, -3, 0]), 2, span); out[16 + s] = p; } });
  const last = on[on.length - 1]; if (last != null) out[16 + last] = pick(r, [4, 5, 7, 4]);
  return out;
}

// ---- local instruments --------------------------------------------------------------------------------------------------------
// the dusty electric piano: soft sine body, a faint bell partial, a slow tape wobble on the pitch
function lofiKey(E, t, m, dur, v = 1, pan = 0, wob = 7) {
  E.voice({ t, type: "sine", f: mtof(m), det: [-4, 5], dur, peak: 0.1 * v, perc: true, a: 0.006, cut: 2400, vib: wob, vibHz: 0.9, bus: "mus", rev: 0.4, dly: 0.12, pan });
  E.voice({ t, type: "sine", f: mtof(m) * 4.01, dur: Math.min(0.35, dur), peak: 0.02 * v, perc: true, bus: "mus", pan });
  E.voice({ t, type: "triangle", f: mtof(m) * 2, dur: dur * 0.5, peak: 0.03 * v, perc: true, cut: 1800, bus: "mus", pan });
}
function koto(E, t, m, dur, v = 1, pan = 0) { // plucked string: bright at the touch, the filter closes quickly, a tiny dip in pitch
  const f = mtof(m), d = Math.min(dur, 1.0);
  E.voice({ t, type: "sawtooth", f0: f * 1.03, f, glide: 0.03, det: [-4, 4], dur: d, peak: 0.1 * v, perc: true, a: 0.002, cut: 4200, cut2: 600, cutT: d * 0.8, q: 2.5, bus: "mus", rev: 0.4, dly: 0.25, pan });
  E.voice({ t, type: "square", f: f * 2.003, dur: 0.14, peak: 0.018 * v, perc: true, cut: 3000, bus: "mus", pan });
}
function bell(E, t, m, dur, v = 1, pan = 0) { // glassy bell: two inharmonic sines, long soft tail
  const f = mtof(m);
  E.voice({ t, type: "sine", f, dur, peak: 0.09 * v, perc: true, a: 0.002, bus: "mus", rev: 0.6, dly: 0.5, pan });
  E.voice({ t, type: "sine", f: f * 2.76, dur: dur * 0.5, peak: 0.035 * v, perc: true, a: 0.001, bus: "mus", rev: 0.5, pan });
  E.voice({ t, type: "sine", f: f * 5.4, dur: dur * 0.2, peak: 0.012 * v, perc: true, bus: "mus", pan });
}
function arpSaw(E, t, m, dur, v = 1, pan = 0, cut = 3200) { // analog-style synth arpeggio note
  E.voice({ t, type: "sawtooth", f: mtof(m), det: [-9, 0, 9], dur, peak: 0.07 * v, perc: true, a: 0.003, cut, cut2: cut * 0.28, cutT: dur * 0.9, q: 3, bus: "mus", rev: 0.25, dly: 0.4, pan });
}
function crackle(E, t, density, seed, n) { // vinyl dust: tiny clicks at random, a faint hiss bed
  if (hash(n * 7 + seed) < density) E.nz({ t, dur: 0.012 + hash(n + seed) * 0.02, f: 2600 + hash(n * 3 + seed) * 5000, peak: 0.02 + hash(n * 5 + seed) * 0.03, pan: hash(n + 9 + seed) * 2 - 1, bus: "mus" });
}

// ---- the three styles -----------------------------------------------------------------------------------------------------------
const STYLE = {
  lofi: { label: "Lo-fi", bpm: [68, 86], modes: ["dorian", "ionian", "aeolian", "mixo"], gain: 2.2, hold: 2, rain: 0.35, sub: 1.1 },
  synth: { label: "Synthwave", bpm: [98, 118], modes: ["aeolian", "aeolian", "dorian", "phrygian"], gain: 2.2, hold: 2, rain: 0, sub: 1.0 },
  chill: { label: "Chill electronic", bpm: [104, 122], modes: ["dorian", "lydian", "aeolian", "ionian"], gain: 1.9, hold: 2, rain: 0, sub: 1.15 },
};
const TITLES = {
  lofi: ["Rainy Konbini", "Last Train Home", "Vending Machine Glow", "Shibuya After Midnight", "Slow Tea in Yanaka", "Paper Lantern Alley", "Neon in the Puddles", "Ramen Steam", "Tatami Daydream", "Rooftop Cat", "Sleepy Sumida", "Tokyo Tower Lullaby"],
  synth: ["Neon Expressway", "Shuto Nights", "Chrome Kanto", "Rainbow Bridge Run", "Midnight Wangan", "Pink Skyline", "Akihabara Arcade", "Bay Lights 1986", "Electric Torii", "Tower of Red Light", "Drive to Daikoku", "Last Exit Shinjuku"],
  chill: ["Soft Landing at Haneda", "Glass Towers Breathing", "Harbour Haze", "Odaiba Breeze", "Midnight Metro", "Tidal Ginza", "Quiet Crossing", "Sakura Static", "Yokohama Slow Light", "Blue Hour Overpass", "Float Over Tokyo Bay", "Daybreak Skytree"],
};

function makeTrack(style, k, id) {
  const F = STYLE[style]; const seed = (id + 1) * 6151 + k * 211; const r = rngOf(seed);
  const bpm = Math.round(F.bpm[0] + r() * (F.bpm[1] - F.bpm[0]));
  const mode = F.modes[k % F.modes.length]; const rootPc = pick(r, [0, 2, 4, 5, 7, 9, 2, 9, 7, 0]); const root = 28 + ((rootPc - 4 + 12) % 12);
  const prog = pick(r, PROGS[style]); const bassPat = [pick(r, BASS_PATS), pick(r, BASS_PATS)];
  const kickPat = style === "lofi" ? [pick(r, LOFI_KICKS), pick(r, LOFI_KICKS)] : [pick(r, KICKS), pick(r, KICKS)];
  const tuneA = makeTune(r, 0.5), tuneB = makeTune(r, 0.6); const scaleJP = r() < 0.5 ? YO : IN;
  const eighth = pick(r, EIGHTH); const arpPat = [0, 1, 2, 3, 2, 1, 2, 4].map((v, i) => (i + Math.floor(r() * 3)) % 5 === 0 ? v : v);
  const swing = style === "lofi" ? 0.18 : style === "chill" ? 0.05 : 0.0;
  const title = TITLES[style][k % 12];
  return {
    id: `tk-${style}-${k}`, name: title.toUpperCase(), tag: `${F.label} · ${bpm} BPM · ${NOTE_NAMES[rootPc]} ${MODE_LABEL[mode]}`, bpm, swing, gain: F.gain, flavor: style,
    step(E, n, t0, I) {
      const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), S = E.section(bar), L = clamp(I * S.f, 0, 1.4);
      const t = t0 + (s % 2 ? this.swing * sd : 0);
      const ci = Math.floor(bar / F.hold) % 4, deg = prog[ci], nextDeg = prog[Math.floor((bar + 1) / F.hold) % 4];
      const chord = chordOf(root + 12, mode, deg, 1), rootN = degNote(root, mode, deg), nextRoot = degNote(root, mode, nextDeg);
      const drums = S.kind !== "break" && L > 0.28;
      const tune = (S.ph % 2 ? tuneB : tuneA)[(bar % 2) * 16 + s];
      const cut = (a, b) => ({ cut: a + L * b });

      // ============================== LO-FI ======================================================================================
      if (style === "lofi") {
        crackle(E, t, 0.28, seed, n);
        if (s === 0) { E.nz({ t: t0, dur: sd * 16, f: 3800, ftype: "highpass", q: 0.4, peak: 0.02 * F.rain * (S.kind === "break" ? 1.6 : 1), swell: true, bus: "mus", pan: bar % 2 ? 0.3 : -0.3 }); }
        if (s === 0 && bar % F.hold === 0) E.pad(t0, chord.slice(0, 4).map((m) => m + 12), sd * 16 * F.hold, S.kind === "break" ? 1.2 : 0.7, { a: 1.0, cut: 620, cut2: 1300 });
        // chords: rolled, off the beat, like a lazy hand on the keys
        if (L > 0.22 && S.kind !== "intro" && (s === 0 || s === 6 || s === 10)) chord.slice(0, 5).forEach((m, i) => lofiKey(E, t + i * sd * 0.18, m + (s === 6 ? 0 : 0), sd * (s === 0 ? 6 : 3.5), (s === 0 ? 0.9 : 0.62) - i * 0.06, (i - 2) * 0.16));
        if (drums) {
          const kh = hitc(kickPat[bar % 2], s); if (kh) { E.kick(t, 0.72 * kh + 0.1, { f0: 120, f: 44, dur: 0.34 }); E.duck(t, 0.55, sd * 3); }
          if (s === 4 || s === 12) { E.nz({ t, dur: 0.16, f: 2100, ftype: "bandpass", q: 0.8, peak: 0.1, bus: "drm", rev: 0.35 }); E.voice({ t, type: "triangle", f0: 240, f: 170, glide: 0.04, dur: 0.09, peak: 0.1, perc: true, bus: "drm" }); }
          if (s % 2 === 0) E.nz({ t: t + (s % 4 ? 0.01 : 0), dur: 0.04, f: 6200, peak: s % 4 === 2 ? 0.06 : 0.035, bus: "drm", pan: ((s % 8) - 3.5) * 0.07 }); // soft hats, a little behind the beat
          if (L > 0.6 && s === 7 && bar % 2) E.nz({ t, dur: 0.05, f: 1800, ftype: "bandpass", q: 1.4, peak: 0.07, bus: "drm" });
        }
        if (L > 0.2 && S.kind !== "break") { const b = hitc(bassPat[(bar >> 1) % 2], s); if (b) { let note = rootN; if (s >= 13 && nextRoot !== rootN) note = nextRoot + (hash(n + seed) < 0.5 ? -1 : 1); else if (s === 6 || s === 11) note = rootN + 7; E.sub(t, note, sd * (b === 1 ? 3.4 : 2), 1.05 * F.sub, { drive: 0 }); } }
        if (tune != null && L > 0.38 && S.kind !== "intro") { const m = penta(root + 36, scaleJP, tune - 4); koto(E, t, m, sd * 4, 0.8, ((s % 4) - 1.5) * 0.2); if (L > 0.85 && s % 8 === 0) bell(E, t + sd, m + 12, sd * 6, 0.35, 0.3); }
        if (S.kind === "break" && s % 8 === 0) bell(E, t, penta(root + 48, scaleJP, bar + s), sd * 7, 0.5, s ? 0.3 : -0.3);
        if (S.kind === "build" && S.lastBar && s === 0) E.riser(t0, sd * 16, 0.35);
        if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 0.4);
      }

      // ============================== SYNTHWAVE ==================================================================================
      else if (style === "synth") {
        if (s === 0 && bar % F.hold === 0) { E.pad(t0, chord.slice(0, 4).map((m) => m + 12), sd * 16 * F.hold, S.kind === "break" ? 1.5 : 1, { a: 0.5, cut: 1300, cut2: 3200 }); if (L > 0.7 && S.kind !== "intro") E.supersaw(t0, chord.slice(0, 3).map((m) => m + 12), sd * 16 * F.hold - sd, 0.55); }
        if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 1);
        if (S.kind === "build" && S.lastBar && s === 0) E.riser(t0, sd * 16, 1);
        if (drums) {
          if (s % 4 === 0) { E.kick(t, 1, { f0: 150, f: 48, dur: 0.3 }); E.duck(t, 0.4, sd * 3); }
          if (s === 4 || s === 12) { E.snare(t, 1, { rev: 0.65, dur: 0.3 }); E.clap(t, 0.5, { rev: 0.5 }); } // the big gated-room snare
          if (s % 2 === 0) E.hat(t, s % 4 === 2 ? 0.7 : 0.4, s % 8 === 6, ((s % 8) - 3.5) * 0.1);
          if (L > 0.8 && s % 2 === 1) E.hat(t, 0.25, false, 0.25);
          if (S.kind === "build" && S.lastBar && s >= 8) E.snare(t, 0.25 + 0.6 * (s / 16), { dur: 0.1, rev: 0.2 });
          if (bar % 4 === 3 && s >= 12 && L > 0.5) E.tom(t, [140, 118, 98, 82][s - 12], 0.8);
        }
        // pulsing eighth-note bass on the chord root: the engine of the night drive
        if (L > 0.26 && S.kind !== "break" && s % 2 === 0 && eighth[s] === "x") { const note = rootN + 12 + ((s === 6 || s === 14) && L > 0.7 ? 12 : 0) - (s >= 14 && nextRoot !== rootN ? 0 : 0); E.bassSaw(t, note, sd * 1.7, 0.85 + (s % 4 === 0 ? 0.2 : 0), 560 + L * 420); }
        if (L > 0.45 && S.kind !== "intro" && S.kind !== "break" && s % 2 === 0) arpSaw(E, t, chord[[0, 1, 2, 3, 2, 1, 2, 4][(s / 2) % 8] % chord.length] + 12 + (s % 8 > 3 ? 12 : 0), sd * 2, 0.8, Math.sin(n * 0.55) * 0.5, 3000 + L * 800);
        // the lead: a singing saw with vibrato
        if (tune != null && L > 0.55 && (S.kind === "groove" || S.kind === "drop")) { const m = degNote(root + 36, mode, tune - 3); E.voice({ t, type: "sawtooth", f: mtof(m), det: [-8, 0, 8], dur: sd * 3, a: 0.012, rel: 0.14, peak: 0.07, cut: 3400, cut2: 1700, cutT: sd * 3, vib: 14, vibHz: 5.3, bus: "mus", rev: 0.45, dly: 0.35, pan: 0.15 }); }
        if (S.kind === "break" && s % 4 === 0) arpSaw(E, t, chord[(s / 4) % 4] + 24, sd * 3, 0.55, s % 8 ? 0.3 : -0.3, 2600);
      }

      // ============================== CHILL ELECTRONIC ===========================================================================
      else {
        if (s === 0 && bar % F.hold === 0) E.pad(t0, chord.slice(0, 5).map((m) => m + 12), sd * 16 * F.hold, S.kind === "break" ? 1.4 : 0.9, { a: 1.1, cut: 800, cut2: 2200 });
        if (s === 0 && bar % 4 === 0) E.nz({ t: t0, dur: sd * 30, f: 400, f2: 2400, ftype: "bandpass", q: 0.7, peak: 0.06, swell: true, bus: "mus", rev: 0.6, pan: bar % 8 ? 0.3 : -0.3 });
        if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 0.55);
        if (S.kind === "build" && S.lastBar && s === 0) E.riser(t0, sd * 16, 0.6);
        if (drums) {
          if (s % 4 === 0) { E.kick(t0, 0.85, { f0: 135, f: 46, dur: 0.3 }); E.duck(t0, 0.36, sd * 3.4); }
          if (s === 4 || s === 12) { E.clap(t, 0.55, { rev: 0.55 }); E.nz({ t, dur: 0.06, f: 3400, ftype: "bandpass", q: 1.6, peak: 0.07, bus: "drm" }); } // clap and rim
          if (s % 2 === 0) E.shaker(t, s % 4 === 2 ? 0.9 : 0.5, ((s % 8) - 3.5) * 0.09);
          if (s % 4 === 2) E.hat(t, 0.5, true, 0.25);
          if (L > 0.6 && s === 15) E.hat(t, 0.4, false, -0.3);
        }
        // a round sub bass, ducked by the kick, with an octave pluck on the off-beats
        if (L > 0.2 && S.kind !== "break") { const b = hitc(bassPat[(bar >> 1) % 2], s); if (b) { let note = rootN; if (s >= 13 && nextRoot !== rootN) note = nextRoot + (hash(n + seed) < 0.5 ? -1 : 1); else if (s === 6 || s === 11) note = rootN + 7; E.sub(t, note, sd * (b === 1 ? 3.2 : 2), 1.0 * F.sub, { drive: 1 }); if (b > 0.5) E.voice({ t, type: "triangle", f: mtof(note + 12), dur: sd * 1.4, peak: 0.07, perc: true, cut: 800, bus: "mus" }); } }
        // chord stabs, off the beat
        if (L > 0.3 && S.kind !== "intro" && (s === 3 || s === 6 || s === 11)) chord.slice(0, 4).forEach((m, i) => E.pluck(t + i * sd * 0.05, m + 12, sd * 2.2, 0.5, { cut: 2600 + L * 800, cut2: 600, type: "triangle", det: [-6, 6], rev: 0.45, dly: 0.35, pan: (i - 1.5) * 0.25 }));
        // glassy bell arpeggio and tune
        if (L > 0.45 && S.kind !== "break" && s % 2 === 0) { const i = arpPat[(s / 2) % 8]; bell(E, t, chord[i % chord.length] + 24, sd * 5, 0.5 + 0.2 * (s % 8 === 0), ((s / 2) % 4 - 1.5) * 0.3); }
        if (tune != null && L > 0.55 && S.kind === "drop") bell(E, t, degNote(root + 36, mode, tune - 3), sd * 6, 0.7, 0.2);
        if (S.kind === "break" && s % 8 === 0) bell(E, t, degNote(root + 36, mode, deg + (s ? 4 : 2)), sd * 8, 0.65, s ? 0.3 : -0.3);
      }
      void cut;
    },
  };
}

export const TOKYO_TRACKS = []; let id = 0;
for (const style of ["lofi", "synth", "chill"]) for (let k = 0; k < 12; k++) TOKYO_TRACKS.push(makeTrack(style, k, id++));
export const TOKYO_GENRES = [{ key: "lofi", label: "Lo-fi", from: 0, n: 12 }, { key: "synth", label: "Synthwave", from: 12, n: 12 }, { key: "chill", label: "Chill electronic", from: 24, n: 12 }];
