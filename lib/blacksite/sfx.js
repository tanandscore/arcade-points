// Sound effects for the first-person Blacksite, all generated live (no audio files).
// Sounds that happen in the world are placed in 3D, so you can hear which side a gunshot,
// footstep or bomb beep is coming from, and how far away it is.

export function createSfx() {
  let ctx = null, master = null, wet = null, noiseBuf = null, ambient = null, echoIn = null; const L0 = { x: 0, y: 1.6, z: 0, yaw: 0 };
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
      // outdoor slap-back: gunfire bounces off the buildings a fraction of a second later
      echoIn = ctx.createGain(); const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.21; const fb = ctx.createGain(); fb.gain.value = 0.3; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2300; const eo = ctx.createGain(); eo.gain.value = 0.5;
      echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(eo); eo.connect(master);
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; noiseBuf = nb;
      return true;
    } catch { ctx = null; return false; }
  }
  const ok = () => ctx && ctx.state === "running";
  const noise = (dur, freq, q, type = "bandpass") => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); return { src: s, out: f, dur };
  };
  // a placed output: returns a node to connect to. pos = {x,y,z} or null for "in your head"
  function out(pos, reverb = 0.5, echo = 0) {
    const g = ctx.createGain();
    if (pos) {
      // far sounds lose their sparkle: low-pass by distance, then place in 3D
      const dist = Math.hypot(pos.x - L0.x, (pos.y ?? 1.4) - L0.y, pos.z - L0.z); const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = Math.max(1100, 19000 / (1 + dist / 16)); lpf.Q.value = 0.4; g.connect(lpf);
      const p = ctx.createPanner(); p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = 3; p.rolloffFactor = 1.15; p.maxDistance = 200;
      p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.4; p.positionZ.value = pos.z; lpf.connect(p); p.connect(master);
      if (reverb > 0) { const r = ctx.createGain(); r.gain.value = reverb; p.connect(r); r.connect(wet); }
      if (echo > 0) { const e = ctx.createGain(); e.gain.value = echo; p.connect(e); e.connect(echoIn); }
    } else { g.connect(master); if (reverb > 0) { const r = ctx.createGain(); r.gain.value = reverb * 0.6; g.connect(r); r.connect(wet); } if (echo > 0) { const e = ctx.createGain(); e.gain.value = echo * 0.8; g.connect(e); e.connect(echoIn); } }
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
      L0.x = x; L0.y = y; L0.z = z; L0.yaw = yaw; if (!ok()) return; const L = ctx.listener;
      if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = -Math.sin(yaw); L.forwardY.value = 0; L.forwardZ.value = -Math.cos(yaw); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    },
    // layered gunshot: supersonic crack, body, low thump, tail — each gun gets its own mix, and the world answers with an echo
    shot(kind, pos, suppressed = false, id = "") {
      if (!ok()) return; const t = ctx.currentTime; const rnd = 0.92 + Math.random() * 0.16;
      const P = { pistol: [2600, 1500, 210, 78, 0.14, 0.7, 0.34, 0.5], deagle: [2100, 900, 120, 40, 0.3, 1.1, 0.6, 0.62], smg: [3300, 1700, 190, 70, 0.1, 0.7, 0.3, 0.5], rifle: [2300, 1250, 150, 48, 0.2, 1.0, 0.5, 0.6], dmr: [2000, 950, 120, 40, 0.28, 1.2, 0.6, 0.66], shotgun: [1800, 620, 90, 30, 0.42, 1.5, 0.7, 0.7], sniper: [1700, 700, 85, 26, 0.6, 1.8, 0.9, 0.85] };
      const key = id === "deagle" ? "deagle" : kind === "dmr" ? "dmr" : kind === "shotgun" ? "shotgun" : kind; const [crack, body, f0, f1, dur, big, tail, echo] = P[key] || P.rifle;
      const o = out(pos, 0.45 + tail * 0.4, echo); o.gain.value = 0.5 * big;
      burst(o, t, crack * rnd, 0.6, 0.03, 1.0, "highpass");
      burst(o, t, body * rnd, 0.7, dur * 0.55, 1.0, "bandpass", body * 0.3);
      tone(o, t, f0 * rnd, f1, dur * 1.1, "triangle", 0.95);
      tone(o, t, f0 * 0.5, f1 * 0.7, dur * 0.9, "sine", 0.7);
      burst(o, t + 0.01, 700, 0.5, tail, 0.5, "lowpass", 160);
      if (key === "shotgun") { const t2 = t + 0.42; burst(out(pos, 0.1), t2, 1400, 4, 0.05, 0.5); burst(out(pos, 0.1), t2 + 0.14, 900, 4, 0.06, 0.55); }
    },
    // a round cracking past your head
    whiz(dist = 1, cx = 0, cz = 0, yaw = 0) {
      if (!ok()) return; const t = ctx.currentTime; const g = ctx.createGain(); const pan = ctx.createStereoPanner(); const rx = Math.cos(yaw), rz = -Math.sin(yaw); const d = Math.max(0.2, Math.hypot(cx, cz)); pan.pan.value = Math.max(-1, Math.min(1, (cx * rx + cz * rz) / d)); g.connect(pan); pan.connect(master);
      burst(g, t, 3600, 1.4, 0.22, 0.9 * Math.max(0.25, 1 - dist / 2.6), "bandpass", 900); g.gain.value = 0.6;
    },
    knife(pos) { if (!ok()) return; const t = ctx.currentTime; burst(out(pos, 0.1), t, 3200, 1.2, 0.12, 0.4, "bandpass", 800); },
    reload(pos, phase = 0) {
      if (!ok()) return; const t = ctx.currentTime; const o = out(pos, 0.2); o.gain.value = 0.36;
      burst(o, t + 0.08, 1500, 3, 0.05, 0.7); tone(o, t + 0.1, 320, 160, 0.06, "square", 0.25); // magazine out
      burst(o, t + 0.85, 700, 2, 0.07, 0.8); tone(o, t + 0.86, 260, 120, 0.08, "sine", 0.5); burst(o, t + 0.9, 3000, 5, 0.03, 0.5); // magazine in
      burst(o, t + 1.45, 2200, 6, 0.035, 0.7); burst(o, t + 1.52, 1700, 6, 0.04, 0.6); tone(o, t + 1.46, 1200, 900, 0.05, "square", 0.12); // bolt
    },
    empty(pos) { if (!ok()) return; burst(out(pos, 0.1), ctx.currentTime, 2600, 6, 0.04, 0.4); },
    step(pos, vol = 1, surface = "concrete") {
      if (!ok()) return; const t = ctx.currentTime; const o = out(pos, surface === "tiles" || surface === "grate" ? 0.2 : 0.1); o.gain.value = 0.3 * vol; const j = 0.9 + Math.random() * 0.2;
      if (surface === true) surface = "grate"; else if (surface === false) surface = "concrete";
      const S = { dirt: [260, 0.9, 0.12, 80, "lowpass"], stone: [900, 1.6, 0.09, 120, "bandpass"], tiles: [1700, 3, 0.07, 140, "bandpass"], concrete: [750, 1.3, 0.09, 110, "bandpass"], asphalt: [650, 1.2, 0.09, 105, "bandpass"], grate: [2000, 6, 0.13, 100, "bandpass"] }[surface] || [750, 1.3, 0.09, 110, "bandpass"];
      burst(o, t, S[0] * j, S[1], S[2], 0.9, S[4]); tone(o, t, S[3] * j, 55, 0.09, "sine", 0.55); if (surface === "grate") tone(o, t, 920 * j, 880, 0.12, "square", 0.08);
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
    // living background: rain and wind at night; wind, a distant town and birds by day (gulls and a ship's horn at the harbor)
    startAmbient(mode = "night") {
      if (!ok() || ambient) return; const g = ctx.createGain(); g.gain.value = 0.0; g.connect(master); const day = mode !== "night";
      const nodes = [];
      if (!day) { const rain = noise(0, 5200, 0.4, "highpass"); const rg = ctx.createGain(); rg.gain.value = 0.07; rain.out.connect(rg); rg.connect(g); rain.src.start(); nodes.push(rain); }
      const wind = noise(0, 320, 0.5, "lowpass"); const wg = ctx.createGain(); wg.gain.value = day ? 0.1 : 0.18; wind.out.connect(wg); wg.connect(g); wind.src.start(); nodes.push(wind);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(wind.out.frequency); lfo.start();
      let timer = null;
      if (day) {
        const hum = noise(0, mode === "harbor" ? 220 : 520, 0.8, "bandpass"); const hg = ctx.createGain(); hg.gain.value = mode === "harbor" ? 0.05 : 0.07; hum.out.connect(hg); hg.connect(g); hum.src.start(); nodes.push(hum);
        const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = ctx.createGain(); lg2.gain.value = 0.03; lfo2.connect(lg2); lg2.connect(hg.gain); lfo2.start(); nodes.push({ src: lfo2 });
        const chirp = () => { if (!ctx) return; const t = ctx.currentTime + 0.05; const ang = Math.random() * 6.28, d = 14 + Math.random() * 30; const o = out({ x: L0.x + Math.cos(ang) * d, y: 5 + Math.random() * 6, z: L0.z + Math.sin(ang) * d }, 0.3, 0.2); o.gain.value = 0.16;
          const gull = mode === "harbor" && Math.random() < 0.55;
          if (gull) { const n = 2 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) tone(o, t + i * 0.32, 1500 + Math.random() * 300, 2300, 0.26, "sawtooth", 0.25); }
          else { const n = 2 + ((Math.random() * 4) | 0), f = 3200 + Math.random() * 1800; for (let i = 0; i < n; i++) tone(o, t + i * 0.09, f, f * 1.25, 0.06, "sine", 0.35); }
          timer = setTimeout(chirp, 1800 + Math.random() * 5200); };
        timer = setTimeout(chirp, 1500);
        if (mode === "harbor") { const horn = () => { if (!ctx) return; const o = out({ x: L0.x + 140, y: 8, z: L0.z + 90 }, 0.5, 0.5); o.gain.value = 0.25; tone(o, ctx.currentTime, 112, 108, 2.4, "sawtooth", 0.5); tone(o, ctx.currentTime, 168, 162, 2.4, "sawtooth", 0.3); setTimeout(horn, 28000 + Math.random() * 22000); }; setTimeout(horn, 9000); }
      }
      g.gain.setTargetAtTime(1.0, ctx.currentTime, 1.5); ambient = { g, nodes, lfo, timer: () => timer };
    },
    setAmbientMuffle(m) { if (ambient && ctx) ambient.g.gain.setTargetAtTime(1 - m * 0.65, ctx.currentTime, 0.25); },
    stopAmbient() { if (!ambient) return; try { for (const n of ambient.nodes) n.src.stop(); ambient.lfo.stop(); clearTimeout(ambient.timer()); } catch {} ambient = null; },
  };
  return api;
}
