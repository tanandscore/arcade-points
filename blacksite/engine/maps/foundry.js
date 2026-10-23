// "Foundry Yard" — the original night-time industrial compound, now brightened so friend and foe read clearly.
import { CELL, WALL_H } from "../mapkit";

const zones = [
  { id: "ct", name: "CT Spawn", rect: [22, 2, 33, 8], floor: "concrete", lamp: 0x9fd0ff },
  { id: "a", name: "A Site", rect: [4, 2, 17, 12], floor: "tiles", lamp: 0xffb04a },
  { id: "b", name: "B Site", rect: [38, 2, 51, 12], floor: "tiles", lamp: 0x6fe0b4 },
  { id: "actc", name: "CT Link A", rect: [17, 4, 21, 7], floor: "concrete", roof: true, lamp: 0x9fd0ff },
  { id: "bctc", name: "CT Link B", rect: [34, 4, 38, 7], floor: "concrete", roof: true, lamp: 0x9fd0ff },
  { id: "mid", name: "Mid", rect: [25, 9, 30, 29], floor: "asphalt", lamp: 0xffd08a },
  { id: "midl", name: "Mid Nook West", rect: [21, 12, 24, 15], floor: "asphalt", lamp: 0xffd08a },
  { id: "midr", name: "Mid Nook East", rect: [31, 12, 34, 15], floor: "asphalt", lamp: 0xffd08a },
  { id: "plaza", name: "Mid Plaza", rect: [20, 26, 35, 33], floor: "asphalt", lamp: 0xffd08a },
  { id: "along", name: "A Long", rect: [4, 13, 9, 33], floor: "asphalt", lamp: 0xffa040 },
  { id: "hall", name: "A Hall", rect: [13, 12, 17, 21], floor: "concrete", roof: true, lamp: 0xffb04a },
  { id: "short", name: "Short", rect: [10, 18, 24, 21], floor: "grate", roof: true, lamp: 0xff6a4a },
  { id: "shortb", name: "Short B", rect: [31, 22, 39, 25], floor: "grate", roof: true, lamp: 0xff6a4a },
  { id: "tun", name: "Tunnels", rect: [40, 13, 43, 33], floor: "grate", roof: true, lamp: 0x6fe0b4 },
  { id: "alley", name: "B Alley", rect: [47, 13, 51, 33], floor: "asphalt", lamp: 0x6fe0b4 },
  { id: "bwin", name: "B Window", rect: [44, 26, 46, 28], floor: "concrete", roof: true, lamp: 0x6fe0b4 },
  { id: "wyard", name: "West Yard", rect: [4, 34, 14, 43], floor: "asphalt", lamp: 0xffa040 },
  { id: "eyard", name: "East Yard", rect: [41, 34, 51, 43], floor: "asphalt", lamp: 0x6fe0b4 },
  { id: "tdw", name: "West Gate", rect: [15, 38, 19, 41], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "tde", name: "East Gate", rect: [36, 38, 40, 41], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "tlink", name: "Plaza Ramp", rect: [25, 34, 30, 36], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "t", name: "T Spawn", rect: [20, 37, 35, 43], floor: "concrete", lamp: 0xff7a4a },
];

const sites = {
  A: { cx: 10.5, cz: 7.2, r: 10.5, color: 0xffb04a },
  B: { cx: 45.5, cz: 9.6, r: 10.5, color: 0x6fe0b4 },
};

