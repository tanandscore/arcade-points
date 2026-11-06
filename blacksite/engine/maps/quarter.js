// "Old Quarter" — golden hour in a hillside harbour town. Tight stone alleys, barrel-lined lanes, a piazza fountain and a market square.
// CT start in the north-west piazza; T land at the harbour steps in the south-east. A is a walled courtyard, B a sunny terrace.
import { WALL_H } from "../mapkit";

const zones = [
  { id: "ct", name: "CT Piazza", rect: [3, 3, 13, 10], floor: "stone" },
  { id: "a", name: "A Courtyard", rect: [3, 18, 14, 27], floor: "tiles" },
  { id: "b", name: "B Terrace", rect: [28, 3, 42, 11], floor: "tiles" },
  { id: "bake", name: "Bakery Lane", rect: [14, 5, 27, 7], floor: "stone" },
  { id: "fa", name: "Fountain Alley", rect: [8, 11, 10, 17], floor: "stone" },
  { id: "clock", name: "Clock Passage", rect: [11, 12, 23, 14], floor: "stone", roof: true },
  { id: "barrel", name: "Barrel Alley", rect: [24, 8, 27, 19], floor: "stone" },
  { id: "sq", name: "Market Square", rect: [20, 20, 33, 31], floor: "stone" },
  { id: "cellar", name: "Cellar Passage", rect: [15, 20, 19, 22], floor: "stone", roof: true },
  { id: "tailor", name: "Tailor Street", rect: [15, 25, 19, 27], floor: "stone" },
  { id: "wine", name: "Wine Alley", rect: [5, 28, 8, 38], floor: "stone" },
  { id: "lower", name: "Lower Piazza", rect: [3, 36, 20, 43], floor: "stone" },
  { id: "road", name: "Harbour Road", rect: [21, 38, 40, 41], floor: "stone" },
  { id: "tspawn", name: "Harbour Steps", rect: [41, 35, 52, 43], floor: "stone" },
  { id: "cart", name: "Cart Road", rect: [44, 25, 48, 34], floor: "dirt" },
  { id: "orange", name: "Orange Street", rect: [34, 22, 48, 24], floor: "stone" },
  { id: "roofs", name: "Roof Stairs", rect: [47, 10, 50, 21], floor: "stone" },
  { id: "bal", name: "Balcony Road", rect: [43, 5, 48, 9], floor: "stone" },
];

const sites = {
  A: { cx: 8.5, cz: 22.5, r: 10.5, color: 0xffb04a },
  B: { cx: 35, cz: 7, r: 10.5, color: 0x6fe0b4 },
};

