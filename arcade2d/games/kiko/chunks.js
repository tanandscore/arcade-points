// Kiko Leap — the building blocks of every level.
// A level is 12 tiles tall (rows 0..11). Rows 10-11 are the ground. A chunk is a piece of level whose first and last
// two columns are solid ground, so any chunks can be joined end to end. Chunks are written as a list of placements:
//   [row, column, "text"]   — drops that text into the row starting at that column (so no counting dots).
// Ground is described separately: "#" ground, "." pit, "L" lava.
//
// Tile letters:  # ground   X hard block   B brick   ? bonus block   = floating plank   ^ spikes
// Spawn letters: P start  F flag  C checkpoint  c coin  $ star seed  H heart  * star power
//                g gloop  s spikeback  b buzz  h hopper  t spitter  a bat  f fireling  k crusher  w cloudling
//                S spring  m side-to-side platform  M up-and-down platform  d falling platform
const ALL = [0, 1, 2, 3];

function build(id, tier, worlds, ground, items) {
  const w = ground.length, rows = Array.from({ length: 10 }, () => Array(w).fill("."));
  for (const [r, c, s] of items) for (let i = 0; i < s.length; i++) { if (c + i >= w || c + i < 0) throw new Error(`chunk ${id}: "${s}" runs off the edge at col ${c}`); rows[r][c + i] = s[i]; }
  return { id, tier, worlds, w, ground, rows: rows.map((r) => r.join("")) };
}
const pits = (w, ...p) => { const g = Array(w).fill("#"); for (const [c, n, ch] of p) for (let i = 0; i < n; i++) g[c + i] = ch || "."; return g.join(""); };
const flat = (w) => "#".repeat(w);
const C = build;

export const SPECIAL = {
  start: C("start", 0, ALL, flat(18), [[9, 4, "P"], [9, 9, "c"], [9, 11, "c"], [9, 13, "c"]]),
  checkpoint: C("checkpoint", 0, ALL, flat(16), [[9, 7, "C"], [8, 4, "c"], [8, 11, "c"]]),
  goal: C("goal", 0, ALL, flat(20), [[9, 13, "F"], [9, 5, "c"], [8, 7, "c"], [9, 9, "c"]]),
};

