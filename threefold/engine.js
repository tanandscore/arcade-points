"use client";
// Threefold engine: side-on physics puzzle platformer rendered in 3D. Three heroes: Warden (sword, shield), Wisp (conjures and drags crates), Archer (bow, glide).
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, lerp, stoneTexture, grassTexture, noiseTexture } from "@/threeplay/core";
import { LEVELS } from "./levels";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const GRAV = 26, DOORS = { "!": 1, "@": 2, "%": 3 }, PLATES = { 1: 1, 2: 2, 3: 3 }, TARGETS = { x: 1, y: 2, z: 3 };
export { LEVELS };
const ov = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-4 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 1e-4;
const HERO = {
  warden: { name: "Warden", hp: 140, w: 0.85, h: 1.7, speed: 5.0, jump: 9.6, color: 0x8a94a8, accent: 0xc83a2a },
  wisp: { name: "Wisp", hp: 90, w: 0.7, h: 1.6, speed: 5.8, jump: 10.2, color: 0x7a4ac8, accent: 0x6fe0ff },
  archer: { name: "Archer", hp: 100, w: 0.7, h: 1.6, speed: 6.6, jump: 10.6, color: 0x3a8a4a, accent: 0xe0c060 },
};
export const HEROES = ["warden", "wisp", "archer"].map((k) => ({ key: k, ...HERO[k] }));
const THEMES = [
  { sky: { zenith: 0x3a78d0, mid: 0x8abaf0, horizon: 0xf0e6c8, sunDir: [0.5, 0.35, -0.7], sunColor: 0xfff0c0, sunSize: 0.02, glow: 0.8, cloud: 0.5 }, fog: 0xcfe0e8, hemi: [0xdfeaff, 0x5a6a50, 1.7], sun: [0xfff0d0, 2.6], tree: 0x3f8a3a, grass: "#4f9a3f", stone: "#8a8a8a" },
  { sky: { zenith: 0x1a1648, mid: 0x6a3a8a, horizon: 0xf0907a, sunDir: [-0.6, 0.15, -0.7], sunColor: 0xffb090, sunSize: 0.02, glow: 1.2, cloud: 0.45, cloudColor: 0xffc0b0, cloudShade: 0x4a2a6a, stars: 0.4 }, fog: 0x7a4a7a, hemi: [0xd0a0e0, 0x2a2040, 1.3], sun: [0xffb090, 2.0], tree: 0x6a3a9a, grass: "#5a8a5a", stone: "#7a6a8a" },
  { sky: { zenith: 0x2a5aa8, mid: 0x9ac0e8, horizon: 0xe8f0f8, sunDir: [0.3, 0.5, -0.8], sunColor: 0xffffff, sunSize: 0.016, glow: 0.6, cloud: 0.6 }, fog: 0xd8e4ee, hemi: [0xcfe0ff, 0x7a8088, 1.8], sun: [0xffffff, 2.8], tree: 0x4a6a7a, grass: "#8aa88a", stone: "#98a0aa" },
  { sky: { zenith: 0x080410, mid: 0x401a20, horizon: 0xff6a2a, sunDir: [0.0, 0.1, -1], sunColor: 0xff7a3a, sunSize: 0.03, glow: 1.5, cloud: 0.6, cloudColor: 0xc05a30, cloudShade: 0x1a0808, stars: 0.3 }, fog: 0x7a3a28, hemi: [0xffb090, 0x503038, 2.3], sun: [0xffa060, 3.0], tree: 0x7a3a22, grass: "#7a6a3a", stone: "#9a8a86" },
  { sky: { zenith: 0x1a2a4a, mid: 0x3a5a7a, horizon: 0xd8b878, sunDir: [0.4, 0.2, -0.8], sunColor: 0xffd890, sunSize: 0.02, glow: 1.0, cloud: 0.4, cloudColor: 0xe0d0b0, cloudShade: 0x3a4a5a }, fog: 0x6a7a80, hemi: [0xc0d0e0, 0x3a4048, 1.4], sun: [0xffd890, 2.2], tree: 0x4a5a4a, grass: "#7a8a5a", stone: "#8a8478" },
  { sky: { zenith: 0x02040e, mid: 0x14183a, horizon: 0x3a2a58, sunDir: [-0.4, 0.5, -0.6], sunColor: 0xcfd8ff, sunSize: 0.014, glow: 0.7, cloud: 0.3, cloudColor: 0x4a4a70, cloudShade: 0x0a0a1a, stars: 1.4 }, fog: 0x2e2a52, hemi: [0x8a90e0, 0x30305a, 2.3], sun: [0xc0d0ff, 2.4], tree: 0x3a3a68, grass: "#5a7a8a", stone: "#8a8aa8" },
];