const props = (R) => {
  // ---- CT piazza
  R("fountain", 7, 5.4, 9.4, 7.8, 1.0); R("planter", 3.2, 3.2, 4.6, 4.6, 0.9); R("planter", 11.6, 8.6, 13, 10, 0.9); R("table", 11, 3.4, 12.6, 4.6, 0.8);
  // ---- A courtyard: well, crates, barrels
  R("fountain", 7.6, 21.6, 9.6, 23.6, 1.0); R("crate", 4, 19, 5.4, 20.4, 1.4); R("barrel", 12.6, 18.6, 13.1, 19.1, 1.1); R("barrel", 13.2, 18.9, 13.7, 19.4, 1.1); R("barrel", 12.8, 19.4, 13.3, 19.9, 1.1);
  R("lowwall", 4, 25, 6.6, 25.6, 1.3); R("crate", 11.6, 25, 12.8, 26.2, 2.6); R("crate", 12.8, 25, 14, 26.2, 1.3); R("planter", 3.2, 22, 4.6, 23.4, 0.9); R("cart", 11, 21.6, 13, 23, 1.2);
  // ---- fountain alley, bakery lane, clock passage
  R("barrel", 9.4, 14.6, 9.9, 15.1, 1.1); R("crate", 8, 12, 9.2, 13.2, 1.3);
  R("barrel", 20, 5.2, 20.5, 5.7, 1.1); R("barrel", 20.6, 5.5, 21.1, 6, 1.1); R("cart", 24, 6, 26, 7, 1.2);
  R("crate", 19.4, 13, 20.6, 14.2, 1.3); R("barrel", 21.4, 12.2, 21.9, 12.7, 1.1);
  // ---- barrel alley (the barrels from the reference photo)
  R("barrel", 24, 14, 24.5, 14.5, 1.1); R("barrel", 24, 14.6, 24.5, 15.1, 1.1); R("barrel", 24.6, 14.3, 25.1, 14.8, 1.1); R("barrel", 24.3, 14.4, 24.8, 14.9, 1.9);
  R("crate", 26, 17, 27.2, 18.2, 1.3);
  // ---- market square
  R("fountain", 25.5, 24.5, 28, 27, 1.0); R("stall", 21, 21, 24.2, 22.2, 1.2, { color: 0 }); R("stall", 29.6, 28.6, 32.8, 29.8, 1.2, { color: 2 }); R("crate", 31, 21, 32.2, 22.2, 1.3);
  R("lowwall", 21, 29.6, 23.6, 30.2, 1.3); R("barrel", 20.6, 26, 21.1, 26.5, 1.1); R("sacks", 30, 25, 31.6, 26.2, 0.9); R("column", 23, 25, 24, 26, WALL_H);
  // ---- cellar, tailor, wine alley, lower piazza
  R("barrel", 16, 20.4, 16.5, 20.9, 1.1); R("crate", 17.6, 25.2, 18.8, 26.4, 1.3); R("barrel", 6, 30, 6.5, 30.5, 1.1); R("barrel", 6.6, 30.4, 7.1, 30.9, 1.1); R("crate", 5, 33.4, 6.2, 34.6, 1.3);
  R("fountain", 10, 38.6, 12.4, 41, 1.0); R("stall", 14.2, 37, 17.4, 38.2, 1.2, { color: 1 }); R("crate", 4, 40, 5.4, 41.4, 1.4); R("planter", 18, 41.4, 19.6, 42.8, 0.9); R("cart", 3.6, 37, 5.6, 38.4, 1.2);
  // ---- harbour road + T steps
  R("crate", 26, 39, 27.4, 40.4, 1.3); R("barrel", 33, 38.4, 33.5, 38.9, 1.1); R("sacks", 36, 40, 38, 41, 0.9);
  R("crate", 43, 38, 44.4, 39.4, 1.4); R("crate", 48.6, 36, 50, 37.4, 1.4); R("lowwall", 45, 41.4, 49, 42, 1.3); R("barrel", 50.6, 40, 51.1, 40.5, 1.1); R("cart", 42, 41.4, 44, 43, 1.2);
  // ---- cart road, orange street, roof stairs, balcony road
  R("crate", 45, 29, 46.4, 30.4, 1.3); R("barrel", 47, 32, 47.5, 32.5, 1.1); R("crate", 38, 22, 39.2, 23.2, 1.3); R("barrel", 42, 23.4, 42.5, 23.9, 1.1);
  R("crate", 48, 14, 49.2, 15.2, 1.3); R("planter", 49.6, 18, 51, 19.4, 0.9); R("barrel", 44.4, 5.4, 44.9, 5.9, 1.1);
  // ---- B terrace
  R("fountain", 34, 6, 36.4, 8.4, 1.0); R("table", 38, 3.4, 39.6, 4.6, 0.8); R("table", 40.4, 3.4, 42, 4.6, 0.8); R("planter", 29, 3.2, 30.4, 4.6, 0.9); R("crate", 29.6, 9, 31.2, 10.4, 2.6); R("crate", 31.2, 9, 32.4, 10.2, 1.3);
  R("lowwall", 37.6, 9.8, 41, 10.4, 1.3); R("barrel", 41.2, 7, 41.7, 7.5, 1.1); R("column", 31.5, 5.5, 32.5, 6.5, WALL_H);
};

