// Midnight Burn — pure simulation (no DOM, no three.js), so the exact
// same code runs in the browser and in a headless test that drives a
// bot around every track.
//
// Cars live in "track space" (a Frenet frame): s = distance travelled
// along the road's centre line, d = sideways offset from the centre
// line (positive = right), h = which way the nose points relative to
// the road, tv = which way the car is actually moving relative to the
// road. A drift is simply h and tv disagreeing.

export const DT = 1 / 60;
export const CAR_LEN = 4.4;
export const CAR_WID = 2.0;
export const KMH = 3.6;

export const TRACKS = [
  {
    id: "harbor",
    name: "Harbor Loop",
    blurb: "Wide and fast along the docks. Long sweepers, a sharp quayside kink, wet steel underfoot.",
    R: 400, stretch: 1.25, mods: [[2, 0.14, 0.4], [3, 0.08, 1.7]], width: 16, laps: 2, traffic: 14,
    weather: "clear", grip: 0.97, density: 1, heightScale: 0.9, fogFar: 460,
    palette: { sky: 0x080616, fog: 0x120a2e, neonA: 0xff2d95, neonB: 0x2de2ff, road: 0x15151f, glass: 0xffd27a },
  },
  {
    id: "downtown",
    name: "Downtown Grid",
    blurb: "Tight, twisty and rain-soaked between the towers. Traffic everywhere.",
    R: 330, stretch: 1.2, mods: [[3, 0.16, 0.0], [5, 0.06, 2.0]], width: 14.5, laps: 3, traffic: 22,
    weather: "rain", grip: 0.93, density: 1.25, heightScale: 1.2, fogFar: 380,
    palette: { sky: 0x06101a, fog: 0x0a1c2e, neonA: 0xffb703, neonB: 0xb45cff, road: 0x14181f, glass: 0x9ff0ff },
  },
  {
    id: "foundry",
    name: "Foundry Run",
    blurb: "A huge industrial loop. Top speed wins, mistakes are punished.",
    R: 470, stretch: 1.3, mods: [[2, 0.18, 1.0], [4, 0.09, 0.3]], width: 17, laps: 2, traffic: 14,
    weather: "clear", grip: 1, density: 0.8, heightScale: 0.8, fogFar: 480,
    palette: { sky: 0x120808, fog: 0x1f0d0d, neonA: 0xff5a1f, neonB: 0x6bff6b, road: 0x181416, glass: 0xffa65a },
  },
  {
    id: "neonstrip",
    name: "Neon Strip",
    blurb: "Casino-bright boulevard with two flat-out straights. Hold your nerve and your nitrous.",
    R: 500, stretch: 1.85, mods: [[2, 0.1, 0.2], [3, 0.05, 0.9]], width: 18, laps: 2, traffic: 18,
    weather: "clear", grip: 1, density: 1.1, heightScale: 1.1, fogFar: 520,
    palette: { sky: 0x0c0418, fog: 0x1a0830, neonA: 0xff2de2, neonB: 0xffd23f, road: 0x15101f, glass: 0xffe08a },
  },
  {
    id: "ridge",
    name: "Skyline Ridge",
    blurb: "A foggy mountain road above the city. Narrow, blind and unforgiving.",
    R: 500, stretch: 1.1, mods: [[3, 0.18, 0.6], [4, 0.1, 2.2], [7, 0.03, 1.0]], width: 13.5, laps: 2, traffic: 8,
    weather: "fog", grip: 0.95, density: 0.28, heightScale: 0.4, fogFar: 230,
    palette: { sky: 0x0a1218, fog: 0x15222c, neonA: 0x6bff6b, neonB: 0x2de2ff, road: 0x14181c, glass: 0xb8ffd8 },
  },
  {
    id: "eclipse",
    name: "Eclipse Raceway",
    blurb: "The final test: a monster circuit in a thunderstorm. Fast, slick and long.",
    R: 600, stretch: 1.5, mods: [[2, 0.16, 2.3], [3, 0.1, 0.5], [5, 0.04, 1.4]], width: 18, laps: 2, traffic: 16,
    weather: "storm", grip: 0.9, density: 0.9, heightScale: 1, fogFar: 340,
    palette: { sky: 0x050510, fog: 0x0b0b1c, neonA: 0xb45cff, neonB: 0xff5a5a, road: 0x121218, glass: 0xd0b8ff },
  },
];

