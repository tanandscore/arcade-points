// Ashtide — the long game (Upgrade 64). Everything that turns a calm sandbox into a town you keep coming back to:
//
//   • Town level and XP, with something new unlocked at every level (colours, decorations, islands)
//   • Townsfolk wishes: three little requests at a time, from named neighbours, each with a reward
//   • Discoveries: 24 special shapes and scenes to find (arches, courtyards, staircases, lighthouses...) collected in an album
//   • Shells: earned from wishes and discoveries, spent on decorations
//   • Six islands, each with its own sky, sea and weather, unlocked as the town grows; every island keeps its own town
//
// Kind design rules: there are no timers that punish you for leaving, nothing to buy with real money, no random prize boxes. Progress
// comes from building; every level is reachable by playing calmly. This file is pure logic (no graphics): engine.js calls it.
import { key, unkey } from "./grid";

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ---- levels --------------------------------------------------------------------------------------------------------------------------------------------
export const xpFor = (L) => 120 + 45 * (L - 1); // XP needed to go from level L to L+1
export function levelOf(xp) { let L = 1, x = xp; while (x >= xpFor(L) && L < 60) { x -= xpFor(L); L++; } return { level: L, into: x, need: xpFor(L) }; }
export const TITLES = ["Newcomer", "Settler", "Bricklayer", "Harbour Hand", "Painter", "Gardener", "Mason", "Lamplighter", "Shipwright", "Town Planner", "Architect", "Lighthouse Keeper", "Master Builder", "Harbourmaster", "Island Mayor", "Sea Baron", "Grand Architect", "Legend of the Tides"];
export const titleOf = (L) => TITLES[Math.min(TITLES.length - 1, Math.floor((L - 1) * 0.9))];

// ---- colours beyond the starting ten (unlocked by level) ----------------------------------------------------------------------------------------------
export const EXTRA_COLOURS = [
  { name: "Teal", wall: 0x5fb3ad, shutter: 0xf6efe0, lvl: 3 },
  { name: "Terracotta", wall: 0xd27b55, shutter: 0xf3e6c8, lvl: 6 },
  { name: "Midnight", wall: 0x51648f, shutter: 0xf5d77c, lvl: 8 },
  { name: "Gold", wall: 0xe8c15a, shutter: 0x6a4a8c, lvl: 10 },
  { name: "Cherry", wall: 0xd85a6a, shutter: 0xfff3dc, lvl: 12 },
  { name: "Marble", wall: 0xf7f4ef, shutter: 0x4f7f9a, lvl: 14 },
];

// ---- decorations ---------------------------------------------------------------------------------------------------------------------------------------
// where: "top" sits on the roof of a house (the roof becomes a flat terrace), "water" floats on an empty sea cell next to the town
export const PROPS = [
  { id: "tree", name: "Olive tree", icon: "🌳", lvl: 2, cost: 5, where: "top" },
  { id: "lantern", name: "Lantern", icon: "🏮", lvl: 3, cost: 5, where: "top" },
  { id: "flag", name: "Flag", icon: "🚩", lvl: 4, cost: 8, where: "top" },
  { id: "boat", name: "Fishing boat", icon: "⛵", lvl: 5, cost: 15, where: "water" },
  { id: "fountain", name: "Fountain", icon: "⛲", lvl: 6, cost: 20, where: "top" },
  { id: "stall", name: "Market stall", icon: "🍉", lvl: 7, cost: 15, where: "top" },
  { id: "windmill", name: "Windmill", icon: "🌬️", lvl: 9, cost: 40, where: "top" },
  { id: "lighthouse", name: "Lighthouse", icon: "🗼", lvl: 11, cost: 60, where: "top", minH: 3 },
  { id: "bell", name: "Bell tower", icon: "🔔", lvl: 13, cost: 50, where: "top" },
  { id: "statue", name: "Statue", icon: "🗿", lvl: 15, cost: 40, where: "top" },
  { id: "balloon", name: "Hot-air balloon", icon: "🎈", lvl: 18, cost: 80, where: "top" },
];
export const propById = Object.fromEntries(PROPS.map((p) => [p.id, p]));

