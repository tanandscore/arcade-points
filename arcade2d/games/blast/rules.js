// Blast Grid: the rules. Pure and tiny, so the same code runs the game, the automatic solver and the tests.
//
// It is a turn-based bomb puzzle. Every move you make (step, drop a bomb, wait) is one turn. After your move the bots take one step
// and every bomb ticks down one. Bombs go off with a cross-shaped blast that is stopped by walls and breaks the first crate it hits.
//
// Map letters:   #  wall        .  floor        c  crate        C  crate with a gem inside      *  gem
//                @  you         E  the door     X  the door hidden inside a crate
//                >  <  ^  v   a patrol bot facing that way (walks straight, turns right when blocked)
//                H  a hunter bot (steps toward you every second turn)      Z  a sleeper bot (never moves, still deadly)

export const FLOOR = 0, WALL = 1, CRATE = 2;
export const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const DIR_LIST = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left (clockwise)
export const FUSE = 3;

export function parseMap(lv) {
  const rows = lv.map, h = rows.length, w = rows[0].length;
  const S = {
    w, h, tile: new Uint8Array(w * h), gem: new Uint8Array(w * h), exit: -1, player: { x: 0, y: 0 }, bombs: [], bots: [], turn: 0,
    supply: lv.bombs, maxBombs: lv.max || 1, range: lv.range || 2, bombsUsed: 0, gemsGot: 0, gemsTotal: 0, killed: 0, botsTotal: 0,
    status: "play", ev: null,
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x], i = y * w + x;
    if (ch === "#") S.tile[i] = WALL;
    else if (ch === "c") S.tile[i] = CRATE;
    else if (ch === "C") { S.tile[i] = CRATE; S.gem[i] = 1; S.gemsTotal++; }
    else if (ch === "*") { S.gem[i] = 1; S.gemsTotal++; }
    else if (ch === "@") { S.player.x = x; S.player.y = y; }
    else if (ch === "E") S.exit = i;
    else if (ch === "X") { S.exit = i; S.tile[i] = CRATE; }
    else if (">v<^".includes(ch)) { S.bots.push({ x, y, t: "p", d: ch === "^" ? 0 : ch === ">" ? 1 : ch === "v" ? 2 : 3, alive: true }); }
    else if (ch === "H") S.bots.push({ x, y, t: "h", d: 2, alive: true });
    else if (ch === "Z") S.bots.push({ x, y, t: "z", d: 2, alive: true });
  }
  S.botsTotal = S.bots.length;
  return S;
}

export function cloneState(S) {
  return {
    ...S, tile: S.tile.slice(), gem: S.gem.slice(), player: { ...S.player }, bombs: S.bombs.map((b) => ({ ...b })), bots: S.bots.map((b) => ({ ...b })), ev: null,
  };
}

export const botsAlive = (S) => { let n = 0; for (const b of S.bots) if (b.alive) n++; return n; };
export const doorOpen = (S) => S.exit >= 0 && S.tile[S.exit] !== CRATE && botsAlive(S) === 0;
const bombAt = (S, x, y) => S.bombs.find((b) => b.x === x && b.y === y);
const botAt = (S, x, y) => S.bots.find((b) => b.alive && b.x === x && b.y === y);
const free = (S, x, y) => x >= 0 && y >= 0 && x < S.w && y < S.h && S.tile[y * S.w + x] === FLOOR && !bombAt(S, x, y);

// cells a bomb at (x,y) would burn right now (used for the danger overlay and by chain reactions)
export function blastCells(S, x, y, range = S.range) {
  const out = [[x, y]], crates = [];
  for (const [dx, dy] of DIR_LIST) for (let k = 1; k <= range; k++) {
    const cx = x + dx * k, cy = y + dy * k; if (cx < 0 || cy < 0 || cx >= S.w || cy >= S.h) break;
    const t = S.tile[cy * S.w + cx]; if (t === WALL) break;
    out.push([cx, cy]); if (t === CRATE) { crates.push([cx, cy]); break; }
  }
  return { cells: out, crates };
}

function huntStep(S, b) {
  const goal = S.player, seen = new Int16Array(S.w * S.h).fill(-1), q = [[b.x, b.y]]; seen[b.y * S.w + b.x] = 99;
  for (let qi = 0; qi < q.length; qi++) {
    const [cx, cy] = q[qi];
    if (cx === goal.x && cy === goal.y) { // walk back to the first step
      let px = cx, py = cy, first = null;
      while (!(px === b.x && py === b.y)) { first = [px, py]; const d = seen[py * S.w + px], [dx, dy] = DIR_LIST[d]; px -= dx; py -= dy; }
      return first;
    }
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIR_LIST[d][0], ny = cy + DIR_LIST[d][1];
      if (nx < 0 || ny < 0 || nx >= S.w || ny >= S.h || seen[ny * S.w + nx] !== -1) continue;
      if (S.tile[ny * S.w + nx] !== FLOOR || bombAt(S, nx, ny)) continue;
      seen[ny * S.w + nx] = d; q.push([nx, ny]);
    }
  }
  return null;
}

