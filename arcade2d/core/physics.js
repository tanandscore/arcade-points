// A small rigid-body physics engine for 2D games with towers of blocks, balls and things that fall over.
// Boxes and circles, friction, bounce, resting stacks that stay put (warm-started sequential impulses, the method
// Box2D uses) and sleeping so a finished pile stops costing anything. Units are pixels and seconds, y points down.
//
//   const world = new World({ gravity: 1100 });
//   const ground = world.addBox({ x: 800, y: 540, hw: 2000, hh: 40, static: true });
//   const crate  = world.addBox({ x: 600, y: 400, hw: 20, hh: 20, density: 0.6, ud: { mat: "wood" } });
//   const ball   = world.addCircle({ x: 100, y: 300, r: 14, vx: 500, vy: -300 });
//   world.onImpact = (a, b, impulse, x, y) => { ... damage ... };
//   world.step(1 / 60);

const IMPACT_MIN = 60; // an approach slower than this (px/s) is a touch, not an impact
const MAX_V = 2600, MAX_W = 90;
const byLow = (a, b) => a.low - b.low; // highest on the screen first
const KEYM = 4194304;

export class World {
  constructor(o = {}) {
    this.gravity = o.gravity ?? 1100;
    // many small steps with a few passes each beats few big steps with many passes: tall stacks stay still
    this.iterations = o.iterations ?? 3; this.substeps = o.substeps ?? 10; this.posIterations = o.posIterations ?? 1;
    this.slop = 0.5; this.baumgarte = 0.25; this.maxCorrection = 6;
    this.sleepTime = o.sleepTime ?? 0.55; this.sleepEnabled = o.sleep !== false;
    this.bodies = []; this.order = []; this.arbs = new Map(); this.pairs = []; this.active = []; this.trash = [];
    this.time = 0; this.frame = 0; this.nextId = 1; this.inStep = false;
    this.onImpact = null; // (a, b, impulse, x, y, nx, ny, speed) -- fired when two bodies hit each other hard
    this.quiet = false;   // true = do not report impacts (used while a freshly built level settles)
  }

