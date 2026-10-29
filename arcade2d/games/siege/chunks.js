// Skyline Siege — the building blocks of every mission.
// A mission is 14 tiles tall. Row 10 is the row you walk in; the street itself is rows 11-13. A "chunk" is one slice of
// street: a ground line (# street, . pit) plus things placed above it. Chunks start and end on solid street, so any two can be
// joined. Items are written as [row, column, "text"] (the text is dropped into that row starting at that column).
//
// Tiles:  # street   X steel   B brick (explosions only)   C crate (breaks when shot)   = catwalk (stand on it, jump up through it)   ^ spikes
// Spawn:  P start  F exit  K checkpoint  y citizen  Z boss
//         g grunt  h shield brute  s sniper  d drone  t turret  b bomber  j jet trooper  m walker mech
//         $ cash  + medkit  r armour  o grenades  a ammo  R rage orb  1 Rattler  2 Thumper  3 Prism  4 Skybreaker  e explosive barrel
const ALL = [0, 1, 2, 3];

function build(id, tier, districts, ground, items) {
  const w = ground.length, rows = Array.from({ length: 11 }, () => Array(w).fill("."));
  for (const [r, c, s] of items) for (let i = 0; i < s.length; i++) {
    if (c + i >= w || c + i < 0) throw new Error(`chunk ${id}: "${s}" runs off the edge at col ${c}`);
    if (r < 0 || r > 10) throw new Error(`chunk ${id}: row ${r} is outside the level`);
    rows[r][c + i] = s[i];
  }
  return { id, tier, districts, w, ground, rows: rows.map((r) => r.join("")), cit: items.reduce((n, [, , s]) => n + (s.match(/y/g) || []).length, 0) };
}
const pits = (w, ...p) => { const g = Array(w).fill("#"); for (const [c, n] of p) for (let i = 0; i < n; i++) g[c + i] = "."; return g.join(""); };
const flat = (w) => "#".repeat(w);
const C = build;

export const SPECIAL = {
  start: C("start", 0, ALL, flat(18), [[10, 3, "P"], [10, 8, "$"], [10, 10, "$"], [10, 12, "$"]]),
  checkpoint: C("checkpoint", 0, ALL, flat(14), [[10, 6, "K"], [10, 3, "o"], [10, 10, "+"]]),
  goal: C("goal", 0, ALL, flat(20), [[10, 13, "F"], [10, 5, "$"], [10, 7, "$"], [10, 9, "$"]]),
  bossgate: C("bossgate", 0, ALL, flat(16), [[10, 4, "K"], [10, 8, "+"], [10, 10, "a"], [10, 12, "o"]]),
  checkpoint_s: C("checkpoint_s", 0, ALL, flat(8), [[10, 4, "K"]]),   // a small one, slipped in automatically so you never lose more than a minute of play
};

// the boss arenas: exactly 20 tiles wide (one screen). The right wall is built in; the left door closes when the fight starts.
// Platforms are 2 tiles (96 px) above each other so every one can be reached with a normal jump.
export const ARENAS = {
  crane: C("arena_crane", 0, [0], flat(20), [
    [0, 19, "X"], [1, 19, "X"], [2, 19, "X"], [3, 19, "X"], [4, 19, "X"], [5, 19, "X"], [6, 19, "X"], [7, 19, "X"], [8, 19, "X"], [9, 19, "X"], [10, 19, "X"],
    [9, 2, "===="], [7, 5, "===="], [9, 8, "===="], [10, 16, "Z"],
  ]),
  widow: C("arena_widow", 0, [1], flat(20), [
    [0, 19, "X"], [1, 19, "X"], [2, 19, "X"], [3, 19, "X"], [4, 19, "X"], [5, 19, "X"], [6, 19, "X"], [7, 19, "X"], [8, 19, "X"], [9, 19, "X"], [10, 19, "X"],
    [9, 2, "===="], [7, 5, "======"], [9, 10, "===="], [9, 15, "===="], [10, 10, "Z"],
  ]),
  titan: C("arena_titan", 0, [2], flat(20), [
    [0, 19, "X"], [1, 19, "X"], [2, 19, "X"], [3, 19, "X"], [4, 19, "X"], [5, 19, "X"], [6, 19, "X"], [7, 19, "X"], [8, 19, "X"], [9, 19, "X"], [10, 19, "X"],
    [9, 2, "===="], [7, 5, "===="], [9, 8, "===="], [10, 15, "Z"],
  ]),
  architect: C("arena_architect", 0, [3], flat(20), [
    [0, 19, "X"], [1, 19, "X"], [2, 19, "X"], [3, 19, "X"], [4, 19, "X"], [5, 19, "X"], [6, 19, "X"], [7, 19, "X"], [8, 19, "X"], [9, 19, "X"], [10, 19, "X"],
    [9, 2, "===="], [7, 5, "===="], [9, 8, "===="], [7, 11, "====="], [9, 15, "===="], [4, 9, "Z"],
  ]),
};

