// Gem Garden: the automatic player. It looks at every legal swap, tries each one on a copy of the board and takes the one that helps the
// goals most. It is used to prove that every level can be finished, to set the star scores, and to play behind the title screen.
import { T } from "./board";

function crateHp(b) { let n = 0; for (const q of b.p) if (q && q.t === T.CRATE) n += q.hp; return n; }
function specials(b) { let n = 0; for (const q of b.p) if (q && (q.t === "lh" || q.t === "lv" || q.t === "bl" || q.t === "pr")) n += q.t === "pr" ? 3 : q.t === "bl" ? 2 : 1.5; return n; }
export function seedDepth(b) { let n = 0; for (let i = 0; i < b.p.length; i++) { const q = b.p[i]; if (q && q.t === T.SEED) { const x = i % b.cols, y = (i / b.cols) | 0; n += (y - b.top[x]) / Math.max(1, b.bot[x] - b.top[x]); } } return n; }

function weights(b) {
  const w = { score: 0.3, gem: [0, 0, 0, 0, 0, 0], soil: 40, crate: 0, hit: 0, seed: 0, depth: 0 };
  for (const g of b.lv.goals) {
    if (g.t === "score") w.score = 1;
    else if (g.t === "gem") w.gem[g.c] = 140;
    else if (g.t === "soil") w.soil = 240;
    else if (g.t === "crate") { w.crate = 500; w.hit = 110; }
    else if (g.t === "seed") { w.seed = 2500; w.depth = 1300; }
  }
  return w;
}

export function pickMove(board, noise = 0.1, salt = 0) {
  const ms = board.moveList(); if (!ms.length) return null;
  const w = weights(board), c0 = crateHp(board), s0 = specials(board), d0 = seedDepth(board);
  let best = null, bv = -1e9;
  for (let n = 0; n < ms.length; n++) {
    const m = ms[n], sim = board.clone((board.uid * 2654435761 + salt * 977 + n * 31 + 7) >>> 0);
    sim.trySwap(m[0], m[1], m[2], m[3]);
    let v = (sim.score - board.score) * w.score;
    for (let k = 0; k < 6; k++) if (w.gem[k]) { const need = board.lv.goals.filter((g) => g.t === "gem" && g.c === k).reduce((s, g) => s + Math.max(0, g.n - board.cnt.gem[k]), 0); v += Math.min(need, sim.cnt.gem[k] - board.cnt.gem[k]) * w.gem[k]; }
    v += (sim.cnt.soil - board.cnt.soil) * w.soil;
    v += (sim.cnt.crate - board.cnt.crate) * w.crate + (c0 - crateHp(sim)) * w.hit;
    v += (sim.cnt.seed - board.cnt.seed) * w.seed + (seedDepth(sim) - d0) * w.depth;
    const ds = specials(sim) - s0; if (ds > 0) v += ds * 90;
    v += Math.random() * noise * 60;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

// where to use the free hammer: on the last soil patch or crate, or when the moves are nearly gone
export function hammerSpot(b, stuck = 0) {
  if (b.hammers <= 0) return null;
  const wantSeed = b.lv.goals.some((g) => g.t === "seed") && b.cnt.seed < b.lv.goals.find((g) => g.t === "seed").n;
  if (wantSeed && stuck >= 3) {   // an acorn is not getting anywhere: smash the gem under the lowest one
    let best = -1;
    for (let i = 0; i < b.p.length; i++) { const q = b.p[i]; if (q && q.t === T.SEED) { const x = i % b.cols, y = (i / b.cols) | 0, below = y + 1 <= b.bot[x] ? b.p[(y + 1) * b.cols + x] : null; if (below && below.t === T.GEM && y > best) best = i; } }
    if (best >= 0) return [best % b.cols, ((best / b.cols) | 0) + 1];
  }
  const soilLeft = b.soilTotal - b.cnt.soil, crateLeft = b.crateTotal - b.cnt.crate;
  const wantSoil = b.lv.goals.some((g) => g.t === "soil") && soilLeft > 0, wantCrate = b.lv.goals.some((g) => g.t === "crate") && crateLeft > 0;
  if (!wantSoil && !wantCrate) return null;
  const late = b.moves <= 4, few = (wantSoil ? soilLeft : 0) + (wantCrate ? crateLeft : 0) <= 2;
  if (!late && !few) return null;
  for (let i = 0; i < b.p.length; i++) {
    const q = b.p[i]; if (!q || q.t === T.SEED) continue;
    if (wantSoil && b.soil[i] && q.t !== T.CRATE) return [i % b.cols, (i / b.cols) | 0];
    if (wantCrate && q.t === T.CRATE) return [i % b.cols, (i / b.cols) | 0];
  }
  return null;
}

// plays a whole level; returns how it went
export function playLevel(board, opts = {}) {
  const noise = opts.noise ?? 0.1; let guard = 0;
  let stuck = 0, last = seedDepth(board) + board.cnt.seed * 10;
  while (board.status() === "play" && guard++ < 200) {
    const h = opts.hammer === false ? null : hammerSpot(board, stuck);
    if (h) { board.hammer(h[0], h[1]); stuck = 0; last = seedDepth(board) + board.cnt.seed * 10; continue; }
    const m = pickMove(board, noise, guard); if (!m) break;
    board.trySwap(m[0], m[1], m[2], m[3]);
    const now = seedDepth(board) + board.cnt.seed * 10; if (now > last + 0.05) stuck = 0; else stuck++; last = now;
  }
  const st = board.status(), movesLeft = board.moves; let bonus = 0;
  if (st === "win" && !board.scoreOnly && board.moves > 0) { const s0 = board.score; board.finale(); bonus = board.score - s0; }
  return { status: st, score: board.score, movesUsed: board.movesUsed, movesLeft, bonus, cascadeMax: board.cascadeMax };
}

// plays a whole session (the same object the player uses) with the automatic player; only for sessions that finish moves at once (headless)
export function playSession(S, opts = {}) {
  const noise = opts.noise ?? 0.1; let guard = 0, stuck = 0, last = seedDepth(S.board) + S.board.cnt.seed * 10;
  while (!S.done && guard++ < 250) {
    const b = S.board, h = opts.hammer === false ? null : hammerSpot(b, stuck);
    if (h) { S.requestHammer(h[0], h[1]); stuck = 0; last = seedDepth(b) + b.cnt.seed * 10; continue; }
    const m = pickMove(b, noise, guard); if (!m) break;
    S.requestSwap(m[0], m[1], m[2], m[3]);
    const now = seedDepth(b) + b.cnt.seed * 10; if (now > last + 0.05) stuck = 0; else stuck++; last = now;
  }
  return S.done;
}