export const CARS = [
  { id: "kestrel", name: "Kestrel", blurb: "Balanced all-rounder.", vmax: 62, accel: 26, yaw: 2.5, grip: 5.2, color: "#2de2ff" },
  { id: "brute", name: "Brute", blurb: "Highest top speed, slides around.", vmax: 68, accel: 24, yaw: 2.2, grip: 4.4, color: "#ff2d95" },
  { id: "gecko", name: "Gecko", blurb: "Snappy and grippy, lower top end.", vmax: 58, accel: 29, yaw: 2.9, grip: 6.0, color: "#6bff6b" },
  { id: "phantom", name: "Phantom GT", blurb: "Wide-body GT racer. Planted and fast. Unlocked by beating Saint (#4).", vmax: 66, accel: 27, yaw: 2.7, grip: 5.8, color: "#f2f2f2", locked: true },
  { id: "specter", name: "Specter LMP", blurb: "A prototype hypercar. The best car in the city. Unlocked by beating Kage (#1).", vmax: 72, accel: 30, yaw: 2.9, grip: 6.3, color: "#101015", locked: true },
  // ---- the Collection: ten bought-with-cash cars inspired by real hypercars and track toys (names and shapes are the game's own) ----
  { id: "meteor", name: "Meteor One", blurb: "F1-engined hypercar. Savage top end, huge grip.", vmax: 75, accel: 31, yaw: 2.8, grip: 6.4, color: "#d8d8e0", locked: true, price: 60000 },
  { id: "vesper", name: "Vesper X", blurb: "Le Mans hypercar for the road. Fastest car in the city.", vmax: 77, accel: 32, yaw: 2.8, grip: 6.6, color: "#0f7a4a", locked: true, price: 75000 },
  { id: "rennsport", name: "Rennsport GT", blurb: "Rear-engined track-day coupe. Traction for days.", vmax: 68, accel: 29, yaw: 3.0, grip: 6.4, color: "#ffb703", locked: true, price: 30000 },
  { id: "solo", name: "Solo R", blurb: "Single-seat carbon rocket. Twitchy, light, brutal.", vmax: 70, accel: 34, yaw: 3.2, grip: 6.8, color: "#d4202a", locked: true, price: 45000 },
  { id: "stinger", name: "Stinger GT4", blurb: "Mid-engined coupe. Easy to drift, hard to catch.", vmax: 66, accel: 28, yaw: 3.0, grip: 6.1, color: "#2de2ff", locked: true, price: 22000 },
  { id: "frame", name: "Frame 4RR", blurb: "A seat, an engine, four wheels. Mad acceleration.", vmax: 66, accel: 35, yaw: 3.3, grip: 6.2, color: "#ff5a1f", locked: true, price: 28000 },
  { id: "praga", name: "Praha Bolt", blurb: "Long-tailed carbon GT. Stable and very quick.", vmax: 71, accel: 31, yaw: 2.9, grip: 6.5, color: "#b45cff", locked: true, price: 40000 },
  { id: "razor", name: "Razor RXC", blurb: "Closed-cockpit track prototype. Sticks to everything.", vmax: 73, accel: 33, yaw: 3.1, grip: 6.9, color: "#6bff6b", locked: true, price: 55000 },
  { id: "seven", name: "Sevenfold 620", blurb: "Exposed wheels, no roof, pure feel. Cheap and wild.", vmax: 62, accel: 30, yaw: 3.3, grip: 6.0, color: "#1b6dff", locked: true, price: 18000 },
  { id: "exp", name: "Prodigy EXP", blurb: "Open-top aero racer with a wing on pillars.", vmax: 69, accel: 32, yaw: 3.1, grip: 6.5, color: "#f2f2f2", locked: true, price: 35000 },
];

// Body kits trade a little top speed for grip.
export const KIT_FX = { stock: { grip: 1, vmax: 1 }, street: { grip: 1.03, vmax: 1 }, race: { grip: 1.07, vmax: 0.985 } };

export const UPGRADES = [
  { id: "engine", name: "Engine", blurb: "More power and top speed", max: 5, cost: [300, 450, 650, 900, 1200] },
  { id: "tires", name: "Tires & Suspension", blurb: "More grip and sharper steering", max: 5, cost: [250, 400, 600, 800, 1100] },
  { id: "nitro", name: "Nitrous", blurb: "Bigger tank, stronger boost", max: 5, cost: [250, 400, 600, 800, 1100] },
];

