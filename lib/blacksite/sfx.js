// Sound effects for the first-person Blacksite, all generated live (no audio files).
// Sounds that happen in the world are placed in 3D, so you can hear which side a gunshot,
// footstep or bomb beep is coming from, and how far away it is.

export function createSfx() {
  let ctx = null, master = null, wet = null, noiseBuf = null, ambient = null;
  const state = { vol: 0.8 };
  try { if (typeof localStorage !== "undefined") { const v = parseFloat(localStorage.getItem("blacksite-sfx") || ""); if (!Number.isNaN(v)) state.vol = v; } } catch {}

  function build() {
    if (ctx) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      ctx = new C(); master = ctx.createGain(); master.gain.value = state.vol; master.connect(ctx.destination);
      // short indoor-ish echo that gunshots and explosions feed into
      const len = Math.floor(ctx.sampleRate * 1.8); const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      const conv = ctx.createConvolver(); conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.32; wet.connect(conv); conv.connect(master);
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; noiseBuf = nb;
      return true;
    } catch { ctx = null; return false; }
  }
  const ok = () => ctx && ctx.state === "running";
  const noise = (dur, freq, q, type = "bandpass") => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); return { src: s, out: f, dur };
  };
  // a placed output: returns a node to connect to. pos = {x,y,z} or null for "in your head"
  function out(pos, reverb = 0.5) {
    const g = ctx.createGain();
    if (pos) {
      const p = ctx.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = 3; p.rolloffFactor = 1.15; p.maxDistance = 200;
      p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.4; p.positionZ.value = pos.z; g.connect(p); p.connect(master);
      if (reverb > 0) { const r = ctx.createGain(); r.gain.value = reverb; p.connect(r); r.connect(wet); }
    } else { g.connect(master); if (reverb > 0) { const r = ctx.createGain(); r.gain.value = reverb * 0.6; g.connect(r); r.connect(wet); } }
    return g;
  }
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(dest, t, f0, f1, dur, type, peak) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); const g = ctx.createGain(); env(g, t, peak, 0.004, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); }
  function burst(dest, t, freq, q, dur, peak, type = "bandpass", f1) {
    const n = noise(dur, freq, q, type); if (f1) n.out.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); env(g, t, peak, 0.002, dur); n.out.connect(g); g.connect(dest); n.src.start(t, Math.random()); n.src.stop(t + dur + 0.05);
  }

  const api = {
    start() { if (!build()) return; if (ctx.state === "suspended") ctx.resume(); },
    stop() { try { ctx && ctx.close(); } catch {} ctx = null; },
    setVolume(v) { state.vol = v; try { localStorage.setItem("blacksite-sfx", String(v)); } catch {} if (master) master.gain.value = v; },
    getVolume: () => state.vol,
    listener(x, y, z, yaw) {
      if (!ok()) return; const L = ctx.listener;
      if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = -Math.sin(yaw); L.forwardY.value = 0; L.forwardZ.value = -Math.cos(yaw); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    },
    shot(kind, pos, suppressed = false) {
      if (!ok()) return; const t = ctx.currentTime; const o = out(pos, 0.55); const big = kind === "sniper" ? 1.7 : kind === "rifle" ? 1.1 : kind === "smg" ? 0.8 : kind === "pistol" ? 0.7 : 0.5;
      o.gain.value = 0.5 * big;
      burst(o, t, kind === "sniper" ? 1400 : kind === "rifle" ? 1900 : kind === "smg" ? 2600 : 2200, 0.7, kind === "sniper" ? 0.34 : 0.14, 1.0, "bandpass", 500);
      tone(o, t, kind === "sniper" ? 140 : kind === "rifle" ? 190 : 260, 48, kind === "sniper" ? 0.4 : 0.18, "triangle", 0.9);
      burst(o, t, 6500, 0.4, 0.05, 0.5, "highpass");
    },
    knife(pos) { if (!ok()) return; const t = ctx.currentTime; burst(out(pos, 0.1), t, 3200, 1.2, 0.12, 0.4, "bandpass", 800); },
    reload(pos, phase = 0) { if (!ok()) return; const t = ctx.currentTime; const o = out(pos, 0.15); o.gain.value = 0.35; burst(o, t, 1800, 4, 0.05, 0.6); burst(o, t + 0.9, 900, 3, 0.07, 0.6); burst(o, t + 1.5, 2400, 5, 0.04, 0.5); },
    empty(pos) { if (!ok()) return; burst(out(pos, 0.1), ctx.currentTime, 2600, 6, 0.04, 0.4); },
    step(pos, vol = 1, metal = false) {
      if (!ok()) return; const t = ctx.currentTime; const o = out(pos, 0.12); o.gain.value = 0.28 * vol;
      burst(o, t, metal ? 1700 : 380, metal ? 3 : 1.2, metal ? 0.09 : 0.1, 0.8, "bandpass"); tone(o, t, 110, 60, 0.08, "sine", 0.5);
    },
    land(pos) { if (!ok()) return; const o = out(pos, 0.2); o.gain.value = 0.35; tone(o, ctx.currentTime, 120, 45, 0.16, "sine", 0.9); burst(o, ctx.currentTime, 500, 1, 0.12, 0.6); },
    hit(head, pos) { if (!ok()) return; const t = ctx.currentTime; const o = out(null, 0); o.gain.value = 0.4; tone(o, t, head ? 1800 : 1100, head ? 1500 : 900, 0.07, "square", 0.5); if (head) tone(o, t + 0.04, 2400, 2000, 0.09, "square", 0.4); },
    heart(k = 1) { if (!ok()) return; const t = ctx.currentTime; const o = out(null, 0.1); o.gain.value = 0.55 * k; tone(o, t, 62, 38, 0.16, "sine", 0.9); tone(o, t + 0.2, 56, 34, 0.18, "sine", 0.65); },
    hurt(pos) { if (!ok()) return; const t = ctx.currentTime; const o = out(null, 0.1); o.gain.value = 0.5; tone(o, t, 220, 80, 0.22, "sawtooth", 0.6); burst(o, t, 700, 1, 0.12, 0.6); },
    death(pos) { if (!ok()) return; const o = out(pos, 0.3); o.gain.value = 0.5; tone(o, ctx.currentTime, 260, 70, 0.5, "sawtooth", 0.6); },
    beep(pos, hi = false) { if (!ok()) return; const o = out(pos, 0.4); o.gain.value = 0.5; tone(o, ctx.currentTime, hi ? 1850 : 1500, hi ? 1850 : 1500, 0.11, "square", 0.55); },
    plant(pos) { if (!ok()) return; const o = out(pos, 0.3); o.gain.value = 0.5; const t = ctx.currentTime; for (let i = 0; i < 4; i++) tone(o, t + i * 0.09, 900 + i * 220, 900 + i * 220, 0.07, "square", 0.5); },
    defuse(pos) { if (!ok()) return; const o = out(pos, 0.3); o.gain.value = 0.5; const t = ctx.currentTime; tone(o, t, 600, 1400, 0.4, "sine", 0.7); },
    explode(pos) { if (!ok()) return; const t = ctx.currentTime; const o = out(pos, 0.9); o.gain.value = 1.4; burst(o, t, 700, 0.6, 1.3, 1.0, "lowpass", 90); tone(o, t, 120, 28, 1.4, "sine", 1.2); burst(o, t, 4000, 0.4, 0.25, 0.6, "highpass"); },
    grenadeBounce(pos) { if (!ok()) return; const o = out(pos, 0.2); o.gain.value = 0.4; burst(o, ctx.currentTime, 2800, 4, 0.05, 0.6); tone(o, ctx.currentTime, 420, 260, 0.06, "square", 0.3); },
    pin(pos) { if (!ok()) return; const o = out(pos, 0.05); o.gain.value = 0.3; burst(o, ctx.currentTime, 3600, 6, 0.04, 0.5); },
    smokePop(pos) { if (!ok()) return; const o = out(pos, 0.5); o.gain.value = 0.7; burst(o, ctx.currentTime, 1200, 0.5, 0.5, 0.6, "bandpass", 300); },
    flashBang(pos, nearYou = false) { if (!ok()) return; const o = out(pos, 0.7); o.gain.value = 1.0; burst(o, ctx.currentTime, 5000, 0.5, 0.3, 0.9, "highpass"); tone(o, ctx.currentTime, 3000, 2000, 0.2, "sine", 0.3); if (nearYou) tone(out(null, 0), ctx.currentTime, 4200, 4200, 1.8, "sine", 0.18); },
    buy() { if (!ok()) return; const o = out(null, 0); o.gain.value = 0.3; tone(o, ctx.currentTime, 900, 1300, 0.09, "square", 0.4); tone(o, ctx.currentTime + 0.07, 1300, 1700, 0.09, "square", 0.4); },
    ui() { if (!ok()) return; const o = out(null, 0); o.gain.value = 0.25; tone(o, ctx.currentTime, 700, 700, 0.04, "square", 0.4); },
    swap() { if (!ok()) return; const o = out(null, 0.05); o.gain.value = 0.25; burst(o, ctx.currentTime, 1600, 3, 0.06, 0.6); burst(o, ctx.currentTime + 0.12, 1000, 3, 0.05, 0.5); },
    roundStart() { if (!ok()) return; const o = out(null, 0.4); o.gain.value = 0.5; tone(o, ctx.currentTime, 440, 440, 0.18, "triangle", 0.7); tone(o, ctx.currentTime + 0.2, 660, 660, 0.3, "triangle", 0.7); },
    radio(pos) { if (!ok()) return; const o = out(null, 0); o.gain.value = 0.12; burst(o, ctx.currentTime, 1800, 3, 0.1, 0.5); burst(o, ctx.currentTime + 0.12, 2200, 3, 0.05, 0.4); },
    thunder() { if (!ok()) return; const t = ctx.currentTime + 0.4; const o = out(null, 0.8); o.gain.value = 0.9; burst(o, t, 260, 0.5, 2.6, 0.9, "lowpass", 60); },
    // wind and rain bed, always running while a round plays
    startAmbient() {
      if (!ok() || ambient) return; const g = ctx.createGain(); g.gain.value = 0.0; g.connect(master);
      const rain = noise(0, 5200, 0.4, "highpass"); const rg = ctx.createGain(); rg.gain.value = 0.07; rain.out.connect(rg); rg.connect(g); rain.src.start();
      const wind = noise(0, 320, 0.5, "lowpass"); const wg = ctx.createGain(); wg.gain.value = 0.18; wind.out.connect(wg); wg.connect(g); wind.src.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(wind.out.frequency); lfo.start();
      g.gain.setTargetAtTime(1.0, ctx.currentTime, 1.5); ambient = { g, rain, wind, lfo };
    },
    setAmbientMuffle(m) { if (ambient && ctx) ambient.g.gain.setTargetAtTime(1 - m * 0.65, ctx.currentTime, 0.25); },
    stopAmbient() { if (!ambient) return; try { ambient.rain.src.stop(); ambient.wind.src.stop(); ambient.lfo.stop(); } catch {} ambient = null; },
  };
  return api;
}
