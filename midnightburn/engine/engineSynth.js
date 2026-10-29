// Midnight Burn — Upgrade 66: a combustion-engine sound model.
//
// The older engine voice was a handful of buzzing oscillators tuned to the revs. This one models what an engine really does: every time a cylinder fires,
// a burst of hot gas is pushed down the exhaust. So the sound is a train of little explosions whose spacing is set by how many cylinders there are, in what
// order they fire and which side of a V they sit on (that is why a big American V8 burbles and a flat-plane Ferrari screams: same maths, different spacing).
// Each burst travels along a pipe, bounces back, and rings (the "tube" tone), and is muffled and coloured by the silencer. On top sit the intake gulp,
// the valve-train tick and the crackle when you lift off. Parts change it: a free-flow exhaust rings brighter and louder, an intake adds roar, the
// engine computer adds pops, pistons and cams let it rev higher.
//
// makeEngineDSP is self-contained on purpose: it runs in an AudioWorklet (a separate audio thread, as a source string) and in plain Node for the tests.
// Everything here is generated live, no sound files.
export function makeEngineDSP(sr) {
  let seed = 1234567; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const D1MAX = 2048, D2MAX = 2048;
  const dl = [new Float32Array(D1MAX), new Float32Array(D1MAX)], dl2 = [new Float32Array(D2MAX), new Float32Array(D2MAX)];
  const st = { phase: 0, ptr: 0, rpm: 900, load: 0.2, env: [0, 0], w: [0, 0], lp1: [0, 0], lp2: [0, 0], lp3: [0, 0], wp: [0, 0], wp2: [0, 0], intakeLp: 0, intakeLp2: 0, tick: 0, tickEnv: 0, out: 0, hp: 0, hpx: 0, cut: 0, cutT: 0, crackle: [], pop: 0, mix: [0, 0], lastN: 4, bv: 0, bx: 0, dcs: 0 };
  const P = { pos: [0, 0.25, 0.5, 0.75], bank: [0, 0, 0, 0], amp: [1, 1, 1, 1], idle: 900, red: 8000, L1: 0.9, L2: 1.6, g1: 0.55, g2: 0.35, bright: 0.5, muff: 0.5, intake: 0.3, mech: 0.2, crackle: 0.2, boom: 0.8, boomF: 62, drive: 1.6, gain: 1, jitter: 0.02, twoBank: 0 };
  function config(c) { for (const k in c) P[k] = c[k]; if (c.pos) { st.ptr = 0; st.lastN = c.pos.length; } }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // render n samples. t = { rpm (0..1 normalised), load (0..1), cut (rev limiter), pops (count to fire) }
  function render(outL, outR, n, t) {
    const N = P.pos.length; const tau = Math.exp(-1 / (sr * 0.0022)), tau2 = Math.exp(-1 / (sr * 0.006));
    const d1 = [clamp(Math.round(sr * P.L1 / 343 * 1.0), 8, D1MAX - 1), clamp(Math.round(sr * (P.L1 * 1.07) / 343), 8, D1MAX - 1)];
    const d2 = clamp(Math.round(sr * P.L2 / 343), 8, D2MAX - 1);
    const rpmT = P.idle + clamp(t.rpm, 0, 1.05) * (P.red - P.idle);
    if (t.pops) { st.pop += t.pops; }
    let wi1 = st.wp[0], wi2 = st.wp[1], wj = st.wp2[0];
    const fire = (k, rn) => {
      if (t.cut && ((k + Math.floor(st.phase * 50)) & 1)) return; // rev limiter: fuel cut bounces
      const tq = 0.55 + 0.45 * Math.sin(Math.PI * clamp(0.18 + rn * 0.9, 0, 1)); // torque curve: weaker at the very bottom and top
      const lo = clamp(st.load, 0, 1); const a = (0.16 + 0.84 * Math.pow(lo, 1.15)) * tq * P.amp[k] * (1 + (rnd() - 0.5) * 2 * P.jitter * 3);
      const b = P.bank[k] & 1; st.env[b] += a; st.mix[b] = Math.min(1.6, st.mix[b] + 0.4 * a); 
    };
    for (let i = 0; i < n; i++) {
      st.rpm += (rpmT - st.rpm) * 0.0012;                 // the engine cannot change speed instantly (flywheel)
      st.load += (t.load - st.load) * 0.0025;
      const rps = st.rpm / 60; const rn = clamp((st.rpm - P.idle) / (P.red - P.idle), 0, 1.1);
      const prev = st.phase; st.phase += rps / 2 / sr; let wrapped = false; if (st.phase >= 1) { st.phase -= 1; wrapped = true; st.ptr = 0; }
      // fire every cylinder whose crank angle has just gone by
      if (wrapped) { while (st.ptr < N) { fire(st.ptr++, rn); } st.ptr = 0; }
      while (st.ptr < N && st.phase >= P.pos[st.ptr]) fire(st.ptr++, rn);
      // overrun crackle / pops: random little bangs in the pipe when the throttle is shut and the engine is hot
      if (st.pop > 0 && rnd() < 0.0011 * (1 + P.crackle * 4)) { const b = (rnd() * 2) | 0; st.env[b] += 0.9 + rnd() * 1.4; st.mix[b] = 1.6; st.pop -= 0.4; if (st.pop < 0) st.pop = 0; }
      let y = 0;
      const banks = P.twoBank ? 2 : 1;
      for (let b = 0; b < banks; b++) {
        st.env[b] *= tau; st.mix[b] *= tau2;
        const e = st.env[b]; const nz = rnd() * 2 - 1;
        // the pulse itself: a dull thump plus a crack of noise on the front edge
        st.w[b] += (e * (0.55 * nz) - st.w[b]) * (0.3 + 0.5 * P.bright);
        const ex = e * 0.9 + st.w[b] * (0.5 + P.bright * 0.9) * clamp(st.mix[b], 0, 1.4);
        // exhaust pipe: the pulse comes back after the round trip, a little duller each time
        const dlA = dl[b]; let ra = dlA[(wi1 - d1[b] + D1MAX) % D1MAX]; st.lp1[b] += (ra - st.lp1[b]) * (0.35 + 0.5 * P.bright); const s1 = ex + P.g1 * st.lp1[b]; dlA[wi1] = s1;
        const dlB = dl2[b]; let rb = dlB[(wj - d2 + D2MAX) % D2MAX]; st.lp2[b] += (rb - st.lp2[b]) * (0.3 + 0.4 * P.bright); const s2 = s1 + P.g2 * st.lp2[b]; dlB[wj] = s2;
        // silencer: takes the top off
        st.lp3[b] += (s2 - st.lp3[b]) * (0.1 + 0.55 * P.muff); y += st.lp3[b];
      }
      wi1 = (wi1 + 1) % D1MAX; wj = (wj + 1) % D2MAX;
      // the deep body of the sound: the strong "firing note" itself, at the rate cylinders fire (its harmonics give a growl)
      { const th = 2 * Math.PI * N * st.phase; const body = Math.sin(th) + 0.45 * Math.sin(2 * th + 0.7) + 0.2 * Math.sin(3 * th + 1.9); y = y * (P.twoBank ? 0.8 : 1) + body * P.boom * (0.15 + 0.85 * st.load) * (0.3 + 0.7 * Math.min(1, rn * 1.6)); }
      st.dcs += (y - st.dcs) * 0.003; y -= st.dcs; // take out the steady push (the pulses only ever push one way) before the saturation
      // intake: a gulp of air at every cylinder intake stroke, louder with throttle
      const gulp = 0.5 + 0.5 * Math.sin(2 * Math.PI * st.phase * N); const nz2 = rnd() * 2 - 1;
      st.intakeLp += (nz2 - st.intakeLp) * (0.05 + 0.18 * rn); st.intakeLp2 += (st.intakeLp - st.intakeLp2) * 0.35;
      const intakeS = st.intakeLp2 * gulp * st.load * (0.04 + 0.2 * rn) * P.intake * 3.2;
      // valve train tick: a little high-pitched click at the cam rate
      st.tick += rps * N / 2 / sr; if (st.tick >= 1) { st.tick -= 1; st.tickEnv = 0.5 + rnd() * 0.3; } st.tickEnv *= 0.985; const tickS = st.tickEnv * (rnd() * 2 - 1) * 0.05 * P.mech * (1 - 0.5 * rn);
      let s = (y * 0.55 + intakeS + tickS) * P.gain;
      s = 0.25 * Math.tanh(s * P.drive) / Math.tanh(P.drive);                     // the whole thing is driven hard, like a real microphone on an exhaust
      // remove DC and sub-sonic rumble
      const hpO = s - st.hpx + 0.995 * st.hp; st.hpx = s; st.hp = hpO; st.out = hpO;
      outL[i] = hpO; if (outR) outR[i] = hpO * 0.98;
    }
    st.wp[0] = wi1; st.wp[1] = wi2; st.wp2[0] = wj;
  }
  return { render, config, state: st, params: P };
}

