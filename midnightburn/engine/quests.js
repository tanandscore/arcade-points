// Midnight Burn — post-race quests. When a race ends the rivals leave
// and the map becomes a free-roam playground with three quests built
// for that particular road. Quest placement is computed from the real
// track shape (speed traps go on the longest straights, drift zones on
// the tightest bends), so every map gets its own set.
//
// Pure logic, no DOM and no three.js, so it is testable headlessly.
import { sampleTrack, wrapDelta, wrapS } from "./physics.js";

const KMH_HUD = 3.6 * 1.1; // same factor the speedometer uses

function kAbsAt(track, s) {
  return Math.abs(sampleTrack(track, s).k);
}

// Best window of the lap (inside [fromFrac, toFrac]) by a score function.
function bestWindow(track, fromFrac, toFrac, len, scoreFn, step = 12) {
  let best = null;
  for (let s = track.L * fromFrac; s + len < track.L * toFrac; s += step) {
    const sc = scoreFn(s);
    if (!best || sc > best.sc) best = { s, sc };
  }
  return best ? best.s : track.L * fromFrac;
}

function meanK(track, s0, len, n = 12) {
  let sum = 0;
  for (let i = 0; i <= n; i++) sum += kAbsAt(track, s0 + (len * i) / n);
  return sum / (n + 1);
}
function maxK(track, s0, len, n = 24) {
  let m = 0;
  for (let i = 0; i <= n; i++) m = Math.max(m, kAbsAt(track, s0 + (len * i) / n));
  return m;
}

// Which three quests each map offers, in lap order. thresholds are
// tuned for a stock car with a few upgrades; nitrous helps on all.
const PLANS = {
  harbor:    [["speed", 200], ["drift", 350], ["gates", 5]],
  downtown:  [["near", 6], ["drift", 450], ["gates", 6]],
  foundry:   [["speed", 220], ["near", 5], ["drift", 500]],
  neonstrip: [["speed", 240], ["gates", 7], ["near", 7]],
  ridge:     [["gates", 6], ["drift", 550], ["speed", 185]],
  eclipse:   [["speed", 230], ["near", 8], ["drift", 600]],
};

export function questsFor(track, mapIndex = 0) {
  const plan = PLANS[track.def.id] || PLANS.harbor;
  const L = track.L;
  const thirds = [[0.08, 0.34], [0.37, 0.64], [0.67, 0.93]];
  const bonus = mapIndex * 100;
  const out = [];
  plan.forEach(([type, target], i) => {
    const [f0, f1] = thirds[i];
    const id = `${track.def.id}-q${i + 1}`;
    if (type === "speed") {
      // longest, straightest approach: low curvature for 320m before the gate
      const s = bestWindow(track, f0, f1, 330, (s0) => -maxK(track, s0, 330), 10) + 320;
      out.push({
        id, type, s: wrapS(track, s), target,
        title: "Speed Trap",
        desc: `Blast through the glowing trap doing ${target} km/h or more.`,
        reward: { cash: 500 + bonus, pts: 500 + bonus },
      });
    } else if (type === "drift") {
      const len = 300;
      const s0 = bestWindow(track, f0, f1, len, (s) => meanK(track, s, len), 8);
      out.push({
        id, type, s0: wrapS(track, s0), len, target,
        title: "Drift Zone",
        desc: `Score ${target} drift points between the two pink gates, in one go, without hitting anything.`,
        reward: { cash: 700 + bonus, pts: 700 + bonus },
      });
    } else if (type === "gates") {
      const spacing = 130;
      const n = target;
      const s0 = bestWindow(track, f0, f1, spacing * (n + 1), (s) => -meanK(track, s, spacing * (n + 1), 10), 15);
      const gates = [];
      for (let g = 0; g < n; g++) {
        gates.push({ s: wrapS(track, s0 + 30 + g * spacing), d: (g % 2 ? 1 : -1) * track.halfW * 0.34 });
      }
      const dist = spacing * (n - 1);
      const limit = Math.round((dist / 38) * 10) / 10 + 1.5; // seconds from the first gate
      out.push({
        id, type, gates, limit, target: n,
        title: "Gate Run",
        desc: `Thread all ${n} cyan gates, in order, within ${limit.toFixed(1)} s of the first one.`,
        reward: { cash: 800 + bonus, pts: 800 + bonus },
      });
    } else if (type === "near") {
      out.push({
        id, type, target,
        title: "Traffic Weaver",
        desc: `Pull ${target} near misses in a row without crashing.`,
        reward: { cash: 600 + bonus, pts: 600 + bonus },
      });
    }
  });
  return out;
}