export const CHUNKS = [
  // ---- tier 1: gentle ----------------------------------------------------------------------------------------------------------
  C("flat_coins", 1, ALL, flat(16), [[9, 6, "ccccc"], [9, 13, "g"]]),
  C("bonus_row", 1, ALL, flat(18), [[7, 6, "?B?B?"], [9, 12, "g"]]),
  C("first_steps", 1, ALL, flat(20), [[9, 4, "XXXX"], [8, 6, "XX"], [9, 12, "XXXX"], [8, 14, "XX"], [8, 9, "cc"], [9, 18, "g"]]),
  C("pit2_arc", 1, ALL, pits(16, [7, 2]), [[8, 6, "cccc"]]),
  C("hill", 1, ALL, flat(20), [[7, 9, "ccc"], [8, 8, "XXXXX"], [9, 6, "XXXXXXXXX"], [9, 18, "g"]]),
  C("ledge_coins", 1, ALL, flat(18), [[8, 6, "====="], [7, 7, "ccc"], [9, 14, "g"]]),
  C("gloop_pair", 1, ALL, flat(18), [[9, 4, "g"], [9, 13, "g"], [8, 6, "ccc"], [8, 10, "ccc"]]),
  C("plank_bridge", 1, ALL, pits(17, [6, 5]), [[9, 6, "=="], [9, 9, "=="], [8, 7, "ccc"]]),
  C("tiny_hops", 1, ALL, "####.##.##.#####", [[8, 4, "c"], [8, 7, "c"], [8, 10, "c"]]),
  C("sunny_walk", 1, ALL, flat(18), [[9, 5, "c"], [9, 7, "c"], [9, 9, "c"], [9, 11, "c"], [7, 8, "?"], [9, 15, "g"]]),
  // ---- tier 2: a bit tougher ----------------------------------------------------------------------------------------------------
  C("pit3_arc", 2, ALL, pits(15, [6, 3]), [[8, 5, "ccccc"], [9, 13, "g"]]),
  C("spring_seed", 2, ALL, flat(20), [[9, 8, "S"], [5, 11, "===="], [4, 12, "$"], [9, 17, "g"], [9, 3, "c"], [9, 5, "c"]]),
  C("bonus_tower", 2, ALL, flat(18), [[7, 6, "BB?BB"], [4, 8, "?"], [9, 13, "g"]]),
  C("hopper_ledge", 2, ALL, flat(20), [[8, 7, "XXXXXXXXX"], [7, 9, "ccccc"], [9, 17, "h"]]),
  C("seed_over_pit", 2, ALL, pits(14, [4, 6]), [[8, 5, "===="], [6, 6, "$"], [9, 12, "g"]]),
  C("zig_planks", 2, ALL, pits(18, [6, 6]), [[8, 6, "==="], [7, 9, "==="], [6, 10, "cc"], [9, 15, "g"]]),
  C("buzz_run", 2, ALL, flat(20), [[6, 10, "b"], [8, 4, "c"], [8, 9, "c"], [8, 16, "c"], [9, 12, "g"]]),
  C("heart_nook", 2, ALL, flat(20), [[8, 2, "XXXXXX"], [9, 2, "X"], [9, 5, "H"], [9, 16, "g"]]),
  C("double_pit", 2, ALL, pits(18, [5, 2], [11, 2]), [[7, 4, "cccc"], [7, 10, "cccc"]]),
  C("low_roof", 2, ALL, flat(20), [[4, 0, "XXXXXXXXXXXXXXXXXXXX"], [5, 0, "XXXXXXXXXXXXXXXXXXXX"], [9, 8, "g"], [8, 12, "ccc"]]),
  // ---- tier 3: sharp -----------------------------------------------------------------------------------------------------------
  C("pit4_sprint", 3, ALL, pits(16, [6, 4]), [[8, 6, "cccc"], [9, 14, "g"]]),
  C("spiky_walk", 3, ALL, flat(18), [[9, 11, "s"], [6, 8, "BBBBBBB"], [8, 4, "ccc"]]),
  C("moving_bridge", 3, ALL, pits(19, [6, 7]), [[9, 9, "m"], [8, 15, "c"]]),
  C("ladder_planks", 3, ALL, pits(18, [5, 6]), [[8, 5, "==="], [6, 8, "===="], [5, 9, "cc"]]),
  C("gauntlet", 3, ALL, flat(22), [[9, 4, "g"], [9, 11, "g"], [9, 19, "s"], [7, 7, "c"], [7, 15, "c"]]),
  C("star_pillar", 3, ALL, flat(22), [[9, 10, "S"], [7, 13, "XXXX"], [8, 13, "XXXX"], [9, 13, "XXXX"], [6, 14, "$"], [9, 19, "g"]]),
  // ---- tier 4: spicy ------------------------------------------------------------------------------------------------------------
  C("sprint_gauntlet", 4, ALL, pits(22, [6, 4], [12, 4]), [[8, 6, "cc"], [8, 12, "cc"], [9, 17, "g"]]),
  C("falling_stairs", 4, ALL, pits(19, [5, 9]), [[9, 6, "d"], [8, 9, "d"], [7, 12, "d"], [5, 12, "c"]]),
  C("seed_glide", 4, ALL, pits(20, [4, 9]), [[8, 8, "$"], [7, 6, "c"], [7, 12, "c"], [9, 17, "g"]]),
  // ---- caves (world 1) and volcano (world 3): spikes and shooters -----------------------------------------------------------------
  C("cave_spikes", 2, [1, 3], flat(18), [[9, 5, "^^^"], [9, 12, "^^"], [7, 5, "ccc"], [7, 11, "cc"]]),
  C("cave_spitter", 2, [1, 3], flat(20), [[9, 15, "t"], [8, 8, "ccc"], [9, 3, "c"]]),
  C("cave_bats", 2, [1], flat(18), [[0, 0, "XXXXXXXXXXXXXXXXXX"], [1, 0, "XXXXXXXXXXXXXXXXXX"], [2, 5, "a"], [2, 12, "a"], [8, 7, "c"], [8, 10, "c"]]),
  C("cave_crystals", 3, [1], flat(20), [[8, 6, "XX"], [9, 6, "XX"], [9, 5, "^"], [9, 8, "^"], [8, 13, "XX"], [9, 13, "XX"], [9, 12, "^"], [9, 15, "^"], [6, 6, "cc"], [6, 13, "cc"]]),
  C("cave_double_spitter", 3, [1, 3], flat(22), [[9, 3, "t"], [9, 18, "t"], [8, 9, "ccc"], [9, 11, "^"]]),
  // ---- sky (world 2) ----------------------------------------------------------------------------------------------------------------
  C("sky_clouds", 2, [2], "###..###..###..###", [[6, 8, "b"], [8, 3, "cc"], [8, 8, "cc"], [8, 13, "cc"]]),
  C("sky_chain", 3, [2], "##....##....##....##", [[8, 2, "cc"], [8, 8, "cc"], [8, 14, "cc"]]),
  C("sky_storm", 3, [2], flat(20), [[5, 4, "w"], [8, 11, "======="], [7, 12, "ccc"], [9, 4, "g"]]),
  C("sky_spring_tower", 3, [2], pits(18, [5, 7]), [[9, 4, "S"], [4, 7, "==="], [3, 8, "$"]]),
  C("sky_buzzers", 3, [2], "###...###...###...###", [[5, 7, "b"], [5, 13, "b"], [8, 3, "cc"], [8, 9, "cc"]]),
  // ---- volcano (world 3) --------------------------------------------------------------------------------------------------------------
  C("lava_hop", 2, [3], pits(18, [4, 4, "L"], [12, 3, "L"]), [[8, 4, "cccc"], [9, 5, "f"], [8, 12, "ccc"]]),
  C("lava_planks", 3, [3], pits(16, [4, 8, "L"]), [[9, 5, "=="], [9, 9, "=="], [8, 4, "cc"], [8, 9, "cc"]]),
  C("lava_crusher", 3, [3], flat(20), [[0, 6, "k"], [9, 15, "s"], [8, 9, "ccc"]]),
  C("lava_fallers", 4, [3], pits(18, [4, 10, "L"]), [[9, 5, "d"], [9, 8, "d"], [9, 11, "d"], [7, 8, "cc"]]),
  C("lava_spitters", 3, [3], flat(20), [[9, 1, "t"], [9, 18, "t"], [9, 8, "^^^^"], [6, 7, "ccccc"]]),
];

