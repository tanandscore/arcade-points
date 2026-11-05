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
import { makeCityEnv } from "./carParts";
import { createGlbCar } from "./carsGlb";

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
  { id: "oem", name: "Original", cost: 0 },
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
  livery: { type: "none", color: "#f2f2f2" }, rims: { style: "oem", color: "#c9ccd8", size: 1 },
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


// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
// ---------------------------------------------------------------- the car
// Every car is a real 3D model now (engine/carsGlb.js loads and customises it). This keeps the old entry point so the whole game, the garage and the rivals keep working.
const GLB_HELPERS = { paintMaterial, liveryTexture, carbonMat, STANCES, GLOWS, LIGHTS, TINTS, CAMBERS, RIM_SIZES };
export function createHeroCar(specIn, opts = {}) { return createGlbCar(specOf(specIn), opts, GLB_HELPERS); }


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
