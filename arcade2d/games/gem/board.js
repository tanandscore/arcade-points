// Gem Garden: the rules of the board. Plain logic with no canvas, so the game, the hint and the automatic player all use the same code.
//
// A board is a grid of cells. A cell is a hole ("#"), a plain cell, or a plain cell with soil under it. Pieces sit on the cells:
//   g   a gem of one colour (0..5)        lh / lv  a line gem (clears its row / its column)      bl  a blast gem (clears 3 x 3)
//   pr  a prism (clears one colour)       cr  a crate (the match you make next to it chips it)    sd  a seed (has to reach the bottom)
// Every move is returned as a list of "phases" (swap, clear, fall, collect, shuffle ...) so the screen can play it out step by step,
// while the board itself already holds the final result.

export const T = { GEM: "g", LH: "lh", LV: "lv", BLAST: "bl", PRISM: "pr", CRATE: "cr", SEED: "sd" };
const isM = (q) => !!q && q.k >= 0 && (q.t === "g" || q.t === "lh" || q.t === "lv" || q.t === "bl");
const isLine = (t) => t === "lh" || t === "lv";
const isSpecialT = (t) => t === "lh" || t === "lv" || t === "bl";
// points (each is multiplied by the chain level, 1 to 5)
const PTS = { gem: 15, special: 40, extra: 30, made: 40, fired: 25, bloom: 20, crate: 80, seed: 200, move: 50 };

// A small random number generator whose state can be copied (the automatic player tries moves on copies of the board).
class Rand {
  constructor(s) { this.s = s >>> 0; }
  next() { const a = (this.s = (this.s + 0x6d2b79f5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
}

export class Board {
  constructor(lv, seed = 1) {
    this.lv = lv; const cols = (this.cols = lv.cols), rows = (this.rows = lv.rows); this.nc = lv.colors;
    this.rand = new Rand(seed * 7919 + 13); this.rec = true; this.uid = 1;
    const N = cols * rows; this.vd = new Uint8Array(N); this.soil = new Uint8Array(N); this.p = new Array(N).fill(null);
    this.layout = lv.layout || Array.from({ length: rows }, () => ".".repeat(cols));
    this.moves = lv.moves; this.movesUsed = 0; this.hammers = lv.hammers ?? 1; this.score = 0; this.cascadeMax = 0;
    this.cnt = { gem: [0, 0, 0, 0, 0, 0], soil: 0, crate: 0, seed: 0 }; this.chipped = new Set();
    this.soilTotal = 0; this.crateTotal = 0; this.seedSpawned = 0;
    this.top = new Array(cols).fill(-1); this.bot = new Array(cols).fill(-1);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = this.layout[y][x], i = y * cols + x;
      if (ch === "#") this.vd[i] = 1; else if (ch === "s") { this.soil[i] = 1; this.soilTotal++; }
      else if (ch === "c" || ch === "C" || ch === "K") this.crateTotal++;
    }
    // every column has to be one unbroken stretch of cells, so that things can fall down it
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) if (!this.vd[y * cols + x]) { if (this.top[x] < 0) this.top[x] = y; this.bot[x] = y; }
      for (let y = Math.max(0, this.top[x]); y <= this.bot[x]; y++) if (this.vd[y * cols + x]) throw new Error(`Gem Garden ${lv.id}: column ${x} has a hole in the middle`);
    }
    this.scoreOnly = lv.goals.every((g) => g.t === "score");
    this.fillStart();
  }

  mk(t, k, hp = 0) { return { id: this.uid++, t, k, hp, max: hp }; }
  at(x, y) { return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? null : this.p[y * this.cols + x]; }
  sameK(x, y, k) { const r = this.at(x, y); return isM(r) && r.k === k; }
  wouldMatch(x, y, k) { const a = this.at(x - 1, y), b = this.at(x - 2, y), c = this.at(x, y - 1), d = this.at(x, y - 2); return (isM(a) && isM(b) && a.k === k && b.k === k) || (isM(c) && isM(d) && c.k === k && d.k === k); }