const wrapPi = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---- track geometry ---------------------------------------------------
export function buildTrack(def) {
  const raw = [];
  const M = 2400;
  for (let i = 0; i < M; i++) {
    const th = (i / M) * Math.PI * 2;
    let r = 1;
    for (const [k, a, ph] of def.mods) r += a * Math.cos(k * th + ph);
    r *= def.R;
    raw.push([Math.cos(th) * r * (def.stretch || 1), Math.sin(th) * r]);
  }
  // arc-length table
  const cum = [0];
  for (let i = 1; i <= M; i++) {
    const p = raw[i % M], q = raw[i - 1];
    cum.push(cum[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1]));
  }
  const L = cum[M];
  const N = Math.round(L / 2); // one sample every ~2 units
  const ds = L / N;
  const x = new Float32Array(N), z = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const target = i * ds;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j]);
    const p = raw[j % M], q = raw[(j + 1) % M];
    x[i] = p[0] + (q[0] - p[0]) * f;
    z[i] = p[1] + (q[1] - p[1]) * f;
  }
  const ang = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i + 1) % N, b = (i - 1 + N) % N;
    ang[i] = Math.atan2(z[a] - z[b], x[a] - x[b]);
  }
  // curvature = d(angle)/ds, smoothed over ~12 samples
  const kraw = new Float32Array(N);
  for (let i = 0; i < N; i++) kraw[i] = wrapPi(ang[(i + 1) % N] - ang[i]) / ds;
  const kappa = new Float32Array(N);
  const W = 6;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let k = -W; k <= W; k++) sum += kraw[(i + k + N) % N];
    kappa[i] = sum / (2 * W + 1);
  }
  return { def, L, N, ds, x, z, ang, kappa, halfW: def.width / 2 };
}

export function wrapS(track, s) {
  s %= track.L;
  return s < 0 ? s + track.L : s;
}

export function sampleTrack(track, s) {
  const f = wrapS(track, s) / track.ds;
  const i = Math.floor(f) % track.N;
  const j = (i + 1) % track.N;
  const t = f - Math.floor(f);
  const a0 = track.ang[i];
  return {
    x: track.x[i] + (track.x[j] - track.x[i]) * t,
    z: track.z[i] + (track.z[j] - track.z[i]) * t,
    a: a0 + wrapPi(track.ang[j] - a0) * t,
    k: track.kappa[i] + (track.kappa[j] - track.kappa[i]) * t,
  };
}

// Where a car is in the real 3D world.
export function worldPose(track, s, d, h) {
  const p = sampleTrack(track, s);
  return { x: p.x - Math.sin(p.a) * d, z: p.z + Math.cos(p.a) * d, yaw: p.a + h, trackAngle: p.a, k: p.k };
}

// ---- car physics -------------------------------------------------------
export function makeStats(car, levels = { engine: 0, tires: 0, nitro: 0 }, kit = "stock") {
  const kf = KIT_FX[kit] || KIT_FX.stock;
  return {
    vmax: car.vmax * kf.vmax * (1 + 0.035 * levels.engine),
    accel: car.accel * (1 + 0.05 * levels.engine),
    yaw: car.yaw * (1 + 0.04 * levels.tires),
    grip: car.grip * kf.grip * (1 + 0.06 * levels.tires),
    nitroPower: 1 + 0.07 * levels.nitro,
    nitroDrain: 26 / (1 + 0.12 * levels.nitro), // percent per second
  };
}

export function newCar(s, d, stats) {
  return {
    s, d, h: 0, tv: 0, v: 0, steer: 0, nitro: 0, nos: false,
    stats, lap: 0, progress: s, finished: false, finishTime: 0,
    crashT: 0, drifting: false, slip: 0, wallHit: false, bump: false,
    gear: 1, rpm: 0.15, shiftT: 0, acc: 0, lat: 0, braking: false,
  };
}

// Six-speed automatic gearbox: purely a rev/gear model, but upshifts
// cost a brief dip in power like a real car, and the HUD/engine sound
// read gear and rpm from here.
const GEAR_TOP = [0.17, 0.31, 0.46, 0.62, 0.80, 1.0];
function updateGearbox(c, st) {
  if (c.shiftT > 0) c.shiftT -= DT;
  const top = (g) => st.vmax * GEAR_TOP[g - 1];
  let rpm = c.v / top(c.gear);
  if (rpm > 0.94 && c.gear < 6) { c.gear++; c.shiftT = 0.14; rpm = c.v / top(c.gear); }
  else if (c.gear > 1 && c.v / top(c.gear - 1) < 0.72) { c.gear--; rpm = c.v / top(c.gear); }
  c.rpm = clamp(0.14 + rpm * 0.86, 0.14, 1);
}

