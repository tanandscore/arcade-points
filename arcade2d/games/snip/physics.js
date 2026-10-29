// Snip & Drop: the rope physics. Pure code, shared by the game, the automatic solver and the tests.
// A rope is a chain of little points tied to a pin and to the berry. Gravity pulls everything down, the links keep their length, and cutting a
// rope just removes one link. The berry can touch stars (collect), a bubble (floats up until popped), spikes (lost) and the critter's mouth (fed!).

export const DT = 1 / 120;
export const GRAV = 900;
export const BERRY_R = 15;
export const MOUTH_R = 38;
const SEG = 14;               // length of one link
const ITER = 14;
const BERRY_INV = 1 / 5;      // the berry is heavier than a rope point

export function makeSim(lv) {
  const ropes = lv.ropes.map((r, id) => {
    const [ax, ay, lenIn] = r, dx = lv.berry[0] - ax, dy = lv.berry[1] - ay, dist = Math.hypot(dx, dy), len = lenIn || dist + 4;
    const n = Math.max(2, Math.round(len / SEG)), rest = len / n, nodes = [];
    // spread the points along the straight line, with a little sag if the rope is longer than the gap
    for (let i = 0; i <= n; i++) { const k = i / n, sag = Math.sin(k * Math.PI) * Math.max(0, len - dist) * 0.5; nodes.push({ x: ax + dx * k, y: ay + dy * k + sag, px: ax + dx * k, py: ay + dy * k + sag }); }
    return { id, ax, ay, n, rest, nodes, cut: -1, cutT: -1 };
  });
  return {
    lv, t: 0, ropes, berry: { x: lv.berry[0], y: lv.berry[1], px: lv.berry[0], py: lv.berry[1], bubble: -1 },
    stars: (lv.stars || []).map((s) => ({ x: s[0], y: s[1], got: false })), bubbles: (lv.bubbles || []).map((b) => ({ x: b[0], y: b[1], r: 38, state: "free", pop: 0 })),
    state: "play", got: 0, events: [],
  };
}

// cut one rope at the link closest to a point (or the middle link if no point is given)
export function cutRope(S, id, atX, atY) {
  const r = S.ropes[id]; if (!r || r.cut >= 0) return false;
  let best = Math.floor(r.n / 2), bd = 1e9;
  if (atX != null) for (let i = 0; i < r.n; i++) { const a = r.nodes[i], b = r.nodes[i + 1], d = distSeg(atX, atY, a.x, a.y, b.x, b.y); if (d < bd) { bd = d; best = i; } }
  r.cut = best; r.cutT = S.t; S.events.push({ k: "cut", id, i: best, x: (r.nodes[best].x + r.nodes[best + 1].x) / 2, y: (r.nodes[best].y + r.nodes[best + 1].y) / 2 }); return true;
}
export function popBubble(S, i) { const b = S.bubbles[i]; if (!b || b.state === "popped") return false; b.state = "popped"; b.pop = 1; if (S.berry.bubble === i) S.berry.bubble = -1; S.events.push({ k: "pop", i, x: b.x, y: b.y }); return true; }

