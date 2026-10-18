// Midnight Burn — free-roam car physics and the computer driver. Pure maths, no graphics.
import { yawAuthority } from "../physics";
import { isWater, W as WORLD_W } from "./geo";

export const DT = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapPi = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const G_SURF = { road: 1, dirt: 0.74, kerb: 0.9 };

export function newVehicle(x, z, yaw, stats, y = 0) {
  return {
    x, z, y, yaw, vx: 0, vz: 0, vy: 0, speed: 0, fwd: 0, lat: 0, steer: 0, nitro: 0, nos: false, stats,
    gear: 1, rpm: 0.15, shiftT: 0, drifting: false, driftT: 0, driftScore: 0, slip: 0, braking: false, acc: 0,
    pitch: 0, roll: 0, onRoad: true, air: false, hit: 0, hitT: 0, wetGrip: 1, surfRoad: null, lastRoadPose: { x, z, yaw, y }, drowned: false, odo: 0, near: 0, yawRate: 0,
  };
}

const GEAR_TOP = [0.17, 0.31, 0.46, 0.62, 0.8, 1.0];
function gearbox(v, st) {
  if (v.shiftT > 0) v.shiftT -= DT;
  const top = (g) => st.vmax * GEAR_TOP[g - 1];
  let rpm = Math.abs(v.fwd) / top(v.gear);
  if (rpm > 0.94 && v.gear < 6) { v.gear++; v.shiftT = 0.14; rpm = Math.abs(v.fwd) / top(v.gear); }
  else if (v.gear > 1 && Math.abs(v.fwd) / top(v.gear - 1) < 0.72) { v.gear--; rpm = Math.abs(v.fwd) / top(v.gear); }
  v.rpm = clamp(0.14 + rpm * 0.86, 0.14, 1);
}

// the circles a car is made of, for hitting things
const CIRC = [[1.45, 0.95], [0, 1.0], [-1.45, 0.95]];
export function circlesOf(v) { const c = Math.cos(v.yaw), s = Math.sin(v.yaw); return (v.cc || CIRC).map(([o, r]) => ({ x: v.x + c * o, z: v.z + s * o, r, o })); }

function hitWorld(world, v, dt) {
  let impact = 0;
  for (const ci of circlesOf(v)) {
    world.queryColliders(ci.x, ci.z, (o) => {
      let nx = 0, nz = 0, pen = 0;
      if (o.t === 0) {
        if (v.y > o.y + o.h + 1) return;
        const dx = ci.x - o.x, dz = ci.z - o.z; const lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c;
        const cx = clamp(lx, -o.hw, o.hw), cz = clamp(lz, -o.hd, o.hd); const ex = lx - cx, ez = lz - cz; let d = Math.hypot(ex, ez);
        if (d >= ci.r) return;
        let lnx, lnz;
        if (d < 1e-4) { const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz); if (px < pz) { lnx = Math.sign(lx) || 1; lnz = 0; pen = px + ci.r; } else { lnx = 0; lnz = Math.sign(lz) || 1; pen = pz + ci.r; } }
        else { lnx = ex / d; lnz = ez / d; pen = ci.r - d; }
        nx = lnx * o.c - lnz * o.s; nz = lnx * o.s + lnz * o.c;
      } else {
        if (v.y - o.y > 1.4 || o.y - v.y > 1.0) return; // a barrier is about a metre high: a car on a road well above or below it does not touch it
        const sx = o.x2 - o.x1, sz = o.z2 - o.z1; const L2 = sx * sx + sz * sz || 1; const t = clamp(((ci.x - o.x1) * sx + (ci.z - o.z1) * sz) / L2, 0, 1);
        const px = o.x1 + sx * t, pz = o.z1 + sz * t; const dx = ci.x - px, dz = ci.z - pz; const d = Math.hypot(dx, dz);
        if (d >= ci.r * 0.9) return;
        if (d < 1e-4) { const L = Math.sqrt(L2); nx = -sz / L; nz = sx / L; } else { nx = dx / d; nz = dz / d; }
        pen = ci.r * 0.9 - d;
      }
      v.x += nx * pen; v.z += nz * pen; ci.x += nx * pen; ci.z += nz * pen;
      const vn = v.vx * nx + v.vz * nz;
      if (vn < 0) {
        const e = 0.18; v.vx -= (1 + e) * vn * nx; v.vz -= (1 + e) * vn * nz;
        const tx = -nz, tz = nx, vt = v.vx * tx + v.vz * tz; v.vx -= vt * tx * 0.08; v.vz -= vt * tz * 0.08;
        impact = Math.max(impact, -vn);
        // glancing blows swing the nose away
        const f = Math.cos(v.yaw), fz = Math.sin(v.yaw); const lever = ci.o; const cross = f * nz - fz * nx; v.yaw += clamp(cross * lever * -vn * 0.012, -0.12, 0.12) * (lever === 0 ? 0 : 1);
      }
    });
  }
  if (impact > 3) { v.hit = Math.max(v.hit, impact); v.hitT = 0.4; }
  return impact;
}