export const CHUNKS = [
  // ---- tier 1: warm-up ------------------------------------------------------------------------------------------------------
  C("walk_g", 1, ALL, flat(20), [[10, 12, "g"], [10, 5, "$"], [10, 7, "$"]]),
  C("crates_a", 1, ALL, flat(22), [[9, 8, "CC"], [10, 8, "CC"], [8, 8, "$"], [8, 9, "$"], [10, 16, "g"], [10, 19, "g"]]),
  C("step_up", 1, ALL, flat(22), [[10, 8, "XXXXXX"], [9, 10, "XXXX"], [8, 12, "g"], [8, 10, "$"], [10, 18, "g"]]),
  C("plank_walk", 1, ALL, flat(24), [[9, 6, "====="], [7, 11, "====="], [8, 8, "$"], [6, 13, "$"], [6, 12, "g"], [10, 19, "g"]]),
  C("pit2", 1, ALL, pits(18, [7, 2]), [[8, 6, "$$$$"]]),
  C("barrel_pair", 1, ALL, flat(22), [[10, 9, "e"], [10, 13, "e"], [10, 17, "g"], [10, 19, "g"]]),
  C("drone_intro", 1, ALL, flat(22), [[4, 12, "d"], [10, 4, "$"], [10, 6, "$"], [10, 17, "g"]]),
  C("weapon_nook", 1, ALL, flat(20), [[10, 9, "1"], [10, 16, "g"], [10, 3, "$"]]),
  C("citizen_roof", 1, ALL, flat(24), [[9, 11, "===="], [8, 12, "y"], [10, 18, "g"], [10, 6, "$"]]),
  C("lamp_street", 1, ALL, flat(22), [[10, 6, "g"], [10, 11, "g"], [10, 16, "$"], [10, 18, "+"]]),
  // ---- tier 2: it heats up ---------------------------------------------------------------------------------------------------
  C("two_level", 2, ALL, flat(28), [
    [10, 4, "XXXXX"], [9, 5, "XXXX"], [8, 6, "XXX"], [7, 7, "=============="],
    [6, 12, "g"], [6, 17, "g"], [6, 20, "s"], [6, 10, "$"], [6, 14, "$"], [10, 15, "g"], [10, 24, "1"],
  ]),
  C("container_yard", 2, ALL, flat(30), [
    [9, 7, "CC"], [10, 7, "CC"], [9, 14, "CC"], [10, 14, "CC"], [8, 7, "$"], [8, 8, "$"],
    [10, 11, "g"], [8, 15, "g"], [10, 18, "g"], [10, 21, "e"], [10, 26, "+"],
  ]),
  C("pit_pair", 2, ALL, pits(26, [8, 2], [13, 2]), [[10, 11, "g"], [8, 7, "$$"], [8, 12, "$$"], [9, 18, "XXXX"], [10, 18, "XXXX"], [8, 20, "s"]]),
  // a sealed closet inside a bunker. The street goes OVER it (catwalk, roof, catwalk); a grenade on the brick door opens the closet
  C("brick_secret", 2, ALL, flat(26), [
    [10, 2, "o"], [10, 4, "g"], [9, 5, "==="], [8, 8, "XXXXXXXXXX"], [9, 8, "B"], [10, 8, "B"], [9, 17, "X"], [10, 17, "X"],
    [10, 10, "$"], [10, 12, "y"], [10, 14, "$"], [10, 15, "2"], [9, 18, "==="], [7, 10, "$$$"], [10, 22, "g"],
  ]),
  C("turret_hall", 2, ALL, flat(26), [[5, 6, "XXXXXXXXXXXXXXXXXX"], [6, 12, "t"], [10, 9, "g"], [10, 16, "g"], [10, 22, "+"], [10, 4, "$"]]),
  C("bomber_rush", 2, ALL, flat(24), [[10, 8, "e"], [10, 15, "b"], [10, 19, "b"], [10, 4, "$"], [10, 12, "$"]]),
  C("jet_pair", 2, ALL, flat(26), [[10, 9, "XX"], [9, 9, "XX"], [4, 14, "j"], [3, 20, "j"], [10, 4, "+"], [10, 22, "g"]]),
  C("crate_maze", 2, ALL, flat(28), [
    [10, 6, "CC"], [9, 7, "C"], [10, 13, "C"], [9, 13, "C"], [8, 13, "C"], [10, 20, "CC"], [9, 20, "CC"],
    [10, 10, "g"], [10, 17, "g"], [10, 24, "g"], [8, 20, "$"], [8, 21, "$"], [7, 13, "$"],
  ]),
  C("citizen_island", 2, ALL, pits(26, [8, 2], [14, 2]), [[10, 11, "y"], [10, 12, "g"], [8, 7, "$$"], [8, 13, "$$"], [10, 20, "g"], [10, 23, "+"]]),
  C("ledge_citizen", 2, ALL, flat(24), [[9, 6, "===="], [7, 11, "===="], [5, 16, "===="], [4, 17, "y"], [10, 18, "g"], [4, 8, "d"], [8, 7, "$"], [6, 12, "$"]]),
  // ---- tier 3: serious business ------------------------------------------------------------------------------------------------
  C("shield_wall", 3, ALL, flat(26), [[10, 8, "X"], [9, 8, "X"], [10, 15, "h"], [10, 19, "g"], [10, 22, "g"], [10, 4, "o"]]),
  // snipers perch on slabs high above the street; the 2-tile blocks are cover
  C("sniper_gallery", 3, ALL, flat(30), [
    [7, 10, "XXXXX"], [6, 12, "s"], [5, 19, "XXXXX"], [4, 21, "s"],
    [10, 7, "XX"], [9, 7, "XX"], [10, 16, "XX"], [9, 16, "XX"], [10, 26, "XX"], [9, 26, "XX"],
    [10, 5, "$"], [10, 3, "g"], [10, 13, "g"], [10, 22, "g"], [10, 28, "+"],
  ]),
  C("mech_alley", 3, ALL, flat(34), [[10, 5, "4"], [10, 7, "o"], [10, 14, "e"], [10, 16, "e"], [10, 27, "m"], [10, 31, "+"]]),
  C("drone_swarm", 3, ALL, flat(26), [[3, 8, "d"], [5, 12, "d"], [4, 16, "d"], [6, 20, "d"], [10, 10, "XX"], [9, 10, "XX"], [10, 22, "+"]]),
  C("gap_gunners", 3, ALL, pits(32, [7, 2], [14, 2], [22, 2]), [[10, 11, "g"], [10, 18, "g"], [9, 26, "XXXX"], [10, 26, "XXXX"], [8, 27, "s"], [8, 6, "$$"], [8, 13, "$$"]]),
  C("turret_gauntlet", 3, ALL, flat(30), [
    [5, 4, "XXXXXXXXX"], [6, 8, "t"], [10, 20, "t"], [10, 15, "X"], [9, 15, "X"], [10, 25, "g"], [10, 12, "g"], [10, 27, "+"],
  ]),
  C("high_road", 3, ALL, flat(30), [
    [10, 3, "XXXXXXX"], [9, 4, "XXXXXX"], [8, 5, "XXXXX"], [7, 6, "XXXX"], [6, 7, "XXX"], [5, 9, "=========="],
    [4, 14, "r"], [4, 12, "y"], [3, 18, "j"], [10, 16, "g"], [10, 24, "g"], [10, 27, "$"],
  ]),
  C("spike_walk", 3, ALL, flat(24), [[10, 9, "^^^"], [10, 16, "^^"], [10, 12, "g"], [8, 9, "$$$"], [10, 20, "g"]]),
  C("catwalk_gap", 3, ALL, "####....................####", [
    [9, 6, "==="], [8, 11, "==="], [9, 16, "==="], [8, 20, "==="], [7, 12, "g"], [5, 10, "d"], [4, 18, "d"], [7, 7, "$"], [7, 17, "$"],
  ]),
  // ---- tier 4: brutal ----------------------------------------------------------------------------------------------------------
  // a brick gate across the street. Blast it with a grenade, or climb the catwalks and cross the high bridge
  C("fortress_front", 4, ALL, flat(34), [
    [10, 3, "o"], [10, 5, "o"], [9, 8, "==="], [7, 11, "=========="], [8, 14, "BB"], [9, 14, "BB"], [10, 14, "BB"],
    [10, 19, "h"], [10, 22, "g"], [6, 25, "t"], [5, 22, "XXXXXXXXX"], [10, 29, "+"], [10, 26, "$"],
  ]),
  C("barrel_run", 4, ALL, flat(30), [[10, 7, "e"], [10, 11, "e"], [10, 15, "b"], [10, 18, "b"], [10, 21, "b"], [10, 25, "g"], [10, 3, "+"]]),
  C("sniper_drones", 4, ALL, flat(32), [[9, 20, "XXXX"], [10, 20, "XXXX"], [8, 21, "s"], [3, 8, "d"], [4, 14, "d"], [5, 26, "d"], [10, 11, "g"], [10, 28, "+"], [10, 5, "r"]]),
  C("brute_pair", 4, ALL, flat(32), [[10, 9, "h"], [10, 17, "h"], [10, 4, "o"], [10, 6, "o"], [10, 23, "g"], [10, 26, "g"], [10, 29, "+"]]),
  C("jet_squad", 4, ALL, flat(30), [[4, 10, "j"], [3, 16, "j"], [5, 22, "j"], [10, 7, "XX"], [9, 7, "XX"], [10, 13, "XX"], [10, 27, "+"], [10, 24, "g"]]),
];

