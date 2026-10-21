// Midnight Burn — the car builder and the showroom.
//
// Every hero car (yours and the rivals') is built from a spec:
//   { car, color, finish, livery:{type,color}, rims:{style,color},
//     wing, kit, tint, glow, number }
// Bodies are sculpted, not stacked boxes: each one is a smooth "loft"
// through a handful of cross-sections (width, floor height, roof height)
// along the car's length, rounded with a super-ellipse, so you get the
// flowing wedge of a supercar, the long hood of a muscle car, the
// low-slung canopy of a prototype racer. Shapes are original designs
// inspired by the body styles of the great racing cars — no brand
// names, logos or copied bodywork.
import * as THREE from "three";
import { makeWheelModel, makeCaliper, makeHeadlamp, makeTaillamp, makeInterior, makeCityEnv, partMats, merge as mergeGeo } from "./carParts";

// ---------------------------------------------------------------- options
export const FINISHES = [
  { id: "gloss", name: "Gloss", cost: 0 },
  { id: "primer", name: "Primer grey", cost: 0, note: "unpainted" },
  { id: "metallic", name: "Metallic", cost: 250 },
  { id: "pearl", name: "Pearl flip", cost: 600 },
  { id: "matte", name: "Matte", cost: 400 },
  { id: "candy", name: "Candy", cost: 700, note: "deep wet gloss" },
  { id: "satin", name: "Satin chrome", cost: 900 },
  { id: "chameleon", name: "Colour-shift", cost: 1500, note: "changes with the light" },
  { id: "carbon", name: "Carbon weave", cost: 1200 },
  { id: "chrome", name: "Mirror chrome", cost: 1800 },
];
export const ROOFS = [
  { id: "body", name: "Body colour", cost: 0 },
  { id: "black", name: "Gloss black", cost: 150 },
  { id: "white", name: "White", cost: 150 },
  { id: "carbon", name: "Carbon roof", cost: 450 },
];
export const LIVERIES = [
  { id: "none", name: "Clean", cost: 0 },
  { id: "stripes", name: "Twin stripes", cost: 200 },
  { id: "side", name: "Side sweep", cost: 250 },
  { id: "racing", name: "Racing number", cost: 350 },
  { id: "checker", name: "Checker flash", cost: 400 },
  { id: "hex", name: "Hex fade", cost: 500 },
  { id: "speed", name: "Speed lines", cost: 350 },
  { id: "split", name: "Two-tone split", cost: 400 },
  { id: "flames", name: "Flames", cost: 450 },
  { id: "camo", name: "Night camo", cost: 450 },
  { id: "grid", name: "Cyber grid", cost: 500 },
  { id: "rally", name: "Rally gravel", cost: 450 },
];
export const RIM_STYLES = [
  { id: "fivespoke", name: "Five-spoke", cost: 0 },
  { id: "ten", name: "Ten-spoke", cost: 200 },
  { id: "turbine", name: "Turbine", cost: 350 },
  { id: "mesh", name: "Mesh", cost: 450 },
  { id: "deep", name: "Deep dish", cost: 300 },
  { id: "star", name: "Seven-star", cost: 300 },
  { id: "split", name: "Split-spoke", cost: 400 },
  { id: "multi", name: "Multi-spoke", cost: 350 },
  { id: "classic", name: "Classic six", cost: 300 },
  { id: "blade", name: "Blade", cost: 450 },
];
// rim size: how much of the wheel is metal and how much is tyre wall
export const RIM_SIZES = [
  { id: 0, name: "Small, fat tyre", cost: 0, k: 0.62 },
  { id: 1, name: "Standard", cost: 0, k: 0.7 },
  { id: 2, name: "Large", cost: 200, k: 0.76 },
  { id: 3, name: "Huge, thin tyre", cost: 400, k: 0.82 },
];
export const CAMBERS = [
  { id: 0, name: "Straight", cost: 0, deg: 0 },
  { id: 1, name: "Slight tilt", cost: 150, deg: 3 },
  { id: 2, name: "Stanced", cost: 300, deg: 7 },
  { id: 3, name: "Extreme", cost: 500, deg: 12 },
];
export const STANCES = [
  { id: "stock", name: "Stock height", cost: 0, dy: 0 },
  { id: "sport", name: "Sport drop", cost: 200, dy: -0.02 },
  { id: "low", name: "Lowered", cost: 400, dy: -0.04 },
  { id: "slam", name: "Slammed", cost: 700, dy: -0.055 },
  { id: "lift", name: "Rally lift", cost: 300, dy: 0.05 },
];
export const WINGS = [
  { id: "none", name: "No wing", cost: 0 },
  { id: "lip", name: "Boot lip", cost: 120 },
  { id: "stock", name: "Duck-tail", cost: 150 },
  { id: "gt", name: "GT wing", cost: 450 },
  { id: "swan", name: "Swan-neck GT", cost: 800 },
  { id: "dual", name: "Dual-plane", cost: 650 },
  { id: "tall", name: "Track wing", cost: 700 },
];
export const KITS = [
  { id: "stock", name: "Stock", cost: 0, note: "" },
  { id: "street", name: "Street kit", cost: 500, note: "+3% grip" },
  { id: "race", name: "Race kit", cost: 1100, note: "+7% grip, -1.5% top speed" },
  { id: "wide", name: "Widebody", cost: 1500, note: "+5% grip, -1% top speed" },
  { id: "drift", name: "Drift kit", cost: 1000, note: "+5% steering" },
  { id: "attack", name: "Time-attack aero", cost: 2000, note: "+9% grip, -2.5% top speed" },
];
export const HOODS = [
  { id: "stock", name: "Stock bonnet", cost: 0 },
  { id: "carbon", name: "Carbon bonnet", cost: 600 },
  { id: "vent", name: "Vented bonnet", cost: 450 },
  { id: "scoop", name: "Ram-air scoop", cost: 500 },
];
export const EXHAUSTS = [
  { id: "stock", name: "Stock tips", cost: 0 },
  { id: "big", name: "Big-bore pair", cost: 250 },
  { id: "quad", name: "Quad tips", cost: 400 },
  { id: "centre", name: "Centre pipe", cost: 350 },
  { id: "titan", name: "Burnt titanium", cost: 600 },
];
export const MIRRORS = [
  { id: "body", name: "Body colour", cost: 0 },
  { id: "black", name: "Gloss black", cost: 80 },
  { id: "carbon", name: "Carbon", cost: 250 },
];
export const LIGHTS = [
  { id: "white", name: "Warm white", cost: 0, lens: 0xfff1c9, drl: 0xcfeaff },
  { id: "ice", name: "Ice blue", cost: 150, lens: 0xd6ecff, drl: 0x6fc8ff },
  { id: "amber", name: "Rally yellow", cost: 150, lens: 0xffd24a, drl: 0xffb400 },
  { id: "violet", name: "Neon violet", cost: 200, lens: 0xe7caff, drl: 0xb45cff },
  { id: "pink", name: "Neon pink", cost: 200, lens: 0xffd0e8, drl: 0xff2d95 },
];
export const TINTS = [
  { id: "smoked", name: "Smoked", cost: 0, color: 0x05080f },
  { id: "clear", name: "Clear", cost: 0, color: 0x1a2740 },
  { id: "blue", name: "Blue", cost: 100, color: 0x0a2a66 },
  { id: "amber", name: "Amber", cost: 100, color: 0x6a3a08 },
  { id: "rose", name: "Rose", cost: 120, color: 0x5a1030 },
  { id: "lime", name: "Lime", cost: 120, color: 0x103a12 },
  { id: "mirror", name: "Mirror", cost: 300, color: 0x8a93a8, mirror: true },
];
export const GLOWS = [
  { id: "match", name: "Match paint", cost: 0 },
  { id: "cyan", name: "Cyan", cost: 100, color: 0x2de2ff },
  { id: "pink", name: "Pink", cost: 100, color: 0xff2d95 },
  { id: "green", name: "Green", cost: 100, color: 0x6bff6b },
  { id: "violet", name: "Violet", cost: 100, color: 0xb45cff },
  { id: "white", name: "Ice white", cost: 100, color: 0xe6f2ff },
  { id: "red", name: "Red", cost: 100, color: 0xff2a2a },
  { id: "orange", name: "Orange", cost: 100, color: 0xff7a1a },
  { id: "lime", name: "Lime", cost: 100, color: 0xc6ff3a },
  { id: "off", name: "Off", cost: 0 },
];
export const PAINT_COLORS = [
  "#2de2ff", "#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#f2f2f2", "#d4202a", "#1b6dff", "#101015",
  "#0a4d3a", "#7a1020", "#14213d", "#8d99ae", "#c9a227", "#e9d8a6", "#5e60ce", "#00f5d4", "#ff9ecd", "#3a3a40",
  "#ff006e", "#a7ff00", "#fb8500", "#023e8a",
];
export const RIM_COLORS = ["#c9ccd8", "#1a1a20", "#ffb703", "#ff2d95", "#2de2ff", "#d4202a", "#f2f2f2", "#c9a227", "#6bff6b", "#b45cff", "#ff5a1f", "#1b6dff"];
export const LIVERY_COLORS = ["#f2f2f2", "#101015", "#ffb703", "#ff2d95", "#2de2ff", "#d4202a", "#6bff6b", "#b45cff", "#ff5a1f", "#1b6dff", "#c9a227", "#0a4d3a"];
export const CALIPER_COLORS = ["auto", "#d4202a", "#ffb703", "#1b6dff", "#6bff6b", "#ff5a1f", "#f2f2f2", "#ff2d95", "#101015"];

export const DEFAULT_SPEC = {
  car: "kestrel", color: "#2de2ff", finish: "gloss",
  livery: { type: "none", color: "#f2f2f2" }, rims: { style: "fivespoke", color: "#c9ccd8", size: 1 },
  wing: "none", kit: "stock", tint: "smoked", glow: "match", number: 7,
  // Upgrade 38 additions. A saved car without them falls back to these, which is exactly how it looked before.
  roof: "body", caliper: "auto", hood: "stock", exhaust: "stock", mirrors: "body", lights: "white", stance: "stock", camber: 0,
};
export const specOf = (partial) => ({
  ...DEFAULT_SPEC, ...partial,
  livery: { ...DEFAULT_SPEC.livery, ...(partial?.livery || {}) },
  rims: { ...DEFAULT_SPEC.rims, ...(partial?.rims || {}) },
  // rim size lives inside rims (a missing size means "standard")
});