// input: {throttle, brake, steer(-1..1, + is right), hand, nos}
export function stepVehicle(world, v, input, dt = DT, env = {}) {
  const st = v.stats; const city = world.city;
  const surf = city.surfaceAt(v.x, v.z, v.y);
  v.onRoad = !!surf; v.surfRoad = surf ? surf.road : null;
  const grip0 = (surf ? G_SURF.road : G_SURF.dirt) * (env.wet ? 0.92 : 1) * (env.grip ?? 1);
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  let vf = v.vx * c + v.vz * s, vl = v.vx * -s + v.vz * c;

  const target = clamp(input.steer, -1, 1); const rate = Math.abs(target) > Math.abs(v.steer) ? 9 : 13; v.steer += clamp(target - v.steer, -rate * dt, rate * dt);
  v.nos = !!input.nos && v.nitro > 0 && vf > 6; if (v.nos) v.nitro = Math.max(0, v.nitro - st.nitroDrain * dt);
  if (v.nos && !v.nosWas) v.kick = 0.7; v.nosWas = v.nos; v.kick = Math.max(0, (v.kick || 0) - dt); // the shove you feel the instant the nitrous hits
  const vmax = st.vmax * (v.nos ? 1.22 + 0.06 * (st.nitroPower - 1) / 0.07 * 0.07 : 1) * (surf ? 1 : 0.7);
  const accelBase = st.accel * (v.nos ? 1.5 * st.nitroPower * (1 + 0.7 * Math.min(1, (v.kick || 0) / 0.7)) : 1);

  let a = 0; const hand = !!input.hand && vf > 14;
  if (input.throttle > 0 && !(vf < -0.5 && input.brake > 0)) a += accelBase * input.throttle * Math.max(0, 1 - Math.pow(Math.max(0, vf) / vmax, 2.2)) * (v.shiftT > 0 ? 0.45 : 1) * (vf < 25 ? 0.7 + 0.3 * grip0 : 1) * (v.air ? 0 : 1);
  if (vf > vmax) a -= (vf - vmax) * 2.2;
  if (input.brake > 0) { if (vf > 0.8) a -= 62 * input.brake * (0.55 + 0.45 * grip0); else if (input.throttle <= 0) a -= 14 * input.brake * (vf > -12 ? 1 : 0); }
  const drag = 3.2 + 0.0009 * vf * vf; a -= Math.sign(vf) * drag * (surf ? 1 : 2.4);
  const slipAng = Math.abs(Math.atan2(vl, Math.abs(vf) + 0.5));
  a -= Math.sign(vf) * Math.abs(Math.sin(slipAng)) * Math.abs(vf) * (hand ? 0.3 : 1.1);
  vf += a * dt; if (Math.abs(vf) < 0.05 && input.throttle <= 0 && input.brake <= 0) vf = 0; v.acc = a;
  v.braking = input.brake > 0 && vf > 1;

  const omega = yawAuthority(Math.abs(vf), st, hand) * 1.1 * v.steer * (vf < 0 ? -1 : 1) * (v.air ? 0.2 : 1);
  v.yawRate = omega; v.yaw += omega * dt;
  // yaw changed: the sideways part of the old motion becomes slip
  const c2 = Math.cos(v.yaw), s2 = Math.sin(v.yaw);
  let wvx = vf * c + vl * -s, wvz = vf * s + vl * c; // world velocity before the turn
  vf = wvx * c2 + wvz * s2; vl = wvx * -s2 + wvz * c2;
  const gripRate = st.grip * 1.16 * grip0 * (hand ? 0.2 : 1) * (1 - 0.18 * clamp(Math.abs(vf) / 70, 0, 1)) * (v.hitT > 0 ? 1.6 : 1);
  if (!v.air) vl *= Math.exp(-gripRate * dt);
  v.hitT = Math.max(0, v.hitT - dt);
  v.vx = vf * c2 + vl * -s2; v.vz = vf * s2 + vl * c2;
  v.fwd = vf; v.lat = vl; v.speed = Math.hypot(v.vx, v.vz); v.slip = slipAng;
  v.drifting = slipAng > 0.24 && v.speed > 20 && !v.air;
  gearbox(v, st);

  v.x += v.vx * dt; v.z += v.vz * dt;
  const limit = 40; if (v.x < limit) { v.x = limit; v.vx = Math.abs(v.vx) * 0.3; } if (v.z < limit) { v.z = limit; v.vz = Math.abs(v.vz) * 0.3; }
  if (v.x > WORLD_W - limit) { v.x = WORLD_W - limit; v.vx = -Math.abs(v.vx) * 0.3; } if (v.z > WORLD_W - limit) { v.z = WORLD_W - limit; v.vz = -Math.abs(v.vz) * 0.3; }
  v.hit = 0; hitWorld(world, v, dt);

  // up and down: roads, hills, ramps, falling
  const surf2 = city.surfaceAt(v.x, v.z, v.y, v.surfRoad);
  const ground = surf2 ? surf2.y : Math.max(city.groundH(v.x, v.z), city.meshH(v.x, v.z));
  // stay glued to the road: small steps (junctions, crests) are smoothed away so nothing feels like a bump; only a real drop-off makes the car fly
  if (v.air) {
    v.vy -= 28 * dt; v.y += v.vy * dt;
    if (v.y <= ground) { v.hit = Math.max(v.hit, Math.min(8, -v.vy * 0.25)); v.y = ground; v.vy = 0; v.air = false; v.prevG = ground; }
  } else {
    // ride the slope exactly (a limited feed-forward) and soak up small steps with a soft spring, so seams and crests never kick the car
    const pg = v.prevG === undefined ? ground : v.prevG; const cap = Math.max(0.02, v.speed * dt * 0.22); const ff = Math.max(-cap, Math.min(cap, ground - pg)); v.prevG = ground;
    v.y += ff; const dy = ground - v.y;
    if (dy < -1.4) { v.air = true; v.vy = 0; v.prevG = undefined; }
    else { let up = dy * (1 - Math.exp(-dt * (Math.abs(dy) > 0.5 ? 24 : 11))); if (up > 0) up = Math.min(up, 0.06 + v.speed * dt * 0.14); v.y += up; } // a step up is climbed over a few frames, never a pop
  }
  if (surf2) v.surfRoad = surf2.road;
  // slope for the body
  if (!v.air) {
    const fx = v.x + Math.cos(v.yaw) * 2.2, fz = v.z + Math.sin(v.yaw) * 2.2, bx = v.x - Math.cos(v.yaw) * 2.2, bz = v.z - Math.sin(v.yaw) * 2.2;
    const sf = city.surfaceAt(fx, fz, v.y, v.surfRoad), sb = city.surfaceAt(bx, bz, v.y, v.surfRoad);
    const yf = sf ? sf.y : city.meshH(fx, fz), yb = sb ? sb.y : city.meshH(bx, bz);
    const tp = Math.atan2(yf - yb, 4.4); v.pitch += (tp - v.pitch) * Math.min(1, dt * 7);
  }
  v.roll += ((-v.lat * 0.012 - v.steer * v.speed * 0.0016) - v.roll) * Math.min(1, dt * 6);

  if (surf2 && surf2.road.cls !== "str" || surf2) v.lastRoadPose = { x: v.x, z: v.z, yaw: v.yaw, y: v.y };
  // into the sea?
  if (!surf2 && isWater(v.x, v.z)) { v.waterT = (v.waterT || 0) + dt; if (v.y < 0.6 || v.waterT > 1.2) v.drowned = true; } else v.waterT = 0; // in the sea (even shallow sea-edge cells) for over a second = back on the road
  if (!surf2 && v.y < -1.5) v.drowned = true; // anything that sinks below sea level
  if (!surf2 && v.lastRoadPose.y - v.y > 5.5) v.drowned = true; // dropped off a flyover
  v.odo += v.speed * dt;
  // drifting charges the nitrous and builds style points
  if (v.drifting) { v.driftT += dt; v.nitro = Math.min(100, v.nitro + 7 * dt); v.driftScore += dt * v.speed * 2.2 * (1 + Math.min(2, v.driftT * 0.3)); } else if (v.driftT > 0) v.driftT = Math.max(0, v.driftT - dt * 3);
  return v;
}