// ---- islands -------------------------------------------------------------------------------------------------------------------------------------------
export const ISLANDS = [
  { id: "harbour", name: "Ashtide Harbour", lvl: 1, blurb: "Where it all began. Warm stone, blue water, gulls.", theme: "harbour" },
  { id: "sunset", name: "Sunset Cove", lvl: 4, blurb: "Endless golden hour over a calm bay.", theme: "sunset" },
  { id: "frost", name: "Frost Fjord", lvl: 7, blurb: "Snow on the roofs, ice-blue water, soft falling snow.", theme: "frost" },
  { id: "lantern", name: "Lantern Bay", lvl: 10, blurb: "A violet twilight where paper lanterns drift into the sky.", theme: "lantern" },
  { id: "coral", name: "Coral Lagoon", lvl: 13, blurb: "Turquoise shallows and bright tropical sun.", theme: "coral" },
  { id: "storm", name: "Storm Point", lvl: 16, blurb: "Wind, rain and a dramatic sea. Build a lighthouse.", theme: "storm" },
];

// ---- what unlocks at each level (for the level-up card) --------------------------------------------------------------------------------------------
export function unlocksAt(L) {
  const u = [];
  for (const c of EXTRA_COLOURS) if (c.lvl === L) u.push({ kind: "colour", name: c.name, hex: c.wall });
  for (const p of PROPS) if (p.lvl === L) u.push({ kind: "prop", name: p.name, icon: p.icon });
  for (const i of ISLANDS) if (i.lvl === L && L > 1) u.push({ kind: "island", name: i.name, icon: "🏝️" });
  return u;
}

