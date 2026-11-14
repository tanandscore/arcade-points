// Operation Blacksite (Upgrade 119) - the new outer lanes, back-alley rim roads, long tunnels and tiny secret shortcuts for each map.
// Everything here is written in the ORIGINAL map's cell coordinates (see expand.js); negative numbers / numbers past the old edge are the new areas.
import { laneCover } from "./expand";
const cp = (i, j) => [i, j];
const Z = (id, name, rect, floor, roof, lamp) => ({ id, name, rect, floor, roof: !!roof, lamp });

// ======================================= FOUNDRY YARD (night) =======================================
export const foundryPad = { l: 8, r: 8, t: 0, b: 4 };
export const foundryX = {
  zones: [
    Z("wlane", "Pipeline", [-5, 8, -3, 48], "asphalt", false, 0xffa040), Z("elane", "Conveyor", [58, 8, 60, 48], "asphalt", false, 0x6fe0b4),
    Z("wgA", "Pipe Gate", [-2, 9, 3, 11], "concrete", true, 0xffb04a), Z("wgY", "Yard Gate W", [-2, 38, 3, 40], "concrete", true, 0xff6a4a),
    Z("egB", "Belt Gate", [52, 9, 57, 11], "concrete", true, 0x6fe0b4), Z("egY", "Yard Gate E", [52, 38, 57, 40], "concrete", true, 0xff6a4a),
    Z("rim", "Back Alley", [-5, 46, 60, 48], "asphalt", false, 0xff7a4a), Z("rimd", "Back Door", [27, 44, 29, 45], "concrete", true, 0xff7a4a),
    Z("boilw", "Boiler Duct", [18, 14, 20, 14], "grate", true, 0xffb04a), Z("steame", "Steam Duct", [35, 14, 39, 14], "grate", true, 0x6fe0b4),
    Z("sewerw", "Sewer Run W", [10, 30, 19, 30], "grate", true, 0xffa040), Z("sewere", "Sewer Run E", [36, 29, 39, 29], "grate", true, 0x6fe0b4),
  ],
  props: (R) => {
    laneCover(R, -5, 8, -3, 45, 1); laneCover(R, 58, 8, 60, 45, 2); laneCover(R, -4, 46, 59, 48, 3);
    R("container", -5, 20, -3.6, 23, 2.7, { color: 4 }); R("container", 58.6, 26, 60, 29, 2.7, { color: 1 }); R("gen", -5, 33, -3.4, 34.6, 2.2); R("gen", 58.4, 14, 60, 15.6, 2.2);
    R("truck", 10, 46, 14.2, 47.8, 2.9); R("truck", 40, 47, 44.2, 48.9, 2.9);
  },
  routes: {
    A: { pipeline: [cp(10, 39), cp(0, 39), cp(-3.5, 38.5), cp(-3.5, 12), cp(0, 10), cp(6, 10)], sewer: [cp(27, 31), cp(14.5, 30.5), cp(7, 28), cp(6.5, 18)], boiler: [cp(27, 22), cp(22.5, 14.5), cp(19, 14.5), cp(15, 14.5)], backalley: [cp(28, 43), cp(28, 47), cp(-3.5, 47), cp(-3.5, 12), cp(0, 10), cp(6, 10)] },
    B: { conveyor: [cp(45, 39), cp(54, 39), cp(59, 38), cp(59.5, 12.5), cp(55, 10), cp(47, 10)], sewer: [cp(27, 31), cp(37.5, 29.5), cp(41.5, 27.5), cp(41.5, 16)], steam: [cp(27, 22), cp(32.5, 14.5), cp(37, 14.5), cp(41.5, 14.5)], backalley: [cp(28, 43), cp(28, 47), cp(59, 47), cp(59.5, 12.5), cp(55, 10), cp(47, 10)] },
  },
  holds: { A: [{ p: cp(5, 9), look: cp(-1, 10) }], B: [{ p: cp(50, 10), look: cp(55, 10) }], M: [{ p: cp(23, 14), look: cp(19, 14) }] },
  entrances: { A: [cp(0.5, 10)], B: [cp(54.5, 10)] },
  hanging: [[-4, 16], [-4, 30], [-4, 42], [59, 16], [59, 30], [59, 42], [10, 47], [28, 47], [46, 47]],
  signs: [["PIPELINE", "#ffa040", -12.47, 62.5, 1, 0, "OUTER WEST"], ["CONVEYOR", "#6fe0b4", 152.47, 62.5, -1, 0, "OUTER EAST"]],
};