// ---------------------------------------------------------- body designs
// stations: [x, halfWidth, floorY, topY], rear (-x) to front (+x)
export const ARCH = {
  kestrel: {
    name: "Kestrel", L: 4.6, halfW: 1.02, nBody: 4.2, nCab: 2.4, track: 0.92,
    wf: { x: 1.45, r: 0.35, w: 0.3 }, wr: { x: -1.38, r: 0.37, w: 0.36 },
    body: [[-2.3, 0.45, 0.5, 0.8], [-2.2, 0.8, 0.4, 0.93], [-1.9, 0.98, 0.33, 1.0], [-1.2, 1.02, 0.3, 0.99], [-0.4, 1.0, 0.29, 0.9], [0.4, 0.97, 0.29, 0.82], [1.2, 0.93, 0.29, 0.79], [1.65, 0.88, 0.29, 0.76], [2.0, 0.75, 0.3, 0.54], [2.3, 0.42, 0.32, 0.38]],
    cab: [[-1.35, 0.55, 0.9, 0.96], [-1.1, 0.72, 0.88, 1.04], [-0.5, 0.78, 0.84, 1.12], [0.05, 0.78, 0.8, 1.08], [0.5, 0.72, 0.77, 0.95], [0.88, 0.6, 0.74, 0.83]],
    intake: true, ducktail: false, scoop: false,
  },
  brute: {
    name: "Brute", L: 4.9, halfW: 0.98, nBody: 4.8, nCab: 2.8, track: 0.9,
    wf: { x: 1.55, r: 0.38, w: 0.3 }, wr: { x: -1.5, r: 0.39, w: 0.38 },
    body: [[-2.45, 0.7, 0.45, 0.95], [-2.35, 0.9, 0.36, 1.12], [-1.7, 0.97, 0.32, 1.15], [-0.6, 0.98, 0.3, 1.12], [0.8, 0.96, 0.3, 1.08], [1.7, 0.92, 0.3, 0.96], [2.3, 0.85, 0.33, 0.84], [2.45, 0.6, 0.38, 0.72]],
    cab: [[-1.45, 0.7, 1.08, 1.14], [-1.05, 0.82, 1.05, 1.4], [-0.3, 0.84, 1.02, 1.46], [0.35, 0.8, 1.0, 1.38], [0.75, 0.72, 0.98, 1.16]],
    intake: false, ducktail: true, scoop: true,
  },
  gecko: {
    name: "Gecko", L: 4.1, halfW: 0.92, nBody: 4.2, nCab: 2.8, track: 0.84,
    wf: { x: 1.3, r: 0.33, w: 0.28 }, wr: { x: -1.25, r: 0.34, w: 0.3 },
    body: [[-2.05, 0.7, 0.45, 0.98], [-1.95, 0.82, 0.36, 1.08], [-1.4, 0.88, 0.32, 1.1], [-0.3, 0.9, 0.3, 1.04], [0.9, 0.88, 0.3, 0.9], [1.7, 0.82, 0.31, 0.72], [2.05, 0.6, 0.35, 0.58]],
    cab: [[-1.75, 0.72, 0.98, 1.05], [-1.5, 0.78, 0.96, 1.38], [-0.6, 0.8, 0.93, 1.48], [0.2, 0.78, 0.9, 1.35], [0.85, 0.7, 0.86, 1.0]],
    intake: false, ducktail: false, scoop: true,
  },
  phantom: {
    name: "Phantom GT", L: 4.7, halfW: 1.1, nBody: 4.4, nCab: 2.6, track: 1.0,
    wf: { x: 1.5, r: 0.38, w: 0.36 }, wr: { x: -1.45, r: 0.39, w: 0.42 },
    body: [[-2.35, 0.6, 0.5, 0.88], [-2.25, 0.95, 0.38, 1.0], [-1.8, 1.08, 0.32, 1.04], [-1.1, 1.1, 0.3, 1.02], [-0.3, 1.06, 0.29, 0.92], [0.6, 1.03, 0.29, 0.84], [1.5, 0.99, 0.29, 0.82], [1.9, 0.92, 0.29, 0.74], [2.2, 0.8, 0.3, 0.55], [2.4, 0.5, 0.32, 0.42]],
    cab: [[-1.25, 0.6, 0.94, 1.0], [-0.95, 0.74, 0.92, 1.14], [-0.35, 0.78, 0.88, 1.24], [0.15, 0.78, 0.84, 1.2], [0.6, 0.72, 0.82, 1.04], [0.95, 0.6, 0.8, 0.9]],
    intake: true, ducktail: false, scoop: false, wide: true,
  },
  specter: {
    name: "Specter LMP", L: 4.9, halfW: 1.08, nBody: 4.6, nCab: 2.2, track: 1.0,
    wf: { x: 1.55, r: 0.36, w: 0.34 }, wr: { x: -1.5, r: 0.38, w: 0.44 },
    body: [[-2.5, 0.5, 0.38, 0.78], [-2.35, 0.85, 0.34, 0.88], [-1.7, 1.05, 0.3, 0.92], [-0.8, 1.08, 0.28, 0.86], [0.2, 1.02, 0.27, 0.76], [1.2, 1.0, 0.27, 0.76], [1.9, 0.95, 0.28, 0.64], [2.2, 0.85, 0.29, 0.5], [2.45, 0.6, 0.3, 0.38]],
    cab: [[-1.1, 0.3, 0.82, 0.88], [-0.7, 0.5, 0.8, 1.0], [-0.1, 0.54, 0.77, 1.04], [0.45, 0.5, 0.75, 0.94], [0.9, 0.36, 0.74, 0.82]],
    intake: true, ducktail: false, scoop: false, fin: true, wide: true,
  },
  // ---- ten more: hypercars, track toys and lightweight road-legal racers (inspired by real machines, all names and shapes are the game's own) ----
  meteor: { // F1-engined hypercar: teardrop cabin, roof air-snorkel, shark fin, huge wing
    name: "Meteor One", L: 4.75, halfW: 1.06, nBody: 4.3, nCab: 2.4, track: 1.0,
    wf: { x: 1.52, r: 0.36, w: 0.32 }, wr: { x: -1.45, r: 0.38, w: 0.42 },
    body: [[-2.38, 0.55, 0.45, 0.82], [-2.3, 0.92, 0.36, 0.96], [-1.8, 1.08, 0.3, 1.0], [-1.0, 1.1, 0.28, 0.98], [-0.2, 1.06, 0.27, 0.88], [0.7, 1.02, 0.27, 0.78], [1.5, 0.98, 0.27, 0.7], [2.0, 0.9, 0.27, 0.58], [2.375, 0.7, 0.28, 0.4]],
    cab: [[-1.3, 0.45, 0.84, 0.95], [-0.85, 0.66, 0.82, 1.12], [-0.2, 0.72, 0.78, 1.22], [0.35, 0.7, 0.76, 1.1], [0.85, 0.58, 0.74, 0.9]],
    intake: true, ducktail: false, scoop: false, fin: true, wide: true, snorkel: true,
  },
  vesper: { // Le Mans-derived road hypercar: tiny cabin, massive tunnels, tall tail fins
    name: "Vesper X", L: 4.95, halfW: 1.1, nBody: 4.6, nCab: 2.2, track: 1.02,
    wf: { x: 1.6, r: 0.35, w: 0.32 }, wr: { x: -1.55, r: 0.37, w: 0.44 },
    body: [[-2.48, 0.5, 0.4, 0.8], [-2.35, 0.9, 0.33, 0.9], [-1.7, 1.1, 0.29, 0.92], [-0.8, 1.1, 0.27, 0.84], [0.2, 1.04, 0.26, 0.72], [1.2, 1.0, 0.26, 0.66], [1.9, 0.94, 0.27, 0.56], [2.2, 0.84, 0.28, 0.44], [2.47, 0.6, 0.29, 0.34]],
    cab: [[-1.0, 0.26, 0.8, 0.88], [-0.6, 0.42, 0.77, 1.0], [0.0, 0.46, 0.74, 1.03], [0.5, 0.4, 0.72, 0.92], [0.92, 0.28, 0.71, 0.8]],
    intake: true, ducktail: false, scoop: false, fin: true, wide: true, twinFin: true,
  },
  rennsport: { // rear-engined track-day coupe: round nose, arched roofline, swan-neck wing
    name: "Rennsport GT", L: 4.57, halfW: 1.0, nBody: 3.8, nCab: 2.5, track: 0.95,
    wf: { x: 1.38, r: 0.34, w: 0.3 }, wr: { x: -1.22, r: 0.36, w: 0.4 },
    body: [[-2.28, 0.62, 0.5, 1.0], [-2.2, 0.92, 0.4, 1.1], [-1.6, 1.02, 0.32, 1.08], [-0.8, 1.02, 0.3, 1.0], [0.0, 0.99, 0.29, 0.88], [0.9, 0.95, 0.29, 0.78], [1.7, 0.9, 0.29, 0.7], [2.1, 0.8, 0.3, 0.55], [2.28, 0.62, 0.34, 0.45]],
    cab: [[-1.55, 0.6, 0.98, 1.06], [-1.2, 0.76, 0.94, 1.2], [-0.5, 0.8, 0.88, 1.28], [0.2, 0.78, 0.84, 1.22], [0.7, 0.7, 0.8, 1.0], [1.0, 0.6, 0.78, 0.88]],
    intake: true, ducktail: true, scoop: false, swan: true,
  },
  solo: { // single-seat track weapon: carbon tub, cycle wings, roll hoop, big rear wing
    name: "Solo R", L: 3.9, halfW: 0.55, nBody: 3.2, nCab: 2.2, track: 0.9, open: true, wz: 0.86,
    wf: { x: 1.15, r: 0.3, w: 0.26 }, wr: { x: -1.05, r: 0.32, w: 0.34 },
    body: [[-1.95, 0.28, 0.3, 0.55], [-1.5, 0.48, 0.28, 0.8], [-0.6, 0.52, 0.27, 0.7], [0.3, 0.5, 0.27, 0.56], [1.2, 0.44, 0.27, 0.46], [1.95, 0.28, 0.28, 0.38]],
    cab: [[-0.1, 0.16, 0.62, 0.66], [0.2, 0.3, 0.6, 0.74], [0.5, 0.32, 0.58, 0.68], [0.7, 0.26, 0.57, 0.62]],
    intake: false, ducktail: false, scoop: false, cycle: true, hoop: true, noRoof: true, seat: true,
  },
  stinger: { // mid-engined GT4 coupe: short nose, ducktail, wide rear hips
    name: "Stinger GT4", L: 4.45, halfW: 1.0, nBody: 3.9, nCab: 2.5, track: 0.95,
    wf: { x: 1.4, r: 0.34, w: 0.3 }, wr: { x: -1.25, r: 0.36, w: 0.38 },
    body: [[-2.22, 0.6, 0.46, 0.92], [-2.12, 0.92, 0.38, 1.04], [-1.5, 1.04, 0.31, 1.02], [-0.7, 1.0, 0.29, 0.94], [0.1, 0.98, 0.29, 0.86], [1.0, 0.94, 0.29, 0.76], [1.75, 0.88, 0.29, 0.68], [2.1, 0.78, 0.3, 0.52], [2.22, 0.6, 0.34, 0.42]],
    cab: [[-1.3, 0.6, 0.94, 1.02], [-0.95, 0.76, 0.9, 1.16], [-0.3, 0.8, 0.86, 1.24], [0.35, 0.76, 0.82, 1.14], [0.8, 0.66, 0.78, 0.96], [1.05, 0.56, 0.76, 0.86]],
    intake: true, ducktail: true, scoop: true,
  },
  frame: { // bare tubular spaceframe with exposed engine and seat, nothing else
    name: "Frame 4RR", L: 3.3, halfW: 0.4, nBody: 3.0, nCab: 2.0, track: 0.8, open: true, wz: 0.8, bareFrame: true,
    wf: { x: 1.05, r: 0.29, w: 0.24 }, wr: { x: -0.95, r: 0.31, w: 0.3 },
    body: [[-1.65, 0.2, 0.34, 0.5], [-1.2, 0.36, 0.3, 0.62], [-0.4, 0.4, 0.28, 0.56], [0.4, 0.34, 0.27, 0.44], [1.1, 0.26, 0.27, 0.38], [1.65, 0.16, 0.28, 0.34]],
    cab: [[0.3, 0.14, 0.5, 0.52], [0.5, 0.2, 0.48, 0.58], [0.7, 0.22, 0.47, 0.54], [0.85, 0.18, 0.46, 0.5]],
    intake: false, ducktail: false, scoop: false, cycle: true, hoop: true, noRoof: true, seat: true, engine: true,
  },
  praga: { // long-tailed carbon GT with a fixed rear wing and tall fenders
    name: "Praha Bolt", L: 4.55, halfW: 1.02, nBody: 4.2, nCab: 2.5, track: 0.98,
    wf: { x: 1.45, r: 0.35, w: 0.31 }, wr: { x: -1.35, r: 0.37, w: 0.4 },
    body: [[-2.28, 0.58, 0.48, 0.84], [-2.18, 0.94, 0.36, 0.98], [-1.7, 1.04, 0.3, 1.0], [-0.9, 1.04, 0.28, 0.94], [-0.1, 1.0, 0.27, 0.84], [0.8, 0.97, 0.27, 0.74], [1.6, 0.92, 0.27, 0.66], [2.0, 0.82, 0.28, 0.52], [2.27, 0.62, 0.3, 0.4]],
    cab: [[-1.2, 0.5, 0.86, 0.96], [-0.8, 0.7, 0.84, 1.12], [-0.15, 0.76, 0.8, 1.2], [0.4, 0.72, 0.77, 1.08], [0.9, 0.6, 0.75, 0.9]],
    intake: true, ducktail: false, scoop: false, fin: true, wide: true,
  },
  razor: { // closed-cockpit track prototype with sculpted full-width fenders
    name: "Razor RXC", L: 4.4, halfW: 1.0, nBody: 4.4, nCab: 2.2, track: 0.96,
    wf: { x: 1.4, r: 0.33, w: 0.3 }, wr: { x: -1.3, r: 0.35, w: 0.38 },
    body: [[-2.2, 0.5, 0.36, 0.76], [-2.1, 0.86, 0.32, 0.88], [-1.5, 1.02, 0.29, 0.92], [-0.6, 1.0, 0.27, 0.84], [0.3, 0.96, 0.26, 0.72], [1.2, 0.94, 0.26, 0.64], [1.85, 0.9, 0.27, 0.54], [2.1, 0.8, 0.28, 0.42], [2.2, 0.62, 0.29, 0.34]],
    cab: [[-0.9, 0.32, 0.8, 0.9], [-0.55, 0.5, 0.77, 1.02], [-0.05, 0.54, 0.74, 1.06], [0.4, 0.5, 0.72, 0.96], [0.85, 0.36, 0.7, 0.82]],
    intake: true, ducktail: false, scoop: false, fin: true, wide: true,
  },
  seven: { // the classic: exposed wheels, long bonnet, cycle wings, almost no car
    name: "Sevenfold 620", L: 3.35, halfW: 0.5, nBody: 3.0, nCab: 2.0, track: 0.78, open: true, wz: 0.76, classic: true,
    wf: { x: 1.0, r: 0.3, w: 0.2 }, wr: { x: -0.85, r: 0.31, w: 0.26 },
    body: [[-1.68, 0.3, 0.34, 0.6], [-1.3, 0.44, 0.3, 0.7], [-0.5, 0.48, 0.28, 0.64], [0.2, 0.42, 0.27, 0.56], [0.9, 0.36, 0.27, 0.5], [1.4, 0.3, 0.28, 0.46], [1.675, 0.24, 0.3, 0.42]],
    cab: [[-0.35, 0.2, 0.62, 0.66], [-0.1, 0.34, 0.6, 0.78], [0.2, 0.36, 0.58, 0.7], [0.4, 0.3, 0.57, 0.64]],
    intake: false, ducktail: false, scoop: false, cycle: true, noRoof: true, seat: true,
  },
  exp: { // open-top aero road-racer: covered wheels, air-box, wing on pillars
    name: "Prodigy EXP", L: 4.3, halfW: 0.98, nBody: 4.0, nCab: 2.2, track: 0.94,
    wf: { x: 1.38, r: 0.33, w: 0.28 }, wr: { x: -1.25, r: 0.35, w: 0.36 },
    body: [[-2.15, 0.46, 0.34, 0.74], [-2.05, 0.82, 0.3, 0.9], [-1.4, 0.98, 0.28, 0.94], [-0.5, 0.96, 0.27, 0.8], [0.3, 0.92, 0.26, 0.66], [1.2, 0.9, 0.26, 0.6], [1.8, 0.86, 0.27, 0.5], [2.05, 0.74, 0.28, 0.4], [2.15, 0.58, 0.29, 0.34]],
    cab: [[0.0, 0.3, 0.64, 0.7], [0.3, 0.46, 0.62, 0.82], [0.6, 0.46, 0.6, 0.76], [0.9, 0.34, 0.58, 0.68]],
    intake: false, ducktail: false, scoop: false, hoop: true, noRoof: true, seat: true, airbox: true, wide: true,
  },
};