export function yawAuthority(v, stats, hand) {
  const k = stats.yaw / (1 + (v / 34) * (v / 34));
  return k * Math.min(1, v / 7) * (hand ? 1.3 : 1);
}

// input: { throttle 0..1, brake 0..1, steer -1..1, hand bool, nos bool }
export function stepCar(track, c, input, dt = DT) {
  const st = c.stats;
  c.wallHit = false;
  c.bump = false;

  // steering smoothing so keyboard taps are not twitchy
  const target = clamp(input.steer, -1, 1);
  const rate = Math.abs(target) > Math.abs(c.steer) ? 7 : 10;
  c.steer += clamp(target - c.steer, -rate * dt, rate * dt);

  c.nos = !!input.nos && c.nitro > 0 && c.v > 6;
  if (c.nos) c.nitro = Math.max(0, c.nitro - st.nitroDrain * dt);

  const vmax = st.vmax * (c.nos ? 1.22 + 0.06 * (st.nitroPower - 1) / 0.07 * 0.07 : 1);
  const accelBase = st.accel * (c.nos ? 1.5 * st.nitroPower : 1);

  let a = 0;
  const gripMul = track.def.grip ?? 1;
  if (input.throttle > 0) a += accelBase * input.throttle * Math.max(0, 1 - Math.pow(c.v / vmax, 2.2)) * (c.shiftT > 0 ? 0.45 : 1) * (c.v < 25 ? 0.7 + 0.3 * gripMul : 1);
  if (c.v > vmax) a -= (c.v - vmax) * 2.2;
  if (input.brake > 0) a -= 62 * input.brake * (0.55 + 0.45 * gripMul);
  a -= 3.2 + 0.0009 * c.v * c.v;
  const slip = wrapPi(c.h - c.tv);
  a -= Math.abs(Math.sin(slip)) * c.v * (input.hand ? 0.3 : 1.1);
  c.v = Math.max(0, c.v + a * dt);
  c.acc = a;
  c.braking = input.brake > 0 && c.v > 1;
  updateGearbox(c, st);

  const p = sampleTrack(track, c.s);
  const hand = !!input.hand && c.v > 14;
  const omega = yawAuthority(c.v, st, hand) * c.steer;
  c.lat = omega * c.v;
  const dsdt = (c.v * Math.cos(c.tv)) / Math.max(0.3, 1 - p.k * c.d);

  const assist = hand ? 0 : 0.9;
  let gripRate = st.grip * gripMul * (hand ? 0.2 : 1) * (1 - 0.3 * clamp(c.v / 70, 0, 1));
  if (c.crashT > 0) { gripRate *= 1.6; c.crashT -= dt; }

  c.h += (omega - p.k * dsdt - assist * c.h * (Math.abs(c.steer) < 0.15 ? 1 : 0.25)) * dt;
  c.tv += (gripRate * wrapPi(c.h - c.tv) - p.k * dsdt) * dt;
  c.h = clamp(c.h, -1.45, 1.45);
  c.tv = clamp(c.tv, -1.45, 1.45);

  c.s += dsdt * dt;
  c.d += c.v * Math.sin(c.tv) * dt;
  c.progress += dsdt * dt;

  // walls
  const lim = track.halfW - 1.0;
  if (Math.abs(c.d) > lim) {
    const side = Math.sign(c.d);
    c.d = side * lim;
    const into = Math.sin(c.tv) * side;
    if (into > 0) {
      c.wallHit = into > 0.12;
      c.v *= 1 - clamp(0.25 + into * 0.9, 0.25, 0.7);
      c.tv = -side * 0.12 + c.tv * 0.2;
      c.h = c.h * 0.3 - side * 0.1;
      c.crashT = 0.35;
    }
  }

  c.slip = Math.abs(slip);
  c.drifting = c.slip > 0.22 && c.v > 22;
  return c;
}