// ======================================= SUNSTONE BAZAAR (noon) =======================================
export const bazaarPad = { l: 8, r: 8, t: 0, b: 4 };
export const bazaarX = {
  zones: [
    Z("wlane", "Souk Run", [-4, 6, -2, 48], "stone", false, 0xffd08a), Z("elane", "Spice Run", [57, 6, 59, 48], "stone", false, 0xffd08a),
    Z("wgb", "Souk Gate B", [-1, 6, 2, 8], "tiles", true, 0xffd08a), Z("wgy", "Souk Gate S", [-1, 38, 2, 40], "tiles", true, 0xffd08a),
    Z("ega", "Spice Gate A", [53, 6, 56, 8], "tiles", true, 0xffd08a), Z("egy", "Spice Gate S", [53, 38, 56, 40], "tiles", true, 0xffd08a),
    Z("rim", "Rope Walk", [-4, 46, 59, 48], "dirt", false, 0xffd08a), Z("rimd", "Back Gate", [27, 44, 29, 45], "stone", true, 0xffd08a),
    Z("hatch", "Cellar Hatch", [18, 25, 18, 26], "stone", true, 0xffd08a), Z("chute", "Spice Chute", [43, 20, 43, 24], "stone", true, 0xffd08a),
    Z("bdoor", "Back Door", [4, 12, 4, 12], "stone", true, 0xffd08a), Z("stairw", "Watch Stair W", [22, 9, 22, 11], "stone", true, 0xffd08a), Z("staire", "Watch Stair E", [33, 9, 33, 11], "stone", true, 0xffd08a),
  ],
  props: (R) => {
    laneCover(R, -4, 6, -2, 45, 4); laneCover(R, 57, 6, 59, 45, 5); laneCover(R, -3, 46, 58, 48, 6);
    R("container", -4, 18, -2.6, 21, 2.7, { color: 3 }); R("container", 57.6, 24, 59, 27, 2.7, { color: 0 });
    R("crate", 12, 46, 13.4, 47.4, 1.4); R("crate", 44, 47, 45.4, 48.4, 1.4);
  },
  routes: {
    A: { spice: [cp(44, 39), cp(54.5, 39), cp(58, 38), cp(58, 9), cp(54.5, 7), cp(46, 7)], ropewalk: [cp(27.5, 43), cp(28, 47), cp(58, 47), cp(58, 9), cp(54.5, 7), cp(46, 7)], chute: [cp(27.5, 33), cp(40, 28.5), cp(43, 25.5), cp(43, 18), cp(43, 14)] },
    B: { souk: [cp(12, 38), cp(0.5, 39), cp(-3, 38), cp(-3, 9), cp(0.5, 7), cp(6, 7)], ropewalk: [cp(27.5, 43), cp(27, 47), cp(-3, 47), cp(-3, 9), cp(0.5, 7), cp(6, 7)], hatch: [cp(18, 31), cp(18, 26), cp(18, 23), cp(11, 21), cp(11, 14)] },
  },
  holds: { A: [{ p: cp(51, 7), look: cp(56, 7) }], B: [{ p: cp(4, 7), look: cp(-1, 7) }], M: [{ p: cp(22.5, 11.5), look: cp(22, 9.5) }] },
  entrances: { A: [cp(54.5, 7)], B: [cp(0.5, 7)] },
  signZones: [["wlane", "SOUK RUN", "#7a5a2a", "WEST LANE"], ["elane", "SPICE RUN", "#c8501e", "EAST LANE"]],
};

