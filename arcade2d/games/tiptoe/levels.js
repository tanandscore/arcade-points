// Tiptoe — nine chapters of sneaking through a house built for giants. Built with the Grid helper using the same proven shapes as Hushwell:
// gates sit under a stone lintel (X above, 7/8 below), hiding grass (z) sits 6-8 tiles either side of every guard (h).
import { Grid } from "../../core/lvl";
function room(w, { ceilY = 2, floorY = 12 } = {}) { const G = new Grid(w, 14); G.floor(0, w - 1, floorY); G.ceil(0, w - 1, ceilY - 1); G.wall(0, 0, 13); G.wall(w - 1, 0, 13); return G; }
const run = (G, id, o) => ({ id, rows: G.rows(), ...o });
const gate = (G, x, ch = "7") => { G.rect(x - 1, 2, x + 1, 7, "X"); G.rect(x, 8, x, 11, ch); };
const door = (G, x) => { G.rect(x - 1, 2, x + 1, 9, "X"); G.rect(x, 10, x, 11, "D"); };
const WARM = "rgba(255,150,40,.10)";

// 1-1 Under the Door
function l11() {
  const G = room(92); G.put(3, 11, "S"); G.coins(6, 12, 11); G.put(9, 11, "n");
  G.put(26, 11, "h"); G.put(18, 11, "z"); G.put(33, 11, "z");
  G.put(42, 11, "C"); G.put(54, 11, "h"); G.put(46, 11, "z"); G.put(61, 11, "z");
  G.rect(66, 11, 68, 11, "X"); G.put(67, 10, "$"); G.put(74, 11, "L"); G.put(88, 11, "E");
  return run(G, "1-1", { name: "Under the Door", look: "city", theme: "ruins", seed: 21, parTime: 75, parDeaths: 2, notes: ["You squeezed under the door. The house is so big. Hold ▼ in tall grass to hide."], hints: [[6, "The Keeper walks back and forth. Hide in the grass, then go when his back is turned."]], tint: WARM });
}
// 1-2 Crumbs
function l12() {
  const G = room(104); G.put(3, 11, "S");
  G.put(10, 11, "b"); G.put(20, 11, "1"); gate(G, 25);
  G.put(36, 11, "h"); G.put(28, 11, "z"); G.put(43, 11, "z");
  G.put(48, 11, "C"); G.put(58, 11, "b"); G.put(68, 11, "2"); gate(G, 73, "8");
  G.plank(78, 82, 9); G.put(80, 8, "$"); G.coins(14, 18, 11); G.coins(60, 66, 11);
  G.put(100, 11, "E"); G.put(8, 11, "n"); G.put(24, 8, "L");
  return run(G, "1-2", { name: "Crumbs", look: "city", theme: "ruins", seed: 22, parTime: 90, parDeaths: 2, notes: ["A crate on a plate holds a door open. Good thing crumbs are your size."], hints: [], tint: WARM });
}
// 1-3 Hanging Chains
function l13() {
  const G = room(108); G.put(3, 11, "S");
  G.put(10, 8, "V"); G.put(18, 8, "V"); G.pit(26, 27, 12); G.coins(25, 28, 10);
  G.put(40, 11, "h"); G.put(32, 11, "z"); G.put(47, 11, "z"); G.put(52, 11, "C");
  G.put(58, 8, "V"); G.put(64, 8, "V");
  G.rect(70, 12, 76, 13, "^"); G.plank(69, 70, 10); G.plank(73, 74, 9); G.plank(77, 78, 10); G.put(74, 8, "$");
  G.put(88, 11, "b"); G.put(94, 11, "1"); gate(G, 99); G.put(105, 11, "E"); G.put(80, 8, "L");
  return run(G, "1-3", { name: "Hanging Chains", look: "city", theme: "ruins", seed: 23, parTime: 95, parDeaths: 3, notes: [], hints: [[8, "Things drop when you walk underneath. Run through after they land."]], tint: WARM });
}
// 2-1 Cold Boiler
function l21() {
  const G = room(112); G.put(3, 11, "S");
  G.put(22, 11, "h"); G.put(14, 11, "z"); G.put(29, 11, "z"); G.put(34, 11, "C"); G.put(38, 11, "k");
  G.put(50, 11, "h"); G.put(44, 11, "z"); G.put(57, 11, "z"); door(G, 64);
  G.put(72, 11, "t"); G.put(80, 8, "V"); G.plank(84, 85, 10); G.plank(87, 88, 8); G.put(88, 7, "$");
  G.put(96, 11, "b"); G.put(102, 11, "1"); gate(G, 106); G.put(110, 11, "E");
  G.put(9, 11, "n"); G.coins(5, 9, 11);
  return run(G, "2-1", { name: "Cold Boiler", look: "city", theme: "factory", seed: 24, parTime: 105, parDeaths: 3, notes: ["The key hangs by the cold boiler. The iron door needs it."], hints: [[36, "Grab the key. A locked door is further on."]], tint: "rgba(255,120,30,.12)" });
}
// 2-2 Boil Over
function l22() {
  const G = room(112); G.put(3, 11, "S"); G.put(14, 11, "t"); G.coins(8, 12, 11);
  G.put(30, 11, "T"); G.put(38, 11, "h"); G.put(34, 11, "z"); G.put(46, 11, "z"); G.put(52, 11, "C");
  G.put(60, 8, "V"); G.put(66, 8, "V"); G.put(72, 11, "T");
  G.rect(76, 12, 82, 13, "^"); G.plank(75, 76, 10); G.plank(78, 79, 9); G.plank(81, 82, 10); G.put(79, 8, "$");
  G.put(92, 11, "b"); G.put(98, 11, "2"); gate(G, 102, "8"); G.put(108, 11, "E");
  G.put(4, 11, "L"); G.put(52, 8, "L");
  return run(G, "2-2", { name: "Boil Over", look: "city", theme: "factory", seed: 25, parTime: 100, parDeaths: 3, notes: [], hints: [[10, "Steam vents fire when you get close. Jump the jets."]], tint: "rgba(255,120,30,.12)" });
}
// 2-3 Run, Little One — a chase
function l23() {
  const G = room(124); G.put(6, 11, "S"); G.rect(0, 0, 0, 13, "X");
  G.pit(26, 27, 12); G.pit(42, 43, 12); G.pit(62, 63, 12); G.rect(48, 10, 49, 11, "X"); G.put(50, 11, "C");
  G.pit(80, 81, 12); G.put(92, 11, "s"); G.plank(94, 98, 7); G.pit(94, 98, 12); G.put(96, 6, "$");
  G.put(70, 9, "$"); G.rect(68, 10, 72, 10, "X"); G.coins(32, 38, 11); G.rect(106, 10, 108, 11, "X"); G.pit(112, 113, 12);
  G.put(122, 11, "E");
  return run(G, "2-3", { name: "Run, Little One", look: "city", theme: "factory", seed: 26, parTime: 62, parDeaths: 4, notes: [], chase: { x0: -100, speed: 130, trigger: 14 }, hints: [[3, "He saw you. Run!"]], tint: "rgba(255,60,30,.10)" });
}
// 3-1 Lamplight — dark cellar with guards
function l31() {
  const G = room(110); G.put(3, 11, "S");
  G.put(12, 11, "L"); G.put(28, 11, "h"); G.put(20, 11, "z"); G.put(35, 11, "z"); G.put(40, 11, "C");
  G.put(48, 11, "L"); G.put(58, 11, "h"); G.put(50, 11, "z"); G.put(65, 11, "z");
  G.rect(70, 11, 72, 11, "X"); G.put(71, 10, "$"); G.put(82, 11, "b"); G.put(90, 11, "1"); gate(G, 95); G.put(76, 11, "L"); G.put(107, 11, "E");
  return run(G, "3-1", { name: "Lamplight", look: "cave", theme: "sewer", seed: 27, dark: true, lantern: 200, darkness: 0.8, parTime: 100, parDeaths: 3, notes: ["The cellar is dark. Stay by the lamps, and listen for heavy footsteps."], hints: [[6, "Your lantern is small. Lamps light more of the cellar."]] });
}
// 3-2 The Heavy Door
function l32() {
  const G = room(116); G.put(3, 11, "S");
  G.put(18, 11, "h"); G.put(10, 11, "z"); G.put(26, 11, "z"); G.put(32, 11, "C"); G.put(38, 11, "k");
  G.put(46, 11, "h"); G.put(40, 11, "z"); G.put(53, 11, "z"); door(G, 60);
  G.put(68, 11, "t"); G.put(76, 8, "V"); G.plank(80, 81, 10); G.plank(83, 84, 8); G.put(84, 7, "$");
  G.put(92, 11, "b"); G.put(98, 11, "1"); gate(G, 103); G.put(112, 11, "E"); G.put(14, 8, "L"); G.put(60, 8, "L");
  return run(G, "3-2", { name: "The Heavy Door", look: "cave", theme: "dungeon", seed: 28, dark: true, lantern: 210, darkness: 0.72, parTime: 110, parDeaths: 3, notes: [], hints: [[34, "A key again. And another door that will not budge without it."]] });
}
// 3-3 The Big Door — final chase
function l33() {
  const G = room(156); G.put(4, 11, "S"); G.rect(0, 0, 0, 13, "X");
  G.pit(28, 29, 12); G.put(38, 8, "V"); G.put(46, 8, "V"); G.pit(56, 57, 12); G.put(62, 11, "s"); G.plank(64, 68, 7); G.put(66, 6, "$");
  G.put(72, 11, "C"); G.rect(80, 12, 88, 13, "^"); G.plank(79, 80, 10); G.plank(82, 83, 9); G.plank(85, 86, 10); G.plank(88, 89, 10);
  G.put(102, 11, "T"); G.put(110, 11, "T"); G.pit(114, 115, 12); G.put(126, 11, "s"); G.plank(128, 132, 7); G.put(130, 6, "$"); G.pit(128, 132, 12);
  G.pit(138, 139, 12); G.put(154, 11, "E");
  return run(G, "3-3", { name: "The Big Door", look: "city", theme: "ruins", seed: 29, last: true, tint: "rgba(255,40,30,.14)", parTime: 78, parDeaths: 4, notes: [], chase: { x0: -120, speed: 140, trigger: 12 }, hints: [[6, "The front door is just ahead. Do not stop."]] });
}
const BUILD = { "1-1": l11, "1-2": l12, "1-3": l13, "2-1": l21, "2-2": l22, "2-3": l23, "3-1": l31, "3-2": l32, "3-3": l33 };
export const tiptoeLevel = (id) => BUILD[id]();
export const TIPTOE_WORLDS = [
  { name: "The Great Hall", theme: "ruins", music: "puzzle", blurb: "Crumbs, crates and a very tall Keeper.", levels: [["1-1", "Under the Door", "Hide in the grass."], ["1-2", "Crumbs", "Crates hold doors open."], ["1-3", "Hanging Chains", "Things fall from above."]] },
  { name: "The Boiler Rooms", theme: "factory", music: "tense", blurb: "Hot, loud and full of keys.", levels: [["2-1", "Cold Boiler", "Find the key."], ["2-2", "Boil Over", "Steam vents and guards."], ["2-3", "Run, Little One", "He saw you."]] },
  { name: "The Cellar", theme: "sewer", music: "spooky", blurb: "Dark. Lamps are your friends.", levels: [["3-1", "Lamplight", "Stay near the lamps."], ["3-2", "The Heavy Door", "Another key, another guard."], ["3-3", "The Big Door", "Run for the front door."]] },
];
