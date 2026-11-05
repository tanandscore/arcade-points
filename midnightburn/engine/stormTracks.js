// Midnight Burn — sixty original feel-good tracks, played live by the browser. Bright major-key chord loops (major, Lydian and
// Mixolydian), bouncy bass and drums, catchy plucked hooks (marimba, koto-style strings, electric piano, organ, sitar), with only a
// light patter of rain and the odd far-off rumble of thunder for atmosphere — the cheerful side of a drift-night street radio and a
// rainy-window electric-piano groove.
// Nothing here copies any existing song: every track is built from its own key, mode, chord loop, bass line, drum pattern
// and hook, picked by a seeded random generator, so each of the sixty sounds different and always plays the same way.
// Each track has the same shape as the older radio stations: step(E, n, t, I) is called once per sixteenth note.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const hash = (x) => { x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const hitc = (pat, s) => { const c = pat[s % pat.length]; return c === "X" ? 1 : c === "x" ? 0.72 : c === "o" ? 0.36 : 0; };

const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], phrygDom: [0, 1, 4, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11] };
const degNote = (root, mode, d) => { const m = MODES[mode]; const o = Math.floor(d / 7); return root + m[((d % 7) + 7) % 7] + 12 * o; };
const chordOf = (root, mode, d, ext = false) => [degNote(root, mode, d), degNote(root, mode, d + 2), degNote(root, mode, d + 4), degNote(root, mode, d + 6), ...(ext ? [degNote(root, mode, d + 8)] : [])];

// chord loops (scale degrees, one chord per 'hold' bars)
const PROGS = [[0, 4, 5, 3], [0, 3, 4, 3], [5, 3, 0, 4], [0, 2, 3, 4], [0, 5, 3, 4], [1, 4, 0, 3], [0, 3, 0, 4], [3, 4, 2, 5], [0, 4, 3, 4], [0, 1, 3, 0], [0, 3, 1, 4], [3, 0, 4, 5]];
const BASS_PATS = [
  "x..x..x...x..x.o", "x.x...x.x.x...x.", "x..o..x.x..x.x..", "x.x..x..x.x..x.o", "x...x.x...x.x...", "x..x.x..x..x..xo", "X..o..x.o.x..x..", "x.x.o.x.x...o.xx",
];
const KICK_PATS = ["x.....x.x.......", "x.....o.x.....x.", "x..o..x...x.....", "x.......x.x...o.", "X.....x.x.....x.", "x..o..x.x.......", "x.o...x.x.x.....", "X.......x..x..o."];
// two-bar hook rhythms (x = a note starts here)
const HOOK_RHY = ["x..x..x...x.x...", "x.x..x..x..x..x.", "x..x.x..x.x.....", "..x.x.x...x..x.x", "x...x.x.x...x...", "x.xx..x.x.......", ".x..x..x.x..x.x.", "x..x..x.x.x.x..."];

