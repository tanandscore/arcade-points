// Midnight Burn — the 3D world. Plain three.js, no React: the React
// component owns the game loop and just hands this module the latest
// car states each frame.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { sampleTrack, worldPose, makeRng } from "./physics.js";
import { createHeroCar } from "./cars.js";
import { makeAsphalt, makeBlobShadow, makeConeFade, makeGradePass, makeBeamMaterial } from "./fx.js";

const TRAFFIC_COLORS = [0x8a8f9c, 0x2b3a67, 0x6b2b2b, 0x3f5a46, 0x9a8a5a, 0x55485f];
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function makeRoadTexture(wet) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#1b1b26"; g.fillRect(0, 0, w, h);
    const rng = makeRng(5);
    for (let i = 0; i < 2600; i++) {
      const v = 18 + Math.floor(rng() * 26);
      g.fillStyle = `rgba(${v},${v},${v + 8},0.55)`;
      g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
    }
    // patched asphalt and puddle sheen
    for (let i = 0; i < (wet ? 16 : 9); i++) {
      const cx = rng() * w, cy = rng() * h;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, wet ? 44 : 60);
      gr.addColorStop(0, wet ? "rgba(140,150,200,0.20)" : "rgba(120,130,170,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    // faint tyre-wear lanes
    g.fillStyle = "rgba(8,8,12,0.22)";
    for (const f of [0.3, 0.38, 0.62, 0.7]) g.fillRect(w * f - 5, 0, 10, h);
    g.fillStyle = "#e9e9f2";
    g.fillRect(w * 0.02, 0, 5, h); g.fillRect(w * 0.98 - 5, 0, 5, h);
    for (const f of [0.25, 0.75]) g.fillRect(w * f - 2.5, 0, 5, h * 0.45);
    g.fillStyle = "#ffcf3a";
    g.fillRect(w * 0.5 - 7, 0, 4, h); g.fillRect(w * 0.5 + 3, 0, 4, h);
  });
}

function makeWindowTexture(tint, rows) {
  return canvasTexture(256, 512, (g, w, h) => {
    const rng = makeRng(Math.floor(tint * 1000) + rows);
    // concrete / glass curtain wall base with soft vertical streaking
    g.fillStyle = "#0a0b13"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rng() * w, ww = 2 + rng() * 10;
      g.fillStyle = `rgba(${30 + rng() * 25},${34 + rng() * 25},${48 + rng() * 30},0.22)`; g.fillRect(x, 0, ww, h);
    }
    const cw = 24, ch = 28;
    for (let y = 8; y < h - 10; y += ch) {
      const floorMood = rng(); // some floors are fully lit offices, some dark
      for (let x = 6; x < w - 10; x += cw) {
        const ww = cw - 7, hh = ch - 10;
        // frame
        g.fillStyle = "#04040a"; g.fillRect(x - 1, y - 1, ww + 2, hh + 2);
        const r = rng();
        const lit = floorMood > 0.82 ? r < 0.9 : r < 0.5;
        if (lit) {
          const kind = rng();
          const gr = g.createLinearGradient(x, y, x, y + hh);
          if (kind < 0.62) { gr.addColorStop(0, `rgb(255,${205 + Math.floor(rng() * 40)},${130 + Math.floor(rng() * 50)})`); gr.addColorStop(1, `rgb(${200 + Math.floor(rng() * 40)},${120 + Math.floor(rng() * 40)},60)`); }
          else if (kind < 0.96) { gr.addColorStop(0, `rgb(${200 + Math.floor(rng() * 40)},${225 + Math.floor(rng() * 25)},255)`); gr.addColorStop(1, `rgb(130,${170 + Math.floor(rng() * 40)},${215 + Math.floor(rng() * 30)})`); }
          else { gr.addColorStop(0, "rgb(255,150,200)"); gr.addColorStop(1, "rgb(170,90,200)"); }
          g.fillStyle = gr; g.fillRect(x, y, ww, hh);
          // blinds / furniture silhouette
          if (rng() < 0.5) { g.fillStyle = "rgba(0,0,0,0.38)"; g.fillRect(x, y, ww, hh * (0.15 + rng() * 0.45)); }
          if (rng() < 0.3) { g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(x + ww * rng() * 0.5, y + hh * 0.5, ww * 0.35, hh * 0.5); }
        } else {
          // dark glass catching a faint sky sheen
          const gr = g.createLinearGradient(x, y, x + ww, y + hh);
          gr.addColorStop(0, "rgb(24,30,52)"); gr.addColorStop(0.5, "rgb(12,14,26)"); gr.addColorStop(1, "rgb(20,26,44)");
          g.fillStyle = gr; g.fillRect(x, y, ww, hh);
          g.fillStyle = "rgba(130,150,220,0.10)"; g.fillRect(x, y, ww, 2);
        }
        // mullion
        g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x + ww / 2 - 0.5, y, 1, hh);
      }
      // floor slab
      g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, y + ch - 5, w, 3);
      // occasional rooftop-style AC unit on a ledge
      if (rng() < 0.08) { g.fillStyle = "#1c1d28"; g.fillRect(rng() * (w - 30), y + ch - 12, 22, 8); }
    }
  }, [1.0, rows * 0.2]);
}

function makeBillboardTexture(text, a, b) {
  return canvasTexture(512, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, hex(a)); gr.addColorStop(1, hex(b));
    g.fillStyle = "#07070d"; g.fillRect(0, 0, w, h);
    g.strokeStyle = gr; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = gr; g.font = "bold 84px Arial Black, Impact, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function labelTexture(text, color) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "rgba(5,5,12,0.72)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = color; g.font = "bold 54px Arial Black, Impact, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

// A dark reflective "neon city" environment so paint and wet asphalt have
// something realistic to reflect (lamps, pink and cyan signs).
function makeEnvMap(renderer, pal) {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.background = new THREE.Color(0x05060e);
  const geos = [];
  const bar = (x, y, z, w, h, d, color, k) => {
    const g = new THREE.BoxGeometry(w, h, d); geos.push(g);
    const c = new THREE.Color(color).multiplyScalar(k);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c }));
    m.position.set(x, y, z); es.add(m);
  };
  bar(0, 38, 0, 90, 1.5, 6, 0x6f78ff, 1.4); // cool sky glow overhead
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

// ---- cars (face +X, ~4.4 long) -----------------------------------------
// Each body is a side-profile polygon extruded across the width, so the
// silhouettes are properly sloped instead of stacked boxes.
const PROFILES = {
  kestrel: {
    lower: [[-2.15, 0.32], [-2.18, 0.62], [-2.0, 0.9], [-1.3, 0.98], [0.55, 0.98], [1.25, 0.86], [2.0, 0.7], [2.2, 0.52], [2.2, 0.32]],
    cabin: [[-1.35, 0.97], [-0.75, 1.38], [0.2, 1.4], [0.9, 0.97]], wing: 1, width: 1.74,
  },
  brute: {
    lower: [[-2.2, 0.34], [-2.22, 0.7], [-2.0, 1.0], [-1.0, 1.04], [0.9, 1.04], [1.6, 0.94], [2.15, 0.82], [2.22, 0.55], [2.22, 0.34]],
    cabin: [[-1.2, 1.03], [-0.9, 1.48], [0.1, 1.5], [0.7, 1.03]], wing: 0, scoop: 1, width: 1.9,
  },
  gecko: {
    lower: [[-2.0, 0.32], [-2.05, 0.7], [-1.9, 0.95], [0.6, 0.98], [1.2, 0.86], [1.85, 0.7], [2.0, 0.52], [2.0, 0.32]],
    cabin: [[-1.85, 0.95], [-1.5, 1.44], [0.0, 1.48], [0.75, 0.97]], wing: 2, width: 1.7,
  },
  sedan: {
    lower: [[-2.2, 0.34], [-2.22, 0.72], [-1.9, 0.98], [1.0, 1.0], [1.8, 0.85], [2.2, 0.7], [2.2, 0.34]],
    cabin: [[-1.45, 0.98], [-1.0, 1.45], [0.5, 1.47], [1.05, 0.98]], wing: 0, width: 1.8,
  },
  van: {
    lower: [[-2.3, 0.4], [-2.3, 2.05], [0.85, 2.1], [1.45, 1.25], [2.1, 1.0], [2.1, 0.4]],
    cabin: [[0.9, 2.0], [1.5, 1.3], [1.5, 1.45], [1.05, 2.02]], wing: 0, width: 1.84, flatCabin: true,
  },
};
const profileGeo = new Map();
function extrudeProfile(pts, depth, bevel) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function getProfileGeo(kind) {
  if (profileGeo.has(kind)) return profileGeo.get(kind);
  const P = PROFILES[kind];
  const out = {
    lower: extrudeProfile(P.lower, P.width - 0.14, 0.07),
    cabin: extrudeProfile(P.cabin, P.width - 0.34, 0.03),
    roof: null,
  };
  const c = P.cabin;
  if (!P.flatCabin) {
    const top = [[c[1][0] + 0.02, c[1][1] - 0.01], [c[2][0] - 0.02, c[2][1] - 0.01], [c[2][0] - 0.02, c[2][1] + 0.03], [c[1][0] + 0.02, c[1][1] + 0.03]];
    out.roof = extrudeProfile(top, P.width - 0.34, 0.02);
  }
  profileGeo.set(kind, out);
  return out;
}