// ---- traffic ---------------------------------------------------------
export function makeTraffic(track, count, rng, avoidS = []) {
  const lanes = [-1.5, -0.5, 0.5, 1.5].map((l) => (l * track.def.width) / 4.3);
  const cars = [];
  for (let i = 0; i < count; i++) {
    let s;
    for (let tries = 0; tries < 30; tries++) {
      s = rng() * track.L;
      if (avoidS.every((a) => Math.abs(wrapDelta(track, s - a)) > 55)) break;
    }
    cars.push({
      s, d: lanes[Math.floor(rng() * lanes.length)], v: 15 + rng() * 11, h: 0, passed: false,
      hue: Math.floor(rng() * 6), kind: Math.floor(rng() * 3),
    });
  }
  return cars;
}

export function wrapDelta(track, ds) {
  const L = track.L;
  ds %= L;
  if (ds > L / 2) ds -= L;
  if (ds < -L / 2) ds += L;
  return ds;
}

export function stepTraffic(track, traffic, dt = DT) {
  for (const t of traffic) t.s = wrapS(track, t.s + t.v * dt);
}

// ---- AI --------------------------------------------------------------
// Fastest speed at which the car can still turn as sharply as the road
// bends (steering authority shrinks with speed), with a safety margin.
function cornerSpeed(st, k, margin) {
  const ak = Math.abs(k);
  for (let v = st.vmax * 1.3; v > 12; v -= 1) {
    if (yawAuthority(v, st, false) * margin >= ak * v) return v;
  }
  return 12;
}

export function aiInput(track, c, ai, traffic, others) {
  const st = c.stats;
  // lane choice: avoid slow traffic and other cars right in front
  let want = ai.lane;
  const look = 14 + c.v * 0.9;
  let blocker = null;
  const consider = (o) => {
    const ahead = wrapDelta(track, o.s - c.s);
    if (ahead > 2 && ahead < look && Math.abs(o.d - c.d) < 3.0 && (o.v ?? 0) < c.v - 2) {
      if (!blocker || ahead < blocker.ahead) blocker = { ahead, o };
    }
  };
  traffic.forEach(consider);
  others.forEach((o) => o !== c && consider(o));
  if (blocker) {
    const room = track.halfW - 3.2;
    const left = clamp(blocker.o.d - 3.4, -room, room);
    const right = clamp(blocker.o.d + 3.4, -room, room);
    want = Math.abs(left - c.d) < Math.abs(right - c.d) ? left : right;
    ai.lane = want;
  }
  // lookahead curvature for speed targeting
  let kMax = 0;
  const preview = 12 + c.v * 1.1;
  for (let i = 0; i <= 6; i++) kMax = Math.max(kMax, Math.abs(sampleTrack(track, c.s + (preview * i) / 6).k));
  const vCorner = cornerSpeed(st, kMax, ai.latG);
  const vTarget = Math.min(st.vmax * ai.pace, vCorner);

  const hStar = clamp(Math.atan2((want - c.d) * 0.55, Math.max(c.v, 12)), -0.4, 0.4);
  const p = sampleTrack(track, c.s + c.v * 0.25);
  const auth = Math.max(0.2, yawAuthority(c.v, st, false));
  const steer = clamp(((hStar - c.h) * 3.4 + p.k * c.v) / auth, -1, 1);

  const over = c.v - vTarget;
  return {
    throttle: over < 0 ? 1 : 0,
    brake: over > 3 ? clamp(over / 14, 0.2, 1) : 0,
    steer,
    hand: false,
    nos: ai.useNos && c.nitro > 40 && kMax < 0.003 && c.v > 35,
  };
}

// ---- car-vs-car contact ---------------------------------------------
export function resolveContact(track, a, b) {
  const ds = wrapDelta(track, b.s - a.s);
  if (Math.abs(ds) > CAR_LEN * 0.95) return false;
  const dd = b.d - a.d;
  if (Math.abs(dd) > CAR_WID * 0.95) return false;
  const push = (CAR_WID * 0.95 - Math.abs(dd)) * 0.5 + 0.05;
  const sign = dd >= 0 ? 1 : -1;
  a.d -= sign * push;
  b.d += sign * push;
  // longitudinal: the one behind loses speed
  if (ds > 0) { if (a.v > (b.v ?? 0)) a.v = (b.v ?? a.v) * 0.9 + a.v * 0.1; }
  else { if ((b.v ?? 0) > a.v) b.v = a.v * 0.9 + (b.v ?? 0) * 0.1; }
  return true;
}

export function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