// ---- reading the town ------------------------------------------------------------------------------------------------------------------------------
/** Shapes and counts the wishes and discoveries look for. voxels: Map key -> {c}; props: Map key -> type */
export function analyse(voxels, props) {
  const has = (i, j, k) => voxels.has(key(i, j, k));
  const colH = new Map(); const colour = new Map(); let tallest = 0;
  const colourCount = new Map();
  for (const [q, v] of voxels) {
    const [i, j, k] = unkey(q); colourCount.set(v.c, (colourCount.get(v.c) || 0) + 1);
    if (k === 0) { let h = 1; while (has(i, j, h)) h++; colH.set(i * 64 + j, h); colour.set(i * 64 + j, v.c); tallest = Math.max(tallest, h); }
  }
  const H = (i, j) => colH.get(i * 64 + j) || 0, Cc = (i, j) => colour.get(i * 64 + j);
  // hanging blocks (bridges) and arches: a hanging block with houses on both opposite sides
  let bridges = 0, arches = 0, longBridge = 0;
  const hanging = new Set();
  for (const [q] of voxels) { const [i, j, k] = unkey(q); if (k > 0 && !has(i, j, k - 1)) { bridges++; hanging.add(q); if ((has(i - 1, j, k) && has(i + 1, j, k)) || (has(i, j - 1, k) && has(i, j + 1, k))) arches++; } }
  for (const q of hanging) { const [i, j, k] = unkey(q); for (const [di, dj] of [[1, 0], [0, 1]]) if (hanging.has(key(i + di, j + dj, k)) && hanging.has(key(i + 2 * di, j + 2 * dj, k))) longBridge = 1; }
  // courtyards: an empty sea cell with houses on all four sides
  let courtyards = 0; const seen = new Set();
  for (const [p] of colH) { const i = Math.floor(p / 64), j = p % 64; for (const [di, dj] of DIRS4) { const a = i + di, b = j + dj; const id = a * 64 + b; if (seen.has(id) || H(a, b)) continue; seen.add(id); if (DIRS4.every(([x, y]) => H(a + x, b + y) > 0)) courtyards++; } }
  // lines and runs
  let staircase = 0, rainbow = 0, painted = 0, wall = 0, twin = 0, skyline = 0, plaza = 0;
  for (const [p, h] of colH) {
    const i = Math.floor(p / 64), j = p % 64; if (h >= 4) skyline++;
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      if (h >= 5 && H(i + di, j + dj) >= 5) twin = 1;
      let up = true, dn = true; for (let s = 1; s < 4; s++) { if (H(i + di * s, j + dj * s) !== h + s) up = false; if (H(i + di * s, j + dj * s) !== h - s) dn = false; } if ((up && h === 1) || (dn && h === 4)) staircase = 1;
      const cs = new Set(); let same = true, run5 = true; for (let s = 0; s < 5; s++) { const c = Cc(i + di * s, j + dj * s); if (c == null) { run5 = false; break; } cs.add(c); if (c !== Cc(i, j)) same = false; } if (run5 && cs.size === 5) rainbow = 1; if (run5 && same) painted = 1;
      let w8 = true; for (let s = 0; s < 8; s++) if (H(i + di * s, j + dj * s) < 2) { w8 = false; break; } if (w8) wall = 1;
    }
    let pz = true; for (let a = 0; a < 3 && pz; a++) for (let b = 0; b < 3; b++) if (H(i + a, j + b) !== 1) { pz = false; break; } if (pz) plaza = 1;
  }
  // separate clusters at sea level (islands within the island)
  const comp = new Set(); let clusters = 0;
  for (const [p] of colH) { if (comp.has(p)) continue; clusters++; const st = [p]; comp.add(p); while (st.length) { const x = st.pop(); const i = Math.floor(x / 64), j = x % 64; for (const [di, dj] of DIRS4) { const y = (i + di) * 64 + (j + dj); if (colH.has(y) && !comp.has(y)) { comp.add(y); st.push(y); } } } }
  const propCount = {}; let lighthouseOnTower = 0, windmillHigh = 0, bellHigh = 0;
  for (const [q, t] of props || []) { propCount[t] = (propCount[t] || 0) + 1; const [, , k] = unkey(q); if (t === "lighthouse" && k >= 4) lighthouseOnTower = 1; if (t === "windmill" && k >= 3) windmillHigh = 1; if (t === "bell" && k >= 5) bellHigh = 1; }
  return { houses: voxels.size, tallest, bridges, arches, longBridge, courtyards, staircase, rainbow, painted, wall, twin, skyline, plaza, clusters, colourCount, colours: colourCount.size, propCount, lighthouseOnTower, windmillHigh, bellHigh };
}

