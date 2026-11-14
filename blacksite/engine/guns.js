// Operation Blacksite — the knife (every firearm is now a real model: see ./gunmodels). It is built from real side-view outlines (receiver, stock, grip, curved magazine, handguard…) pushed out
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

  if (id === "knife") {
    add("metal", prof([[-0.3, 0.004], [-0.272, 0.022], [-0.12, 0.03], [-0.03, 0.026], [-0.03, -0.016], [-0.12, -0.016], [-0.27, -0.004]], 0.0045, 0.001), { color: 0xc6cacf }); // blade
    add("metal", B(0.003, 0.004, 0.17, 0.001), { x: 0, y: 0.028, z: -0.12, color: 0x9a9ea4 }); add("metal", B(0.0055, 0.008, 0.07, 0.001), { y: 0.027, z: -0.06, color: 0x8a8e94 }); // spine + fuller
    add("metal", B(0.05, 0.012, 0.014, 0.002), { y: 0.0, z: -0.022, color: steel }); // guard
    add("rubber", C(0.0145, 0.0125, 0.115, 12), { y: 0.0, z: 0.04, color: 0x141416 }); for (let i = 0; i < 5; i++) add("rubber", C(0.0152, 0.0152, 0.006, 12), { y: 0.0, z: -0.01 + i * 0.02, color: 0x0c0c0d }); add("metal", B(0.03, 0.03, 0.012, 0.004), { y: 0.0, z: 0.1, color: steel });
    r.muzzle = [0, 0, -0.3]; r.r = [0, 0, 0.04]; r.l = [0, -0.25, 0.3]; r.flashSize = 0; return { P, ...r };
  }
  return { P, ...r };
}