// ---- engine types: firing order (as crank degrees over 720), which exhaust bank each cylinder is on, redline, pipe length, character ----
const deg = (a) => a.map((d) => d / 720);
export const ENGINE_TYPES = {
  i3: { name: "Inline-3", pos: deg([0, 240, 480]), bank: [0, 0, 0], idle: 1000, red: 7200, L1: 0.8, L2: 1.6, g1: 0.6, g2: 0.3, bright: 0.55, muff: 0.55, intake: 0.35, mech: 0.3, drive: 1.5 },
  i4: { name: "Inline-4", pos: deg([0, 180, 360, 540]), bank: [0, 0, 0, 0], idle: 900, red: 8200, L1: 0.7, L2: 1.5, g1: 0.55, g2: 0.3, bright: 0.65, muff: 0.55, intake: 0.4, mech: 0.35, drive: 1.5 },
  i4hi: { name: "Inline-4 high-rev", pos: deg([0, 180, 360, 540]), bank: [0, 0, 0, 0], idle: 1300, red: 10500, L1: 0.55, L2: 1.2, g1: 0.5, g2: 0.3, bright: 0.85, muff: 0.7, intake: 0.5, mech: 0.4, drive: 1.6 },
  v6: { name: "V6", pos: deg([0, 120, 240, 360, 480, 600]), bank: [0, 1, 0, 1, 0, 1], idle: 850, red: 7600, L1: 0.8, L2: 1.6, g1: 0.55, g2: 0.3, bright: 0.6, muff: 0.55, intake: 0.4, mech: 0.3, drive: 1.5, twoBank: 1 },
  f6: { name: "Flat-6", pos: deg([0, 120, 240, 360, 480, 600]), bank: [0, 1, 0, 1, 0, 1], idle: 900, red: 8400, L1: 0.7, L2: 1.4, g1: 0.55, g2: 0.3, bright: 0.7, muff: 0.55, intake: 0.45, mech: 0.35, drive: 1.5, twoBank: 1 },
  v8x: { name: "V8 cross-plane", pos: deg([0, 90, 180, 270, 360, 450, 540, 630]), bank: [0, 1, 1, 0, 1, 0, 0, 1], idle: 750, red: 6800, L1: 1.05, L2: 1.9, g1: 0.62, g2: 0.4, bright: 0.4, muff: 0.38, intake: 0.35, mech: 0.2, drive: 1.9, twoBank: 1 },
  v8f: { name: "V8 flat-plane", pos: deg([0, 90, 180, 270, 360, 450, 540, 630]), bank: [0, 1, 0, 1, 0, 1, 0, 1], idle: 900, red: 8800, L1: 0.8, L2: 1.5, g1: 0.55, g2: 0.32, bright: 0.75, muff: 0.62, intake: 0.45, mech: 0.35, drive: 1.6, twoBank: 1 },
  v10: { name: "V10", pos: deg([0, 72, 144, 216, 288, 360, 432, 504, 576, 648]), bank: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], idle: 1000, red: 9800, L1: 0.65, L2: 1.2, g1: 0.5, g2: 0.3, bright: 0.85, muff: 0.7, intake: 0.5, mech: 0.4, drive: 1.6, twoBank: 1 },
  v12: { name: "V12", pos: deg([0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660]), bank: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], idle: 900, red: 8800, L1: 0.9, L2: 1.7, g1: 0.55, g2: 0.35, bright: 0.7, muff: 0.6, intake: 0.4, mech: 0.3, drive: 1.5, twoBank: 1 },
};
// which engine each car has (the cars' own names, not real models)
export const CAR_ENGINE = { kestrel: "i4", brute: "v8x", gecko: "i3", phantom: "v12", specter: "v8f", meteor: "v10", vesper: "v6", rennsport: "f6", solo: "v10", stinger: "v6", frame: "i4hi", praga: "v12", razor: "v8f", seven: "i4hi", exp: "v6" };
/** Final DSP settings for a car and its fitted parts. */
export function engineConfig(carId, tune = {}) {
  const type = ENGINE_TYPES[CAR_ENGINE[carId] || "i4"]; const N = type.pos.length; const t = (k) => tune[k] || 0;
  const amp = []; for (let i = 0; i < N; i++) amp.push(1 + (((i * 7919) % 13) / 13 - 0.5) * 0.12);
  return {
    pos: type.pos, bank: type.bank, amp, twoBank: type.twoBank || 0,
    idle: type.idle, red: type.red * (1 + 0.025 * t("internals") + 0.01 * t("engine")),
    L1: type.L1 * (1 - 0.04 * t("exhaust")), L2: type.L2,
    g1: Math.min(0.8, type.g1 + 0.045 * t("exhaust")), g2: Math.min(0.6, type.g2 + 0.03 * t("exhaust")),
    bright: Math.min(1, type.bright + 0.06 * t("exhaust") + 0.03 * t("internals")), muff: Math.min(1, type.muff + 0.1 * t("exhaust")),
    intake: type.intake * (1 + 0.45 * t("intake")), mech: type.mech * (1 + 0.1 * t("internals")), crackle: 0.15 + 0.35 * t("ecu") + 0.2 * t("exhaust"),
    drive: type.drive + 0.12 * t("exhaust"), gain: 1 + 0.08 * t("exhaust") + 0.04 * t("intake"), jitter: 0.02,
  };
}
// the worklet source: the DSP above plus the small processor shell around it
export function workletSource() {
  return `const makeEngineDSP = ${makeEngineDSP.toString()};
class MbEngine extends AudioWorkletProcessor {
  constructor(o) { super(); this.d = makeEngineDSP(sampleRate); this.t = { rpm: 0.15, load: 0.2, cut: 0, pops: 0 }; const po = o && o.processorOptions; if (po) { if (po.cfg) this.d.config(po.cfg); if (po.t) this.t = { ...this.t, ...po.t }; } this.port.onmessage = (e) => { const m = e.data; if (m.cfg) this.d.config(m.cfg); if (m.t) { const p = this.t.pops; this.t = { ...this.t, ...m.t, pops: p + (m.t.pops || 0) }; } }; }
  process(inputs, outputs) { const o = outputs[0]; const L = o[0], R = o[1]; this.d.render(L, R, L.length, this.t); this.t.pops = 0; return true; }
}
registerProcessor("mb-engine", MbEngine);`;
}