// ---- discoveries ---------------------------------------------------------------------------------------------------------------------------------------
export const DISCOVERIES = [
  { id: "arch", name: "The Arch", hint: "A house that hangs between two others, with water underneath", test: (a) => a.arches > 0 },
  { id: "courtyard", name: "Hidden Courtyard", hint: "A patch of sea with houses on all four sides", test: (a) => a.courtyards > 0 },
  { id: "spire", name: "Sky Spire", hint: "A tower seven floors high", test: (a) => a.tallest >= 7 },
  { id: "twin", name: "Twin Towers", hint: "Two towers of five floors, side by side", test: (a) => a.twin > 0 },
  { id: "stairs", name: "Grand Staircase", hint: "Four columns in a row stepping up 1, 2, 3, 4", test: (a) => a.staircase > 0 },
  { id: "longbridge", name: "Long Bridge", hint: "Three hanging houses in a straight line", test: (a) => a.longBridge > 0 },
  { id: "plaza", name: "Little Plaza", hint: "Nine one-floor houses in a 3 x 3 square", test: (a) => a.plaza > 0 },
  { id: "rainbow", name: "Rainbow Row", hint: "Five houses in a row, five different colours", test: (a) => a.rainbow > 0 },
  { id: "painted", name: "Painted Street", hint: "Five houses in a row, all one colour", test: (a) => a.painted > 0 },
  { id: "isles", name: "Sister Isle", hint: "A second little cluster, apart from the main town", test: (a) => a.clusters >= 2 && a.houses >= 12 },
  { id: "wall", name: "Sea Wall", hint: "Eight columns in a row, all at least two floors", test: (a) => a.wall > 0 },
  { id: "skyline", name: "Skyline", hint: "Five towers of four floors or more", test: (a) => a.skyline >= 5 },
  { id: "village", name: "Village", hint: "60 houses on one island", test: (a) => a.houses >= 60 },
  { id: "city", name: "City by the Sea", hint: "150 houses on one island", test: (a) => a.houses >= 150 },
  { id: "palette", name: "Full Palette", hint: "Use twelve colours on one island", test: (a) => a.colours >= 12 },
  { id: "harbour", name: "Busy Harbour", hint: "Three boats moored by the town", test: (a) => (a.propCount.boat || 0) >= 3 },
  { id: "keeper", name: "The Keeper's Light", hint: "A lighthouse on a tower at least four floors high", test: (a) => a.lighthouseOnTower > 0 },
  { id: "mill", name: "Windmill Hill", hint: "A windmill on a house three floors up", test: (a) => a.windmillHigh > 0 },
  { id: "grove", name: "Olive Grove", hint: "Six trees on one island", test: (a) => (a.propCount.tree || 0) >= 6 },
  { id: "lanternlane", name: "Lantern Lane", hint: "Eight lanterns on one island", test: (a) => (a.propCount.lantern || 0) >= 8 },
  { id: "festival", name: "Festival Day", hint: "Three flags and three market stalls", test: (a) => (a.propCount.flag || 0) >= 3 && (a.propCount.stall || 0) >= 3 },
  { id: "chimes", name: "Evening Chimes", hint: "A bell tower five floors up", test: (a) => a.bellHigh > 0 },
  { id: "voyager", name: "Island Hopper", hint: "Build on three different islands", test: (a, P) => Object.values(P.towns || {}).filter((t) => (t.v || []).length >= 10).length >= 3 },
  { id: "balloon", name: "Up, Up and Away", hint: "Launch a hot-air balloon", test: (a) => (a.propCount.balloon || 0) >= 1 },
];

// ---- townsfolk and their wishes ------------------------------------------------------------------------------------------------------------------------
export const FOLK = [
  ["Mira", "🧑‍🍳", "the baker"], ["Granny Pell", "👵", "who knows everyone"], ["Tomas", "🎣", "the fisherman"], ["Ines", "🎨", "the painter"], ["Oskar", "👷", "the builder"],
  ["Little Pip", "🧒", "who loves heights"], ["Ana", "🎻", "the fiddler"], ["Sol", "🌸", "the gardener"], ["Captain Rue", "🧭", "of the old ferry"], ["Dr. Vell", "🩺", "the town doctor"],
  ["Lio", "📮", "the postman"], ["Bea", "🐝", "the beekeeper"], ["Marco", "🍷", "who runs the café"], ["Juno", "📚", "the librarian"], ["Teo", "🐈", "and his three cats"],
];
const COLOUR_NAMES = (palette) => palette.map((p) => p.name);