const props = (R) => {
// ---- A site --------------------------------------------------------------------------------
R("container", 5, 2, 7.6, 3, 2.7, { color: 2 }); R("container", 9, 2, 11.6, 3, 2.7, { color: 0 });
R("gen", 14, 2.2, 16.6, 4, 2.2);
R("crate", 7, 7, 8, 8, 2.6); R("crate", 8, 7, 9, 8, 1.3); R("crate", 7, 8, 8, 9, 1.3);
R("barrel", 13, 9, 13.5, 9.5, 1.1); R("barrel", 13.6, 9.2, 14.1, 9.7, 1.1); R("barrel", 13.2, 9.8, 13.7, 10.3, 1.1);
R("pillar", 11, 9, 12, 10, WALL_H);
R("barrier", 4, 9.6, 7, 10.2, 1.1);
R("crate", 5, 11, 6.2, 12, 1.3);
// ---- links ---------------------------------------------------------------------------------------
R("crate", 19, 4, 20, 5, 1.3); R("crate", 35.2, 6, 36.2, 7, 1.3);
// ---- A long --------------------------------------------------------------------------------------
R("crate", 4, 16, 6, 18, 1.4); R("barrier", 7, 19, 10, 19.6, 1.1);
R("container", 4, 23, 5, 25.6, 2.7, { color: 4 }); R("crate", 8, 26, 9.7, 27.7, 2.6);
R("barrel", 5.5, 30.5, 6, 31, 1.1); R("barrel", 6.1, 30.8, 6.6, 31.3, 1.1);
R("pillar", 6.5, 13.5, 7.5, 14.5, WALL_H);
// ---- hall + short --------------------------------------------------------------------------------------
R("crate", 13, 15, 14.5, 16.5, 1.4); R("pillar", 15, 18, 16, 19, WALL_H);
R("pillar", 17.5, 19.2, 18.5, 20.2, WALL_H); R("crate", 20, 18, 21, 19, 1.3); R("crate", 12, 20, 13, 21, 1.3);
R("barrel", 22.2, 20.2, 22.7, 20.7, 1.1);
// ---- mid -----------------------------------------------------------------------------------------------------
R("container", 27.5, 14, 28.5, 16.6, 2.7, { color: 1 });
R("crate", 25, 20, 26.2, 21.2, 1.3); R("crate", 29.8, 24, 31, 25.2, 1.3);
R("barrier", 26, 26, 28, 26.6, 1.1); R("barrier", 28.4, 11.6, 30.4, 12.2, 1.1);
R("crate", 21, 13, 22.2, 14.2, 1.3); R("crate", 32.8, 12, 34, 13.2, 1.3);
// ---- plaza + lobby ---------------------------------------------------------------------------------
R("container", 21, 28, 23.6, 29, 2.7, { color: 3 }); R("container", 32, 30, 34.6, 31, 2.7, { color: 5 });
R("pillar", 24.5, 30, 25.5, 31, WALL_H); R("pillar", 29.5, 30, 30.5, 31, WALL_H);
R("truck", 20.5, 41.2, 24.8, 43, 2.9); R("crate", 32, 41, 33.4, 42.4, 1.4); R("crate", 33.4, 41.8, 34.6, 43, 1.3);
R("barrier", 27, 37.4, 30, 38, 1.1);
// ---- west + east yards -------------------------------------------------------------------------------
R("container", 5, 36, 7.6, 37, 2.7, { color: 4 }); R("container", 5, 36, 7.6, 37, 2.7, { color: 2, y0: 2.7 });
R("crate", 11, 37, 12.4, 38.4, 1.4); R("barrel", 8, 41, 8.5, 41.5, 1.1); R("barrel", 8.6, 41.2, 9.1, 41.7, 1.1);
R("barrier", 10, 34.6, 13, 35.2, 1.1);
R("container", 48.4, 36, 51, 37, 2.7, { color: 1 }); R("crate", 43, 38, 44.4, 39.4, 1.4); R("barrier", 45, 41, 48, 41.6, 1.1);
R("barrel", 49.4, 41.4, 49.9, 41.9, 1.1);
// ---- tunnels + alley -------------------------------------------------------------------------------------------
R("pillar", 41.5, 18, 42.5, 19, WALL_H); R("pillar", 41.5, 28, 42.5, 29, WALL_H);
R("crate", 40, 23, 41.3, 24.3, 1.3); R("crate", 42.8, 30, 44, 31, 1.3);
R("crate", 49, 20, 51, 22, 1.4); R("barrier", 47, 24.4, 49.6, 25, 1.1); R("barrel", 50.2, 30.2, 50.7, 30.7, 1.1); R("barrel", 49.5, 15, 50, 15.5, 1.1);
R("container", 47.5, 16.5, 48.5, 19.1, 2.7, { color: 0 });
// ---- B site ----------------------------------------------------------------------------------------------------------------
R("container", 47.6, 2, 50.2, 3, 2.7, { color: 5 }); R("container", 39, 2, 41.6, 3, 2.7, { color: 4 });
R("block", 43, 6, 45.6, 8.6, 2.2); R("crate", 45.6, 6, 46.6, 7, 1.3); R("crate", 42, 8.6, 43, 9.6, 1.3);
R("pillar", 48, 9, 49, 10, WALL_H);
R("barrier", 40, 10.4, 43, 11, 1.1); R("barrel", 38.8, 5, 39.3, 5.5, 1.1);
};

