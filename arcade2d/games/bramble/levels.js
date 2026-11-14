// Bramble Rush — twelve long runs built from hand-designed pieces. Every piece starts and ends on the ground line, so the pieces
// always join up, and every jump in them fits the hero's reach (3-wide pits, 2.5-tile steps). The order is mixed per level.
import { Grid } from "../../core/lvl";
import { rng } from "../../core/util";

const F = 12; // top row of the ground. Things on row 11 stand on it.
// each piece draws into g at column x and returns its width. d = 0..3 difficulty tier
const PIECES = {
  flat: (g, x, r) => { g.coins(x + 3, x + 8, 9); if (r() < 0.6) g.put(x + 11, 11, "g"); return 16; },
  hopper: (g, x, r) => { g.pit(x + 6, x + 8); g.coins(x + 5, x + 9, 8); g.put(x + 14, 11, "g"); return 18; },
  steps: (g, x) => { for (let i = 0; i < 3; i++) g.rect(x + 4 + i * 2, F - 1 - i, x + 5 + i * 2, F - 1 - i, "X"), g.rect(x + 4 + i * 2, F - i, x + 5 + i * 2, F, "X"); for (let i = 0; i < 3; i++) g.rect(x + 11 + i * 2, F - 3 + i, x + 12 + i * 2, F, "X"); g.coins(x + 8, x + 10, 7); return 20; },
  planks: (g, x, r) => { g.rect(x + 3, F, x + 14, 13, "^"); g.plank(x + 2, x + 3, 11); g.plank(x + 6, x + 7, 10); g.plank(x + 10, x + 11, 10); g.plank(x + 14, x + 15, 11); g.coins(x + 6, x + 7, 8); g.coins(x + 10, x + 11, 8); return 18; },
  walkers: (g, x) => { g.put(x + 5, 11, "g"); g.put(x + 9, 11, "g"); g.put(x + 14, 11, "g"); g.coins(x + 3, x + 6, 9); g.put(x + 12, 11, "H"); return 18; },
  rollwall: (g, x) => { g.coins(x + 2, x + 5, 11); g.rect(x + 8, F - 3, x + 8, F - 1, "r"); g.rect(x + 9, F - 3, x + 9, F - 1, "r"); g.put(x + 11, 11, "$"); g.put(x + 12, 11, "c"); g.put(x + 13, 11, "H"); g.rect(x + 14, F - 2, x + 15, F - 1, "X"); g.coins(x + 3, x + 6, 6); return 20; },
  tower: (g, x) => { g.put(x + 4, 11, "s"); g.plank(x + 7, x + 12, 7); g.put(x + 9, 6, "$"); g.coins(x + 7, x + 12, 5); g.put(x + 15, 11, "s"); g.rect(x + 18, F - 2, x + 19, F, "X"); g.coins(x + 8, x + 12, 10); return 22; },
  movers: (g, x) => { g.pit(x + 4, x + 11); g.put(x + 7, 11, "m"); g.coins(x + 5, x + 10, 8); return 16; },
  crumble: (g, x) => { g.pit(x + 3, x + 13); g.put(x + 5, 10, "d"); g.put(x + 9, 10, "d"); g.put(x + 13, 10, "d"); g.coins(x + 5, x + 12, 8); return 18; },
  flyers: (g, x) => { g.put(x + 5, 11, "f"); g.put(x + 11, 11, "f"); g.coins(x + 3, x + 14, 11); g.put(x + 16, 11, "g"); return 20; },
  spikes: (g, x) => { g.spikes(x + 4, x + 5, 11); g.spikes(x + 9, x + 10, 11); g.spikes(x + 14, x + 15, 11); g.coins(x + 3, x + 6, 8); g.coins(x + 8, x + 11, 8); g.coins(x + 13, x + 16, 8); return 19; },
  high: (g, x) => { g.plank(x + 3, x + 4, 10); g.plank(x + 6, x + 7, 8); g.plank(x + 9, x + 10, 6); g.put(x + 10, 5, "$"); g.plank(x + 12, x + 13, 8); g.plank(x + 15, x + 16, 10); g.coins(x + 6, x + 7, 7); return 20; },
  gallery: (g, x) => { g.put(x + 4, 11, "t"); g.put(x + 12, 11, "T"); g.coins(x + 6, x + 10, 11); g.rect(x + 8, F - 1, x + 8, F - 1, "X"); return 17; },
  bounce: (g, x) => { g.pit(x + 5, x + 6); g.put(x + 9, 11, "s"); g.put(x + 13, 11, "s"); g.coins(x + 8, x + 14, 5); g.put(x + 17, 11, "g"); return 20; },
};
const POOLS = [
  ["flat", "hopper", "walkers", "steps", "flat", "rollwall", "tower", "spikes"],
  ["hopper", "planks", "walkers", "flyers", "rollwall", "movers", "tower", "high", "bounce", "spikes"],
  ["planks", "crumble", "flyers", "movers", "gallery", "spikes", "high", "tower", "rollwall", "bounce", "walkers"],
];
const RELIC = ["rollwall", "tower", "high"];

