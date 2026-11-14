// Hushwell — nine hand-built chapters. Written with the Grid helper so every jump is within the hero's real reach
// (jump = 2 tiles up, 3 tiles across; a spring flings you 5 tiles up).
import { Grid } from "../../core/lvl";

function room(w, { ceilY = 2, floorY = 12, wallL = true } = {}) {
  const G = new Grid(w, 14); G.floor(0, w - 1, floorY); G.ceil(0, w - 1, ceilY - 1); if (wallL) G.wall(0, 0, 13); G.wall(w - 1, 0, 13); return G;
}
const run = (G, id, o) => ({ id, rows: G.rows(), ...o });

// 1-1 Cold Start — walk, jump, spikes, push a crate onto a plate
function l11() {
  const G = room(84); G.put(3, 11, "S");
  G.pit(21, 22, 12); G.coins(20, 23, 9);
  G.spikes(34, 35, 11);
  G.put(45, 11, "b"); G.put(53, 11, "1");
  G.rect(57, 2, 59, 7, "X"); G.rect(58, 8, 58, 11, "7"); // a gate you cannot jump over
  G.put(40, 11, "n");
  G.plank(26, 30, 10); G.put(28, 9, "$");
  G.put(66, 11, "C"); G.coins(62, 65, 11);
  G.rect(70, 10, 72, 11, "X"); G.put(71, 9, "$");
  G.put(78, 11, "E");
  G.put(11, 11, "n"); G.put(20, 6, "L");
  return run(G, "1-1", { name: "Cold Start", look: "city", theme: "factory", seed: 1, parTime: 70, parDeaths: 2, notes: ["Walk with ◀ ▶. Jump with SPACE.", "Push the crate by walking into it. Something heavy opens doors."], hints: [[2, "Jump over the gap and avoid the spikes."]] });
}
// 1-2 Weighted Doors — two plates, two gates
function l12() {
  const G = room(96); G.put(3, 11, "S");
  G.put(10, 11, "b"); G.put(20, 11, "1");
  G.rect(24, 2, 26, 7, "X"); G.rect(25, 8, 25, 11, "7");
  G.put(8, 11, "n");
  G.rect(30, 12, 41, 13, "^"); G.plank(31, 32, 11); G.plank(35, 36, 10); G.plank(39, 40, 11);
  G.put(35, 9, "$");
  G.put(44, 11, "b"); G.put(52, 11, "2");
  G.rect(56, 2, 58, 7, "X"); G.rect(57, 8, 57, 11, "8");
  G.put(47, 11, "n");
  G.put(66, 11, "C");
  G.put(72, 11, "s"); G.plank(75, 79, 7); G.put(77, 6, "$"); G.rect(82, 8, 86, 13, "X");
  G.put(90, 11, "E");
  G.coins(14, 18, 11); G.coins(60, 64, 11);
  return run(G, "1-2", { name: "Weighted Doors", look: "city", theme: "factory", seed: 2, parTime: 80, parDeaths: 2, notes: ["Crates can hold a plate down for you.", "Careful: the spikes below are real."] });
}
// 1-3 Downpipe — springs, crushers, a plank climb
function l13() {
  const G = room(104); G.put(3, 11, "S");
  G.put(10, 8, "V"); G.put(18, 8, "V");
  G.pit(26, 27, 12); G.coins(25, 28, 10);
  G.put(34, 11, "s"); G.plank(37, 41, 7); G.put(39, 6, "$");
  G.rect(44, 10, 47, 13, "X"); G.put(45, 9, "C");
  G.put(52, 8, "V"); G.put(58, 8, "V"); G.put(64, 8, "V");
  G.rect(68, 12, 74, 13, "^"); G.plank(67, 68, 10); G.plank(71, 72, 9); G.plank(75, 76, 10);
  G.put(72, 8, "$");
  G.put(82, 11, "b"); G.put(88, 11, "1"); G.rect(92, 2, 94, 7, "X"); G.rect(93, 8, 93, 11, "7");
  G.put(100, 11, "E");
  G.put(30, 11, "L"); G.put(80, 8, "L");
  return run(G, "1-3", { name: "Downpipe", look: "city", theme: "factory", seed: 3, parTime: 90, parDeaths: 3, notes: [], hints: [[8, "Crushers drop when you walk under them. Run through the gap after they land."]] });
}
// 2-1 Wet Dark
function l21() {
  const G = room(100, { ceilY: 2 }); G.put(3, 11, "S"); G.rect(1, 1, 99, 13, "."); G.floor(0, 99, 12); G.ceil(0, 99, 1); G.wall(0, 0, 13); G.wall(99, 0, 13);
  G.put(3, 11, "S");
  G.rect(12, 11, 30, 11, "W"); G.coins(14, 28, 10);
  G.rect(34, 10, 38, 13, "X"); G.put(36, 9, "C");
  G.put(44, 11, "L"); G.pit(48, 49, 12);
  G.plank(53, 56, 10); G.put(55, 9, "$"); G.plank(59, 62, 8);
  G.rect(66, 11, 80, 11, "W"); G.put(84, 11, "b"); G.put(90, 11, "1"); G.rect(94, 2, 96, 7, "X"); G.rect(95, 8, 95, 11, "7");
  G.put(98, 11, "E");
  G.put(20, 11, "L"); G.put(72, 11, "L");
  return run(G, "2-1", { name: "Wet Dark", look: "cave", theme: "sewer", seed: 4, dark: true, lantern: 200, darkness: 0.8, parTime: 85, parDeaths: 2, notes: [], hints: [[3, "Your lantern lights the way. Stay near lamps to see more."]] });
}
// 2-2 Tick Tick — darts + crushers
function l22() {
  const G = room(108); G.put(3, 11, "S");
  G.put(14, 11, "t"); G.coins(8, 12, 11);
  G.put(30, 11, "T"); G.put(36, 8, "V"); G.put(46, 11, "t");
  G.rect(50, 10, 52, 11, "X"); G.put(53, 11, "C");
  G.put(60, 8, "V"); G.put(66, 8, "V"); G.put(72, 11, "T");
  G.rect(76, 12, 82, 13, "^"); G.plank(75, 76, 10); G.plank(78, 79, 9); G.plank(81, 82, 10); G.put(79, 8, "$");
  G.put(90, 11, "b"); G.put(96, 11, "2"); G.rect(100, 2, 102, 7, "X"); G.rect(101, 8, 101, 11, "8");
  G.put(105, 11, "E"); G.put(4, 11, "L"); G.put(52, 8, "L"); G.put(88, 8, "L");
  G.rect(20, 10, 22, 10, "X"); G.put(21, 9, "$");
  return run(G, "2-2", { name: "Tick Tick", look: "cave", theme: "sewer", seed: 5, dark: true, lantern: 190, darkness: 0.84, parTime: 95, parDeaths: 3, notes: [], hints: [[10, "Darts fly when you get close. Jump them or duck behind cover."]] });
}
// 2-3 Flood Run — a chase
function l23() {
  const G = room(120); G.put(6, 11, "S"); G.rect(0, 0, 0, 13, "X");
  G.pit(24, 25, 12); G.pit(40, 41, 12); G.pit(60, 61, 12);
  G.rect(46, 10, 47, 11, "X"); G.put(48, 11, "C");
  G.pit(78, 79, 12); G.put(90, 11, "s"); G.plank(92, 96, 7); G.pit(92, 96, 12); G.put(94, 6, "$");
  G.put(70, 9, "$"); G.rect(68, 10, 72, 10, "X"); G.coins(30, 36, 11);
  G.rect(104, 10, 106, 11, "X"); G.pit(110, 111, 12);
  G.put(118, 11, "E");
  const r = run(G, "2-3", { name: "Flood Run", look: "cave", theme: "sewer", seed: 6, dark: true, lantern: 210, darkness: 0.78, parTime: 60, parDeaths: 4, notes: [], chase: { x0: -100, speed: 128, trigger: 14 }, hints: [[3, "Something is coming. Don't stop!"]] });
  return r;
}
// 3-1 Quiet Feet — a guard and hiding places
function l31() {
  const G = room(90, { ceilY: 2 }); G.put(3, 11, "S");
  G.put(24, 11, "h"); G.put(16, 11, "z"); G.put(30, 11, "z");
  G.put(44, 11, "C"); G.put(54, 11, "h"); G.put(48, 11, "z"); G.put(64, 11, "z");
  G.rect(36, 11, 38, 11, "X"); G.put(37, 10, "$");
  G.put(72, 11, "b"); G.put(78, 11, "1"); G.rect(82, 2, 84, 7, "X"); G.rect(83, 8, 83, 11, "7");
  G.put(88, 11, "E"); G.put(14, 10, "n");
  G.coins(6, 12, 11);
  return run(G, "3-1", { name: "Quiet Feet", look: "city", theme: "ruins", seed: 7, parTime: 90, parDeaths: 3, notes: ["Hold ▼ inside tall grass to hide. Guards follow what they see.", ""], hints: [[8, "Hold DOWN in the grass and the guard can't see you."]], tint: "rgba(20,10,30,.25)" });
}
// 3-2 Key Hall
function l32() {
  const G = room(110); G.put(3, 11, "S");
  G.put(18, 11, "h"); G.put(10, 11, "z"); G.put(26, 11, "z");
  G.put(34, 11, "C"); G.put(40, 11, "k"); G.put(46, 11, "h"); G.put(52, 11, "z");
  G.rect(60, 2, 62, 9, "X"); G.rect(61, 10, 61, 11, "D");
  G.put(70, 11, "t"); G.put(78, 8, "V"); G.plank(82, 83, 10); G.plank(85, 86, 8); G.put(86, 7, "$");
  G.put(94, 11, "b"); G.put(100, 11, "1"); G.rect(103, 2, 104, 7, "X"); G.rect(104, 8, 104, 11, "7");
  G.put(108, 11, "E"); G.plank(16, 17, 10); G.plank(19, 20, 8); G.plank(22, 23, 6); G.put(22, 5, "$");
  return run(G, "3-2", { name: "Key Hall", look: "city", theme: "dungeon", seed: 8, parTime: 100, parDeaths: 3, notes: [], hints: [[34, "Grab the key. A locked door waits further on."]], tint: "rgba(20,10,30,.2)" });
}
// 3-3 The Hum — a long final run
function l33() {
  const G = room(150, { ceilY: 2 }); G.put(4, 11, "S"); G.rect(0, 0, 0, 13, "X");
  G.pit(26, 27, 12); G.put(36, 8, "V"); G.put(44, 8, "V");
  G.pit(54, 55, 12); G.put(60, 11, "s"); G.plank(62, 66, 7); G.put(64, 6, "$");
  G.put(70, 11, "C"); G.rect(78, 12, 86, 13, "^"); G.plank(77, 78, 10); G.plank(80, 81, 9); G.plank(83, 84, 10); G.plank(86, 87, 10);
  G.put(100, 11, "T"); G.put(108, 11, "T"); G.pit(112, 113, 12);
  G.put(124, 11, "s"); G.plank(126, 130, 7); G.put(128, 6, "$"); G.pit(126, 130, 12);
  G.pit(136, 137, 12); G.put(148, 11, "E");
  return run(G, "3-3", { name: "The Hum", look: "city", theme: "ruins", seed: 9, last: true, dark: false, tint: "rgba(120,20,30,.12)", parTime: 75, parDeaths: 4, notes: [], chase: { x0: -120, speed: 138, trigger: 12 }, hints: [[6, "Everything is shaking. Run."]] });
}
const BUILD = { "1-1": l11, "1-2": l12, "1-3": l13, "2-1": l21, "2-2": l22, "2-3": l23, "3-1": l31, "3-2": l32, "3-3": l33 };
export const hushLevel = (id) => BUILD[id]();
export const HUSH_WORLDS = [
  { name: "The Pump Hall", theme: "factory", music: "puzzle", blurb: "A silent plant. Crates, switches and heavy doors.", levels: [["1-1", "Cold Start", "Walk, jump, push."], ["1-2", "Weighted Doors", "Crates hold plates down."], ["1-3", "Downpipe", "Springs and falling weights."]] },
  { name: "The Drowned Floor", theme: "sewer", music: "spooky", blurb: "Dark, wet and dangerous. Bring your lantern.", levels: [["2-1", "Wet Dark", "See by lantern light."], ["2-2", "Tick Tick", "Darts and crushers."], ["2-3", "Flood Run", "Don't stop running."]] },
  { name: "The Bright Ward", theme: "ruins", music: "tense", blurb: "Guards. Keys. And something humming below.", levels: [["3-1", "Quiet Feet", "Hide from the guard."], ["3-2", "Key Hall", "Find the key."], ["3-3", "The Hum", "The end of the road."]] },
];
