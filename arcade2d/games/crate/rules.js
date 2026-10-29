// Crate Courier: the rules of the warehouse. Pure code, used by the game, the automatic solver and the tests.
// Push crates onto the glowing pads. Walls and other crates block a push. Ice makes a pushed crate slide until it hits something.
// A crate pushed into a hole fills it, and the hole becomes ordinary floor.
export const FLOOR = 0, WALL = 1, GOAL = 2, ICE = 3, HOLE = 4;
export const DIRS = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };
export const KEY_OF = { "0,-1": "U", "1,0": "R", "0,1": "D", "-1,0": "L" };

// map rows: # wall, space floor, . pad, ~ ice, o hole, $ crate, * crate on pad, @ courier, + courier on pad, % crate on ice
export function parseMap(rows) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), tile = new Uint8Array(w * h), crates = []; let hero = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x] || "#", i = y * w + x; let t = FLOOR;
    if (c === "#") t = WALL; else if (c === "." || c === "*" || c === "+") t = GOAL; else if (c === "~" || c === "%") t = ICE; else if (c === "o") t = HOLE;
    tile[i] = t;
    if (c === "$" || c === "*" || c === "%") crates.push(i);
    if (c === "@" || c === "+") hero = i;
  }
  const goals = []; for (let i = 0; i < tile.length; i++) if (tile[i] === GOAL) goals.push(i);
  return { w, h, tile, crates: crates.sort((a, b) => a - b), hero, goals, moves: 0, pushes: 0, ev: null };
}
export function cloneState(S) { return { ...S, tile: S.tile.slice(), crates: S.crates.slice(), ev: null }; }
export const key = (S) => S.hero + "|" + S.crates.join(",") + "|" + holesKey(S);
function holesKey(S) { let s = ""; for (let i = 0; i < S.tile.length; i++) if (S.tile[i] === HOLE) s += i + ","; return s; }
export const solved = (S) => S.goals.every((g) => S.crates.includes(g));

// try one move. Returns false (state untouched) if the courier cannot go that way. S.ev tells the game what happened.
export function step(S, dir) {
  const [dx, dy] = DIRS[dir], w = S.w, hx = S.hero % w, hy = (S.hero / w) | 0, tx = hx + dx, ty = hy + dy;
  if (tx < 0 || ty < 0 || tx >= w || ty >= S.h) return false;
  const t = ty * w + tx, tt = S.tile[t]; if (tt === WALL || tt === HOLE) return false;
  const ci = S.crates.indexOf(t); const ev = { from: S.hero, dir, push: null, fell: null };
  if (ci >= 0) {
    let px = tx + dx, py = ty + dy; if (px < 0 || py < 0 || px >= w || py >= S.h) return false;
    let p = py * w + px, pt = S.tile[p]; if (pt === WALL || S.crates.includes(p)) return false;
    const path = [t];
    // ice: keep sliding while the crate stands on ice and the next square is free
    let falls = false;
    for (;;) {
      path.push(p);
      if (S.tile[p] === HOLE) { falls = true; break; }
      if (S.tile[p] !== ICE) break;
      const nx = (p % w) + dx, ny = ((p / w) | 0) + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= S.h) break;
      const n = ny * w + nx; if (S.tile[n] === WALL || S.crates.includes(n)) break;
      p = n;
    }
    ev.push = { path, falls, to: p, crate: ci };
    if (falls) { S.crates.splice(ci, 1); S.tile[p] = FLOOR; ev.fell = p; } else { S.crates[ci] = p; S.crates.sort((a, b) => a - b); }
    S.pushes++;
  }
  S.hero = t; S.moves++; S.ev = ev; return true;
}

// ---- solver: breadth first search on (courier, crates, holes), fewest moves first ----
export function solve(S0, maxStates = 400000) {
  const S = cloneState(S0), startK = key(S); const seen = new Map([[startK, null]]); let frontier = [S]; const order = ["U", "R", "D", "L"];
  if (solved(S)) return "";
  const store = new Map([[startK, S]]); let count = 1;
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) {
      const ck = key(cur);
      for (const d of order) {
        const n = cloneState(cur); if (!step(n, d)) continue; const k = key(n); if (seen.has(k)) continue;
        seen.set(k, [ck, d]); if (solved(n)) { let path = d, kk = ck; while (seen.get(kk)) { const [pk, pd] = seen.get(kk); path = pd + path; kk = pk; } return path; }
        next.push(n); if (++count > maxStates) return null;
      }
    }
    frontier = next;
  }
  return null;
}
export function replay(S0, moves) { const S = cloneState(S0); for (const m of moves) if (!step(S, m)) return null; return S; }