export function newQuestState(defs, alreadyDone = []) {
  return defs.map((def) => ({
    def,
    done: alreadyDone.includes(def.id),
    prog: 0,
    // gate runs: index of the next gate to hit, and the clock
    next: 0, clock: 0, running: false,
    lastRel: null, tainted: false, flash: null,
  }));
}

// One simulation step. ctx = { t, player, kmh, driftGain, near, crashed }
// Returns events: {kind: "complete"|"miss"|"progress", q, text}
export function stepQuests(track, states, ctx) {
  const ev = [];
  const p = ctx.player;
  for (const q of states) {
    if (q.done) continue;
    const d = q.def;
    if (d.type === "speed") {
      const rel = wrapDelta(track, p.s - d.s);
      if (q.lastRel !== null && q.lastRel < 0 && rel >= 0 && Math.abs(q.lastRel) < 25) {
        const kmh = Math.round(p.v * KMH_HUD);
        if (kmh >= d.target) { q.done = true; ev.push({ kind: "complete", q, text: `${kmh} KM/H` }); }
        else ev.push({ kind: "miss", q, text: `TOO SLOW  ${kmh}/${d.target}` });
      }
      q.lastRel = rel;
    } else if (d.type === "drift") {
      const rel = wrapDelta(track, p.s - d.s0);
      const inside = rel >= 0 && rel <= d.len;
      if (inside) {
        if (ctx.crashed) { q.prog = 0; q.tainted = true; }
        if (!q.tainted) q.prog += ctx.driftGain;
        if (q.prog >= d.target) { q.done = true; ev.push({ kind: "complete", q, text: `${Math.round(q.prog)} PTS` }); }
      } else {
        if (q.prog > 0 && q.lastRel !== null && q.lastRel >= 0 && q.lastRel <= d.len) {
          ev.push({ kind: "miss", q, text: `ZONE ENDED  ${Math.round(q.prog)}/${d.target}` });
        }
        q.prog = 0; q.tainted = false;
      }
      q.lastRel = rel;
    } else if (d.type === "near") {
      if (ctx.crashed && q.prog > 0) { ev.push({ kind: "miss", q, text: "CHAIN BROKEN" }); q.prog = 0; }
      if (ctx.near) {
        q.prog += 1;
        if (q.prog >= d.target) { q.done = true; ev.push({ kind: "complete", q, text: `${q.prog} IN A ROW` }); }
        else ev.push({ kind: "progress", q, text: `${q.prog}/${d.target}` });
      }
    } else if (d.type === "gates") {
      if (q.running) {
        q.clock += ctx.dt;
        if (q.clock > d.limit) {
          q.running = false; q.next = 0; q.clock = 0;
          ev.push({ kind: "miss", q, text: "TOO SLOW" });
        }
      }
      // check crossing of any gate near the player
      for (let gi = 0; gi < d.gates.length; gi++) {
        const g = d.gates[gi];
        const rel = wrapDelta(track, p.s - g.s);
        const key = "lr" + gi;
        const last = q[key];
        q[key] = rel;
        if (last === undefined || !(last < 0 && rel >= 0 && Math.abs(last) < 25)) continue;
        const hit = Math.abs(p.d - g.d) < 4.6;
        if (gi === 0) {
          if (hit) { q.running = true; q.clock = 0; q.next = 1; ev.push({ kind: "progress", q, text: `GATE 1/${d.gates.length}` }); }
        } else if (q.running && gi === q.next) {
          if (hit) {
            q.next = gi + 1;
            if (q.next >= d.gates.length) { q.done = true; q.running = false; ev.push({ kind: "complete", q, text: `${q.clock.toFixed(1)} S` }); }
            else ev.push({ kind: "progress", q, text: `GATE ${gi + 1}/${d.gates.length}` });
          } else {
            q.running = false; q.next = 0; q.clock = 0;
            ev.push({ kind: "miss", q, text: "GATE MISSED" });
          }
        }
      }
    }
  }
  return ev;
}

// Short text for the quest log.
export function questLine(q) {
  const d = q.def;
  if (q.done) return { title: d.title, text: "COMPLETE", frac: 1 };
  if (d.type === "speed") return { title: d.title, text: `${d.target}+ km/h`, frac: 0 };
  if (d.type === "drift") return { title: d.title, text: `${Math.round(q.prog)}/${d.target}`, frac: Math.min(1, q.prog / d.target) };
  if (d.type === "near") return { title: d.title, text: `${q.prog}/${d.target} in a row`, frac: q.prog / d.target };
  if (d.type === "gates") {
    return q.running
      ? { title: d.title, text: `${q.next}/${d.target}  ${(d.limit - q.clock).toFixed(1)}s`, frac: q.next / d.target }
      : { title: d.title, text: `${d.target} gates / ${d.limit.toFixed(1)}s`, frac: 0 };
  }
  return { title: d.title, text: "", frac: 0 };
}