// ---------------------------------------------------------- Upgrade 39: crisper bodywork
// The old tails and noses closed to a soft rounded point, which made every coupe read as a smooth pill. A "Kamm tail" ends in a tall, flat face with
// tight corners (the lamps, plate, diffuser and exhausts all sit on it), and a squarer section down the haunches gives a flatter, harder shoulder.
// The numbers are derived from each car's own first stations, so every car keeps its own width, height and character.
function kammTail(A, k = {}) {
  const st = A.body, s0 = st[0], s1 = st[1], s2 = st[2];
  A.body = [
    [s0[0], s1[1] * (k.w ?? 0.95), Math.min(s1[2], 0.4) - 0.03, s1[3] - (k.drop ?? 0.07), k.n0 ?? 8],
    [s1[0], s1[1] * 0.99, s1[2] - 0.03, s1[3], k.n1 ?? 6.5],
    [s2[0], s2[1], s2[2], s2[3], k.n2 ?? 5.2],
    ...st.slice(3),
  ];
  return A;
}
// A blunter, wider nose with a flat leading edge in place of the old pointed wedge: it reads as a modern front fascia, and it carries the intakes and lamps.
function wideNose(A, k = {}) {
  const st = A.body, m = st.length, a = st[m - 3], b = st[m - 2], c = st[m - 1];
  A.body = [...st.slice(0, m - 3),
    [a[0], a[1], a[2], a[3], k.n0 ?? 5],
    [b[0], Math.max(b[1], a[1] * 0.95), b[2] - 0.01, b[3], k.n1 ?? 5],
    [c[0], Math.max(c[1], a[1] * (k.tip ?? 0.8)), c[2], c[3] + 0.02, k.n2 ?? 5]];
  return A;
}
// Harder shoulders: a squarer section along the flanks and a deeper shoulder crease and sill groove, so the light breaks along a line instead of rolling off a pill.
function crisp(A) { A.nBody = +(A.nBody + 0.9).toFixed(2); A.crease = (A.crease ?? 0.03) * 1.7; A.sillGroove = (A.sillGroove ?? 0.022) * 1.35; return A; }
for (const id of Object.keys(ARCH)) if (!ARCH[id].open) { crisp(wideNose(kammTail(ARCH[id]))); }

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgnpow = (x, p) => (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), p);
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function sampleSt(st, x) {
  let i = 0;
  while (i < st.length - 2 && x > st[i + 1][0]) i++;
  const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)];
  const t = clamp((x - b[0]) / (c[0] - b[0]), 0, 1);
  const out = [1, 2, 3].map((k) => cr(a[k], b[k], c[k], d[k], t));
  // Upgrade 39: a station may carry a 5th number, how square its cross-section is (4 = soft, 8 = a flat face with tight corners).
  // Stations without one are left as NaN and the car's own default is used, so every old table behaves exactly as before.
  if (b.length > 4 && c.length > 4) { const g = (s) => (s.length > 4 ? s[4] : b[4]); out.push(cr(g(a), g(b), g(c), g(d), t)); } else out.push(NaN);
  return out;
}

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// A smooth body "loft": cross-sections every few centimetres along the car, rounded with a super-ellipse.
// Wheel arches are crisp cut-outs; a baked ambient-occlusion tone (vertex colour) darkens the sills, arches and underside.
export function loft(st, n, seg = 54, rad = 32, nBot = 7, carves = [], ao = false, bumps = [], creases = []) {
  const x0 = st[0][0], x1 = st[st.length - 1][0];
  const pos = [], uv = [], idx = [], col = [];
  const pb = 2 / nBot;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const x = x0 + (x1 - x0) * t;
    const [w, yb, yt, ns] = sampleSt(st, x);
    const yc = (yb + yt) / 2, hh = Math.max(0.005, (yt - yb) / 2);
    const p = 2 / (Number.isFinite(ns) && ns > 0 ? ns : n);
    for (let j = 0; j <= rad; j++) {
      const th = -Math.PI / 2 + (j / rad) * Math.PI * 2;
      const sn = Math.sin(th), cs = Math.cos(th);
      const pp = sn >= 0 ? p : pb;
      let py = yc + hh * sgnpow(sn, pp);
      let pz = w * sgnpow(cs, sn >= 0 ? p : pb);
      let shade = 1, dent = 0;
      if (carves.length && Math.abs(pz) > w * 0.45) {
        for (const c of carves) {
          const d = Math.hypot(x - c.x, py - c.y);
          if (d < c.r) {
            const f0 = clamp((c.r - d) / (c.r * 0.12), 0, 1), f = f0 * f0 * (3 - 2 * f0);
            const az = Math.max(Math.abs(pz) * 0.4, Math.abs(pz) - c.depth * f);
            pz = (pz < 0 ? -1 : 1) * az; if (f > dent) dent = f;
          }
        }
      }
      if (creases.length) { const sgn = cs >= 0 ? 1 : -1; for (const cr of creases) { const gx = sstep(cr.x0, cr.x0 + cr.fade, x) * (1 - sstep(cr.x1 - cr.fade, cr.x1, x)); if (gx > 0) { const u = (sn - cr.sn) / cr.sig; pz += sgn * cr.amp * gx * Math.exp(-u * u) * Math.min(1, Math.abs(cs) * 3); } } }
      if (bumps.length && sn > 0.05) { const kz = Math.abs(pz) / w; for (const bp of bumps) { const dx = (x - bp.x) / bp.sx; if (Math.abs(dx) < 3) py += bp.amp * Math.exp(-Math.pow(Math.abs(dx), bp.flat ? 3 : 2)) * sstep(0.4, 0.78, kz) * (1 - sstep(0.88, 1.0, kz)) * Math.min(1, sn * 2.5); } }
      if (ao) {
        shade = 0.5 + 0.5 * sstep(yb + 0.0, yb + 0.28, py);                    // darker toward the sills
        if (sn < -0.2) shade *= 0.42;                                          // underside
        for (const c of carves) { const d = Math.hypot(x - c.x, py - c.y); if (d < c.r * 1.7) shade *= 0.55 + 0.45 * sstep(c.r * 0.95, c.r * 1.7, d); }
        shade *= 1 - 0.88 * dent;
        const endK = Math.min(t, 1 - t); shade *= 0.8 + 0.2 * sstep(0, 0.07, endK) ; // tuck the bumper ends
      }
      pos.push(x, py, pz);
      uv.push(t, j / rad);
      col.push(shade, shade, shade);
    }
  }
  const ring = rad + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps
  for (const end of [0, seg]) {
    const base = pos.length / 3;
    const [w, yb, yt] = sampleSt(st, end === 0 ? x0 : x1);
    pos.push(end === 0 ? x0 : x1, (yb + yt) / 2, 0); uv.push(end === 0 ? 0 : 1, 0.5); col.push(0.7, 0.7, 0.7);
    for (let j = 0; j < rad; j++) {
      const a = end * ring + j, b = a + 1;
      if (end === 0) idx.push(base, a, b); else idx.push(base, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (ao) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the surface faces outwards (top of the car should point up)
  const topIdx = (Math.floor(seg / 2) * ring + Math.floor(rad / 2)) * 3 + 1;
  if (g.attributes.normal.array[topIdx] < 0) {
    const ix = g.index.array;
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let carbonTex = null;
function getCarbonTex() {
  if (carbonTex) return carbonTex;
  carbonTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#0b0b0e"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const a = ((x + y) / 8) % 2 === 0;
      g.fillStyle = a ? "#1c1c22" : "#111116"; g.fillRect(x, y, 8, 4);
      g.fillStyle = a ? "#111116" : "#1c1c22"; g.fillRect(x, y + 4, 8, 4);
    }
  });
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(8, 3);
  return carbonTex;
}

// Livery overlay, drawn in the body's own UV space: u runs tail->nose,
// v wraps around (0.5 = roof centre, 0.25 = right flank, 0.75 = left).
function liveryTexture(livery, number) {
  if (!livery || livery.type === "none") return null;
  const W = 1024, H = 512;
  const col = livery.color || "#f2f2f2";
  return canvasTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const Y = (v) => (1 - v) * H;
    g.fillStyle = col;
    const band = (v0, v1, u0 = 0, u1 = 1) => g.fillRect(u0 * W, Y(v1), (u1 - u0) * W, Math.abs(Y(v0) - Y(v1)));
    if (livery.type === "stripes") {
      band(0.46, 0.485, 0.1, 0.9); band(0.515, 0.54, 0.1, 0.9);
    } else if (livery.type === "side") {
      for (const c0 of [0.25, 0.75]) {
        g.beginPath();
        g.moveTo(0.1 * W, Y(c0 - 0.03)); g.lineTo(0.95 * W, Y(c0 - 0.075));
        g.lineTo(0.95 * W, Y(c0 - 0.03)); g.lineTo(0.1 * W, Y(c0 + 0.0)); g.closePath(); g.fill();
        g.globalAlpha = 0.55; band(c0 + 0.035, c0 + 0.06, 0.2, 0.92); g.globalAlpha = 1;
      }
    } else if (livery.type === "racing") {
      band(0.47, 0.53, 0.1, 0.9);
      for (const c0 of [0.25, 0.75]) {
        g.fillStyle = "#f4f4f4"; g.beginPath(); g.ellipse(0.5 * W, Y(c0), 0.07 * W, 0.075 * H, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#111"; g.font = `bold ${Math.round(0.11 * H)}px Arial Black, Impact, sans-serif`;
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(number ?? 7), 0.5 * W, Y(c0) + 2);
      }
      g.fillStyle = col;
    } else if (livery.type === "checker") {
      const sq = 14;
      for (let i = 0; i < 20; i++) for (let j = 0; j < 14; j++) {
        if ((i + j) % 2) continue;
        g.globalAlpha = Math.max(0, 1 - i / 20);
        g.fillRect(W * 0.62 + i * sq, Y(0.5) - 7 * sq + j * sq, sq, sq);
        g.fillRect(W * 0.62 + i * sq, Y(0.25) - 3 * sq + (j % 7) * sq, sq, sq);
        g.fillRect(W * 0.62 + i * sq, Y(0.75) - 3 * sq + (j % 7) * sq, sq, sq);
      }
      g.globalAlpha = 1;
    } else if (livery.type === "hex") {
      const r = 22;
      for (let i = 0; i < 40; i++) for (let j = 0; j < 22; j++) {
        const x = i * r * 1.75, y = j * r * 1.52 + (i % 2 ? r * 0.76 : 0);
        const f = Math.max(0, 1 - x / W * 1.15);
        g.globalAlpha = f * 0.8;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k + Math.PI / 6; g.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
    } else if (livery.type === "speed") { // long tapered streaks down both flanks, longest low on the body, trailing back from the nose
      let sd = 7; const rn = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      for (const c0 of [0.25, 0.75]) for (let k = 0; k < 15; k++) {
        const v = c0 - 0.1 + rn() * 0.18, len = 0.2 + rn() * 0.5, u1 = 0.96 - rn() * 0.1, u0 = u1 - len, th = 0.004 + rn() * 0.008;
        g.globalAlpha = 0.45 + rn() * 0.5;
        g.beginPath(); g.moveTo(u1 * W, Y(v)); g.lineTo(u0 * W, Y(v + th * 0.2)); g.lineTo(u0 * W, Y(v - th * 0.2)); g.closePath(); g.fill();
        g.fillRect(u0 * W + len * W * 0.2, Y(v + th), len * W * 0.8, th * H * 1.5);
      }
      g.globalAlpha = 1;
    } else if (livery.type === "split") { // the lower body in a second colour with a raked top edge, and a thin pin-stripe above it
      for (const c0 of [0.25, 0.75]) {
        const lo = c0 < 0.5 ? 0.0 : 1.0, up = c0 < 0.5 ? 1 : -1;
        const a = c0 + 0.0 * up, b = c0 + 0.08 * up; // top edge: low at the tail, higher at the nose
        g.beginPath(); g.moveTo(0.04 * W, Y(lo)); g.lineTo(0.04 * W, Y(a)); g.lineTo(0.96 * W, Y(b)); g.lineTo(0.96 * W, Y(lo)); g.closePath(); g.fill();
        g.globalAlpha = 0.85; g.beginPath(); g.moveTo(0.04 * W, Y(a + 0.015 * up)); g.lineTo(0.96 * W, Y(b + 0.015 * up)); g.lineTo(0.96 * W, Y(b + 0.028 * up)); g.lineTo(0.04 * W, Y(a + 0.028 * up)); g.closePath(); g.fill(); g.globalAlpha = 1;
      }
    } else if (livery.type === "flames") { // tongues of fire licking back from the front wheel arch
      for (const c0 of [0.25, 0.75]) {
        const up = c0 < 0.5 ? 1 : -1;
        const tongue = (u0, v0, len, hgt, a) => {
          g.globalAlpha = a; g.beginPath(); g.moveTo(u0 * W, Y(v0));
          g.bezierCurveTo((u0 - len * 0.3) * W, Y(v0 + up * hgt * 0.1), (u0 - len * 0.6) * W, Y(v0 + up * hgt * 0.9), (u0 - len) * W, Y(v0 + up * hgt));
          g.bezierCurveTo((u0 - len * 0.62) * W, Y(v0 + up * hgt * 0.35), (u0 - len * 0.5) * W, Y(v0 - up * hgt * 0.05), (u0 - len * 0.2) * W, Y(v0 - up * 0.045));
          g.closePath(); g.fill();
        };
        for (let k = 0; k < 6; k++) tongue(0.97 - k * 0.012, c0 - up * (0.06 - k * 0.012), 0.42 - k * 0.04, 0.06 + (k % 3) * 0.02, 0.95);
        g.fillStyle = "#fff3c4"; for (let k = 0; k < 4; k++) tongue(0.97 - k * 0.012, c0 - up * (0.05 - k * 0.012), 0.26 - k * 0.04, 0.035 + (k % 2) * 0.012, 0.8);
        g.fillStyle = col;
      }
      g.globalAlpha = 1;
    } else if (livery.type === "camo") { // blotchy night camouflage over the whole body
      let sd = 99; const rn = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const dark = (() => { const c = new THREE.Color(col); c.multiplyScalar(0.45); return "#" + c.getHexString(); })();
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass ? dark : col; g.globalAlpha = 0.9;
        for (let k = 0; k < 70; k++) {
          const x = rn() * W, y = rn() * H, rx = 18 + rn() * 54, ry = 10 + rn() * 28, rot = rn() * Math.PI;
          g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(x + rx * 0.5, y + ry * 0.4, rx * 0.6, ry * 0.7, rot + 0.6, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1; g.fillStyle = col;
    } else if (livery.type === "grid") { // a glowing wireframe that fades towards the nose
      g.strokeStyle = col; g.lineWidth = 2;
      for (let i = 0; i <= 44; i++) { const x = (i / 44) * W; g.globalAlpha = 0.85 * (1 - 0.65 * (i / 44)); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let j = 0; j <= 24; j++) { const y = (j / 24) * H; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.globalAlpha = 1;
    } else if (livery.type === "rally") { // gravel-stage look: wide diagonal bands, a bonnet number panel and door roundels
      for (const c0 of [0.25, 0.75]) {
        const up = c0 < 0.5 ? 1 : -1;
        for (const [ua, ub] of [[0.18, 0.3], [0.33, 0.37]]) {
          g.beginPath(); g.moveTo(ua * W, Y(c0 - up * 0.12)); g.lineTo(ub * W, Y(c0 - up * 0.12)); g.lineTo((ub + 0.1) * W, Y(c0 + up * 0.12)); g.lineTo((ua + 0.1) * W, Y(c0 + up * 0.12)); g.closePath(); g.fill();
        }
        g.fillStyle = "#f4f4f4"; g.beginPath(); g.ellipse(0.62 * W, Y(c0), 0.06 * W, 0.07 * H, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#111"; g.font = `bold ${Math.round(0.1 * H)}px Arial Black, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(number ?? 7), 0.62 * W, Y(c0) + 2); g.fillStyle = col;
      }
      g.fillStyle = "#f4f4f4"; g.fillRect(0.74 * W, Y(0.56), 0.1 * W, 0.12 * H); g.fillStyle = "#111"; g.font = `bold ${Math.round(0.09 * H)}px Arial Black, Impact, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(number ?? 7), 0.79 * W, Y(0.5)); g.fillStyle = col;
    }
  });
}

let flakeTex = null;
function getFlakeTex() {
  if (flakeTex) return flakeTex;
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), d = g.createImageData(S, S);
  let seed = 4242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) {
    const nx = (rnd() - 0.5) * 0.9, ny = (rnd() - 0.5) * 0.9, l = Math.hypot(nx, ny, 1);
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      const i = ((y + yy) * S + x + xx) * 4;
      d.data[i] = (nx / l * 0.5 + 0.5) * 255; d.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; d.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; d.data[i + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
  flakeTex = new THREE.CanvasTexture(c);
  flakeTex.wrapS = flakeTex.wrapT = THREE.RepeatWrapping; flakeTex.repeat.set(46, 24);
  return flakeTex;
}

// Cuts crisp circular wheel-arch openings into a body material in the fragment shader (exact circles, independent of the mesh density).
function cutArches(mat, spots, key) {
  const code = spots.map((q) => `{ vec2 d = vObjPos.xy - vec2(${q.x.toFixed(4)}, ${q.y.toFixed(4)}); cutA = max(cutA, ${q.r.toFixed(4)} - length(d)); zc = max(zc, 0.0); zmin = ${q.zmin.toFixed(4)}; if (abs(vObjPos.z) > zmin && cutA > 0.0) discard; }`).join("\n");
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;").replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n{ float cutA = -1.0; float zc = 0.0; float zmin = 0.0; ${code} }`);
  };
  mat.customProgramCacheKey = () => "arch:" + key;
  return mat;
}

// Crisp panel seams drawn in the paint itself (bonnet, boot lid, bumper splits), thin dark grooves that stay sharp at any zoom.
// Each seam is a short line in one of three planes: the top (x, |z|), the nose/tail face (|z|, y).
function seamPaint(mat, top, face, key) {
  const f = (n) => n.toFixed(4);
  const topCode = top.map(([a, b, c, d]) => `dm = min(dm, segD(vec2(op.x, abs(op.z)), vec2(${f(a)}, ${f(b)}), vec2(${f(c)}, ${f(d)})));`).join("\n");
  const faceCode = face.map(([a, b, c, d, xs, xe]) => `if (op.x > ${f(xs)} && op.x < ${f(xe)}) df = min(df, segD(vec2(abs(op.z), op.y), vec2(${f(a)}, ${f(b)}), vec2(${f(c)}, ${f(d)})));`).join("\n");
  const prev = mat.onBeforeCompile; const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : "";
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjN;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjN = normal;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjN;\nfloat segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }")
      .replace("#include <color_fragment>", `#include <color_fragment>
      { vec3 op = vObjPos; vec3 nO = normalize(vObjN); float dm = 9.0, df = 9.0;
        ${topCode}
        ${faceCode}
        float w1 = 0.0028;
        float mt = smoothstep(0.5, 0.82, nO.y) * (1.0 - smoothstep(w1, w1 + max(fwidth(dm), 0.0015), dm));
        float mf = smoothstep(0.25, 0.55, abs(nO.x)) * (1.0 - smoothstep(w1, w1 + max(fwidth(df), 0.0015), df));
        float g = clamp(max(mt, mf), 0.0, 1.0);
        diffuseColor.rgb *= 1.0 - 0.88 * g; }`);
  };
  mat.customProgramCacheKey = () => prevKey + "|seam:" + key;
  return mat;
}

function paintMaterial(spec, envMap) {
  const color = new THREE.Color(spec.color);
  const f = spec.finish;
  const base = { color, envMap, envMapIntensity: 1.15 };
  if (f === "matte") return new THREE.MeshStandardMaterial({ ...base, roughness: 0.78, metalness: 0.15, envMapIntensity: 0.5 });
  if (f === "metallic") return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.95, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.09, 0.09) });
  if (f === "pearl") return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700], envMapIntensity: 1.5, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.15, 0.15) });
  if (f === "primer") return new THREE.MeshStandardMaterial({ ...base, color: new THREE.Color(0x8c8d88).lerp(color, 0.06), roughness: 0.96, metalness: 0, envMapIntensity: 0.25 });
  if (f === "candy") return new THREE.MeshPhysicalMaterial({ ...base, color: color.clone().multiplyScalar(0.78), roughness: 0.2, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.015, envMapIntensity: 1.7, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.05, 0.05) });
  if (f === "chameleon") return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.24, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 1, iridescenceIOR: 2.1, iridescenceThicknessRange: [120, 950], sheen: 0.55, sheenColor: new THREE.Color(0xffffff).lerp(color, 0.6), sheenRoughness: 0.4, envMapIntensity: 1.7, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.07, 0.07) });
  if (f === "chrome") return new THREE.MeshStandardMaterial({ ...base, color: new THREE.Color(0xf4f6ff).lerp(color, 0.22), roughness: 0.03, metalness: 1, envMapIntensity: 2.4 });
  if (f === "satin") return new THREE.MeshStandardMaterial({ ...base, roughness: 0.16, metalness: 1, envMapIntensity: 1.8 });
  if (f === "carbon") return new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, map: getCarbonTex(), roughness: 0.4, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03 });
  return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.035, emissive: color, emissiveIntensity: 0.04, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.05, 0.05) });
}

const carbonMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, map: getCarbonTex(), roughness: 0.42, metalness: 0.35 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.6, metalness: 0.3 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.9, metalness: 0 });
const discMat = new THREE.MeshStandardMaterial({ color: 0x6a6d78, roughness: 0.35, metalness: 0.9 });
const caliperMat = new THREE.MeshStandardMaterial({ color: 0xd4202a, roughness: 0.4, metalness: 0.3 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
const drlMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });

// ---------------------------------------------------------------- wheels
function makeWheel(style, rimColor, R, W, envMap) {
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 36, 1, true), tireMat);
  tire.rotation.x = Math.PI / 2; spin.add(tire);
  const ringGeo = new THREE.RingGeometry(R * 0.66, R, 36);
  const side = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.92, side: THREE.DoubleSide }));
  side.position.z = W / 2; spin.add(side);
  const side2 = side.clone(); side2.position.z = -W / 2; spin.add(side2);
  const rm = new THREE.MeshStandardMaterial({ color: new THREE.Color(rimColor), roughness: 0.22, metalness: 0.95, envMap, envMapIntensity: 1.4 });
  const rr = R * 0.7;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.022, 8, 32), rm); lip.position.z = W / 2 - 0.005; spin.add(lip);
  const lip2 = lip.clone(); lip2.position.z = -W / 2 + 0.005; spin.add(lip2);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.98, rr * 0.98, W * 0.98, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide }));
  barrel.rotation.x = Math.PI / 2; spin.add(barrel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.14, R * 0.14, W * 0.7, 12), rm); hub.rotation.x = Math.PI / 2; spin.add(hub);
  const faceZ = W / 2 - 0.035;
  const spokeCount = { fivespoke: 5, ten: 10, turbine: 12, mesh: 0, deep: 0 }[style] ?? 5;
  const spokeW = { fivespoke: 0.085, ten: 0.04, turbine: 0.03 }[style] ?? 0.05;
  for (let k = 0; k < spokeCount; k++) {
    const a = (k / spokeCount) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(rr * 0.95, spokeW, 0.035), rm);
    sp.position.set(Math.cos(a) * rr * 0.48, Math.sin(a) * rr * 0.48, faceZ);
    sp.rotation.z = a;
    if (style === "turbine") sp.rotation.z = a + 0.5;
    spin.add(sp);
  }
  if (style === "mesh") {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(rr * 1.9, 0.022, 0.03), rm);
      sp.position.z = faceZ; sp.rotation.z = a; spin.add(sp);
      const sp2 = sp.clone(); sp2.rotation.z = a + 0.45; spin.add(sp2);
    }
  }
  if (style === "deep") {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, 0.02, 32), rm);
    dish.rotation.x = Math.PI / 2; dish.position.z = faceZ - 0.04; spin.add(dish);
    const bolt = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, 0.012, 6, 5), blackMat);
    bolt.position.z = faceZ - 0.02; spin.add(bolt);
  }
  // brake disc sits behind the spokes (does not need to spin visibly)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.9, rr * 0.9, 0.03, 28), discMat);
  disc.rotation.x = Math.PI / 2; disc.position.z = W / 2 - 0.12; spin.add(disc);
  return spin;
}

