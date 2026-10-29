// Kiko Leap — worlds, level names and the code that turns chunks into a playable map.
import { rng, clamp } from "../../core/util";
import { TileMap } from "../../core/platformer";
import { CHUNKS, SPECIAL, BOSS_ARENAS } from "./chunks";

export const TS = 48;
export const WORLDS = [
  { name: "Sunny Meadow", short: "Meadow", theme: "meadow", look: "meadow", music: "sunny", boss: "mole", blurb: "Rolling hills, friendly gloops and a grumpy mole king.", names: ["Hello, Hills", "Gloop Valley", "Bounce Lane", "Brick Ridge", "Meadow Rush", "King Mudge"] },
  { name: "Crystal Caves", short: "Caves", theme: "cave", look: "cave", music: "cave", boss: "spider", blurb: "Glowing crystals, sharp spikes and swooping bats.", names: ["Glowworm Gap", "Spiky Tunnels", "Bat Belfry", "Crystal Climb", "Deep Dark Dash", "Weavett"] },
  { name: "Cloud Kingdom", short: "Clouds", theme: "sky", look: "sky", music: "sky", boss: "storm", blurb: "Hop between cloud islands. Don't look down!", names: ["Cloud Hop", "Windy Walk", "Storm Steps", "Spring Skies", "Sunset Sprint", "Nimbra"] },
  { name: "Ember Peak", short: "Ember", theme: "volcano", look: "volcano", music: "fire", boss: "golem", blurb: "Lava, fire and the mighty Magma Golem.", names: ["Warm Welcome", "Lava Leap", "Crumbling Crossing", "Crusher Canyon", "Inferno Run", "Ignar"] },
];
const BOSS_NAME = { mole: "King Mudge", spider: "Weavett the Weaver", storm: "Queen Nimbra", golem: "Ignar the Magma Golem" };
const DESC = [
  ["Learn to run and jump.", "Gloops love to wander.", "Springs launch you sky-high.", "Smash bricks and grab hearts.", "A long run with a few surprises."],
  ["Watch your step in the dark.", "Spikes! Jump early.", "Bats hang from the ceiling.", "Shooters guard the path.", "The longest, darkest tunnel."],
  ["Islands in the sky.", "Wide gaps. Hold run and glide!", "Storm clouds strike from above.", "Springs, planks and long falls.", "Race the sunset."],
  ["Mind the lava.", "Fire jumps out of the lava.", "Platforms crumble underfoot.", "Crushers wait overhead.", "Everything at once."],
];
export function worldDefs() {
  return WORLDS.map((w, wi) => ({
    ...w,
    levels: w.names.map((n, li) => ({ id: `${wi + 1}-${li + 1}`, label: `${wi + 1}-${li + 1}`, music: li === 5 ? "boss" : undefined, name: li === 5 ? `Boss: ${BOSS_NAME[w.boss]}` : n, desc: li === 5 ? `Stomp ${BOSS_NAME[w.boss]} three times. Learn the pattern!` : DESC[wi][li], boss: li === 5 ? w.boss : null })),
  }));
}

function pickChunk(pool, tier, r, recent) {
  let cand = pool.filter((c) => c.tier === tier && !recent.includes(c.id));
  if (!cand.length) cand = pool.filter((c) => Math.abs(c.tier - tier) <= 1 && !recent.includes(c.id));
  if (!cand.length) cand = pool;
  return r.pick(cand);
}

// returns { rows, theme, look, music, par, seeds, boss, parTime, name }
export function buildLevel(lv) {
  const wi = lv.wi, li = lv.li, W = WORLDS[wi];
  if (li === 5) { // boss arena
    const a = BOSS_ARENAS[W.boss]; const rows = [...a.rows, a.ground, a.ground];
    return { rows, theme: W.theme, look: W.look, music: "boss", boss: W.boss, par: 0, parTime: 0, seeds: 0, wi, li, chunks: 1 };
  }
  const r = rng((wi + 1) * 1000 + li * 37 + 11), count = 7 + li + wi, pool = CHUNKS.filter((c) => c.worlds.includes(wi));
  const seq = [SPECIAL.start]; const recent = [];
  for (let i = 0; i < count; i++) {
    const prog = i / Math.max(1, count - 1);
    const tier = clamp(Math.round(1 + wi * 0.5 + li * 0.42 + prog * 1.1 + (r() - 0.5) * 0.8), 1, 4);
    const c = pickChunk(pool, tier, r, recent); seq.push(c); recent.push(c.id); if (recent.length > 3) recent.shift();
    if (i === Math.floor(count / 2) - 1) seq.push(SPECIAL.checkpoint);
  }
  seq.push(SPECIAL.goal);
  // make sure there are exactly three star seeds
  const rowsOf = seq.map((c) => c.rows.slice());
  const seedAt = []; rowsOf.forEach((rw, i) => rw.forEach((line, y) => { for (let x = 0; x < line.length; x++) if (line[x] === "$") seedAt.push([i, y, x]); }));
  while (seedAt.length > 3) { const [i, y, x] = seedAt.splice(Math.floor(r() * seedAt.length), 1)[0]; rowsOf[i][y] = rowsOf[i][y].slice(0, x) + "c" + rowsOf[i][y].slice(x + 1); } // too many seeds in the chunks: turn extras into coins
  let seeds = seedAt.length;
  const spots = seq.map((c, i) => ({ c, i })).filter(({ c, i }) => i > 1 && i < seq.length - 2 && c.id !== "checkpoint" && !c.rows.some((l) => l.includes("$")) && c.ground.slice(4, -4).split("").every((x) => x === "#"));
  while (seeds < 3 && spots.length) {
    const k = Math.floor(r() * spots.length), { c, i } = spots.splice(k, 1)[0]; const col = r.int(5, Math.max(6, c.w - 6)); const row = rowsOf[i][7];
    if (row[col] === ".") { rowsOf[i][7] = row.slice(0, col) + "$" + row.slice(col + 1); seeds++; }
  }
  const rows = Array.from({ length: 12 }, (_, y) => seq.map((c, i) => (y < 10 ? rowsOf[i][y] : c.ground)).join(""));
  const cols = rows[0].length;
  let c0 = 0; const layout = seq.map((c) => { const o = { id: c.id, c0, c1: c0 + c.w }; c0 += c.w; return o; });
  return { rows, theme: W.theme, look: W.look, music: W.music, boss: null, seeds: 3, wi, li, chunks: seq.length, layout, parTime: Math.round(cols * 0.26 + 6), cols };
}

export const SOLID = "#XB?u";
export const ENTS = "PFCc$H*gsbhtafkwSmMdZ";
export function mapFrom(info) { return new TileMap(info.rows, { ts: TS, solid: SOLID, oneway: "=", hazard: "^L", ents: ENTS }); }

// short how-to messages that pop up in the first levels (column in tiles, text)
export const HINTS = {
  "1-1": [[5, "Run with ◀ ▶ (or A / D) and jump with SPACE. Hold JUMP longer to jump higher."], [26, "Jump on top of enemies to squash them!"], [62, "Grab coins, and look out for the 3 big Star Seeds ★"]],
  "1-2": [[8, "Tap JUMP again in mid-air and HOLD it to float across gaps!"], [44, "Press ▼ DOWN in the air to ground-pound. It smashes bricks!"]],
  "1-3": [[10, "Hold X / J (or the RUN button) to sprint. Wide gaps need a running jump!"]],
  "2-1": [[12, "Spikes hurt! Jump over them early."]],
  "3-1": [[10, "Falling off a cloud costs a heart. Float with a second JUMP tap!"]],
};