const FLAVORS = {
  storm: { label: "Rain Groove", bpm: [96, 108], modes: ["ionian", "mixo", "dorian", "lydian"], lead: "rhodes", motif: "run", bass: "walk", drums: "shuffle", rain: 0.7, thunder: 0.3, sub: 1.0, gain: 1.9, hold: 2 },
  sub: { label: "Bounce 808", bpm: [96, 104], modes: ["ionian", "lydian", "mixo", "ionian"], lead: "marimba", motif: "hook", bass: "808", drums: "bounce", rain: 0.2, thunder: 0.12, sub: 1.3, gain: 2.0, hold: 2 },
  raga: { label: "Desi Sunshine", bpm: [100, 112], modes: ["lydian", "ionian", "mixo", "ionian"], lead: "sitar", motif: "hook", bass: "sub", drums: "tabla", rain: 0.25, thunder: 0.1, sub: 1.1, gain: 1.9, hold: 2 },
  organ: { label: "Sunday Organ", bpm: [104, 118], modes: ["mixo", "ionian", "dorian", "ionian"], lead: "organ", motif: "hook", bass: "walk", drums: "shuffle", rain: 0.3, thunder: 0.15, sub: 1.05, gain: 1.9, hold: 2 },
  neon: { label: "Neon Rhodes", bpm: [112, 126], modes: ["ionian", "lydian", "ionian", "mixo"], lead: "arp", motif: "run", bass: "saw", drums: "four", rain: 0.15, thunder: 0.05, sub: 1.1, gain: 2.0, hold: 1 },
  thunder: { label: "Marimba Monsoon", bpm: [92, 104], modes: ["lydian", "ionian", "mixo", "ionian"], lead: "koto", motif: "hook", bass: "808", drums: "bounce", rain: 0.5, thunder: 0.35, sub: 1.2, gain: 2.0, hold: 2 },
};
const TITLES = {
  storm: ["Sunshower Highway", "Umbrella Overpass", "Puddle Jumper", "Green Light in the Rain", "Monsoon Smile", "Splash on the Sea Link", "Rainbow Rickshaw", "Wipers in Time", "Drizzle Drift", "Cloudburst Cruise"],
  sub: ["Drift Day Bounce", "Handbrake Hustle", "Slide Show", "Kerb Hop", "Bass in the Boot", "Sideways Samosa", "Apex Party", "Cone Dance", "Late Brake Groove", "Counter-steer Jam"],
  raga: ["Chai Break Raga", "Tabla Tailwind", "Morning Mumbai", "Sitar Sunrise", "Marine Drive Mela", "Rickshaw Rhythm", "Flute on the Flyover", "Bollywood Backseat", "Festival Lane", "Golden Hour Gali"],
  organ: ["Sunday Cruise", "Hammond Highway Sun", "Gospel Gas Station", "Boulevard Bounce", "Funky Flyover", "Soul Stoplight", "Backseat Choir", "Chrome Sunday", "Joyride Hymn", "Parel Pancakes"],
  neon: ["Rhodes on the Rails", "Glass Towers Glow", "Electric Smile", "Metro Sunrise", "Pink Overdrive", "Airport Sparkle", "Skyline Spark", "Night Shift Neon", "Chrome and Candy", "Highrise Heartbeat"],
  thunder: ["Marimba Monsoon", "Khandala Sunbreak", "Ghat Giggle", "Hairpin Hop", "Expressway Daybreak", "Mountain Marimba", "Tunnel of Light", "Pass Through the Clouds", "Pune Bound Party", "Summit Sparkle"],
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MODE_LABEL = { dorian: "Dorian", aeolian: "Minor", phrygian: "Phrygian", harm: "Harmonic minor", phrygDom: "Phrygian dominant", mixo: "Mixolydian", ionian: "Major", lydian: "Lydian" };

// a seeded melody over the scale: two bars of steps, mostly stepwise, with rests
function makeMotif(r, density, span = 9) {
  const out = []; let d = 4 + Math.floor(r() * 3);
  for (let i = 0; i < 64; i++) {
    const beat = i % 4 === 0, off = i % 2 === 1;
    const p = (beat ? density * 1.6 : off ? density * 0.35 : density) * (i % 32 > 26 ? 0.4 : 1);
    if (r() < p) { const mv = Math.floor(r() * 5) - 2; d = clamp(d + (mv === 0 ? (r() < 0.5 ? 1 : -1) : mv), 0, span); out.push(d); } else out.push(null);
  }
  return out;
}

// a catchy two-bar hook in a major pentatonic shape: it states an idea in bar one, repeats the start of it in bar two and then
// answers it, landing on the 5th, the key note or the 3rd. Returns 32 steps of pentatonic positions (or null for a rest).
const PENTA = [0, 1, 2, 4, 5]; // scale degrees of the major pentatonic: 1 2 3 5 6
const pentaDeg = (i) => PENTA[((i % 5) + 5) % 5] + 7 * Math.floor(i / 5);
function makeHook(r, density) {
  const out = new Array(32).fill(null); const rh = [pick(r, HOOK_RHY), pick(r, HOOK_RHY)];
  let p = 5 + Math.floor(r() * 3); const first = [];
  for (let s = 0; s < 16; s++) if (rh[0][s] === "x" || (rh[0][s] === "." && r() < density * 0.05)) { const mv = pick(r, [-2, -1, -1, 0, 1, 1, 2, 3, -3]); p = clamp(p + mv, 3, 9); out[s] = p; first.push(s); }
  const onsets = []; for (let s = 0; s < 16; s++) if (rh[1][s] === "x") onsets.push(s);
  onsets.forEach((s, k) => { if (k < Math.ceil(onsets.length / 2) && first[k] != null) out[16 + s] = out[first[k]]; else { const mv = pick(r, [-2, -1, -1, 1, -3, 0]); p = clamp(p + mv, 3, 9); out[16 + s] = p; } });
  const last = onsets[onsets.length - 1]; if (last != null) out[16 + last] = pick(r, [5, 7, 8, 5]); // come to rest on the key note, the 3rd or the 5th
  return out;
}

function makeTrack(flavorKey, k, id) {
  const F = FLAVORS[flavorKey]; const seed = (id + 1) * 7919 + k * 131; const r = rngOf(seed);
  const bpm = Math.round(F.bpm[0] + r() * (F.bpm[1] - F.bpm[0]));
  const mode = F.modes[k % F.modes.length]; const rootPc = pick(r, [0, 2, 4, 5, 7, 9, 2, 7, 5, 0]); const root = 28 + ((rootPc - 4 + 12) % 12); // bass root between E1 and D#2
  const prog = pick(r, PROGS); const bassPat = [pick(r, BASS_PATS), pick(r, BASS_PATS)]; const kickPat = [pick(r, KICK_PATS), pick(r, KICK_PATS)];
  const motifA = F.motif === "hook" ? makeHook(r, 0.5) : makeMotif(r, 0.5), motifB = F.motif === "hook" ? makeHook(r, 0.6) : makeMotif(r, 0.55);
  const swing = F.drums === "shuffle" ? 0.12 : F.drums === "bounce" ? 0.07 : F.drums === "brush" ? 0.08 : F.drums === "tabla" ? 0.04 : 0.02;
  const runStart = Math.floor(r() * 3);
  const title = TITLES[flavorKey][k % 10];
  const T = {
    id: `st-${flavorKey}-${k}`, name: title.toUpperCase(), tag: `${F.label} · ${bpm} BPM · ${NOTE_NAMES[rootPc]} ${MODE_LABEL[mode]}`, bpm, swing, gain: F.gain, flavor: flavorKey,
    step(E, n, t0, I) {
      const sd = E.stepDur, s = n % 16, bar = Math.floor(n / 16), S = E.section(bar), L = clamp(I * S.f, 0, 1.4);
      const t = t0 + (s % 2 ? this.swing * sd : 0);
      const ci = Math.floor(bar / F.hold) % 4, deg = prog[ci], nextDeg = prog[(Math.floor((bar + 1) / F.hold)) % 4];
      const chord = chordOf(root + 12, mode, deg, true), rootN = degNote(root, mode, deg), nextRoot = degNote(root, mode, nextDeg);
      const drums = S.kind !== "break" && L > 0.3;

      // ---- the weather: rain on the roof, now and then thunder far away ------------------------------------------------------
      if (s === 0) {
        E.nz({ t: t0, dur: sd * 16, f: 2600 + hash(bar + seed) * 1500, ftype: "highpass", q: 0.5, peak: 0.032 * F.rain * (S.kind === "break" || S.kind === "intro" ? 1.5 : 1), swell: true, bus: "mus", pan: bar % 2 ? 0.4 : -0.4 });
        if (bar % 4 === 0) E.nz({ t: t0, dur: sd * 30, f: 320, f2: 700, ftype: "bandpass", q: 0.4, peak: 0.03 * F.rain, swell: true, bus: "mus", rev: 0.4 });
        if (hash(bar * 17 + seed) < 0.1 * F.thunder + (S.kind === "intro" ? 0.25 : 0)) {
          const at = t0 + sd * Math.floor(hash(bar + 3 + seed) * 8);
          E.nz({ t: at, dur: 3.4, f: 220, f2: 70, ftype: "lowpass", q: 0.7, peak: 0.34, swell: true, a: 0.2, bus: "drm", rev: 0.5 });
          E.voice({ t: at, type: "sine", f0: 74, f: 30, glide: 2.4, dur: 3, peak: 0.34, perc: true, bus: "drm" });
        }
      }
      if (hash(n * 3 + seed) < 0.07 * F.rain && s % 2) E.nz({ t, dur: 0.03, f: 5200 + hash(n) * 3000, peak: 0.02, pan: hash(n + 1) * 2 - 1, bus: "mus" });

      // ---- chords underneath ------------------------------------------------------------------------------------------------
      if (s === 0 && bar % F.hold === 0) {
        E.pad(t0, chord.slice(0, 4).map((m) => m + 12), sd * 16 * F.hold, S.kind === "break" ? 1.4 : 0.9, { a: 0.8, cut: 950, cut2: 2600 });
        if (F.lead === "organ" && L > 0.25) organ(E, t0, chord.slice(0, 3).map((m) => m + 12), sd * 16 * F.hold - sd, 0.9);
      }
      if (F.lead === "arp" && L > 0.45 && S.kind !== "intro" && s % 2 === 0) E.pluck(t, chord[[0, 1, 2, 3, 2, 1, 2, 4][(s / 2) % 8]] + 12, sd * 2, 0.5, { cut: 3600, cut2: 800, type: "square", det: [-5, 5], pan: Math.sin(n * 0.5) * 0.5 });

      // ---- drums: soft, loose and sparse; every kick ducks the music a little ------------------------------------------------
      if (drums) {
        const kp = kickPat[bar % 2]; const kh = hitc(kp, s) || (F.drums === "four" && s % 4 === 0 ? 0.8 : 0);
        if (kh) { E.kick(t, 0.95 * kh + 0.1, { f0: 130, f: 42, dur: 0.38, drive: F.sub > 1.2 ? 1 : 0 }); E.duck(t, 0.42, sd * 3.4); }
        if (F.drums === "half") { if (s === 8) { E.snare(t, 0.7, { rev: 0.55 }); E.clap(t, 0.4, { rev: 0.5 }); } if (L > 0.5 && s % 2 === 0) E.hat(t, s % 4 ? 0.3 : 0.5, s === 14, 0.2); if (L > 0.8 && bar % 2 && s >= 13) E.hat(t + sd * 0.5, 0.35); }
        else if (F.drums === "bounce") {
          // a head-nodding drift-night beat: clap and snare on two and four, skipping hats, a little offbeat kick bounce and finger snaps
          if (s === 4 || s === 12) { E.snare(t, 0.75, { rev: 0.3 }); E.clap(t, 0.6, { rev: 0.35 }); }
          if (s % 2 === 0) E.hat(t, s % 4 === 2 ? 0.55 : 0.34, false, ((s % 8) - 3.5) * 0.08);
          if (s === 7 || s === 15) E.hat(t, 0.28, false, 0.22);
          if (s === 14) E.hat(t, 0.6, true, -0.2);
          if (L > 0.6 && (s === 10 || (bar % 4 === 3 && s === 11))) E.nz({ t, dur: 0.05, f: 2400, ftype: "bandpass", q: 1.4, peak: 0.12, bus: "drm" });
          if (L > 0.75 && bar % 2 && s >= 13) E.hat(t + (s - 13) * sd * 0.25, 0.3, false, 0.3);
        } else if (F.drums === "brush" || F.drums === "shuffle") {
          if (s === 4 || s === 12) { E.nz({ t, dur: 0.16, f: 2600, ftype: "bandpass", q: 0.9, peak: 0.12, bus: "drm", rev: 0.4 }); E.voice({ t, type: "triangle", f0: 260, f: 190, glide: 0.04, dur: 0.1, peak: 0.1, perc: true, bus: "drm" }); }
          if (s % 4 === 2 || (F.drums === "shuffle" && s % 4 === 3)) E.hat(t, s % 4 === 2 ? 0.55 : 0.3, false, ((s % 8) - 3.5) * 0.1);
          if (L > 0.55 && (s === 7 || s === 15)) E.voice({ t, type: "square", f0: 900, f: 720, glide: 0.01, dur: 0.035, peak: 0.07, perc: true, cut: 3200, ftype: "bandpass", q: 4, bus: "drm", pan: 0.3 }); // rim click
        } else if (F.drums === "tabla") {
          const pat = ["D..n..t.G.t.n...", "G.n.t..nD...t.n.", "D..t.nG.n.t..nG.", "G..n.t.GD.n.tnt."][bar % 4]; const c = pat[s]; if (c !== ".") tabla(E, t, c, clamp(0.6 + 0.4 * L, 0.5, 1.1));
          if (s === 8 && L > 0.5) E.clap(t, 0.35, { rev: 0.5 });
        } else if (F.drums === "four") { if (s === 4 || s === 12) { E.snare(t, 0.7, { rev: 0.4 }); E.clap(t, 0.4); } if (s % 2 === 0) E.hat(t, s % 4 === 2 ? 0.7 : 0.35, s % 4 === 2, 0.2); if (L > 0.7 && s % 2) E.hat(t, 0.3, false, -0.2); }
        else if (F.drums === "toms") { const tf = [96, 82, 74, 110]; if (s === 8) E.snare(t, 0.55, { rev: 0.7 }); if ((s === 6 && bar % 2) || (s === 14 && bar % 4 === 3) || (S.kind === "build" && s >= 12)) E.tom(t, tf[(s + bar) % 4], 0.85); if (L > 0.6 && s % 4 === 2) E.hat(t, 0.35, true, 0.3); }
        if (S.kind === "build" && S.lastBar) { if (s === 0) E.riser(t0, sd * 16, 0.8); if (s >= 8) E.snare(t, 0.25 + 0.6 * (s / 16), { dur: 0.08, rev: 0.2 }); }
        if (S.kind === "drop" && S.first && s === 0) E.crash(t0, 0.85);
      }

      // ---- the bass: this is the heart of every track ------------------------------------------------------------------------
      if (L > 0.22 && S.kind !== "break") {
        const b = hitc(bassPat[(bar >> 1) % 2], s);
        if (b) {
          let note = rootN; const approach = s >= 13; // lead into the next chord
          if (F.bass === "walk" || F.bass === "sub") { if (approach && nextRoot !== rootN) note = nextRoot + (hash(n + seed) < 0.5 ? -1 : 1); else if (s === 6 || s === 11) note = rootN + 7; else if (s === 9 || s === 3) note = degNote(root, mode, deg + 2); }
          if (F.bass === "saw" && (s === 6 || s === 14)) note = rootN + 12;
          const dur = sd * (b === 1 ? 3.2 : b < 0.5 ? 1.4 : 2.4);
          if (F.bass === "808") { E.sub(t, note, dur * 1.7, 1.15 * F.sub, { drive: 2, slideFrom: s === 10 ? note + 5 : undefined }); }
          else { E.sub(t, note, dur, 1.05 * F.sub, { drive: 1 }); E.voice({ t, type: "triangle", f: mtof(note + 12), dur: dur * 0.8, peak: 0.1 * F.sub, perc: true, cut: 700, bus: "mus" }); }
          if (F.bass === "saw") E.bassSaw(t, note + 12, dur, 0.55, 520 + L * 380);
          if (F.bass === "reese") E.reese(t, note + 12, dur * 1.6, 0.8, (bar % 4) * 120);
          if (F.bass === "walk" && b > 0.7) E.voice({ t, type: "sawtooth", f: mtof(note + 12), det: [-5, 5], dur: dur * 0.6, peak: 0.07, perc: true, cut: 900, cut2: 220, cutT: dur * 0.5, q: 3, bus: "mus" }); // finger-pluck growl
        }
        if ((F.bass === "reese" || F.bass === "808") && s === 0 && S.kind !== "intro") E.voice({ t, type: "sine", f: mtof(rootN - 12 < 22 ? rootN : rootN - 12), dur: sd * 14, a: 0.04, peak: 0.28 * F.sub, bus: "mus", drive: 1 }); // long sub drone under the bar
      }

      // ---- keys and lead ------------------------------------------------------------------------------------------------------
      const mot = (S.ph % 2 ? motifB : motifA)[(bar % 2) * 16 + s] ?? null;
      if (F.motif === "run" && S.kind !== "intro" && L > 0.3) {
        // a flurry of rising electric-piano notes, a pause, then a held chord
        const startS = [runStart, runStart + 1][bar % 2]; const rel = s - startS;
        if (S.kind !== "break" && bar % 2 === (S.ph % 2) && rel >= 0 && rel < 9 && rel % 1 === 0) { const sc = [0, 2, 4, 1, 3, 5, 2, 4, 6][rel] + (deg % 2); E.epiano(t, degNote(root + 24, mode, deg + sc), sd * 1.9, 0.7 + 0.2 * (rel % 3 === 0), ((rel % 5) - 2) * 0.2); }
        if (s === 0 || s === 10) chord.slice(0, 4).forEach((m, i) => E.epiano(t, m + 12, sd * (s ? 3 : 6), 0.55 - i * 0.05, (i - 1.5) * 0.25));
      } else if (mot != null && L > 0.35 && S.kind !== "intro") {
        const hi = F.lead === "marimba" || F.lead === "koto" ? 12 : 0;
        const m = F.motif === "hook" ? degNote(root + 24 + hi, mode, pentaDeg(mot)) : degNote(root + 24, mode, deg + mot - 4);
        const pn = ((s % 4) - 1.5) * 0.2;
        if (F.lead === "rhodes") E.epiano(t, m, sd * 3, 0.9, pn);
        else if (F.lead === "marimba") { marimba(E, t, m, sd * 2.5, 0.95, pn); if (L > 0.8 && s % 8 === 0) marimba(E, t + sd * 0.5, m + 12, sd * 1.5, 0.4, -pn); }
        else if (F.lead === "koto") { koto(E, t, m, sd * 3, 0.95, pn); }
        else if (F.lead === "organ") E.voice({ t, type: "sawtooth", f0: mtof(m) * 0.96, f: mtof(m), glide: 0.07, det: [-6, 6], dur: sd * 2.6, a: 0.01, rel: 0.16, peak: 0.07, cut: 3000, cut2: 1500, cutT: sd * 2.6, q: 1.5, vib: 14, vibHz: 5.5, bus: "mus", rev: 0.35, pan: pn });
        else if (F.lead === "sitar") E.sitar(t, m, sd * 3, 0.9, ((s % 3) - 1) * 0.25);
        else if (F.lead === "bell") E.pluck(t, m + 12, sd * 5, 0.6, { cut: 5200, cut2: 900, type: "triangle", det: [0, 7], rev: 0.55, dly: 0.5 });
        else E.pluck(t, m, sd * 2, 0.7, { cut: 3600, cut2: 700 });
      }
      // a little sparkle on top of the big sections
      if (S.kind === "drop" && L > 0.7 && s % 4 === 2 && F.lead !== "arp") E.pluck(t, chord[(s >> 2) % 4] + 12, sd * 1.6, 0.34, { cut: 5400, cut2: 1500, type: "triangle", det: [0], rev: 0.4, pan: (s % 8 ? 0.35 : -0.35) });
      if (F.lead === "sitar" && S.kind === "drop" && s === 0 && L > 0.7) E.flute(t, degNote(root + 36, mode, deg + 2), sd * 10, 0.85, 0.2);
      if (S.kind === "break" && s % 8 === 0 && L > 0.1) E.epiano(t, degNote(root + 24, mode, deg + (s ? 4 : 2)), sd * 7, 0.7, s ? 0.3 : -0.3);
    },
  };
  return T;
}

// a wooden marimba note: a round sine with a short "tok" overtone on top
function marimba(E, t, m, dur, v = 1, pan = 0) {
  const f = mtof(m);
  E.voice({ t, type: "sine", f, dur: Math.min(dur, 0.6), peak: 0.17 * v, perc: true, a: 0.002, bus: "mus", rev: 0.3, dly: 0.12, pan });
  E.voice({ t, type: "sine", f: f * 3.97, dur: 0.1, peak: 0.07 * v, perc: true, a: 0.001, bus: "mus", pan });
  E.voice({ t, type: "triangle", f: f * 2, dur: Math.min(dur, 0.3), peak: 0.03 * v, perc: true, bus: "mus", pan });
}
// a plucked string in the style of a koto: bright at the pluck, the filter closes fast, and the string dips in pitch for a moment
function koto(E, t, m, dur, v = 1, pan = 0) {
  const f = mtof(m), d = Math.min(dur, 0.9);
  E.voice({ t, type: "sawtooth", f0: f * 1.03, f, glide: 0.03, det: [-4, 4], dur: d, peak: 0.11 * v, perc: true, a: 0.002, cut: 4600, cut2: 600, cutT: d * 0.8, q: 2.5, bus: "mus", rev: 0.35, dly: 0.2, pan });
  E.voice({ t, type: "square", f: f * 2.003, dur: 0.14, peak: 0.02 * v, perc: true, cut: 3000, bus: "mus", pan });
}

// a Hammond-style organ chord: a few sine partials with a slow rotating-speaker wobble
function organ(E, t, notes, dur, v) {
  for (const m of notes) for (const [h, g] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.14]]) E.voice({ t, type: "sine", f: mtof(m) * h, dur, a: 0.25, rel: 0.5, peak: 0.028 * g * v, vib: 14, vibHz: 6.2, bus: "mus", rev: 0.35, pan: ((m % 5) - 2) * 0.15 });
}
function tabla(E, t, kind, v) {
  if (kind === "G") E.voice({ t, type: "sine", f0: 210, f: 98, glide: 0.11, dur: 0.34, peak: 0.34 * v, perc: true, bus: "drm", rev: 0.18 });
  else if (kind === "n") { E.voice({ t, type: "sine", f0: 820, f: 690, glide: 0.03, dur: 0.1, peak: 0.16 * v, perc: true, bus: "drm", rev: 0.15 }); E.nz({ t, dur: 0.02, f: 4000, peak: 0.07 * v, bus: "drm" }); }
  else if (kind === "t") { E.voice({ t, type: "sine", f0: 560, f: 470, glide: 0.04, dur: 0.2, peak: 0.17 * v, perc: true, bus: "drm", rev: 0.2 }); E.voice({ t, type: "sine", f: 1130, dur: 0.12, peak: 0.05 * v, perc: true, bus: "drm" }); }
  else if (kind === "D") { tabla(E, t, "G", v); tabla(E, t, "n", v * 0.8); }
}

export const STORM_TRACKS = []; let id = 0;
for (const key of ["storm", "sub", "raga", "organ", "neon", "thunder"]) for (let k = 0; k < 10; k++) STORM_TRACKS.push(makeTrack(key, k, id++));
