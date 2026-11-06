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
    mode: "day", exposure: 1.0, bloom: [0.12, 0.45, 0.96], dress: "bazaar",
    // a hazy, sun-bleached noon: pale dusty sky, warm hard sun, cool fill in the shade
    sky: { zenith: 0x5a86bb, mid: 0x93b2d2, horizon: 0xe2e2da, sunDir: [-0.45, 0.82, -0.35], sunColor: 0xfff3dc, sunSize: 0.005, glow: 0.5, cloud: 0.28, cloudColor: 0xf4f2ee, cloudShade: 0xb8c0cc, stars: 0, wind: 0.004 },
    fog: [0xdad5c6, 0.0026], hemi: [0xaec8e6, 0x9a8260, 2.1], sun: { color: 0xfff0d4, intensity: 6.4, off: [-30, 56, -22] }, env: 0.65,
    floors: { stone: { m: "stone", o: { seed: 21, colors: ["#85785f", "#b8aa88"] }, c: 0xffffff, r: 0.9 }, tiles: { m: "tiles", o: { seed: 22, colors: ["#7f5a3e", "#ad8258"], rows: 6, cols: 5 }, c: 0xffffff, r: 0.8 }, dirt: { m: "dirt", o: { seed: 23, colors: ["#a08a64", "#c4ae86"] }, c: 0xffffff, r: 0.95 } },
    wall: { m: "stone", o: { seed: 24, colors: ["#b2a082", "#d6c4a0"], joint: "#8a7d66" }, c: 0xffffff }, trim: 0xcdb98e, roof: 0xa89066, under: 0xa89066,
    awning: [0xa4483a, 0x3a6684, 0xb09044, 0x4a7658], crates: 0xc4aa80, contCols: [0x8a4a30, 0x2f5a74, 0x41694a, 0xb27a34, 0x7a7e82, 0x7a3c38],
    skylineColors: [0xcbb68c, 0xbba37a, 0xd8c8a2, 0xb0966c], far: { ground: 0xbaa57c, hills: 0xa8946c },
    dust: 0xfff0cc,
  },
};