  addBox(d) { return this.add({ ...d, kind: "box" }); }
  addCircle(d) { return this.add({ ...d, kind: "circle" }); }
  add(d) {
    const b = {
      id: this.nextId++, kind: d.kind, x: d.x || 0, y: d.y || 0, rot: d.rot || 0, vx: d.vx || 0, vy: d.vy || 0, av: d.av || 0,
      hw: d.hw || 0, hh: d.hh || 0, r: d.r || 0, friction: d.friction ?? 0.55, restitution: d.restitution ?? 0.08,
      density: d.density ?? 1, linDamp: d.linDamp ?? 0.03, angDamp: d.angDamp ?? 0.1, gravityScale: d.gravityScale ?? 1,
      static: !!d.static, awake: true, sleepT: 0, ud: d.ud || {}, c: 1, s: 0, ex: 0, ey: 0, dead: false, group: d.group || 0, noSleep: !!d.noSleep,
      x0: 0, y0: 0, rot0: 0, l: 0, r2: 0, t: 0, bm: 0, isl: null, minT: 0,
    };
    b.x0 = b.x; b.y0 = b.y; b.rot0 = b.rot;
    const area = b.kind === "circle" ? Math.PI * b.r * b.r : 4 * b.hw * b.hh;
    if (b.static) { b.m = 0; b.invM = 0; b.I = 0; b.invI = 0; }
    else {
      b.m = d.mass ?? area * b.density * 0.01;
      b.I = b.kind === "circle" ? 0.5 * b.m * b.r * b.r : b.m * (4 * b.hw * b.hw + 4 * b.hh * b.hh) / 12;
      b.invM = 1 / b.m; b.invI = 1 / b.I;
    }
    this.refresh(b); this.bodies.push(b); this.order.push(b); return b;
  }
  remove(b) { // safe to call from inside onImpact: the body is only marked now and taken out once the step is over
    if (b.dead) return; b.dead = true; this.trash.push(b); if (!this.inStep) this.flush();
  }
  flush() {
    if (!this.trash.length) return;
    for (const b of this.trash) { let i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); i = this.order.indexOf(b); if (i >= 0) this.order.splice(i, 1); }
    for (const [k, a] of this.arbs) if (a.a.dead || a.b.dead) { const o = a.a.dead ? a.b : a.a; if (!o.dead && !o.static) this.wake(o); this.arbs.delete(k); } // whatever rested on it must wake up
    this.pairs = this.pairs.filter((a) => !a.a.dead && !a.b.dead); this.trash.length = 0;
  }
  wake(b) { if (b.static) return; b.awake = true; b.sleepT = 0; }
  refresh(b) {
    b.c = Math.cos(b.rot); b.s = Math.sin(b.rot);
    if (b.kind === "circle") { b.ex = b.ey = b.r; } else { b.ex = Math.abs(b.c) * b.hw + Math.abs(b.s) * b.hh; b.ey = Math.abs(b.s) * b.hw + Math.abs(b.c) * b.hh; }
  }
  push(b, ix, iy, px, py) { // an instant shove at a point (impulse), e.g. a launch or an explosion
    if (b.static) return; this.wake(b); b.vx += ix * b.invM; b.vy += iy * b.invM;
    if (px != null) b.av += ((px - b.x) * iy - (py - b.y) * ix) * b.invI;
  }
  explode(x, y, radius, power, hit) { // everything within radius is thrown away from (x, y); hit(body, strength 0..1) lets the game do damage
    for (const b of this.bodies) {
      if (b.static || b.dead) continue; const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); const reach = radius + (b.kind === "circle" ? b.r : Math.max(b.hw, b.hh) * 0.6);
      if (d > reach) continue; const k = 1 - d / reach, nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : -1;
      this.push(b, nx * power * k * b.m, (ny - 0.12) * power * k * b.m, x, y); if (hit) hit(b, k);
    }
  }
  queryCircle(x, y, r, fn) { for (const b of this.bodies) { if (!b.dead && Math.abs(b.x - x) < b.ex + r && Math.abs(b.y - y) < b.ey + r) fn(b); } }
  awakeCount() { let n = 0; for (const b of this.bodies) if (!b.static && b.awake) n++; return n; }

  // ------------------------------------------------------------------------------------------------------------------------------
  step(dt) {
    this.inStep = true;
    this.findPairs(dt);
    const n = this.substeps, h = dt / n;
    for (let i = 0; i < n; i++) this.stepOnce(h);
    this.time += dt;
    if (this.sleepEnabled) this.updateSleep(dt);
    this.inStep = false; this.flush();
  }

  // once per frame: which bodies could touch during this frame? (sweep and prune on the x axis; the boxes are grown by how far each body can travel)
  findPairs(dt) {
    const frame = ++this.frame, ord = this.order, n = ord.length;
    for (let i = 0; i < n; i++) {
      const b = ord[i]; let m = 2;
      if (!b.static && b.awake) m = Math.hypot(b.vx, b.vy) * dt + 3 + (b.kind === "circle" ? 0 : Math.abs(b.av) * dt * Math.max(b.hw, b.hh));
      b.l = b.x - b.ex - m; b.r2 = b.x + b.ex + m; b.t = b.y - b.ey - m; b.bm = b.y + b.ey + m;
    }
    for (let i = 1; i < n; i++) { const x = ord[i]; let j = i - 1; while (j >= 0 && ord[j].l > x.l) { ord[j + 1] = ord[j]; j--; } ord[j + 1] = x; } // nearly sorted already, so this is cheap
    const arbs = this.arbs;
    for (let i = 0; i < n; i++) {
      const A = ord[i], aIdle = A.static || !A.awake;
      for (let j = i + 1; j < n; j++) {
        const B = ord[j]; if (B.l > A.r2) break;
        if (B.t > A.bm || A.t > B.bm) continue;
        if (A.group && A.group === B.group) continue; // bodies in the same group (e.g. one bird's pieces) ignore each other
        const first = A.id < B.id ? A : B, second = first === A ? B : A, key = first.id * KEYM + second.id;
        let arb = arbs.get(key); const bIdle = B.static || !B.awake;
        if (aIdle && bIdle) { if (arb) arb.seen = frame; continue; }
        if (!arb) { arb = { a: first, b: second, n: 0, cs: [newContact(), newContact()], friction: Math.sqrt(first.friction * second.friction), restitution: Math.max(first.restitution, second.restitution), seen: 0, low: 0 }; arbs.set(key, arb); }
        arb.seen = frame;
      }
    }
    const pairs = this.pairs; pairs.length = 0;
    for (const [k, a] of arbs) {
      if (a.seen !== frame) { arbs.delete(k); continue; }
      a.low = a.a.static ? a.b.y : a.b.static ? a.a.y : (a.a.y + a.b.y) * 0.5; pairs.push(a);
    }
    pairs.sort(byLow); // highest first: a stack's weight travels from the top to the floor, so solving in that order settles it fastest
  }

  // narrow phase for every candidate pair, with the solver's memory carried over (warm starting)
  detect() {
    const pairs = this.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const arb = pairs[i], A = arb.a, B = arb.b; if (A.dead || B.dead) { arb.n = 0; continue; }
      const aIdle = A.static || !A.awake, bIdle = B.static || !B.awake; if (aIdle && bIdle) continue;
      if (Math.abs(A.x - B.x) > A.ex + B.ex || Math.abs(A.y - B.y) > A.ey + B.ey) { arb.n = 0; continue; }
      const cs = SCRATCH, cnt = collide(A, B, cs);
      if (cnt === 0) { arb.n = 0; continue; }
      if (aIdle !== bIdle) { const sl = aIdle ? A : B; if (!sl.static) { sl.awake = true; sl.sleepT = 0; } } // touched by something awake: wake up
      let taken = 0;
      for (let k = 0; k < cnt; k++) {
        const nc = cs[k]; let Pn = 0, Pt = 0, best = 16, bi = -1;
        for (let m = 0; m < arb.n; m++) { if (taken & (1 << m)) continue; const oc = arb.cs[m], dx = oc.px - nc.px, dy = oc.py - nc.py, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bi = m; } }
        if (bi >= 0) { taken |= 1 << bi; Pn = arb.cs[bi].Pn; Pt = arb.cs[bi].Pt; }
        nc.Pn = Pn; nc.Pt = Pt;
      }
      for (let k = 0; k < cnt; k++) { const d = arb.cs[k], s = cs[k]; d.px = s.px; d.py = s.py; d.nx = s.nx; d.ny = s.ny; d.sep = s.sep; d.f = s.f; d.Pn = s.Pn; d.Pt = s.Pt; }
      arb.n = cnt;
    }
  }

  stepOnce(h) {
    const bodies = this.bodies, g = this.gravity, ih = 1 / h;
    this.detect();
    // forces (and remember where everything was when the contacts were found, for the position fix-up below)
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]; b.x0 = b.x; b.y0 = b.y; b.rot0 = b.rot;
      if (b.static || !b.awake) continue;
      b.vy += g * b.gravityScale * h;
      const ld = 1 / (1 + h * b.linDamp), ad = 1 / (1 + h * b.angDamp); b.vx *= ld; b.vy *= ld; b.av *= ad;
    }
    const pairs = this.pairs, active = this.active; active.length = 0;
    for (let i = 0; i < pairs.length; i++) { const a = pairs[i]; if (a.n === 0 || a.a.dead || a.b.dead) continue; if ((a.a.static || !a.a.awake) && (a.b.static || !a.b.awake)) continue; active.push(a); }
    for (let i = 0; i < active.length; i++) this.preStep(active[i], ih);
    for (let it = 0; it < this.iterations; it++) { if (it & 1) for (let i = active.length - 1; i >= 0; i--) this.applyImpulse(active[i]); else for (let i = 0; i < active.length; i++) this.applyImpulse(active[i]); }
    // move
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]; if (b.static || !b.awake) continue;
      const sp = Math.hypot(b.vx, b.vy); if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
      if (b.av > MAX_W) b.av = MAX_W; else if (b.av < -MAX_W) b.av = -MAX_W;
      b.x += b.vx * h; b.y += b.vy * h; b.rot += b.av * h;
    }
    // push overlapping bodies apart by moving them directly (this does not add speed, unlike pushing through the velocities)
    for (let it = 0; it < this.posIterations; it++) { let worst = 0; for (let i = 0; i < active.length; i++) worst = Math.min(worst, this.fixPositions(active[i])); if (worst > -this.slop * 0.5) break; }
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (!b.static && b.awake) this.refresh(b); }
  }

  fixPositions(arb) {
    const A = arb.a, B = arb.b; let worst = 0;
    for (let k = 0; k < arb.n; k++) {
      const c = arb.cs[k];
      const tA = A.rot - A.rot0, tB = B.rot - B.rot0;
      const pax = A.x - A.x0 - tA * c.r1y, pay = A.y - A.y0 + tA * c.r1x, pbx = B.x - B.x0 - tB * c.r2y, pby = B.y - B.y0 + tB * c.r2x;
      const sep = c.sep + (pbx - pax) * c.nx + (pby - pay) * c.ny; if (sep < worst) worst = sep;
      const C = Math.max(-this.maxCorrection, Math.min(0, this.baumgarte * (sep + this.slop))); if (C === 0) continue;
      const P = -C * c.massN, px = P * c.nx, py = P * c.ny;
      A.x -= A.invM * px; A.y -= A.invM * py; A.rot -= A.invI * (c.r1x * py - c.r1y * px);
      B.x += B.invM * px; B.y += B.invM * py; B.rot += B.invI * (c.r2x * py - c.r2y * px);
    }
    return worst;
  }

  // ---- sleeping: a pile of touching bodies that has stopped moving for a while goes to sleep together; anything that touches it wakes it ----
  updateSleep(dt) {
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]; b.isl = b; b.minT = Infinity; if (b.static) continue;
      if (b.noSleep) { b.sleepT = 0; continue; }
      if (b.awake) { const lin = b.vx * b.vx + b.vy * b.vy, ang = b.av * b.av; if (lin < 12 * 12 && ang < 0.35 * 0.35) b.sleepT += dt; else b.sleepT = 0; }
    }
    const find = (b) => { while (b.isl !== b) { b.isl = b.isl.isl; b = b.isl; } return b; };
    const pairs = this.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i]; if (a.n === 0 || a.a.static || a.b.static || a.a.dead || a.b.dead) continue;
      const ra = find(a.a), rb = find(a.b); if (ra !== rb) ra.isl = rb;
    }
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (b.static) continue; const r = find(b), t = b.awake ? b.sleepT : Infinity; if (t < r.minT) r.minT = t; }
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]; if (b.static) continue; const t = find(b).minT;
      if (t >= this.sleepTime) { if (b.awake) { b.awake = false; b.vx = b.vy = b.av = 0; } }
      else if (!b.awake) { b.awake = true; b.sleepT = 0; }
    }
  }

  preStep(arb, ih) {
    const A = arb.a, B = arb.b;
    for (let k = 0; k < arb.n; k++) {
      const c = arb.cs[k];
      c.r1x = c.px - A.x; c.r1y = c.py - A.y; c.r2x = c.px - B.x; c.r2y = c.py - B.y;
      const rn1 = c.r1x * c.nx + c.r1y * c.ny, rn2 = c.r2x * c.nx + c.r2y * c.ny;
      const kN = A.invM + B.invM + A.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) + B.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2);
      c.massN = kN > 0 ? 1 / kN : 0;
      const tx = c.ny, ty = -c.nx;
      const rt1 = c.r1x * tx + c.r1y * ty, rt2 = c.r2x * tx + c.r2y * ty;
      const kT = A.invM + B.invM + A.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) + B.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2);
      c.massT = kT > 0 ? 1 / kT : 0;
      // how fast are they coming together? (for bounce and for damage)
      const dvx = B.vx - B.av * c.r2y - A.vx + A.av * c.r1y, dvy = B.vy + B.av * c.r2x - A.vy - A.av * c.r1x;
      const vn0 = dvx * c.nx + dvy * c.ny; c.bounce = 0;
      if (vn0 < -IMPACT_MIN) {
        if (arb.restitution > 0.02) c.bounce = -arb.restitution * vn0;
        if (this.onImpact && !this.quiet) { const rm = 1 / (A.invM + B.invM); this.onImpact(A, B, rm * -vn0, c.px, c.py, c.nx, c.ny, -vn0); }
      }
      // warm start
      const px = c.Pn * c.nx + c.Pt * tx, py = c.Pn * c.ny + c.Pt * ty;
      A.vx -= A.invM * px; A.vy -= A.invM * py; A.av -= A.invI * (c.r1x * py - c.r1y * px);
      B.vx += B.invM * px; B.vy += B.invM * py; B.av += B.invI * (c.r2x * py - c.r2y * px);
    }
  }

  applyImpulse(arb) {
    const A = arb.a, B = arb.b, fr = arb.friction;
    for (let k = 0; k < arb.n; k++) {
      const c = arb.cs[k];
      let dvx = B.vx - B.av * c.r2y - A.vx + A.av * c.r1y, dvy = B.vy + B.av * c.r2x - A.vy - A.av * c.r1x;
      const vn = dvx * c.nx + dvy * c.ny;
      let dPn = c.massN * (-vn + c.bounce);
      const Pn0 = c.Pn; c.Pn = Math.max(Pn0 + dPn, 0); dPn = c.Pn - Pn0;
      let px = dPn * c.nx, py = dPn * c.ny;
      A.vx -= A.invM * px; A.vy -= A.invM * py; A.av -= A.invI * (c.r1x * py - c.r1y * px);
      B.vx += B.invM * px; B.vy += B.invM * py; B.av += B.invI * (c.r2x * py - c.r2y * px);
      dvx = B.vx - B.av * c.r2y - A.vx + A.av * c.r1y; dvy = B.vy + B.av * c.r2x - A.vy - A.av * c.r1x;
      const tx = c.ny, ty = -c.nx, vt = dvx * tx + dvy * ty;
      let dPt = c.massT * -vt; const maxPt = fr * c.Pn, Pt0 = c.Pt; c.Pt = Math.max(-maxPt, Math.min(maxPt, Pt0 + dPt)); dPt = c.Pt - Pt0;
      px = dPt * tx; py = dPt * ty;
      A.vx -= A.invM * px; A.vy -= A.invM * py; A.av -= A.invI * (c.r1x * py - c.r1y * px);
      B.vx += B.invM * px; B.vy += B.invM * py; B.av += B.invI * (c.r2x * py - c.r2y * px);
    }
  }

  // convenience for the game: what is touching this body right now?
  touching(b) { let n = 0; for (const a of this.pairs) if (a.n && (a.a === b || a.b === b)) n++; return n; }
  contactsOf(b, fn) { for (const a of this.pairs) if (a.n && (a.a === b || a.b === b)) fn(a.a === b ? a.b : a.a, a); }
}

