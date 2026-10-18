// "Sunstone Bazaar" — high noon in a sandstone market town. Long sight lines down Long A, a fountain crossroads in the middle,
// a covered tunnel to B and a doorway-wide choke in Mid. Bright, hard shadows: easy to read friend from foe.
import { WALL_H } from "../mapkit";

const zones = [
  { id: "ct", name: "CT Courtyard", rect: [21, 2, 34, 8], floor: "stone" },
  { id: "a", name: "A Plaza", rect: [37, 2, 52, 12], floor: "tiles" },
  { id: "b", name: "B Market", rect: [3, 2, 17, 11], floor: "tiles" },
  { id: "ctb", name: "West Arch", rect: [18, 4, 20, 7], floor: "stone", roof: true },
  { id: "cta", name: "East Arch", rect: [35, 4, 36, 7], floor: "stone", roof: true },
  { id: "mid", name: "Mid Street", rect: [25, 9, 30, 31], floor: "stone" },
  { id: "fount", name: "Fountain", rect: [21, 12, 34, 16], floor: "stone" },
  { id: "door", name: "Mid Doors", rect: [25, 22, 30, 23], floor: "stone", roof: true },
  { id: "along", name: "Long A", rect: [46, 13, 52, 33], floor: "dirt" },
  { id: "aramp", name: "A Ramp", rect: [41, 13, 45, 19], floor: "stone" },
  { id: "epass", name: "East Passage", rect: [35, 14, 40, 16], floor: "stone", roof: true },
  { id: "palace", name: "Palace", rect: [31, 25, 45, 28], floor: "stone", roof: true },
  { id: "btun", name: "B Tunnels", rect: [4, 13, 8, 34], floor: "stone", roof: true },
  { id: "bhall", name: "B Hall", rect: [9, 12, 13, 20], floor: "stone" },
  { id: "wpass", name: "West Passage", rect: [14, 13, 20, 15], floor: "stone", roof: true },
  { id: "low", name: "Lower Tunnel", rect: [9, 21, 24, 24], floor: "stone", roof: true },
  { id: "south", name: "South Market", rect: [16, 27, 39, 34], floor: "stone" },
  { id: "tramp", name: "T Ramp", rect: [24, 34, 31, 36], floor: "stone", roof: true },
  { id: "tspawn", name: "T Spawn", rect: [20, 36, 36, 43], floor: "dirt" },
  { id: "tw", name: "West Gate", rect: [9, 36, 19, 40], floor: "stone", roof: true },
  { id: "te", name: "East Gate", rect: [37, 36, 47, 40], floor: "stone", roof: true },
  { id: "wy", name: "West Yard", rect: [3, 35, 8, 43], floor: "dirt" },
  { id: "ey", name: "East Yard", rect: [48, 35, 52, 43], floor: "dirt" },
];

const sites = {
  A: { cx: 44.5, cz: 7, r: 10.5, color: 0xffb04a },
  B: { cx: 10, cz: 6.5, r: 10.5, color: 0x6fe0b4 },
};

