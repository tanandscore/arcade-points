// Operation Blacksite — gun models. Every weapon is built from real side-view outlines (receiver, stock, grip, curved magazine, handguard…) pushed out
// to the weapon's width with a small bevel, plus turned parts (barrels, tubes, scopes) and small details (sights, serrations, rails, trigger).
// Gun space: the barrel points down -Z, up is +Y, the origin sits near the trigger. Used for the soldiers' guns AND the first-person view.
//   gunParts(id, team) -> { P: [[materialKey, geometry, options]], muzzle, r, l, flashSize }   (r / l = where the right / left hand grips)
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
// rounded block
const B = (w, h, d, r = 0.003) => memo(`b${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)));
// turned part along Z: radius at the rear (+Z) end, radius at the front (-Z) end, length
const C = (rRear, rFront, len, seg = 16) => memo(`c${rRear}_${rFront}_${len}_${seg}`, () => { const g = new THREE.CylinderGeometry(rRear, rFront, len, seg); g.rotateX(Math.PI / 2); return g; });
// a side-view outline [[z, y], ...] pushed out to a width. holes: more outlines cut out of it.
function prof(pts, w, bevel = 0.0025, holes = []) {
  if (holes.length && typeof holes[0][0] === "number") holes = [holes]; // a single outline is fine
  const key = "p" + JSON.stringify(pts) + w + bevel + JSON.stringify(holes);
  return memo(key, () => {
    const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(-z, y) : sh.moveTo(-z, y))); sh.closePath();
    for (const h of holes) { const p = new THREE.Path(); h.forEach(([z, y], i) => (i ? p.lineTo(-z, y) : p.moveTo(-z, y))); p.closePath(); sh.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, w - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -(w - bevel * 2) / 2); g.rotateY(Math.PI / 2); return g;
  });
}
// a magazine / curved part: a band of constant thickness along an arc from (z0,y0) to (z1,y1), bulging by `bow`
function band(z0, y0, z1, y1, bow, thick, n = 10) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) { const t = i / n, cz = z0 + (z1 - z0) * t - bow * Math.sin(t * Math.PI), cy = y0 + (y1 - y0) * t; L.push([cz - thick / 2, cy]); R.push([cz + thick / 2, cy]); }
  return L.concat(R.reverse());
}

export function gunParts(id, T) {
  const P = []; const add = (m, geo, o = {}) => P.push([m, geo, o]); const T0 = T === "terrorist";
  const steel = 0x6a6e74, blue = 0x1d1e22, dark = 0x131416, polyc = T0 ? 0x1f2022 : 0x25272b, wood = 0x43301f, oliv = 0x3a4034;
  const r = { muzzle: [0, 0.015, -0.7], r: [0, -0.1, 0.07], l: [0, -0.05, -0.3], flashSize: 0.9 };
  const teeth = (z0, z1, y, w = 0.024, step = 0.026) => { for (let z = z0; z <= z1; z += step) add("metal", B(w, 0.005, 0.009, 0.001), { y, z, color: 0x17181a }); }; // rail slots

  if (id === "pistol") {
    add("metal", prof([[-0.188, 0.04], [-0.182, 0.054], [0.003, 0.054], [0.006, 0.047], [0.006, 0.013], [-0.188, 0.013]], 0.027, 0.003), { color: 0x3a3d42 }); // slide
    add("poly", prof([[-0.14, 0.013], [-0.14, -0.002], [-0.098, -0.009], [0.004, -0.011], [0.024, 0.013]], 0.03, 0.0025), { color: polyc }); // frame + dust cover
    add("poly", prof([[-0.004, 0.013], [0.026, 0.013], [0.056, -0.118], [0.02, -0.128], [0.004, -0.045], [-0.012, -0.014]], 0.031, 0.003), { color: polyc }); // grip
    for (const s of [-1, 1]) add("rubber", B(0.0035, 0.085, 0.03, 0.0015), { x: s * 0.0162, y: -0.062, z: 0.0405, rx: -0.225, color: 0x131315 }); // grip panels
    add("poly", prof([[-0.046, -0.011], [-0.052, -0.034], [-0.02, -0.042], [0.0, -0.014]], 0.012, 0.0015, [[-0.04, -0.016], [-0.044, -0.03], [-0.022, -0.034], [-0.008, -0.016]]), { color: polyc }); // trigger guard
    add("metal", B(0.007, 0.022, 0.006, 0.001), { y: -0.025, z: -0.022, rx: 0.25, color: 0x8a8d92 }); // trigger
    add("metal", C(0.0078, 0.0078, 0.014), { y: 0.034, z: -0.194, color: 0x0b0b0c }); // barrel tip
    add("poly", B(0.034, 0.008, 0.052, 0.002), { y: -0.126, z: 0.038, rx: -0.225, color: 0x101012, mag: 1 }); add("metal", B(0.026, 0.05, 0.04, 0.002), { y: -0.095, z: 0.04, rx: -0.225, color: steel, mag: 1 }); // magazine
    add("metal", B(0.0045, 0.009, 0.007, 0.001), { y: 0.0585, z: -0.178, color: dark }); add("glow", B(0.0022, 0.0022, 0.002, 0.0005), { y: 0.0585, z: -0.1815, color: 0xe8e8e0 });
    for (const s of [-1, 1]) { add("metal", B(0.007, 0.009, 0.01, 0.001), { x: s * 0.0072, y: 0.0585, z: 0.0, color: dark }); add("glow", B(0.0022, 0.0022, 0.002, 0.0005), { x: s * 0.0072, y: 0.0585, z: 0.0055, color: 0xe8e8e0 }); }
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add("metal", B(0.003, 0.034, 0.0022, 0.0006), { x: s * 0.0138, y: 0.034, z: -0.036 + i * 0.0065, color: 0x0e0f10 }); // slide serrations
    add("metal", B(0.003, 0.013, 0.03, 0.001), { x: 0.0138, y: 0.04, z: -0.075, color: 0x08080a }); // ejection port
    add("metal", B(0.003, 0.005, 0.016, 0.001), { x: 0.0165, y: 0.008, z: -0.02, color: steel }); // slide-stop
    r.muzzle = [0, 0.034, -0.2]; r.r = [0, -0.07, 0.034]; r.l = [-0.014, -0.082, 0.04]; r.flashSize = 0.45; return { P, ...r };
  }
  if (id === "knife") {
    add("metal", prof([[-0.3, 0.004], [-0.272, 0.022], [-0.12, 0.03], [-0.03, 0.026], [-0.03, -0.016], [-0.12, -0.016], [-0.27, -0.004]], 0.0045, 0.001), { color: 0xc6cacf }); // blade
    add("metal", B(0.003, 0.004, 0.17, 0.001), { x: 0, y: 0.028, z: -0.12, color: 0x9a9ea4 }); add("metal", B(0.0055, 0.008, 0.07, 0.001), { y: 0.027, z: -0.06, color: 0x8a8e94 }); // spine + fuller
    add("metal", B(0.05, 0.012, 0.014, 0.002), { y: 0.0, z: -0.022, color: steel }); // guard
    add("rubber", C(0.0145, 0.0125, 0.115, 12), { y: 0.0, z: 0.04, color: 0x141416 }); for (let i = 0; i < 5; i++) add("rubber", C(0.0152, 0.0152, 0.006, 12), { y: 0.0, z: -0.01 + i * 0.02, color: 0x0c0c0d }); add("metal", B(0.03, 0.03, 0.012, 0.004), { y: 0.0, z: 0.1, color: steel });
    r.muzzle = [0, 0, -0.3]; r.r = [0, 0, 0.04]; r.l = [0, -0.25, 0.3]; r.flashSize = 0; return { P, ...r };
  }
  const kind = id === "sniper" ? "sniper" : id.startsWith("smg") ? "smg" : "rifle";
  if (kind === "rifle" && T0) { // ---- AK-pattern rifle: stamped receiver, wooden furniture, banana magazine
    add("metal", prof([[-0.2, 0.05], [0.145, 0.05], [0.145, -0.046], [-0.2, -0.046]], 0.044, 0.004), { color: 0x1f2024 }); // receiver
    add("metal", prof([[-0.18, 0.048], [-0.12, 0.066], [0.09, 0.07], [0.142, 0.05]], 0.04, 0.003), { color: 0x292a2e }); // dust cover
    add("wood", prof([[-0.5, 0.03], [-0.2, 0.036], [-0.2, -0.04], [-0.5, -0.03]], 0.054, 0.006), { color: wood }); // handguard
    add("wood", prof([[-0.5, 0.032], [-0.5, 0.05], [-0.28, 0.072], [-0.19, 0.072], [-0.19, 0.034]], 0.04, 0.004), { color: wood }); // upper heat-shield
    add("metal", C(0.0105, 0.0105, 0.44), { y: 0.016, z: -0.69, color: blue }); // barrel
    add("metal", B(0.024, 0.034, 0.034, 0.003), { y: 0.034, z: -0.625, color: 0x15161a }); add("metal", C(0.009, 0.009, 0.3), { y: 0.052, z: -0.47, color: 0x1a1b1e }); // gas block, gas tube
    add("metal", B(0.006, 0.04, 0.008, 0.001), { y: 0.05, z: -0.805, color: dark }); add("metal", B(0.03, 0.018, 0.012, 0.002), { y: 0.032, z: -0.8, color: 0x15161a }); // front sight
    add("metal", C(0.0142, 0.0125, 0.075), { y: 0.016, z: -0.86, color: 0x17181b }); for (let i = 0; i < 3; i++) add("metal", C(0.0152, 0.0152, 0.004), { y: 0.016, z: -0.835 - i * 0.017, color: 0x0c0c0e }); // muzzle brake
    add("metal", B(0.018, 0.008, 0.045, 0.002), { y: 0.075, z: -0.185, rx: 0.12, color: 0x15161a }); // rear sight
    add("wood", prof([[0.145, 0.044], [0.43, 0.014], [0.43, -0.1], [0.34, -0.1], [0.255, -0.058], [0.145, -0.04]], 0.04, 0.005), { color: wood, st: 1 }); add("rubber", B(0.043, 0.122, 0.012, 0.003), { y: -0.044, z: 0.43, color: 0x111113, st: 1 }); // stock + butt-plate
    add("wood", prof([[-0.004, -0.04], [0.046, -0.04], [0.082, -0.152], [0.042, -0.158], [0.0, -0.07]], 0.034, 0.004), { color: 0x2a2220 }); // pistol grip
    add("metal", prof(band(-0.075, -0.044, -0.2, -0.2, 0.0, 0.074), 0.038, 0.003), { color: 0x4d5054, mag: 1 }); add("metal", B(0.04, 0.01, 0.082, 0.002), { y: -0.205, z: -0.2, rx: 0.5, color: 0x3a3c40, mag: 1 }); // banana mag
    for (let i = 0; i < 4; i++) add("metal", B(0.04, 0.004, 0.07, 0.001), { y: -0.07 - i * 0.032, z: -0.098 - i * 0.026, rx: 0.4, color: 0x2e3034, mag: 1 }); // mag ribs
    add("metal", prof([[-0.07, -0.046], [-0.074, -0.078], [-0.018, -0.084], [0.002, -0.048]], 0.012, 0.0015, [[-0.064, -0.05], [-0.067, -0.072], [-0.024, -0.076], [-0.008, -0.05]]), { color: 0x191a1d }); add("metal", B(0.007, 0.022, 0.006, 0.001), { y: -0.058, z: -0.03, color: 0x8a8d92 });
    add("metal", B(0.01, 0.012, 0.036, 0.002), { x: 0.027, y: 0.03, z: -0.02, color: steel }); add("metal", B(0.008, 0.06, 0.012, 0.002), { x: 0.026, y: 0.0, z: 0.0, color: 0x1a1b1e }); // charging handle, selector
    for (const s of [-1, 1]) { // stamped-steel details: ribs along the receiver, rivets, trunnion slot, dust-cover hinge
      add("metal", B(0.003, 0.006, 0.3, 0.001), { x: s * 0.0225, y: 0.016, z: -0.02, color: 0x131417 }); add("metal", B(0.003, 0.006, 0.3, 0.001), { x: s * 0.0225, y: -0.022, z: -0.02, color: 0x131417 });
      for (let i = 0; i < 5; i++) add("metal", new THREE.SphereGeometry(0.0034, 6, 5), { x: s * 0.0228, y: -0.002, z: -0.17 + i * 0.062, color: 0x3a3c40 });
      add("metal", B(0.003, 0.012, 0.05, 0.001), { x: s * 0.0225, y: 0.034, z: -0.15, color: 0x0b0b0d }); add("metal", B(0.0035, 0.012, 0.026, 0.001), { x: s * 0.0235, y: 0.06, z: 0.12, color: 0x2e3034 });
    }
    r.muzzle = [0, 0.016, -0.9]; r.r = [0, -0.1, 0.04]; r.l = [0, -0.02, -0.34]; r.flashSize = 1.0;
  } else if (kind === "rifle") { // ---- M4-pattern carbine: flat-top, rail, red-dot, collapsible stock, straight magazine
    add("metal", prof([[-0.3, 0.056], [0.125, 0.056], [0.125, -0.012], [-0.3, -0.012]], 0.042, 0.004), { color: 0x25272b }); // upper receiver
    add("metal", prof([[-0.1, -0.012], [0.12, -0.012], [0.12, -0.064], [-0.1, -0.064]], 0.036, 0.004), { color: 0x1c1d20 }); add("metal", B(0.04, 0.062, 0.1, 0.004), { y: -0.04, z: -0.075, color: 0x1c1d20 }); // lower + magwell
    add("metal", B(0.022, 0.009, 0.42, 0.001), { y: 0.0625, z: -0.09, color: 0x1a1b1d }); teeth(-0.29, 0.1, 0.067);
    add("poly", C(0.034, 0.034, 0.31, 18), { y: 0.012, z: -0.455, color: 0x232427 }); for (const [x, y] of [[0, 0.046], [0, -0.022], [0.034, 0.012], [-0.034, 0.012]]) add("metal", B(0.011, 0.007, 0.3, 0.001), { x, y, z: -0.455, color: 0x15161a }); // handguard + rails
    add("metal", C(0.0085, 0.0085, 0.2), { y: 0.012, z: -0.72, color: blue }); add("metal", C(0.0128, 0.0118, 0.065), { y: 0.012, z: -0.83, color: 0x15161a }); // barrel + flash hider
    add("metal", B(0.016, 0.052, 0.02, 0.002), { y: 0.05, z: -0.63, color: 0x15161a }); add("metal", B(0.004, 0.026, 0.004, 0.001), { y: 0.092, z: -0.632, color: dark }); // gas block + front sight post
    add("metal", C(0.023, 0.023, 0.09, 18), { y: 0.097, z: -0.02, color: 0x17181b }); add("glass", C(0.0205, 0.0205, 0.004, 18), { y: 0.097, z: -0.067, color: 0xffffff }); add("metal", B(0.03, 0.026, 0.06, 0.003), { y: 0.076, z: -0.02, color: 0x17181b }); add("glow", B(0.003, 0.003, 0.002, 0.0005), { y: 0.097, z: -0.0668, color: 0xff3a2a }); // optic
    add("metal", C(0.017, 0.017, 0.2, 14), { y: 0.032, z: 0.225, color: 0x1c1d20, st: 1 }); // buffer tube
    add("poly", prof([[0.125, 0.04], [0.37, 0.034], [0.37, -0.09], [0.3, -0.1], [0.125, -0.046]], 0.04, 0.005), { color: 0x1d1e21, st: 1 }); add("rubber", B(0.041, 0.13, 0.012, 0.004), { y: -0.03, z: 0.37, color: 0x0f0f11, st: 1 });
    add("poly", prof([[-0.004, -0.06], [0.044, -0.06], [0.078, -0.168], [0.04, -0.174], [0.0, -0.085]], 0.034, 0.004), { color: 0x1c1d20 }); // pistol grip
    add("poly", prof(band(-0.07, -0.062, -0.08, -0.215, 0.012, 0.074), 0.03, 0.003), { color: T0 ? steel : 0x2a2c30, mag: 1 }); add("metal", B(0.032, 0.008, 0.08, 0.002), { y: -0.22, z: -0.08, color: 0x15161a, mag: 1 });
    add("metal", prof([[-0.075, -0.064], [-0.08, -0.092], [-0.022, -0.1], [0.0, -0.066]], 0.011, 0.0015, [[-0.069, -0.068], [-0.073, -0.087], [-0.028, -0.093], [-0.008, -0.068]]), { color: 0x16171a }); add("metal", B(0.007, 0.022, 0.006, 0.001), { y: -0.07, z: -0.034, color: 0x8a8d92 });
    add("metal", B(0.034, 0.012, 0.04, 0.003), { y: 0.052, z: 0.12, color: 0x1a1b1d }); add("metal", B(0.014, 0.01, 0.03, 0.002), { x: 0.025, y: 0.03, z: 0.05, color: steel }); add("metal", B(0.016, 0.012, 0.014, 0.002), { x: 0.024, y: 0.02, z: -0.02, color: steel }); // charging handle, forward assist
    for (const s of [-1, 1]) { // receiver details: pins, takedown pivot, selector, mag-release, ejection-port cover
      for (const z of [-0.1, 0.02]) add("metal", C(0.0052, 0.0052, 0.004, 10), { x: s * 0.021, y: -0.006, z, ry: Math.PI / 2, color: 0x3a3c40 });
      add("metal", B(0.003, 0.012, 0.05, 0.001), { x: s * 0.0215, y: 0.03, z: -0.07, color: 0x151618 }); add("metal", B(0.004, 0.02, 0.012, 0.001), { x: s * 0.0195, y: -0.04, z: 0.08, color: 0x2a2c30 });
    }
    add("metal", B(0.011, 0.012, 0.014, 0.002), { x: -0.0215, y: -0.036, z: -0.123, color: 0x303236 }); add("metal", C(0.006, 0.006, 0.01, 10), { x: -0.0225, y: -0.02, z: 0.066, ry: Math.PI / 2, color: 0x2a2c30 });
    r.muzzle = [0, 0.012, -0.865]; r.r = [0, -0.11, 0.06]; r.l = [0, -0.012, -0.4]; r.flashSize = 1.0;
  } else if (kind === "smg") { // ---- compact SMG: tubular receiver, suppressor, folding stock, long curved magazine
    add("metal", prof([[-0.17, 0.042], [0.125, 0.042], [0.125, -0.036], [-0.17, -0.036]], 0.042, 0.004), { color: 0x1d1e21 });
    add("poly", prof([[-0.3, 0.03], [-0.17, 0.034], [-0.17, -0.034], [-0.3, -0.036]], 0.054, 0.006), { color: polyc }); // handguard
    add("metal", C(0.0115, 0.0115, 0.16), { y: 0.012, z: -0.38, color: blue }); add("metal", C(0.0205, 0.0205, 0.21, 16), { y: 0.012, z: -0.52, color: 0x17181b }); for (let i = 0; i < 4; i++) add("metal", C(0.0212, 0.0212, 0.006), { y: 0.012, z: -0.45 - i * 0.044, color: 0x0e0f11 });
    add("poly", prof([[0.125, 0.026], [0.31, 0.01], [0.31, -0.07], [0.125, -0.04]], 0.026, 0.004), { color: polyc, st: 1 }); add("rubber", B(0.028, 0.08, 0.012, 0.003), { y: -0.03, z: 0.312, color: 0x101012, st: 1 }); // stock
    add("poly", prof([[-0.006, -0.036], [0.04, -0.036], [0.066, -0.14], [0.03, -0.146], [0.0, -0.07]], 0.032, 0.004), { color: polyc }); // grip
    add("metal", prof(band(-0.05, -0.036, -0.032, -0.22, 0.04, 0.05), 0.034, 0.003), { color: 0x45484c, mag: 1 }); add("poly", B(0.036, 0.008, 0.056, 0.002), { y: -0.224, z: -0.026, color: 0x15161a, mag: 1 });
    add("metal", prof([[-0.062, -0.037], [-0.066, -0.066], [-0.014, -0.072], [0.002, -0.04]], 0.01, 0.0015, [[-0.057, -0.041], [-0.06, -0.06], [-0.019, -0.065], [-0.006, -0.041]]), { color: 0x16171a }); add("metal", B(0.007, 0.02, 0.006, 0.001), { y: -0.05, z: -0.028, color: 0x8a8d92 });
    add("metal", B(0.036, 0.034, 0.075, 0.004), { y: 0.074, z: -0.06, color: 0x101114 }); add("glass", B(0.026, 0.024, 0.003, 0.001), { y: 0.076, z: -0.0985, color: 0xffffff }); add("glow", B(0.004, 0.004, 0.002, 0.0005), { y: 0.076, z: -0.0988, color: T0 ? 0xff3a2a : 0x2a9aff }); // reflex sight
    add("metal", B(0.008, 0.012, 0.03, 0.002), { x: 0.026, y: 0.03, z: -0.07, color: steel });
    for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) add("metal", B(0.003, 0.05, 0.004, 0.001), { x: s * 0.0225, y: 0.0, z: -0.12 + i * 0.012, color: 0x101113 }); add("metal", new THREE.SphereGeometry(0.0035, 6, 5), { x: s * 0.023, y: 0.025, z: 0.05, color: 0x3a3c40 }); add("poly", B(0.003, 0.012, 0.06, 0.001), { x: s * 0.0275, y: -0.01, z: -0.235, color: 0x0e0f10 }); }
    r.muzzle = [0, 0.012, -0.63]; r.r = [0, -0.085, 0.04]; r.l = [0, -0.03, -0.24]; r.flashSize = 0.8;
  } else { // ---- bolt-action sniper rifle: polymer stock, heavy barrel with brake, big scope, bipod
    add("poly", prof([[-0.54, 0.0], [-0.5, 0.022], [-0.1, 0.034], [0.2, 0.034], [0.22, 0.044], [0.47, 0.03], [0.47, -0.125], [0.36, -0.13], [0.26, -0.075], [0.14, -0.07], [0.06, -0.12], [0.0, -0.13], [-0.06, -0.06], [-0.2, -0.045], [-0.54, -0.03]], 0.05, 0.006, [[0.22, 0.005], [0.38, -0.02], [0.38, -0.085], [0.28, -0.065], [0.2, -0.015]]), { color: oliv }); // thumbhole stock
    add("rubber", B(0.052, 0.13, 0.016, 0.004), { y: -0.05, z: 0.47, color: 0x101112 });
    add("metal", prof([[-0.22, 0.054], [0.12, 0.054], [0.12, -0.022], [-0.22, -0.022]], 0.04, 0.004), { color: 0x23262a }); // receiver
    add("metal", C(0.0148, 0.0108, 0.56), { y: 0.03, z: -0.76, color: 0x2c3036 }); add("metal", C(0.02, 0.0195, 0.075), { y: 0.03, z: -1.05, color: 0x16171a }); for (let i = 0; i < 3; i++) add("metal", B(0.044, 0.006, 0.012, 0.001), { y: 0.03, z: -1.03 - i * 0.02, color: 0x0b0b0c }); // barrel + muzzle brake
    add("metal", C(0.0058, 0.0058, 0.075), { x: 0.042, y: 0.045, z: 0.03, ry: Math.PI / 2, color: steel }); add("metal", new THREE.SphereGeometry(0.0125, 10, 8), { x: 0.086, y: 0.045, z: 0.03, color: 0x1c1d20 }); // bolt handle (set below by rz)
    add("metal", C(0.0172, 0.0172, 0.34, 18), { y: 0.108, z: -0.04, color: 0x141517 }); add("metal", C(0.0245, 0.0172, 0.09, 18), { y: 0.108, z: -0.255, color: 0x141517 }); add("metal", C(0.021, 0.0172, 0.07, 18), { y: 0.108, z: 0.15, color: 0x141517 });
    add("glass", C(0.0225, 0.0225, 0.004, 18), { y: 0.108, z: -0.302, color: 0xffffff }); add("glass", C(0.0185, 0.0185, 0.004, 18), { y: 0.108, z: 0.186, color: 0xffffff });
    add("metal", C(0.011, 0.011, 0.034, 12), { y: 0.136, z: -0.06, rx: Math.PI / 2, color: 0x1c1d20 }); add("metal", C(0.011, 0.011, 0.034, 12), { x: 0.032, y: 0.108, z: -0.04, ry: Math.PI / 2, color: 0x1c1d20 }); // turrets
    for (const z of [-0.14, 0.06]) add("metal", B(0.03, 0.036, 0.03, 0.003), { y: 0.08, z, color: 0x17181b });
    add("metal", B(0.04, 0.07, 0.1, 0.004), { y: -0.058, z: -0.06, color: 0x17181b, mag: 1 });
    add("metal", prof([[-0.075, -0.024], [-0.082, -0.05], [-0.014, -0.058], [0.006, -0.028]], 0.011, 0.0015, [[-0.068, -0.028], [-0.073, -0.044], [-0.02, -0.05], [-0.002, -0.03]]), { color: 0x16171a });
    for (const s of [-1, 1]) { add("metal", B(0.003, 0.014, 0.12, 0.001), { x: s * 0.0205, y: 0.03, z: -0.06, color: 0x111214 }); add("metal", new THREE.SphereGeometry(0.0036, 6, 5), { x: s * 0.0215, y: 0.0, z: -0.17, color: 0x3a3c40 }); add("metal", new THREE.SphereGeometry(0.0036, 6, 5), { x: s * 0.0215, y: 0.0, z: 0.07, color: 0x3a3c40 }); add("poly", B(0.003, 0.05, 0.12, 0.001), { x: s * 0.0255, y: -0.03, z: 0.34, rx: 0.12, color: 0x2a3024 }); }
    r.muzzle = [0, 0.03, -1.09]; r.r = [0, -0.08, 0.1]; r.l = [0, -0.035, -0.42]; r.flashSize = 1.2;
  }
  return { P, ...r };
}
