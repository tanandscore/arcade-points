// Draws the Wrath of Olympus world: hills, water, forests, buildings, soldiers, fog of war and effects.
// It only *reads* the simulation (sim.js); it never changes game rules.
import * as THREE from "three";
import { N, UNITS, BUILDINGS, PLAYER_COLORS } from "./defs";
import { T_GRASS, T_DIRT, T_SAND, T_WATER, T_ROCK } from "./mapgen";
import { makeUnit, animateUnit, makeNode, makeBuilding, mat, M, teamMat } from "./models";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { groundDetail } from "./textures";
import { KINDS2, makeUnit2, makePoi, makeRelic, animatePoi } from "./models2";

const AZ = -Math.PI / 4, EL = 0.86;
const hash2 = (x, z, s = 0) => { let h = (x * 374761393 + z * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967295; };

function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}

class Particles {
  constructor(scene, max, size, color, additive, tex) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max); this.fade = new Float32Array(max * 3);
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, opacity: 1 });
    this.pts = new THREE.Points(this.geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5; scene.add(this.pts);
    this.baseCol = new THREE.Color(color); this.cur = 0;
    this.geo.setDrawRange(0, 0);
  }
  emit(x, y, z, vx, vy, vz, life, g = 0, col) {
    const i = this.n < this.max ? this.n++ : (this.cur = (this.cur + 1) % this.max);
    const c = col ? new THREE.Color(col) : this.baseCol;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.maxLife[i] = life; this.grav[i] = g; this.fade[i * 3] = c.r; this.fade[i * 3 + 1] = c.g; this.fade[i * 3 + 2] = c.b;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; this.pos[i * 3 + 1] = -50; continue; }
      this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt; this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const a = this.mat.blending === THREE.AdditiveBlending ? k : Math.min(1, k * 1.6);
      this.col[i * 3] = this.fade[i * 3] * a; this.col[i * 3 + 1] = this.fade[i * 3 + 1] * a; this.col[i * 3 + 2] = this.fade[i * 3 + 2] * a;
    }
    this.geo.setDrawRange(0, this.n); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

