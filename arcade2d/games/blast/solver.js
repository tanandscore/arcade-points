// Blast Grid: the automatic solver. It tries move sequences, always continuing with the most promising one (few turns, few bombs, close to the
// remaining gems, bots and door), until the level is won with every gem collected. It proves each level can be finished, sets the "par"
// for the 3rd star and plays behind the title screen.
import { parseMap, cloneState, step, key, botsAlive, doorOpen, CRATE } from "./rules";

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(f, v) { const a = this.a; a.push([f, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; }
}

function heur(S) {
  const gl = S.gemsTotal - S.gemsGot, ba = botsAlive(S);
  let near = 1e9;
  if (gl > 0) { for (let i = 0; i < S.gem.length; i++) if (S.gem[i]) { const d = Math.abs((i % S.w) - S.player.x) + Math.abs(((i / S.w) | 0) - S.player.y); if (d < near) near = d; } }
  else near = Math.abs((S.exit % S.w) - S.player.x) + Math.abs(((S.exit / S.w) | 0) - S.player.y);
  let crates = 0; for (let i = 0; i < S.tile.length; i++) if (S.tile[i] === CRATE) crates++;
  return gl * 6 + ba * 9 + near * 0.8 + crates * 0.15;
}

export function solve(lv, { maxStates = 400000, needGems = true, maxTurns = 120, w = 1.6 } = {}) {
  const S0 = parseMap(lv), seen = new Set(), heap = new Heap();
  const moving = S0.bots.some((b) => b.t !== "z");
  heap.push(0, [S0, ""]); seen.add(key(S0));
  let n = 0;
  while (heap.size && n < maxStates) {
    const [S, path] = heap.pop(); n++;
    for (const act of ["R", "D", "L", "U", "B", "W"]) {
      if (act === "W" && !moving && !S.bombs.length) continue;
      const T = cloneState(S);
      if (!step(T, act)) continue;
      if (T.status === "dead" || T.turn > maxTurns) continue;
      if (T.status === "won") { if (!needGems || T.gemsGot >= T.gemsTotal) return { actions: path + act, bombs: T.bombsUsed, turns: T.turn, states: n, S: T }; continue; }
      if (T.supply === 0 && !T.bombs.length && !doorOpen(T)) { const needBomb = botsAlive(T) > 0 || T.tile[T.exit] === CRATE; if (needBomb) continue; }
      const k = key(T); if (seen.has(k)) continue; seen.add(k);
      heap.push(T.turn + T.bombsUsed * 3 + w * heur(T), [T, path + act]);
    }
  }
  return null;
}

// replay a recorded answer on a fresh copy of the level (used by the tests)
export function replay(lv, actions) {
  const S = parseMap(lv);
  for (const a of actions) { if (!step(S, a)) return { ok: false, S }; if (S.status === "dead") return { ok: false, S }; }
  return { ok: S.status === "won", S };
}
