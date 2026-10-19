// Midnight Burn — the car's voice. Everything is made live in the browser (no sound files):
// a layered engine (low rumble + growl + scream, firing "burble" at low revs, exhaust resonances), turbo whistle and
// blow-off, throttle-lift pops and backfires, gear-change cuts, a nitrous roar with a launch "whoomph",
// tyre squeal, road rumble, wind, rain, tunnel echo, crash thuds and near-miss whooshes.
// The mix changes with the camera (inside the cockpit you hear the engine, gear whine and transmission; outside you hear more road and air).

const CARS = {
  kestrel: { pitch: 1.18, grit: 0.7, burble: 0.12, turbo: 0.35, scream: 1.0, sub: 0.7 },
  brute: { pitch: 0.7, grit: 1.0, burble: 0.95, turbo: 0.05, scream: 0.3, sub: 1.35 },
  gecko: { pitch: 1.0, grit: 0.85, burble: 0.35, turbo: 1.0, scream: 0.6, sub: 0.8 },
  phantom: { pitch: 0.92, grit: 0.8, burble: 0.5, turbo: 0.3, scream: 0.85, sub: 1.1 },
  specter: { pitch: 1.3, grit: 1.1, burble: 0.05, turbo: 0.2, scream: 1.25, sub: 0.6 },
  meteor: { pitch: 1.35, grit: 0.9, burble: 0.1, turbo: 0.5, scream: 1.3, sub: 0.6 },
  vesper: { pitch: 1.25, grit: 1.0, burble: 0.2, turbo: 0.1, scream: 1.4, sub: 0.7 },
  rennsport: { pitch: 1.1, grit: 0.9, burble: 0.3, turbo: 0.0, scream: 1.2, sub: 0.7 },
  solo: { pitch: 1.4, grit: 0.8, burble: 0.5, turbo: 0.0, scream: 1.1, sub: 0.5 },
  stinger: { pitch: 1.05, grit: 0.85, burble: 0.45, turbo: 0.0, scream: 1.0, sub: 0.8 },
  frame: { pitch: 1.45, grit: 1.0, burble: 0.6, turbo: 0.0, scream: 1.2, sub: 0.4 },
  praga: { pitch: 0.98, grit: 0.9, burble: 0.4, turbo: 0.5, scream: 0.9, sub: 1.0 },
  razor: { pitch: 1.2, grit: 1.0, burble: 0.3, turbo: 0.7, scream: 1.1, sub: 0.7 },
  seven: { pitch: 1.2, grit: 1.1, burble: 0.8, turbo: 0.0, scream: 0.9, sub: 0.6 },
  exp: { pitch: 1.15, grit: 0.9, burble: 0.5, turbo: 0.3, scream: 1.1, sub: 0.7 },
};

function shaperCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; }