const cp = (i, j) => [i, j];
export default {
  id: "quarter", name: "Old Quarter", tagline: "Golden hour · stone alleys", time: "day", cols: 56, rows: 46,
  zones, sites, props,
  tSpawns: [[43, 37], [45, 38], [47, 37], [49, 38], [44, 41], [47, 40], [50, 41]],
  pSpawns: [[4, 4], [6, 4], [8, 4], [10, 4], [5, 8], [8, 9], [11, 7]],
  routes: {
    A: { lower: [cp(40, 39.5), cp(20, 39.5), cp(6.5, 38), cp(7.5, 31)], square: [cp(45, 34), cp(46, 26), cp(40, 23), cp(26, 22), cp(17, 21)], tailor: [cp(45, 34), cp(46, 26), cp(40, 23), cp(30, 23), cp(26, 27.5), cp(17, 26)] },
    B: { east: [cp(46, 34), cp(46, 26), cp(47, 22), cp(48, 12), cp(44, 7)], barrel: [cp(46, 34), cp(46, 24), cp(34, 23), cp(26, 22), cp(25.5, 14)] },
  },
  holds: {
    A: [{ p: cp(6, 19.5), look: cp(9, 28) }, { p: cp(12.5, 23), look: cp(17, 21) }, { p: cp(9, 17), look: cp(9, 21) }],
    B: [{ p: cp(31, 8), look: cp(25.5, 15) }, { p: cp(40, 5), look: cp(44, 7.5) }, { p: cp(36, 10), look: cp(36, 6) }],
    M: [{ p: cp(16, 13), look: cp(23, 13) }, { p: cp(9, 13), look: cp(9, 18) }, { p: cp(25.5, 15), look: cp(25.5, 21) }],
  },
  entrances: { A: [cp(9, 17.5), cp(14.5, 21), cp(6.5, 28.5)], B: [cp(25.5, 9.5), cp(44, 7), cp(28.5, 5.5)] },
  signZones: [["a","A COURTYARD","#c8501e","CORTILE"],["b","B TERRACE","#1e7c6a","TERRAZZA"],["ct","CT PIAZZA","#245a9a","SENTINEL"],["tspawn","HARBOUR STEPS","#9a3a1a","NIGHTFALL"],["sq","MARKET SQUARE","#7a5a2a","MERCATO"],["barrel","VIA BOTTI","#7a5a2a","BARREL ALLEY"],["wine","VIA DEL VINO","#7a2a3a","WINE ALLEY"],["road","LUNGOMARE","#2a5a8a","HARBOUR ROAD"]],
  look: {
    mode: "day", exposure: 1.0, bloom: [0.16, 0.5, 0.94], dress: "quarter",
    sky: { zenith: 0x4a70a8, mid: 0x9aaecb, horizon: 0xf6cfa0, sunDir: [-0.62, 0.3, 0.5], sunColor: 0xffdcb4, sunSize: 0.007, glow: 0.9, cloud: 0.36, cloudColor: 0xffe6cc, cloudShade: 0x8a82a8, stars: 0, wind: 0.005 },
    fog: [0xe2d2b8, 0.0032], hemi: [0xb4c4e0, 0xa88a66, 2.3], sun: { color: 0xffddb4, intensity: 5.8, off: [-40, 30, 34] }, env: 0.72,
    floors: { stone: { m: "stone", o: { seed: 41, colors: ["#7e6f5c", "#b3a389"] }, c: 0xffffff, r: 0.9 }, tiles: { m: "tiles", o: { seed: 42, colors: ["#9a5030", "#c47e52"], rows: 8, cols: 8 }, c: 0xffffff, r: 0.8 }, dirt: { m: "dirt", o: { seed: 43, colors: ["#8f7452", "#b69a72"] }, c: 0xffffff, r: 0.95 } },
    wall: { m: "stone", o: { seed: 44, colors: ["#c8ae8c", "#e6d2ae"], joint: "#8a7d66" }, c: 0xffffff }, trim: 0xdac8a6, roof: 0x9a6644, under: 0x806c52,
    awning: [0xa8382a, 0x2a5f88, 0xc09628, 0x45784a], crates: 0xc4a87e, contCols: [0x8a4a30, 0x2f5a74, 0x41694a, 0xb27a34, 0x7a7e82, 0x7a3c38],
    skylineColors: [0xdcc29a, 0xd0aa84, 0xe8d2ae, 0xc6967a], far: { ground: 0x8c7c5e, hills: 0x667262 }, sea: 0x4a7a9c,
    dust: 0xffe4b8,
  },
};