  fillStart() {
    const { cols, rows } = this;
    for (let tries = 0; tries < 400; tries++) {
      this.p.fill(null); this.seedSpawned = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x; if (this.vd[i]) continue; const ch = this.layout[y][x];
        if (ch === "c" || ch === "C" || ch === "K") { this.p[i] = this.mk(T.CRATE, -1, ch === "K" ? 3 : ch === "C" ? 2 : 1); continue; }
        if (ch === "a") { this.p[i] = this.mk(T.SEED, -1); this.seedSpawned++; continue; }
        let k, guard = 0; do { k = this.rand.int(0, this.nc - 1); guard++; } while (guard < 30 && this.wouldMatch(x, y, k));
        this.p[i] = this.mk(T.GEM, k);
      }
      if (!this.findGroups().length && this.hasMove()) break;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- looking for matches
  findGroups(pref) {
    const { cols, rows } = this, runs = [];
    for (let y = 0; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        const q = this.p[y * cols + x]; if (!isM(q)) { x++; continue; }
        let e = x + 1; while (e < cols) { const r = this.p[y * cols + e]; if (isM(r) && r.k === q.k) e++; else break; }
        if (e - x >= 3) { const cells = []; for (let c = x; c < e; c++) cells.push(y * cols + c); runs.push({ h: true, k: q.k, cells }); }
        x = e;
      }
    }
    for (let x = 0; x < cols; x++) {
      let y = 0;
      while (y < rows) {
        const q = this.p[y * cols + x]; if (!isM(q)) { y++; continue; }
        let e = y + 1; while (e < rows) { const r = this.p[e * cols + x]; if (isM(r) && r.k === q.k) e++; else break; }
        if (e - y >= 3) { const cells = []; for (let c = y; c < e; c++) cells.push(c * cols + x); runs.push({ h: false, k: q.k, cells }); }
        y = e;
      }
    }
    if (!runs.length) return [];
    // runs that share a cell (an L, a T or a plus) are one group
    const par = runs.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))), seen = new Map();
    runs.forEach((r, i) => { for (const c of r.cells) { if (seen.has(c)) par[find(i)] = find(seen.get(c)); else seen.set(c, i); } });
    const by = new Map();
    runs.forEach((r, i) => { const root = find(i); if (!by.has(root)) by.set(root, { k: r.k, runs: [], cells: new Set() }); const g = by.get(root); g.runs.push(r); for (const c of r.cells) g.cells.add(c); });
    const groups = [...by.values()]; for (const g of groups) this.planSpecial(g, pref); return groups;
  }
  planSpecial(g, pref) {
    let maxLen = 0, hasH = false, hasV = false; for (const r of g.runs) { maxLen = Math.max(maxLen, r.cells.length); if (r.h) hasH = true; else hasV = true; }
    g.special = null; g.pivot = -1;
    const pick = (fallback) => { if (pref) for (const c of pref) if (g.cells.has(c)) return c; return fallback; };
    if (maxLen >= 5) { const r = g.runs.find((q) => q.cells.length >= 5); g.special = T.PRISM; g.pivot = pick(r.cells[(r.cells.length / 2) | 0]); }
    else if (hasH && hasV) {
      const hc = new Set(); for (const r of g.runs) if (r.h) for (const c of r.cells) hc.add(c);
      let inter = -1; for (const r of g.runs) if (!r.h) for (const c of r.cells) if (hc.has(c) && inter < 0) inter = c;
      g.special = T.BLAST; g.pivot = pick(inter);
    } else if (maxLen === 4) { const r = g.runs.find((q) => q.cells.length === 4); g.special = r.h ? T.LV : T.LH; g.pivot = pick(r.cells[1]); }
  }

  // ---------------------------------------------------------------------------------------------------------------- valid moves
  runAt(x, y) {
    const q = this.at(x, y); if (!isM(q)) return false;
    let n = 1; for (let c = x - 1; this.sameK(c, y, q.k); c--) n++; for (let c = x + 1; this.sameK(c, y, q.k); c++) n++; if (n >= 3) return true;
    n = 1; for (let c = y - 1; this.sameK(x, c, q.k); c--) n++; for (let c = y + 1; this.sameK(x, c, q.k); c++) n++; return n >= 3;
  }
  comboOf(pa, pb) {
    if (pa.t === T.PRISM && pb.t === T.PRISM) return "pp";
    if (pa.t === T.PRISM) return pb.k >= 0 ? "pg" : null;
    if (pb.t === T.PRISM) return pa.k >= 0 ? "pg" : null;
    if (isSpecialT(pa.t) && isSpecialT(pb.t)) return "ss";
    return null;
  }
  canSwap(ax, ay, bx, by) {
    const { cols, rows } = this;
    if (ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= cols || bx >= cols || ay >= rows || by >= rows) return false;
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return false;
    const ia = ay * cols + ax, ib = by * cols + bx, pa = this.p[ia], pb = this.p[ib];
    if (!pa || !pb || pa.t === T.CRATE || pb.t === T.CRATE) return false;
    if (this.comboOf(pa, pb)) return true;
    // an acorn can always be swapped with the gem right under it, so it can never get stuck
    if ((pa.t === T.SEED && ay + 1 === by && pb.t !== T.SEED && pb.t !== T.PRISM) || (pb.t === T.SEED && by + 1 === ay && pa.t !== T.SEED && pa.t !== T.PRISM)) return true;
    if (pa.t === T.PRISM || pb.t === T.PRISM) return false;
    this.p[ia] = pb; this.p[ib] = pa; const ok = this.runAt(ax, ay) || this.runAt(bx, by); this.p[ia] = pa; this.p[ib] = pb; return ok;
  }
  moveList(firstOnly = false) {
    const { cols, rows } = this, out = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (this.vd[y * cols + x]) continue;
      if (x + 1 < cols && this.canSwap(x, y, x + 1, y)) { out.push([x, y, x + 1, y]); if (firstOnly) return out; }
      if (y + 1 < rows && this.canSwap(x, y, x, y + 1)) { out.push([x, y, x, y + 1]); if (firstOnly) return out; }
    }
    return out;
  }
  hasMove() { return this.moveList(true).length > 0; }
  // the move that clears the most right away (used for the hint)
  bestHint(rand = Math.random) {
    const ms = this.moveList(); if (!ms.length) return null; let best = null, bv = -1;
    for (const m of ms) {
      const ia = m[1] * this.cols + m[0], ib = m[3] * this.cols + m[2], pa = this.p[ia], pb = this.p[ib]; let v = 0;
      if (this.comboOf(pa, pb)) v = 60; else { this.p[ia] = pb; this.p[ib] = pa; for (const g of this.findGroups()) v += g.cells.size * 2 + (g.special ? 8 : 0); this.p[ia] = pa; this.p[ib] = pb; }
      v += rand() * 0.5; if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------------------------------------------- making a move
  trySwap(ax, ay, bx, by) {
    if (!this.canSwap(ax, ay, bx, by)) return null;
    const { cols } = this, ia = ay * cols + ax, ib = by * cols + bx, pa = this.p[ia], pb = this.p[ib];
    const out = [{ kind: "swap", ax, ay, bx, by, ida: pa.id, idb: pb.id }];
    this.moves--; this.movesUsed++; this.chipped = new Set();
    const combo = this.comboOf(pa, pb); this.p[ia] = pb; this.p[ib] = pa;
    if (combo) { const first = this.comboFirst(combo, pa, pb, ia, ib); out.push(...this.settle(first, null, "combo")); }
    else out.push(...this.settle(null, [ia, ib], "swap"));
    const sh = this.unstick(); if (sh) out.push(sh);
    return out;
  }
  // after a swap pa sits at ib and pb at ia
  comboFirst(kind, pa, pb, ia, ib) {
    const { cols } = this, cells = new Set([ia, ib]), used = new Set(), triggers = [], conv = [], cx = ib % cols, cy = (ib / cols) | 0;
    if (kind === "ss") {
      used.add(ia); used.add(ib);
      const nb = (pa.t === "bl" ? 1 : 0) + (pb.t === "bl" ? 1 : 0);
      triggers.push(nb === 2 ? { t: "area", x: cx, y: cy, r: 2 } : nb === 1 ? { t: "cross3", x: cx, y: cy } : { t: "cross", x: cx, y: cy });
    } else if (kind === "pp") {
      used.add(ia); used.add(ib);
      for (let i = 0; i < this.p.length; i++) { const q = this.p[i]; if (q && q.t !== T.SEED && q.t !== T.CRATE) cells.add(i); }
      triggers.push({ t: "allCrates" }, { t: "storm", x: cx, y: cy });
    } else {
      const prismAtA = pa.t === T.PRISM, pr = prismAtA ? pa : pb, other = prismAtA ? pb : pa, prI = prismAtA ? ib : ia;
      used.add(prI); let n = 0;
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i]; if (!isM(q) || q.k !== other.k) continue; cells.add(i);
        if (other.t !== T.GEM && q.t === T.GEM) { q.t = other.t === "bl" ? "bl" : (n++ % 2 ? "lh" : "lv"); conv.push({ id: q.id, x: i % cols, y: (i / cols) | 0, t: q.t }); }
      }
      triggers.push({ t: "prism", x: prI % cols, y: (prI / cols) | 0, k: other.k, id: pr.id });
    }
    return { cells, triggers, used, conv };
  }

  hammer(x, y) {
    const i = y * this.cols + x, q = this.p[i];
    if (this.hammers <= 0 || !q || q.t === T.SEED) return null;
    this.hammers--; this.chipped = new Set();
    const first = q.t === T.CRATE ? { cells: new Set(), triggers: [{ t: "hit", i }] } : { cells: new Set([i]), triggers: [] };
    const out = this.settle(first, null, "hammer"); const sh = this.unstick(); if (sh) out.push(sh); return out;
  }

  // everything that happens after the player's move, until the board is calm again
  settle(first, pref, cause) {
    const out = []; let cascade = 0, job = first || null, drained = !!first;
    for (let guard = 0; guard < 60; guard++) {
      if (!job) {
        const groups = this.findGroups(cascade === 0 ? pref : null);
        if (!groups.length) { if (!drained) { drained = true; this.drain(out); continue; } break; }   // a plain swap with no match (an acorn stepping down) may still drop an acorn
        job = { groups };
      }
      const ph = this.doClear(job, cascade, cause); job = null; out.push(ph);
      this.drain(out); cascade++;
    }
    return out;
  }

  // works out the full set of cells to clear: the starting cells plus whatever the special gems in them set off
  expand(clear, triggers, used) {
    const { cols, rows } = this, effects = [], crateHit = new Set(), fired = new Set(used || []), queue = [...clear];
    const add = (x, y) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return; const i = y * cols + x, q = this.p[i]; if (!q) return;
      if (q.t === T.CRATE) { crateHit.add(i); return; } if (q.t === T.SEED) return;
      if (!clear.has(i)) { clear.add(i); queue.push(i); }
    };
    const row = (y) => { for (let x = 0; x < cols; x++) add(x, y); }, col = (x) => { for (let y = 0; y < rows; y++) add(x, y); };
    for (const t of triggers) {
      if (t.t === "cross") { row(t.y); col(t.x); effects.push({ t: "cross", x: t.x, y: t.y, w: 1 }); }
      else if (t.t === "cross3") { for (let d = -1; d <= 1; d++) { row(t.y + d); col(t.x + d); } effects.push({ t: "cross", x: t.x, y: t.y, w: 3 }); }
      else if (t.t === "area") { for (let dy = -t.r; dy <= t.r; dy++) for (let dx = -t.r; dx <= t.r; dx++) add(t.x + dx, t.y + dy); effects.push({ t: "blast", x: t.x, y: t.y, r: t.r }); }
      else if (t.t === "allCrates") { for (let i = 0; i < this.p.length; i++) if (this.p[i] && this.p[i].t === T.CRATE) crateHit.add(i); }
      else if (t.t === "storm") effects.push({ t: "storm", x: t.x, y: t.y });
      else if (t.t === "hit") crateHit.add(t.i);
      else if (t.t === "prism") { const tg = []; for (const i of clear) { const q = this.p[i]; if (q && q.k === t.k && i !== t.y * cols + t.x) tg.push(i); } effects.push({ t: "prism", x: t.x, y: t.y, k: t.k, targets: tg }); }
    }
    while (queue.length) {
      const i = queue.pop(); if (fired.has(i)) continue; const q = this.p[i]; if (!q) continue; const x = i % cols, y = (i / cols) | 0;
      if (q.t === T.LH) { fired.add(i); effects.push({ t: "row", x, y }); row(y); }
      else if (q.t === T.LV) { fired.add(i); effects.push({ t: "col", x, y }); col(x); }
      else if (q.t === T.BLAST) { fired.add(i); effects.push({ t: "blast", x, y, r: 1 }); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(x + dx, y + dy); }
      else if (q.t === T.PRISM) {
        fired.add(i); const k = this.dominant(), tg = [];
        for (let j = 0; j < this.p.length; j++) { const r = this.p[j]; if (isM(r) && r.k === k && !clear.has(j)) { add(j % cols, (j / cols) | 0); tg.push(j); } }
        effects.push({ t: "prism", x, y, k, targets: tg });
      }
    }
    return { effects, crateHit, fired };
  }
  dominant() { const n = [0, 0, 0, 0, 0, 0]; for (const q of this.p) if (isM(q)) n[q.k]++; let b = 0; for (let k = 1; k < this.nc; k++) if (n[k] > n[b]) b = k; return b; }

  doClear(job, cascade, cause) {
    const { cols } = this, clear = new Set(job.cells || []), groups = job.groups || [];
    for (const g of groups) for (const c of g.cells) clear.add(c);
    const info = this.expand(clear, job.triggers || [], job.used || null);
    const mult = Math.min(cascade + 1, 5); let pts = 0;
    for (const i of clear) pts += (this.p[i].t === T.GEM ? PTS.gem : PTS.special) * mult;
    for (const g of groups) { const n = g.cells.size; if (n >= 4) pts += (n - 3) * PTS.extra * mult; if (g.special) pts += PTS.made; }
    pts += info.fired.size * PTS.fired;
    const cells = [], blooms = [];
    for (const i of clear) {
      const q = this.p[i]; if (q.k >= 0) this.cnt.gem[q.k]++;
      if (this.soil[i]) { this.soil[i] = 0; this.cnt.soil++; pts += PTS.bloom; blooms.push({ x: i % cols, y: (i / cols) | 0 }); }
      cells.push({ id: q.id, x: i % cols, y: (i / cols) | 0, k: q.k, t: q.t });
    }
    // crates: matches next to them chip them, special gems smash them outright
    const hurt = new Map();
    if (cascade === 0) for (const i of clear) {
      const x = i % cols, y = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows) continue; const n = ny * cols + nx, q = this.p[n]; if (q && q.t === T.CRATE && !hurt.has(n)) hurt.set(n, q.hp - 1); }
    }
    for (const n of info.crateHit) hurt.set(n, 0);
    const crates = [];
    for (const [n, hp] of hurt) {
      const q = this.p[n]; q.hp = Math.max(0, hp); const broke = q.hp <= 0;
      if (broke) { this.cnt.crate++; pts += PTS.crate; }
      crates.push({ id: q.id, x: n % cols, y: (n / cols) | 0, hp: q.hp, max: q.max, broke });
    }
    for (const i of clear) this.p[i] = null;
    for (const n of hurt.keys()) if (this.p[n] && this.p[n].hp <= 0) this.p[n] = null;
    const spawns = [];
    for (const g of groups) if (g.special && g.pivot >= 0) {
      const q = this.mk(g.special, g.special === T.PRISM ? -1 : g.k); this.p[g.pivot] = q;
      spawns.push({ x: g.pivot % cols, y: (g.pivot / cols) | 0, id: q.id, t: q.t, k: q.k });
    }
    pts = Math.round(pts / 10) * 10; this.score += pts; if (cascade > this.cascadeMax) this.cascadeMax = cascade;
    return { kind: "clear", cause, cascade, cells, spawns, blooms, crates, effects: info.effects, conv: job.conv || [], groups: groups.map((g) => ({ n: g.cells.size, special: g.special })), pts, snap: this.snap() };
  }

  // ---------------------------------------------------------------------------------------------------------------- falling and refilling
  drain(out) {
    for (let g = 0; g < 40; g++) {
      const f = this.gravity(); if (f.moves.length || f.news.length) out.push(f);
      const got = this.collect(); if (!got) break; out.push(got);
    }
  }
  gravity() {
    const { cols } = this, moves = [], news = [];
    for (let x = 0; x < cols; x++) {
      const t = this.top[x], b = this.bot[x]; if (t < 0) continue;
      let w = b;
      for (let y = b; y >= t; y--) { const q = this.p[y * cols + x]; if (q) { if (y !== w) { this.p[w * cols + x] = q; this.p[y * cols + x] = null; moves.push({ id: q.id, x, y0: y, y1: w }); } w--; } }
      for (let y = w; y >= t; y--) { const q = this.spawnPiece(y === t, x, y); this.p[y * cols + x] = q; news.push({ id: q.id, t: q.t, k: q.k, hp: q.hp, x, y0: 2 * t - 1 - y, y1: y }); }
    }
    return { kind: "fall", moves, news };
  }
  spawnPiece(isTop, x, y) {
    const L = this.lv.seeds;
    if (L && isTop && this.seedSpawned < L.total && this.countSeeds() < (L.max ?? 2) && this.rand.next() < (L.p ?? 0.3)) { this.seedSpawned++; return this.mk(T.SEED, -1); }
    return this.mk(T.GEM, this.pickColor(x, y));
  }
  // New gems are mostly chosen so they do not line up by themselves (otherwise whole screens clear without you doing anything)
  pickColor(x, y) {
    let k = this.rand.int(0, this.nc - 1), bad = -1, bad2 = -1;
    const b1 = this.at(x, y + 1), b2 = this.at(x, y + 2); if (isM(b1) && isM(b2) && b1.k === b2.k) bad = b1.k;
    const l1 = this.at(x - 1, y), l2 = this.at(x - 2, y); if (isM(l1) && isM(l2) && l1.k === l2.k) bad2 = l1.k;
    if ((k === bad || k === bad2) && this.rand.next() < (this.lv.avoid ?? 0.85)) { for (let t = 0; t < 10 && (k === bad || k === bad2); t++) k = this.rand.int(0, this.nc - 1); }
    return k;
  }
  countSeeds() { let n = 0; for (const q of this.p) if (q && q.t === T.SEED) n++; return n; }
  collect() {
    const { cols } = this, seeds = [];
    for (let x = 0; x < cols; x++) {
      if (this.bot[x] < 0) continue; const i = this.bot[x] * cols + x, q = this.p[i];
      if (q && q.t === T.SEED) { this.p[i] = null; this.cnt.seed++; this.score += PTS.seed; seeds.push({ id: q.id, x, y: this.bot[x] }); }
    }
    return seeds.length ? { kind: "collect", seeds, pts: PTS.seed * seeds.length, snap: this.snap() } : null;
  }

  // no move left? mix the gems up (the specials, crates and seeds stay where they are)
  unstick() {
    if (this.hasMove()) return null;
    const { cols } = this, idxs = [], pcs = [];
    for (let i = 0; i < this.p.length; i++) { const q = this.p[i]; if (q && q.t === T.GEM) { idxs.push(i); pcs.push(q); } }
    if (idxs.length < 4) return null;
    const from = new Map(idxs.map((ix, n) => [pcs[n].id, ix]));
    for (let tries = 0; tries < 200; tries++) {
      for (let i = pcs.length - 1; i > 0; i--) { const j = this.rand.int(0, i); const tmp = pcs[i]; pcs[i] = pcs[j]; pcs[j] = tmp; }
      idxs.forEach((ix, n) => { this.p[ix] = pcs[n]; });
      if (!this.findGroups().length && this.hasMove()) break;
      if (tries === 199) { // could not find a layout by shuffling: give the gems new colours until there is a move
        for (let r = 0; r < 300; r++) { idxs.forEach((ix) => { const x = ix % cols, y = (ix / cols) | 0; let k, g = 0; do { k = this.rand.int(0, this.nc - 1); g++; } while (g < 30 && this.wouldMatch(x, y, k)); this.p[ix].k = k; }); if (!this.findGroups().length && this.hasMove()) break; }
      }
    }
    const moves = []; idxs.forEach((ix) => { const q = this.p[ix], f = from.get(q.id); moves.push({ id: q.id, x0: f % cols, y0: (f / cols) | 0, x1: ix % cols, y1: (ix / cols) | 0, k: q.k }); });
    return { kind: "shuffle", moves, snap: this.snap() };
  }

  // ---------------------------------------------------------------------------------------------------------------- goals
  snap() { return { score: this.score, moves: this.moves, hammers: this.hammers, gem: this.cnt.gem.slice(), soil: this.soilTotal - this.cnt.soil, crate: this.crateTotal - this.cnt.crate, seed: this.cnt.seed }; }
  progress() {
    return this.lv.goals.map((g) => {
      if (g.t === "score") return { ...g, have: Math.min(this.score, g.n), need: g.n, done: this.score >= g.n };
      if (g.t === "gem") return { ...g, have: Math.min(this.cnt.gem[g.c], g.n), need: g.n, done: this.cnt.gem[g.c] >= g.n };
      if (g.t === "soil") return { ...g, have: this.cnt.soil, need: this.soilTotal, done: this.cnt.soil >= this.soilTotal };
      if (g.t === "crate") return { ...g, have: this.cnt.crate, need: this.crateTotal, done: this.cnt.crate >= this.crateTotal };
      return { ...g, have: Math.min(this.cnt.seed, g.n), need: g.n, done: this.cnt.seed >= g.n };
    });
  }
  goalsMet() { return this.progress().every((g) => g.done); }
  // "win" | "lose" | "play". A level that is only about the score keeps going until the moves run out (more score = more stars)
  status() {
    if (this.scoreOnly) return this.moves <= 0 ? (this.goalsMet() ? "win" : "lose") : "play";
    if (this.goalsMet()) return "win"; return this.moves <= 0 ? "lose" : "play";
  }

  // The moves you did not need turn into special gems that go off one after the other (a big score bonus)
  finale() {
    const out = [], { cols } = this; const n = Math.min(this.moves, 7), cand = [];
    for (let i = 0; i < this.p.length; i++) if (this.p[i] && this.p[i].t === T.GEM) cand.push(i);
    for (let i = cand.length - 1; i > 0; i--) { const j = this.rand.int(0, i); const tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp; }
    const pick = cand.slice(0, n), conv = [];
    pick.forEach((i, m) => { const q = this.p[i]; q.t = m % 3 === 0 ? "lh" : m % 3 === 1 ? "bl" : "lv"; conv.push({ id: q.id, x: i % cols, y: (i / cols) | 0, t: q.t, k: q.k }); });
    out.push({ kind: "bonus", conv, snap: this.snap() });
    for (const c of conv) {
      let at = -1; for (let i = 0; i < this.p.length; i++) if (this.p[i] && this.p[i].id === c.id) { at = i; break; }   // it may have fallen, or already gone off
      if (at < 0) continue;
      this.chipped = new Set();
      out.push(...this.settle({ cells: new Set([at]), triggers: [] }, null, "finale"));
    }
    const extra = this.moves * PTS.move; this.score += extra; this.moves = 0;
    out.push({ kind: "bonusScore", pts: extra, snap: this.snap() });
    return out;
  }

  clone(seed) {
    const b = Object.create(Board.prototype); Object.assign(b, this);
    b.soil = this.soil.slice(); b.p = this.p.map((q) => (q ? { ...q } : null)); b.cnt = { gem: this.cnt.gem.slice(), soil: this.cnt.soil, crate: this.cnt.crate, seed: this.cnt.seed }; b.chipped = new Set();
    b.rand = new Rand(seed != null ? seed : this.rand.s); return b;
  }
}