export function createCarAudio(isMuted) {
  const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); if (!Ctx) return null;
  const ctx = new Ctx();
  const out = ctx.createGain(); out.gain.value = 1.5;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.16;
  out.connect(comp); comp.connect(ctx.destination);
  // tunnel / canyon echo
  const imp = ctx.createBuffer(2, ctx.sampleRate * 2.4, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
  const verb = ctx.createConvolver(); verb.buffer = imp; const verbG = ctx.createGain(); verbG.gain.value = 0; verb.connect(verbG); verbG.connect(out);
  const eng = ctx.createGain(); eng.gain.value = 0;
  // exhaust body: fixed resonances give the "tube" sound, then a cabin filter (opens up outside, closes in the cockpit)
  let chain = eng; for (const [fr, gn, q] of [[170, 7, 1.4], [420, 5, 2], [980, 4, 2.5]]) { const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = fr; pk.gain.value = gn; pk.Q.value = q; chain.connect(pk); chain = pk; }
  const cabin = ctx.createBiquadFilter(); cabin.type = "lowpass"; cabin.frequency.value = 9000; chain.connect(cabin); cabin.connect(out); cabin.connect(verb);

  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const mkNoise = (type, freq, q, dest, g0 = 0) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.loopStart = Math.random(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = g0; s.connect(f); f.connect(g); g.connect(dest); s.start(); return { f, g, s }; };

  // ---- engine core: three layers fed by saw/square oscillators through different shapers ----
  const saw = (hzMul, type = "sawtooth") => { const o = ctx.createOscillator(); o.type = type; o.start(); return o; };
  const rumbleO = saw(1), rumbleO2 = saw(1, "square"), subO = saw(1, "sine");
  const growlO = saw(1), growlO2 = saw(1, "sawtooth");
  const screamO = saw(1, "square"), screamO2 = saw(1, "sawtooth");
  const sh1 = ctx.createWaveShaper(); sh1.curve = shaperCurve(2.5); sh1.oversample = "2x";
  const sh2 = ctx.createWaveShaper(); sh2.curve = shaperCurve(9); sh2.oversample = "2x";
  const sh3 = ctx.createWaveShaper(); sh3.curve = shaperCurve(5); sh3.oversample = "2x";
  const rumbleG = ctx.createGain(), growlG = ctx.createGain(), screamG = ctx.createGain(), subG = ctx.createGain();
  const rumbleF = ctx.createBiquadFilter(); rumbleF.type = "lowpass"; rumbleF.Q.value = 1.2;
  const growlF = ctx.createBiquadFilter(); growlF.type = "bandpass"; growlF.Q.value = 1.1;
  const screamF = ctx.createBiquadFilter(); screamF.type = "highpass"; screamF.frequency.value = 900; screamF.Q.value = 0.8;
  rumbleO.connect(sh1); rumbleO2.connect(sh1); sh1.connect(rumbleF); rumbleF.connect(rumbleG); rumbleG.connect(eng);
  subO.connect(subG); subG.connect(eng);
  growlO.connect(sh2); growlO2.connect(sh2); sh2.connect(growlF); growlF.connect(growlG); growlG.connect(eng);
  screamO.connect(sh3); screamO2.connect(sh3); sh3.connect(screamF); screamF.connect(screamG); screamG.connect(eng);
  // firing burble: slow amplitude wobble on the growl layer (lumpy idle, fades as revs rise)
  const burbleL = ctx.createOscillator(); burbleL.type = "triangle"; const burbleD = ctx.createGain(); burbleD.gain.value = 0; burbleL.connect(burbleD); burbleD.connect(growlG.gain); burbleL.start();
  const intake = mkNoise("bandpass", 700, 0.8, eng);
  // turbo + gear whine
  const turboO = ctx.createOscillator(); turboO.type = "sine"; const turboG = ctx.createGain(); turboG.gain.value = 0; turboO.connect(turboG); turboG.connect(out); turboO.start();
  const whineO = ctx.createOscillator(); whineO.type = "sawtooth"; const whineF = ctx.createBiquadFilter(); whineF.type = "bandpass"; whineF.Q.value = 6; const whineG = ctx.createGain(); whineG.gain.value = 0; whineO.connect(whineF); whineF.connect(whineG); whineG.connect(out); whineO.start();
  // nitrous roar
  const nosN = mkNoise("bandpass", 900, 0.7, out); const nosO = ctx.createOscillator(); nosO.type = "sawtooth"; const nosOG = ctx.createGain(); nosOG.gain.value = 0; nosO.connect(nosOG); nosOG.connect(out); nosO.start();
  // road + air + tyres + weather
  const roadN = mkNoise("lowpass", 140, 0.6, out), windN = mkNoise("highpass", 900, 0.5, out), rainN = mkNoise("highpass", 2600, 0.4, out), hissN = mkNoise("lowpass", 450, 0.5, out);
  const sq1 = mkNoise("bandpass", 1500, 7, out), sq2 = mkNoise("bandpass", 2350, 9, out);
  const sqL = ctx.createOscillator(); sqL.frequency.value = 18; const sqLG = ctx.createGain(); sqLG.gain.value = 0; sqL.connect(sqLG); sqLG.connect(sq1.g.gain); sqL.start();

  const burst = (type, freq, q, vol, dur, dest = out, sweepTo = null, pan = 0) => {
    const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = nb; s.loopStart = Math.random(); s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(dest); } else g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
  };
  const thump = (freq, vol, dur) => { const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.4), t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); };

  const st = { boost: 0, prevThr: 0, prevRpm: 0, prevNos: false, prevShift: false, prevHit: 0, prevNm: false, popT: 0, rpmS: 0.15 };

  return {
    set(s) {
      const t = ctx.currentTime, m = isMuted();
      const C = CARS[s.car] || CARS.kestrel;
      const thr = s.thr ? 1 : 0; const load = thr ? 1 : 0.35;
      st.rpmS += (s.rpm - st.rpmS) * 0.35; const rpm = st.rpmS;
      const hz = (30 + rpm * 190 + (s.nos ? 14 : 0)) * C.pitch;
      for (const [o, mul] of [[rumbleO, 1], [rumbleO2, 0.5], [subO, 0.5], [growlO, 2], [growlO2, 2.01], [screamO, 4], [screamO2, 4.02]]) o.frequency.setTargetAtTime(hz * mul, t, 0.03);
      rumbleF.frequency.setTargetAtTime(260 + rpm * 900 + thr * 380, t, 0.05);
      growlF.frequency.setTargetAtTime(520 + rpm * 1600, t, 0.05);
      const lowRev = 1 - Math.min(1, rpm * 1.6);
      rumbleG.gain.setTargetAtTime(0.5 * C.grit * (0.8 + load * 0.4), t, 0.05);
      subG.gain.setTargetAtTime(0.55 * C.sub * (0.5 + lowRev * 0.6 + thr * 0.3), t, 0.06);
      growlG.gain.setTargetAtTime(0.22 * C.grit * (0.5 + rpm) * (0.5 + load * 0.7), t, 0.05);
      screamG.gain.setTargetAtTime(Math.max(0, rpm - 0.35) * 0.55 * C.scream * (0.4 + thr * 0.8), t, 0.05);
      burbleL.frequency.setTargetAtTime(Math.max(3, hz / 5), t, 0.05); burbleD.gain.setTargetAtTime(0.2 * C.burble * lowRev * (thr ? 0.6 : 1.2), t, 0.1);
      intake.f.frequency.setTargetAtTime(500 + rpm * 1800, t, 0.06); intake.g.gain.setTargetAtTime(thr * (0.05 + rpm * 0.14), t, 0.05);
      const shiftK = s.shifting ? 0.2 : 1;
      const interior = s.cam === 3 ? 1 : s.cam === 2 ? 0.6 : 0; // 3 = cockpit, 2 = hood
      const carGain = (0.62 + thr * 0.28 + (s.nos ? 0.18 : 0)) * (1 + interior * 0.35);
      eng.gain.setTargetAtTime(m ? 0 : carGain * shiftK, t, s.shifting ? 0.015 : 0.05);
      cabin.frequency.setTargetAtTime(interior ? 4200 + rpm * 4000 : 9000, t, 0.1);
      // turbo
      st.boost += ((thr ? rpm : 0) - st.boost) * (thr ? 0.04 : 0.1); const bst = st.boost;
      turboO.frequency.setTargetAtTime(1500 + bst * 4200, t, 0.05); turboG.gain.setTargetAtTime(m ? 0 : bst * 0.07 * C.turbo * (0.7 + interior * 0.5), t, 0.05);
      if (!thr && st.prevThr && bst > 0.45 && !m) { burst("highpass", 3200, 0.7, 0.28 * Math.max(0.4, C.turbo + 0.3), 0.5, out, 1400); }
      // pops and backfires when you lift off at high revs, and after shifts
      if (!thr && st.prevThr && rpm > 0.5 && !m) { const n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) setTimeout(() => { burst("lowpass", 520 + Math.random() * 300, 1.2, 0.5, 0.07 + Math.random() * 0.05, out); thump(95 + Math.random() * 25, 0.22, 0.09); }, 40 + i * (55 + Math.random() * 70)); }
      if (s.shifting && !st.prevShift && !m) { burst("bandpass", 1800, 0.6, 0.2, 0.18, out, 500); if (rpm > 0.45) { burst("lowpass", 700, 1.2, 0.42, 0.08, out); thump(110, 0.22, 0.1); } }
      st.prevShift = !!s.shifting;
      // gear whine rises with speed (mostly heard inside)
      whineO.frequency.setTargetAtTime(120 + s.v * 14, t, 0.08); whineF.frequency.setTargetAtTime(500 + s.v * 40, t, 0.08); whineG.gain.setTargetAtTime(m ? 0 : Math.min(1, s.v / 60) * (0.012 + interior * 0.07), t, 0.1);
      // nitrous
      if (s.nos && !st.prevNos && !m) { burst("lowpass", 900, 0.8, 0.8, 0.5, out, 120); thump(70, 0.5, 0.35); burst("bandpass", 1400, 0.5, 0.35, 0.8, out, 6000); }
      st.prevNos = !!s.nos;
      nosN.g.gain.setTargetAtTime(m ? 0 : s.nos ? 0.22 : 0, t, 0.08); nosN.f.frequency.setTargetAtTime(700 + s.v * 20, t, 0.1); nosOG.gain.setTargetAtTime(m ? 0 : s.nos ? 0.12 : 0, t, 0.08); nosO.frequency.setTargetAtTime(hz * 3, t, 0.05);
      // tyres, road, air, weather
      const sqv = m ? 0 : s.squeal;
      sq1.g.gain.setTargetAtTime(sqv * 0.16, t, 0.04); sq2.g.gain.setTargetAtTime(sqv * 0.09, t, 0.04); sq1.f.frequency.setTargetAtTime(1300 + sqv * 500 + s.v * 5, t, 0.08); sqLG.gain.setTargetAtTime(sqv * 0.05, t, 0.1);
      roadN.g.gain.setTargetAtTime(m ? 0 : Math.min(1, s.v / 55) * (s.wetRoad ? 0.5 : 0.3) * (interior ? 1.3 : 1), t, 0.15);
      windN.g.gain.setTargetAtTime(m ? 0 : Math.pow(Math.min(1, s.v / 75), 1.5) * (interior ? 0.07 : 0.2), t, 0.2); windN.f.frequency.setTargetAtTime(500 + s.v * 22, t, 0.2);
      rainN.g.gain.setTargetAtTime(m ? 0 : s.rain * (interior ? 0.16 : 0.07), t, 0.4); hissN.g.gain.setTargetAtTime(m ? 0 : 0.02, t, 0.5);
      verbG.gain.setTargetAtTime(s.tunnel ? 0.55 : 0.05, t, 0.4);
      // crashes and near misses
      if (s.hit > 3 && st.prevHit <= 3 && !m) { const k = Math.min(1, s.hit / 9); burst("lowpass", 1400, 0.6, 0.9 * (0.4 + k), 0.35, out, 200); burst("bandpass", 3200, 1.5, 0.35 * k, 0.25, out); thump(78, 0.9 * (0.4 + k), 0.4); }
      st.prevHit = s.hit || 0;
      if (s.nm && !st.prevNm && !m) burst("bandpass", 2600, 0.8, 0.45, 0.55, out, 350, Math.random() < 0.5 ? -0.8 : 0.8);
      st.prevNm = !!s.nm;
      st.prevThr = thr; st.prevRpm = rpm;
    },
    resume() { if (ctx.state === "suspended") ctx.resume(); },
    stop() { try { const z = (g) => { g.gain.value = 0; }; z(eng); z(out); for (const o of [rumbleO, rumbleO2, subO, growlO, growlO2, screamO, screamO2, burbleL, turboO, whineO, nosO, sqL]) try { o.stop(); } catch {} ctx.close(); } catch {} },
  };
}