// ======================================= HARBOR DOCKS (sunrise) =======================================
export const harborPad = { l: 0, r: 0, t: 4, b: 4 };
export const harborX = {
  zones: [
    Z("nbw", "North Breakwater", [4, -3, 49, -1], "concrete", false, 0xffe2bc), Z("nbl", "Ladder Way N", [5, 0, 7, 5], "concrete", true, 0xffe2bc), Z("nbe", "Breakwater Steps N", [47, 0, 49, 2], "concrete", true, 0xffe2bc),
    Z("sbw", "South Breakwater", [4, 46, 49, 48], "concrete", false, 0xffe2bc), Z("sbl", "Ladder Way S", [5, 40, 7, 45], "concrete", true, 0xffe2bc), Z("sbe", "Breakwater Steps S", [47, 43, 49, 45], "concrete", true, 0xffe2bc),
    Z("ductn", "Cargo Duct N", [39, 15, 43, 15], "concrete", true, 0xffe2bc), Z("ducts", "Cargo Duct S", [39, 30, 43, 30], "concrete", true, 0xffe2bc),
    Z("gangn", "Gangway N", [20, 10, 20, 11], "concrete", true, 0xffe2bc), Z("gangs", "Gangway S", [20, 34, 20, 35], "concrete", true, 0xffe2bc),
  ],
  props: (R) => {
    laneCover(R, 4, -3, 49, -1, 7); laneCover(R, 4, 46, 49, 48, 8);
    R("container", 20, -3, 23, -1.6, 2.7, { color: 1 }); R("container", 34, 47, 37, 48.4, 2.7, { color: 3 }); R("crate", 14, 46, 15.4, 47.4, 1.4); R("crate", 40, -2, 41.4, -0.6, 1.4);
    R("barrier", 20, 20.5, 22, 21.1, 1.1);
  },
  routes: {
    A: { breakwater: [cp(7, 12), cp(6, 2), cp(6, -1.5), cp(47, -1.5), cp(48, 1), cp(46, 6)], duct: [cp(13, 22), cp(30, 19.5), cp(38, 15.5), cp(41, 15.5), cp(46.5, 15.5), cp(46, 12)], gangway: [cp(13, 22.5), cp(20, 15), cp(20, 11), cp(20, 6), cp(34, 6)] },
    B: { breakwater: [cp(7, 36), cp(6, 43), cp(6, 47), cp(48, 47), cp(48, 44), cp(46, 40)], duct: [cp(13, 24), cp(30, 28), cp(38, 30.5), cp(40.5, 30.5), cp(47, 30), cp(46, 33)], gangway: [cp(13, 24), cp(20, 31), cp(20, 34.5), cp(20, 39), cp(35, 39)] },
  },
  holds: { A: [{ p: cp(48, 3.5), look: cp(48, -0.5) }], B: [{ p: cp(48, 40.5), look: cp(48, 45) }], M: [{ p: cp(44.5, 17.5), look: cp(41, 15) }] },
  entrances: { A: [cp(48, 1)], B: [cp(48, 44)] },
  signZones: [["nbw", "NORTH BREAKWATER", "#2a5a8a", "SEA WALL"], ["sbw", "SOUTH BREAKWATER", "#2a5a8a", "SEA WALL"]],
};

// ======================================= OLD QUARTER (golden hour) =======================================
export const quarterPad = { l: 5, r: 5, t: 0, b: 4 };
export const quarterX = {
  zones: [
    Z("wlane", "Cloister Lane", [-4, 20, -2, 48], "stone", false, 0xffd8a0), Z("elane", "Lantern Lane", [57, 6, 59, 48], "stone", false, 0xffd8a0),
    Z("wga", "Cloister Gate A", [-1, 22, 2, 24], "tiles", true, 0xffd8a0), Z("wgl", "Cloister Gate S", [-1, 39, 2, 41], "tiles", true, 0xffd8a0),
    Z("egt", "Lantern Gate S", [53, 38, 56, 40], "tiles", true, 0xffd8a0), Z("egb", "Lantern Gate B", [49, 6, 56, 8], "tiles", true, 0xffd8a0),
    Z("rim", "Smugglers Alley", [-4, 46, 59, 48], "dirt", false, 0xffd8a0), Z("rimd", "Trap Door", [46, 44, 48, 45], "stone", true, 0xffd8a0),
    Z("chimney", "Chimney Stair", [18, 8, 18, 11], "stone", true, 0xffd8a0), Z("carter", "Carters Tunnel", [34, 28, 43, 28], "stone", true, 0xffd8a0),
  ],
  props: (R) => {
    laneCover(R, -4, 20, -2, 45, 9); laneCover(R, 57, 8, 59, 45, 10); laneCover(R, -3, 46, 58, 48, 11);
    R("crate", -4, 30, -2.8, 31.2, 1.3); R("barrel", 58, 20, 58.5, 20.5, 1.1); R("crate", 20, 46, 21.4, 47.4, 1.4); R("crate", 36, 47, 37.4, 48.4, 1.4);
  },
  routes: {
    A: { cloister: [cp(44, 40), cp(25, 40), cp(9.5, 40), cp(0, 40), cp(-3, 38), cp(-3, 24), cp(0, 23), cp(6, 23)], carter: [cp(45, 36), cp(46, 28), cp(40, 28), cp(30, 28), cp(22, 24), cp(16, 21)], smuggler: [cp(47, 43), cp(47, 47), cp(-3, 47), cp(-3, 24), cp(0, 23), cp(6, 23)] },
    B: { lantern: [cp(46, 38), cp(55, 39), cp(58, 38), cp(58, 8), cp(52, 7), cp(46, 7)], carter: [cp(45, 36), cp(46, 28), cp(40, 28), cp(34, 28), cp(29.5, 26), cp(30, 22), cp(27, 16)] },
  },
  holds: { A: [{ p: cp(5.5, 23), look: cp(-1, 23) }], B: [{ p: cp(46, 7), look: cp(53, 7) }], M: [{ p: cp(18, 12.5), look: cp(18, 9.5) }] },
  entrances: { A: [cp(0.5, 23)], B: [cp(52, 7)] },
  signZones: [["wlane", "CLOISTER LANE", "#9a3a1a", "WEST WALK"], ["elane", "LANTERN LANE", "#c8501e", "EAST WALK"]],
};