// Boss arenas: exactly one screen wide (20 tiles) so the whole fight is always visible. Z = boss start, P = player start.
function arena(id, items, ground = flat(20)) { return build(id, 0, ALL, ground, items); }
const wall = () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((r) => [[r, 0, "X"], [r, 19, "X"]]);
const ceil2 = [[0, 0, "XXXXXXXXXXXXXXXXXXXX"], [1, 0, "XXXXXXXXXXXXXXXXXXXX"]];
export const BOSS_ARENAS = {
  mole: arena("mole", [...wall(), [9, 3, "P"], [9, 15, "Z"], [6, 3, "===="], [6, 13, "===="], [4, 8, "c c c"]]),
  spider: arena("spider", [...wall(), ...ceil2, [9, 3, "P"], [2, 10, "Z"], [7, 3, "===="], [7, 13, "===="], [5, 8, "c c c"]]),
  storm: arena("storm", [...wall(), [9, 3, "P"], [4, 10, "Z"], [7, 2, "===="], [7, 14, "===="], [5, 8, "===="], [3, 3, "c"], [3, 16, "c"]], "#####..######..#####"),
  golem: arena("golem", [...wall(), [9, 3, "P"], [9, 14, "Z"], [7, 3, "===="], [7, 13, "===="], [5, 8, "c c"]]),
};
export const KIND_OF_BOSS = { mole: "mole", spider: "spider", storm: "storm", golem: "golem" };
