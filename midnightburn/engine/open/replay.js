// Midnight Burn — instant replay and photo camera (Upgrade 134).
// The last seconds of driving are kept as a list of snapshots (where every car was, 30 times a second). A replay freezes the game,
// puts every car back where it was, moment by moment, and films it from cinematic cameras. Leaving the replay puts everything back exactly as it was.
// No drawing code in here: it only reads and writes the positions of the cars the game already has.
const NUM = ["x", "y", "z", "yaw", "pitch", "roll", "speed", "steer", "rpm", "slip", "vx", "vz", "wheelSpin"];
const ANG = new Set(["yaw", "pitch", "roll"]);
const FLAG = ["braking", "nosOn", "handbrake"];

const actors = (G) => { const out = []; if (G.player) out.push(G.player); for (const t of G.traffic || []) out.push(t); for (const c of G.cops || []) out.push(c); for (const r of G.racers || []) if (r && r.v) out.push(r.v); if (G.run && G.run.racers) for (const r of G.run.racers) if (r && r.v) out.push(r.v); return out; };
const grab = (o) => { const s = {}; for (const k of NUM) if (typeof o[k] === "number") s[k] = o[k]; for (const k of FLAG) if (typeof o[k] === "boolean") s[k] = o[k]; return s; };
const lerpAng = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

export function createReplay({ seconds = 20, hz = 30 } = {}) {
  const max = Math.round(seconds * hz), step = 1 / hz; const frames = []; let acc = 0; let live = null; let on = false;
  const R = {
    get on() { return on; }, get length() { return Math.max(0, (frames.length - 1) * step); }, get frames() { return frames.length; },
    clear() { frames.length = 0; acc = 0; },
    // call once per drawn frame while the game is running
    record(G, dt) { if (on || !G || !G.player) return; acc += dt; if (acc < step) return; acc = Math.min(acc - step, step); const list = actors(G); frames.push({ refs: list, vals: list.map(grab) }); if (frames.length > max) frames.shift(); },
    // freeze the game and remember where everything really is
    begin(G) { if (on || frames.length < 2) return false; const list = actors(G); live = { refs: list, vals: list.map(grab), pause: G.pause }; G.pause = true; on = true; return true; },
    // put every car where it was at time t (seconds from the start of the recording)
    seek(G, t) {
      if (!on) return null; const f = Math.max(0, Math.min(frames.length - 1.0001, t / step)); const i = Math.floor(f), k = f - i; const A = frames[i], B = frames[Math.min(frames.length - 1, i + 1)];
      const seen = new Set();
      for (let n = 0; n < A.refs.length; n++) { const o = A.refs[n], a = A.vals[n]; seen.add(o); const m = B.refs.indexOf(o); const b = m >= 0 ? B.vals[m] : a;
        for (const key in a) { if (typeof a[key] === "boolean") o[key] = a[key]; else o[key] = ANG.has(key) ? lerpAng(a[key], b[key] ?? a[key], k) : a[key] + ((b[key] ?? a[key]) - a[key]) * k; } }
      // cars that exist now but did not exist at that moment are tucked out of sight
      for (const o of live.refs) if (!seen.has(o) && typeof o.y === "number") o.y = -900;
      return A.refs[0];
    },
    // leave the replay: everything goes back to exactly where it really is
    end(G) { if (!on) return; for (let n = 0; n < live.refs.length; n++) Object.assign(live.refs[n], live.vals[n]); G.pause = live.pause; live = null; on = false; },
  };
  return R;
}

// ---- cameras. Each returns { x, y, z, lx, ly, lz, fov, roll } for the car pose P (and the pose at the start of the shot, P0). ----
export const SHOTS = ["TRACKSIDE", "LOW CHASE", "FRONT QUARTER", "HELICOPTER", "WHEEL"];
export function shotCamera(shot, P, P0, t) {
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw), y = P.y || 0;
  switch (shot % SHOTS.length) {
    case 0: { const c0 = Math.cos(P0.yaw), s0 = Math.sin(P0.yaw); const ahead = 26 + Math.min(40, (P0.speed || 0) * 1.1); const x = P0.x + c0 * ahead - s0 * 7.5, z = P0.z + s0 * ahead + c0 * 7.5; const d = Math.hypot(P.x - x, P.z - z); return { x, y: (P0.y || 0) + 1.5, z, lx: P.x, ly: y + 0.7, lz: P.z, fov: Math.max(16, Math.min(52, 900 / (d + 8))), roll: 0 }; }
    case 1: return { x: P.x - c * 5.2 + s * 0.9, y: y + 0.75, z: P.z - s * 5.2 - c * 0.9, lx: P.x + c * 6, ly: y + 0.9, lz: P.z + s * 6, fov: 68, roll: Math.max(-0.12, Math.min(0.12, (P.steer || 0) * -0.1)) };
    case 2: { const a = P.yaw + 0.55 + Math.sin(t * 0.35) * 0.25; return { x: P.x + Math.cos(a) * 6.4, y: y + 1.05, z: P.z + Math.sin(a) * 6.4, lx: P.x, ly: y + 0.65, lz: P.z, fov: 42, roll: 0 }; }
    case 3: return { x: P.x - c * 16 + Math.cos(t * 0.3) * 6, y: y + 24, z: P.z - s * 16 + Math.sin(t * 0.3) * 6, lx: P.x + c * 8, ly: y, lz: P.z + s * 8, fov: 46, roll: 0 };
    default: return { x: P.x + c * 0.4 - s * 2.6, y: y + 0.42, z: P.z + s * 0.4 + c * 2.6, lx: P.x + c * 3.2, ly: y + 0.5, lz: P.z + s * 3.2, fov: 58, roll: 0.04 };
  }
}
// the free camera of photo mode: circles the car at a distance and height the player chooses
export function orbitCamera(P, o) {
  const a = P.yaw + o.az, el = Math.max(0.02, Math.min(1.45, o.el)), d = Math.max(2.2, Math.min(40, o.dist)); const y = P.y || 0;
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw); const tx = P.x - s * (o.px || 0), tz = P.z + c * (o.px || 0), ty = y + 0.65 + (o.py || 0);
  return { x: tx + Math.cos(a) * Math.cos(el) * d, y: Math.max(y + 0.18, ty + Math.sin(el) * d), z: tz + Math.sin(a) * Math.cos(el) * d, lx: tx, ly: ty, lz: tz, fov: Math.max(12, Math.min(95, o.fov)), roll: o.roll || 0 };
}
