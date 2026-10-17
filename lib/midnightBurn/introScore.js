// Midnight Burn — the cinematic intro score, composed in code and played live by the browser (no audio files).
// 100 BPM, A minor. Timeline (seconds): 0–9.6 rain + slow pad and plucks, 9.6–16.8 heartbeat kick joins, 16.8–21.6 four-on-floor builds,
// 21.6–26.4 riser + snare roll, a half-second silence, then THE DROP at 26.4 (title), driving beat to 38.4, long outro to 43.2.
export const INTRO = { BAR: 2.4, DROP: 26.4, END: 43.2, CUTS: [9.6, 16.8, 26.4], OUTRO: 38.4 };

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]; // Am F C G (midi chord tones, mid register)
const ROOTS = [33, 29, 36, 31]; // A1 F1 C2 G1

export function createIntroScore(isMuted) {
  const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain(); master.gain.value = 0.0001;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.18;
  master.connect(comp); comp.connect(ctx.destination);
  const dry = ctx.createGain(); dry.connect(master);
  const imp = ctx.createBuffer(2, ctx.sampleRate * 3.2, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2); }
  const verb = ctx.createConvolver(); verb.buffer = imp; const verbG = ctx.createGain(); verbG.gain.value = 0.55; verb.connect(verbG); verbG.connect(master);
  const dly = ctx.createDelay(1); dly.delayTime.value = 0.45; const fb = ctx.createGain(); fb.gain.value = 0.38; const dlpf = ctx.createBiquadFilter(); dlpf.type = "lowpass"; dlpf.frequency.value = 2400; dly.connect(dlpf); dlpf.connect(fb); fb.connect(dly); dlpf.connect(verb); dlpf.connect(master);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const send = (node, v, d = 0) => { if (v) { const g = ctx.createGain(); g.gain.value = v; node.connect(g); g.connect(verb); } if (d) { const g = ctx.createGain(); g.gain.value = d; node.connect(g); g.connect(dly); } };
  function tone(f, t, dur, { type = "sawtooth", vol = 0.1, lp = 2000, atk = 0.01, rel = 0.2, det = 0, rev = 0, dl = 0, glide = 0, q = 0.7 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), t + dur); o.detune.value = det;
    const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(lp, t); fl.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.setTargetAtTime(0.0001, t + Math.max(atk, dur - rel), rel / 3);
    o.connect(fl); fl.connect(g); g.connect(dry); send(g, rev, dl); o.start(t); o.stop(t + dur + rel);
  }
  function noise(t, dur, { type = "highpass", f0 = 4000, f1 = 0, vol = 0.1, atk = 0.005, q = 0.7, rev = 0, pan = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.loopStart = Math.random(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dry); send(g, rev); s.start(t); s.stop(t + dur + 0.05);
  }
  const kick = (t, v = 0.9) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.5); noise(t, 0.02, { type: "highpass", f0: 2500, vol: v * 0.25 }); };
  const clap = (t, v = 0.5) => { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.14, { type: "bandpass", f0: 1500, q: 0.8, vol: v * (i === 2 ? 1 : 0.6), rev: 0.25 }); };
  const hat = (t, v = 0.15, open = false) => noise(t, open ? 0.22 : 0.05, { type: "highpass", f0: 7500, vol: v });

  const T0 = ctx.currentTime + 0.25;
  const A = (t) => T0 + t;
  function schedule() {
    const B = INTRO.BAR, beat = B / 4, e8 = beat / 2, s16 = beat / 4;
    master.gain.setValueAtTime(0.0001, T0); master.gain.linearRampToValueAtTime(isMuted() ? 0 : 1.15, T0 + 1.2);
    // rain bed (0 → drop)
    noise(A(0), 26.4, { type: "highpass", f0: 2800, vol: 0.025, atk: 2 });
    // pads: one chord per bar; the filter opens as the intro builds
    for (let bar = 0; bar < 18; bar++) {
      const t = bar * B; const ch = PROG[bar % 4]; const open = Math.min(1, t / 24); const post = t >= INTRO.DROP && t < INTRO.OUTRO; const dur = B + 0.3;
      for (const m of ch) for (const d of [-9, 9]) tone(hz(m), A(t), dur, { vol: post ? 0.032 : 0.05 * (0.4 + open), lp: 500 + open * 2600 + (post ? 1800 : 0), atk: 0.5, rel: 1.2, det: d, rev: 0.5 });
    }
    // sub bass: long notes, then pulsing eighths from bar 4, then heavy sawtooth bass at the drop
    for (let bar = 0; bar < 18; bar++) {
      const t = bar * B; const r = hz(ROOTS[bar % 4]);
      if (t < 9.6) tone(r, A(t), B, { type: "sine", vol: 0.28, lp: 400, atk: 0.3, rel: 0.6 });
      else if (t < INTRO.DROP) for (let k = 0; k < 8; k++) tone(r, A(t + k * e8), e8 * 0.9, { type: "sine", vol: 0.3, lp: 500, atk: 0.01, rel: 0.12 });
      else if (t < INTRO.OUTRO) for (let k = 0; k < 8; k++) { tone(r, A(t + k * e8), e8 * 0.92, { type: "sawtooth", vol: 0.2, lp: 260 + (k % 2) * 700, atk: 0.005, rel: 0.1, q: 3 }); tone(r, A(t + k * e8), e8 * 0.92, { type: "sine", vol: 0.28, lp: 300, atk: 0.005, rel: 0.1 }); }
      else if (t < INTRO.END) tone(r, A(t), B, { type: "sine", vol: 0.3 * (1 - (t - INTRO.OUTRO) / 5), lp: 400, atk: 0.3, rel: 1.2 });
    }
    // plucks: sparse arpeggio from bar 1.5, fuller at the drop
    for (let bar = 1; bar < 18; bar++) {
      const t = bar * B; if (t >= INTRO.OUTRO) break; const ch = PROG[bar % 4]; const drop = t >= INTRO.DROP; const step = drop ? s16 : e8 * 2;
      const n = Math.round(B / step);
      for (let k = 0; k < n; k++) { if (!drop && t < 16.8 && k % 2) continue; const m = ch[(k * (drop ? 3 : 1)) % 4] + (drop && k % 4 === 3 ? 12 : 12); tone(hz(m), A(t + k * step), step * 1.8, { type: "square", vol: drop ? 0.07 : 0.045, lp: drop ? 3800 : 1700, atk: 0.003, rel: 0.25, rev: 0.4, dl: 0.35 }); }
    }
    // drums
    for (let bar = 4; bar < 18; bar++) {
      const t = bar * B; if (t >= INTRO.OUTRO - 0.01) break;
      for (let b = 0; b < 4; b++) {
        const tt = t + b * beat; const drop = t >= INTRO.DROP, build = t >= 16.8 && !drop;
        if (drop || build || b % 2 === 0) kick(A(tt), drop ? 1 : build ? 0.7 : 0.45);
        if (drop && b % 2 === 1) clap(A(tt), 0.55);
        if (drop) { hat(A(tt + e8), 0.16, true); for (const q of [0, 2]) hat(A(tt + q * s16), 0.1); hat(A(tt + 3 * s16), 0.07); }
        else if (build) hat(A(tt + e8), 0.07);
      }
    }
    // riser + snare roll into the drop, then silence, then impact
    const R0 = INTRO.DROP - 4.8;
    noise(A(R0), 4.6, { type: "highpass", f0: 400, f1: 11000, vol: 0.2, atk: 4.2, rev: 0.3 });
    tone(220, A(R0), 4.7, { type: "sawtooth", vol: 0.07, lp: 6000, atk: 4, rel: 0.1, glide: 8, rev: 0.4 });
    let tt = INTRO.DROP - 3.6; let gap = beat / 2; while (tt < INTRO.DROP - 0.55) { noise(A(tt), 0.1, { type: "bandpass", f0: 2200, q: 0.7, vol: 0.14 + (tt - (INTRO.DROP - 3.6)) * 0.05 }); tt += gap; gap = Math.max(s16 / 2, gap * 0.9); }
    master.gain.setValueAtTime(isMuted() ? 0 : 1.15, A(INTRO.DROP - 0.62)); master.gain.linearRampToValueAtTime(0.12, A(INTRO.DROP - 0.5)); master.gain.setValueAtTime(0.12, A(INTRO.DROP - 0.03)); master.gain.linearRampToValueAtTime(isMuted() ? 0 : 1.3, A(INTRO.DROP + 0.02));
    // THE DROP
    const D = A(INTRO.DROP);
    kick(D, 1.2);
    { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(70, D); o.frequency.exponentialRampToValueAtTime(30, D + 1.6); const g = ctx.createGain(); g.gain.setValueAtTime(0.9, D); g.gain.exponentialRampToValueAtTime(0.0001, D + 2.2); o.connect(g); g.connect(dry); o.start(D); o.stop(D + 2.3); }
    noise(D, 3.2, { type: "highpass", f0: 5000, vol: 0.28, rev: 0.5 });
    noise(D, 0.5, { type: "lowpass", f0: 1600, f1: 120, vol: 0.5 });
    for (const m of [45, 57, 60, 64, 67, 72]) for (const d of [-14, 0, 14]) tone(hz(m), D, 2.3, { type: "sawtooth", vol: 0.05, lp: 4200, atk: 0.005, rel: 1.4, det: d, rev: 0.5 });
    // lead melody over the drop bars (A minor hook)
    const hook = [[72, 0], [71, 1], [69, 1.5], [67, 2], [69, 3], [72, 4], [74, 5], [72, 6], [76, 8], [74, 9], [72, 9.5], [71, 10], [69, 11], [67, 12], [69, 13], [64, 14]];
    for (const [m, k] of hook) { const tm = INTRO.DROP + 0.3 + k * beat * 0.75; if (tm >= INTRO.OUTRO) break; tone(hz(m), A(tm), beat * 0.9, { type: "sawtooth", vol: 0.075, lp: 4800, atk: 0.01, rel: 0.25, det: 8, rev: 0.45, dl: 0.4 }); tone(hz(m), A(tm), beat * 0.9, { type: "square", vol: 0.04, lp: 3200, atk: 0.01, rel: 0.25, det: -8 }); }
    // outro: closing chord and fade
    tone(hz(45), A(INTRO.OUTRO), 4.8, { type: "sine", vol: 0.3, lp: 300, atk: 0.2, rel: 2.5 });
    for (const m of [57, 60, 64, 69]) tone(hz(m), A(INTRO.OUTRO), 4.8, { type: "sawtooth", vol: 0.04, lp: 1800, atk: 0.8, rel: 2.5, det: 6, rev: 0.7 });
    master.gain.setValueAtTime(isMuted() ? 0 : 1.3, A(INTRO.OUTRO + 1)); master.gain.linearRampToValueAtTime(0.0001, A(INTRO.END));
  }
  schedule();
  return {
    resume() { if (ctx.state === "suspended") ctx.resume(); },
    now() { return ctx.currentTime - T0; },
    stop(fade = 0.3) { try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3); setTimeout(() => { try { ctx.close(); } catch {} }, fade * 1000 + 300); } catch {} },
  };
}