const carGeo = {
  tire: new THREE.CylinderGeometry(0.37, 0.37, 0.3, 20),
  rim: new THREE.CylinderGeometry(0.25, 0.25, 0.31, 12),
  spoke: new THREE.BoxGeometry(0.46, 0.05, 0.33),
  wingBlade: new THREE.BoxGeometry(0.6, 0.06, 1.7),
  wingLeg: new THREE.BoxGeometry(0.08, 0.34, 0.08),
  lamp: new THREE.BoxGeometry(0.1, 0.13, 0.46),
  tailBar: new THREE.BoxGeometry(0.06, 0.11, 1.4),
  mirror: new THREE.BoxGeometry(0.16, 0.1, 0.2),
  scoop: new THREE.BoxGeometry(0.7, 0.14, 0.5),
  glow: new THREE.PlaneGeometry(5.6, 3.2),
  pool: new THREE.PlaneGeometry(16, 8),
};
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.85 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bccb, roughness: 0.25, metalness: 0.9 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.6, metalness: 0.3 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });

export function createCarMesh(color, kind = "kestrel", glowColor = null, glowTex = null, envMap = null, poolTex = null) {
  if (kind === "sport") kind = "kestrel";
  if (!PROFILES[kind]) kind = "sedan";
  const P = PROFILES[kind];
  const geo = getProfileGeo(kind);
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const shell = new THREE.Group(); g.add(shell);
  const paint = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.34, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08,
    emissive: color, emissiveIntensity: 0.07, envMap, envMapIntensity: 1.1,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x080d18, roughness: 0.08, metalness: 0.95, envMap, envMapIntensity: 1.4 });
  shell.add(Object.assign(new THREE.Mesh(geo.lower, paint)));
  const cab = new THREE.Mesh(geo.cabin, glass); shell.add(cab);
  if (geo.roof) shell.add(new THREE.Mesh(geo.roof, paint));
  // splitter / skirts / diffuser
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, P.width + 0.06), trimMat); skirt.position.set(0, 0.3, 0); shell.add(skirt);
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, P.width + 0.1), trimMat); splitter.position.set(P.lower[P.lower.length - 1][0] - 0.1, 0.3, 0); shell.add(splitter);
  // mirrors
  if (!P.flatCabin) for (const z of [-1, 1]) { const m = new THREE.Mesh(carGeo.mirror, paint); m.position.set(P.cabin[3][0] - 0.35, P.cabin[3][1] + 0.05, z * (P.width / 2 + 0.04)); shell.add(m); }
  if (P.scoop) { const s = new THREE.Mesh(carGeo.scoop, trimMat); s.position.set(1.0, 1.08, 0); shell.add(s); }
  if (P.wing) {
    const rearX = P.lower[1][0] + 0.18, wy = P.wing === 2 ? 1.55 : 1.22;
    const blade = new THREE.Mesh(carGeo.wingBlade, paint); blade.position.set(rearX, wy, 0); blade.scale.z = P.width / 1.74; shell.add(blade);
    for (const z of [-0.6, 0.6]) { const leg = new THREE.Mesh(carGeo.wingLeg, trimMat); leg.position.set(rearX + 0.02, wy - 0.18, z); shell.add(leg); }
  }
  // lamps
  const noseX = P.lower[P.lower.length - 1][0], tailX = P.lower[0][0];
  const noseY = P.lower[P.lower.length - 2][1] - 0.12;
  for (const z of [-0.6, 0.6]) {
    const h = new THREE.Mesh(carGeo.lamp, headMat); h.position.set(noseX + 0.02, noseY, z * (P.width / 1.74)); shell.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xb81616 });
  const tail = new THREE.Mesh(carGeo.tailBar, tailMat); tail.position.set(tailX - 0.02, P.lower[1][1] - 0.08, 0); tail.scale.z = P.width / 1.74; shell.add(tail);

  // wheels
  const wheels = [];
  const wx = kind === "van" ? 1.35 : 1.32;
  for (const [x, z] of [[wx, -1], [wx, 1], [-wx, -1], [-wx, 1]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.37, z * (P.width / 2 - 0.02));
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(carGeo.tire, tireMat); tire.rotation.x = Math.PI / 2; spin.add(tire);
    const rim = new THREE.Mesh(carGeo.rim, rimMat); rim.rotation.x = Math.PI / 2; spin.add(rim);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(carGeo.spoke, trimMat); sp.rotation.z = (k * Math.PI) / 3; spin.add(sp); }
    pivot.add(spin); g.add(pivot); wheels.push({ pivot, spin, front: x > 0 });
  }
  let glow = null;
  if (glowColor !== null && glowTex) {
    glow = new THREE.Mesh(carGeo.glow, new THREE.MeshBasicMaterial({
      map: glowTex, color: glowColor, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
  }
  let pool = null;
  if (poolTex) {
    pool = new THREE.Mesh(carGeo.pool, new THREE.MeshBasicMaterial({
      map: poolTex, color: 0xffe9b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(noseX + 7.5, 0.05, 0); g.add(pool);
  }
  g.userData = { wheels, glow, shell, tailMat, pool, paint, noseX, tailX };
  return g;
}

// ---- world ------------------------------------------------------------
export function createWorld(mount, track, setup) {
  const def = track.def;
  const pal = def.palette;
  const weather = def.weather || "clear";
  const wet = weather === "rain" || weather === "storm" || def.id === "harbor";
  const raining = weather === "rain" || weather === "storm";
  const width = mount.clientWidth || 960;
  const height = mount.clientHeight || 540;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.fog);
  const fogFar = def.fogFar || 430;
  scene.fog = new THREE.Fog(pal.fog, fogFar * 0.12, fogFar);

  const camera = new THREE.PerspectiveCamera(64, width / height, 0.3, 1600);

  const ambient = new THREE.AmbientLight(0x6670a8, weather === "storm" ? 0.65 : 0.9);
  const hemi = new THREE.HemisphereLight(0x5a6aff, 0x1a0a30, 0.55);
  scene.add(ambient, hemi);
  const moon = new THREE.DirectionalLight(0x8fa0ff, weather === "clear" ? 0.55 : 0.3); moon.position.set(-200, 300, 120); scene.add(moon);

  const rng = makeRng(99 + (def.id.length * 17));
  const glowTex = glowTexture();
  let envMap = null;
  try { envMap = makeEnvMap(renderer, pal); } catch { envMap = null; }

  // sky dome: dark overhead, glowing horizon in the fog colour
  {
    const geo = new THREE.SphereGeometry(1400, 24, 14);
    const top = new THREE.Color(pal.sky), hor = new THREE.Color(pal.fog).multiplyScalar(1.7);
    const col = [];
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++) {
      const t = THREE.MathUtils.clamp(posA.getY(i) / 1400, 0, 1);
      const c = hor.clone().lerp(top, Math.pow(t, 0.55));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10; scene.add(dome);
  }
  // stars and a moon on clear nights
  if (weather === "clear" || weather === "fog") {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rng() * Math.PI * 2, ph = rng() * 0.9 + 0.12, r = 1300;
      pos[i * 3] = Math.cos(th) * Math.cos(ph) * r; pos[i * 3 + 1] = Math.sin(ph) * r * 0.9; pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: weather === "fog" ? 0.35 : 0.9 })));
    if (weather === "clear") {
      const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(46, 28), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
      moonMesh.position.set(-700, 520, -900); moonMesh.lookAt(0, 0, 0); scene.add(moonMesh);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x8fa0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      halo.position.copy(moonMesh.position).multiplyScalar(0.99); halo.lookAt(0, 0, 0); scene.add(halo);
    }
  }

  // ground (dark, slightly reflective when wet)
  {
    const harborWater = def.id === "harbor";
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      harborWater
        ? new THREE.MeshStandardMaterial({ color: 0x050c1c, roughness: 0.1, metalness: 0.9, envMap, envMapIntensity: 1.1 })
        : new THREE.MeshStandardMaterial({ color: 0x07070d, roughness: wet ? 0.55 : 1 }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = harborWater ? -0.9 : -0.08; scene.add(ground);
  }

  // road ribbon + barriers
  const N = track.N;
  const hw = track.halfW;
  let roadMat;
  {
    const step = 1;
    const count = Math.floor(N / step);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= count; i++) {
      const s = ((i % count) * step) * track.ds;
      const p = sampleTrack(track, s);
      const nx = -Math.sin(p.a), nz = Math.cos(p.a);
      pos.push(p.x - nx * hw, 0, p.z - nz * hw, p.x + nx * hw, 0, p.z + nz * hw);
      const v = (i * step * track.ds) / 13;
      uv.push(0, v, 1, v);
      if (i < count) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const asp = makeAsphalt(wet, 7 + (def.id.length * 3));
    roadMat = new THREE.MeshStandardMaterial({
      map: asp.map, roughnessMap: asp.roughnessMap, roughness: 1, normalMap: asp.normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
      metalness: wet ? 0.1 : 0.04, envMap, envMapIntensity: wet ? 1.6 : 0.8,
    });
    const road = new THREE.Mesh(geo, roadMat);
    road.position.y = 0.01; scene.add(road);

    for (const side of [-1, 1]) {
      const bp = [], bi = [];
      const rp = [], ri = [];
      for (let i = 0; i <= count; i++) {
        const s = ((i % count) * step) * track.ds;
        const p = sampleTrack(track, s);
        const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        const o = side * (hw + 0.1), o2 = side * (hw + 0.7);
        bp.push(p.x + nx * o, 0, p.z + nz * o, p.x + nx * o, 1.0, p.z + nz * o);
        rp.push(p.x + nx * o, 1.0, p.z + nz * o, p.x + nx * o2, 1.0, p.z + nz * o2);
        if (i < count) {
          const k = i * 2;
          bi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2, k, k + 2, k + 1, k + 1, k + 2, k + 3);
          ri.push(k, k + 1, k + 2, k + 1, k + 3, k + 2, k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
      }
      const g1 = new THREE.BufferGeometry(); g1.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3)); g1.setIndex(bi);
      scene.add(new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: 0x14141f, side: THREE.DoubleSide })));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); g2.setIndex(ri);
      scene.add(new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: side < 0 ? pal.neonA : pal.neonB, side: THREE.DoubleSide })));
    }
  }

  // buildings, in height buckets so window textures keep their shape
  const density = def.density ?? 1;
  const hs = def.heightScale ?? 1;
  if (density > 0.35) {
    const buckets = [
      { h: 26 * hs, rows: 3, items: [] }, { h: 44 * hs, rows: 5, items: [] }, { h: 66 * hs, rows: 8, items: [] }, { h: 92 * hs, rows: 11, items: [] },
    ];
    const roofItems = [];
    const stepS = 17 / density;
    for (let s = 0; s < track.L; s += stepS) {
      for (const side of [-1, 1]) {
        const p = sampleTrack(track, s + rng() * 6);
        const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        const w = 11 + rng() * 11, dpt = 11 + rng() * 11;
        const off = hw + 8 + rng() * 9 + w * 0.5 + (def.id === "harbor" ? 38 : 0);
        const b = buckets[Math.floor(rng() * rng() * 4 + (rng() < 0.25 ? 1 : 0)) % 4];
        const it = { x: p.x + nx * off * side, z: p.z + nz * off * side, yaw: -p.a, w, d: dpt, tint: rng() };
        b.items.push(it);
        if (rng() < 0.4) roofItems.push({ ...it, h: b.h, col: rng() < 0.5 ? pal.neonA : pal.neonB });
        if (rng() < 0.7) {
          const off2 = off + w * 0.5 + 14 + rng() * 14;
          const b2 = buckets[2 + Math.floor(rng() * 2)];
          b2.items.push({ x: p.x + nx * off2 * side, z: p.z + nz * off2 * side, yaw: -p.a, w: 14 + rng() * 12, d: 14 + rng() * 12, tint: rng() });
        }
      }
    }
    // far skyline ring so the city feels huge from a distance
    let maxX = 0, maxZ = 0;
    for (let i = 0; i < track.N; i += 6) { maxX = Math.max(maxX, Math.abs(track.x[i])); maxZ = Math.max(maxZ, Math.abs(track.z[i])); }
    const ringR = Math.max(maxX, maxZ) + 260;
    for (let i = 0; i < 150; i++) {
      const th = rng() * Math.PI * 2, rr = ringR + rng() * 520;
      const w = 22 + rng() * 40, dpt = 22 + rng() * 40;
      const b = buckets[2 + Math.floor(rng() * 2)];
      b.items.push({ x: Math.cos(th) * rr * (def.stretch ? Math.max(1, def.stretch * 0.8) : 1), z: Math.sin(th) * rr, yaw: th, w, d: dpt, tint: rng() });
    }
    const tmp = new THREE.Object3D();
    for (const b of buckets) {
      if (!b.items.length) continue;
      const tex = makeWindowTexture(b.rows * 0.07, b.rows);
      const mat = new THREE.MeshStandardMaterial({ color: 0x9a9ab8, map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.45, envMap, envMapIntensity: 0.9 });
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, b.h, 1), mat, b.items.length);
      b.items.forEach((it, i) => {
        tmp.position.set(it.x, b.h / 2, it.z); tmp.rotation.set(0, it.yaw, 0); tmp.scale.set(it.w, 1, it.d); tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      });
      scene.add(mesh);
    }
    if (roofItems.length) {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.9, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), roofItems.length);
      roofItems.forEach((it, i) => {
        tmp.position.set(it.x, it.h + 0.5, it.z); tmp.rotation.set(0, it.yaw, 0); tmp.scale.set(it.w * 1.02, 1, it.d * 1.02); tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix); m.setColorAt(i, new THREE.Color(it.col));
      });
      scene.add(m);
    }
  }
  // ---- Harbor Loop pilot: concrete quay over dark water, container
  // yards, gantry frames over the road and quay cranes on the skyline ----
  if (def.id === "harbor") {
    const tmp = new THREE.Object3D();
    const ribbon = (o1, o2, y, mat, side) => {
      const pos = [], uv = [], idx = [];
      const count = Math.floor(N);
      for (let i = 0; i <= count; i++) {
        const sS = (i % count) * track.ds;
        const p = sampleTrack(track, sS);
        const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        pos.push(p.x + nx * o1 * side, y, p.z + nz * o1 * side, p.x + nx * o2 * side, y, p.z + nz * o2 * side);
        const v = (i * track.ds) / 12;
        uv.push(0, v, (o2 - o1) / 12, v);
        if (i < count) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // make sure the face points up whichever way the ribbon was wound
      const nrm = g.attributes.normal; if (nrm.getY(0) < 0) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.computeVertexNormals(); }
      const m = new THREE.Mesh(g, mat); scene.add(m); return m;
    };
    // concrete apron with expansion joints and oil stains
    const aprTex = canvasTexture(256, 256, (g) => {
      g.fillStyle = "#1b1c24"; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${i % 3 ? 0 : 255},${i % 3 ? 0 : 255},${i % 3 ? 0 : 255},${0.03 + (i % 5) * 0.012})`; g.fillRect((i * 97) % 256, (i * 57) % 256, 2 + (i % 3), 2); }
      g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
      g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(80, 150, 34, 16, 0.4, 0, 6.3); g.fill();
    });
    aprTex.wrapS = aprTex.wrapT = THREE.RepeatWrapping;
    const aprMat = new THREE.MeshStandardMaterial({ map: aprTex, roughness: 0.38, metalness: 0.35, envMap, envMapIntensity: 0.7 });
    const QUAY = 40;
    for (const side of [-1, 1]) {
      ribbon(hw + 0.7, hw + QUAY, 0.0, aprMat, side);
      ribbon(hw + QUAY - 0.5, hw + QUAY, 0.02, new THREE.MeshBasicMaterial({ color: side < 0 ? 0xffb703 : 0x2de2ff }), side); // quay-edge lights
    }
    // yellow bollards along the quay edge
    {
      const pts = [];
      for (let sS = 0; sS < track.L; sS += 26) for (const side of [-1, 1]) {
        const p = sampleTrack(track, sS); const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        pts.push({ x: p.x + nx * (hw + QUAY - 1.2) * side, z: p.z + nz * (hw + QUAY - 1.2) * side });
      }
      const bm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.36, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5 }), pts.length);
      pts.forEach((q, i) => { tmp.position.set(q.x, 0.4, q.z); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); bm.setMatrixAt(i, tmp.matrix); });
      scene.add(bm);
    }

    // container yards: ribbed boxes in coloured stacks, in runs with gaps
    const ribTex = canvasTexture(128, 64, (g) => {
      g.fillStyle = "#d9d9d9"; g.fillRect(0, 0, 128, 64);
      for (let x = 0; x < 128; x += 5) { g.fillStyle = x % 10 ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.18)"; g.fillRect(x, 4, 3, 56); }
      g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, 0, 128, 4); g.fillRect(0, 60, 128, 4);
    });
    const CONT = [0xb83a2a, 0x1f6f8b, 0xd88a1a, 0x2f5fae, 0x4b6b3a, 0x8a8f9a, 0x7a2f5a, 0xcfcfcf];
    const boxes = [];
    let run = 0, runSide = 1, gap = 0;
    for (let sS = 14; sS < track.L - 14; sS += 12.6) {
      if (gap > 0) { gap--; continue; }
      if (run <= 0) { run = 3 + Math.floor(rng() * 5); runSide = rng() < 0.5 ? -1 : 1; gap = rng() < 0.55 ? 2 + Math.floor(rng() * 4) : 0; }
      run--;
      const p = sampleTrack(track, sS);
      const nx = -Math.sin(p.a), nz = Math.cos(p.a);
      const layers = 1 + Math.floor(rng() * rng() * 4);
      const col = CONT[Math.floor(rng() * CONT.length)];
      for (let L = 0; L < layers; L++) {
        const o = (hw + 4.8) * runSide;
        boxes.push({ x: p.x + nx * o, z: p.z + nz * o, y: 1.3 + L * 2.62, yaw: -p.a, col: rng() < 0.75 ? col : CONT[Math.floor(rng() * CONT.length)] });
      }
    }
    if (boxes.length) {
      const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.4), new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.55, metalness: 0.35, envMap, envMapIntensity: 0.5, emissive: 0x0a0a10 }), boxes.length);
      boxes.forEach((b, i) => { tmp.position.set(b.x, b.y, b.z); tmp.rotation.set(0, b.yaw, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); cm.setMatrixAt(i, tmp.matrix); cm.setColorAt(i, new THREE.Color(b.col)); });
      scene.add(cm);
    }

    // gantry frames straddling the road, with floodlights and red warning beacons
    const steel = new THREE.MeshStandardMaterial({ color: 0x2c2f3a, roughness: 0.5, metalness: 0.7, envMap, envMapIntensity: 0.6 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const floodMat = new THREE.MeshBasicMaterial({ color: 0xfff1cc });
    const GANTRIES = 5;
    for (let gI = 0; gI < GANTRIES; gI++) {
      const sS = track.L * (0.12 + (gI / GANTRIES) * 0.8);
      const p = sampleTrack(track, sS); const nx = -Math.sin(p.a), nz = Math.cos(p.a);
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); grp.rotation.y = -p.a;
      const span = hw + 2.2, H = 17;
      for (const sd of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, H, 1.4), steel); leg.position.set(0, H / 2, sd * span); grp.add(leg);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.4, H * 0.9, 0.4), steel); brace.position.set(0.9, H * 0.45, sd * span); brace.rotation.x = sd * 0.12; grp.add(brace);
        const bc = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), beaconMat); bc.position.set(0, H + 0.6, sd * span); grp.add(bc);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff2a2a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.set(0, H + 0.6, sd * span); halo.rotation.y = Math.PI / 2; grp.add(halo);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, span * 2 + 1.5), steel); beam.position.set(0, H, 0); grp.add(beam);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, span * 2), steel); truss.position.set(0, H + 1.4, 0); grp.add(truss);
      for (let f = -3; f <= 3; f++) {
        const fl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.4), floodMat); fl.position.set(0, H - 1.0, f * (span * 0.28)); grp.add(fl);
      }
      scene.add(grp);
    }
    // quay cranes standing in the water at the far edge of the quay: tall A-frames with long booms
    const craneSpots = [];
    for (let i = 0; i < 9; i++) {
      const sS = (i / 9) * track.L + 40;
      const p = sampleTrack(track, sS); const nx = -Math.sin(p.a), nz = Math.cos(p.a);
      const sd = i % 2 ? 1 : -1;
      craneSpots.push({ x: p.x + nx * (hw + QUAY + 6) * sd, z: p.z + nz * (hw + QUAY + 6) * sd, yaw: -p.a + (sd > 0 ? 0 : Math.PI) });
    }
    for (const c of craneSpots) {
      const g = new THREE.Group(); g.position.set(c.x, -0.9, c.z); g.rotation.y = c.yaw;
      const Hc = 34;
      for (const [lx, lz] of [[-4, -5], [-4, 5], [4, -5], [4, 5]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1, Hc, 1), steel); leg.position.set(lx, Hc / 2, lz); g.add(leg);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(12, 2.4, 13), steel); top.position.set(0, Hc, 0); g.add(top);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 48), steel); boom.position.set(0, Hc + 2.2, 14); g.add(boom);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), beaconMat); tip.position.set(0, Hc + 3.2, 38.5); g.add(tip);
      const tip2 = tip.clone(); tip2.position.set(0, Hc + 3.4, -8); g.add(tip2);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff2a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.set(0, Hc + 3.2, 38.5); halo.rotation.y = Math.PI / 2; g.add(halo);
      scene.add(g);
    }
  }

  // mountain road: pines and distant ridges
  if (density <= 0.35) {
    const trees = [];
    for (let s = 0; s < track.L; s += 7) {
      for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        const p = sampleTrack(track, s + rng() * 5);
        const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        const off = hw + 3 + rng() * 26;
        trees.push({ x: p.x + nx * off * side, z: p.z + nz * off * side, sc: 0.8 + rng() * 1.5 });
      }
    }
    const tmp = new THREE.Object3D();
    const treeMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 13, 7), new THREE.MeshStandardMaterial({ color: 0x0c1f14, emissive: 0x03110a, roughness: 1 }), trees.length);
    trees.forEach((t, i) => { tmp.position.set(t.x, 6.5 * t.sc, t.z); tmp.rotation.set(0, 0, 0); tmp.scale.set(t.sc, t.sc, t.sc); tmp.updateMatrix(); treeMesh.setMatrixAt(i, tmp.matrix); });
    scene.add(treeMesh);
    const ridges = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshStandardMaterial({ color: 0x0a1016, roughness: 1 }), 40);
    for (let i = 0; i < 40; i++) {
      const th = (i / 40) * Math.PI * 2 + rng() * 0.2, rr = 1100 + rng() * 300, hh = 160 + rng() * 280;
      tmp.position.set(Math.cos(th) * rr, hh / 2, Math.sin(th) * rr); tmp.rotation.set(0, 0, 0); tmp.scale.set(260 + rng() * 220, hh, 260 + rng() * 220); tmp.updateMatrix(); ridges.setMatrixAt(i, tmp.matrix);
    }
    scene.add(ridges);
  }

  // street lamps (+ wet reflections streaking down the road)
  {
    const poles = [];
    const gap = density > 0.35 ? 34 : 52;
    for (let s = 0; s < track.L; s += gap) {
      for (const side of [-1, 1]) {
        const p = sampleTrack(track, s + (side > 0 ? gap / 2 : 0));
        const nx = -Math.sin(p.a), nz = Math.cos(p.a);
        poles.push({ x: p.x + nx * (hw + 1.6) * side, z: p.z + nz * (hw + 1.6) * side, px: p.x + nx * (hw * 0.45) * side, pz: p.z + nz * (hw * 0.45) * side, a: p.a });
      }
    }
    const tmp = new THREE.Object3D();
    const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), new THREE.MeshStandardMaterial({ color: 0x25252f }), poles.length);
    const headMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.25, 0.6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), poles.length);
    const haloMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb860, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), poles.length);
    poles.forEach((p, i) => {
      tmp.position.set(p.x, 4.5, p.z); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); poleMesh.setMatrixAt(i, tmp.matrix);
      tmp.position.set(p.x, 9.0, p.z); tmp.updateMatrix(); headMesh.setMatrixAt(i, tmp.matrix);
      tmp.position.set(p.x, 8.7, p.z); tmp.updateMatrix(); haloMesh.setMatrixAt(i, tmp.matrix);
    });
    scene.add(poleMesh, headMesh, haloMesh);
    {
      const cg = new THREE.ConeGeometry(4.8, 9, 18, 1, true); cg.translate(0, -4.5, 0);
      const cones = new THREE.InstancedMesh(cg, makeBeamMaterial(0xffb460, wet || weather === "fog" ? 0.55 : 0.32), poles.length);
      poles.forEach((p, i) => { tmp.position.set(p.x, 8.9, p.z); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); cones.setMatrixAt(i, tmp.matrix); });
      scene.add(cones);
    }
    if (wet) {
      const refl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb860, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }), poles.length);
      poles.forEach((p, i) => {
        const m = new THREE.Matrix4().makeRotationY(-p.a).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(34, 2.6, 1));
        m.setPosition(p.px, 0.04, p.pz);
        refl.setMatrixAt(i, m);
      });
      scene.add(refl);
    }
  }

  // billboards
  {
    const words = ["BURN", "NITRO", "MIDNIGHT", "DRIFT KINGS", "GARAGE 9", "NEON"];
    let wi = 0;
    const every = Math.max(220, track.L / 12);
    for (let s = 120; s < track.L - 80; s += every) {
      const side = (wi % 2) ? -1 : 1;
      const p = sampleTrack(track, s);
      const nx = -Math.sin(p.a), nz = Math.cos(p.a);
      const tex = makeBillboardTexture(words[wi % words.length], pal.neonA, pal.neonB);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 8.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      const off = (hw + 7) * side;
      m.position.set(p.x + nx * off, 12, p.z + nz * off);
      m.lookAt(p.x, 12, p.z);
      scene.add(m);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12, 0.6), new THREE.MeshStandardMaterial({ color: 0x1b1b24 }));
      pole.position.set(m.position.x, 6, m.position.z); scene.add(pole);
      wi++;
    }
  }

  // start / finish gantry
  {
    const p = sampleTrack(track, 0);
    const nx = -Math.sin(p.a), nz = Math.cos(p.a);
    const grp = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1d1d28 });
    for (const sd of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), postMat);
      post.position.set(p.x + nx * (hw + 1.2) * sd, 4.5, p.z + nz * (hw + 1.2) * sd); grp.add(post);
    }
    const tex = canvasTexture(256, 32, (g) => {
      for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#fff" : "#111"; g.fillRect(i * 8, j * 8, 8, 8); }
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, hw * 2 + 3), new THREE.MeshBasicMaterial({ map: tex }));
    beam.position.set(p.x, 9, p.z); beam.rotation.y = -p.a; grp.add(beam);
    scene.add(grp);
  }

  // ---- actors ----------------------------------------------------------
  const actors = new Map();
  const rivalKeys = [];
  const blobTex = makeBlobShadow();
  const coneFade = makeConeFade();
  const beamOpacity = weather === "clear" ? 0.05 : weather === "fog" ? 0.15 : 0.12;
  function addActor(key, color, kind, glowColor, pool, spec) {
    const m = spec
      ? createHeroCar(spec, { envMap, glowTex, poolTex: pool ? glowTex : null })
      : createCarMesh(color, kind, glowColor, glowTex, envMap, pool ? glowTex : null);
    // soft contact shadow so the car sits on the road instead of floating
    const L = m.userData.arch ? m.userData.arch.L : 4.4;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.32, 2.7), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.045, 0); m.add(blob);
    // faint volumetric headlight beam (shows up in rain and fog)
    if (pool) {
      const noseX = m.userData.noseX ?? 2.2;
      const len = 34;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(5.5, len, 20, 1, true), makeBeamMaterial(0xfff0d0, beamOpacity * 5));
      beam.rotation.z = Math.PI / 2; beam.position.set(noseX + len / 2 - 0.4, 0.62, 0); m.add(beam);
    }
    scene.add(m);
    actors.set(key, m);
    return m;
  }
  const playerMesh = addActor("player", setup.player.color, setup.player.car || "kestrel", setup.player.color, true, setup.player.spec);
  setup.rivals.forEach((r, i) => { addActor("ai" + i, r.color, r.car || "kestrel", r.color, true, r.spec); rivalKeys.push("ai" + i); });
  setup.trafficKinds.forEach((k, i) => addActor("t" + i, TRAFFIC_COLORS[setup.trafficHues[i] % TRAFFIC_COLORS.length], k === 1 ? "van" : "sedan", null, true));

  // player lights
  const headL = new THREE.SpotLight(0xfff0d0, 110, 90, 0.5, 0.6, 1.3);
  scene.add(headL, headL.target);
  const underL = new THREE.PointLight(setup.player.color, 6, 12, 1.6);
  scene.add(underL);

  // nitro flames
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const z of [-0.5, 0.5]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.6, 8), flameMat);
    f.rotation.z = Math.PI / 2; f.position.set((playerMesh.userData.tailX ?? -3.1) - 1.2, 0.55, z); f.visible = false; playerMesh.add(f); flames.push(f);
  }

  // speed lines
  const LINES = 140;
  const linePos = new Float32Array(LINES * 6);
  const lineBase = [];
  for (let i = 0; i < LINES; i++) lineBase.push({ a: rng() * Math.PI * 2, r: 3 + rng() * 14, z: -5 - rng() * 45 });
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const speedLines = new THREE.LineSegments(lineGeo, lineMat); speedLines.frustumCulled = false; scene.add(speedLines);

  // rain streaks around the camera
  let rain = null;
  if (raining) {
    const RN = weather === "storm" ? 1300 : 800;
    const rpos = new Float32Array(RN * 6);
    const base = [];
    for (let i = 0; i < RN; i++) base.push({ x: (rng() - 0.5) * 70, y: rng() * 30, z: (rng() - 0.5) * 70 });
    const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
    const rmat = new THREE.LineBasicMaterial({ color: 0xaac4ff, transparent: true, opacity: 0.35, fog: true, depthWrite: false });
    const mesh = new THREE.LineSegments(rgeo, rmat); mesh.frustumCulled = false; scene.add(mesh);
    rain = { RN, rpos, base, rgeo, mesh };
  }
  let flash = 0, nextBolt = 5 + rng() * 5;

  // skid marks (ring buffer of dark quads laid on the road)
  const SK = 700;
  const skidMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 1.0), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SK);
  skidMesh.frustumCulled = false; skidMesh.count = 0; scene.add(skidMesh);
  let skidCursor = 0, skidTotal = 0;
  const lastSkid = [{ x: 1e9, z: 1e9 }, { x: 1e9, z: 1e9 }];
  const skTmp = new THREE.Object3D();
  function addSkid(x, z, yaw) {
    skTmp.position.set(x, 0.03, z); skTmp.rotation.set(-Math.PI / 2, 0, 0); skTmp.rotation.order = "YXZ"; skTmp.rotation.y = -yaw; skTmp.rotation.x = -Math.PI / 2; skTmp.scale.set(1, 1.1, 1); skTmp.updateMatrix();
    skidMesh.setMatrixAt(skidCursor, skTmp.matrix);
    skidCursor = (skidCursor + 1) % SK; skidTotal = Math.min(SK, skidTotal + 1);
    skidMesh.count = skidTotal; skidMesh.instanceMatrix.needsUpdate = true;
  }

  // drift smoke / sparks (additive points)
  const PN = 320;
  const ppos = new Float32Array(PN * 3), pcol = new Float32Array(PN * 3);
  const pvel = new Float32Array(PN * 3), plife = new Float32Array(PN);
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3)); pgeo.setAttribute("color", new THREE.BufferAttribute(pcol, 3));
  const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 0.9, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  let pCursor = 0;
  function emit(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = pCursor++ % PN;
    ppos[i * 3] = x; ppos[i * 3 + 1] = y; ppos[i * 3 + 2] = z;
    pvel[i * 3] = vx; pvel[i * 3 + 1] = vy; pvel[i * 3 + 2] = vz;
    plife[i] = life; pcol[i * 3] = r; pcol[i * 3 + 1] = g; pcol[i * 3 + 2] = b;
  }

  // post-processing
  let composer = null;
  let gradePass = null;
  try {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.floor(width * pr), Math.floor(height * pr), { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.75, 0.6, 0.7);
    composer.addPass(bloom);
    gradePass = makeGradePass();
    gradePass.uniforms.uRes.value.set(width * pr, height * pr);
    composer.addPass(gradePass);
    composer.addPass(new OutputPass());
    composer.setSize(width, height);
  } catch {
    composer = null;
  }

  // ---- quest markers ---------------------------------------------------
  let questGroup = null;
  let quests = [];
  const questMats = [];
  function clearQuestMarkers() {
    if (!questGroup) return;
    scene.remove(questGroup);
    questGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    questGroup = null; quests = [];
  }
  function questMarkers(defs) {
    clearQuestMarkers();
    questGroup = new THREE.Group(); scene.add(questGroup);
    const COL = { speed: 0xff4040, drift: 0xff2d95, gates: 0x2de2ff };
    const at = (s, d) => { const p = sampleTrack(track, s); return { x: p.x - Math.sin(p.a) * d, z: p.z + Math.cos(p.a) * d, a: p.a }; };
    function mat(color, opacity = 1) { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }); questMats.push(m); return m; }
    function gate(s, d, half, color, h, label, ring) {
      const g = new THREE.Group();
      const c = at(s, d);
      const bright = mat(color, 1), dim = mat(color, 0.14);
      for (const sd of [-1, 1]) {
        const lp = at(s, d + sd * half);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), bright); post.position.set(lp.x, h / 2, lp.z); g.add(post);
      }
      if (ring) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(half, 0.2, 8, 28), bright);
        r.position.set(c.x, half + 0.6, c.z); r.rotation.y = Math.PI / 2 - c.a; g.add(r);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(half, 24), dim);
        disc.position.copy(r.position); disc.rotation.y = Math.PI / 2 - c.a; g.add(disc);
      } else {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, half * 2), bright);
        bar.position.set(c.x, h, c.z); bar.rotation.y = -c.a; g.add(bar);
        const portal = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, half * 2), dim);
        portal.position.set(c.x, h / 2, c.z); portal.rotation.y = -c.a; g.add(portal);
      }
      if (label) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(label, hex(color)), transparent: true, depthWrite: false, fog: false }));
        sp.scale.set(14, 3.5, 1); sp.position.set(c.x, (ring ? half * 2 + 2.8 : h + 3), c.z); g.add(sp);
      }
      questGroup.add(g);
      return { g, bright, dim };
    }
    defs.forEach((d) => {
      const color = COL[d.type];
      const entry = { def: d, parts: [] };
      if (d.type === "speed") {
        entry.parts.push(gate(d.s, 0, hw + 1, color, 9, `SPEED TRAP ${d.target}+`, false));
      } else if (d.type === "drift") {
        entry.parts.push(gate(d.s0, 0, hw + 1, color, 8, "DRIFT ZONE", false));
        entry.parts.push(gate(d.s0 + d.len, 0, hw + 1, color, 8, "ZONE END", false));
        // floor strip
        const cnt = Math.ceil(d.len / 4), pos = [], idx = [];
        for (let i = 0; i <= cnt; i++) {
          const p = sampleTrack(track, d.s0 + (d.len * i) / cnt);
          const nx = -Math.sin(p.a), nz = Math.cos(p.a);
          pos.push(p.x - nx * hw, 0.05, p.z - nz * hw, p.x + nx * hw, 0.05, p.z + nz * hw);
          if (i < cnt) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
        const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx);
        const fm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        questGroup.add(fm); entry.floor = fm;
      } else if (d.type === "gates") {
        d.gates.forEach((gt, i) => {
          entry.parts.push(gate(gt.s, gt.d, 2.7, color, 5.4, `${i + 1}`, true));
        });
      }
      quests.push(entry);
    });
  }
  function setQuestState(states, t) {
    quests.forEach((q, qi) => {
      const st = states[qi]; if (!st) return;
      const done = st.done;
      q.parts.forEach((part, gi) => {
        let b = 1, dm = 0.14, vis = true;
        if (done) { b = 0.25; dm = 0.03; }
        else if (q.def.type === "gates") {
          const isNext = st.running ? gi === st.next : gi === 0;
          const passed = st.running && gi < st.next;
          b = isNext ? 0.85 + 0.15 * Math.sin(t * 7) : passed ? 0.18 : 0.5;
          dm = isNext ? 0.18 + 0.1 * Math.sin(t * 7) : 0.04;
        } else b = 0.8 + 0.2 * Math.sin(t * 4 + gi);
        part.bright.opacity = b; part.dim.opacity = dm; part.g.visible = vis;
        if (done) part.bright.color.setHex(0x6bff6b);
      });
      if (q.floor) { q.floor.material.opacity = done ? 0.02 : 0.10 + 0.05 * Math.sin(t * 3); if (done) q.floor.material.color.setHex(0x6bff6b); }
    });
  }

  // camera state
  const cam = { x: 0, y: 4, z: 0, ang: 0, fov: 64, shake: 0, init: false, mode: 0 };
  const lastPlayerPos = { x: 0, z: 0 };
  let clock = 0;

  function place(mesh, c, dt, isPlayer) {
    const w = worldPose(track, c.s, c.d, c.h);
    mesh.position.set(w.x, 0, w.z);
    mesh.rotation.y = -w.yaw;
    for (const wl of mesh.userData.wheels) {
      wl.spin.rotation.z -= ((c.v * dt) / (wl.r || 0.37)) * (wl.dir || 1);
      if (isPlayer && wl.front) wl.pivot.rotation.y = -c.steer * 0.42;
    }
    return w;
  }

  function update(frame, dt, realDt) {
    clock += realDt;
    const pl = frame.player;
    const pw = place(playerMesh, pl, dt, true);
    updateMist(pl, pw, dt);
    envTimer += realDt;
    if (envTimer > 2.4) { envTimer = 0; captureEnv(pw.x, pw.z); }
    frame.rivals.forEach((r, i) => { const m = actors.get("ai" + i); if (m.visible) place(m, r, dt, false); });
    frame.traffic.forEach((t, i) => {
      const m = actors.get("t" + i);
      const w = worldPose(track, t.s, t.d, 0);
      m.position.set(w.x, 0, w.z); m.rotation.y = -w.yaw;
      for (const wl of m.userData.wheels) wl.spin.rotation.z -= (t.v * dt) / (wl.r || 0.37) * (wl.dir || 1);
    });

    // weight transfer: nose dives under braking, squats on throttle, body rolls in bends
    const shell = playerMesh.userData.shell;
    const speedF = Math.min(1, pl.v / 40);
    const pitchT = THREE.MathUtils.clamp(pl.acc * 0.0011, -0.05, 0.035);
    const rollT = THREE.MathUtils.clamp(-pl.lat * 0.0011, -0.07, 0.07) * speedF;
    shell.rotation.z += (pitchT - shell.rotation.z) * Math.min(1, realDt * 7);
    shell.rotation.x += (rollT - shell.rotation.x) * Math.min(1, realDt * 7);
    shell.position.y = (shell.rotation.z * -0.1) + (playerMesh.userData.stanceDy || 0);
    // rivals get the same light touch
    frame.rivals.forEach((r, i) => {
      const m = actors.get("ai" + i); const sh = m.userData.shell;
      sh.rotation.z += (THREE.MathUtils.clamp(r.acc * 0.0011, -0.05, 0.035) - sh.rotation.z) * Math.min(1, realDt * 7);
    });

    // brake lights
    playerMesh.userData.tailMat.color.setHex(pl.braking ? 0xff3b2b : 0xb81616);
    frame.rivals.forEach((r, i) => actors.get("ai" + i).userData.tailMat.color.setHex(r.braking ? 0xff3b2b : 0xb81616));

    const nosOn = pl.nos;
    flames.forEach((f) => { f.visible = nosOn; if (nosOn) f.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 1); });
    headL.position.set(pw.x, 1.2, pw.z);
    headL.target.position.set(pw.x + Math.cos(pw.yaw) * 30, 0, pw.z + Math.sin(pw.yaw) * 30);
    underL.position.set(pw.x, 0.5, pw.z);
    underL.intensity = nosOn ? 14 : 6;

    // cameras: 0 chase, 1 far chase, 2 hood
    const vel = pl.tv, hd = pl.h;
    const camYaw = pw.trackAngle + hd * 0.55 + vel * 0.25;
    const firstFrame = !cam.init;
    if (firstFrame) { cam.ang = camYaw; cam.init = true; }
    let da = camYaw - cam.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    cam.ang += da * Math.min(1, realDt * (cam.mode === 2 ? 14 : 5.5));
    const speed = pl.v;
    if (gradePass) {
      const u = gradePass.uniforms;
      u.uTime.value = clock;
      const tb = THREE.MathUtils.clamp((speed - 45) / 60, 0, 1) * 0.045 + (nosOn ? 0.07 : 0);
      u.uBlur.value += (tb - u.uBlur.value) * Math.min(1, realDt * 5);
      u.uCA.value = 0.0008 + Math.min(1, speed / 70) * 0.0014 + (nosOn ? 0.0022 : 0);
    }
    playerMesh.visible = cam.mode !== 2;
    if (cam.mode === 2) {
      const fx = Math.cos(pw.yaw), fz = Math.sin(pw.yaw);
      cam.x = pw.x + fx * 0.5; cam.z = pw.z + fz * 0.5; cam.y = 1.2;
      camera.position.set(cam.x + (Math.random() - 0.5) * speedF * 0.012, cam.y + (Math.random() - 0.5) * speedF * 0.012, cam.z);
      camera.lookAt(pw.x + Math.cos(cam.ang) * 24, 1.0, pw.z + Math.sin(cam.ang) * 24);
    } else {
      const far = cam.mode === 1 ? 1 : 0;
      const back = 7.4 + far * 3.8 + speed * 0.035 + (nosOn ? 1.6 : 0);
      const tx = pw.x - Math.cos(cam.ang) * back, tz = pw.z - Math.sin(cam.ang) * back;
      const ty = 2.7 + far * 1.5 + speed * 0.006;
      const kf = 1 - Math.pow(0.0005, realDt);
      if (firstFrame || cam.wasHood) { cam.x = tx; cam.z = tz; cam.y = ty; }
      cam.x += (tx - cam.x) * kf; cam.z += (tz - cam.z) * kf; cam.y += (ty - cam.y) * kf;
      cam.shake = Math.max(0, cam.shake - realDt * 3);
      if (pl.wallHit) cam.shake = 1;
      const sh = cam.shake * 0.35;
      camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z + (Math.random() - 0.5) * sh);
      camera.lookAt(pw.x + Math.cos(cam.ang) * 9, 1.2, pw.z + Math.sin(cam.ang) * 9);
    }
    cam.wasHood = cam.mode === 2;
    if (typeof window !== "undefined" && window.__MB_CAM) window.__MB_CAM(camera, pw); // test-only camera override
    const fovT = (cam.mode === 2 ? 72 : 62) + (speed / 70) * 10 + (nosOn ? 16 : 0);
    cam.fov += (fovT - cam.fov) * Math.min(1, realDt * 4);
    if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }

    // speed lines (in camera space)
    const intensity = THREE.MathUtils.clamp((speed - 38) / 40, 0, 1) * (nosOn ? 1 : 0.55);
    lineMat.opacity = intensity * 0.55;
    if (intensity > 0.01) {
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      for (let i = 0; i < LINES; i++) {
        const b = lineBase[i];
        b.z += speed * realDt * 1.5; if (b.z > 4) b.z = -50 - rng() * 10;
        const len = 1 + speed * 0.05 * intensity;
        const cx = Math.cos(b.a) * b.r, cy = Math.sin(b.a) * b.r * 0.6;
        for (let e = 0; e < 2; e++) {
          const zz = b.z - e * len;
          linePos[i * 6 + e * 3] = camera.position.x - fwd.x * zz + right.x * cx + up.x * cy;
          linePos[i * 6 + e * 3 + 1] = camera.position.y - fwd.y * zz + right.y * cx + up.y * cy;
          linePos[i * 6 + e * 3 + 2] = camera.position.z - fwd.z * zz + right.z * cx + up.z * cy;
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
    }

    // rain
    if (rain) {
      const { RN, rpos, base, rgeo } = rain;
      const fall = weather === "storm" ? 62 : 46;
      for (let i = 0; i < RN; i++) {
        const b = base[i];
        b.y -= fall * realDt; if (b.y < 0) { b.y += 30; b.x = (rng() - 0.5) * 70; b.z = (rng() - 0.5) * 70; }
        const x = camera.position.x + b.x, z = camera.position.z + b.z, y = b.y;
        rpos[i * 6] = x; rpos[i * 6 + 1] = y; rpos[i * 6 + 2] = z;
        rpos[i * 6 + 3] = x + 0.12; rpos[i * 6 + 4] = y + 1.5; rpos[i * 6 + 5] = z;
      }
      rgeo.attributes.position.needsUpdate = true;
    }
    // lightning
    if (weather === "storm") {
      nextBolt -= realDt;
      if (nextBolt <= 0) { flash = 1; nextBolt = 6 + rng() * 9; }
      flash = Math.max(0, flash - realDt * 2.6);
      const f = flash > 0.55 ? flash : flash * 0.4;
      ambient.intensity = 0.65 + f * 3.2; hemi.intensity = 0.55 + f * 2.5;
    }

    // skid marks: drifting or hard braking
    const rearLocal = playerMesh.userData.tailX + 0.6;
    const skidding = (pl.drifting || (pl.braking && pl.v > 28 && pl.acc < -35)) && pl.v > 12;
    if (skidding) {
      [-1, 1].forEach((side, wi) => {
        const wx = pw.x + Math.cos(pw.yaw) * rearLocal - Math.sin(pw.yaw) * side * 0.85;
        const wz = pw.z + Math.sin(pw.yaw) * rearLocal + Math.cos(pw.yaw) * side * 0.85;
        const ls = lastSkid[wi];
        if (Math.hypot(wx - ls.x, wz - ls.z) > 0.9) {
          const heading = Math.atan2(wz - ls.z, wx - ls.x);
          if (Math.hypot(wx - ls.x, wz - ls.z) < 6) addSkid(wx, wz, heading);
          ls.x = wx; ls.z = wz;
        }
      });
    } else { lastSkid[0].x = lastSkid[1].x = 1e9; }

    // particles
    if (pl.drifting) {
      for (const z of [-0.9, 0.9]) {
        const wx = pw.x + Math.cos(pw.yaw) * -2.1 - Math.sin(pw.yaw) * z;
        const wz = pw.z + Math.sin(pw.yaw) * -2.1 + Math.cos(pw.yaw) * z;
        emit(wx, 0.3, wz, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.7 + Math.random() * 0.4, 0.2, 0.2, 0.25);
        if (Math.random() < 0.5) emit(wx, 0.2, wz, (Math.random() - 0.5) * 9, 2 + Math.random() * 4, (Math.random() - 0.5) * 9, 0.35, 0.8, 0.45, 0.1);
      }
    }
    if (pl.wallHit) {
      for (let i = 0; i < 14; i++) emit(pw.x, 0.8, pw.z, (Math.random() - 0.5) * 16, 2 + Math.random() * 6, (Math.random() - 0.5) * 16, 0.5, 1, 0.7, 0.2);
    }
    for (let i = 0; i < PN; i++) {
      if (plife[i] > 0) {
        plife[i] -= realDt;
        ppos[i * 3] += pvel[i * 3] * realDt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * realDt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * realDt;
        const f = Math.max(0, plife[i]); pcol[i * 3] *= 0.96; pcol[i * 3 + 1] *= 0.96; pcol[i * 3 + 2] *= 0.96;
        if (f <= 0) { pcol[i * 3] = pcol[i * 3 + 1] = pcol[i * 3 + 2] = 0; ppos[i * 3 + 1] = -50; }
      }
    }
    pgeo.attributes.position.needsUpdate = true; pgeo.attributes.color.needsUpdate = true;
    lastPlayerPos.x = pw.x; lastPlayerPos.z = pw.z;
  }

  // ---- tyre spray: wet roads throw up a fine mist behind the rear wheels
  const MIST = 160;
  const mpos = new Float32Array(MIST * 3), mvel = new Float32Array(MIST * 3), mlife = new Float32Array(MIST), mcol = new Float32Array(MIST * 3);
  for (let i = 0; i < MIST; i++) mpos[i * 3 + 1] = -50;
  const mgeo = new THREE.BufferGeometry();
  mgeo.setAttribute("position", new THREE.BufferAttribute(mpos, 3)); mgeo.setAttribute("color", new THREE.BufferAttribute(mcol, 3));
  const mist = new THREE.Points(mgeo, new THREE.PointsMaterial({ map: glowTex, size: 1.7, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  mist.frustumCulled = false; scene.add(mist);
  let mistI = 0;
  function updateMist(pl, pw, dt) {
    if (dt <= 0) return;
    if (wet && pl.v > 22) {
      const n = 1 + Math.floor(pl.v / 22);
      const cs = Math.cos(pw.yaw), sn = Math.sin(pw.yaw);
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1;
        const lx = -1.4, lz = side * 0.95;
        const i = (mistI++) % MIST;
        mpos[i * 3] = pw.x + cs * lx - sn * lz; mpos[i * 3 + 1] = 0.25; mpos[i * 3 + 2] = pw.z + sn * lx + cs * lz;
        const back = -pl.v * 0.18;
        mvel[i * 3] = cs * back + (Math.random() - 0.5) * 2 - sn * side * 1.2; mvel[i * 3 + 1] = 0.8 + Math.random() * 1.6; mvel[i * 3 + 2] = sn * back + (Math.random() - 0.5) * 2 + cs * side * 1.2;
        mlife[i] = 1; const b = 0.1 + Math.random() * 0.08; mcol[i * 3] = b * 0.8; mcol[i * 3 + 1] = b * 0.9; mcol[i * 3 + 2] = b * 1.1;
      }
    }
    const fade = Math.max(0, 1 - dt * 1.4);
    for (let i = 0; i < MIST; i++) {
      if (mlife[i] <= 0) continue;
      mlife[i] -= dt * 1.1;
      mpos[i * 3] += mvel[i * 3] * dt; mpos[i * 3 + 1] += mvel[i * 3 + 1] * dt; mpos[i * 3 + 2] += mvel[i * 3 + 2] * dt;
      mvel[i * 3] *= 0.97; mvel[i * 3 + 2] *= 0.97; mvel[i * 3 + 1] *= 0.98;
      mcol[i * 3] *= fade; mcol[i * 3 + 1] *= fade; mcol[i * 3 + 2] *= fade;
      if (mlife[i] <= 0) { mpos[i * 3 + 1] = -50; mcol[i * 3] = mcol[i * 3 + 1] = mcol[i * 3 + 2] = 0; }
    }
    mgeo.attributes.position.needsUpdate = true; mgeo.attributes.color.needsUpdate = true;
  }

  // ---- live reflections: photograph the real city from the car's position
  // so paint, glass and wet asphalt reflect the neon, lamps and buildings
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.5, 650, cubeRT);
  let pmrem = null, liveEnv = null, envTimer = 0, envSwapped = false;
  function captureEnv(x, z) {
    try {
      if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
      const vis = []; actors.forEach((a) => { vis.push(a.visible); a.visible = false; });
      const sl = speedLines.visible; speedLines.visible = false; mist.visible = false;
      cubeCam.position.set(x, 2.4, z);
      cubeCam.update(renderer, scene);
      let i = 0; actors.forEach((a) => { a.visible = vis[i++]; });
      speedLines.visible = sl; mist.visible = true;
      liveEnv = pmrem.fromCubemap(cubeRT.texture, liveEnv);
      if (!envSwapped) {
        envSwapped = true;
        const seen = new Set();
        scene.traverse((o) => {
          if (!o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.envMap && !seen.has(m)) { seen.add(m); m.envMap = liveEnv.texture; m.needsUpdate = true; }
          }
        });
      }
    } catch { /* keep the static environment */ }
  }
  {
    const p0 = sampleTrack(track, 0);
    captureEnv(p0.x, p0.z);
  }

  // adaptive quality: if the machine struggles, drop to a lighter look
  let frames = 0, ema = 16, lastT = 0, lowered = false;
  function render() {
    const now = performance.now();
    if (lastT) { ema += (Math.min(100, now - lastT) - ema) * 0.05; frames++; }
    lastT = now;
    if (!lowered && frames > 150 && ema > 30 && !(typeof window !== "undefined" && window.__MB_TEST)) {
      lowered = true;
      renderer.setPixelRatio(1);
      if (composer) { composer.setPixelRatio(1); composer.setSize(mount.clientWidth || width, mount.clientHeight || height); }
      if (gradePass) { gradePass.uniforms.uLite.value = 1; gradePass.uniforms.uRes.value.set(mount.clientWidth || width, mount.clientHeight || height); }
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); if (gradePass) { const pr = renderer.getPixelRatio(); gradePass.uniforms.uRes.value.set(w * pr, h * pr); } }
  }

  function setRivalsVisible(v) { rivalKeys.forEach((k) => { actors.get(k).visible = v; }); }
  function setCameraMode(m) { cam.mode = m % 3; }
  function snapCamera() { cam.init = false; }

  function dispose() {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
    });
    glowTex.dispose();
    if (envMap) envMap.dispose();
    if (liveEnv) liveEnv.dispose();
    if (pmrem) pmrem.dispose();
    cubeRT.dispose();
    if (composer) composer.dispose?.();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
  }

  return { update, render, resize, dispose, camera, scene, questMarkers, setQuestState, clearQuestMarkers, setRivalsVisible, setCameraMode, snapCamera };
}