const props = (R) => {
  // ---- A plaza
  R("column", 43.5, 6, 44.5, 7, WALL_H); R("stall", 39, 9, 42.2, 10.2, 1.2, { color: 0 }); R("stall", 47, 3, 50.2, 4.2, 1.2, { color: 2 });
  R("crate", 49, 8, 50.2, 9.2, 2.6); R("crate", 50.2, 8, 51.4, 9.2, 1.3); R("crate", 49, 9.2, 50.2, 10.4, 1.3);
  R("lowwall", 44, 10.2, 47.6, 10.8, 1.2); R("planter", 37.6, 2.4, 39, 3.8, 0.9); R("planter", 50.8, 5.5, 52.2, 6.9, 0.9);
  // ---- Long A
  R("crate", 46, 17, 48, 19, 1.4); R("cart", 50, 22, 52, 23.6, 1.2); R("stall", 47, 27, 49.6, 28.2, 1.2, { color: 1 }); R("barrel", 51, 30, 51.5, 30.5, 1.1); R("barrel", 51.6, 30.3, 52.1, 30.8, 1.1);
  R("lowwall", 46, 23, 47, 25.6, 1.3); R("sacks", 50.4, 15, 52, 16.2, 0.9);
  // ---- A ramp and east passage
  R("crate", 42, 16, 43.2, 17.2, 1.3); R("planter", 44, 13.2, 45.2, 14.4, 0.9);
  // ---- Mid, doors, fountain
  R("fountain", 27, 13, 29, 15, 1.0); R("block", 25, 22, 27, 24, WALL_H); R("block", 29, 22, 31, 24, WALL_H);
  R("crate", 25, 18, 26.3, 19.3, 1.3); R("sacks", 29, 26, 30.6, 27.4, 0.9); R("cart", 25.2, 28.6, 27.2, 30, 1.2); R("barrel", 29.6, 12.2, 30.1, 12.7, 1.1);
  R("crate", 21.4, 12.4, 22.6, 13.6, 1.3); R("planter", 32.4, 12.4, 33.8, 13.8, 0.9);
  // ---- palace
  R("column", 36, 26, 37, 27, WALL_H); R("crate", 41, 25, 42.2, 26.2, 1.3); R("sacks", 33, 27.2, 34.6, 28, 0.9);
  // ---- B market
  R("stall", 4, 3, 7.2, 4.2, 1.2, { color: 1 }); R("crate", 12, 7, 13.2, 8.2, 2.6); R("crate", 13.2, 7, 14.4, 8.2, 1.3); R("sacks", 5, 9, 7, 10, 0.9); R("column", 8, 6, 9, 7, WALL_H);
  R("lowwall", 11, 3, 15, 3.6, 1.2); R("planter", 16, 9.4, 17.4, 10.8, 0.9); R("barrel", 4.4, 6.4, 4.9, 6.9, 1.1); R("barrel", 5, 6.6, 5.5, 7.1, 1.1);
  // ---- B tunnels, hall, passages
  R("crate", 5, 20, 6.3, 21.3, 1.3); R("barrel", 7, 28, 7.5, 28.5, 1.1); R("crate", 5, 30, 6.4, 31.4, 1.4); R("crate", 10, 15, 11.4, 16.4, 1.4); R("column", 12, 18, 13, 19, WALL_H);
  R("crate", 15, 21, 16.3, 22.3, 1.3); R("barrel", 19, 23, 19.5, 23.5, 1.1); R("column", 13, 22, 14, 23, WALL_H); R("crate", 17.4, 13.2, 18.6, 14.4, 1.3);
  // ---- south market
  R("stall", 18, 29, 21.2, 30.2, 1.2, { color: 2 }); R("stall", 34, 29, 37.2, 30.2, 1.2, { color: 0 }); R("stall", 18, 32, 21.2, 33.2, 1.2, { color: 1 }); R("stall", 34, 32, 37.2, 33.2, 1.2, { color: 2 });
  R("lowwall", 26, 31.4, 30.4, 32, 1.3); R("crate", 23, 28, 24.2, 29.2, 1.3); R("barrel", 32, 28.2, 32.5, 28.7, 1.1);
  // ---- t spawn and gates
  R("cart", 22, 41, 24.2, 42.6, 1.2); R("crate", 33, 41, 34.4, 42.4, 1.4); R("sacks", 28, 38, 30.4, 38.8, 0.9);
  R("crate", 13, 37, 14.2, 38.2, 1.3); R("barrel", 41, 38, 41.5, 38.5, 1.1);
  R("crate", 4, 38, 6, 40, 1.4); R("barrel", 4.4, 36, 4.9, 36.5, 1.1); R("sacks", 49, 38, 51, 39.2, 0.9); R("crate", 49.5, 41.4, 51, 42.8, 1.4);
};