export function makeHero(h) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const c = h.color, a = h.accent;
  const torso = mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 10), c, { rough: 0.5, metal: h.key === "warden" ? 0.5 : 0.05 }); torso.position.y = 0.2; body.add(torso);
  const belt = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10), a, { rough: 0.5 }); belt.position.y = -0.1; body.add(belt);
  const head = mesh(new THREE.SphereGeometry(0.22, 12, 10), h.key === "warden" ? 0xa8b0c0 : 0xe0b890, { rough: 0.5, metal: h.key === "warden" ? 0.6 : 0 }); head.position.y = 0.78; body.add(head);
  if (h.key === "warden") { const cr = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), a, { rough: 0.6 }); cr.position.y = 1.02; body.add(cr); const vz = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), 0x151820); vz.position.set(0, 0.8, 0.2); body.add(vz); }
  if (h.key === "wisp") { const hat = mesh(new THREE.ConeGeometry(0.3, 0.7, 10), c, { rough: 0.8 }); hat.position.y = 1.2; hat.rotation.z = 0.15; body.add(hat); const rb = mesh(new THREE.ConeGeometry(0.46, 0.9, 10), c, { rough: 0.9 }); rb.position.y = -0.1; body.add(rb); }
  if (h.key === "archer") { const hood = mesh(new THREE.ConeGeometry(0.28, 0.5, 10), c, { rough: 0.9 }); hood.position.set(0, 1.0, -0.04); body.add(hood); const q = mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), 0x6a4a2a); q.position.set(-0.1, 0.25, -0.3); q.rotation.z = 0.3; body.add(q); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0, 0.5, s * 0.34); const am = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 8), c, { rough: 0.5 }); am.position.y = -0.28; arm.add(am); body.add(arm); arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(0, -0.2, s * 0.16); const lm = mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.7, 8), 0x2a2e3a, { rough: 0.6 }); lm.position.y = -0.34; leg.add(lm); g.add(leg); legs.push(leg);
  }
  let weapon = null, shield = null, orb = null;
  if (h.key === "warden") { weapon = new THREE.Group(); const bl = mesh(new THREE.BoxGeometry(0.08, 1.0, 0.1), 0xdfe6f0, { metal: 0.9, rough: 0.2 }); bl.position.y = -0.7; weapon.add(bl); const gd = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), a, { metal: 0.5 }); gd.position.y = -0.28; weapon.add(gd); weapon.position.set(0.0, -0.55, 0.0); arms[1].add(weapon); weapon.rotation.x = Math.PI; weapon.position.y = -0.5;
    shield = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 18), a, { metal: 0.5, rough: 0.4 }); shield.rotation.z = Math.PI / 2; shield.position.set(0.28, 0.1, -0.1); shield.visible = false; body.add(shield); const bs = mesh(new THREE.SphereGeometry(0.14, 8, 6), 0xdfe6f0, { metal: 0.9 }); bs.position.set(0.34, 0.1, -0.1); shield.add(bs); bs.position.set(0, 0.06, 0); }
  if (h.key === "wisp") { const st = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), 0x5a3a1a); st.position.set(0, -0.2, 0); arms[1].add(st); orb = glowMesh(new THREE.SphereGeometry(0.15, 10, 8), a, 3); orb.position.set(0, 0.6, 0); st.add(orb); orb.add(sprite(a, 1.4, 0.6)); }
  if (h.key === "archer") { const bow = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 14, Math.PI), 0x8a5a2a); bow.rotation.set(0, 0, Math.PI / 2); bow.position.set(0, -0.55, 0.0); arms[0].add(bow); weapon = bow; }
  g.userData = { body, arms, legs, weapon, shield, orb, head };
  return g;
}