export function brambleLevel(id) {
  const [wi, li] = id.split("-").map((n) => n - 1);
  const r = rng(wi * 977 + li * 131 + 17), count = 7 + wi + li * 2;
  const parts = [];
  // choose the pieces: make sure the three relic pieces are in, mixed with the others
  const pool = POOLS[wi], rest = [];
  for (let i = 0; i < count; i++) rest.push(pool[Math.floor(r() * pool.length)]);
  const at = [Math.floor(count * 0.2), Math.floor(count * 0.5), Math.floor(count * 0.8)];
  RELIC.forEach((nm, i) => (rest[at[i]] = nm));
  // no piece twice in a row
  for (let i = 1; i < rest.length; i++) if (rest[i] === rest[i - 1] && !RELIC.includes(rest[i])) rest[i] = pool[(pool.indexOf(rest[i]) + 1) % pool.length];
  const widths = []; let W = 10; // intro
  const dummy = new Grid(600, 14);
  const cut = Math.floor(count / 2);
  const plan = [];
  rest.forEach((nm, i) => { plan.push(nm); if (i === cut) plan.push("checkpoint"); });
  const g = new Grid(1, 14);
  // draw into a big grid first
  const G = new Grid(900, 14); G.floor(0, 899, F);
  G.put(3, 11, "S"); G.coins(5, 8, 11);
  let x = 10;
  for (const nm of plan) {
    if (nm === "checkpoint") { G.put(x + 4, 11, "C"); G.coins(x + 6, x + 9, 11); x += 12; continue; }
    const w = PIECES[nm](G, x, r); x += w;
  }
  G.put(x + 6, 11, "E"); G.coins(x + 2, x + 4, 11);
  const total = x + 14;
  // crop to the real width and add side walls
  const out = new Grid(total, 14); for (let yy = 0; yy < 14; yy++) for (let xx = 0; xx < total; xx++) out.put(xx, yy, G.get(xx, yy));
  out.wall(0, 0, 13); out.wall(total - 1, 0, 13);
  return { id, rows: out.rows(), name: NAMES[wi][li], theme: ["forest", "desert", "volcano"][wi], look: ["forest", "desert", "volcano"][wi], seed: wi * 10 + li + 1, parTime: Math.round(total * 0.2), parDeaths: 0, last: wi === 2 && li === 3, hints: HINTS[id] || [] };
}
const NAMES = [["Mossy Start", "Canopy Dash", "Vine Valley", "Thornback Run"], ["Dune Gate", "Scarab Steps", "Sandstorm Ridge", "Sun Temple"], ["Cinder Path", "Ash Bridges", "Ember Falls", "Heart of the Mountain"]];
const HINTS = {
  "1-1": [[2, "Jump on enemies to squash them. Hold JUMP to jump higher."], [30, "Tap ROLL to smash cracked blocks and bowl over walkers!"]],
  "1-2": [[8, "Springs fling you up high. Look for Sunstones in the treetops."]],
  "2-1": [[8, "Crumbling platforms fall when you stand on them. Keep moving!"]],
  "3-1": [[8, "Darts! Duck under them or jump over."]],
};
export const BRAMBLE_WORLDS = [
  { name: "Bramble Canopy", theme: "forest", music: "sunny", blurb: "Treetop runs, springs and grumpy gloops.", levels: [["1-1", "Mossy Start", "Run, jump and roll."], ["1-2", "Canopy Dash", "Springs and flyers."], ["1-3", "Vine Valley", "Long jumps over thorns."], ["1-4", "Thornback Run", "The longest canopy run."]] },
  { name: "Dune Ruins", theme: "desert", music: "calm", blurb: "Sand, crumbling bridges and moving stones.", levels: [["2-1", "Dune Gate", "Crumbling bridges."], ["2-2", "Scarab Steps", "Moving platforms."], ["2-3", "Sandstorm Ridge", "Fast and tricky."], ["2-4", "Sun Temple", "Everything at once."]] },
  { name: "Cinder Falls", theme: "volcano", music: "fire", blurb: "Hot rocks, dart traps and a mountain to climb.", levels: [["3-1", "Cinder Path", "Dart galleries."], ["3-2", "Ash Bridges", "Falling stones."], ["3-3", "Ember Falls", "Spikes, springs, flyers."], ["3-4", "Heart of the Mountain", "The final run."]] },
];
