// "Harbor Docks" — early morning at a container port. T comes in from the west dock, CT sit between the two sites on the east side.
// A is an open container yard, B is a roofed warehouse. A maze of stacked containers in the middle, quays along the north and south.
import { WALL_H } from "../mapkit";

const zones = [
  { id: "t", name: "T Dock", rect: [2, 15, 11, 30], floor: "concrete" },
  { id: "ct", name: "CT Yard", rect: [44, 18, 52, 27], floor: "concrete" },
  { id: "a", name: "A Container Yard", rect: [38, 3, 53, 12], floor: "concrete" },
  { id: "b", name: "B Warehouse", rect: [36, 33, 53, 42], floor: "concrete", roof: true },
  { id: "nq", name: "North Quay", rect: [12, 3, 37, 9], floor: "asphalt" },
  { id: "sq", name: "South Quay", rect: [12, 36, 35, 42], floor: "asphalt" },
  { id: "nramp", name: "North Ramp", rect: [4, 6, 11, 14], floor: "asphalt" },
  { id: "sramp", name: "South Ramp", rect: [4, 31, 11, 39], floor: "asphalt" },
  { id: "yard", name: "Container Yard", rect: [14, 12, 38, 33], floor: "asphalt" },
  { id: "mgate", name: "Mid Gate", rect: [12, 20, 15, 25], floor: "asphalt" },
  { id: "crane", name: "Crane Gap", rect: [30, 10, 38, 11], floor: "asphalt" },
  { id: "alink", name: "A Link", rect: [44, 13, 50, 17], floor: "concrete" },
  { id: "blink", name: "B Link", rect: [44, 28, 50, 32], floor: "concrete" },
  { id: "egate", name: "Gatehouse", rect: [39, 20, 43, 25], floor: "concrete", roof: true },
  { id: "office", name: "Port Office", rect: [46, 19, 49, 22], floor: "tiles", roof: true },
];

const sites = {
  A: { cx: 46.5, cz: 7.5, r: 10.5, color: 0xffb04a },
  B: { cx: 46.5, cz: 37.5, r: 10.5, color: 0x6fe0b4 },
};

const props = (R) => {
  // ---- the container maze (3 x 1 cells each, some double stacked)
  const C = (x, z, col, stack = false, vert = false) => { const w = vert ? 1 : 3, d = vert ? 3 : 1; R("container", x, z, x + w, z + d, 2.7, { color: col }); if (stack) R("container", x, z, x + w, z + d, 2.7, { color: (col + 2) % 6, y0: 2.7 }); };
  C(16, 14, 0, true); C(20, 14, 3); C(26, 14, 1, true); C(31, 14, 4, false); C(34.6, 15.6, 2, false, true);
  C(16, 17.6, 5); C(21, 17.6, 2, true); C(33, 18, 0); C(28, 17, 3, false, true);
  C(17, 28, 1, true); C(22, 28.4, 4); C(29, 27, 5, true); C(34, 28, 0, false); C(25.4, 30.6, 2, true);
  C(16, 31, 3); C(20.4, 24.2, 0, false, true); C(32.6, 22.4, 5, false, true); C(24, 21.4, 1, false, true);
  R("container", 25.5, 24.4, 28.5, 25.4, 2.7, { color: 4 });
  R("crate", 18, 22, 19.4, 23.4, 1.4); R("crate", 30, 25, 31.4, 26.4, 1.3); R("barrier", 22, 20, 24.6, 20.6, 1.1); R("barrier", 28.6, 20.4, 31.2, 21, 1.1);
  R("barrel", 14.6, 26.2, 15.1, 26.7, 1.1); R("barrel", 15.2, 26.5, 15.7, 27, 1.1); R("tank", 36, 24, 38, 26, 3.2);
  // ---- quays
  R("barrier", 16, 8, 19, 8.6, 1.1); R("crate", 23, 4, 24.4, 5.4, 1.4); R("pallets", 27, 7, 29, 8.4, 1.2); R("bollard", 33, 3.4, 33.6, 4, 0.9); R("container", 26, 3, 29, 4, 2.7, { color: 2 }); R("crate", 20, 7.4, 21.3, 8.7, 1.3);
  R("barrier", 20, 40, 23, 40.6, 1.1); R("crate", 28, 37, 29.4, 38.4, 1.4); R("pallets", 15, 39, 17, 40.4, 1.2); R("container", 24, 36, 27, 37, 2.7, { color: 1 }); R("barrel", 32, 41, 32.5, 41.5, 1.1); R("crate", 31, 38, 32.3, 39.3, 1.3);
  // ---- T dock + ramps
  R("crate", 3, 18, 4.4, 19.4, 1.4); R("container", 3, 24, 4, 27, 2.7, { color: 5 }); R("barrier", 8, 22, 11, 22.6, 1.1); R("barrel", 8, 17, 8.5, 17.5, 1.1); R("pallets", 7, 29.6, 9, 31, 1.2);
  R("crate", 7, 9, 8.4, 10.4, 1.3); R("crate", 6, 34, 7.4, 35.4, 1.3);
  // ---- A container yard
  R("container", 41, 3, 44, 4, 2.7, { color: 3 }); R("container", 48, 6, 51, 7, 2.7, { color: 0 }); R("crate", 44, 8, 45.4, 9.4, 2.6); R("crate", 45.4, 8, 46.8, 9.4, 1.3); R("crate", 44, 9.4, 45.4, 10.8, 1.3);
  R("tank", 40, 8, 42, 10, 3.2); R("barrier", 47, 10.4, 51, 11, 1.1); R("pallets", 50, 3, 52, 4.4, 1.2); R("column", 46, 5, 47, 6, WALL_H);
  // ---- links, ct yard, gatehouse
  R("crate", 45, 14, 46.4, 15.4, 1.3); R("barrier", 47, 24, 50, 24.6, 1.1); R("crate", 50, 19, 51.4, 20.4, 1.4); R("container", 50, 23, 51, 26, 2.7, { color: 4 }); R("barrel", 45, 25.4, 45.5, 25.9, 1.1);
  R("crate", 45, 29.4, 46.4, 30.8, 1.3);
  // ---- B warehouse: racks, pallets, forklift-size boxes
  R("crate", 41, 36, 43, 38, 2.6); R("crate", 43, 36, 44.4, 37.4, 1.3); R("pallets", 48, 36, 50, 37.4, 1.2); R("container", 38, 40, 41, 41, 2.7, { color: 2 });
  R("column", 44, 39, 45, 40, WALL_H); R("column", 49, 39, 50, 40, WALL_H); R("column", 44, 34, 45, 35, WALL_H); R("column", 49, 34, 50, 35, WALL_H);
  R("crate", 51, 39, 52.4, 40.4, 1.4); R("barrier", 46, 41, 49, 41.6, 1.1); R("crate", 46, 36, 47.2, 37.2, 1.3);
  R("crate", 41, 29.4, 42.2, 30.6, 1.3);
};