const cp = (i, j) => [i, j];
export default {
  id: "foundry", name: "Foundry Yard", tagline: "Night · rain · storm", time: "night", cols: 56, rows: 46,
  zones, sites, props,
  tSpawns: [[24, 39], [26, 40], [28, 41], [30, 40], [22, 39], [27, 42], [33, 39]],
  pSpawns: [[24, 4], [26, 3], [28, 4], [30, 3], [32, 4], [27, 6], [31, 6]],
  routes: {
    A: { long: [cp(6, 37), cp(6, 21)], short: [cp(27, 31), cp(27, 22), cp(17, 19.5), cp(15, 14)], hall: [cp(27, 31), cp(27, 22), cp(14.5, 19.5)] },
    B: { tunnels: [cp(41.5, 36), cp(41.5, 22)], alley: [cp(49, 36), cp(49, 22)], short: [cp(27, 31), cp(27, 23), cp(36, 23.5), cp(41.5, 23.5)] },
  },
  holds: {
    A: [{ p: cp(6.5, 10.5), look: cp(6.5, 25) }, { p: cp(14.5, 9.5), look: cp(15, 20) }, { p: cp(11, 4.5), look: cp(11, 12) }],
    B: [{ p: cp(44.5, 10.5), look: cp(41.5, 20) }, { p: cp(48.5, 9.5), look: cp(49, 24) }, { p: cp(44.5, 4.5), look: cp(44.5, 12) }],
    M: [{ p: cp(27.5, 11.5), look: cp(27.5, 27) }, { p: cp(22.5, 13.5), look: cp(27.5, 20) }, { p: cp(32.5, 13.5), look: cp(27.5, 20) }],
  },
  entrances: { A: [cp(6.5, 13), cp(15, 12.5), cp(17.5, 5.5)], B: [cp(41.5, 13), cp(49, 13), cp(37.5, 5.5)] },
  signs: [
    ["A SITE", "#ffb04a", 28, 5.03, 0, 1, "BOMBSITE"], ["B SITE", "#6fe0b4", 113, 5.03, 0, 1, "BOMBSITE"], ["A LONG", "#ffa040", 10.03, 45, 1, 0, "WEST LANE"], ["MID", "#ffd08a", 62.53, 41, 1, 0, "CENTRE"],
    ["TUNNELS", "#6fe0b4", 112, 85.03, 0, 1, "TO B"], ["B ALLEY", "#6fe0b4", 125, 85.03, 0, 1, "TO B"], ["WEST", "#ffa040", 31, 85.03, 0, 1, "TO A LONG"], ["SHORT", "#ff6a4a", 40, 44.8, 0, 1, "A ↔ MID"],
    ["T SPAWN", "#ff7a4a", 75, 109.97, 0, -1, "NIGHTFALL"], ["CT SPAWN", "#9fd0ff", 75, 5.03, 0, 1, "SENTINEL"],
  ],
  hanging: [[10, 24], [10, 36], [20, 28], [35, 27], [27, 20], [27, 12], [14, 8], [44, 8], [45, 19], [24, 41], [31, 41], [8, 40], [47, 40], [49, 24], [6, 22], [15, 16]],
  look: { mode: "night", exposure: 2.0, bloom: [0.5, 0.6, 0.85] },
};
