// Midnight Burn — the 3D view of the city: streams the world in chunks around the car, draws the cars, traffic, markers, weather and the camera.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createHeroCar, makeEnvMap } from "../cars";
import { makeBlobShadow, makeGradePass } from "../fx";
import { rivalSpec } from "../drivers";
import { DEFAULT_SPEC, specOf } from "../cars";
import { CH, NCH } from "./world";
import { W, DISTRICTS, LAKES } from "./geo";
import { buildChunk, disposeGroup, C } from "./chunks3d";
import { buildLandmarks } from "./landmarks3d";
import { buildVehicleGeo } from "./vehicles3d";
import { createCockpit } from "./cockpit";
import { glowTexture, ringTexture, beamTexture, seaTexture, labelSprite } from "./textures";
import { facadeSet, bandSet, adAtlas, bladeAtlas, boardAtlas, paveTexture, groundDetail, cloudTexture, roadSet, leafTexture, frondTexture } from "./textures2";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PAL = { sky: 0x03030c, fog: 0x0a0a1c, neonA: 0xff2d95, neonB: 0x2de2ff, glass: 0xffd27a };
const RADIUS = 3; // chunks loaded around the car

const GLOW_VS = `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 140.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const GLOW_FS = `uniform sampler2D map; uniform float fogNear; uniform float fogFar; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * 1.6, t.a); }`;
const PART_VS = `attribute float size; attribute float alpha; attribute vec3 pcolor; varying float vA; varying vec3 vC; void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 260.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PART_FS = `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`;