const cp = (i, j) => [i, j];
export default {
  id: "bazaar", name: "Sunstone Bazaar", tagline: "High noon · sandstone market", time: "day", cols: 56, rows: 46,
  zones, sites, props,
  tSpawns: [[24, 39], [26, 40], [28, 41], [30, 40], [22, 39], [27, 42], [33, 39]],
  pSpawns: [[24, 4], [26, 3], [28, 4], [30, 3], [32, 4], [27, 6], [31, 6]],
  routes: {
    A: { long: [cp(44, 38), cp(49, 36), cp(49, 20)], palace: [cp(27.5, 33), cp(27.5, 26.5), cp(40, 26.5), cp(48, 24)], mid: [cp(27.5, 33), cp(27.5, 17), cp(38, 15), cp(43, 15)] },
    B: { tunnels: [cp(14, 38), cp(6, 36), cp(6, 20)], lower: [cp(27.5, 33), cp(27.5, 25), cp(16, 22.5), cp(11, 19)], mid: [cp(27.5, 33), cp(27.5, 17), cp(17, 14), cp(11, 14)] },
  },
  holds: {
    A: [{ p: cp(44.5, 9), look: cp(49, 24) }, { p: cp(40.5, 5.5), look: cp(43, 14) }, { p: cp(49, 5.5), look: cp(49, 16) }],
    B: [{ p: cp(8, 9.5), look: cp(6, 22) }, { p: cp(12, 5), look: cp(11, 14) }, { p: cp(14.5, 9), look: cp(11, 16) }],
    M: [{ p: cp(27.5, 10.5), look: cp(27.5, 24) }, { p: cp(23, 14), look: cp(27.5, 20) }, { p: cp(32.5, 14), look: cp(27.5, 20) }],
  },
  entrances: { A: [cp(49, 12.5), cp(43, 12.5), cp(36, 5.5)], B: [cp(6, 12.5), cp(11, 12.5), cp(19, 5.5)] },
  signZones: [["a","A SITE","#c8501e","BOMBSITE"],["b","B SITE","#1e7c6a","BOMBSITE"],["along","LONG A","#c8501e","EAST ROAD"],["mid","MID","#7a5a2a","CROSSROADS"],["btun","TUNNELS","#1e7c6a","TO B"],["palace","PALACE","#7a5a2a","TO A"],["tspawn","T SPAWN","#9a3a1a","NIGHTFALL"],["ct","CT SPAWN","#245a9a","SENTINEL"],["fount","FOUNTAIN","#245a9a","SQUARE"],["south","BAZAAR","#7a5a2a","SOUTH MARKET"]],
  look: {
    mode: "day", exposure: 1.05, bloom: [0.22, 0.5, 0.92], dress: "bazaar",
    sky: { zenith: 0x2f6fc8, mid: 0x5d9ae0, horizon: 0xcfe2f2, sunDir: [-0.45, 0.82, -0.35], sunColor: 0xfff2d2, sunSize: 0.006, glow: 0.7, cloud: 0.42, cloudColor: 0xffffff, cloudShade: 0xb4c4dc, stars: 0, wind: 0.004 },
    fog: [0xd2e0ee, 0.0022], hemi: [0xc8defa, 0xd2b080, 3.4], sun: { color: 0xfff0d0, intensity: 5.2, off: [-30, 56, -22] }, env: 0.8,
    floors: { stone: { m: "stone", o: { seed: 21, colors: ["#b69c76", "#e0cca6"] }, c: 0xffffff, r: 0.82 }, tiles: { m: "tiles", o: { seed: 22, colors: ["#b8733c", "#dca46a"], rows: 6, cols: 6 }, c: 0xffffff, r: 0.7 }, dirt: { m: "dirt", o: { seed: 23, colors: ["#b8996a", "#d8bf90"] }, c: 0xffffff, r: 0.95 } },
    wall: { m: "stone", o: { seed: 24, colors: ["#c8ab7e", "#ead2a6"] }, c: 0xffffff }, trim: 0xd9c196, roof: 0xb89a6c, under: 0xb89a6c,
    awning: [0xc8402a, 0x2a6aa8, 0xd8a62a, 0x2f8a5a], crates: 0xc9a06a, contCols: [0x9a4a2a, 0x2c6a8c, 0x3c7e4c, 0xd2862a, 0x8a8e94, 0x8c3e3a],
    skylineColors: [0xd9bf8c, 0xc9a874, 0xe6d0a2, 0xbf9a68], far: { ground: 0xc9ad7c, hills: 0xb8996a },
    dust: 0xfff0c8,
  },
};
