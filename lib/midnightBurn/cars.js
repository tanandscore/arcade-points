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

// ---------------------------------------------------------------- options
export const FINISHES = [
  { id: "gloss", name: "Gloss", cost: 0 },
  { id: "metallic", name: "Metallic", cost: 250 },
  { id: "pearl", name: "Pearl flip", cost: 600 },
  { id: "matte", name: "Matte", cost: 400 },
  { id: "satin", name: "Satin chrome", cost: 900 },
  { id: "carbon", name: "Carbon weave", cost: 1200 },
];
export const LIVERIES = [
  { id: "none", name: "Clean", cost: 0 },
  { id: "stripes", name: "Twin stripes", cost: 200 },
  { id: "side", name: "Side sweep", cost: 250 },
  { id: "racing", name: "Racing number", cost: 350 },
  { id: "checker", name: "Checker flash", cost: 400 },
  { id: "hex", name: "Hex fade", cost: 500 },
];
export const RIM_STYLES = [
  { id: "fivespoke", name: "Five-spoke", cost: 0 },
  { id: "ten", name: "Ten-spoke", cost: 200 },
  { id: "turbine", name: "Turbine", cost: 350 },
  { id: "mesh", name: "Mesh", cost: 450 },
  { id: "deep", name: "Deep dish", cost: 300 },
];
export const WINGS = [
  { id: "none", name: "No wing", cost: 0 },
  { id: "stock", name: "Duck-tail", cost: 150 },
  { id: "gt", name: "GT wing", cost: 450 },
  { id: "tall", name: "Track wing", cost: 700 },
];
export const KITS = [
  { id: "stock", name: "Stock", cost: 0, note: "" },
  { id: "street", name: "Street kit", cost: 500, note: "+3% grip" },
  { id: "race", name: "Race kit", cost: 1100, note: "+7% grip, -1.5% top speed" },
];
export const TINTS = [
  { id: "smoked", name: "Smoked", cost: 0, color: 0x05080f },
  { id: "clear", name: "Clear", cost: 0, color: 0x1a2740 },
  { id: "blue", name: "Blue", cost: 100, color: 0x0a2a66 },
  { id: "amber", name: "Amber", cost: 100, color: 0x6a3a08 },
];
export const GLOWS = [
  { id: "match", name: "Match paint", cost: 0 },
  { id: "cyan", name: "Cyan", cost: 100, color: 0x2de2ff },
  { id: "pink", name: "Pink", cost: 100, color: 0xff2d95 },
  { id: "green", name: "Green", cost: 100, color: 0x6bff6b },
  { id: "violet", name: "Violet", cost: 100, color: 0xb45cff },
  { id: "off", name: "Off", cost: 0 },
];
export const PAINT_COLORS = ["#2de2ff", "#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#f2f2f2", "#d4202a", "#1b6dff", "#101015"];
export const RIM_COLORS = ["#c9ccd8", "#1a1a20", "#ffb703", "#ff2d95", "#2de2ff", "#d4202a", "#f2f2f2"];
export const LIVERY_COLORS = ["#f2f2f2", "#101015", "#ffb703", "#ff2d95", "#2de2ff", "#d4202a", "#6bff6b"];

export const DEFAULT_SPEC = {
  car: "kestrel", color: "#2de2ff", finish: "gloss",
  livery: { type: "none", color: "#f2f2f2" }, rims: { style: "fivespoke", color: "#c9ccd8" },
  wing: "none", kit: "stock", tint: "smoked", glow: "match", number: 7,
};
export const specOf = (partial) => ({
  ...DEFAULT_SPEC, ...partial,
  livery: { ...DEFAULT_SPEC.livery, ...(partial?.livery || {}) },
  rims: { ...DEFAULT_SPEC.rims, ...(partial?.rims || {}) },
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

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgnpow = (x, p) => (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), p);
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function sampleSt(st, x) {
  let i = 0;
  while (i < st.length - 2 && x > st[i + 1][0]) i++;
  const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)];
  const t = clamp((x - b[0]) / (c[0] - b[0]), 0, 1);
  return [1, 2, 3].map((k) => cr(a[k], b[k], c[k], d[k], t));
}