export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
export function segHitsRope(S, id, x0, y0, x1, y1) {   // does a swipe from (x0,y0) to (x1,y1) cross rope `id`? returns the point of contact or null
  const r = S.ropes[id]; if (r.cut >= 0) return null;
  for (let i = 0; i < r.n; i++) {
    const a = r.nodes[i], b = r.nodes[i + 1];
    if (segCross(x0, y0, x1, y1, a.x, a.y, b.x, b.y) || distSeg((a.x + b.x) / 2, (a.y + b.y) / 2, x0, y0, x1, y1) < 5) return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  }
  return null;
}
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy, den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / den, u = ((cx - ax) * d1y - (cy - ay) * d1x) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function step(S) {
  if (S.state !== "play") return;
  const lv = S.lv, b = S.berry; S.t += DT;
  // the berry rides a bubble: it floats upwards and sways
  const inBubble = b.bubble >= 0, g = inBubble ? -90 : GRAV;
  // integrate the berry
  { const vx = (b.x - b.px) * (inBubble ? 0.985 : 0.9992), vy = (b.y - b.py) * (inBubble ? 0.985 : 0.9992); b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + g * DT * DT; }
  // integrate the rope points
  for (const r of S.ropes) for (let i = 1; i <= r.n; i++) { const p = r.nodes[i]; if (i === r.n && r.cut < r.n) { /* the last point is glued to the berry below */ }
    const vx = (p.x - p.px) * 0.998, vy = (p.y - p.py) * 0.998; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + GRAV * DT * DT; }
  // keep the links the right length
  for (let it = 0; it < ITER; it++) {
    for (const r of S.ropes) {
      r.nodes[0].x = r.ax; r.nodes[0].y = r.ay;
      for (let i = 0; i < r.n; i++) {
        if (r.cut === i) continue;
        const a = r.nodes[i], c = r.nodes[i + 1];
        // the last link ties to the berry itself
        if (i === r.n - 1) { link(a, b, r.rest, i === 0 ? 0 : 1, BERRY_INV, r.cut >= 0 && r.cut < r.n - 1); continue; }
        link(a, c, r.rest, i === 0 ? 0 : 1, 1, false);
      }
    }
    // solid blocks push the berry out
    for (const bl of lv.blocks || []) pushOut(b, bl);
  }
  // rope points of the berry's side hang from the berry
  for (const r of S.ropes) { const last = r.nodes[r.n]; last.x = b.x; last.y = b.y; }
  // bubbles
  S.bubbles.forEach((bu, i) => {
    if (bu.state === "popped") { bu.pop = Math.max(0, bu.pop - DT * 4); return; }
    if (bu.state === "free" && b.bubble < 0 && Math.hypot(b.x - bu.x, b.y - bu.y) < bu.r - 6) { bu.state = "held"; b.bubble = i; S.events.push({ k: "bubble", i }); }
    if (bu.state === "held") { bu.x += (b.x - bu.x) * 0.2; bu.y += (b.y - bu.y) * 0.2 - 0; }
  });
  // stars
  for (const s of S.stars) if (!s.got && Math.hypot(b.x - s.x, b.y - s.y) < BERRY_R + 17) { s.got = true; S.got++; S.events.push({ k: "star", x: s.x, y: s.y }); }
  // the critter, spikes and the edge of the world
  if (Math.hypot(b.x - lv.critter[0], b.y - lv.critter[1]) < MOUTH_R) { S.state = "fed"; S.events.push({ k: "fed" }); return; }
  for (const sp of lv.spikes || []) if (b.x > sp[0] - BERRY_R * 0.6 && b.x < sp[0] + sp[2] + BERRY_R * 0.6 && b.y > sp[1] - BERRY_R * 0.6 && b.y < sp[1] + sp[3] + BERRY_R * 0.6) { S.state = "lost"; S.events.push({ k: "spike" }); return; }
  if (b.y > 600 || b.x < -60 || b.x > 1020 || b.y < -140) { S.state = "lost"; S.events.push({ k: "fall" }); }
}

// pull two points back to the link length. wa/wb: how much each moves. `onlyA`: the berry end is not pulled (a cut rope's loose tail)
function link(a, c, rest, anchorFix, invC, onlyA) {
  const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.0001, diff = (d - rest) / d;
  const wa = anchorFix === 0 ? 0 : 1, wc = onlyA ? 0 : invC, sum = wa + wc || 1;
  const fa = wa / sum, fc = wc / sum;
  a.x += dx * diff * fa; a.y += dy * diff * fa; c.x -= dx * diff * fc; c.y -= dy * diff * fc;
}
function pushOut(b, bl) {
  const [x, y, w, h] = bl, cx = Math.max(x, Math.min(b.x, x + w)), cy = Math.max(y, Math.min(b.y, y + h)), dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= BERRY_R * BERRY_R) return;
  if (d2 < 1e-6) { b.y = y - BERRY_R; return; }
  const d = Math.sqrt(d2); b.x = cx + (dx / d) * BERRY_R; b.y = cy + (dy / d) * BERRY_R;
  // lose some speed on impact (verlet: move the previous position towards the new one)
  const vx = b.x - b.px, vy = b.y - b.py, nx = dx / d, ny = dy / d, vn = vx * nx + vy * ny;
  if (vn < 0) { b.px = b.x - (vx - 1.25 * vn * nx) * 0.9; b.py = b.y - (vy - 1.25 * vn * ny) * 0.9; }
}

// run the sim from the start with a list of actions [{t, cut:ropeId} | {t, pop:bubbleIndex}] and report how it ended
export function run(lv, actions, maxT = 14) {
  const S = makeSim(lv), acts = [...actions].sort((p, q) => p.t - q.t); let k = 0;
  while (S.state === "play" && S.t < maxT) {
    while (k < acts.length && acts[k].t <= S.t + 1e-9) { const a = acts[k++]; if (a.cut != null) cutRope(S, a.cut); else popBubble(S, a.pop); }
    step(S);
    // a berry that has settled (nothing moves, nothing hangs) will never move again
    if (S.t > 2 && k >= acts.length && Math.abs(S.berry.x - S.berry.px) + Math.abs(S.berry.y - S.berry.py) < 1e-4 && S.berry.bubble < 0) break;
  }
  return S;
}