// put the chunks of a mission side by side. A chunk can be written as "id" or ["id", { "1": "2" }] (swap the letters it uses).
export const AUTO_CHECKPOINT_TILES = 50;   // never more than about 2,400 px of street between two checkpoints
export function assemble(seq) {
  const all = { ...SPECIAL, ...Object.fromEntries(Object.values(ARENAS).map((c) => [c.id, c])), ...Object.fromEntries(CHUNKS.map((c) => [c.id, c])) };
  const rows = Array.from({ length: 14 }, () => ""), marks = []; let col = 0, cit = 0, arenaCol = -1, since = 0;
  const lay = (ch, remap) => {
    for (let r = 0; r < 11; r++) { let line = ch.rows[r]; if (remap) line = line.replace(/./g, (c) => (remap[c] != null ? remap[c] : c)); rows[r] += line; }
    for (let r = 11; r < 14; r++) rows[r] += ch.ground.replace(/#/g, "#");
    cit += ch.cit; col += ch.w;
  };
  for (const spec of seq) {
    const [id, remap] = Array.isArray(spec) ? spec : [spec, null], ch = all[id];
    if (!ch) throw new Error(`unknown chunk "${id}"`);
    const special = id === "start" || id === "goal" || id === "bossgate" || id === "checkpoint" || id.startsWith("arena_");
    if (!special && since > 16 && since + ch.w > AUTO_CHECKPOINT_TILES) { lay(all.checkpoint_s); since = 0; }   // (hint numbers count the listed chunks only)
    if (id.startsWith("arena_")) arenaCol = col;
    marks.push({ id, col, w: ch.w });
    lay(ch, remap);
    since = id === "checkpoint" || id === "bossgate" ? 0 : since + ch.w;
  }
  return { rows, marks, cols: col, citizens: cit, arenaCol };
}