// ================================================================ collision shapes ================================================================
function newContact() { return { px: 0, py: 0, nx: 0, ny: 0, sep: 0, f: 0, Pn: 0, Pt: 0, r1x: 0, r1y: 0, r2x: 0, r2y: 0, massN: 0, massT: 0, bias: 0, bounce: 0 }; }
const SCRATCH = [newContact(), newContact()];

// returns how many contact points (0..2); the normal points from A toward B
function collide(A, B, out) {
  if (A.kind === "box") return B.kind === "box" ? boxBox(A, B, out) : circleBox(B, A, out, false);
  return B.kind === "box" ? circleBox(A, B, out, true) : circleCircle(A, B, out);
}

function circleCircle(A, B, out) {
  const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r, d2 = dx * dx + dy * dy; if (d2 > rr * rr) return 0;
  const d = Math.sqrt(d2), nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1, c = out[0];
  c.nx = nx; c.ny = ny; c.sep = d - rr; c.px = A.x + nx * (A.r - (rr - d) / 2); c.py = A.y + ny * (A.r - (rr - d) / 2); c.f = 1; return 1;
}

// circle C against box X. flip=false: normal must point from the box to the circle (A = box, B = circle); flip=true: from the circle to the box
function circleBox(C, X, out, flip) {
  const dx = C.x - X.x, dy = C.y - X.y;
  const lx = X.c * dx + X.s * dy, ly = -X.s * dx + X.c * dy;
  const cx = Math.max(-X.hw, Math.min(X.hw, lx)), cy = Math.max(-X.hh, Math.min(X.hh, ly));
  let nlx, nly, sep, qx, qy;
  if (cx === lx && cy === ly) { // centre is inside the box: push out through the nearest face
    const px = X.hw - Math.abs(lx), py = X.hh - Math.abs(ly);
    if (px < py) { nlx = lx >= 0 ? 1 : -1; nly = 0; qx = nlx * X.hw; qy = ly; sep = -(px + C.r); } else { nlx = 0; nly = ly >= 0 ? 1 : -1; qx = lx; qy = nly * X.hh; sep = -(py + C.r); }
  } else {
    const ddx = lx - cx, ddy = ly - cy, d2 = ddx * ddx + ddy * ddy; if (d2 > C.r * C.r) return 0;
    const d = Math.sqrt(d2); nlx = ddx / d; nly = ddy / d; qx = cx; qy = cy; sep = d - C.r;
  }
  // back to the world
  const nx = X.c * nlx - X.s * nly, ny = X.s * nlx + X.c * nly, wx = X.x + X.c * qx - X.s * qy, wy = X.y + X.s * qx + X.c * qy;
  const c = out[0]; c.sep = sep; c.px = wx; c.py = wy; c.f = 1;
  if (flip) { c.nx = -nx; c.ny = -ny; } else { c.nx = nx; c.ny = ny; }
  return 1;
}