// a wish: { id, folk, kind, n, c, base, text, xp, shells }
export function makeWish(P, a, palette, seed) {
  const L = P.level; const r = (k) => { const x = Math.sin((seed + 1) * 9301 + k * 49297) * 233280; return x - Math.floor(x); };
  const folk = FOLK[Math.floor(r(1) * FOLK.length)];
  const pool = [];
  pool.push(() => { const n = 4 + Math.floor(r(2) * (3 + L)); return { kind: "more", n, base: a.houses, text: `${folk[0]} needs room for new neighbours: build ${n} more houses.`, xp: 40 + n * 6, shells: 4 + Math.floor(n / 2) }; });
  pool.push(() => { const unlocked = palette.length; const c = Math.floor(r(3) * unlocked); const n = 2 + Math.floor(r(4) * 3); const nm = COLOUR_NAMES(palette)[c]; return { kind: "colour", c, n, base: a.colourCount.get(c) || 0, text: `${folk[0]} dreams of ${nm.toLowerCase()} walls: build ${n} ${nm} houses.`, xp: 50 + n * 10, shells: 6 + n }; });
  if (a.tallest < 8) pool.push(() => { const h = Math.min(8, Math.max(3, a.tallest + 1 + Math.floor(r(5) * 2))); return { kind: "tower", n: h, text: `${folk[0]} wants to see the whole bay: raise a tower ${h} floors high.`, xp: 40 + h * 15, shells: 5 + h * 2 }; });
  pool.push(() => ({ kind: "terrace", n: 1 + Math.floor(r(6) * 2), base: a.terraces || 0, text: `${folk[0]} would love a rooftop garden: build next to a taller house so a garden appears.`, xp: 70, shells: 8 }));
  pool.push(() => ({ kind: "bridge", n: 1, base: a.bridges, text: `${folk[0]} wants to cross without a boat: build a house that hangs out over the water.`, xp: 80, shells: 10 }));
  if (a.houses >= 10) pool.push(() => ({ kind: "courtyard", n: 1, base: a.courtyards, text: `${folk[0]} wants a quiet courtyard: enclose a patch of sea with houses on all four sides.`, xp: 120, shells: 15 }));
  const props = PROPS.filter((p) => p.lvl <= L);
  if (props.length) pool.push(() => { const p = props[Math.floor(r(7) * props.length)]; const n = p.cost > 30 ? 1 : 1 + Math.floor(r(8) * 2); return { kind: "prop", t: p.id, n, base: a.propCount[p.id] || 0, text: `${folk[0]} asks for ${n === 1 ? "a" : n} ${p.name.toLowerCase()}${n > 1 ? "s" : ""} ${p.where === "water" ? "in the harbour" : "on the rooftops"}.`, xp: 50 + p.cost, shells: Math.max(5, Math.floor(p.cost * 0.6)) }; });
  if (a.colours < palette.length) pool.push(() => { const n = Math.min(palette.length, a.colours + 2); return { kind: "colours", n, text: `${folk[0]} says the town needs more colour: use ${n} different colours.`, xp: 60, shells: 8 }; });
  const w = pool[Math.floor(r(9) * pool.length)]();
  return { id: "w" + seed, folk: folk[0], icon: folk[1], role: folk[2], ...w };
}
export function wishProgress(w, a) {
  switch (w.kind) {
    case "more": return [Math.max(0, a.houses - w.base), w.n];
    case "colour": return [Math.max(0, (a.colourCount.get(w.c) || 0) - w.base), w.n];
    case "tower": return [Math.min(a.tallest, w.n), w.n];
    case "terrace": return [Math.max(0, (a.terraces || 0) - (w.base || 0)), w.n];
    case "bridge": return [Math.max(0, a.bridges - w.base), w.n];
    case "courtyard": return [Math.max(0, a.courtyards - w.base), w.n];
    case "prop": return [Math.max(0, (a.propCount[w.t] || 0) - w.base), w.n];
    case "colours": return [Math.min(a.colours, w.n), w.n];
    default: return [0, 1];
  }
}

// ---- the saved progress (shared by every island) ----------------------------------------------------------------------------------------------------
const PKEY = "ashtide-progress-v1";
export function loadProgress() {
  let P = null; try { P = JSON.parse(localStorage.getItem(PKEY) || "null"); } catch {}
  P = { xp: 0, shells: 20, found: {}, island: "harbour", towns: {}, wishes: [], wishSeed: 1, maxBlocks: {}, skipAt: 0, ...(P || {}) };
  P.level = levelOf(P.xp).level; return P;
}
export function saveProgress(P) { try { const { level, _t, ...rest } = P; localStorage.setItem(PKEY, JSON.stringify(rest)); } catch {} }