// ---------------------------------------------------------------- the car
export function createHeroCar(specIn, opts = {}) {
  const spec = specOf(specIn);
  const A0 = ARCH[spec.car] || ARCH.kestrel;
  // a table that gives some stations their own squareness gets the car's default on the rest, so the lookup is uniform
  const fillN = (st, nd) => (st.some((q) => q.length > 4) ? st.map((q) => (q.length > 4 ? q : [...q, nd])) : st);
  const A = { ...A0, body: fillN(A0.body, A0.nBody), cab: fillN(A0.cab, A0.nCab) };
  const envMap = opts.envMap || null;
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const shell = new THREE.Group(); g.add(shell);
  const paint = paintMaterial(spec, envMap);
  const tint = TINTS.find((t) => t.id === spec.tint) || TINTS[0];
  const glass = new THREE.MeshPhysicalMaterial({ color: tint.color, roughness: tint.mirror ? 0.02 : 0.03, metalness: tint.mirror ? 1 : 0.55, envMap, envMapIntensity: tint.mirror ? 2.6 : 2.0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: tint.id === "clear" ? 0.4 : tint.mirror ? 0.9 : 0.62, depthWrite: false });
  const geoms = [];

  // wheels sit in arches: tyre face flush with the fender, flank dented around it
  const open = !!A.open;
  const wheelSpots = [A.wf, A.wr].map((wd) => {
    const bw = sampleSt(A.body, wd.x)[0];
    return { wd, bw, z: open ? A.wz : bw - wd.w / 2 - 0.015 };
  });
  const carves = open ? [] : wheelSpots.map(({ wd }) => ({ x: wd.x, y: wd.r, r: wd.r * 1.2, depth: 0 }));
  const archSpots = open ? [] : wheelSpots.map(({ wd, bw }) => ({ x: wd.x, y: wd.r, r: wd.r * 1.17, zmin: bw * 0.46 }));
  // fender humps: lifted to cover the top of the tyre where the roofline is low (wide prototypes), with a flat top so the whole arch is roofed
  const bumps = open ? [] : wheelSpots.map(({ wd }) => { const rr = wd.r * 1.17; const deficit = rr * 2 + 0.03 - sampleSt(A.body, wd.x)[2]; return { x: wd.x, amp: clamp(Math.max(A.fender ?? 0.05, deficit + 0.02), 0, 0.17), sx: Math.max(0.5, rr * 1.15), flat: true }; });
  const lite = (opts.lod ?? 1) < 1; // rivals and the player's pack use a lighter mesh: the same car at about a third of the triangles
  const noseX0 = A.L / 2, tailX0 = -A.L / 2;
  // character lines: a shoulder crease that catches the light down each flank, and a recessed sill line below it
  const creases = open ? [] : [
    { x0: tailX0 + 0.35, x1: noseX0 - 0.45, fade: 0.55, sn: 0.34, sig: 0.17, amp: A.crease ?? 0.03 },
    { x0: tailX0 + 0.5, x1: noseX0 - 0.6, fade: 0.5, sn: -0.5, sig: 0.15, amp: -(A.sillGroove ?? 0.022) },
  ];
  const bodyGeo = loft(A.body, A.nBody, lite ? 120 : 200, lite ? 60 : 100, 7, carves, true, bumps, creases); geoms.push(bodyGeo);
  const bodyPaint = paint.clone(); bodyPaint.vertexColors = true; if (archSpots.length) cutArches(bodyPaint, archSpots, spec.car); geoms.push({ dispose() { bodyPaint.dispose(); } });
  if (!open) { // seams: bonnet and boot-lid outlines on the top plane; bumper splits on the nose and tail faces
    const nx = A.L / 2, tx = -A.L / 2, wAt = (x) => sampleSt(A.body, x)[0], cabF = A.cab[A.cab.length - 1][0], cabR = A.cab[0][0];
    const topS = [], faceS = [];
    const outline = (xa, xb, k) => { const n = 5; let px = xa; topS.push([xa, 0, xa, wAt(xa) * k]); for (let i = 1; i <= n; i++) { const xx = xa + (xb - xa) * (i / n); topS.push([px, wAt(px) * k, xx, wAt(xx) * k]); px = xx; } topS.push([xb, wAt(xb) * k, xb, 0]); };
    if (nx - cabF > 0.95) outline(cabF + 0.12, nx - 0.5, 0.74);            // bonnet
    if (cabR - tx > 0.8) outline(cabR - 0.06, tx + 0.3, 0.7);               // boot lid
    { const [w, yb, yt] = sampleSt(A.body, nx - 0.15); faceS.push([0, yb + (yt - yb) * 0.42, w * 0.97, yb + (yt - yb) * 0.42, nx - 0.5, nx + 1]); }
    { const [w, yb, yt] = sampleSt(A.body, tx + 0.15); faceS.push([0, yb + (yt - yb) * 0.4, w * 0.97, yb + (yt - yb) * 0.4, tx - 1, tx + 0.5]); }
    seamPaint(bodyPaint, topS, faceS, spec.car);
  }
  const body = new THREE.Mesh(bodyGeo, bodyPaint); shell.add(body);

  if (spec.livery?.type && spec.livery.type !== "none") {
    const tex = liveryTexture(spec.livery, spec.number);
    const ov = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.35, metalness: 0.3, envMap, envMapIntensity: 0.8,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false,
    }));
    if (archSpots.length) cutArches(ov.material, archSpots, spec.car + "L");
    ov.scale.set(1.0015, 1.003, 1.003); shell.add(ov);
  }

  const cabGeo = loft(A.cab, A.nCab, 44, 28); geoms.push(cabGeo);
  { const gm = new THREE.Mesh(cabGeo, glass); gm.renderOrder = 3; shell.add(gm); }
  // painted roof panel
  const roofSt = A.noRoof ? A.cab.slice(1, 2) : A.cab.slice(1, -1).map(([x, w, yb, yt]) => [x, w * 0.9, yt - 0.03, yt + 0.035]);
  const roofGeo = loft([[roofSt[0][0] - 0.03, roofSt[0][1] * 0.6, roofSt[0][2], roofSt[0][3]], ...roofSt, [roofSt[roofSt.length - 1][0] + 0.02, roofSt[roofSt.length - 1][1] * 0.6, roofSt[roofSt.length - 1][2], roofSt[roofSt.length - 1][3]]], A.nCab, 36, 20);
  geoms.push(roofGeo);
  const roofMat = spec.roof === "black" || spec.roof === "white"
    ? new THREE.MeshPhysicalMaterial({ color: spec.roof === "black" ? 0x0a0a0e : 0xf2f2f2, roughness: 0.28, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, envMap, envMapIntensity: 1.2 })
    : spec.roof === "carbon" ? carbonMat() : paint;
  shell.add(new THREE.Mesh(roofGeo, roofMat));

  const at = (x) => sampleSt(A.body, x); // [w, yb, yt, n]
  const nAt = (x) => { const v = at(x)[3]; return Number.isFinite(v) && v > 0 ? v : A.nBody; };
  // height of the upper surface of the body at (x, lateral z)
  const surf = (x, z) => { const [w, yb, yt] = at(x); const k = Math.min(0.999, Math.abs(z) / w); const yc = (yb + yt) / 2, hh = (yt - yb) / 2; const nn = nAt(x); return yc + hh * Math.pow(Math.max(0, 1 - Math.pow(k, nn)), 1 / nn); };
  const cabAt = (x) => sampleSt(A.cab, x);
  const bumpH = (x, z) => { const w = at(x)[0]; const kz = Math.min(1, Math.abs(z) / w); let h = 0; for (const bp of bumps) { const dx = (x - bp.x) / bp.sx; if (Math.abs(dx) < 3) h += bp.amp * Math.exp(-Math.pow(Math.abs(dx), bp.flat ? 3 : 2)) * sstep(0.4, 0.78, kz) * (1 - sstep(0.88, 1.0, kz)); } return h; };
  const noseX = A.L / 2, tailX = -A.L / 2;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    geoms.push(geo);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); shell.add(m); return m;
  };

  const kit = spec.kit;
  const kitScale = { street: 1.15, race: 1.6, wide: 1.3, drift: 1.45, attack: 1.9 }[kit] || 1;
  const cm = carbonMat();
  // front splitter + canards, side skirts, diffuser
  const [nw] = at(noseX - 0.3);
  add(new THREE.BoxGeometry(0.26 * kitScale, 0.025, nw * 2 * 0.9), cm, noseX - 0.28 + 0.05 * (kitScale - 1), 0.285, 0);
  if (kit !== "stock") for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.02, 0.2), cm, noseX - 0.7, 0.42, s * (nw * 0.98), 0, 0, 0.35 * s);
  const skirtLen = (A.wf.x - A.wr.x) * 0.78;
  for (const s of [-1, 1]) {
    const [sw] = at((A.wf.x + A.wr.x) / 2);
    add(new THREE.BoxGeometry(skirtLen, kit === "stock" ? 0.07 : 0.1, 0.07), cm, (A.wf.x + A.wr.x) / 2, 0.31, s * (sw - 0.005));
  }
  add(new THREE.BoxGeometry(0.5 * kitScale, 0.05, A.halfW * 1.35), cm, tailX + 0.22, 0.34, 0, 0, 0, -0.28);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.4, 0.14, 0.02), cm, tailX + 0.2, 0.42, k * 0.2, 0, 0, 0);
  // Upgrade 38 body kits: widebody arch flares, drift ground-effect sills, time-attack dive planes and a bigger diffuser
  if (!open && kit === "wide") for (const { wd, bw } of wheelSpots) for (const sd of [-1, 1]) {
    const tg = new THREE.TorusGeometry(wd.r * 1.17 + 0.03, 0.045, 8, 30, Math.PI); geoms.push(tg);
    const fm = new THREE.Mesh(tg, paint); fm.position.set(wd.x, wd.r, sd * (bw - 0.01)); shell.add(fm);
    const bar = new THREE.BoxGeometry(wd.r * 2.5, 0.05, 0.05); geoms.push(bar); const bm = new THREE.Mesh(bar, cm); bm.position.set(wd.x, wd.r * 0.62, sd * (bw + 0.005)); shell.add(bm); // lower flare strake
  }
  if (kit === "drift") for (const s of [-1, 1]) { const [sw] = at((A.wf.x + A.wr.x) / 2); add(new THREE.BoxGeometry(skirtLen * 0.95, 0.035, 0.17), cm, (A.wf.x + A.wr.x) / 2, 0.27, s * (sw + 0.04)); }
  if (kit === "attack") {
    for (const s of [-1, 1]) for (const dz of [0, 0.14]) add(new THREE.BoxGeometry(0.28, 0.02, 0.17), cm, noseX - 0.62 + dz, 0.37 + dz * 0.6, s * (nw * 0.97 - dz * 0.6), 0, 0, 0.5 * s);
    add(new THREE.BoxGeometry(0.03, 0.12, nw * 1.7), cm, noseX - 0.14, 0.34, 0);
    add(new THREE.BoxGeometry(0.7, 0.045, A.halfW * 1.6), cm, tailX + 0.3, 0.32, 0, 0, 0, -0.36);
  }

  // The body skin: find where a point (y, z) meets the nose or tail of the loft, and the surface normal there, so lamps wrap the real contour.
  const Fskin = (x, y, z) => { const [w, yb, yt] = at(x); const yc = (yb + yt) / 2, hh = Math.max(0.005, (yt - yb) / 2); const dy = y - yc; const n = dy >= 0 ? nAt(x) : 7; return Math.pow(Math.abs(z) / w, n) + Math.pow(Math.abs(dy) / hh, n); };
  const skinAt = (y, z, rear) => {
    const xa0 = A.body[0][0], xa1 = A.body[A.body.length - 1][0]; const xs0 = rear ? xa0 + 1.4 : xa1 - 1.4, xe = rear ? xa0 : xa1; const N = 140, st = (xe - xs0) / N;
    let xp = xs0; if (Fskin(xp, y, z) >= 1) return null;
    for (let k = 1; k <= N; k++) {
      const xq = xs0 + st * k;
      if (Fskin(xq, y, z) >= 1) {
        let lo = xp, hi = xq; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (Fskin(m, y, z) >= 1) hi = m; else lo = m; }
        const x = (lo + hi) / 2, e = 0.012;
        const nrm = new THREE.Vector3((Fskin(x + e, y, z) - Fskin(x - e, y, z)), (Fskin(x, y + e, z) - Fskin(x, y - e, z)), (Fskin(x, y, z + e) - Fskin(x, y, z - e))).normalize();
        return { x, y, z, n: nrm };
      }
      xp = xq;
    }
    // a flat Kamm tail or blunt nose: the point never leaves the section, so it sits on the end face itself, facing straight out
    if (Fskin(xe, y, z) < 1) return { x: xe, y, z, n: new THREE.Vector3(rear ? -1 : 1, 0, 0) };
    return null;
  };
  const skinFrame = (n) => { // basis with +y = surface normal, +z = lateral, +x = y cross z (forward on the nose, up on the tail)
    const tz = new THREE.Vector3(0, 0, 1).sub(n.clone().multiplyScalar(n.z)); if (tz.lengthSq() < 1e-6) tz.set(0, 1, 0); tz.normalize();
    const tx = new THREE.Vector3().crossVectors(n, tz).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, n, tz));
  };
  const putOnSkin = (obj, y, z, rear, lift = 0) => { // z >= 0 is the right side; pass mirror = true for the left
    const sk = skinAt(y, Math.abs(z), rear); if (!sk) return false;
    const q = skinFrame(sk.n); const p = new THREE.Vector3(sk.x, sk.y, Math.abs(z)).addScaledVector(sk.n, lift);
    if (z >= 0) { obj.position.copy(p); obj.quaternion.copy(q); } else { obj.position.set(p.x, p.y, -p.z); obj.quaternion.set(-q.x, -q.y, q.z, q.w); obj.scale.z = -1; }
    shell.add(obj); obj.traverse((o) => { if (o.geometry) geoms.push(o.geometry); }); return true;
  };
  const lightSpec = LIGHTS.find((l) => l.id === spec.lights) || LIGHTS[0];
  const lensMatC = new THREE.MeshBasicMaterial({ color: lightSpec.lens }), drlMatC = new THREE.MeshBasicMaterial({ color: lightSpec.drl });
  const style = A.face || (A.fin || A.snorkel ? "slit" : A.scoop ? "wide" : A.ducktail ? "round" : "slit");
  const glowCol = 0xcfeaff;
  { const xh = noseX - 0.45; const [hw1, , ht1] = at(xh);
    for (const s of [-1, 1]) {
      const lamp = makeHeadlamp(style, style === "quad" ? 0.32 : 0.27, style === "round" ? 0.26 : 0.19, glowCol, envMap);
      if (lightSpec.id !== "white") { const pm = partMats(); lamp.traverse((o) => { if (o.material === pm.lampWarm) o.material = lensMatC; else if (o.material === pm.lampCool) o.material = drlMatC; }); }
      if (!putOnSkin(lamp, ht1 - 0.09, s * hw1 * 0.66, false, -0.004)) { lamp.position.set(noseX - 0.5, ht1, s * hw1 * 0.66); shell.add(lamp); }
    } }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xb81616 });
  const tstyle = A.tail || (A.ducktail ? "round" : A.fin ? "split" : "bar");
  { const xt = tailX + 0.5; const [tw1, , tt1] = at(xt); const [tw, , ty] = at(tailX + 0.12);
    for (const s of [-1, 1]) {
      const lp = makeTaillamp(tstyle, 0.12, Math.min(0.42, tw1 * 0.48), tailMat);
      if (!putOnSkin(lp, tt1 - 0.15, s * tw1 * 0.62, true, 0.0)) { lp.rotation.z = Math.PI / 2; lp.position.set(tailX + 0.06, ty - 0.12, s * tw * 0.66); shell.add(lp); }
    }
    add(new THREE.BoxGeometry(0.03, 0.04, tw * 0.7), tailMat, tailX + 0.03, ty - 0.2, 0); // centre light bar
  }
  // exhaust tips: rolled chrome with a dark throat and a glowing hot ring. The pipe set is a customisation: pair, big-bore pair, quad, single centre pipe, burnt titanium.
  const exMat = spec.exhaust === "titan"
    ? new THREE.MeshStandardMaterial({ color: 0x5b4fa0, roughness: 0.3, metalness: 1, envMap, envMapIntensity: 1.5, emissive: 0x1a0a40, emissiveIntensity: 0.25 })
    : new THREE.MeshStandardMaterial({ color: 0xb8bbc8, roughness: 0.18, metalness: 1, envMap, envMapIntensity: 1.4 });
  const throat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });
  { const w = A.ducktail ? 0.5 : 0.36;
    const ex = { big: { z: [-w, w], k: 1.45 }, quad: { z: [-w - 0.16, -w + 0.08, w - 0.08, w + 0.16], k: 0.88 }, centre: { z: [0], k: 1.7 }, titan: { z: [-w, w], k: 1.15 } }[spec.exhaust] || { z: [-w, w], k: 1 };
    for (const tipZ of ex.z) {
      const tipX = tailX - 0.005, tipY = 0.4, k = ex.k;
      const tipG = new THREE.CylinderGeometry(0.062 * k, 0.072 * k, 0.22, 20, 1, true); tipG.rotateZ(Math.PI / 2);
      const tip = new THREE.Mesh(tipG, exMat); tip.position.set(tipX + 0.03, tipY, tipZ); shell.add(tip); geoms.push(tipG);
      const rimG = new THREE.TorusGeometry(0.066 * k, 0.01 * Math.sqrt(k), 8, 20); rimG.rotateY(Math.PI / 2); const rim = new THREE.Mesh(rimG, exMat); rim.position.set(tipX - 0.08, tipY, tipZ); shell.add(rim); geoms.push(rimG);
      const thG = new THREE.CylinderGeometry(0.056 * k, 0.056 * k, 0.2, 16); thG.rotateZ(Math.PI / 2); const th = new THREE.Mesh(thG, throat); th.position.set(tipX + 0.06, tipY, tipZ); shell.add(th); geoms.push(thG);
    } }

  // mirrors: a sculpted pod on a stalk with a dark glass face
  const mx = A.cab[3][0] - 0.15;
  const [mw, , my] = cabAt(mx);
  if (!A.noMirrors) {
    const podG = new THREE.SphereGeometry(0.075, 18, 12); podG.scale(1.5, 0.82, 0.62); podG.translate(0, 0, 0);
    const faceG = new THREE.CircleGeometry(0.058, 16); faceG.scale(1.2, 0.8, 1); faceG.rotateY(Math.PI / 2 + 0.25);
    const stalkG = new THREE.CylinderGeometry(0.012, 0.016, 0.1, 8); stalkG.rotateX(Math.PI / 2);
    const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.04, metalness: 1, envMap, envMapIntensity: 1.8 });
    const mirrorPaint = spec.mirrors === "black" ? new THREE.MeshPhysicalMaterial({ color: 0x0a0a0e, roughness: 0.25, metalness: 0.5, clearcoat: 1, envMap, envMapIntensity: 1.1 }) : spec.mirrors === "carbon" ? carbonMat() : paint;
    geoms.push(podG, faceG, stalkG);
    for (const s of [-1, 1]) {
      const m = new THREE.Group(); m.position.set(mx, my * 0.82, s * (mw + 0.12)); m.rotation.y = s * 0.12;
      m.add(new THREE.Mesh(podG, mirrorPaint)); const fm = new THREE.Mesh(faceG, mirrorGlass); fm.position.set(-0.09, 0, 0); fm.rotation.y = Math.PI; m.add(fm);
      const st = new THREE.Mesh(stalkG, blackMat); st.position.set(0.0, -0.01, -s * 0.07); m.add(st); shell.add(m);
    }
  }
  // side intakes and hood details
  if (A.scoop) { const x = noseX - 1.45; const [, , ht] = at(x); add(new THREE.BoxGeometry(0.6, 0.1, 0.46), blackMat, x, ht + 0.02, 0); }
  if (kit === "race") for (const s of [-1, 1]) { const x = noseX - 1.0; const [, , ht] = at(x); add(new THREE.BoxGeometry(0.45, 0.04, 0.2), blackMat, x, ht + 0.01, s * 0.38); }
  // bonnet options: carbon skin, louvred vents, ram-air scoop (built as a thin skin over the painted bonnet, sized to match its seam lines)
  if (!open && spec.hood && spec.hood !== "stock" && noseX - A.cab[A.cab.length - 1][0] > 0.95) {
    const hx0 = A.cab[A.cab.length - 1][0] + 0.14, hx1 = noseX - 0.52; const hs = [];
    for (let i = 0; i <= 6; i++) { const x = hx0 + (hx1 - hx0) * (i / 6); const [w, , yt] = at(x); hs.push([x, w * 0.74, yt - 0.028, yt + 0.01]); }
    const hoodGeo = loft([[hx0 - 0.02, hs[0][1] * 0.6, hs[0][2], hs[0][3]], ...hs, [hx1 + 0.02, hs[6][1] * 0.6, hs[6][2], hs[6][3]]], 6, 28, 14); geoms.push(hoodGeo);
    const hoodMat = spec.hood === "scoop" ? paint : carbonMat();
    shell.add(new THREE.Mesh(hoodGeo, hoodMat));
    const slopeAt = (x) => Math.atan2(at(x + 0.15)[2] - at(x - 0.15)[2], 0.3);
    if (spec.hood === "vent") for (const s of [-1, 1]) {
      const x = hx0 + (hx1 - hx0) * 0.62, z = s * at(x)[0] * 0.3; const y = surf(x, z) + 0.012;
      const vb = add(new THREE.BoxGeometry(0.36, 0.014, 0.17), blackMat, x, y, z); vb.rotation.z = slopeAt(x);
      for (let k = -2; k <= 2; k++) { const sl = add(new THREE.BoxGeometry(0.02, 0.022, 0.15), cm, x + k * 0.07, y + 0.01, z); sl.rotation.z = slopeAt(x) - 0.5; }
    }
    if (spec.hood === "scoop") {
      const x = hx0 + (hx1 - hx0) * 0.5, y = at(x)[2] - 0.006;
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, 0.1); sh.lineTo(0.12, 0.028); sh.lineTo(0, 0.0); sh.closePath();
      const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: false }); sg.translate(-0.25, 0, -0.17);
      const sm = add(sg, paint, x, y, 0); sm.rotation.z = slopeAt(x);
      const mouth = add(new THREE.BoxGeometry(0.014, 0.075, 0.27), blackMat, x + 0.245, y + 0.05, 0); mouth.rotation.z = slopeAt(x);
    }
  }
  if (A.fin) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.1, 0); sh.lineTo(0.15, 0.55); sh.lineTo(0, 0.55); sh.closePath();
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); fg.translate(-0.55, 0, -0.025);
    const [, , ft] = at(-1.95);
    add(fg, paint, -1.75, ft - 0.02, 0, 0, Math.PI, 0);
  }

  // wing
  const wingMode = spec.wing;
  if (wingMode === "stock" || A.ducktail && wingMode === "stock") {
    const [, , dy] = at(tailX + 0.45);
    add(new THREE.BoxGeometry(0.5, 0.035, A.halfW * 1.55), paint, tailX + 0.45, dy + 0.035, 0, 0, 0, 0.18);
  } else if (wingMode === "gt" || wingMode === "tall") {
    const tall = wingMode === "tall";
    const wx = tailX + 0.42; const [, , dy] = at(wx);
    const wy = dy + (tall ? 0.52 : 0.36);
    const span = A.halfW * (tall ? 1.85 : 1.7);
    const prof = new THREE.Shape(); const ch = tall ? 0.55 : 0.46;
    prof.moveTo(0, 0); prof.quadraticCurveTo(ch * 0.4, 0.07, ch, 0.012); prof.lineTo(ch, -0.012); prof.quadraticCurveTo(ch * 0.4, -0.015, 0, -0.012); prof.closePath();
    const wg = new THREE.ExtrudeGeometry(prof, { depth: span, bevelEnabled: false }); wg.translate(-ch / 2, 0, -span / 2);
    const wing = add(wg, cm, wx, wy, 0);
    wing.rotation.z = 0.12;
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(ch * 1.05, 0.2, 0.025), paint, wx, wy + 0.05, s * span / 2, 0, 0, 0.12);
      add(new THREE.BoxGeometry(0.06, wy - dy + 0.05, 0.05), cm, wx + 0.02, (wy + dy) / 2, s * A.halfW * 0.38, 0, 0, -0.1);
    }
  } else if (wingMode === "lip") { // a small bootlid lip
    const [, , dy] = at(tailX + 0.34);
    add(new THREE.BoxGeometry(0.2, 0.028, A.halfW * 1.5), paint, tailX + 0.34, dy + 0.018, 0, 0, 0, 0.28);
  } else if (wingMode === "dual" || wingMode === "swan") {
    const wx = tailX + 0.42; const [, , dy] = at(wx); const wy = dy + (wingMode === "swan" ? 0.4 : 0.34); const span = A.halfW * 1.8;
    const plane = (ch, y, x, th = 1) => { const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.quadraticCurveTo(ch * 0.4, 0.07 * th, ch, 0.012); prof.lineTo(ch, -0.012); prof.quadraticCurveTo(ch * 0.4, -0.015, 0, -0.012); prof.closePath(); const wg = new THREE.ExtrudeGeometry(prof, { depth: span, bevelEnabled: false }); wg.translate(-ch / 2, 0, -span / 2); const m = add(wg, cm, x, y, 0); m.rotation.z = 0.12; return m; };
    plane(wingMode === "swan" ? 0.5 : 0.46, wy, wx);
    if (wingMode === "dual") plane(0.34, wy + 0.17, wx - 0.04, 1.2);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.5, wingMode === "dual" ? 0.34 : 0.2, 0.025), paint, wx, wy + (wingMode === "dual" ? 0.1 : 0.05), s * span / 2, 0, 0, 0.12);
      if (wingMode === "swan") { // the mount rises from the deck and curls forward over the top of the wing
        add(new THREE.BoxGeometry(0.035, wy - dy + 0.1, 0.05), cm, wx + 0.12, (wy + dy) / 2 + 0.04, s * A.halfW * 0.4);
        add(new THREE.BoxGeometry(0.2, 0.03, 0.05), cm, wx + 0.03, wy + 0.1, s * A.halfW * 0.4, 0, 0, -0.1);
      } else add(new THREE.BoxGeometry(0.06, wy - dy + 0.05, 0.05), cm, wx + 0.02, (wy + dy) / 2, s * A.halfW * 0.38, 0, 0, -0.1);
    }
  }

  // ---- the newer cars: air snorkel, twin fins, air-box, open cockpits, cycle wings, roll hoops, bare spaceframe, suspension arms ----
  {
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.4, metalness: 0.8 });
    const tubeAB = (ax, ay, az, bx, by, bz, r = 0.014, mat = tubeMat) => {
      const dir = new THREE.Vector3(bx - ax, by - ay, bz - az); const len = dir.length(); if (len < 1e-4) return;
      const geo = new THREE.CylinderGeometry(r, r, len, 8); geoms.push(geo); const m = new THREE.Mesh(geo, mat);
      m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); shell.add(m);
    };
    if (A.snorkel) { const x = -0.12; const ct = cabAt(x)[2]; add(new THREE.BoxGeometry(0.5, 0.17, 0.3), blackMat, x, ct + 0.06, 0); add(new THREE.BoxGeometry(0.08, 0.13, 0.27), paint, x + 0.3, ct - 0.01, 0); }
    if (A.twinFin) for (const sd of [-1, 1]) { const x = tailX + 0.9; const t = at(x)[2]; add(new THREE.BoxGeometry(1.0, 0.5, 0.03), paint, x, t + 0.22, sd * 0.62, 0, 0, 0.06); }
    if (A.airbox) { const x = -0.45; const t = at(x)[2]; add(new THREE.BoxGeometry(0.34, 0.3, 0.3), blackMat, x, t + 0.15, 0); add(new THREE.BoxGeometry(0.06, 0.22, 0.24), cm, x + 0.17, t + 0.14, 0); }
    if (A.swan) for (const sd of [-1, 1]) { const x = tailX + 0.42; const t = at(x)[2]; tubeAB(x, t, sd * 0.3, x - 0.02, t + 0.46, sd * 0.3, 0.02, cm); }
    if (open) {
      const top = (x) => at(x)[2];
      if (A.seat) {
        const sx = -0.2; add(new THREE.BoxGeometry(0.16, 0.34, 0.42), blackMat, sx - 0.2, top(sx) + 0.13, 0, 0, 0, -0.22);
        const hm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.25, metalness: 0.3 })); hm.position.set(sx - 0.02, top(sx) + 0.46, 0); hm.scale.set(1.05, 1, 0.92); geoms.push(hm.geometry); shell.add(hm);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.2), new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.1, metalness: 0.9 })); visor.position.set(sx + 0.14, top(sx) + 0.48, 0); geoms.push(visor.geometry); shell.add(visor);
        const wheelG = new THREE.TorusGeometry(0.12, 0.016, 8, 20); geoms.push(wheelG); const sw = new THREE.Mesh(wheelG, blackMat); sw.position.set(sx + 0.62, top(sx + 0.62) + 0.2, 0); sw.rotation.y = Math.PI / 2; sw.rotation.x = -0.4; shell.add(sw);
      }
      if (A.hoop) { const hx = -0.62; const hg = new THREE.TorusGeometry(0.36, 0.03, 8, 22, Math.PI); geoms.push(hg); const h = new THREE.Mesh(hg, A.bareFrame ? paint : tubeMat); h.rotation.y = Math.PI / 2; h.position.set(hx, top(hx) - 0.02, 0); shell.add(h); tubeAB(hx, top(hx) + 0.34, 0, hx - 0.7, top(hx - 0.7) + 0.05, 0, 0.018, tubeMat); }
      // suspension wishbones from the tub out to every hub
      for (const { wd, z } of wheelSpots) for (const sd of [-1, 1]) {
        const hubZ = sd * (z - wd.w / 2 + 0.02), cz = sd * (A.body ? Math.min(0.3, sampleSt(A.body, wd.x)[0] * 0.6) : 0.25);
        tubeAB(wd.x + 0.22, 0.36, cz, wd.x, wd.r + 0.06, hubZ, 0.013); tubeAB(wd.x - 0.22, 0.36, cz, wd.x, wd.r + 0.06, hubZ, 0.013); tubeAB(wd.x, 0.62, cz, wd.x, wd.r + 0.1, hubZ, 0.011);
      }
      if (A.cycle) for (const { wd, z } of wheelSpots) for (const sd of [-1, 1]) {
        const sh = new THREE.Shape(); const r2 = wd.r * 1.16 + 0.02, r1 = wd.r * 1.16; sh.absarc(0, 0, r2, -0.18 * Math.PI, 1.18 * Math.PI, false); sh.absarc(0, 0, r1, 1.18 * Math.PI, -0.18 * Math.PI, true);
        const fg = new THREE.ExtrudeGeometry(sh, { depth: wd.w + 0.1, bevelEnabled: false, curveSegments: 18 }); fg.translate(0, 0, -(wd.w + 0.1) / 2); geoms.push(fg);
        const fm = new THREE.Mesh(fg, paint); fm.position.set(wd.x, wd.r, sd * z); shell.add(fm);
      }
      if (A.classic) { // long nose cone, stalk-mounted round lamps
        const nc = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), paint); nc.scale.set(1.45, 0.62, 1.0); nc.position.set(noseX - 0.28, 0.46, 0); geoms.push(nc.geometry); shell.add(nc);
        for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), headMat); l.position.set(noseX - 0.5, 0.62, sd * 0.42); geoms.push(l.geometry); shell.add(l); tubeAB(noseX - 0.5, 0.62, sd * 0.42, noseX - 0.62, 0.4, sd * 0.2, 0.012); }
      } else if (!A.bareFrame) { add(new THREE.BoxGeometry(0.34, 0.03, A.wz * 2 + 0.3), cm, noseX - 0.05, 0.3, 0); } // front wing
      if (A.bareFrame) { // tubular spaceframe and the exposed engine
        for (const sd of [-1, 1]) {
          tubeAB(-1.3, 0.34, sd * 0.24, 1.2, 0.34, sd * 0.2, 0.02, paint); tubeAB(-1.2, 0.72, sd * 0.2, 0.2, 0.62, sd * 0.2, 0.017, paint); tubeAB(0.2, 0.62, sd * 0.2, 1.1, 0.4, sd * 0.2, 0.017, paint);
          tubeAB(-1.2, 0.34, sd * 0.24, -1.2, 0.72, sd * 0.2, 0.015, paint); tubeAB(0.2, 0.34, sd * 0.22, 0.2, 0.62, sd * 0.2, 0.015, paint); tubeAB(-1.2, 0.34, sd * 0.24, 0.2, 0.62, sd * 0.2, 0.013, paint); tubeAB(-0.4, 0.34, sd * 0.24, -1.2, 0.72, sd * 0.2, 0.013, paint);
        }
        tubeAB(-1.2, 0.72, 0.2, -1.2, 0.72, -0.2, 0.015, paint); tubeAB(0.2, 0.62, 0.2, 0.2, 0.62, -0.2, 0.015, paint);
        add(new THREE.BoxGeometry(0.46, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.8 }), -0.95, 0.52, 0);
        for (let k = -1; k <= 1; k++) add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xc9702a, roughness: 0.3, metalness: 1 }), -1.38, 0.62, k * 0.07, 0, 0, Math.PI / 2);
      }
      // little LED tail light and exhaust
      add(new THREE.BoxGeometry(0.04, 0.08, 0.16), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), tailX + 0.02, 0.5, 0);
      add(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x9a9ca6, roughness: 0.25, metalness: 1 }), tailX + 0.12, 0.38, 0.22, 0, 0, Math.PI / 2);
    }
  }

  // ---- detail pass: plates, pillars, door cuts, grille, side vents, arch liners, cockpit ----
  const wheelsOut = [];
  if (!open) {
    const plateTex = (txt) => canvasTex(256, 64, (x) => { x.fillStyle = "#f3f1e6"; x.fillRect(0, 0, 256, 64); x.strokeStyle = "#111"; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60); x.fillStyle = "#0b2a8a"; x.fillRect(4, 4, 30, 56); x.fillStyle = "#fff"; x.font = "bold 12px monospace"; x.fillText("IND", 7, 36); x.fillStyle = "#111"; x.font = "bold 40px monospace"; x.fillText(txt, 42, 46); });
    const plateTxt = "MB " + String(spec.number ?? 7).padStart(2, "0") + " 46";
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex(plateTxt), roughness: 0.5, metalness: 0.1 });
    const pr = add(new THREE.BoxGeometry(0.02, 0.13, 0.4), plateMat, tailX + 0.005, 0.5, 0, 0, 0, 0); pr.rotation.y = Math.PI; // faces backwards
    add(new THREE.BoxGeometry(0.02, 0.13, 0.4), plateMat, noseX - 0.01, 0.36, 0, 0, 0, 0);
    const glassEdge = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.4, metalness: 0.6 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.35, metalness: 0.7, envMap, envMapIntensity: 0.8 });
    // greenhouse: painted A / B / C pillars, belt-line trim, roof rails, so the glass reads as windows instead of a bubble
    const strut = (ax, ay, az, bx, by, bz, t, mat) => { const dir = new THREE.Vector3(bx - ax, by - ay, bz - az); const len = dir.length(); const geo = new THREE.BoxGeometry(len, t, t * 0.85); geoms.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize()); shell.add(m); return m; };
    const nC = A.cab.length; const cf = A.cab[nC - 1], cf2 = A.cab[nC - 2], cr = A.cab[0], cr2 = A.cab[1];
    for (const s of [-1, 1]) {
      strut(cf[0], cf[2] + 0.0, s * cf[1] * 0.96, cf2[0], cf2[3] - 0.02, s * cf2[1] * 0.9, 0.055, paint); // A-pillar
      strut(cr[0], cr[2] + 0.0, s * cr[1] * 0.96, cr2[0], cr2[3] - 0.02, s * cr2[1] * 0.9, 0.12, paint);  // C-pillar (wide sail panel)
      const bx = (A.cab[2][0] + A.cab[3][0]) / 2; const [bw, byb, byt] = at(bx); const [cw, , ct] = cabAt(bx);
      strut(bx, byt - 0.01, s * cw * 0.975, bx + 0.02, ct - 0.015, s * cw * 0.93, 0.05, trimM); // B-pillar
      // belt-line chrome-black trim and roof rail along the window edge
      for (let k = 0; k < nC - 1; k++) {
        const [x0, w0, y0, t0] = A.cab[k], [x1, w1, y1, t1] = A.cab[k + 1];
        strut(x0, t0 - 0.015, s * w0 * 0.93, x1, t1 - 0.015, s * w1 * 0.93, 0.03, trimM);
        strut(x0, y0 + 0.01, s * w0 * 0.99, x1, y1 + 0.01, s * w1 * 0.99, 0.022, trimM);
      }
      // door cut lines, handle, side vent
      const dx0 = bx - 0.62, dx1 = bx + 0.55;
      for (const dx of [dx0, dx1]) add(new THREE.BoxGeometry(0.01, (byt - byb) * 0.6, 0.012), glassEdge, dx, (byb + byt) / 2 - 0.02, s * (at(dx)[0] + 0.003));
      add(new THREE.BoxGeometry(0.2, 0.028, 0.02), new THREE.MeshStandardMaterial({ color: 0xc9ccd8, roughness: 0.2, metalness: 1, envMap }), bx + 0.2, byt - 0.14, s * (at(bx + 0.2)[0] + 0.006));
      const vx = A.wf.x - 0.62, [vw, vb, vt] = at(vx);
      add(new THREE.BoxGeometry(0.34, 0.08, 0.02), glassEdge, vx, (vb + vt) / 2 - 0.05, s * (vw + 0.003));
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.28, 0.006, 0.024), trimM, vx, (vb + vt) / 2 - 0.08 + k * 0.02, s * (vw + 0.004));
    }
    // front: grille with a honeycomb of slats, lower intake with splitter lip, fog lamps
    const [gw] = at(noseX - 0.08);
    add(new THREE.BoxGeometry(0.03, 0.1, gw * 1.2), glassEdge, noseX - 0.06, 0.46, 0);
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.036, 0.007, gw * 1.15), new THREE.MeshStandardMaterial({ color: 0x777b88, roughness: 0.3, metalness: 1, envMap }), noseX - 0.055, 0.425 + k * 0.02, 0);
    add(new THREE.BoxGeometry(0.03, 0.075, gw * 1.55), glassEdge, noseX - 0.06, 0.33, 0);
    for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.034, 0.07, 0.006), trimM, noseX - 0.055, 0.33, k * gw * 0.2);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }), noseX - 0.055, 0.34, s * gw * 0.86, 0, 0, Math.PI / 2);
    // rear diffuser fins
    for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.34, 0.1, 0.012), glassEdge, tailX + 0.14, 0.34, k * 0.17);
    // wheel wells: an open dark tunnel behind each arch cut-out, closed at the inside by a disc (cropped at the floor so nothing hangs below the car)
    // every vertex is clamped between the car floor and the body's own upper surface at that spot, so the well follows the fender instead of poking out above it
    const wellMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide });
    for (const { wd, bw } of wheelSpots) for (const s of [-1, 1]) {
      const zIn = bw * 0.44, zOut = bw + 0.03, rr = wd.r * 1.17, floorY = at(wd.x)[1] + 0.01;
      const NA = 56, NZ = 6; const pos = [], idx = [];
      const ptAt = (th, zz) => { const x = wd.x + rr * Math.sin(th); const y0 = wd.r - rr * Math.cos(th); const zc2 = Math.min(Math.abs(zz), bw * 0.97); const top = surf(x, zc2) + bumpH(x, zc2) - 0.035; return [x, clamp(y0, floorY, Math.max(floorY + 0.02, top)), zz]; };
      for (let j = 0; j <= NZ; j++) { const zz = s * (zIn + (zOut - zIn) * (j / NZ)); for (let i = 0; i <= NA; i++) pos.push(...ptAt((i / NA) * Math.PI * 2, zz)); }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NA; i++) { const p0 = j * (NA + 1) + i, p1 = p0 + 1, p2 = p0 + NA + 1, p3 = p2 + 1; idx.push(p0, p2, p1, p1, p2, p3); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals(); geoms.push(tg);
      shell.add(new THREE.Mesh(tg, wellMat));
      // inner wall: a fan around the wheel centre, clamped the same way
      const bp = [], bi = []; const cy = clamp(wd.r, floorY, surf(wd.x, bw * 0.5) - 0.06);
      bp.push(wd.x, cy, s * zIn); for (let i = 0; i <= NA; i++) bp.push(...ptAt((i / NA) * Math.PI * 2, s * zIn));
      for (let i = 0; i < NA; i++) bi.push(0, i + 1, i + 2);
      const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals(); geoms.push(bg);
      shell.add(new THREE.Mesh(bg, glassEdge));
    }
    // cockpit seen through the glass
    const cabx0 = A.cab[0][0] + 0.15, cabx1 = A.cab[nC - 1][0] - 0.05; const belt = A.cab.reduce((a2, c) => a2 + c[2], 0) / nC; const roofY = Math.max(...A.cab.map((c) => c[3]));
    const intr = makeInterior(cabx0, cabx1, belt, roofY, Math.min(...A.cab.slice(1, -1).map((c) => c[1])) * 0.9, { noRear: !!A.fin || !!A.snorkel || A.cab.length < 6, cage: !!A.wide, trim: new THREE.Color(spec.color).getHex() });
    shell.add(intr); intr.traverse((o) => { if (o.geometry) geoms.push(o.geometry); });
  }

  // wheels: modelled tyre + rim + brake disc, with a caliper that follows the steering
  const wheels = [];
  const wheelDefs = [[A.wf, 1], [A.wr, -1]];
  const calCol = spec.caliper && spec.caliper !== "auto" ? spec.caliper : (A.caliper || (spec.rims.color === "#ffb703" ? "#101015" : "#d4202a"));
  const rimK = (RIM_SIZES.find((z) => z.id === (spec.rims.size ?? 1)) || RIM_SIZES[1]).k;
  const camberRad = (CAMBERS.find((c) => c.id === (spec.camber | 0)) || CAMBERS[0]).deg * Math.PI / 180;
  for (const [wd] of wheelDefs) {
    const wz = wheelSpots.find((q) => q.wd === wd).z;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(wd.x, wd.r, s * wz);
      pivot.rotation.x = -s * camberRad; // negative camber: the tops of the wheels lean in
      const spin = makeWheelModel(spec.rims.style, spec.rims.color, wd.r, wd.w, envMap, rimK);
      if (s < 0) spin.rotation.y = Math.PI; // keep the spoked face outward on the left
      pivot.add(spin);
      const cal = makeCaliper(wd.r, wd.w, calCol); cal.position.set(wd.r * 0.36, wd.r * 0.06, s * wd.w * 0.12); pivot.add(cal);
      g.add(pivot);
      spin.traverse((o) => { if (o.geometry) geoms.push(o.geometry); }); geoms.push(cal.geometry);
      wheels.push({ pivot, spin, front: wd === A.wf, r: wd.r, dir: s < 0 ? -1 : 1 });
    }
  }

  // underglow + headlight pool
  let glow = null, pool = null;
  const glowSpec = GLOWS.find((x) => x.id === spec.glow) || GLOWS[0];
  if (opts.glowTex && spec.glow !== "off") {
    const gc = glowSpec.color ?? new THREE.Color(spec.color).getHex();
    glow = new THREE.Mesh(new THREE.PlaneGeometry(A.L * 1.25, A.halfW * 3.2), new THREE.MeshBasicMaterial({
      map: opts.glowTex, color: gc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
  }
  if (opts.poolTex) {
    pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({
      map: opts.poolTex, color: 0xffe9b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(noseX + 7.5, 0.05, 0); g.add(pool);
  }
  { const st = STANCES.find((q) => q.id === spec.stance) || STANCES[0]; shell.position.y = st.dy; }
  g.userData = { stanceDy: (STANCES.find((q) => q.id === spec.stance) || STANCES[0]).dy, wheels, glow, shell, tailMat, pool, paint, noseX, tailX, spec, arch: A, dispose() { geoms.forEach((x) => x.dispose()); } };
  return g;
}

// ---------------------------------------------------------- env + showroom
export function makeEnvMap(renderer, pal) { return makeCityEnv(renderer, pal); }

const SHOW_PAL = { neonA: 0xff2d95, neonB: 0x2de2ff, glass: 0xffd27a };

// A turntable for the garage: renders one car on a lit platform.
export function createShowroom(mount, specIn, opts = {}) {
  const w = mount.clientWidth || 640, h = mount.clientHeight || 360;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = "block";
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07061a);
  scene.fog = new THREE.Fog(0x07061a, 14, 40);
  const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
  const envMap = makeEnvMap(renderer, SHOW_PAL);
  scene.add(new THREE.AmbientLight(0x8890ff, 0.55));
  const key = new THREE.SpotLight(0xffffff, 140, 30, 0.7, 0.6, 1.4); key.position.set(-5, 8, 5); scene.add(key, key.target);
  const rim1 = new THREE.PointLight(0xff2d95, 90, 16, 1.6); rim1.position.set(-5, 1.6, -4); scene.add(rim1);
  const rim2 = new THREE.PointLight(0x2de2ff, 90, 16, 1.6); rim2.position.set(5, 1.6, -3); scene.add(rim2);
  // floor, platform, neon ring
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x0b0b16, roughness: 0.4, metalness: 0.7, envMap, envMapIntensity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x15152a, roughness: 0.3, metalness: 0.8, envMap, envMapIntensity: 0.3 }));
  plat.position.y = -0.06; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: 0x2de2ff }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  // yellow-and-black hazard edge on the turntable, like the Underground garage
  for (let i = 0; i < 36; i++) { const an = (i / 36) * Math.PI * 2; const blk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.34), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x101012 : 0xf2c200, roughness: 0.5, metalness: 0.3 })); blk.position.set(Math.cos(an) * 3.78, -0.04, Math.sin(an) * 3.78); blk.rotation.y = -an; scene.add(blk); }
  // garage backdrop: dark brick wall, roller door with a lit slot, tyre stacks, a staircase, wall lights
  const wallM = new THREE.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.9, metalness: 0.05 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallM); wall.position.set(0, 6, -12); scene.add(wall);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshStandardMaterial({ color: 0x3a1010, roughness: 0.6, metalness: 0.5, emissive: 0x2a0606, emissiveIntensity: 0.8 })); door.position.set(6, 2.6, -11.9); scene.add(door);
  for (let k = 0; k < 9; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x701818 })); sl.position.set(6, 0.5 + k * 0.55, -11.85); scene.add(sl); }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffd6a0 })); strip.position.set(-4, 5.2, -11.8); scene.add(strip);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 4 - k; j++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 20), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8 })); t.position.set(-9.5 + j * 1.1 + k * 0.5, 0.21 + k * 0.42, -10.6); scene.add(t); }
  for (let k = 0; k < 9; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.6 })); st.position.set(-3.5 + k * 0.35, 0.3 + k * 0.38, -10.2); scene.add(st); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xcfcfd8 })); rail.scale.set(1, 1, 1); rail.position.set(-2.2, 2.2, -9.7); rail.rotation.x = 0; scene.add(rail);
  for (const x of [-8, -2, 4, 10]) { const lamp = new THREE.PointLight(0xffd0a0, 60, 14, 1.8); lamp.position.set(x, 4.6, -8); scene.add(lamp); }
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  let car = null, spec = specIn, angle = opts.angle ?? 0.6, auto = opts.auto !== false, raf = 0, dist = 9.2, height = 2.3, audioG = null, cones = [];
  function buildAudio() { // speaker stacks beside the turntable: more, bigger, brighter with each audio layout
    if (audioG) { scene.remove(audioG); audioG.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); audioG = null; } cones = [];
    const lv = spec.audio || 0; if (!lv) return; audioG = new THREE.Group();
    const box = new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.6, metalness: 0.4 }), blue = new THREE.MeshBasicMaterial({ color: 0x2aa8ff });
    for (const sd of [-1, 1]) for (let k = 0; k < lv; k++) {
      const x = sd * (4.9 + k * 0.05), y = 0.45 + k * 0.95, z = -0.4; const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), box); b.position.set(x, y, z); audioG.add(b);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5, metalness: 0.6 })); cone.rotation.z = Math.PI / 2; cone.position.set(x - sd * 0.58, y, z); audioG.add(cone); cones.push(cone);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 28), blue); ring.rotation.y = Math.PI / 2; ring.position.set(x - sd * 0.6, y, z); audioG.add(ring);
    }
    const pl = new THREE.PointLight(0x2aa8ff, 30 + lv * 20, 9, 1.6); pl.position.set(0, 1.6, -0.4); audioG.add(pl); scene.add(audioG);
  }
  function build() {
    if (car) { scene.remove(car); car.userData.dispose?.(); }
    car = createHeroCar(spec, { envMap, glowTex });
    scene.add(car);
    const A = car.userData.arch;
    dist = 8.2 + A.L * 0.28; height = 2.1 + A.L * 0.08; buildAudio();
  }
  function draw() {
    camera.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
    camera.lookAt(0, 0.62, 0);
    renderer.render(scene, camera);
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (auto) angle += 0.006;
    if (cones.length) { const tt = performance.now() * 0.001, beat = Math.pow(Math.max(0, Math.sin(tt * 7.2)), 3); cones.forEach((c) => c.scale.set(1, 1 + beat * 0.55, 1)); }
    draw();
  }
  build(); draw();
  if (opts.loop !== false) raf = requestAnimationFrame(tick);
  return {
    setSpec(s) { spec = s; build(); draw(); },
    setAngle(a) { angle = a; draw(); },
    getAngle() { return angle; },
    setAuto(v) { auto = v; },
    setZoom(d, hgt) { dist = d; if (hgt) height = hgt; draw(); },
    resize() { const ww = mount.clientWidth, hh = mount.clientHeight; if (!ww || !hh) return; renderer.setSize(ww, hh); camera.aspect = ww / hh; camera.updateProjectionMatrix(); draw(); },
    render: draw,
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && m.map !== carbonTex) m.map.dispose(); m.dispose(); }); } });
      envMap.dispose(); glowTex.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };
}