// ---- box against box: separating axis test + clipping (the classic approach), up to two contact points ----
const E1 = 1, E2 = 2, E3 = 3, E4 = 4;
const CP1 = [{ x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }, { x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }];
const CP2 = [{ x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }, { x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }];
const INC = [{ x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }, { x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 }];
const setV = (d, s) => { d.x = s.x; d.y = s.y; d.in1 = s.in1; d.out1 = s.out1; d.in2 = s.in2; d.out2 = s.out2; };

function incidentEdge(c, hx, hy, px, py, rc, rs, nx, ny) {
  // the reference normal, seen from the incident box and flipped
  const lnx = -(rc * nx + rs * ny), lny = -(-rs * nx + rc * ny), ax = Math.abs(lnx), ay = Math.abs(lny);
  const v0 = c[0], v1 = c[1]; v0.in1 = v0.out1 = v1.in1 = v1.out1 = 0;
  let x0, y0, x1, y1;
  if (ax > ay) {
    if (lnx > 0) { x0 = hx; y0 = -hy; v0.in2 = E3; v0.out2 = E4; x1 = hx; y1 = hy; v1.in2 = E4; v1.out2 = E1; }
    else { x0 = -hx; y0 = hy; v0.in2 = E1; v0.out2 = E2; x1 = -hx; y1 = -hy; v1.in2 = E2; v1.out2 = E3; }
  } else {
    if (lny > 0) { x0 = hx; y0 = hy; v0.in2 = E4; v0.out2 = E1; x1 = -hx; y1 = hy; v1.in2 = E1; v1.out2 = E2; }
    else { x0 = -hx; y0 = -hy; v0.in2 = E2; v0.out2 = E3; x1 = hx; y1 = -hy; v1.in2 = E3; v1.out2 = E4; }
  }
  v0.x = px + rc * x0 - rs * y0; v0.y = py + rs * x0 + rc * y0; v1.x = px + rc * x1 - rs * y1; v1.y = py + rs * x1 + rc * y1;
}