const cp = (i, j) => [i, j];
export default {
  id: "harbor", name: "Harbor Docks", tagline: "Sunrise · container port", time: "day", cols: 56, rows: 46,
  zones, sites, props,
  tSpawns: [[3, 17], [5, 18], [7, 17], [4, 21], [6, 23], [3, 28], [8, 28]],
  pSpawns: [[45, 20], [47, 20], [50, 21], [46, 24], [48, 25], [51, 23], [45, 26]],
  routes: {
    A: { north: [cp(7, 12), cp(20, 6), cp(36, 6)], yard: [cp(13, 22), cp(24, 20), cp(34, 13), cp(34, 10.5), cp(39, 8)], gate: [cp(13, 22.5), cp(26, 22.5), cp(41, 22.5), cp(47, 16), cp(47, 12)] },
    B: { south: [cp(7, 36), cp(20, 39), cp(35, 39)], yard: [cp(13, 24), cp(26, 26), cp(35, 31), cp(38, 35)], gate: [cp(13, 22.5), cp(26, 22.5), cp(41, 22.5), cp(47, 30), cp(47, 34)] },
  },
  holds: {
    A: [{ p: cp(44, 10.5), look: cp(38, 6) }, { p: cp(49, 8.5), look: cp(47, 15) }, { p: cp(41, 5), look: cp(34, 6) }],
    B: [{ p: cp(42, 34.5), look: cp(37, 39) }, { p: cp(47, 34.5), look: cp(47, 30) }, { p: cp(51, 38), look: cp(40, 38) }],
    M: [{ p: cp(46, 22.5), look: cp(41, 22.5) }, { p: cp(45, 20), look: cp(41, 21) }, { p: cp(45, 25), look: cp(41, 24) }],
  },
  entrances: { A: [cp(37, 6), cp(46, 12.5), cp(36, 10.5)], B: [cp(35.5, 38), cp(46, 32.5), cp(38, 33.5)] },
  signZones: [["a","A YARD","#d2681e","CONTAINERS"],["b","B WAREHOUSE","#1e7c6a","SHED 4"],["nq","NORTH QUAY","#2a5a8a","BERTH 1-3"],["sq","SOUTH QUAY","#2a5a8a","BERTH 4-6"],["t","T DOCK","#9a3a1a","NIGHTFALL"],["ct","CT YARD","#245a9a","SENTINEL"],["egate","GATEHOUSE","#7a5a2a","TO PORT OFFICE"],["yard","YARD 7","#2a5a8a","CONTAINER MAZE"]],
  look: {
    mode: "day", exposure: 1.0, bloom: [0.16, 0.5, 0.94], dress: "harbor",
    sky: { zenith: 0x587fae, mid: 0x8fb0cf, horizon: 0xefe4d0, sunDir: [0.78, 0.26, -0.42], sunColor: 0xffe6c4, sunSize: 0.006, glow: 0.8, cloud: 0.4, cloudColor: 0xf6f0e6, cloudShade: 0x8a9ab8, stars: 0, wind: 0.006 },
    fog: [0xdcd4c6, 0.0032], hemi: [0xa9c4e0, 0x8d8272, 2.2], sun: { color: 0xffe2bc, intensity: 6.2, off: [46, 30, -26] }, env: 0.7,
    floors: { concrete: { m: "concrete", o: { seed: 31, colors: ["#64676a", "#9b9d9d"] }, c: 0xffffff, r: 0.88 }, asphalt: { m: "concrete", o: { seed: 32, colors: ["#3a3d41", "#6a6e72"], aggregate: true, cracks: 0.6 }, c: 0xffffff, r: 0.78 }, tiles: { m: "tiles", o: { seed: 33, colors: ["#7c8488", "#b2babc"], rows: 8, cols: 8 }, c: 0xffffff, r: 0.55 } },
    wall: { m: "concrete", o: { seed: 34, colors: ["#7d8082", "#b5b7b5"] }, c: 0xffffff }, trim: 0x8e9090, roof: 0x72767a, under: 0x585c60,
    awning: [0xb83e2a, 0x2a5f98], crates: 0xc4aa80, contCols: [0xa23c2a, 0x2c5f96, 0x3a7550, 0xcc8328, 0x7e848a, 0x7a2a30],
    skylineColors: [0x9aa2aa, 0x838d97, 0xa8aeb4], far: { ground: 0x626c74, hills: 0x6e7a86 }, sea: 0x3a6a8c,
    dust: 0xfff0d0,
  },
};