export function createThreefold(rig, ctx) {
  clearScene(rig); const { scene, camera, fx, sound, mouse, keys, pressed } = rig, L = LEVELS[ctx.level], T = THEMES[L.theme], power = ctx.power || 1;
  rig.setSky(T.sky); scene.fog = new THREE.FogExp2(T.fog, 0.012); scene.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
  const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]); sun.position.set(-18, 30, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 5; sc.far = 90; sun.shadow.bias = -0.0005; scene.add(sun); scene.add(sun.target);
  rig.cine.bloom && (rig.cine.bloom.strength = 0.5);
  const { W, H } = L, cell = (c, r) => (c < 0 || c >= W ? "#" : r < 0 ? "#" : r >= H ? "." : L.grid[H - 1 - r][c]);
  const broken = new Set(), key = (c, r) => c + "," + r, doors = [], plates = [], targets = [], sparks = [], crates = [], foes = [], arrows = [], spikes = [], walls = new Map(), crystals = [];
  const grp = { plate: { 1: 0, 2: 0, 3: 0 }, timer: { 1: 0, 2: 0, 3: 0 } };
  let start = V(2, 4), exit = V(W - 3, 4);
  const tileMat = new THREE.MeshStandardMaterial({ map: stoneTexture(T.stone, "#2a2a30", 1, 1), roughness: 0.9 }), capMat = new THREE.MeshStandardMaterial({ map: grassTexture(T.grass, 1, 1), roughness: 1 });
  const solidT = [], capT = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = cell(c, r);
    if (ch === "#") { solidT.push([c, r]); if (cell(c, r + 1) !== "#" && cell(c, r + 1) !== "W") capT.push([c, r]); }
    else if (ch === "W") { const m = mesh(new THREE.BoxGeometry(1, 1, 2.2), 0x9a7a5a, { map: noiseTexture("#8a6a4a", 30, 1, 1), rough: 0.9 }); m.position.set(c + 0.5, r + 0.5, 0); const cr = mesh(new THREE.BoxGeometry(1.02, 0.06, 2.24), 0x3a2a1a); cr.position.y = 0.1; m.add(cr); scene.add(m); walls.set(key(c, r), m); }
    else if (DOORS[ch]) { const m = mesh(new THREE.BoxGeometry(0.9, 1, 1.6), [0, 0x4aa0ff, 0xff9a3a, 0xc060ff][DOORS[ch]], { rough: 0.4, metal: 0.4, emissive: [0, 0x2060c0, 0xc06010, 0x8030c0][DOORS[ch]], ei: 0.5 }); m.position.set(c + 0.5, r + 0.5, 0); scene.add(m); doors.push({ c, r, g: DOORS[ch], mesh: m, open: 0 }); }
    else if (ch in PLATES) { const m = mesh(new THREE.BoxGeometry(1.0, 0.18, 1.6), [0, 0x4aa0ff, 0xff9a3a, 0xc060ff][PLATES[ch]], { emissive: [0, 0x2060c0, 0xc06010, 0x8030c0][PLATES[ch]], ei: 0.8 }); m.position.set(c + 0.5, r + 0.09, 0); scene.add(m); plates.push({ x: c + 0.5, y: r + 0.15, w: 0.9, h: 0.3, g: PLATES[ch], mesh: m, down: 0 }); }
    else if (ch in TARGETS) { const m = new THREE.Group(); const d = glowMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20), [0, 0x4aa0ff, 0xff9a3a, 0xc060ff][TARGETS[ch]], 1.4); d.rotation.x = Math.PI / 2; m.add(d); const rg = mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 20), 0xffffff, { emissive: 0xffffff, ei: 0.8 }); m.add(rg); m.position.set(c + 0.5, r + 0.5, 0.2); scene.add(m); targets.push({ x: c + 0.5, y: r + 0.5, w: 0.9, h: 0.9, g: TARGETS[ch], mesh: m, d }); }
    else if (ch === "^") { for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.ConeGeometry(0.17, 0.6, 5), 0xc8ccd8, { metal: 0.7, rough: 0.3 }); sp.position.set(c + 0.2 + i * 0.3, r + 0.3, 0); scene.add(sp); } spikes.push({ x: c + 0.5, y: r + 0.28, w: 0.9, h: 0.5 }); }
    else if (ch === "P") start = V(c + 0.5, r + 1);
    else if (ch === ">") exit = V(c + 0.5, r + 1);
    else if (ch === "o") { const m = glowMesh(new THREE.OctahedronGeometry(0.2), 0xffd24a, 2.4); m.position.set(c + 0.5, r + 0.6, 0); m.add(sprite(0xffd24a, 1.1, 0.5)); scene.add(m); sparks.push({ mesh: m, x: c + 0.5, y: r + 0.6, got: false }); }
    else if (ch === "h") { const m = glowMesh(new THREE.OctahedronGeometry(0.34), 0xff4a7a, 2.6); m.scale.y = 1.4; m.position.set(c + 0.5, r + 0.7, 0); m.add(sprite(0xff6a9a, 2.0, 0.6)); scene.add(m); crystals.push({ mesh: m, x: c + 0.5, y: r + 0.7, got: false }); }
    else if (ch === "C") makeCrate(c + 0.5, r + 0.5, false);
    else if (ch === "e" || ch === "s") makeFoe(ch === "s", c + 0.5, r + 0.6);
  }
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 2.4), tileMat, Math.max(1, solidT.length)), caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.22, 2.44), capMat, Math.max(1, capT.length)), mt = new THREE.Matrix4();
  solidT.forEach(([c, r], i) => { mt.makeTranslation(c + 0.5, r + 0.5, 0); tiles.setMatrixAt(i, mt); }); capT.forEach(([c, r], i) => { mt.makeTranslation(c + 0.5, r + 0.89, 0); caps.setMatrixAt(i, mt); }); tiles.castShadow = tiles.receiveShadow = caps.receiveShadow = true; scene.add(tiles, caps);
  // background: hills, trees, back wall
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.fog).multiplyScalar(0.72), fog: true })); back.position.set(W / 2, 10, -40); scene.add(back);
  for (let i = 0; i < 9; i++) { const hl = new THREE.Mesh(new THREE.SphereGeometry(rnd(14, 26), 16, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(T.tree).multiplyScalar(0.6), roughness: 1 })); hl.position.set((i / 8) * (W + 40) - 20, -6, -rnd(26, 34)); hl.scale.y = 0.7; scene.add(hl); }
  const treeN = Math.floor(W * 0.9), trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 5, 7), new THREE.MeshStandardMaterial({ color: T.tree, roughness: 1 }), treeN), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.28, 2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }), treeN);
  for (let i = 0; i < treeN; i++) { const s = rnd(0.8, 1.9), x = rnd(-6, W + 6), z = -rnd(5, 18); mt.compose(V(x, 2 + 3.4 * s * 0.5 + 0.6, z), new THREE.Quaternion(), V(s, s, s)); trees.setMatrixAt(i, mt); mt.compose(V(x, 2 + s * 0.4, z), new THREE.Quaternion(), V(s, s, s)); trunks.setMatrixAt(i, mt); } scene.add(trees, trunks);

  // ---------- bodies ----------
  function makeCrate(x, y, conj) {
    const g = new THREE.Group(), b = mesh(new THREE.BoxGeometry(1, 1, 1), conj ? 0x6fe0ff : 0xa8844a, conj ? { map: null, opacity: 0.75, emissive: 0x2aa0d0, ei: 0.8, rough: 0.2 } : { map: noiseTexture("#a07a42", 30, 1, 1), rough: 0.9 }); g.add(b);
    if (!conj) { const bd = mesh(new THREE.BoxGeometry(1.04, 0.1, 1.04), 0x5a3a1a); const bd2 = bd.clone(); bd.position.y = 0.45; bd2.position.y = -0.45; g.add(bd, bd2); } else g.add(sprite(0x6fe0ff, 2.2, 0.4));
    g.position.set(x, y, 0); scene.add(g); const c = { kind: "crate", x, y, w: 1, h: 1, vx: 0, vy: 0, mesh: g, conj, held: false, ground: false }; crates.push(c); return c;
  }
  function makeFoe(shooter, x, y) {
    const g = new THREE.Group(), col = shooter ? 0x4a5a8a : 0x8a3a2a, b = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.8, 8), col, { rough: 0.6 }); b.position.y = 0.1; g.add(b);
    const hd = mesh(new THREE.SphereGeometry(0.25, 10, 8), shooter ? 0x2a3040 : 0xc8b090, { rough: 0.6 }); hd.position.y = 0.7; g.add(hd); const ey = glowMesh(new THREE.BoxGeometry(0.1, 0.07, 0.36), 0xff3a2a, 3); ey.position.set(0.18, 0.74, 0); g.add(ey);
    if (shooter) { const bw = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), 0x2a2020); bw.position.set(0.3, 0.2, 0); g.add(bw); } else { const sp = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), 0x6a4a2a); sp.position.set(0.3, 0.2, 0.2); g.add(sp); const tip = mesh(new THREE.ConeGeometry(0.07, 0.2, 5), 0xd0d4dc, { metal: 0.8 }); tip.position.y = 0.7; sp.add(tip); }
    g.position.set(x, y, 0); scene.add(g); foes.push({ kind: shooter ? "shooter" : "walker", x, y, w: 0.8, h: 1.2, vx: shooter ? 0 : -1.5, vy: 0, hp: shooter ? 36 : 30, max: shooter ? 36 : 30, mesh: g, dir: -1, cd: rnd(1, 2), hit: 0, dead: false, ground: false });
  }
  const heroes = HEROES.map((d, i) => { const m = makeHero(d); scene.add(m); return { ...d, i, x: start.x - 1 + i * 0.7, y: start.y, vx: 0, vy: 0, hp: d.hp * (1 + (power - 1) * 0.08), max: d.hp * (1 + (power - 1) * 0.08), alive: true, face: 1, mesh: m, ground: false, coyote: 0, swing: 0, swingHit: false, shield: false, charge: 0, cd: 0, hurt: 0, walk: 0, held: null, glide: false, pushing: false }; });
  let active = 0; const dmgMul = 1 + (power - 1) * 0.08;
  const st = { phase: "intro", t: 0, time: 0, msg: "", over: false, endT: 0, toast: "", toastT: 0, sparks: 0, deaths: 0 };
  const say = (t, d = 1.5) => { st.toast = t; st.toastT = d; };
  const lifts = L.lifts.map((l) => { const m = mesh(new THREE.BoxGeometry(l.w, 0.5, 1.7), 0x7a7e8a, { metal: 0.6, rough: 0.4 }); const gl = glowMesh(new THREE.BoxGeometry(l.w * 0.9, 0.06, 1.74), 0xffd24a, 1.0); gl.position.y = 0.2; m.add(gl); scene.add(m); return { ...l, x: l.x0, y: l.y0 - 0.25, w: l.w, h: 0.5, mesh: m, dir: 1, dx: 0, dy: 0 }; });
  const reticle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false })); reticle.position.z = 0.6; scene.add(reticle);
  const dots = Array.from({ length: 14 }, () => { const d = sprite(0xfff0a0, 0.28, 0.8); d.visible = false; scene.add(d); return d; });
  const cam = { x: start.x, y: start.y + 2 }, cur = V();

  // ---------- collision ----------
  const live = () => (heroes[active] && heroes[active].alive ? [heroes[active]] : []);
  const doorClosed = (d) => !(grp.plate[d.g] > 0 || grp.timer[d.g] > 0);
  function gather(b, o = {}) {
    const out = [], x0 = Math.floor(b.x - b.w / 2 - 0.02), x1 = Math.floor(b.x + b.w / 2 + 0.02), y0 = Math.floor(b.y - b.h / 2 - 0.02), y1 = Math.floor(b.y + b.h / 2 + 0.02);
    for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) { const ch = cell(c, r); if (ch === "#" || (ch === "W" && !broken.has(key(c, r)))) out.push({ x: c + 0.5, y: r + 0.5, w: 1, h: 1, k: "t" }); }
    for (const d of doors) if (doorClosed(d) && d.c >= x0 && d.c <= x1 && d.r >= y0 && d.r <= y1) out.push({ x: d.c + 0.5, y: d.r + 0.5, w: 0.9, h: 1, k: "t" });
    for (const l of lifts) out.push({ x: l.x, y: l.y, w: l.w, h: l.h, k: "l", l });
    if (o.crates !== false) for (const c of crates) if (c !== b) out.push({ x: c.x, y: c.y, w: c.w, h: c.h, k: "c", c });
    if (o.heroes) for (const h of live()) if (h !== b) out.push({ x: h.x, y: h.y, w: h.w, h: h.h, k: "h" });
    return out;
  }
  function pushCrate(c, dx, depth = 0) {
    c.x += dx; for (const s of gather(c)) { if (!ov(c, s)) continue; if (s.k === "c" && depth < 3 && pushCrate(s.c, dx, depth + 1)) continue; c.x -= dx; return false; } return true;
  }
  function moveX(b, dx) {
    if (!dx) return false; b.x += dx; let hit = false; b.pushing = false;
    for (const s of gather(b, { heroes: b.kind === "crate" && b.held })) { if (!ov(b, s)) continue; if (b.i !== undefined && s.k === "c" && Math.abs(dx) > 1e-5) { if (pushCrate(s.c, dx * 0.85)) { b.pushing = true; const left = ov(b, s) ? (dx > 0 ? b.x + b.w / 2 - (s.c.x - s.c.w / 2) : (s.c.x + s.c.w / 2) - (b.x - b.w / 2)) : 0; if (left > 0) b.x += dx > 0 ? -left : left; continue; } } hit = true; b.x = dx > 0 ? s.x - s.w / 2 - b.w / 2 : s.x + s.w / 2 + b.w / 2; }
    if (hit) b.vx = 0; return hit;
  }
  function moveY(b, dy) {
    b.y += dy; b.ground = false;
    for (const s of gather(b, { heroes: b.kind === "crate" && (b.vy < 0 || b.held) })) { if (!ov(b, s)) continue; if (dy <= 0) { b.y = s.y + s.h / 2 + b.h / 2; b.ground = true; if (b.vy < -14 && b.kind !== "crate") b.landed = -b.vy; } else b.y = s.y - s.h / 2 - b.h / 2; b.vy = 0; }
  }
  function phys(b, dt, g = 1) { b.vy = Math.max(-26, b.vy - GRAV * g * dt); moveX(b, b.vx * dt); moveY(b, b.vy * dt); }

  // ---------- helpers ----------
  const cursor = () => { const v = V(mouse.x * 2 - 1, -(mouse.y * 2 - 1), 0.5).unproject(camera), d = v.sub(camera.position).normalize(); const t = -camera.position.z / d.z; return cur.copy(camera.position).addScaledVector(d, t); };
  function fireArrow(x, y, vx, vy, team, dmg, life = 3) { const m = new THREE.Group(); const sh = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), team === "h" ? 0xe0d0a0 : 0xff6a4a, { rough: 0.5, cast: false }); sh.rotation.z = Math.PI / 2; m.add(sh); const tp = mesh(new THREE.ConeGeometry(0.07, 0.2, 5), 0xd8dce8, { metal: 0.8, cast: false }); tp.rotation.z = -Math.PI / 2; tp.position.x = 0.5; m.add(tp); if (team === "e") m.add(sprite(0xff5a3a, 0.9, 0.7)); m.position.set(x, y, 0); scene.add(m); arrows.push({ x, y, vx, vy, team, dmg, life, mesh: m, w: 0.3, h: 0.3 }); }
  function hurtHero(h, d, fromX, kb = 4) {
    if (!h.alive || h.hurt > 0 || st.phase !== "play") return false; const dir = Math.sign(h.x - fromX) || 1;
    if (h.key === "warden" && h.shield && Math.sign(fromX - h.x) === h.face) { sound.play("clang"); fx.burst(V(h.x + h.face * 0.6, h.y, 0.3), 0xffe0a0, 8, 4, 0.3, 0.6, 0); h.vx -= h.face * 2; return false; }
    h.hp -= d; h.hurt = 0.7; h.vx = dir * kb; h.vy = Math.max(h.vy, 5); sound.play("hurt"); rig.shake = 0.4; fx.burst(V(h.x, h.y, 0.3), 0xff5a4a, 8, 4, 0.4, 0.7, 4);
    if (h.hp <= 0) killHero(h); return true;
  }
  function killHero(h) {
    if (!h.alive) return; h.alive = false; h.hp = 0; h.mesh.visible = false; st.deaths++; fx.burst(V(h.x, h.y, 0.3), h.accent, 24, 7, 0.9, 1.2, 3); sound.play("lose"); say(`${h.name} has fallen!`, 2);
    if (heroes.filter((q) => q.alive).length === 0) { st.phase = "lost"; st.msg = "ALL HEROES FELL"; return; } if (heroes[active] === h) switchTo(heroes.findIndex((q) => q.alive), h);
  }
  function switchTo(i, from) { if (i < 0 || !heroes[i] || !heroes[i].alive || (!from && i === active)) return; const o = from || heroes[active]; const nh = heroes[i]; nh.x = o.x; nh.y = o.y - o.h / 2 + nh.h / 2 + 0.03; nh.vx = o.vx; nh.vy = o.vy; nh.face = o.face; nh.hurt = 0.4; o.charge = 0; o.shield = false; if (o.held) { o.held.held = false; o.held = null; } o.swing = 0; active = i; nh.mesh.visible = true; fx.ring(V(heroes[i].x, heroes[i].y, 0.3), heroes[i].accent, 20, 3, 0.4, 0.8, 0); sound.play("pick"); }
  function hurtFoe(f, d, dir, kb = 5) { if (f.dead) return; f.hp -= d; f.hit = 0.2; f.vx = dir * kb; f.vy = 4; sound.play("hit"); fx.burst(V(f.x, f.y, 0.3), 0xffc080, 8, 4, 0.4, 0.7, 3); if (f.hp <= 0) { f.dead = true; f.mesh.visible = false; fx.burst(V(f.x, f.y, 0.3), 0xffa040, 20, 6, 0.7, 1.1, 3); sound.play("boom"); } }

  // ---------- hero control ----------
  function control(h, dt) {
    const k = (c) => keys.has(c), ax = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0), cp = cursor(); h.cd = Math.max(0, h.cd - dt);
    const busy = h.shield || (h.key === "archer" && h.charge > 0);
    let sp = h.speed * (h.shield ? 0.45 : 1) * (h.pushing ? 0.6 : 1) * (h.key === "archer" && h.charge > 0 ? 0.6 : 1); h.vx = lerp(h.vx, ax * sp, Math.min(1, dt * (h.ground ? 14 : 6)));
    if (ax) h.face = ax; if (h.key === "archer" && h.charge > 0) h.face = Math.sign(cp.x - h.x) || h.face;
    h.coyote = h.ground ? 0.1 : h.coyote - dt; if ((pressed.has("Space") || pressed.has("KeyW") || pressed.has("ArrowUp")) && h.coyote > 0) { h.vy = h.jump; h.coyote = 0; h.ground = false; sound.play("jump"); }
    h.glide = h.key === "archer" && (k("Space") || k("KeyW")) && h.vy < -1 && !h.ground; if (h.glide) h.vy = Math.max(h.vy, -2.4);
    if (h.key === "warden") {
      h.shield = mouse.right && h.swing <= 0; if (mouse.clickL && h.swing <= 0 && !h.shield) { h.swing = 0.3; h.swingHit = false; sound.play("whoosh"); h.face = Math.sign(cp.x - h.x) || h.face; }
      if (h.swing > 0) { h.swing -= dt; if (!h.swingHit && h.swing < 0.18) { h.swingHit = true; let hitAny = false; for (const f of foes) if (!f.dead && Math.abs(f.y - h.y) < 1.1 && (f.x - h.x) * h.face > -0.2 && (f.x - h.x) * h.face < 2.1) { hurtFoe(f, 20 * dmgMul, h.face, 7); hitAny = true; }
        for (let i = 1; i <= 2; i++) { const c = Math.floor(h.x + h.face * (0.6 + i * 0.7)), r = Math.floor(h.y); for (const rr of [r - 1, r, r + 1]) if (cell(c, rr) === "W" && !broken.has(key(c, rr))) { broken.add(key(c, rr)); const m = walls.get(key(c, rr)); if (m) { scene.remove(m); fx.burst(V(c + 0.5, rr + 0.5, 0.5), 0xc8a070, 24, 6, 0.8, 1, 5); sound.play("boom"); rig.shake = 0.5; hitAny = true; } } }
        for (const c of crates) if (Math.abs(c.y - h.y) < 1 && (c.x - h.x) * h.face > 0 && (c.x - h.x) * h.face < 1.9) { pushCrate(c, h.face * 0.6); hitAny = true; }
        if (hitAny) rig.shake = Math.max(rig.shake, 0.2); } }
    } else if (h.key === "wisp") {
      if (mouse.clickL && !mouse.right) { const mc = { x: cp.x, y: cp.y, w: 1, h: 1 }; const dist = Math.hypot(cp.x - h.x, cp.y - h.y); const free = !gather(mc).some((s) => s.k !== "h" && ov(mc, s)) && !heroes.some((q) => q.alive && ov(mc, { x: q.x, y: q.y, w: q.w, h: q.h })); if (dist <= 11 && free) { const conj = crates.filter((c) => c.conj); if (conj.length >= 3) { const o = conj[0]; scene.remove(o.mesh); crates.splice(crates.indexOf(o), 1); fx.burst(V(o.x, o.y, 0.3), 0x6fe0ff, 10, 3, 0.4, 0.6, 0); } makeCrate(cp.x, cp.y, true); fx.burst(V(cp.x, cp.y, 0.3), 0x6fe0ff, 16, 4, 0.5, 0.8, 0); sound.play("cast"); } else if (dist > 11) say("Too far away", 0.8); }
      if (mouse.right) { if (!h.held) { let b = null, bd = 1.4; for (const c of crates) { const d = Math.hypot(c.x - cp.x, c.y - cp.y); if (d < bd && Math.hypot(c.x - h.x, c.y - h.y) < 12) { bd = d; b = c; } } if (b) { h.held = b; b.held = true; sound.play("ward"); } } if (h.held) { const c = h.held, dx = cp.x - h.x, dy = cp.y - h.y, dl = Math.hypot(dx, dy), k2 = dl > 11 ? 11 / dl : 1, tx = h.x + dx * k2, ty = h.y + dy * k2; c.vx = clamp((tx - c.x) * 9, -16, 16); c.vy = clamp((ty - c.y) * 9, -16, 16); moveX(c, c.vx * dt); moveY(c, c.vy * dt); if (Math.random() < 0.3) fx.spark(V(c.x, c.y, 0.5), 0x6fe0ff, 0.5, 0.3, 1); } }
      else if (h.held) { h.held.held = false; h.held = null; }
    } else {
      if (mouse.left && h.cd <= 0) { h.charge = Math.min(1, h.charge + dt / 0.7); } else if (h.charge > 0 && !mouse.left) { const q = Math.max(0.25, h.charge), dx = cp.x - h.x, dy = cp.y - (h.y + 0.3), dl = Math.hypot(dx, dy) || 1, spd = 13 + 20 * q; fireArrow(h.x + (dx / dl) * 0.6, h.y + 0.3 + (dy / dl) * 0.6, (dx / dl) * spd, (dy / dl) * spd, "h", (10 + 16 * q) * dmgMul); h.charge = 0; h.cd = 0.25; sound.play("laser"); h.face = Math.sign(dx) || h.face; }
      else if (!mouse.left) h.charge = 0;
    }
  }

  // ---------- update ----------
  function update(dt) {
    const play = st.phase === "play";
    for (const k of [1, 2, 3]) { grp.timer[k] = Math.max(0, grp.timer[k] - dt); grp.plate[k] = 0; }
    const bodies = [...live(), ...crates];
    for (const p of plates) { p.pressed = bodies.some((b) => ov({ x: b.x, y: b.y, w: b.w * 0.9, h: b.h }, p)); if (p.pressed) grp.plate[p.g]++; p.down = lerp(p.down, p.pressed ? 1 : 0, Math.min(1, dt * 12)); p.mesh.position.y = 0.09 - p.down * 0.06; }
    // lifts
    for (const l of lifts) {
      const riders = [...live(), ...crates, ...foes.filter((f) => !f.dead)].filter((b) => Math.abs(b.y - b.h / 2 - (l.y + l.h / 2)) < 0.14 && Math.abs(b.x - l.x) < l.w / 2 + b.w / 2 - 0.05);
      let tx, ty; if (l.plate) { const on = grp.plate[l.plate] > 0; tx = on ? l.x1 : l.x0; ty = (on ? l.y1 : l.y0) - 0.25; } else { const goEnd = l.dir > 0; tx = goEnd ? l.x1 : l.x0; ty = (goEnd ? l.y1 : l.y0) - 0.25; if (Math.hypot(tx - l.x, ty - l.y) < 0.05) l.dir *= -1; }
      const dx = tx - l.x, dy = ty - l.y, dl = Math.hypot(dx, dy), stp = Math.min(dl, l.speed * dt); l.dx = dl > 1e-4 ? (dx / dl) * stp : 0; l.dy = dl > 1e-4 ? (dy / dl) * stp : 0; l.x += l.dx; l.y += l.dy; l.mesh.position.set(l.x, l.y, 0);
      for (const b of riders) { if (b.held) continue; if (l.dy > 0) { b.y += l.dy; moveY(b, 0); } else { b.y += l.dy; } moveX(b, l.dx); if (b.vy < 0) { b.vy = 0; b.ground = true; } }
    }
    // heroes
    for (const h of heroes) {
      if (h !== heroes[active]) { h.mesh.visible = false; continue; } if (!h.alive) continue; h.hurt = Math.max(0, h.hurt - dt); h.landed = 0;
      if (h === heroes[active] && play) control(h, dt); else { h.vx = lerp(h.vx, 0, Math.min(1, dt * 10)); h.shield = false; h.charge = 0; }
      phys(h, dt, h.glide ? 1 : 1); if (h.y < -4) killHero(h); if (h.landed > 20) hurtHero(h, (h.landed - 20) * 5, h.x, 0);
      for (const s of spikes) if (h.alive && ov(h, s)) { h.hurt = 0; hurtHero(h, 999, h.x, 0); }
      if (h === heroes[active] && play) {
        for (const s of sparks) if (!s.got && Math.hypot(s.x - h.x, s.y - h.y) < 0.95) { s.got = true; s.mesh.visible = false; st.sparks++; sound.play("ring"); fx.burst(V(s.x, s.y, 0.3), 0xffd24a, 8, 3, 0.4, 0.6, 0); }
        for (const s of crystals) if (!s.got && Math.hypot(s.x - h.x, s.y - h.y) < 1.1) { s.got = true; s.mesh.visible = false; for (const q of heroes) { if (!q.alive) { q.alive = true; q.hp = q.max * 0.6; q.vx = q.vy = 0; } else q.hp = Math.min(q.max, q.hp + q.max * 0.5); } sound.play("win"); say("Life crystal! Everyone is healed", 2); fx.burst(V(s.x, s.y, 0.3), 0xff6a9a, 24, 6, 0.8, 1.2, -1); }
        if (Math.hypot(exit.x - h.x, exit.y - 0.2 - h.y) < 1.2) { st.phase = "won"; st.msg = "LEVEL CLEAR!"; sound.play("win"); fx.burst(V(exit.x, exit.y, 0.5), 0xffe080, 40, 8, 1.2, 1.4, -1); }
      }
    }
    // crates
    for (const c of crates) { if (c.held) continue; c.vx *= Math.pow(0.002, dt); phys(c, dt); if (c.y < -4) c.dead = true; }
    for (let i = crates.length - 1; i >= 0; i--) if (crates[i].dead) { scene.remove(crates[i].mesh); crates.splice(i, 1); }
    // foes
    for (const f of foes) {
      if (f.dead) continue; f.hit = Math.max(0, f.hit - dt); f.cd -= dt; const tg = live()[0];
      if (f.kind === "walker") { if (f.hit <= 0) { f.vx = lerp(f.vx, f.dir * 1.7, Math.min(1, dt * 8)); } const ahead = cell(Math.floor(f.x + f.dir * 0.6), Math.floor(f.y - 0.8)); phys(f, dt); if (f.ground && f.hit <= 0 && (ahead !== "#" && ahead !== "W" || Math.abs(f.vx) < 0.2)) { f.dir *= -1; f.vx = f.dir * 1.7; } if (tg && Math.abs(tg.x - f.x) < 5 && Math.abs(tg.y - f.y) < 1.5 && f.hit <= 0) { f.dir = Math.sign(tg.x - f.x) || f.dir; }
        for (const h of live()) if (ov(h, f) && f.cd <= 0) { f.cd = 0.9; hurtHero(h, 14, f.x, 5); } }
      else { phys(f, dt); if (tg) f.dir = Math.sign(tg.x - f.x) || f.dir; if (tg && st.phase === "play" && Math.abs(tg.x - f.x) < 13 && Math.abs(tg.y - f.y) < 5 && f.cd <= 0) { f.cd = 2.4; const dx = tg.x - f.x, dy = tg.y - f.y, dl = Math.hypot(dx, dy); fireArrow(f.x + f.dir * 0.5, f.y + 0.2, (dx / dl) * 15, (dy / dl) * 15, "e", 16, 2.5); sound.play("zap"); } }
      for (const c of crates) if (c.vy < -3 && Math.abs(c.x - f.x) < 0.9 && c.y - f.y < 1.2 && c.y > f.y && Math.abs(c.x - f.x) < (c.w + f.w) / 2) hurtFoe(f, 60, 0, 0);
      if (f.y < -4) f.dead = true, f.mesh.visible = false;
    }
    // arrows
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i]; if (a.team === "h") a.vy -= 14 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt; let dead = a.life <= 0;
      if (!dead) { const bx = { x: a.x, y: a.y, w: 0.3, h: 0.3 }; if (gather(bx, { crates: true }).some((s) => ov(bx, s) && s.k !== "h")) { dead = true; fx.spark(V(a.x, a.y, 0.4), 0xffe0a0, 0.5, 0.2, 1); }
        if (a.team === "h") { for (const f of foes) if (!f.dead && ov(bx, f)) { hurtFoe(f, a.dmg, Math.sign(a.vx), 4); dead = true; } for (const t of targets) if (ov(bx, t)) { grp.timer[t.g] = 12; dead = true; sound.play("ring"); say("Target hit!", 1); fx.burst(V(t.x, t.y, 0.5), 0xffffff, 12, 4, 0.5, 0.8, 0); } }
        else for (const h of live()) if (ov(bx, h)) { if (hurtHero(h, a.dmg, a.x - Math.sign(a.vx) * 1, 3) || (h.key === "warden" && h.shield)) dead = true; } }
      a.mesh.position.set(a.x, a.y, 0); a.mesh.rotation.z = Math.atan2(a.vy, a.vx); if (dead) { scene.remove(a.mesh); arrows.splice(i, 1); }
    }
  }
  function visuals(dt, t) {
    for (const d of doors) { d.open = lerp(d.open, doorClosed(d) ? 0 : 1, Math.min(1, dt * 8)); d.mesh.scale.y = 1 - d.open * 0.92; d.mesh.position.y = d.r + 0.5 - d.open * 0.46 + (d.open > 0.5 ? 0 : 0); d.mesh.material.emissiveIntensity = doorClosed(d) ? 0.5 : 0.1; }
    for (const tg of targets) { const on = grp.timer[tg.g] > 0; tg.d.material.emissiveIntensity = on ? 0.2 : 1.4 + Math.sin(t * 5) * 0.5; tg.mesh.rotation.z = t * (on ? 0 : 0.8); }
    for (const s of sparks) if (!s.got) { s.mesh.rotation.y = t * 3; s.mesh.position.y = s.y + Math.sin(t * 3 + s.x) * 0.08; } for (const s of crystals) if (!s.got) { s.mesh.rotation.y = t * 2; s.mesh.position.y = s.y + Math.sin(t * 2) * 0.1; }
    for (const c of crates) { c.mesh.position.set(c.x, c.y, 0); if (c.conj) c.mesh.children[0].material.opacity = 0.65 + Math.sin(t * 4 + c.x) * 0.1; }
    for (const f of foes) if (!f.dead) { f.mesh.position.set(f.x, f.y - 0.35, 0); f.mesh.rotation.y = f.dir > 0 ? 0 : Math.PI; f.mesh.scale.setScalar(f.hit > 0 ? 1.1 : 1); }
    const act = heroes[active];
    for (const h of heroes) {
      if (!h.alive || h !== act) continue; const u = h.mesh.userData, m = h.mesh; m.position.set(h.x, h.y - h.h / 2 + 0.7, 0); m.rotation.y = h.face > 0 ? Math.PI / 2 : -Math.PI / 2; m.visible = !(h.hurt > 0 && Math.floor(t * 20) % 2 === 0);
      const sp = Math.abs(h.vx); h.walk += sp * dt * 1.5; const sw = Math.sin(h.walk * 2) * clamp(sp / 4, 0, 1) * (h.ground ? 1 : 0.2);
      u.legs[0].rotation.z = sw * 0.8; u.legs[1].rotation.z = -sw * 0.8; u.arms[0].rotation.z = -sw * 0.6; u.arms[1].rotation.z = sw * 0.6; u.legs[0].rotation.z += (h.ground ? 0 : 0.5); u.legs[1].rotation.z -= (h.ground ? 0 : 0.3);
      if (h.key === "warden") { if (h.swing > 0) { const p = 1 - h.swing / 0.3; u.arms[1].rotation.z = -2.6 + p * 3.0; } else u.arms[1].rotation.z = -0.4 + sw * 0.4; u.shield.visible = h.shield; u.arms[0].rotation.z = h.shield ? -1.4 : u.arms[0].rotation.z; }
      if (h.key === "wisp") { u.orb.material.emissiveIntensity = 3 + Math.sin(t * 6) * 1.2; if (h === act && mouse.right) u.arms[1].rotation.z = -2.4; }
      if (h.key === "archer") { u.arms[0].rotation.z = h.charge > 0 ? -1.6 : u.arms[0].rotation.z; if (h.glide) { u.arms[0].rotation.z = u.arms[1].rotation.z = -2.8; } }
      m.scale.set(1, 1, 1); u.body.position.y = 0; if (!h.ground && !h.glide) u.body.rotation.z = 0;
    }
    // camera + reticle + aim
    const tx = clamp(act.x, 11, W - 11), ty = clamp(act.y + 1.6, 6.2, 12); cam.x = lerp(cam.x, tx, Math.min(1, dt * 4)); cam.y = lerp(cam.y, ty, Math.min(1, dt * 3));
    camera.position.set(cam.x, cam.y + 1.0, 17.5); camera.lookAt(cam.x + 0.8, cam.y - 0.6, 0); camera.fov = 48; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    sun.position.set(cam.x - 18, 30, 22); sun.target.position.set(cam.x, cam.y, 0);
    const cp = cursor(); reticle.position.set(cp.x, cp.y, 0.6); reticle.visible = st.phase === "play" && act.key !== "warden"; reticle.material.color.setHex(act.accent);
    dots.forEach((d) => (d.visible = false)); if (act.key === "archer" && act.charge > 0 && st.phase === "play") { const q = Math.max(0.25, act.charge), dx = cp.x - act.x, dy = cp.y - (act.y + 0.3), dl = Math.hypot(dx, dy) || 1, spd = 13 + 20 * q; let x = act.x, y = act.y + 0.3, vx = (dx / dl) * spd, vy = (dy / dl) * spd; dots.forEach((d, i) => { for (let k = 0; k < 2; k++) { vy -= 14 * 0.035; x += vx * 0.035; y += vy * 0.035; } d.position.set(x, y, 0.4); d.visible = true; d.material.opacity = 1 - i / 16; }); }
  }
  const api = {
    level: L, st, debug: { heroes, crates, foes, arrows, grp, doors, plates, targets, sparks, lifts, exit, get active() { return active; }, switchTo, cell, broken, T },
    update(dt, t) {
      if (st.phase === "intro") { st.t += dt; st.msg = st.t < 1.4 ? L.name.toUpperCase() : "GO!"; if (st.t > 2) { st.phase = "play"; st.msg = ""; } } else if (st.phase === "play") st.time += dt;
      st.toastT = Math.max(0, st.toastT - dt);
      if (st.phase === "play") { if (pressed.has("Digit1")) switchTo(0); if (pressed.has("Digit2")) switchTo(1); if (pressed.has("Digit3")) switchTo(2); if (pressed.has("Tab")) { for (let k = 1; k <= 3; k++) { const j = (active + k) % 3; if (heroes[j].alive) { switchTo(j); break; } } } }
      update(dt); visuals(dt, t);
      if ((st.phase === "won" || st.phase === "lost") && !st.over) { st.endT += dt; if (st.endT > 2.6) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, sparks: st.sparks, total: sparks.length, deaths: st.deaths, hp: heroes.reduce((a, h) => a + h.hp, 0) }); } }
    },
    snapshot() { return { kind: "tf", phase: st.phase, title: L.name, time: st.time, sparks: st.sparks, total: sparks.length, heroes: heroes.map((h, i) => ({ name: h.name, hp: h.hp, max: h.max, alive: h.alive, active: i === active, color: "#" + h.accent.toString(16).padStart(6, "0") })), toast: st.toastT > 0 ? st.toast : "", msg: st.msg, tip: st.phase === "intro" || st.time < 10 ? L.tip : "", conj: crates.filter((c) => c.conj).length, hero: heroes[active].key, charge: heroes[active].charge }; },
    dispose() { camera.up.set(0, 1, 0); },
  };
  return api;
}