const CLIP_EPS = 0.03; // a corner sitting exactly on the clip line (stacked boxes of the same width) must not flicker in and out
function clipSegment(vOut, vIn, nx, ny, offset, clipEdge) {
  let num = 0; const d0 = nx * vIn[0].x + ny * vIn[0].y - offset, d1 = nx * vIn[1].x + ny * vIn[1].y - offset;
  if (d0 <= CLIP_EPS) setV(vOut[num++], vIn[0]); if (d1 <= CLIP_EPS) setV(vOut[num++], vIn[1]);
  if ((d0 > CLIP_EPS && d1 < -CLIP_EPS) || (d1 > CLIP_EPS && d0 < -CLIP_EPS)) {
    const t = d0 / (d0 - d1), o = vOut[num]; o.x = vIn[0].x + t * (vIn[1].x - vIn[0].x); o.y = vIn[0].y + t * (vIn[1].y - vIn[0].y);
    if (d0 > 0) { o.in1 = clipEdge; o.out1 = vIn[0].out1; o.in2 = 0; o.out2 = vIn[0].out2; } else { o.in1 = vIn[1].in1; o.out1 = clipEdge; o.in2 = vIn[1].in2; o.out2 = 0; }
    num++;
  }
  return num;
}

function boxBox(A, B, out) {
  const hAx = A.hw, hAy = A.hh, hBx = B.hw, hBy = B.hh, dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = A.c * dpx + A.s * dpy, dAy = -A.s * dpx + A.c * dpy, dBx = B.c * dpx + B.s * dpy, dBy = -B.s * dpx + B.c * dpy;
  const cc = Math.abs(A.c * B.c + A.s * B.s), ss = Math.abs(A.c * B.s - A.s * B.c); // |C| (symmetric)
  const faceAx = Math.abs(dAx) - hAx - (cc * hBx + ss * hBy), faceAy = Math.abs(dAy) - hAy - (ss * hBx + cc * hBy);
  if (faceAx > 0 || faceAy > 0) return 0;
  const faceBx = Math.abs(dBx) - (cc * hAx + ss * hAy) - hBx, faceBy = Math.abs(dBy) - (ss * hAx + cc * hAy) - hBy;
  if (faceBx > 0 || faceBy > 0) return 0;
  // best axis (a bit of preference for A's faces so contacts do not flicker between axes)
  let axis = 0, sep = faceAx, nx, ny;
  if (dAx > 0) { nx = A.c; ny = A.s; } else { nx = -A.c; ny = -A.s; }
  const REL = 0.95, ABS = 0.01;
  if (faceAy > REL * sep + ABS * hAy) { axis = 1; sep = faceAy; if (dAy > 0) { nx = -A.s; ny = A.c; } else { nx = A.s; ny = -A.c; } }
  if (faceBx > REL * sep + ABS * hBx) { axis = 2; sep = faceBx; if (dBx > 0) { nx = B.c; ny = B.s; } else { nx = -B.c; ny = -B.s; } }
  if (faceBy > REL * sep + ABS * hBy) { axis = 3; sep = faceBy; if (dBy > 0) { nx = -B.s; ny = B.c; } else { nx = B.s; ny = -B.c; } }
  let fnx, fny, front, snx, sny, negSide, posSide, negEdge, posEdge;
  if (axis === 0) { fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + hAx; snx = -A.s; sny = A.c; const side = A.x * snx + A.y * sny; negSide = -side + hAy; posSide = side + hAy; negEdge = E3; posEdge = E1; incidentEdge(INC, hBx, hBy, B.x, B.y, B.c, B.s, fnx, fny); }
  else if (axis === 1) { fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + hAy; snx = A.c; sny = A.s; const side = A.x * snx + A.y * sny; negSide = -side + hAx; posSide = side + hAx; negEdge = E2; posEdge = E4; incidentEdge(INC, hBx, hBy, B.x, B.y, B.c, B.s, fnx, fny); }
  else if (axis === 2) { fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + hBx; snx = -B.s; sny = B.c; const side = B.x * snx + B.y * sny; negSide = -side + hBy; posSide = side + hBy; negEdge = E3; posEdge = E1; incidentEdge(INC, hAx, hAy, A.x, A.y, A.c, A.s, fnx, fny); }
  else { fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + hBy; snx = B.c; sny = B.s; const side = B.x * snx + B.y * sny; negSide = -side + hBx; posSide = side + hBx; negEdge = E2; posEdge = E4; incidentEdge(INC, hAx, hAy, A.x, A.y, A.c, A.s, fnx, fny); }
  if (clipSegment(CP1, INC, -snx, -sny, negSide, negEdge) < 2) return 0;
  if (clipSegment(CP2, CP1, snx, sny, posSide, posEdge) < 2) return 0;
  let n = 0;
  for (let i = 0; i < 2; i++) {
    const p = CP2[i], s = fnx * p.x + fny * p.y - front;
    if (s <= 0) {
      const c = out[n]; c.sep = s; c.nx = nx; c.ny = ny; c.px = p.x - s * fnx; c.py = p.y - s * fny;
      c.f = axis >= 2 ? (p.in2 | (p.out2 << 3) | (p.in1 << 6) | (p.out1 << 9)) : (p.in1 | (p.out1 << 3) | (p.in2 << 6) | (p.out2 << 9));
      n++;
    }
  }
  return n;
}