// two cars touching
export function collideVehicles(a, b, ma = 1, mb = 1) {
  let hit = 0;
  for (const ca of circlesOf(a)) for (const cb of circlesOf(b)) {
    if (Math.abs(a.y - b.y) > 3) return 0;
    const dx = cb.x - ca.x, dz = cb.z - ca.z; const d = Math.hypot(dx, dz), r = ca.r + cb.r;
    if (d >= r || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d, pen = r - d; const tm = ma + mb;
    a.x -= nx * pen * (mb / tm); a.z -= nz * pen * (mb / tm); b.x += nx * pen * (ma / tm); b.z += nz * pen * (ma / tm);
    const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rv < 0) { const j = (-(1 + 0.25) * rv) / (1 / ma + 1 / mb); a.vx -= (j / ma) * nx; a.vz -= (j / ma) * nz; b.vx += (j / mb) * nx; b.vz += (j / mb) * nz; hit = Math.max(hit, -rv); }
  }
  return hit;
}

// ---- the computer driver ----------------------------------------------------------------------------------------------
// route: [{x,z,s}], ai: {base, latG, block, nos}. state is kept in `d` (created by newDriver).
export function newDriver(route, ai) { return { route, ai, pi: 0, off: 0, offT: 0, stuck: 0, nosT: 0 }; }
export function driveInput(world, v, d, others = [], mul = 1) {
  const R = d.route; const n = R.length;
  // keep our place on the route (only ever move forward, but look a bit around in case we were pushed)
  let best = d.pi, bd = 1e9; for (let i = Math.max(0, d.pi - 6); i < Math.min(n, d.pi + 40); i++) { const dd = (R[i].x - v.x) ** 2 + (R[i].z - v.z) ** 2; if (dd < bd) { bd = dd; best = i; } }
  d.pi = best;
  const speed = Math.max(0, v.fwd);
  const look = 10 + speed * 0.5;
  let j = d.pi; while (j < n - 1 && R[j].s - R[d.pi].s < look) j++;
  // lane offset to overtake
  d.offT -= DT; let want = 0;
  for (const o of others) {
    if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z; const dist = Math.hypot(dx, dz); if (dist > 34 || dist < 0.1) continue;
    const ahead = dx * Math.cos(v.yaw) + dz * Math.sin(v.yaw); const side = -dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw);
    if (ahead > 2 && Math.abs(side) < 3.4 && (o.fwd ?? o.speed) < speed + 4) { want = side > 0 ? -3.2 : 3.2; d.brakeFor = Math.max(d.brakeFor || 0, ahead < 9 ? 1 : 0); }
  }
  d.off += (want - d.off) * Math.min(1, DT * 2.5);
  const t = R[j]; const nj = Math.min(n - 1, j + 1); const dx = R[nj].x - R[j].x, dz = R[nj].z - R[j].z; const tl = Math.hypot(dx, dz) || 1;
  const tx = t.x + (-dz / tl) * d.off, tz = t.z + (dx / tl) * d.off;
  const err = wrapPi(Math.atan2(tz - v.z, tx - v.x) - v.yaw);
  const steer = clamp(err * 2.3 - v.yawRate * 0.18, -1, 1);
  // how sharp are the next bends?
  let k = 0; { let a0 = Math.atan2(R[Math.min(n - 1, d.pi + 2)].z - R[d.pi].z, R[Math.min(n - 1, d.pi + 2)].x - R[d.pi].x); for (const dist of [18, 40, 75, 120, 190]) { let q = d.pi; while (q < n - 3 && R[q].s - R[d.pi].s < dist) q++; const a1 = Math.atan2(R[Math.min(n - 1, q + 2)].z - R[q].z, R[Math.min(n - 1, q + 2)].x - R[q].x); const turn = Math.abs(wrapPi(a1 - a0)); const dd = Math.max(8, dist); k = Math.max(k, turn / dd); } }
  const g = 9.8 * d.ai.latG * (v.stats.grip / 5.2 > 1.1 ? 1.1 : v.stats.grip / 5.2 + 0.1) * 1.6;
  const vCurve = k > 0.0004 ? Math.sqrt(g / k) : 999;
  const vTarget = Math.min(v.stats.vmax * d.ai.base * mul, vCurve + 3.5);
  let throttle = 0, brake = 0;
  if (speed < vTarget - 1.5) throttle = 1; else if (speed > vTarget + 3) brake = clamp((speed - vTarget) / 12, 0.2, 1); else throttle = 0.35;
  if (d.brakeFor) { brake = Math.max(brake, 0.5); throttle = 0; d.brakeFor = 0; }
  // stuck? back out
  if (speed < 1.5 && throttle > 0) d.stuck += DT; else d.stuck = Math.max(0, d.stuck - DT * 2);
  let rev = false; if (d.stuck > 1.8) { rev = true; if (d.stuck > 3.2) d.stuck = 0; }
  const nos = d.ai.nos && speed > 30 && k < 0.0005 && Math.abs(err) < 0.1;
  if (rev) return { throttle: 0, brake: 1, steer: -steer, hand: false, nos: false };
  return { throttle, brake, steer, hand: false, nos };
}