function loft(st, n, seg = 54, rad = 32, nBot = 7, carves = []) {
  const x0 = st[0][0], x1 = st[st.length - 1][0];
  const pos = [], uv = [], idx = [];
  const p = 2 / n, pb = 2 / nBot;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const x = x0 + (x1 - x0) * t;
    const [w, yb, yt] = sampleSt(st, x);
    const yc = (yb + yt) / 2, hh = Math.max(0.005, (yt - yb) / 2);
    for (let j = 0; j <= rad; j++) {
      const th = -Math.PI / 2 + (j / rad) * Math.PI * 2;
      const sn = Math.sin(th), cs = Math.cos(th);
      const pp = sn >= 0 ? p : pb;
      const py = yc + hh * sgnpow(sn, pp);
      let pz = w * sgnpow(cs, sn >= 0 ? p : pb);
      // wheel arches: dent the flank around each wheel so the tyre sits in a recess
      if (carves.length && Math.abs(pz) > w * 0.45) {
        for (const c of carves) {
          const d = Math.hypot(x - c.x, py - c.y);
          if (d < c.r) {
            const f0 = 1 - d / c.r, f = f0 * f0 * (3 - 2 * f0);
            const az = Math.max(Math.abs(pz) * 0.4, Math.abs(pz) - c.depth * f);
            pz = (pz < 0 ? -1 : 1) * az;
          }
        }
      }
      pos.push(x, py, pz);
      uv.push(t, j / rad);
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
    pos.push(end === 0 ? x0 : x1, (yb + yt) / 2, 0); uv.push(end === 0 ? 0 : 1, 0.5);
    for (let j = 0; j < rad; j++) {
      const a = end * ring + j, b = a + 1;
      if (end === 0) idx.push(base, a, b); else idx.push(base, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
  flakeTex.wrapS = flakeTex.wrapT = THREE.RepeatWrapping; flakeTex.repeat.set(12, 7);
  return flakeTex;
}

function paintMaterial(spec, envMap) {
  const color = new THREE.Color(spec.color);
  const f = spec.finish;
  const base = { color, envMap, envMapIntensity: 1.15 };
  if (f === "matte") return new THREE.MeshStandardMaterial({ ...base, roughness: 0.78, metalness: 0.15, envMapIntensity: 0.5 });
  if (f === "metallic") return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.95, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.2, 0.2) });
  if (f === "pearl") return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700], envMapIntensity: 1.5, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.15, 0.15) });
  if (f === "satin") return new THREE.MeshStandardMaterial({ ...base, roughness: 0.16, metalness: 1, envMapIntensity: 1.8 });
  if (f === "carbon") return new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, map: getCarbonTex(), roughness: 0.4, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03 });
  return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.035, emissive: color, emissiveIntensity: 0.04, normalMap: getFlakeTex(), normalScale: new THREE.Vector2(0.12, 0.12) });
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
  const A = ARCH[spec.car] || ARCH.kestrel;
  const envMap = opts.envMap || null;
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const shell = new THREE.Group(); g.add(shell);
  const paint = paintMaterial(spec, envMap);
  const tint = TINTS.find((t) => t.id === spec.tint) || TINTS[0];
  const glass = new THREE.MeshPhysicalMaterial({ color: tint.color, roughness: 0.04, metalness: 0.9, envMap, envMapIntensity: 1.6, clearcoat: 1 });
  const geoms = [];

  // wheels sit in arches: tyre face flush with the fender, flank dented around it
  const open = !!A.open;
  const wheelSpots = [A.wf, A.wr].map((wd) => {
    const bw = sampleSt(A.body, wd.x)[0];
    return { wd, bw, z: open ? A.wz : bw - wd.w / 2 - 0.015 };
  });
  const carves = open ? [] : wheelSpots.map(({ wd }) => ({ x: wd.x, y: wd.r, r: wd.r * 1.38, depth: wd.w + 0.07 }));
  const bodyGeo = loft(A.body, A.nBody, 84, 52, 7, carves); geoms.push(bodyGeo);
  const body = new THREE.Mesh(bodyGeo, paint); shell.add(body);

  if (spec.livery?.type && spec.livery.type !== "none") {
    const tex = liveryTexture(spec.livery, spec.number);
    const ov = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.35, metalness: 0.3, envMap, envMapIntensity: 0.8,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false,
    }));
    ov.scale.set(1.0015, 1.003, 1.003); shell.add(ov);
  }

  const cabGeo = loft(A.cab, A.nCab, 44, 28); geoms.push(cabGeo);
  shell.add(new THREE.Mesh(cabGeo, glass));
  // painted roof panel
  const roofSt = A.noRoof ? A.cab.slice(1, 2) : A.cab.slice(1, -1).map(([x, w, yb, yt]) => [x, w * 0.9, yt - 0.03, yt + 0.035]);
  const roofGeo = loft([[roofSt[0][0] - 0.1, roofSt[0][1] * 0.6, roofSt[0][2], roofSt[0][3]], ...roofSt, [roofSt[roofSt.length - 1][0] + 0.1, roofSt[roofSt.length - 1][1] * 0.6, roofSt[roofSt.length - 1][2], roofSt[roofSt.length - 1][3]]], A.nCab, 36, 20);
  geoms.push(roofGeo);
  shell.add(new THREE.Mesh(roofGeo, paint));

  const at = (x) => sampleSt(A.body, x); // [w, yb, yt]
  // height of the upper surface of the body at (x, lateral z)
  const surf = (x, z) => { const [w, yb, yt] = at(x); const k = Math.min(0.999, Math.abs(z) / w); const yc = (yb + yt) / 2, hh = (yt - yb) / 2; return yc + hh * Math.pow(Math.max(0, 1 - Math.pow(k, A.nBody)), 1 / A.nBody); };
  const cabAt = (x) => sampleSt(A.cab, x);
  const noseX = A.L / 2, tailX = -A.L / 2;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    geoms.push(geo);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); shell.add(m); return m;
  };

  const kit = spec.kit;
  const kitScale = kit === "race" ? 1.6 : kit === "street" ? 1.15 : 1;
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

  // lamps
  const [hw0] = at(noseX - 0.5);
  for (const s of [-1, 1]) {
    const hz = s * hw0 * 0.7, hx = noseX - 0.55;
    const hy = surf(hx, hz);
    add(new THREE.BoxGeometry(0.34, 0.035, 0.2), headMat, hx, hy + 0.004, hz, 0, s * 0.3, 0);
    add(new THREE.BoxGeometry(0.4, 0.018, 0.05), drlMat, hx - 0.05, hy - 0.01, hz - s * 0.16, 0, s * 0.3, 0);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8c0a0a });
  const [tw, , ty] = at(tailX + 0.12);
  add(new THREE.BoxGeometry(0.04, 0.07, tw * 1.55), tailMat, tailX + 0.03, ty - 0.07, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.12, 0.34), tailMat, tailX + 0.05, ty - 0.1, s * tw * 0.74);
  // exhaust
  const exMat = new THREE.MeshStandardMaterial({ color: 0x9a9ca6, roughness: 0.25, metalness: 1 });
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.065, 0.075, 0.2, 14), exMat, tailX + 0.04, 0.44, s * 0.36, 0, 0, Math.PI / 2);

  // mirrors
  const mx = A.cab[3][0] - 0.15;
  const [mw, , my] = cabAt(mx);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.16, 0.07, 0.1), paint, mx, my * 0.84, s * (mw + 0.1), 0, s * 0.2, 0);
    
  }
  // side intakes and hood details
  if (A.scoop) { const x = noseX - 1.45; const [, , ht] = at(x); add(new THREE.BoxGeometry(0.6, 0.1, 0.46), blackMat, x, ht + 0.02, 0); }
  if (kit === "race") for (const s of [-1, 1]) { const x = noseX - 1.0; const [, , ht] = at(x); add(new THREE.BoxGeometry(0.45, 0.04, 0.2), blackMat, x, ht + 0.01, s * 0.38); }
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

  // ---- detail pass: plates, window frames, door cuts, grille, projector lamps, LED tail bars, arch liners ----
  if (!open) {
    const plateTex = (txt) => { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#f3f1e6"; x.fillRect(0, 0, 256, 64); x.strokeStyle = "#111"; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60); x.fillStyle = "#0b2a8a"; x.fillRect(4, 4, 30, 56); x.fillStyle = "#fff"; x.font = "bold 12px monospace"; x.fillText("IND", 7, 36); x.fillStyle = "#111"; x.font = "bold 40px monospace"; x.fillText(txt, 42, 46); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const plateTxt = "MB " + String(spec.number ?? 7).padStart(2, "0") + " 46";
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex(plateTxt), roughness: 0.5, metalness: 0.1 });
    const pr = add(new THREE.BoxGeometry(0.02, 0.13, 0.4), plateMat, tailX + 0.005, 0.5, 0, 0, 0, 0); pr.rotation.y = 0; pr.geometry.rotateY(0);
    // the plate texture lands on the +x face of the box; the tail faces -x, so flip it to face backwards
    pr.rotation.y = Math.PI;
    const pf = add(new THREE.BoxGeometry(0.02, 0.13, 0.4), plateMat, noseX - 0.01, 0.36, 0, 0, 0, 0);
    const glassEdge = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.4, metalness: 0.6 });
    // window frames: thin dark bars along the roof line and at the pillars
    for (const s of [-1, 1]) {
      for (let k = 0; k < A.cab.length - 1; k++) {
        const [x0, w0, , t0] = A.cab[k], [x1, w1, , t1] = A.cab[k + 1];
        const len = Math.hypot(x1 - x0, t1 - t0);
        add(new THREE.BoxGeometry(len, 0.03, 0.028), glassEdge, (x0 + x1) / 2, (t0 + t1) / 2 - 0.015, s * ((w0 + w1) / 2 * 0.99), 0, 0, Math.atan2(t1 - t0, x1 - x0));
      }
      const bx = (A.cab[2][0] + A.cab[3][0]) / 2; const [bw, byb, byt] = at(bx); const [cw, , ct] = cabAt(bx);
      add(new THREE.BoxGeometry(0.04, ct - byt + 0.04, 0.03), glassEdge, bx, (ct + byt) / 2, s * (cw * 0.985)); // B-pillar
      // door cuts, handle, side vent, mirror stalk
      const dx0 = bx - 0.62, dx1 = bx + 0.55;
      for (const dx of [dx0, dx1]) add(new THREE.BoxGeometry(0.012, (byt - byb) * 0.55, 0.012), glassEdge, dx, (byb + byt) / 2 - 0.02, s * (at(dx)[0] + 0.004));
      add(new THREE.BoxGeometry(0.2, 0.028, 0.02), new THREE.MeshStandardMaterial({ color: 0xc9ccd8, roughness: 0.2, metalness: 1 }), bx + 0.2, byt - 0.14, s * (at(bx + 0.2)[0] + 0.006));
      const vx = A.wf.x - 0.62; add(new THREE.BoxGeometry(0.3, 0.07, 0.02), glassEdge, vx, (at(vx)[1] + at(vx)[2]) / 2 - 0.06, s * (at(vx)[0] + 0.004));
    }
    // front grille: dark slab with slats, plus lower air intake
    const [gw] = at(noseX - 0.08);
    add(new THREE.BoxGeometry(0.03, 0.1, gw * 1.2), glassEdge, noseX - 0.06, 0.46, 0);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.036, 0.008, gw * 1.15), new THREE.MeshStandardMaterial({ color: 0x777b88, roughness: 0.3, metalness: 1 }), noseX - 0.055, 0.425 + k * 0.025, 0);
    add(new THREE.BoxGeometry(0.03, 0.07, gw * 1.5), glassEdge, noseX - 0.06, 0.33, 0);
    // projector lenses inside the headlamps + LED daylight strip
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff });
    for (const s of [-1, 1]) {
      const hz = s * hw0 * 0.7, hx = noseX - 0.5, hy = surf(hx, hz);
      add(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 16), lensMat, hx + 0.03, hy - 0.025, hz + s * 0.05, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), lensMat, hx + 0.03, hy - 0.025, hz - s * 0.06, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(0.02, 0.012, 0.3), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }), hx + 0.045, hy - 0.058, hz, 0, s * 0.3, 0);
    }
    // LED tail bar segments (they brighten with the brake light via tailMat) + a lit light-bar edge
    const tl = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    for (let k = -4; k <= 4; k++) add(new THREE.BoxGeometry(0.025, 0.026, 0.13), tl, tailX + 0.02, ty - 0.115, k * tw * 0.17);
    // arch liners: dark discs behind every wheel so the wheel wells are deep and black
    for (const { wd, z } of wheelSpots) for (const s of [-1, 1]) {
      const liner = new THREE.Mesh(new THREE.CylinderGeometry(wd.r * 1.3, wd.r * 1.3, 0.02, 24), glassEdge);
      liner.rotation.x = Math.PI / 2; liner.position.set(wd.x, wd.r, s * (z - wd.w / 2 - 0.05)); geoms.push(liner.geometry); shell.add(liner);
    }
  }

  // wheels
  const wheels = [];
  const wheelDefs = [[A.wf, 1], [A.wr, -1]];
  for (const [wd, , ] of wheelDefs) {
    const wz = wheelSpots.find((q) => q.wd === wd).z;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(wd.x, wd.r, s * wz);
      const spin = makeWheel(spec.rims.style, spec.rims.color, wd.r, wd.w, envMap);
      if (s < 0) spin.rotation.y = Math.PI; // keep the spoked face outward on the left
      pivot.add(spin);
      const cal = new THREE.Mesh(new THREE.BoxGeometry(wd.r * 0.55, wd.r * 0.45, 0.07), caliperMat);
      cal.position.set(wd.r * 0.35, wd.r * 0.05, s * (wd.w / 2 - 0.13)); pivot.add(cal);
      g.add(pivot);
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
  g.userData = { wheels, glow, shell, tailMat, pool, paint, noseX, tailX, spec, arch: A, dispose() { geoms.forEach((x) => x.dispose()); } };
  return g;
}

// ---------------------------------------------------------- env + showroom
export function makeEnvMap(renderer, pal) {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.background = new THREE.Color(0x05060e);
  const geos = [];
  const bar = (x, y, z, w, h, d, color, k) => {
    const g = new THREE.BoxGeometry(w, h, d); geos.push(g);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
    m.position.set(x, y, z); es.add(m);
  };
  bar(0, 38, 0, 90, 1.5, 6, 0x6f78ff, 1.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bar(Math.cos(a) * 60, 12 + (i % 2) * 8, Math.sin(a) * 60, 3, 22 + (i % 3) * 8, 3, i % 2 ? pal.neonA : pal.neonB, 4);
    bar(Math.cos(a + 0.5) * 70, 40, Math.sin(a + 0.5) * 70, 14, 1, 1, pal.glass, 3);
  }
  bar(0, -2, 0, 200, 0.5, 200, 0x0a0a14, 1);
  const rt = pm.fromScene(es, 0.03);
  pm.dispose();
  geos.forEach((g) => g.dispose());
  return rt.texture;
}

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
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x0b0b16, roughness: 0.35, metalness: 0.7, envMap, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x15152a, roughness: 0.3, metalness: 0.8, envMap, envMapIntensity: 0.8 }));
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