export function createCityView(mount, G, opts = {}) {
  const world = G.world, city = world.city;
  const width = mount.clientWidth || 960, height = mount.clientHeight || 540;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  const pr = Math.min(window.devicePixelRatio || 1, opts.lite ? 1 : 2);
  renderer.setPixelRatio(pr); renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  mount.appendChild(renderer.domElement); renderer.domElement.style.display = "block";

  const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.fog);
  scene.fog = new THREE.Fog(PAL.fog, 120, 980);
  const camera = new THREE.PerspectiveCamera(64, width / height, 0.12, 4200);
  const ambient = new THREE.AmbientLight(0x7e84b0, 1.45), hemi = new THREE.HemisphereLight(0x7080e0, 0x30203a, 0.9), moon = new THREE.DirectionalLight(0x8fa0ff, 0.5);
  moon.position.set(-200, 300, 120); scene.add(ambient, hemi, moon);

  const glowTex = glowTexture(), ringTex = ringTexture(), beamTex = beamTexture(), blobTex = makeBlobShadow();
  let envMap = null; try { envMap = makeEnvMap(renderer, PAL); } catch { envMap = null; }

  // ---- materials ---------------------------------------------------------------------------------------------------------------------------------
  const texRes = facadeSet("res"), texOff = facadeSet("office"), texInd = facadeSet("ind"), road = roadSet();
  const bands = { shops0: bandSet("shops", 9), shops1: bandSet("shops", 14), shops2: bandSet("shops", 23), lobby: bandSet("lobby"), dock: bandSet("dock") };
  const leafTex = leafTexture(), frondTex = frondTexture(), adTex = adAtlas(), bladeTex = bladeAtlas(), boardTex = boardAtlas(), paveTex = paveTexture(), groundTex = groundDetail();
  const facadeMat = (T, glass) => new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.em, emissive: 0xffffff, emissiveIntensity: 0.62, vertexColors: true, roughness: 1, metalness: 1, roughnessMap: T.rm, metalnessMap: T.rm, envMap, envMapIntensity: glass ? 1.5 : 0.7 });
  const bandMat = (T) => new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.em, emissive: 0xffffff, emissiveIntensity: 0.85, vertexColors: true, roughness: 1, metalness: 1, roughnessMap: T.rm, metalnessMap: T.rm, envMap, envMapIntensity: 0.8 });
  const mats = {
    terrain: new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 1, metalness: 0 }),
    road: new THREE.MeshStandardMaterial({ map: road.map, roughnessMap: road.rm, vertexColors: true, roughness: 0.82, metalness: 0.1, envMap, envMapIntensity: 0.9 }),
    decal: new THREE.MeshStandardMaterial({ map: road.map, roughnessMap: road.rm, vertexColors: true, roughness: 0.82, metalness: 0.1, envMap, envMapIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    walk: new THREE.MeshStandardMaterial({ map: paveTex, vertexColors: true, roughness: 0.9, metalness: 0.02 }),
    concrete: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.12, envMap, envMapIntensity: 0.35 }),
    signs: new THREE.MeshStandardMaterial({ map: boardTex, vertexColors: true, roughness: 0.5, metalness: 0.2, emissiveMap: boardTex, emissive: 0xffffff, emissiveIntensity: 0.55 }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    leaf: new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 }),
    frond: new THREE.MeshStandardMaterial({ map: frondTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }),
    ad: new THREE.MeshBasicMaterial({ map: adTex, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
    blade: new THREE.MeshBasicMaterial({ map: bladeTex, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
    facade: { res: facadeMat(texRes, false), office: facadeMat(texOff, true), ind: facadeMat(texInd, false) },
    band: { shops0: bandMat(bands.shops0), shops1: bandMat(bands.shops1), shops2: bandMat(bands.shops2), lobby: bandMat(bands.lobby), dock: bandMat(bands.dock) },
    pool: new THREE.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }),
    glowPts: new THREE.ShaderMaterial({ uniforms: { map: { value: glowTex }, fogNear: { value: 0 }, fogFar: { value: 0 } }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  mats.pool.color = new THREE.Color(1, 1, 1);

  // ---- sky, stars, moon, the distant glow of the city ------------------------------------------------------------------------------------
  {
    const geo = new THREE.SphereGeometry(3800, 24, 14), top = new THREE.Color(PAL.sky), hor = new THREE.Color(0x2a1830), col = [];
    const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const t = clamp(pos.getY(i) / 3800, 0, 1); const c = hor.clone().lerp(top, Math.pow(t, 0.45)); col.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -10; dome.name = "sky"; scene.add(dome);
    const n = 700, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.random() * 0.95 + 0.14, r = 3500; sp[i * 3] = Math.cos(th) * Math.cos(ph) * r; sp[i * 3 + 1] = Math.sin(ph) * r * 0.9; sp[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(Object.assign(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })), { name: "stars" }));
    const moonM = new THREE.Mesh(new THREE.CircleGeometry(120, 28), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false })); moonM.position.set(-1800, 1400, -2500); moonM.lookAt(0, 0, 0); moonM.name = "moon"; scene.add(moonM);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x8fa0ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.copy(moonM.position).multiplyScalar(0.99); halo.lookAt(0, 0, 0); halo.name = "halo"; scene.add(halo);
    // moonlit clouds drifting slowly
    const cloudT = cloudTexture(); cloudT.repeat.set(1, 1);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(3600, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.5, side: THREE.BackSide, fog: false, depthWrite: false, color: 0x9fb0e0 })); cl.renderOrder = -9; cl.name = "clouds"; scene.add(cl);
    // light haze above every busy district, so the city glows on the horizon
    const hg = new THREE.Group(); hg.name = "haze";
    for (const d of DISTRICTS) { if (d.style === "forest") continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(d.r * 3.4, d.r * 1.5), new THREE.MeshBasicMaterial({ map: glowTex, color: d.style === "tower" || d.style === "glass" ? 0x6f8cff : 0xff9a52, transparent: true, opacity: 0.16 * d.dens, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(d.x, 95, d.z); m.rotation.y = 0; m.userData.bill = true; hg.add(m); }
    scene.add(hg);
  }
  // ---- the sea ------------------------------------------------------------------------------------------------------------------------------------------
  const seaTex = seaTexture();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ color: 0x06202e, roughness: 0.16, metalness: 0.55, envMap, envMapIntensity: 1.2, bumpMap: seaTex, bumpScale: 0.6, transparent: false }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, -0.15, W / 2); scene.add(sea);
  {
    const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshBasicMaterial({ color: 0x05080f, fog: true })); far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -1.2, W / 2); scene.add(far);
  }

  // ---- chunks (streamed) ----------------------------------------------------------------------------------------------------------------------------------
  const loaded = new Map(); const ck = (i, j) => i * 64 + j; const root = new THREE.Group(); scene.add(root);
  const texPack = { res: texRes, office: texOff, ind: texInd, shops0: bands.shops0, shops1: bands.shops1, shops2: bands.shops2, lobby: bands.lobby, dock: bands.dock };
  function ensureChunk(i, j) { const k = ck(i, j); if (loaded.has(k)) return false; const grp = buildChunk(world, i, j, mats, texPack); root.add(grp); loaded.set(k, grp); return true; }
  function dropFar(ci, cj) { for (const [k, grp] of loaded) { const i = Math.floor(k / 64), j = k % 64; if (Math.abs(i - ci) > RADIUS + 1 || Math.abs(j - cj) > RADIUS + 1) { root.remove(grp); disposeGroup(grp); loaded.delete(k); } } }
  function wanted(ci, cj, fx, fz) { // nearest first, with a bias to what is ahead
    const out = []; for (let j = cj - RADIUS; j <= cj + RADIUS; j++) for (let i = ci - RADIUS; i <= ci + RADIUS; i++) { if (i < 0 || j < 0 || i >= NCH || j >= NCH) continue; if (loaded.has(ck(i, j))) continue; const dx = i - ci, dz = j - cj; out.push([dx * dx + dz * dz - (dx * fx + dz * fz) * 0.6, i, j]); }
    return out.sort((a, b) => a[0] - b[0]);
  }
  const landmarkGroup = buildLandmarks(world, mats); scene.add(landmarkGroup);

  // ---- actors ----------------------------------------------------------------------------------------------------------------------------------------------------------
  const actors = new Map(); // key -> {mesh, kind}
  function makeHero(spec) {
    const m = createHeroCar(spec, { envMap, glowTex, poolTex: null });
    const L = m.userData.arch ? m.userData.arch.L : 4.4;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.32, 2.7), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.045; m.add(blob); scene.add(m); return m;
  }
  let playerMesh = null, playerKey = "";
  function refreshPlayer() {
    const c = G.career; const spec = specOf({ ...(c.spec || DEFAULT_SPEC), car: c.car });
    const key = JSON.stringify(spec); if (key === playerKey && playerMesh) return; playerKey = key;
    if (playerMesh) { scene.remove(playerMesh); playerMesh.userData.dispose && playerMesh.userData.dispose(); }
    playerMesh = makeHero(spec); playerMesh.userData.isPlayer = true;
    // nitrous flames
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    playerMesh.userData.flames = [-0.55, 0.55].map((z) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 8), flameMat); f.rotation.z = Math.PI / 2; f.position.set((playerMesh.userData.tailX ?? -2.2) - 1.2, 0.55, z); f.visible = false; playerMesh.add(f); return f; });
  }
  const racerMeshes = new Map();
  function syncRacers() {
    const run = G.run; const keep = new Set();
    if (run && run.racers) run.racers.forEach((r, i) => {
      keep.add(r.id); let m = racerMeshes.get(r.id);
      if (!m) { const spec = r.spec ? specOf(r.spec) : specOf(rivalSpec(i, run.ev.level || 1, r.car, r.color)); m = makeHero(spec); racerMeshes.set(r.id, m); }
      m.visible = !r.out; place(m, r.v, 1 / 60);
      m.userData.tailMat.color.setHex(r.v.braking ? 0xff2a2a : 0x8c0a0a);
    });
    for (const [id, m] of racerMeshes) if (!keep.has(id)) { scene.remove(m); m.userData.dispose && m.userData.dispose(); racerMeshes.delete(id); }
  }
  function place(mesh, v, dt) {
    mesh.position.set(v.x, v.y + 0.1, v.z); mesh.rotation.y = -v.yaw; mesh.rotation.z = v.pitch || 0; mesh.rotation.x = clamp(v.roll || 0, -0.12, 0.12);
    const wl = mesh.userData.wheels; if (wl) for (const w of wl) { w.spin.rotation.z -= (v.fwd * dt) / (w.r || 0.37) * (w.dir || 1); if (w.front) w.pivot.rotation.y = -(v.steer || 0) * 0.42; }
    const sh = mesh.userData.shell; if (sh) { const pt = clamp((v.acc || 0) * 0.0011, -0.05, 0.035); sh.rotation.z += (pt - sh.rotation.z) * 0.12; }
  }
  // traffic: shared geometry per kind, one material per paint colour
  const vGeo = {}, vMat = new Map(), vFree = new Map(), vLive = new Map();
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), tailOn = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), tailOff = new THREE.MeshBasicMaterial({ color: 0x7a0c0c });
  const paintMat = (col) => { let m = vMat.get(col); if (!m) { m = new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: 0.42, metalness: 0.5, envMap, envMapIntensity: 0.9 }); vMat.set(col, m); } return m; };
  function trafficMesh(t) {
    const key = t.kind + t.color; let list = vFree.get(key); let m = list && list.pop();
    if (!m) {
      const geo = vGeo[t.kind] || (vGeo[t.kind] = buildVehicleGeo(t.kind));
      m = new THREE.Group(); m.rotation.order = "YXZ"; m.add(new THREE.Mesh(geo.body, paintMat(t.color)), new THREE.Mesh(geo.head, headMat)); const tl = new THREE.Mesh(geo.tail, tailOff); m.add(tl); m.userData = { tail: tl, key };
      m.traverse((o) => { o.matrixAutoUpdate = true; }); scene.add(m);
    }
    m.visible = true; return m;
  }
  function syncTraffic() {
    const live = new Set();
    for (const t of G.traffic) {
      live.add(t.id); let m = vLive.get(t.id); if (!m) { m = trafficMesh(t); vLive.set(t.id, m); }
      m.position.set(t.x, t.y, t.z); m.rotation.y = -t.yaw; m.userData.tail.material = t.braking ? tailOn : tailOff;
      if (t.wreck > 0) m.rotation.z = Math.sin(t.id) * 0.12;
    }
    for (const [id, m] of vLive) if (!live.has(id)) { m.visible = false; let l = vFree.get(m.userData.key); if (!l) vFree.set(m.userData.key, (l = [])); l.push(m); vLive.delete(id); }
  }

  // ---- lights on the car --------------------------------------------------------------------------------------------------------------------------------------------
  const headL = new THREE.SpotLight(0xfff0d0, 140, 100, 0.5, 0.6, 1.3); scene.add(headL, headL.target);
  const underL = new THREE.PointLight(0x2de2ff, 6, 12, 1.6); scene.add(underL);

  // ---- markers --------------------------------------------------------------------------------------------------------------------------------------------------------------
  const markerGroup = new THREE.Group(); scene.add(markerGroup);
  const beamGeo = new THREE.CylinderGeometry(2.6, 2.6, 70, 16, 1, true); beamGeo.translate(0, 35, 0);
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  const TYPE_COL = { circuit: 0x2de2ff, sprint: 0x2de2ff, knockout: 0xb45cff, drag: 0xffb703, duel: 0xff2d95, drift: 0xff8a2d, delivery: 0x6bff6b, trap: 0xff4d4d };
  const TYPE_ICON = { circuit: "🏁", sprint: "🏁", knockout: "💀", drag: "⚡", duel: "👑", drift: "🌀", delivery: "📦", trap: "📷" };
  const markers = [];
  const stdBeam = (col, op) => new THREE.MeshBasicMaterial({ map: beamTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  function mkMarker(o) { // o: {x,z,y,col,label,sub,icon,tall}
    const g = new THREE.Group(); g.position.set(o.x, o.y + 0.1, o.z);
    const beam = new THREE.Mesh(beamGeo, stdBeam(o.col, o.beam ?? 0.5)); beam.scale.set(o.tall ? 1.2 : 1, o.tall ? 1.4 : 1, o.tall ? 1.2 : 1); g.add(beam);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, color: o.col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); ring.scale.set(o.ring || 26, 1, o.ring || 26); ring.position.y = 0.2; g.add(ring);
    let label = null; if (o.label) { label = labelSprite(o.label, "#" + new THREE.Color(o.col).getHexString(), o.sub || "", o.icon || ""); label.position.y = (o.tall ? 58 : 44); g.add(label); }
    markerGroup.add(g); const mk = { g, o, beam, ring, label, baseBeam: o.beam ?? 0.5 }; markers.push(mk); return mk;
  }
  const mkEvent = new Map(), mkShop = new Map(), mkSight = new Map(), mkStash = [], mkTrap = [];
  for (const ev of G.events) {
    if (ev.type === "trap") continue;
    if (ev.type === "drift") { const mk = mkMarker({ x: ev.x, z: ev.z, y: ev.sy ?? G.city.groundH(ev.x, ev.z), col: TYPE_COL.drift, label: ev.name, sub: "DRIFT ZONE", icon: TYPE_ICON.drift, ring: 30 }); mk.ev = ev; mkEvent.set(ev.id, mk); }
    else { const y = ev.sy ?? 0; const mk = mkMarker({ x: ev.sx, z: ev.sz, y, col: TYPE_COL[ev.type] || 0x2de2ff, label: ev.name, sub: ev.type.toUpperCase() + (ev.level > 1 ? "  ·  LV " + ev.level : ""), icon: TYPE_ICON[ev.type] }); mk.ev = ev; mkEvent.set(ev.id, mk); }
  }
  for (const sh of G.content.shops) { const mk = mkMarker({ x: sh.x, z: sh.z, y: sh.y, col: 0xffb703, label: sh.name, sub: "SHOP", icon: sh.icon, tall: true, ring: 30, beam: 0.55 }); mk.shop = sh; mkShop.set(sh.id, mk); }
  for (const s of G.content.sights) { const mk = mkMarker({ x: s.x, z: s.z, y: s.y, col: 0x9fd4ff, label: "", beam: 0.28, ring: 40 }); mk.sight = s; mkSight.set(s.id, mk); }
  // traps: a gantry across the road with a camera on it
  for (const ev of G.events) if (ev.type === "trap") {
    const g = new THREE.Group(); g.position.set(ev.x, ev.y ?? 0, ev.z); g.rotation.y = -ev.yaw; const m = new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.6, metalness: 0.4 });
    for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), m); p.position.set(0, 3.5, sz * 11); g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 23), m); beam.position.y = 7; g.add(beam);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x15151a })); cam.position.set(0, 6.2, 0); g.add(cam);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); lamp.position.set(0.6, 6.2, 0.4); g.add(lamp);
    const sign = labelSprite(ev.name, "#ff4d4d", "SPEED CAMERA  ·  " + ev.goals[0] + " km/h+", "📷"); sign.position.set(0, 12, 0); sign.scale.multiplyScalar(0.8); g.add(sign); markerGroup.add(g); mkTrap.push({ g, ev, lamp, sign, s0: { x: sign.scale.x, y: sign.scale.y } });
  }
  // cash stashes: a spinning gold diamond
  const stashGeo = new THREE.OctahedronGeometry(1, 0), stashMat = new THREE.MeshBasicMaterial({ color: 0xffd23a }), stashBig = new THREE.MeshBasicMaterial({ color: 0x6bff9a });
  for (const s of G.content.stashes) { const mesh = new THREE.Mesh(stashGeo, s.big ? stashBig : stashMat); mesh.scale.set(s.big ? 1.1 : 0.8, s.big ? 1.6 : 1.2, s.big ? 1.1 : 0.8); mesh.position.set(s.x, s.y + 1.6, s.z); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: s.big ? 0x6bff9a : 0xffd23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(9, 9, 1); mesh.add(gl); gl.scale.set(9 / mesh.scale.x, 9 / mesh.scale.y, 1); markerGroup.add(mesh); mkStash.push({ mesh, s }); }
  // drift rings
  const driftRings = new Map();
  for (const ev of G.events) if (ev.type === "drift") {
    const N = 96, pos = [], idx = []; for (let k = 0; k <= N; k++) { const a = (k / N) * Math.PI * 2; const x = ev.x + Math.cos(a) * ev.radius, z = ev.z + Math.sin(a) * ev.radius; const y = G.city.groundH(x, z); pos.push(x, y + 0.5, z, x, y + 9, z); if (k < N) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const gm = new THREE.BufferGeometry(); gm.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); gm.setIndex(idx);
    const mesh = new THREE.Mesh(gm, new THREE.MeshBasicMaterial({ color: 0xff8a2d, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); mesh.visible = false; scene.add(mesh); driftRings.set(ev.id, mesh);
  }
  // race gates and the route ribbon
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x2de2ff }), gateMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gateGroup = new THREE.Group(); scene.add(gateGroup); const gates = [];
  for (let k = 0; k < 3; k++) { const g = new THREE.Group(); for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), k === 0 ? gateMat2 : gateMat); p.position.set(0, 4.5, sz * 9); g.add(p); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: k === 0 ? 0xffffff : 0x2de2ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(12, 12, 1); gl.position.set(0, 9.2, sz * 9); g.add(gl); } const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 18), k === 0 ? gateMat2 : gateMat); top.position.y = 9; g.add(top); g.visible = false; gateGroup.add(g); gates.push(g); }
  const RIB = 260; const ribPos = new Float32Array(RIB * 2 * 3), ribGeo = new THREE.BufferGeometry(); ribGeo.setAttribute("position", new THREE.BufferAttribute(ribPos, 3));
  { const idx = []; for (let k = 0; k < RIB - 1; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); ribGeo.setIndex(idx); }
  const ribbon = new THREE.Mesh(ribGeo, new THREE.MeshBasicMaterial({ color: 0x2de2ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true })); ribbon.frustumCulled = false; ribbon.visible = false; scene.add(ribbon);
  const wpBeam = new THREE.Mesh(beamGeo, stdBeam(0x2de2ff, 0.7)); wpBeam.visible = false; scene.add(wpBeam);

  // ---- weather and particles -------------------------------------------------------------------------------------------------------------------------------------------------------------
  const RN = 1800; const rpos = new Float32Array(RN * 6), rbase = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { rbase[i * 3] = (Math.random() - 0.5) * 120; rbase[i * 3 + 1] = Math.random() * 40; rbase[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0x9fb0d8, transparent: true, opacity: 0.0, fog: false })); rain.frustumCulled = false; scene.add(rain);
  function makePS(n, additive) {
    const g = new THREE.BufferGeometry(); const P = new Float32Array(n * 3), S = new Float32Array(n), A = new Float32Array(n), Cc = new Float32Array(n * 3);
    g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("size", new THREE.BufferAttribute(S, 1)); g.setAttribute("alpha", new THREE.BufferAttribute(A, 1)); g.setAttribute("pcolor", new THREE.BufferAttribute(Cc, 3));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { map: { value: glowTex } }, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; scene.add(m);
    return { n, P, S, A, C: Cc, V: new Float32Array(n * 3), L: new Float32Array(n), life0: new Float32Array(n), a0: new Float32Array(n), grow: new Float32Array(n), s0: new Float32Array(n), i: 0, g, m };
  }
  const smoke = makePS(260, false), sparks = makePS(160, true);
  function emit(ps, x, y, z, vx, vy, vz, life, size, grow, r, g, b, a) { const i = ps.i++ % ps.n; ps.P.set([x, y, z], i * 3); ps.V.set([vx, vy, vz], i * 3); ps.L[i] = life; ps.life0[i] = life; ps.a0[i] = a; ps.s0[i] = size; ps.grow[i] = grow; ps.S[i] = size; ps.A[i] = a; ps.C.set([r, g, b], i * 3); }
  function stepPS(ps, dt, drag, grav) {
    for (let i = 0; i < ps.n; i++) {
      if (ps.L[i] <= 0) { ps.A[i] = 0; continue; } ps.L[i] -= dt; const t = ps.L[i] / ps.life0[i];
      ps.V[i * 3] *= 1 - drag * dt; ps.V[i * 3 + 1] = ps.V[i * 3 + 1] * (1 - drag * dt) + grav * dt; ps.V[i * 3 + 2] *= 1 - drag * dt;
      ps.P[i * 3] += ps.V[i * 3] * dt; ps.P[i * 3 + 1] += ps.V[i * 3 + 1] * dt; ps.P[i * 3 + 2] += ps.V[i * 3 + 2] * dt; ps.S[i] = ps.s0[i] + ps.grow[i] * (1 - t); ps.A[i] = Math.max(0, t) * ps.a0[i];
    }
    ps.g.attributes.position.needsUpdate = ps.g.attributes.size.needsUpdate = ps.g.attributes.alpha.needsUpdate = ps.g.attributes.pcolor.needsUpdate = true;
  }

  // ---- post-processing ------------------------------------------------------------------------------------------------------------------------------------------------------
  let composer = null, gradePass = null, bloom = null, fxaaPass = null;
  try {
    const rt = new THREE.WebGLRenderTarget(Math.floor(width * pr), Math.floor(height * pr), { type: THREE.HalfFloatType, samples: opts.lite ? 0 : 4 });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.55, 0.78); composer.addPass(bloom);
    gradePass = makeGradePass(); gradePass.uniforms.uRes.value.set(width * pr, height * pr); if (opts.lite) gradePass.uniforms.uLite.value = 1; composer.addPass(gradePass); composer.addPass(new OutputPass()); fxaaPass = new ShaderPass(FXAAShader); fxaaPass.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr)); composer.addPass(fxaaPass); composer.setSize(width, height);
  } catch { composer = null; }

  // ---- camera ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const cockpit = createCockpit(); scene.add(camera); camera.add(cockpit.group);
  const cam = { x: 0, y: 5, z: 0, ang: 0, init: false, mode: 0, shake: 0, fov: 64, look: 0 };
  let clock = 0, lastCi = -99, lastCj = -99, prevStamp = 0;

  function syncMarkers(P, dt) {
    const run = G.run, career = G.career; const px = P.x, pz = P.z;
    for (const mk of markers) {
      const o = mk.o; const d = Math.hypot(o.x - px, o.z - pz); const far = d > 1500; let vis = !far;
      if (mk.ev) { const ev = mk.ev; const done = career.done[ev.id]; const locked = !G.isUnlocked(ev); const active = run && run.ev === ev;
        vis = vis && !run; const col = locked ? 0xff3b3b : done ? (done.medal === "gold" ? 0xffd23a : 0x6bff6b) : (TYPE_COL[ev.type] || 0x2de2ff);
        if (mk.col !== col) { mk.col = col; mk.beam.material.color.setHex(col); mk.ring.material.color.setHex(col); }
        mk.baseBeam = locked ? 0.22 : 0.5; if (mk.label) mk.label.visible = d < 520 && !locked || d < 160; mk.ring.scale.setScalar((o.ring || 26) * (1 + 0.04 * Math.sin(clock * 3 + o.x)));
      } else if (mk.shop) { vis = vis && !run; if (mk.label) mk.label.visible = d < 700; mk.ring.scale.setScalar((o.ring || 30) * (1 + 0.04 * Math.sin(clock * 2.4))); }
      else if (mk.sight) { vis = vis && !career.sights.includes(mk.sight.id) && d < 900; }
      mk.g.visible = vis;
      if (vis) { const near = d < 45; if (mk.beam) mk.beam.material.opacity = mk.baseBeam * clamp((d - 14) / 46, 0, 1); mk.beam.visible = d > 15; if (mk.ring && mk.ring.material) { if (mk.ring0 == null) mk.ring0 = mk.ring.material.opacity; mk.ring.material.opacity = mk.ring0 * clamp((d - 28) / 90, 0.04, 1); } if (mk.label) { const dc = Math.hypot(o.x - camera.position.x, o.z - camera.position.z); const sc = clamp(dc / 160, 0.55, 3.2); mk.label.scale.set(26 * sc, 8.1 * sc, 1); if (dc < 38) mk.label.visible = false; } }
    }
    for (const ts of mkStash) { const got = career.stash.includes(ts.s.id); const d = Math.hypot(ts.s.x - px, ts.s.z - pz); ts.mesh.visible = !got && d < 420; if (ts.mesh.visible) { ts.mesh.rotation.y = clock * 2; ts.mesh.position.y = ts.s.y + 1.7 + Math.sin(clock * 2 + ts.s.x) * 0.25; } }
    for (const tp of mkTrap) { const d = Math.hypot(tp.ev.x - px, tp.ev.z - pz); tp.g.visible = d < 900; if (tp.g.visible) { const dc = Math.hypot(tp.ev.x - camera.position.x, tp.ev.z - camera.position.z); const k = clamp(dc / 160, 0.5, 2.6); tp.sign.scale.set(tp.s0.x * k * 0.8, tp.s0.y * k * 0.8, 1); tp.sign.visible = dc > 30 && dc < 420; } }
    for (const [id, mesh] of driftRings) { const ev = G.eventById[id]; const d = Math.hypot(ev.x - px, ev.z - pz); mesh.visible = (run ? run.ev === ev : d < 1400); mesh.material.opacity = run && run.ev === ev ? (run.inside ? 0.28 : 0.14) : 0.1; }
    // gates for the active race
    gateGroup.children.forEach((g) => (g.visible = false));
    if (run && run.route && run.state !== "done" && run.kind !== "drift" && run.kind !== "delivery") {
      const L = run.route.pts, gi = run.route.gates; for (let k = 0; k < 3; k++) { const gidx = run.gate + k; if (gidx >= gi.length) break; const p = L[gi[gidx]]; const q = L[Math.min(L.length - 1, gi[gidx] + 2)], p0 = L[Math.max(0, gi[gidx] - 2)]; const g = gates[k]; g.visible = true; g.position.set(p.x, p.y, p.z); g.rotation.y = -Math.atan2(q.z - p0.z, q.x - p0.x); const sc = k === 0 ? 1 : 0.8; g.scale.set(1, sc, sc); }
    } else if (run && run.kind === "delivery") { const L = run.route.pts, e = L[L.length - 1]; const g = gates[0]; g.visible = true; g.position.set(e.x, e.y, e.z); g.rotation.y = clock; }
    // route ribbon: the GPS line a few hundred metres ahead
    let line = null; if (G.nav && G.nav.line && G.nav.line.length > 1) line = G.nav.line;
    if (run && run.route && run.kind !== "drift") line = run.route.pts;
    ribbon.visible = false; wpBeam.visible = false;
    if (line && line.length > 1) {
      let best = 0, bd = 1e12; const step = line.length > 400 ? 3 : 1; for (let i = 0; i < line.length; i += step) { const d = (line[i].x - px) ** 2 + (line[i].z - pz) ** 2; if (d < bd) { bd = d; best = i; } }
      let n = 0; const from = Math.max(0, best - 2); for (let i = from; i < line.length - 1 && n < RIB; i++) {
        const a = line[i], b = line[i + 1]; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; const nx = -dz / l * 1.4, nz = dx / l * 1.4; const y = (a.y ?? P.y) + 0.35;
        ribPos[n * 6] = a.x + nx; ribPos[n * 6 + 1] = y; ribPos[n * 6 + 2] = a.z + nz; ribPos[n * 6 + 3] = a.x - nx; ribPos[n * 6 + 4] = y; ribPos[n * 6 + 5] = a.z - nz; n++;
        if (Math.hypot(a.x - px, a.z - pz) > 420) break;
      }
      if (n > 2) { for (let k = n; k < RIB; k++) { ribPos[k * 6] = ribPos[(n - 1) * 6]; ribPos[k * 6 + 1] = ribPos[(n - 1) * 6 + 1]; ribPos[k * 6 + 2] = ribPos[(n - 1) * 6 + 2]; ribPos[k * 6 + 3] = ribPos[(n - 1) * 6 + 3]; ribPos[k * 6 + 4] = ribPos[(n - 1) * 6 + 4]; ribPos[k * 6 + 5] = ribPos[(n - 1) * 6 + 5]; } ribGeo.attributes.position.needsUpdate = true; ribbon.visible = true; ribbon.material.opacity = 0.35 + 0.2 * Math.sin(clock * 4); }
    }
    if (G.nav && G.nav.target && !run) { wpBeam.visible = true; wpBeam.position.set(G.nav.target.x, G.city.groundH(G.nav.target.x, G.nav.target.z), G.nav.target.z); wpBeam.scale.set(1.3, 2.4, 1.3); }
  }


  // ---- 2046: metro trains running on the viaducts, and station name boards ----------------------------------------------------
  const trains = [], stationSigns = [];
  for (const L of city.metro || []) {
    const col = new THREE.Color(L.color); const bodyM = new THREE.MeshStandardMaterial({ color: 0xdfe3ee, roughness: 0.35, metalness: 0.6, envMap, envMapIntensity: 0.9 }), winM = new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false }), stripeM = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
    const bodyG = new THREE.BoxGeometry(17.6, 3.1, 2.9), winG = new THREE.BoxGeometry(16.8, 0.95, 2.96), stG = new THREE.BoxGeometry(17.6, 0.22, 2.94);
    for (let t = 0; t < 2; t++) {
      const g = new THREE.Group(); const cars = [];
      for (let k = 0; k < 6; k++) { const c = new THREE.Group(); const b = new THREE.Mesh(bodyG, bodyM), w = new THREE.Mesh(winG, winM), st = new THREE.Mesh(stG, stripeM); w.position.y = 0.45; st.position.y = -0.75; c.add(b, w, st); g.add(c); cars.push(c); }
      g.visible = false; scene.add(g); trains.push({ L, g, cars, s: (t ? 0.62 : 0.12) * L.len, dir: t ? -1 : 1, v: 22 + t * 3 });
    }
    for (const st of L.stations) { const sp = labelSprite(st.name.toUpperCase() + " METRO", "#" + col.getHexString(), L.name, "🚇"); sp.position.set(st.x, st.y + 16, st.z); sp.scale.multiplyScalar(0.9); sp.visible = false; scene.add(sp); stationSigns.push({ sp, st }); }
  }
  function metroAt(L, s) { const pts = L.pts; let lo = 0, hi = pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; } const a = pts[lo], b = pts[lo + 1]; const f = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.z - a.z, b.x - a.x) }; }
  function updateMetro(dt) {
    if (!trains.length) return;
    for (const tr of trains) {
      tr.s += tr.dir * tr.v * dt; const L = tr.L; if (tr.s > L.len - 120) { tr.s = L.len - 120; tr.dir = -1; } if (tr.s < 140) { tr.s = 140; tr.dir = 1; }
      const head = metroAt(L, tr.s); tr.g.visible = Math.hypot(head.x - camera.position.x, head.z - camera.position.z) < 1400; if (!tr.g.visible) continue;
      tr.cars.forEach((c, k) => { const q = metroAt(L, clamp(tr.s - tr.dir * k * 18.4, 4, L.len - 4)); c.position.set(q.x, q.y + 2.0, q.z); c.rotation.y = -(q.yaw + (tr.dir < 0 ? Math.PI : 0)); });
    }
    for (const o of stationSigns) { const d = Math.hypot(o.st.x - camera.position.x, o.st.z - camera.position.z); o.sp.visible = d < 520; }
  }
  function update(realDt, simDt) {
    clock += realDt; const P = G.player;
    if (cam.lx !== undefined && Math.hypot(P.x - cam.lx, P.z - cam.lz) > 40) { cam.snap = true; cam.init = false; } cam.lx = P.x; cam.lz = P.z;
    refreshPlayer(); place(playerMesh, P, simDt || 0); playerMesh.userData.tailMat.color.setHex(P.braking ? 0xff2a2a : 0x8c0a0a);
    playerMesh.visible = cam.mode < 2; cockpit.group.visible = cam.mode === 3;
    if (cam.mode === 3) cockpit.update(realDt, P, G.weather.rain, clock, (playerMesh.userData.spec && playerMesh.userData.spec.color) || "#2de2ff");
    for (const f of playerMesh.userData.flames) { f.visible = P.nos; if (P.nos) f.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 1); }
    syncRacers(); syncTraffic();
    // stream the city
    const ci = Math.floor(P.x / CH), cj = Math.floor(P.z / CH);
    if (ci !== lastCi || cj !== lastCj) { lastCi = ci; lastCj = cj; dropFar(ci, cj); }
    const want = wanted(ci, cj, Math.cos(P.yaw), Math.sin(P.yaw)); let budget = want.length > 6 ? 2 : 1; for (const w of want) { if (budget-- <= 0) break; ensureChunk(w[1], w[2]); }
    // wet roads
    const rainK = G.weather.rain; mats.road.roughness = 0.9 - 0.78 * rainK; mats.decal.roughness = mats.road.roughness; mats.decal.metalness = mats.road.metalness; mats.decal.envMapIntensity = mats.road.envMapIntensity; mats.walk.roughness = 0.9 - 0.45 * rainK; mats.road.metalness = 0.12 + 0.25 * rainK; mats.road.envMapIntensity = 0.9 + 1.6 * rainK; mats.pool.opacity = 1;
    rain.material.opacity = 0.2 * rainK; rain.visible = rainK > 0.02;
    sea.material.roughness = 0.16 + 0.12 * rainK; scene.fog.far = 980 - 380 * rainK; scene.fog.near = 120 - 60 * rainK;
    bumpSea(); updateMetro(realDt);
    // lights
    headL.position.set(P.x, P.y + 1.2, P.z); headL.target.position.set(P.x + Math.cos(P.yaw) * 30, P.y, P.z + Math.sin(P.yaw) * 30); underL.position.set(P.x, P.y + 0.5, P.z); underL.intensity = P.nos ? 14 : 6;
    // billboards
    scene.getObjectByName("haze").children.forEach((m) => { m.quaternion.copy(camera.quaternion); const d = Math.hypot(m.position.x - camera.position.x, m.position.z - camera.position.z); const r = m.geometry.parameters.width / 3.4; const k = clamp((d - r * 0.9) / (r * 1.4), 0, 1); if (m.userData.op === undefined) m.userData.op = m.material.opacity; m.material.opacity = m.userData.op * k; m.visible = k > 0.01; });
    // particles
    if (realDt > 0) {
      if (P.drifting && P.speed > 15) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); for (const side of [-1, 1]) { const lx = -1.4, lz = side * 0.95; emit(smoke, P.x + cs * lx - sn * lz, P.y + 0.25, P.z + sn * lx + cs * lz, (Math.random() - 0.5) * 2 - P.vx * 0.08, 0.6 + Math.random(), (Math.random() - 0.5) * 2 - P.vz * 0.08, 1.4, 1.4, 4.5, 0.62, 0.62, 0.68, 0.5); } }
      if (G.cam.hit > 4) { for (let k = 0; k < 5; k++) emit(sparks, P.x, P.y + 0.5, P.z, (Math.random() - 0.5) * 14, 2 + Math.random() * 5, (Math.random() - 0.5) * 14, 0.5, 0.4, 0, 1, 0.75, 0.3, 1); }
      if (P.nos) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); emit(sparks, P.x + cs * -2.9, P.y + 0.55, P.z + sn * -2.9, -cs * 8 + (Math.random() - 0.5), Math.random(), -sn * 8 + (Math.random() - 0.5), 0.35, 0.8, 0.5, 0.3, 0.6, 1, 0.8); }
      if (G.wet && P.speed > 22) { const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw); for (const side of [-1, 1]) emit(smoke, P.x + cs * -1.4 - sn * side * 0.95, P.y + 0.25, P.z + sn * -1.4 + cs * side * 0.95, -P.vx * 0.12 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -P.vz * 0.12 + (Math.random() - 0.5) * 2, 0.9, 0.8, 2.5, 0.28, 0.32, 0.4, 0.35); }
      stepPS(smoke, realDt, 1.4, 0.2); stepPS(sparks, realDt, 0.8, -9);
    }
    updateCamera(realDt, P); if (view.debugCam) { const d = view.debugCam; camera.position.set(d.x, d.y, d.z); camera.lookAt(d.lx, d.ly, d.lz); camera.updateMatrixWorld(); } syncMarkers(P, realDt);
    if (gradePass) { const u = gradePass.uniforms; u.uTime.value = clock; const tb = clamp((P.speed - 45) / 60, 0, 1) * 0.05 + (P.nos ? 0.07 : 0); u.uBlur.value += (tb - u.uBlur.value) * Math.min(1, realDt * 5); u.uCA.value = 0.0008 + Math.min(1, P.speed / 70) * 0.0014 + (P.nos ? 0.0022 : 0); }
    // rain streaks follow the camera
    if (rain.visible) { const base = rbase; for (let i = 0; i < RN; i++) { base[i * 3 + 1] -= realDt * 38; if (base[i * 3 + 1] < 0) base[i * 3 + 1] += 40; const x = camera.position.x + base[i * 3], y = camera.position.y - 8 + base[i * 3 + 1], z = camera.position.z + base[i * 3 + 2]; rpos[i * 6] = x; rpos[i * 6 + 1] = y; rpos[i * 6 + 2] = z; rpos[i * 6 + 3] = x - P.vx * 0.012; rpos[i * 6 + 4] = y + 1.1; rpos[i * 6 + 5] = z - P.vz * 0.012; } rgeo.attributes.position.needsUpdate = true; }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  function bumpSea() { const cl = scene.getObjectByName("clouds"); if (cl) cl.rotation.y = clock * 0.004; seaTex.offset.x = clock * 0.004; seaTex.offset.y = clock * 0.003; }
  function updateCamera(dt, P) {
    const camYaw = P.yaw + clamp(P.lat * 0.012, -0.4, 0.4) * 0 + (P.drifting ? -P.steer * 0.0 : 0);
    const velYaw = P.speed > 4 ? Math.atan2(P.vz, P.vx) : P.yaw; // look along where the car is actually going, a little
    let target = P.yaw; if (P.speed > 8) { let d = velYaw - P.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; target = P.yaw + d * 0.35; }
    if (!cam.init) { cam.ang = target; cam.init = true; }
    let da = target - cam.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; cam.ang += da * Math.min(1, dt * (cam.mode >= 2 ? 14 : 5));
    const speed = P.speed, nosOn = P.nos; const speedF = Math.min(1, speed / 60);
    if (cam.mode >= 2) {
      const ck = cam.mode === 3; const ex = ck ? 0.12 : 0.5, ey = ck ? 1.08 : 1.2, side = ck ? 0.34 : 0; // cockpit: driver's seat on the right (cars drive on the left here)
      const rs = Math.sin(P.yaw), rc = Math.cos(P.yaw);
      camera.position.set(P.x + rc * ex - rs * side, P.y + ey + (Math.random() - 0.5) * speedF * 0.01, P.z + rs * ex + rc * side);
      camera.lookAt(P.x + Math.cos(cam.ang) * 24, P.y + ey - 0.05 + P.pitch * -4, P.z + Math.sin(cam.ang) * 24);
      if (ck) camera.rotateZ(-P.roll * 0.6);
    }
    else {
      const far = cam.mode === 1 ? 1 : 0; const back = 7.2 + far * 3.8 + speed * 0.035 + (nosOn ? 1.6 : 0);
      const tx = P.x - Math.cos(cam.ang) * back, tz = P.z - Math.sin(cam.ang) * back, ty = P.y + 2.6 + far * 1.5 + speed * 0.006;
      const kf = 1 - Math.pow(0.0005, dt);
      if (cam.snap) { cam.x = tx; cam.z = tz; cam.y = ty; cam.snap = false; } cam.x += (tx - cam.x) * kf; cam.z += (tz - cam.z) * kf; cam.y += (ty - cam.y) * kf;
      // keep the camera out of buildings: walk from the car towards it and stop short of the first wall
      { const dx = cam.x - P.x, dz = cam.z - P.z, dist = Math.hypot(dx, dz) || 1; let best = dist;
        for (let d = 2.2; d <= dist; d += 1.2) { const x = P.x + dx / dist * d, z = P.z + dz / dist * d; let hit = false;
          world.queryColliders(x, z, (o) => { if (hit || o.t !== 0) return; const px = x - o.x, pz = z - o.z; const lx = px * o.c + pz * o.s, lz = -px * o.s + pz * o.c; if (Math.abs(lx) < o.hw + 0.8 && Math.abs(lz) < o.hd + 0.8 && cam.y < o.y + o.h + 1) hit = true; });
          if (hit) { best = Math.max(2.6, d - 1.6); break; } }
        if (best < dist) { cam.x = P.x + dx / dist * best; cam.z = P.z + dz / dist * best; } }
      // never sink into the road or a hill
      const gy = city.groundH(cam.x, cam.z); const sf = city.surfaceAt(cam.x, cam.z, P.y); cam.y = Math.max(cam.y, (sf ? sf.y : Math.max(gy, city.meshH(cam.x, cam.z))) + 1.1);
      // line of sight: if a crest or a ramp lip is between the camera and the car, rise until the car is in view again
      { const ly = P.y + 1.2; for (let k = 1; k <= 7; k++) { const f = k / 8, sx = cam.x + (P.x - cam.x) * f, sz = cam.z + (P.z - cam.z) * f; const s2 = city.surfaceAt(sx, sz, P.y); const gh = (s2 ? s2.y : Math.max(city.groundH(sx, sz), city.meshH(sx, sz))) + 0.7; const ry = cam.y + (ly - cam.y) * f; if (gh > ry) cam.y += (gh - ry) / (1 - f) * 0.6; } }
      cam.shake = Math.max(cam.shake, G.cam.hit > 4 ? 1 : 0) ; cam.shake = Math.max(0, cam.shake - dt * 3); const sh = cam.shake * 0.35;
      camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z + (Math.random() - 0.5) * sh);
      camera.lookAt(P.x + Math.cos(cam.ang) * 9, P.y + 1.2, P.z + Math.sin(cam.ang) * 9);
    }
    const fovT = 64 + speedF * 9 + (nosOn ? 7 : 0); cam.fov += (fovT - cam.fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    // the sea, sky and haze follow the camera so they never end
    sea.position.x = camera.position.x; sea.position.z = camera.position.z; const sky = scene.getObjectByName("sky"); sky.position.copy(camera.position); scene.getObjectByName("stars").position.copy(camera.position);
    for (const nm of ["moon", "halo"]) { const o = scene.getObjectByName(nm); o.position.set(camera.position.x - 1800, 1400, camera.position.z - 2500); if (nm === "halo") o.position.multiplyScalar(1); o.lookAt(camera.position); }
  }
  // load the first chunks and the player's car before the first frame
  async function preload(onProgress) {
    refreshPlayer(); const P = G.player; const ci = Math.floor(P.x / CH), cj = Math.floor(P.z / CH); const want = wanted(ci, cj, 0, 0); let n = 0;
    for (const w of want) { if (w[0] > 6) break; ensureChunk(w[1], w[2]); n++; if (onProgress) onProgress(n / 24); await new Promise((r) => setTimeout(r, 0)); }
    cam.snap = true; cam.init = false;
  }
  function resize() { const w = mount.clientWidth || width, h = mount.clientHeight || height; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) { composer.setSize(w, h); const p = renderer.getPixelRatio(); if (gradePass) gradePass.uniforms.uRes.value.set(w * p, h * p); if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / (w * p), 1 / (h * p)); } }
  function setCameraMode(m) { cam.mode = m; cam.snap = true; }
  function dispose() { renderer.dispose(); if (composer) composer.dispose && composer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
  const view = { update, preload, resize, setCameraMode, dispose, cam, renderer, scene, camera, refreshPlayer, get chunkCount() { return loaded.size; } };
  return view;
}
