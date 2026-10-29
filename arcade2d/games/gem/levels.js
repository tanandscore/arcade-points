// Gem Garden: 4 gardens, 24 levels. Each level says how big the board is, how many gem colours, how many moves you get and what to do.
//
// Layout letters:  .  plain cell    #  hole    s  soil (bloom it by clearing a gem on it)    c  crate (breaks after 1 hit)
//                  C  tough crate (2 hits)   K  steel crate (3 hits)   a  a seed to carry to the bottom
// Goals:  { t:"score", n }   { t:"gem", c, n } (colour 0 ruby, 1 sapphire, 2 emerald, 3 topaz, 4 amethyst, 5 rose)
//         { t:"soil" } bloom every soil cell     { t:"crate" } break every crate     { t:"seed", n } carry n seeds to the bottom
// `stars` = [score for 2 stars, score for 3 stars], found by letting the automatic player play each level many times.

const L = (...rows) => rows;
const full = (c, r) => Array.from({ length: r }, () => ".".repeat(c));

export const GEM_NAMES = ["Ruby", "Sapphire", "Emerald", "Topaz", "Amethyst", "Rose"];
export const GEM_PLURAL = ["Rubies", "Sapphires", "Emeralds", "Topaz", "Amethysts", "Roses"];

export const WORLDS = [
  {
    name: "Dewdrop Meadow", short: "Meadow", theme: "meadow", music: "sunny", blurb: "Match gems in the morning sun and learn the tricks.",
    levels: [
      { id: "1-1", name: "First Sprout", cols: 6, rows: 6, colors: 4, moves: 16, stars: [6950, 9600], goals: [{ t: "score", n: 4000 }], hint: "Swap two neighbouring gems to line up three of a kind." },
      { id: "1-2", name: "Ruby Rush", cols: 7, rows: 7, colors: 4, moves: 16, stars: [7650, 9500], goals: [{ t: "gem", c: 0, n: 30 }, { t: "gem", c: 1, n: 30 }], hint: "Match four in a row to make a Line gem. It clears a whole row or column." },
      { id: "1-3", name: "Bee Line", cols: 7, rows: 7, colors: 5, moves: 20, stars: [5800, 7700], goals: [{ t: "score", n: 4000 }], hint: "An L or T shape makes a Blast gem that clears everything around it." },
      {
        id: "1-4", name: "Ladybug Lane", cols: 8, rows: 8, colors: 5, moves: 24, stars: [6400, 7650], goals: [{ t: "gem", c: 2, n: 26 }, { t: "gem", c: 3, n: 26 }],
        layout: L("##....##", "#......#", "........", "........", "........", "........", "#......#", "##....##"), hint: "Swap two special gems together for an even bigger boom.",
      },
      {
        id: "1-5", name: "Clover Cross", cols: 8, rows: 8, colors: 5, moves: 26, stars: [6850, 7850], goals: [{ t: "score", n: 5000 }, { t: "gem", c: 4, n: 22 }],
        layout: L("##....##", "##....##", "........", "........", "........", "........", "##....##", "##....##"),
      },
      { id: "1-6", name: "Meadow Master", cols: 8, rows: 8, colors: 6, moves: 26, stars: [5500, 7850], goals: [{ t: "score", n: 3800 }], hint: "Match five in a row to make a Prism. Swap it with any gem to clear that colour." },
    ],
  },
  {
    name: "Bloom Greenhouse", short: "Greenhouse", theme: "forest", music: "calm", blurb: "Make every patch of soil burst into flowers.",
    levels: [
      { id: "2-1", name: "Seed Tray", cols: 6, rows: 6, colors: 4, moves: 16, stars: [5000, 6700], goals: [{ t: "soil" }], layout: L("s....s", ".ssss.", ".ssss.", ".ssss.", ".ssss.", "s....s"), hint: "Clear a gem that sits on soil and a flower blooms there." },
      { id: "2-2", name: "Crossed Beds", cols: 7, rows: 7, colors: 5, moves: 24, stars: [5500, 7350], goals: [{ t: "soil" }], layout: L("s.....s", ".s...s.", "..s.s..", "...s...", "..s.s..", ".s...s.", "s.....s") },
      { id: "2-3", name: "Window Frame", cols: 8, rows: 8, colors: 5, moves: 36, stars: [8750, 11650], goals: [{ t: "soil" }], layout: L("ssssssss", "s......s", "s......s", "s......s", "s......s", "s......s", "s......s", "ssssssss") },
      { id: "2-4", name: "Diamond Bed", cols: 8, rows: 8, colors: 5, moves: 21, stars: [4600, 5700], goals: [{ t: "soil" }, { t: "gem", c: 0, n: 20 }], layout: L("###..###", "##....##", "#.ssss.#", ".ssssss.", ".ssssss.", "#.ssss.#", "##....##", "###..###") },
      { id: "2-5", name: "Checkerboard", cols: 8, rows: 8, colors: 5, moves: 30, stars: [8600, 12100], goals: [{ t: "soil" }], layout: L("s.s.s.s.", ".s.s.s.s", "s.s.s.s.", ".s.s.s.s", "s.s.s.s.", ".s.s.s.s", "s.s.s.s.", ".s.s.s.s") },
      { id: "2-6", name: "Greenhouse Rush", cols: 8, rows: 8, colors: 6, moves: 34, stars: [7850, 8650], goals: [{ t: "soil" }, { t: "score", n: 6000 }], layout: L("........", ".ssssss.", ".ssssss.", ".ssssss.", ".ssssss.", ".ssssss.", ".ssssss.", "........") },
    ],
  },
  {
    name: "Frostpetal Hollow", short: "Hollow", theme: "snow", music: "snow", blurb: "Crates block the way. Match next to them to crack them open.",
    levels: [
      { id: "3-1", name: "Cracked Crates", cols: 7, rows: 7, colors: 4, moves: 14, stars: [4900, 7350], goals: [{ t: "crate" }], layout: L(".......", ".......", "C.C.C.C", ".......", ".K.K.K.", ".......", "......."), hint: "Matches next to a crate crack it. Line and Blast gems smash it at once." },
      { id: "3-2", name: "Crate Stack", cols: 7, rows: 7, colors: 5, moves: 20, stars: [3650, 5000], goals: [{ t: "crate" }], layout: L("..K.K..", ".C...C.", "...K...", ".......", "C.....C", ".......", ".......") },
      { id: "3-3", name: "Double Trouble", cols: 7, rows: 7, colors: 5, moves: 24, stars: [5450, 6450], goals: [{ t: "crate" }, { t: "gem", c: 1, n: 24 }], layout: L(".......", ".K...K.", ".......", "...K...", ".......", ".K...K.", "......."), hint: "Tough crates need two hits." },
      { id: "3-4", name: "Frozen Garden", cols: 8, rows: 8, colors: 5, moves: 20, stars: [5550, 7700], goals: [{ t: "crate" }, { t: "soil" }], layout: L("........", ".K....K.", "........", "..ssss..", "..ssss..", "........", ".C....C.", "..CCCC..") },
      { id: "3-5", name: "Fortress", cols: 8, rows: 8, colors: 5, moves: 24, stars: [5350, 7050], goals: [{ t: "crate" }], layout: L("........", "........", "..KCCK..", "..C..C..", "..C..C..", "..KCCK..", "........", "........") },
      { id: "3-6", name: "Frostbite Finale", cols: 8, rows: 8, colors: 6, moves: 36, stars: [6650, 7350], goals: [{ t: "crate" }, { t: "soil" }, { t: "score", n: 5000 }], layout: L("##....##", "#.K..K.#", "..ssss..", ".CssssC.", ".CssssC.", "..ssss..", "#.K..K.#", "##....##") },
    ],
  },
  {
    name: "Starlight Orchard", short: "Orchard", theme: "night_forest", music: "puzzle", blurb: "Carry the golden acorns down to the roots.",
    levels: [
      { id: "4-1", hammers: 2, name: "Falling Acorns", cols: 6, rows: 8, colors: 4, moves: 12, stars: [5350, 7650], goals: [{ t: "seed", n: 3 }], layout: L(".a.a.a", "......", "......", "......", "......", "......", "......", "......"), seeds: { total: 3, max: 3, p: 0 }, hint: "Clear the gems under an acorn so it drops. You can also swap an acorn with the gem under it." },
      { id: "4-2", hammers: 2, name: "Tree Line", cols: 7, rows: 8, colors: 5, moves: 21, stars: [5200, 7200], goals: [{ t: "seed", n: 5 }, { t: "soil" }], layout: L("..a.a..", ".......", ".......", "..ss...", ".ssss..", ".ssss..", "..ss...", "......."), seeds: { total: 5, max: 3, p: 0.4 } },
      { id: "4-3", hammers: 2, name: "Acorn Rain", cols: 7, rows: 8, colors: 5, moves: 26, stars: [5700, 7350], goals: [{ t: "seed", n: 6 }, { t: "crate" }], layout: L("...a...", ".......", ".C...C.", ".......", ".......", ".K...K.", ".......", "......."), seeds: { total: 6, max: 3, p: 0.45 } },
      {
        id: "4-4", hammers: 2, name: "The Funnel", cols: 8, rows: 8, colors: 5, moves: 28, stars: [3750, 5250], goals: [{ t: "seed", n: 7 }],
        layout: L(".a....a.", "........", "........", "........", "#......#", "##....##", "###..###", "###..###"), seeds: { total: 7, max: 3, p: 0.55 },
      },
      { id: "4-5", hammers: 2, name: "Orchard Gate", cols: 8, rows: 8, colors: 5, moves: 28, stars: [7000, 9100], goals: [{ t: "seed", n: 6 }, { t: "crate" }, { t: "soil" }], layout: L("...aa...", "........", "..K..K..", "........", "........", ".ssssss.", ".C....C.", "........"), seeds: { total: 6, max: 3, p: 0.5 } },
      {
        id: "4-6", hammers: 2, name: "Starlight Finale", cols: 8, rows: 8, colors: 6, moves: 44, stars: [5550, 6650], goals: [{ t: "seed", n: 7 }, { t: "crate" }, { t: "soil" }],
        layout: L("##.aa.##", "#......#", "..K..K..", "..ssss..", ".ssssss.", "..ssss..", "#.C..C.#", "##....##"), seeds: { total: 7, max: 3, p: 0.55 },
      },
    ],
  },
];

export const FLAT = [];
WORLDS.forEach((w, wi) => w.levels.forEach((lv, li) => { lv.wi = wi; lv.li = li; lv.layout = lv.layout || full(lv.cols, lv.rows); lv.hammers = lv.hammers ?? 1; lv.stars = lv.stars || [0, 0]; FLAT.push(lv); }));

// short text for the level picker
export function describeGoals(lv) {
  const bits = lv.goals.map((g) => {
    if (g.t === "score") return `Score ${g.n.toLocaleString("en-US")}`;
    if (g.t === "gem") return `Collect ${g.n} ${GEM_PLURAL[g.c]}`;
    if (g.t === "soil") return "Bloom all the soil";
    if (g.t === "crate") return "Break every crate";
    return `Carry ${g.n} acorn${g.n === 1 ? "" : "s"} down`;
  });
  return bits.join(" · ");
}