export function createRenderer(mount, S, opts = {}) {
  const map = S.map;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const el = renderer.domElement; el.style.display = "block"; el.style.width = "100%"; el.style.height = "100%"; el.style.touchAction = "none";
  mount.appendChild(el);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec6d8);
  scene.fog = new THREE.Fog(0xa9cfdd, 90, 230);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 500);

  const hv = map.height, W1 = N + 1;
  const heightAt = (x, z) => {
    x = Math.max(0, Math.min(N - 0.001, x)); z = Math.max(0, Math.min(N - 0.001, z));
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const a = hv[iz * W1 + ix], b = hv[iz * W1 + ix + 1], c = hv[(iz + 1) * W1 + ix], d = hv[(iz + 1) * W1 + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  };
  const WATER_Y = -0.3;

  // ---- lights ------------------------------------------------------------------------------------
  let envTex = null; try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch {} // soft reflections, used only on metals so bronze and gold shine
  const shineMetals = (obj) => { if (!envTex) return; obj.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.metalness > 0.5 && m.envMap !== envTex) { m.envMap = envTex; m.envMapIntensity = 0.9; m.needsUpdate = true; } }); };
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x7a6a4a, 0.7));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const SUN_OFF = new THREE.Vector3(-26, 48, 16);

  // ---- terrain -----------------------------------------------------------------------------------
  const TC = { [T_GRASS]: new THREE.Color(0x7aa650), [T_DIRT]: new THREE.Color(0xa88a58), [T_SAND]: new THREE.Color(0xd5c493), [T_WATER]: new THREE.Color(0x3e7f94), [T_ROCK]: new THREE.Color(0x8a867c) };
  const grassB = new THREE.Color(0x5f8f3e), grassL = new THREE.Color(0x93bb5c), snow = new THREE.Color(0xe9eef0);
  const tAt = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? T_ROCK : map.terrain[z * N + x]);
  const vcol = (x, z) => {
    const c = new THREE.Color(0, 0, 0), ts = [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]];
    for (const [a, b] of ts) c.add(TC[tAt(a, b)]); c.multiplyScalar(0.25);
    const h = hv[z * W1 + x], j = hash2(x, z, 9);
    if (tAt(x, z) !== T_WATER || true) { const g = (Math.sin(x * 0.21) + Math.cos(z * 0.17) + Math.sin((x + z) * 0.09)) * 0.33; c.lerp(g > 0 ? grassL : grassB, Math.abs(g) * 0.25 * (tAt(x, z) === T_GRASS ? 1 : 0.3)); }
    c.multiplyScalar(0.9 + j * 0.2);
    if (h > 2.4) c.lerp(new THREE.Color(0x8d8a80), Math.min(1, (h - 2.4) / 1.5)); if (h > 5.2) c.lerp(snow, Math.min(1, (h - 5.2) / 1.8));
    if (h < 0.05) c.lerp(new THREE.Color(0x2e6a7e), Math.min(1, -h * 1.2));
    return c;
  };
  const colGrid = []; for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) colGrid[z * W1 + x] = vcol(Math.min(x, N), Math.min(z, N));
  const tri = N * N * 6, tp = new Float32Array(tri * 3), tc = new Float32Array(tri * 3), tn = new Float32Array(tri * 3), tuv = new Float32Array(tri * 2);
  const hAtG = (x, z) => hv[Math.max(0, Math.min(N, z)) * W1 + Math.max(0, Math.min(N, x))];
  let q = 0;
  const pushV = (x, z) => { const i = z * W1 + x; tp[q * 3] = x; tp[q * 3 + 1] = hv[i]; tp[q * 3 + 2] = z; { const nx = hAtG(x - 1, z) - hAtG(x + 1, z), nz = hAtG(x, z - 1) - hAtG(x, z + 1), l = Math.hypot(nx, 2, nz); tn[q * 3] = nx / l; tn[q * 3 + 1] = 2 / l; tn[q * 3 + 2] = nz / l; } tuv[q * 2] = x / 9; tuv[q * 2 + 1] = z / 9; tc[q * 3] = colGrid[i].r; tc[q * 3 + 1] = colGrid[i].g; tc[q * 3 + 2] = colGrid[i].b; q++; };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { pushV(x, z); pushV(x, z + 1); pushV(x + 1, z); pushV(x + 1, z); pushV(x, z + 1); pushV(x + 1, z + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(tp, 3)); tg.setAttribute("color", new THREE.BufferAttribute(tc, 3)); tg.setAttribute("normal", new THREE.BufferAttribute(tn, 3)); tg.setAttribute("uv", new THREE.BufferAttribute(tuv, 2));
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundDetail(), roughness: 0.95 }));
  terrain.receiveShadow = true; scene.add(terrain);

  // water (inside and far beyond the walls)
  const wc = document.createElement("canvas"); wc.width = wc.height = 128; { const g = wc.getContext("2d"); g.fillStyle = "#4a97b4"; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.18})`; g.lineWidth = 1 + Math.random() * 1.5; const x = Math.random() * 128, y = Math.random() * 128; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 16, y); g.stroke(); } }
  const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(N / 5, N / 5); wt.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(N * 1.3, N * 1.3), new THREE.MeshStandardMaterial({ map: wt, color: 0xffffff, transparent: true, opacity: 0.82, roughness: 0.18, metalness: 0.15 }));
  water.rotation.x = -Math.PI / 2; water.position.set(N / 2, WATER_Y, N / 2); scene.add(water);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x4a8ea6 })); sea.rotation.x = -Math.PI / 2; sea.position.set(N / 2, WATER_Y - 0.6, N / 2); scene.add(sea);

  // ---- scenery: instanced trees, tufts, pebbles ---------------------------------------------------
  const treeNodes = map.nodes.length ? S.nodes.filter((n) => n.kind === "tree") : [];
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 0.9, 5), mat("trunk", 0x6b4a2a), Math.max(1, treeNodes.length));
  // leafy crowns: a lumpy ball with smooth shading instead of a faceted gem
  const leafy = (r, seed) => { let g = new THREE.IcosahedronGeometry(r, 2); g.deleteAttribute("uv"); g.deleteAttribute("normal"); g = mergeVertices(g, 1e-3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.2 * Math.sin(x * 9 + seed) * Math.cos(z * 8 - seed) + 0.12 * Math.sin(y * 13 + seed * 2); p.setXYZ(i, x * n, y * n * 0.92, z * n); } g.computeVertexNormals(); return g; };
  const crownIM = new THREE.InstancedMesh(leafy(0.5, 1), mat("crownS", 0x7a9a40, { flatShading: false, roughness: 0.9 }), Math.max(1, treeNodes.length));
  const crown2IM = new THREE.InstancedMesh(leafy(0.34, 5), mat("crown2S", 0x8aa84c, { flatShading: false, roughness: 0.9 }), Math.max(1, treeNodes.length));
  for (const im of [trunkIM, crownIM, crown2IM]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); }
  const treeIdx = new Map(); const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler();
  const treeInfo = treeNodes.map((n, i) => { treeIdx.set(n.id, i); const r1 = hash2(n.ix, n.iz, 1), r2 = hash2(n.ix, n.iz, 2), r3 = hash2(n.ix, n.iz, 3); return { n, ox: (r1 - 0.5) * 0.6, oz: (r2 - 0.5) * 0.6, s: 0.85 + r3 * 0.6, ry: r1 * 6.28, last: -1 }; });
  const crownCol = new THREE.Color();
  function setTree(i, scaleK) {
    const t = treeInfo[i], x = t.n.x + t.ox, z = t.n.z + t.oz, y = heightAt(x, z), s = t.s * scaleK;
    tmpQ.setFromEuler(tmpE.set(0, t.ry, 0));
    tmpM.compose(tmpV.set(x, y + 0.45 * s, z), tmpQ, tmpS.set(s, s, s)); trunkIM.setMatrixAt(i, tmpM);
    tmpM.compose(tmpV.set(x, y + 1.15 * s, z), tmpQ, tmpS.set(s * 1.3, s * 1.15, s * 1.3)); crownIM.setMatrixAt(i, tmpM);
    tmpM.compose(tmpV.set(x + 0.12 * s, y + 1.65 * s, z - 0.05 * s), tmpQ, tmpS.set(s * 1.1, s * 1.0, s * 1.1)); crown2IM.setMatrixAt(i, tmpM);
    t.last = scaleK;
  }
  treeInfo.forEach((t, i) => { setTree(i, 1); crownCol.setHSL(0.24 + hash2(t.n.ix, t.n.iz, 5) * 0.06, 0.38, 0.32 + hash2(t.n.ix, t.n.iz, 6) * 0.1); crownIM.setColorAt(i, crownCol); crown2IM.setColorAt(i, crownCol.clone().offsetHSL(0, 0, 0.07)); });
  [trunkIM, crownIM, crown2IM].forEach((im) => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });

  {
    const tufts = []; for (let z = 4; z < N - 4; z++) for (let x = 4; x < N - 4; x++) { if (map.terrain[z * N + x] !== T_GRASS && map.terrain[z * N + x] !== T_DIRT) continue; if (S.occId[z * N + x]) continue; const r = hash2(x, z, 21); if (r < 0.2) tufts.push([x + hash2(x, z, 22), z + hash2(x, z, 23), r]); }
    const tuftIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.34, 4), mat("tuft", 0x6f9a3f), tufts.length || 1); tuftIM.receiveShadow = true;
    const flowIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 4, 3), mat("flower", 0xf4e27a), 220);
    let fi = 0; const col = new THREE.Color();
    tufts.forEach(([x, z, r], i) => { const y = heightAt(x, z), s = 0.7 + r * 3; tmpQ.setFromEuler(tmpE.set(0, r * 40, 0)); tmpM.compose(tmpV.set(x, y + 0.13 * s, z), tmpQ, tmpS.set(s, s, s)); tuftIM.setMatrixAt(i, tmpM); col.setHSL(0.22 + r * 0.1, 0.4, 0.3 + r * 0.5); tuftIM.setColorAt(i, col);
      if (r < 0.012 && fi < 220) { tmpM.compose(tmpV.set(x + 0.2, y + 0.18, z), tmpQ, tmpS.set(1, 1, 1)); flowIM.setMatrixAt(fi, tmpM); col.setHSL(r * 70 % 1, 0.8, 0.7); flowIM.setColorAt(fi, col); fi++; } });
    flowIM.count = fi; scene.add(tuftIM, flowIM);
  }

  // ---- fog of war ---------------------------------------------------------------------------------
  const fogData = new Uint8Array(N * N * 4); const fogA = new Float32Array(N * N).fill(1);
  const fogTex = new THREE.DataTexture(fogData, N, N, THREE.RGBAFormat); fogTex.magFilter = THREE.LinearFilter; fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true;
  fogTex.flipY = false;
  const fogMesh = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  fogMesh.rotation.x = -Math.PI / 2; fogMesh.position.set(N / 2, 1.2, N / 2); fogMesh.renderOrder = 100; scene.add(fogMesh);
  // plane with rotation.x=-PI/2: uv v=1 is -z... so flip texture rows by writing z reversed (see updateFog)
  for (let i = 0; i < N * N; i++) { fogData[i * 4] = 8; fogData[i * 4 + 1] = 10; fogData[i * 4 + 2] = 18; fogData[i * 4 + 3] = 255; }

  // ---- entity meshes ------------------------------------------------------------------------------
  const recs = new Map(); // id -> record
  const entRoot = new THREE.Group(); scene.add(entRoot);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxies = [];
  const barGeo = new THREE.PlaneGeometry(1, 1);
  const barBack = new THREE.MeshBasicMaterial({ color: 0x15110c, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
  const barGreen = new THREE.MeshBasicMaterial({ color: 0x59d04a, transparent: true, depthTest: false, depthWrite: false }), barYellow = new THREE.MeshBasicMaterial({ color: 0xe9c43a, transparent: true, depthTest: false, depthWrite: false }), barRed = new THREE.MeshBasicMaterial({ color: 0xe0452e, transparent: true, depthTest: false, depthWrite: false }), barBlue = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, depthTest: false, depthWrite: false });
  const ringMat = [new THREE.MeshBasicMaterial({ color: 0x66ff77, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide })];
  const circGeo = new THREE.RingGeometry(0.88, 1, 28), sqGeo = new THREE.RingGeometry(0.92, 1, 4, 1, Math.PI / 4);

  const heroRingGeo = new THREE.RingGeometry(0.85, 1, 32), heroRingMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  function addHeroRing(r) { const m = new THREE.Mesh(heroRingGeo, heroRingMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.scale.setScalar(r.e.radius * 2.1 + 0.25); m.renderOrder = 90; r.obj.add(m); r.heroRing = m; }
  const makePoiObj = (e) => (e.type === "relic" ? makeRelic(e.relic) : makePoi(e.poi, e.kind));
  function addPoiRec(e) {
    const r = { e, id: e.id, obj: makePoiObj(e), poi: true, shown: false, dead: false, deadT: 0 };
    r.obj.position.set(e.x, heightAt(e.x, e.z), e.z); r.obj.visible = false; entRoot.add(r.obj); recs.set(e.id, r); return r;
  }
  function addRec(e) {
    const r = { e, id: e.id, obj: null, P: null, shown: true, px: e.x, pz: e.z, pface: e.face || 0, dead: false, deadT: 0, bar: null, ring: null, ringKind: -1, lastHp: e.hp, fireT: Math.random() * 0.5 };
    if (e.type === "unit") { r.P = KINDS2.has(e.kind) ? makeUnit2(e.kind, e.owner) : makeUnit(e.kind, e.owner); r.obj = r.P.root; r.obj.scale.multiplyScalar(e.cls === "villager" ? 1.15 : 1.25); if (e.isHero) addHeroRing(r); }
    else if (e.type === "building") { r.obj = makeBuilding(e.kind, e.owner); }
    else { if (e.kind === "tree") return null; r.obj = makeNode(e.kind, e.id); }
    r.obj.position.set(e.x, heightAt(e.x, e.z), e.z);
    if (e.type === "building") { r.obj.position.set(e.x, Math.max(heightAt(e.x - 1, e.z - 1), heightAt(e.x + 1, e.z + 1), heightAt(e.x, e.z)) - 0.02, e.z); r.baseY = r.obj.position.y; }
    if (e.type === "node") { r.obj.position.set(e.ix, heightAt(e.x, e.z), e.iz); r.baseY = r.obj.position.y; }
    entRoot.add(r.obj); shineMetals(r.obj);
    // pick proxy
    const pw = e.type === "unit" ? 0.95 : e.w, ph = e.type === "unit" ? (e.kind === "horseman" ? 1.7 : 1.4) : e.type === "building" ? 2.4 : 1.3;
    const px = new THREE.Mesh(e.type === "unit" ? new THREE.CylinderGeometry(0.48, 0.48, ph, 8) : new THREE.BoxGeometry(pw, ph, pw), proxyMat); px.userData.rec = r; px.position.set(e.x, heightAt(e.x, e.z) + ph / 2, e.z); scene.add(px); r.proxy = px; proxies.push(px);
    recs.set(e.id, r); return r;
  }
  function removeRec(r) {
    recs.delete(r.id); entRoot.remove(r.obj); scene.remove(r.proxy); const i = proxies.indexOf(r.proxy); if (i >= 0) proxies.splice(i, 1);
    if (r.bar) scene.remove(r.bar); if (r.ring) scene.remove(r.ring);
  }
  function makeBar() {
    const g = new THREE.Group(); const b = new THREE.Mesh(barGeo, barBack), f = new THREE.Mesh(barGeo, barGreen); b.renderOrder = 200; f.renderOrder = 201; g.add(b, f); g.userData = { f, b }; scene.add(g); return g;
  }
  function setBar(r, frac, w, y, color) {
    if (!r.bar) r.bar = makeBar();
    const g = r.bar; g.visible = true; g.position.set(r.obj.position.x, r.obj.position.y + y, r.obj.position.z); g.quaternion.copy(camera.quaternion);
    const { f, b } = g.userData; b.scale.set(w + 0.06, 0.15, 1); f.scale.set(Math.max(0.001, w * frac), 0.1, 1); f.position.set(-w * (1 - frac) / 2, 0, 0.01); f.material = color;
  }

  // ---- selection state, ghost, flags ---------------------------------------------------------------
  let selected = new Set(), hoverId = 0;
  function ringFor(r, kind) {
    if (!r.ring || r.ringKind !== kind) {
      if (r.ring) scene.remove(r.ring);
      const e = r.e; const isB = e.type !== "unit"; const m = new THREE.Mesh(isB ? sqGeo : circGeo, ringMat[kind]); m.rotation.x = -Math.PI / 2; m.renderOrder = 150;
      const s = isB ? (e.w / 2 + 0.2) * Math.SQRT2 : e.radius * 1.5 + 0.28; m.scale.set(s, s, s); r.ring = m; r.ringKind = kind; scene.add(m);
    }
    return r.ring;
  }

  const ghostMats = [new THREE.MeshStandardMaterial({ color: 0x55ff77, transparent: true, opacity: 0.55, depthWrite: false }), new THREE.MeshStandardMaterial({ color: 0xff4d3d, transparent: true, opacity: 0.55, depthWrite: false })];
  let ghost = null, ghostKind = null, ghostOk = true; const ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.35, depthTest: false })); ghostPad.rotation.x = -Math.PI / 2; ghostPad.renderOrder = 120; ghostPad.visible = false; scene.add(ghostPad);
  function showGhost(kind, ix, iz, ok) {
    if (ghostKind !== kind) { if (ghost) scene.remove(ghost); ghost = makeBuilding(kind, 0); ghost.userData.scaffold.visible = false; ghost.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); scene.add(ghost); ghostKind = kind; ghostOk = null; }
    const sz = BUILDINGS[kind].size;
    if (ghostOk !== ok) { ghost.traverse((o) => { if (o.isMesh) o.material = ghostMats[ok ? 0 : 1]; }); ghostPad.material.color.set(ok ? 0x55ff77 : 0xff4d3d); ghostOk = ok; }
    const cx = ix + sz / 2, cz = iz + sz / 2; const y = Math.max(heightAt(cx - 1, cz - 1), heightAt(cx + 1, cz + 1), heightAt(cx, cz));
    ghost.position.set(cx, y, cz); ghost.visible = true; ghostPad.position.set(cx, y + 0.08, cz); ghostPad.scale.set(sz, sz, 1); ghostPad.visible = true;
  }
  function hideGhost() { if (ghost) ghost.visible = false; ghostPad.visible = false; }
  const rallyFlag = new THREE.Group(); { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5), mat("flagpole", 0x6b4a2a)); p.position.y = 0.65; const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshBasicMaterial({ color: 0x66aaff, side: THREE.DoubleSide })); f.position.set(0.28, 1.1, 0); rallyFlag.add(p, f); rallyFlag.visible = false; scene.add(rallyFlag); }
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })); targetRing.rotation.x = -Math.PI / 2; targetRing.renderOrder = 120; targetRing.visible = false; scene.add(targetRing);
  function setTargetRing(p, r, color) { if (!p) { targetRing.visible = false; return; } targetRing.visible = true; targetRing.scale.set(r, r, r); targetRing.position.set(p.x, heightAt(p.x, p.z) + 0.15, p.z); targetRing.material.color.set(color || 0xffe9a0); }
  function setRally(p) { if (!p) { rallyFlag.visible = false; return; } rallyFlag.visible = true; rallyFlag.position.set(p.x, heightAt(p.x, p.z), p.z); }

  // ---- effects -------------------------------------------------------------------------------------
  const tex = dotTexture();
  const dust = new Particles(scene, 900, 1.0, 0xd8c7a0, false, tex), smoke = new Particles(scene, 700, 1.7, 0x6f6a64, false, tex), spark = new Particles(scene, 900, 0.5, 0xffb347, true, tex);
  const projs = []; const flashes = []; const pings = []; const beams = [];
  const arrowGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4), rockGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const arrowMat = mat("arrow", 0x2c2118), rockMat = mat("rockproj", 0x6e6a62);
  const tint = new THREE.PointLight(0xffe9a0, 0, 40, 2); scene.add(tint);
  let shake = 0;
  const ringFx = (x, z, color, r0, r1, dur, y = 0.15) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, heightAt(x, z) + y, z); m.renderOrder = 110; scene.add(m); pings.push({ m, t: 0, dur, r0, r1 });
  };
  function ping(x, z, kind = "move") { ringFx(x, z, kind === "attack" ? 0xff5a4a : kind === "rally" ? 0x66aaff : 0x66ff77, 0.2, 0.9, 0.55); }
  function lightningAt(x, z, radius) {
    const g = new THREE.Group(); const segs = 9; let px = x + (Math.random() - 0.5) * 3, py = 42, pz = z + (Math.random() - 0.5) * 3; const gy = heightAt(x, z);
    for (let i = 1; i <= segs; i++) {
      const k = i / segs; const nx = i === segs ? x : x + (Math.random() - 0.5) * 3.5 * (1 - k), ny = i === segs ? gy : 42 * (1 - k) + gy * k, nz = i === segs ? z : z + (Math.random() - 0.5) * 3.5 * (1 - k);
      const a = new THREE.Vector3(px, py, pz), b = new THREE.Vector3(nx, ny, nz), len = a.distanceTo(b);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 5), new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 1, depthWrite: false })); s.position.copy(a).add(b).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(s); px = nx; py = ny; pz = nz;
    }
    scene.add(g); beams.push({ g, t: 0, dur: 0.45 }); ringFx(x, z, 0xbfe0ff, 0.3, radius, 0.5, 0.2); tint.position.set(x, gy + 5, z); tint.color.set(0xbfdcff); tint.intensity = 90; flashes.push({ t: 0, dur: 0.4 });
    for (let i = 0; i < 28; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 5; spark.emit(x, gy + 0.3, z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 12, 0xcfe6ff); }
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3; dust.emit(x, gy + 0.2, z, Math.cos(a) * s, 0.6 + Math.random(), Math.sin(a) * s, 0.9, 1); }
    shake = Math.max(shake, 0.5);
  }
  function onEvents(evs, myOwner = 0) {
    for (const e of evs) {
      switch (e.type) {
        case "shot": {
          const sy = e.high ? 3.2 : e.kind === "rock" ? 1.2 : 1.1; const m = new THREE.Mesh(e.kind === "rock" ? rockGeo : arrowGeo, e.kind === "rock" ? rockMat : arrowMat); m.castShadow = false; scene.add(m);
          projs.push({ m, sx: e.sx, sz: e.sz, tx: e.tx, tz: e.tz, t: 0, dur: Math.max(0.15, e.dur), sy, ty: heightAt(e.tx, e.tz) + 0.8, rock: e.kind === "rock", arc: e.kind === "rock" ? 4.5 : Math.min(3, 0.6 + Math.hypot(e.tx - e.sx, e.tz - e.sz) * 0.12) });
          break;
        }
        case "hit": { const y = heightAt(e.x, e.z) + 0.9; for (let i = 0; i < (e.melee ? 4 : 2); i++) spark.emit(e.x, y, e.z, (Math.random() - 0.5) * 2.2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2.2, 0.25 + Math.random() * 0.2, 6, e.melee ? 0xffd27a : 0xffe9b0); break; }
        case "boom": { const y = heightAt(e.x, e.z); for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random() * 2.4; dust.emit(e.x, y + 0.3, e.z, Math.cos(a) * s, 0.8 + Math.random() * 1.6, Math.sin(a) * s, 0.9 + Math.random() * 0.5, 0.5); } for (let i = 0; i < 10; i++) spark.emit(e.x, y + 0.4, e.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.4 + Math.random() * 0.3, 10, 0xffa040); shake = Math.max(shake, 0.18); break; }
        case "die": { const y = heightAt(e.x, e.z); for (let i = 0; i < 6; i++) dust.emit(e.x, y + 0.2, e.z, (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2, 0.7, 0.2); break; }
        case "collapse": {
          const y = heightAt(e.x, e.z), w = e.w || 2;
          for (let i = 0; i < 38; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random() * 2.5, d = Math.random() * w * 0.5; dust.emit(e.x + Math.cos(a) * d, y + 0.5, e.z + Math.sin(a) * d, Math.cos(a) * s, 0.8 + Math.random() * 2, Math.sin(a) * s, 1.2 + Math.random() * 0.8, 0.4); }
          for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; smoke.emit(e.x + Math.cos(a) * w * 0.3, y + 1, e.z + Math.sin(a) * w * 0.3, (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6, 2 + Math.random(), -0.1); }
          shake = Math.max(shake, e.owner === myOwner ? 0.4 : 0.28); break;
        }
        case "bolt": lightningAt(e.x, e.z, e.radius); break;
        case "heal": { ringFx(e.x, e.z, 0x8dffa0, 0.5, e.radius, 1.1, 0.2); const y = heightAt(e.x, e.z); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.random() * e.radius; spark.emit(e.x + Math.cos(a) * d, y + 0.2, e.z + Math.sin(a) * d, 0, 1 + Math.random() * 1.5, 0, 1 + Math.random(), -0.2, 0x9dffb0); } break; }
        case "bounty": for (const b of S.buildings) if (!b.dead && b.owner === e.owner && b.kind === "town_center") { const y = heightAt(b.x, b.z) + 2; for (let i = 0; i < 40; i++) spark.emit(b.x + (Math.random() - 0.5) * 3, y, b.z + (Math.random() - 0.5) * 3, 0, 1.5 + Math.random() * 2.5, 0, 1.2, -0.5, 0xffd86a); } break;
        case "age": for (const b of S.buildings) if (!b.dead && b.owner === e.owner && b.kind === "town_center") { ringFx(b.x, b.z, 0xffd86a, 2, 9, 1.2, 0.25); const y = heightAt(b.x, b.z); for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 4; spark.emit(b.x, y + 2, b.z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, 1.2, 4, 0xffd86a); } } break;
        case "built": case "placed": { const y = heightAt(e.x, e.z); for (let i = 0; i < (e.type === "built" ? 14 : 6); i++) dust.emit(e.x + (Math.random() - 0.5) * 2, y + 0.2, e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.6, 0.5 + Math.random(), (Math.random() - 0.5) * 1.6, 0.8, 0.3); break; }
        case "ability": abilityFx(e); break;
        case "dash": { const y = heightAt(e.sx, e.sz); for (let i = 0; i < 14; i++) { const k = i / 13; dust.emit(e.sx + (e.x - e.sx) * k, y + 0.3, e.sz + (e.z - e.sz) * k, (Math.random() - 0.5) * 1.2, 0.4 + Math.random(), (Math.random() - 0.5) * 1.2, 0.7, 0.3); } if (e.blink) { ringFx(e.sx, e.sz, 0xbfd8ff, 0.3, 1.6, 0.5); ringFx(e.x, e.z, 0xbfd8ff, 1.6, 0.3, 0.5); } break; }
        case "summon": case "fade": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, e.type === "summon" ? 0x9fd8ff : 0x667788, 0.2, 1.1, 0.6); for (let i = 0; i < 16; i++) spark.emit(e.x + (Math.random() - 0.5) * 0.8, y + 0.2, e.z + (Math.random() - 0.5) * 0.8, 0, 1 + Math.random() * 2, 0, 0.8, -0.3, e.type === "summon" ? 0xaee0ff : 0x889aaa); break; }
        case "levelup": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, 0xffe58a, 0.4, 3.2, 1.0, 0.2); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, s = 0.5 + Math.random() * 2; spark.emit(e.x, y + 0.4, e.z, Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s, 1.2, 3, 0xffe58a); } break; }
        case "heroBack": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, 0xffe9a0, 0.3, 4, 1.2, 0.2); for (let i = 0; i < 50; i++) spark.emit(e.x + (Math.random() - 0.5), y + 0.2, e.z + (Math.random() - 0.5), 0, 2 + Math.random() * 4, 0, 1.4, 1.5, 0xfff0b0); break; }
        case "heroDown": { const y = heightAt(e.x, e.z); for (let i = 0; i < 24; i++) smoke.emit(e.x + (Math.random() - 0.5), y + 0.5, e.z + (Math.random() - 0.5), 0, 0.8 + Math.random(), 0, 2, -0.1); break; }
        case "discover": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, e.relic ? 0xffd45a : 0xffffff, 0.5, 4.5, 1.0, 0.25); for (let i = 0; i < 24; i++) spark.emit(e.x, y + 0.5, e.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 1, 4, 0xfff0c0); break; }
        case "shrine": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, 0xb48aff, 0.5, 14, 1.6, 0.25); ringFx(e.x, e.z, 0xffe9a0, 0.3, 8, 1.2, 0.3); for (let i = 0; i < 60; i++) spark.emit(e.x, y + 1, e.z, (Math.random() - 0.5) * 5, 2 + Math.random() * 5, (Math.random() - 0.5) * 5, 1.4, 3, 0xcdb4ff); break; }
        case "lairCleared": { const y = heightAt(e.x, e.z); for (let i = 0; i < 40; i++) spark.emit(e.x + (Math.random() - 0.5) * 2, y + 0.4, e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2, 1.2, 5, 0xffd86a); break; }
        case "relicTake": case "relicDeliver": case "relicDrop": { const y = heightAt(e.x, e.z); ringFx(e.x, e.z, 0xffd45a, 0.3, 3, 0.9, 0.25); for (let i = 0; i < 30; i++) spark.emit(e.x, y + 0.5, e.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 3, 1.1, 3, 0xffe58a); break; }
        case "quake": { ringFx(e.x, e.z, 0xa8825a, 0.5, e.radius, 0.9, 0.2); const y = heightAt(e.x, e.z); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.random() * e.radius; dust.emit(e.x + Math.cos(a) * d, y + 0.2, e.z + Math.sin(a) * d, 0, 1 + Math.random() * 2, 0, 1.2, 1); } shake = Math.max(shake, 0.7); break; }
        case "storm": { ringFx(e.x, e.z, 0xcfe8ff, 0.5, e.radius, 0.8, 0.2); const y = heightAt(e.x, e.z); for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, d = Math.random() * e.radius; spark.emit(e.x + Math.cos(a) * d, y + 8 + Math.random() * 6, e.z + Math.sin(a) * d, 0, -14 - Math.random() * 6, 0, 0.7, 0, 0xe8f4ff); } break; }
        case "farsight": { ringFx(e.x, e.z, 0xffe58a, 1, e.radius, 1.4, 0.3); break; }
        case "buff": { for (const u of S.units) if (!u.dead && u.owner === e.owner && S.vis[Math.floor(u.z) * N + Math.floor(u.x)] === 2 && Math.random() < 0.6) { const y = heightAt(u.x, u.z); for (let i = 0; i < 4; i++) spark.emit(u.x, y + 0.5 + i * 0.3, u.z, 0, 1.5, 0, 0.7, -1, e.key === "fury" ? 0xff7a3a : 0xbfe6ff); } break; }
        case "wonderStart": { for (const b of S.buildings) if (!b.dead && b.def.wonder && b.owner === e.owner) { ringFx(b.x, b.z, 0xffe58a, 3, 14, 1.8, 0.3); const y = heightAt(b.x, b.z); for (let i = 0; i < 80; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 5; spark.emit(b.x, y + 3, b.z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 1.6, 3, 0xffe58a); } } break; }
        default: break;
      }
    }
  }
  // champion abilities
  function abilityFx(e) {
    const hx = e.fx ?? e.x, hz = e.fz ?? e.z;
    const burst = (x, z, n, col, up = 3, spread = 2) => { const y = heightAt(x, z); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = Math.random() * spread; spark.emit(x, y + 0.5, z, Math.cos(a) * s, 1 + Math.random() * up, Math.sin(a) * s, 0.9, 3, col); } };
    switch (e.key) {
      case "rage": ringFx(hx, hz, 0xff3a2a, 0.5, 2.6, 0.8, 0.2); burst(hx, hz, 30, 0xff4a2a); break;
      case "myrmidons": ringFx(hx, hz, 0x9fd8ff, 0.5, 3, 0.9, 0.2); break;
      case "ruse": ringFx(e.x, e.z, 0xe8b04a, 0.5, e.radius, 0.8, 0.2); burst(e.x, e.z, 36, 0xffe0a0, 3, e.radius * 0.6); break;
      case "foxeyes": ringFx(e.x, e.z, 0x6fe0cf, 1, e.radius, 1.3, 0.25); ringFx(e.x, e.z, 0xffffff, 0.5, e.radius * 0.6, 1.0, 0.3); break;
      case "volley": { ringFx(e.x, e.z, 0xd8f0ff, 0.4, e.radius, 0.7, 0.2); const y = heightAt(e.x, e.z); for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, d = Math.random() * e.radius; spark.emit(e.x + Math.cos(a) * d, y + 7 + Math.random() * 5, e.z + Math.sin(a) * d, 0, -13, 0, 0.6, 0, 0xfff4d0); } break; }
      case "swiftfoot": case "sandals": ringFx(hx, hz, 0xbfe6ff, 0.4, 1.8, 0.6, 0.2); burst(hx, hz, 18, 0xdff4ff); break;
      case "charge": ringFx(hx, hz, 0xff8aa8, 0.4, 2.2, 0.6, 0.2); break;
      case "warcry": ringFx(hx, hz, 0xffb86a, 0.5, e.radius, 1.0, 0.2); burst(hx, hz, 30, 0xffc070, 3, e.radius * 0.5); shake = Math.max(shake, 0.3); break;
      case "gaze": ringFx(hx, hz, 0x9aa0a8, 0.5, e.radius, 0.9, 0.2); ringFx(hx, hz, 0xd0d6dc, 0.3, e.radius * 0.7, 0.7, 0.3); burst(hx, hz, 40, 0xc4cad2, 1.5, e.radius * 0.7); break;
      default: break;
    }
  }

  // glints over a unit while a power is working on it: stars when stunned, red sparks in a rage, dust when sped up
  function statusFx(r, e, dt) {
    const st = e.st; if (!st) return; r.fxT = (r.fxT || 0) - dt; if (r.fxT > 0) return; r.fxT = 0.11; const y = r.obj.position.y;
    const stunned = st.stun > S.t, rage = st.rage > S.t, fury = st.fury > S.t || st.warcry > S.t, fast = st.swift > S.t || st.swiftfoot > S.t || st.sandals > S.t;
    if (stunned) { const a = time * 9; spark.emit(r.px + Math.cos(a) * 0.35, y + 1.7, r.pz + Math.sin(a) * 0.35, 0, 0.1, 0, 0.35, 0, 0xffee66); }
    if (rage) spark.emit(r.px + (Math.random() - 0.5) * 0.5, y + 0.6 + Math.random() * 0.9, r.pz + (Math.random() - 0.5) * 0.5, 0, 1.4, 0, 0.5, -1, 0xff3a2a);
    if (fury) spark.emit(r.px + (Math.random() - 0.5) * 0.4, y + 0.4 + Math.random() * 0.8, r.pz + (Math.random() - 0.5) * 0.4, 0, 0.9, 0, 0.4, -1, 0xffb040);
    if (fast) dust.emit(r.px, y + 0.1, r.pz, (Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4, 0.5, 0);
  }

  // ---- per-frame sync --------------------------------------------------------------------------------
  const cam = { x: N / 2, z: N / 2, dist: 40 };
  let fogT = 0, nodeT = 0, time = 0, camShakeX = 0, camShakeY = 0;
  function setView(x, z, dist) { cam.x = x; cam.z = z; cam.dist = dist; }
  function placeCamera() {
    const ty = heightAt(cam.x, cam.z) * 0.6; const ce = Math.cos(EL);
    camera.position.set(cam.x + Math.sin(AZ) * ce * cam.dist + camShakeX, ty + Math.sin(EL) * cam.dist + camShakeY, cam.z + Math.cos(AZ) * ce * cam.dist);
    camera.lookAt(cam.x + camShakeX, ty, cam.z); camera.updateMatrixWorld();
    sun.position.set(cam.x + SUN_OFF.x, SUN_OFF.y, cam.z + SUN_OFF.z); sun.target.position.set(cam.x, 0, cam.z); sun.target.updateMatrixWorld();
  }
  // The fog of war: unknown land hides under a drifting mist of dark parchment, land you have seen before is dimmed and calm, and the
  // edge of what you can see glows faintly gold, like torchlight on the border of the unknown.
  const fogNoise = new Float32Array(N * N); for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) fogNoise[z * N + x] = hash2(x, z, 77) * 0.5 + hash2(x >> 1, z >> 1, 78) * 0.5;
  function updateFog(dt) {
    const vis = S.vis, k = 1 - Math.exp(-dt * 7), tt = time * 0.35;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x, v = vis[i], target = v === 2 ? 0 : v === 1 ? 0.42 : 1; fogA[i] += (target - fogA[i]) * k;
      const a = fogA[i], row = N - 1 - z, o = (row * N + x) * 4;
      const wob = 0.5 + 0.5 * Math.sin(tt + x * 0.31 + z * 0.23 + fogNoise[i] * 6.28);
      const unk = Math.max(0, (a - 0.42) / 0.58);
      const edge = Math.max(0, 1 - Math.abs(a - 0.5) * 3.2) * (a < 0.9 ? 1 : 0);
      const n = fogNoise[i];
      fogData[o] = Math.min(255, 14 + unk * (30 + n * 22 + wob * 10) + edge * 120);
      fogData[o + 1] = Math.min(255, 16 + unk * (26 + n * 16 + wob * 8) + edge * 85);
      fogData[o + 2] = Math.min(255, 28 + unk * (38 + n * 18 + wob * 8) + edge * 20);
      fogData[o + 3] = Math.round(Math.min(255, a * (unk > 0.01 ? 240 + wob * 15 - n * 20 : 255)));
    }
    fogTex.needsUpdate = true;
  }
  const visAt = (x, z) => S.vis[Math.max(0, Math.min(N - 1, Math.floor(z))) * N + Math.max(0, Math.min(N - 1, Math.floor(x)))];

  function sync(dt, selIds, me = 0) {
    time += dt; selected = selIds || selected;
    // create / update entity records
    for (const e of S.units) if (!recs.has(e.id)) addRec(e);
    for (const e of S.pois) if (!recs.has(e.id)) addPoiRec(e);
    for (const e of S.relics) if (!recs.has(e.id)) addPoiRec(e);
    for (const e of S.buildings) if (!recs.has(e.id)) addRec(e);
    nodeT -= dt;
    if (nodeT <= 0) { nodeT = 0.35; for (const e of S.nodes) { if (e.kind === "tree") { const i = treeIdx.get(e.id); if (i === undefined) continue; const k = e.dead ? 0 : 0.6 + 0.4 * (e.amount / e.max); if (Math.abs(k - treeInfo[i].last) > 0.02) { setTree(i, k); trunkIM.instanceMatrix.needsUpdate = crownIM.instanceMatrix.needsUpdate = crown2IM.instanceMatrix.needsUpdate = true; } } else if (!recs.has(e.id) && !e.dead) addRec(e); } }
    const kp = 1 - Math.exp(-dt * 22);
    for (const r of [...recs.values()]) {
      const e = r.e, o = r.obj;
      if (r.poi) { // shrines, dens and relics: only drawn once the fog has lifted over them
        const v = visAt(e.x, e.z); const lit = e.type === "relic" ? (e.state === "ground" && v > 0) : v > 0 || e.found[0];
        o.visible = lit; animatePoi(o, time + (e.id % 7));
        if (e.type === "relic") o.position.set(e.x, heightAt(e.x, e.z), e.z);
        continue;
      }
      if (e.type === "node") { if (e.dead) { removeRec(r); continue; } const k = 0.7 + 0.3 * (e.amount / e.max); o.scale.setScalar(k); r.shown = true; o.visible = visAt(e.x, e.z) > 0; r.proxy.visible = true; continue; }
      const mine = e.owner === me;
      // visibility under fog
      const v = visAt(e.x, e.z); r.shown = mine || (e.type === "building" ? v > 0 || r.seen : v === 2); if (v > 0) r.seen = true; if (e.type === "building" && !mine) r.shown = !!r.seen;
      if (e.type === "unit") {
        if (e.dead) {
          r.deadT += dt; o.visible = r.shown; const k = Math.min(1, r.deadT / 0.45); o.rotation.x = -Math.PI / 2 * k; o.position.y = heightAt(e.x, e.z) - 0.1 * k - Math.max(0, r.deadT - 2) * 0.3; if (r.deadT > 4 || !S.ents.has(e.id)) removeRec(r); continue;
        }
        if (!S.ents.has(e.id)) { removeRec(r); continue; }
        const dx = e.x - r.px, dz = e.z - r.pz; r.px += dx * kp; r.pz += dz * kp;
        const spd = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
        let da = e.face - r.pface; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; r.pface += da * Math.min(1, dt * 14);
        o.position.set(r.px, heightAt(r.px, r.pz), r.pz); o.rotation.y = r.pface; o.visible = r.shown; r.proxy.position.set(r.px, o.position.y + 0.7, r.pz);
        if (r.shown) { animateUnit(r.P, e, time, spd); statusFx(r, e, dt); }
        if (r.heroRing) { r.heroRing.visible = r.shown; r.heroRing.material.opacity = 0.55 + 0.3 * Math.sin(time * 3); }
      } else { // building
        if (e.dead) { r.deadT += dt; const k = Math.min(1, r.deadT / 1.1); o.scale.y = Math.max(0.02, 1 - k * 0.97); o.position.y = r.baseY - k * 0.4; o.rotation.z = Math.sin(r.deadT * 30) * 0.01 * (1 - k); if (r.deadT > 3.5 || !S.ents.has(e.id)) removeRec(r); continue; }
        if (!S.ents.has(e.id)) { removeRec(r); continue; }
        o.visible = r.shown;
        const m = o.userData.m; if (!e.done) { const p = Math.max(0.06, e.progress); m.scale.set(1, p, 1); o.userData.scaffold.visible = true; m.visible = true; } else { m.scale.set(1, 1, 1); o.userData.scaffold.visible = false; }
        if (e.done && r.wasBuilding) { r.wasBuilding = false; }
        if (!e.done) r.wasBuilding = true;
        if (e.done && e.hp < e.maxHp * 0.45 && r.shown) { r.fireT -= dt; if (r.fireT <= 0) { r.fireT = 0.12 + (e.hp / e.maxHp) * 0.3; const fx = e.x + (Math.random() - 0.5) * e.w * 0.7, fz = e.z + (Math.random() - 0.5) * e.w * 0.7, fy = r.baseY + 1.2 + Math.random() * 1.2; spark.emit(fx, fy, fz, (Math.random() - 0.5) * 0.4, 1 + Math.random(), (Math.random() - 0.5) * 0.4, 0.5, -1, 0xff7a20); smoke.emit(fx, fy + 0.4, fz, (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 1.8, -0.05); } }
      }
      // bars + rings
      const isSel = selected.has(e.id), isHover = hoverId === e.id; const recentHit = S.t - (e.lastHit ?? -99) < 3;
      const showBar = r.shown && !e.dead && ((e.type === "building" && !e.done) || isSel || isHover || (e.hp < e.maxHp && (recentHit || e.type === "unit" ? e.hp < e.maxHp : false)) || (e.type === "building" && e.hp < e.maxHp * 0.999 && e.done && (recentHit || isSel || isHover)));
      if (showBar) {
        if (e.type === "building" && !e.done) setBar(r, Math.min(1, e.progress), e.w * 0.6 + 0.4, 2.6 + (e.w - 2) * 0.35, barBlue);
        else { const f = Math.max(0, e.hp / e.maxHp); setBar(r, f, e.type === "unit" ? 0.8 : e.w * 0.6 + 0.4, e.type === "unit" ? (e.kind === "horseman" || e.kind === "centaur" || e.kind === "hippolyta" ? 2.0 : e.isHero ? 2.3 : e.kind === "cyclops" ? 3.2 : e.kind === "talos" ? 3.0 : e.kind === "minotaur" ? 2.5 : e.kind === "wolf" ? 0.9 : 1.35) : 2.6 + (e.w - 2) * 0.35, f > 0.6 ? barGreen : f > 0.3 ? barYellow : barRed); }
      } else if (r.bar) r.bar.visible = false;
      if (r.shown && !e.dead && (isSel || isHover)) { const rg = ringFor(r, e.owner === me ? 0 : e.owner < 0 ? 2 : 1); rg.visible = true; rg.position.set(e.x, heightAt(e.x, e.z) + 0.12, e.z); }
      else if (r.ring) r.ring.visible = false;
    }
    // projectiles
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]; p.t += dt; const k = Math.min(1, p.t / p.dur);
      const x = p.sx + (p.tx - p.sx) * k, z = p.sz + (p.tz - p.sz) * k, y = p.sy + (p.ty - p.sy) * k + Math.sin(k * Math.PI) * p.arc;
      const nk = Math.min(1, k + 0.04), nx = p.sx + (p.tx - p.sx) * nk, nz = p.sz + (p.tz - p.sz) * nk, ny = p.sy + (p.ty - p.sy) * nk + Math.sin(nk * Math.PI) * p.arc;
      p.m.position.set(x, y, z);
      if (!p.rock) { tmpV.set(nx - x, ny - y, nz - z); if (tmpV.lengthSq() > 1e-8) p.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpV.normalize()); } else { p.m.rotation.x += dt * 6; p.m.rotation.z += dt * 4; if (Math.random() < 0.5) smoke.emit(x, y, z, 0, 0.1, 0, 0.7, 0); }
      if (k >= 1) { scene.remove(p.m); projs.splice(i, 1); }
    }
    for (let i = pings.length - 1; i >= 0; i--) { const p = pings[i]; p.t += dt; const k = p.t / p.dur; const s = p.r0 + (p.r1 - p.r0) * k; p.m.scale.set(s, s, s); p.m.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); pings.splice(i, 1); } }
    for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.t += dt; const k = b.t / b.dur; b.g.children.forEach((c) => { c.material.opacity = Math.max(0, 1 - k) * (Math.random() > 0.3 ? 1 : 0.4); }); if (k >= 1) { b.g.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); }); scene.remove(b.g); beams.splice(i, 1); } }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; tint.intensity = Math.max(0, 90 * (1 - f.t / f.dur)); if (f.t >= f.dur) { tint.intensity = 0; flashes.splice(i, 1); } }
    dust.update(dt); smoke.update(dt); spark.update(dt);
    wt.offset.x += dt * 0.012; wt.offset.y += dt * 0.007;
    rallyFlag.rotation.y += dt;
    shake = Math.max(0, shake - dt * 1.6); camShakeX = (Math.random() - 0.5) * shake * 0.6; camShakeY = (Math.random() - 0.5) * shake * 0.6;
    fogT -= dt; if (fogT <= 0) { fogT = 0.1; updateFog(0.1); }
    placeCamera();
  }

  // ---- picking helpers --------------------------------------------------------------------------------
  const ray = new THREE.Raycaster(); const nd = new THREE.Vector2();
  function groundAt(nx, ny) {
    ray.setFromCamera(nd.set(nx, ny), camera); const o = ray.ray.origin, d = ray.ray.direction; let h = 0, x = 0, z = 0;
    for (let i = 0; i < 4; i++) { const t = (h - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; h = heightAt(x, z); }
    return { x, z };
  }
  function pickEntity(nx, ny) {
    ray.setFromCamera(nd.set(nx, ny), camera);
    const cand = proxies.filter((p) => p.userData.rec.shown && !p.userData.rec.e.dead);
    const hits = ray.intersectObjects(cand, false); if (!hits.length) return null;
    // prefer units over buildings if both are under the cursor ray
    let best = hits[0]; for (const h of hits) { if (h.object.userData.rec.e.type === "unit" && best.object.userData.rec.e.type !== "unit" && h.distance < best.distance + 6) { best = h; break; } }
    return best.object.userData.rec.e;
  }
  function project(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: tmpV.x, y: tmpV.y, behind: tmpV.z > 1 }; }
  function resize(w, h, shiftPx = 0) { renderer.setSize(w, h, false); camera.aspect = w / h; if (shiftPx > 0) camera.setViewOffset(w, h, 0, shiftPx / 2, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  function render() { renderer.render(scene, camera); }
  function setHover(id) { hoverId = id || 0; }
  function dispose() { renderer.dispose(); if (el.parentNode) el.parentNode.removeChild(el); }

  return { renderer, scene, camera, heightAt, setView, cam, sync, render, resize, onEvents, ping, groundAt, pickEntity, project, setHover, showGhost, hideGhost, setRally, setTargetRing, dispose, recs, el };
}