// Apply one action: "U" "D" "L" "R" step, "B" drop a bomb, "W" wait. Returns false (and changes nothing) if the action is not allowed.
export function step(S, act) {
  if (S.status !== "play") return false;
  const ev = { act, from: { x: S.player.x, y: S.player.y }, botMoves: [], blasts: [], broken: [], gems: [], kills: [], placed: null, bump: null, win: false, dead: false };
  const p = S.player;
  if (DIRS[act]) {
    const nx = p.x + DIRS[act][0], ny = p.y + DIRS[act][1];
    if (nx < 0 || ny < 0 || nx >= S.w || ny >= S.h || S.tile[ny * S.w + nx] !== FLOOR || bombAt(S, nx, ny)) { ev.bump = [nx, ny]; S.ev = ev; return false; }
    p.x = nx; p.y = ny;
  } else if (act === "B") {
    if (S.supply <= 0 || S.bombs.length >= S.maxBombs || bombAt(S, p.x, p.y)) { S.ev = ev; return false; }
    S.bombs.push({ x: p.x, y: p.y, f: FUSE }); S.supply--; S.bombsUsed++; ev.placed = [p.x, p.y];
  } else if (act !== "W") return false;
  S.ev = ev;

  // you bump into a bot
  if (botAt(S, p.x, p.y)) { S.status = "dead"; ev.dead = true; S.turn++; return true; }
  const pi = p.y * S.w + p.x;
  if (S.gem[pi] && S.tile[pi] === FLOOR) { S.gem[pi] = 0; S.gemsGot++; ev.gems.push([p.x, p.y]); }
  if (pi === S.exit && doorOpen(S)) { S.status = "won"; ev.win = true; S.turn++; return true; }

  // bots take their step
  for (const b of S.bots) {
    if (!b.alive || b.t === "z") continue;
    const fx = b.x, fy = b.y;
    if (b.t === "p") {
      const tries = [b.d, (b.d + 1) % 4, (b.d + 3) % 4, (b.d + 2) % 4];
      for (const d of tries) {
        const nx = b.x + DIR_LIST[d][0], ny = b.y + DIR_LIST[d][1];
        if (free(S, nx, ny) && !botAt(S, nx, ny)) { b.x = nx; b.y = ny; b.d = d; break; }
      }
    } else if (b.t === "h" && S.turn % 2 === 0) {
      const nx = huntStep(S, b);
      if (nx && !botAt(S, nx[0], nx[1])) { for (let d = 0; d < 4; d++) if (b.x + DIR_LIST[d][0] === nx[0] && b.y + DIR_LIST[d][1] === nx[1]) b.d = d; b.x = nx[0]; b.y = nx[1]; }
    }
    if (b.x !== fx || b.y !== fy) ev.botMoves.push({ b, fx, fy });
    if (b.x === p.x && b.y === p.y) { S.status = "dead"; ev.dead = true; }
  }

  // bombs tick down and go off (chain reactions included)
  for (const bm of S.bombs) bm.f--;
  const fired = new Set(), queue = S.bombs.filter((b) => b.f <= 0);
  const burn = new Set();
  while (queue.length) {
    const bm = queue.pop(); if (fired.has(bm)) continue; fired.add(bm);
    const { cells, crates } = blastCells(S, bm.x, bm.y);
    ev.blasts.push({ x: bm.x, y: bm.y, cells });
    for (const [cx, cy] of cells) { burn.add(cy * S.w + cx); const o = bombAt(S, cx, cy); if (o && !fired.has(o)) queue.push(o); }
    for (const [cx, cy] of crates) { const i = cy * S.w + cx; if (S.tile[i] === CRATE) { S.tile[i] = FLOOR; ev.broken.push([cx, cy, S.gem[i] ? 1 : 0, i === S.exit ? 1 : 0]); } }
  }
  if (fired.size) S.bombs = S.bombs.filter((b) => !fired.has(b));
  for (const b of S.bots) if (b.alive && burn.has(b.y * S.w + b.x)) { b.alive = false; S.killed++; ev.kills.push(b); }
  if (burn.has(p.y * S.w + p.x)) { S.status = "dead"; ev.dead = true; }
  S.turn++;
  if (S.status === "play" && pi === S.exit && doorOpen(S)) { S.status = "won"; ev.win = true; }
  return true;
}

// a compact text key for the whole situation (the solver uses it to avoid visiting the same place twice)
export function key(S) {
  let k = S.player.x + "," + S.player.y + "|" + S.supply + "|" + (S.turn & 1) + "|";
  for (let i = 0; i < S.tile.length; i++) if (S.tile[i] === CRATE) k += i + ".";
  k += "|";
  for (let i = 0; i < S.gem.length; i++) if (S.gem[i]) k += i + ".";
  k += "|";
  for (const b of S.bombs) k += b.x + "," + b.y + "," + b.f + ";";
  k += "|";
  for (const b of S.bots) k += b.alive ? b.x + "," + b.y + "," + b.d + ";" : "x;";
  return k;
}

export const stars = (S, lv) => 1 + (S.gemsGot >= S.gemsTotal ? 1 : 0) + (S.gemsGot >= S.gemsTotal && S.bombsUsed <= lv.par ? 1 : 0);
export function scoreOf(S, lv) {
  return 1000 + S.killed * 150 + S.gemsGot * 200 + S.supply * 60 + Math.max(0, (lv.parTurns * 2 - S.turn)) * 8;
}
