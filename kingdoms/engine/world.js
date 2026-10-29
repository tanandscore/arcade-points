// The sea, sky, light and the little living things around the town (boats, gulls, clouds).
import * as THREE from "three";
import { makeProp } from "./props";
import { cellCenter, BASE, H } from "./grid";
import { makeSkyDome } from "@/lib/cinematic/atmos";
import { hash } from "./grid";

const C = (h) => new THREE.Color(h);

function foamTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const d = Math.min(Math.min(x, 127 - x), Math.min(y, 127 - y)) / 64; // 0 at the outer edge, 1 in the middle
    const alpha = d < 0.36 ? Math.pow(d / 0.36, 1.4) : Math.max(0, 1 - (d - 0.36) / 0.4);
    const k = (y * 128 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(alpha * 255 * 0.55);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function seaMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3fb6c4, roughness: 0.4, metalness: 0.0 });
  m.userData.u = { uTime: { value: 0 }, uShallow: { value: C(0x6fe0d2) }, uDeep: { value: C(0x1d6f9a) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float dd = length(vWP.xz);
        diffuseColor.rgb = mix(uShallow, uDeep, smoothstep(14.0, 95.0, dd));
        float a1 = dot(vWP.xz, vec2(0.9, 0.4)) * 1.9 + uTime * 0.8; float a2 = dot(vWP.xz, vec2(-0.3, 1.0)) * 1.4 - uTime * 0.6; float a3 = dot(vWP.xz, vec2(0.6, -0.8)) * 3.1 + uTime * 1.2;
        float rip = sin(a1) * sin(a2) * 0.5 + sin(a3) * 0.25;
        diffuseColor.rgb += vec3(0.03, 0.045, 0.045) * rip;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        float b1 = dot(vWP.xz, vec2(0.9, 0.4)) * 1.9 + uTime * 0.8; float b2 = dot(vWP.xz, vec2(-0.3, 1.0)) * 1.4 - uTime * 0.6; float b3 = dot(vWP.xz, vec2(0.6, -0.8)) * 3.1 + uTime * 1.2;
        vec3 wob = vec3(cos(b1) * 0.02 + cos(b3) * 0.012, 0.0, cos(b2) * 0.02 + cos(b3) * 0.012);
        normal = normalize(normal + (viewMatrix * vec4(wob, 0.0)).xyz);`);
  };
  return m;
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  const fogCol = C(0xf7dcc0); scene.fog = new THREE.Fog(fogCol, 90, 330);

  // sky
  const sky = makeSkyDome({ zenith: 0x5aa0e6, mid: 0x9cc9ef, horizon: 0xffe2c4, sunColor: 0xffe2a8, sunDir: [-0.55, 0.42, -0.72], cloud: 0.5, cloudColor: 0xffffff, cloudShade: 0xc6d2e6, stars: 0, glow: 0.8 });
  scene.add(sky);
  const su = sky.userData.uniforms;

  // light
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xf4dcc0, 1.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
  const sunDirDay = new THREE.Vector3(-0.55, 0.62, -0.5).normalize();
  sun.position.copy(sunDirDay).multiplyScalar(90); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);

  // sea
  const seaMat = seaMaterial();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2), seaMat);
  sea.receiveShadow = true; sea.position.y = 0; scene.add(sea);

  // town meshes (filled in by the engine)
  const townMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.0, emissive: 0xffa857, emissiveIntensity: 0.0 });
  glassMat.userData.base = 0.0;
  const town = new THREE.Mesh(new THREE.BufferGeometry(), townMat); town.castShadow = true; town.receiveShadow = true; scene.add(town);
  const glass = new THREE.Mesh(new THREE.BufferGeometry(), glassMat); glass.castShadow = false; scene.add(glass);
  const foamTex = foamTexture();
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 1, fog: true, side: THREE.DoubleSide });
  const foam = new THREE.Mesh(new THREE.BufferGeometry(), foamMat); foam.renderOrder = 1; scene.add(foam);
  const pick = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false })); scene.add(pick);

  // hover ghost
  const ghostGeo = new THREE.BufferGeometry(); ghostGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  ghostGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
  const ghost = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ghost.visible = false; ghost.frustumCulled = false; ghost.renderOrder = 5; scene.add(ghost);
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ghostGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false }));
  ghostEdges.frustumCulled = false; ghostEdges.visible = false; ghostEdges.renderOrder = 6; scene.add(ghostEdges);
  function setGhost(corners, y0, y1, color, ok) {
    const a = ghostGeo.attributes.position.array;
    for (let n = 0; n < 4; n++) { a[n * 3] = corners[n][0]; a[n * 3 + 1] = y0; a[n * 3 + 2] = corners[n][1]; a[(n + 4) * 3] = corners[n][0]; a[(n + 4) * 3 + 1] = y1; a[(n + 4) * 3 + 2] = corners[n][1]; }
    ghostGeo.attributes.position.needsUpdate = true; ghostGeo.computeBoundingSphere();
    ghostEdges.geometry.dispose(); ghostEdges.geometry = new THREE.EdgesGeometry(ghostGeo);
    ghost.material.color.set(ok ? color : 0xff5a5a); ghostEdges.material.color.set(ok ? 0xffffff : 0xff7a7a);
    ghost.material.opacity = ok ? 0.5 : 0.35; ghost.visible = true; ghostEdges.visible = true;
  }
  function hideGhost() { ghost.visible = false; ghostEdges.visible = false; }

  // little effects: rings on the water and puffs
  const rings = [], puffs = [];
  const ringGeo = new THREE.RingGeometry(0.6, 0.75, 40).rotateX(-Math.PI / 2);
  const puffGeo = new THREE.IcosahedronGeometry(0.2, 0);
  function ring(x, z, y = 0.08) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    m.position.set(x, y, z); m.userData.t = 0; scene.add(m); rings.push(m);
  }
  function puff(x, y, z, color, n = 9, speed = 3) {
    for (let q = 0; q < n; q++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, fog: false }));
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * speed * 0.5;
      m.position.set(x, y, z); m.userData = { vx: Math.cos(a) * s, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * s, t: 0 }; scene.add(m); puffs.push(m);
    }
  }

  // boats
  const boats = [];
  function makeBoat(hullHex, sailHex) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 3.0), new THREE.MeshStandardMaterial({ color: hullHex, roughness: 0.8 })); hull.position.y = 0.12; hull.castShadow = true; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), hull.material); bow.position.set(0, 0.12, 2.0); bow.scale.set(0.85, 0.7, 1); g.add(bow);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.4, 5), new THREE.MeshStandardMaterial({ color: 0x5a4030 })); mast.position.y = 2.0; g.add(mast);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute([0, 3.5, 0, 0, 0.8, 0.0, 0, 0.8, 2.1, 0, 3.3, 0, 0, 0.8, -0.1, 0, 0.8, -1.5], 3)); sg.computeVertexNormals();
    const sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: sailHex, roughness: 0.9, side: THREE.DoubleSide })); sail.castShadow = true; g.add(sail);
    return g;
  }
  [[0xb5503f, 0xfff3dc, 52, 0.045, 0.0], [0x3f7f9a, 0xf3d98a, 66, -0.035, 2.0], [0x6a8f5a, 0xffffff, 80, 0.028, 4.0], [0xd9a441, 0xf6efe0, 46, -0.05, 5.5]].forEach(([h, s, r, w, ph]) => {
    const b = makeBoat(h, s); b.userData = { r, w, ph, bob: Math.random() * 6 }; scene.add(b); boats.push(b);
  });

  // gulls
  const gulls = [];
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.1, 0, 0, -0.1, 1.1, 0.12, -0.3], 3)); wingGeo.computeVertexNormals();
  for (let n = 0; n < 7; n++) {
    const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
    const wl = new THREE.Mesh(wingGeo, mat), wr = new THREE.Mesh(wingGeo, mat); wr.scale.x = -1; g.add(wl, wr);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.5), mat); g.add(body);
    g.userData = { wl, wr, r: 14 + hash(n, 1) * 22, h: 12 + hash(n, 2) * 10, w: (0.12 + hash(n, 3) * 0.12) * (n % 2 ? 1 : -1), ph: hash(n, 4) * 6.28, fl: 6 + hash(n, 5) * 4 };
    scene.add(g); gulls.push(g);
  }

  // puffy clouds that drift past
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.93, fog: false });
  for (let n = 0; n < 9; n++) {
    const g = new THREE.Group();
    for (let q = 0; q < 5; q++) { const s = new THREE.Mesh(new THREE.SphereGeometry(5 + hash(n, q) * 5, 10, 8), cloudMat); s.position.set((q - 2) * 7 + hash(n, q + 9) * 3, hash(n, q + 5) * 3, hash(n, q + 20) * 5); s.scale.y = 0.55; g.add(s); }
    const a = hash(n, 33) * Math.PI * 2, r = 120 + hash(n, 34) * 160; g.position.set(Math.cos(a) * r, 60 + hash(n, 35) * 40, Math.sin(a) * r); g.userData = { sp: 1.2 + hash(n, 36) * 1.5 };
    scene.add(g); clouds.push(g);
  }

  // faraway islands
  const isleMat = new THREE.MeshStandardMaterial({ color: 0x9fb89a, roughness: 1, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb8aea0, roughness: 1, flatShading: true });
  for (let n = 0; n < 9; n++) {
    const a = (n / 9) * Math.PI * 2 + hash(n, 50), r = 150 + hash(n, 51) * 90; const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.ConeGeometry(18 + hash(n, 52) * 18, 12 + hash(n, 53) * 18, 7), rockMat); rock.position.y = 2; g.add(rock);
    const top = new THREE.Mesh(new THREE.ConeGeometry(12 + hash(n, 54) * 10, 6, 7), isleMat); top.position.y = 9 + hash(n, 53) * 10; g.add(top);
    g.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); scene.add(g);
  }

  // ---- day / night ---------------------------------------------------------------------------
  const day = { zen: C(0x5aa0e6), mid: C(0x9cc9ef), hor: C(0xffe2c4), fog: C(0xf7dcc0), hemiSky: C(0xcfe3ff), hemiGround: C(0xf4dcc0), sun: C(0xfff0d2), shallow: C(0x6fe0d2), deep: C(0x1d6f9a), cloud: C(0xffffff) };
  const night = { zen: C(0x0b1636), mid: C(0x1f2f5e), hor: C(0x56507a), fog: C(0x2d3256), hemiSky: C(0x93aaf0), hemiGround: C(0x4c5290), sun: C(0xb8c8ff), shallow: C(0x2a6f8f), deep: C(0x0b2a52), cloud: C(0x5b6590) };
  let nightAmt = 0;
  const tmp = new THREE.Color();
  function setNight(v) {
    nightAmt = v;
    su.uZenith.value.copy(day.zen).lerp(night.zen, v); su.uMid.value.copy(day.mid).lerp(night.mid, v); su.uHorizon.value.copy(day.hor).lerp(night.hor, v);
    su.uStars.value = Math.max(0, (v - 0.35) / 0.65) * 0.9; su.uCloudColor.value.copy(day.cloud).lerp(night.cloud, v); su.uSunColor.value.copy(C(0xffe2a8)).lerp(C(0xdfe8ff), v);
    su.uSunDir.value.set(-0.55 + v * 1.0, 0.42 - v * 0.05, -0.72 + v * 0.1).normalize();
    scene.fog.color.copy(day.fog).lerp(night.fog, v); hemi.color.copy(day.hemiSky).lerp(night.hemiSky, v); hemi.groundColor.copy(day.hemiGround).lerp(night.hemiGround, v);
    hemi.intensity = 1.55 - v * 0.4; sun.color.copy(day.sun).lerp(night.sun, v); sun.intensity = 2.7 - v * 1.7;
    const d = sunDirDay.clone().lerp(new THREE.Vector3(0.5, 0.55, 0.45).normalize(), v).normalize(); sun.position.copy(d).multiplyScalar(90);
    seaMat.userData.u.uShallow.value.copy(day.shallow).lerp(night.shallow, v); seaMat.userData.u.uDeep.value.copy(day.deep).lerp(night.deep, v);
    glassMat.emissiveIntensity = v * 1.25 + 0.02; cloudMat.color.copy(day.cloud).lerp(night.cloud, v); cloudMat.opacity = 0.93 - v * 0.25;
    renderer.toneMappingExposure = 1.0 + v * 0.1;
  }
  setNight(0);

  // ---- Upgrade 64: islands (each has its own sky, sea and weather), decorations, fireworks -------------------------------------------------
  const THEMES = {
    harbour: { day: { zen: 0x5aa0e6, mid: 0x9cc9ef, hor: 0xffe2c4, fog: 0xf7dcc0, hemiSky: 0xcfe3ff, hemiGround: 0xf4dcc0, sun: 0xfff0d2, shallow: 0x6fe0d2, deep: 0x1d6f9a, cloud: 0xffffff }, weather: null, sunK: 1 },
    sunset: { day: { zen: 0x4a5fa8, mid: 0xe89a7a, hor: 0xffc27a, fog: 0xf2b48a, hemiSky: 0xffd2b0, hemiGround: 0xe0a080, sun: 0xffb070, shallow: 0x7fc8c0, deep: 0x2a5a8a, cloud: 0xffd6b8 }, weather: null, sunK: 0.9 },
    frost: { day: { zen: 0x8fb2d8, mid: 0xc8dceb, hor: 0xeef3f6, fog: 0xe6edf2, hemiSky: 0xeaf2ff, hemiGround: 0xdfe6ee, sun: 0xfff6ea, shallow: 0x9fd6dc, deep: 0x3d6f8f, cloud: 0xf4f6f8 }, weather: "snow", sunK: 0.8 },
    lantern: { day: { zen: 0x2b2a6a, mid: 0x6a4a9a, hor: 0xf2a07a, fog: 0x6a5a8a, hemiSky: 0xb0a0e0, hemiGround: 0x806090, sun: 0xffb890, shallow: 0x4a8aa0, deep: 0x1a2a5a, cloud: 0xc0a0d0 }, weather: "lanterns", sunK: 0.55, glow: 0.7 },
    coral: { day: { zen: 0x2a9ad8, mid: 0x7fd0f0, hor: 0xd8f6ff, fog: 0xd8f2f6, hemiSky: 0xe0f6ff, hemiGround: 0xfff0d0, sun: 0xffffe8, shallow: 0x4fe8d8, deep: 0x0f8fb0, cloud: 0xffffff }, weather: null, sunK: 1.1 },
    storm: { day: { zen: 0x4a5560, mid: 0x7a8590, hor: 0xa8b0b8, fog: 0x9aa4ae, hemiSky: 0xb8c4d0, hemiGround: 0x8a9098, sun: 0xd8e0ea, shallow: 0x4a7a88, deep: 0x1f3a4a, cloud: 0x8a929c }, weather: "rain", sunK: 0.55 },
  };
  let theme = THEMES.harbour, sunBase = 2.7, glowExtra = 0;
  const wxCount = 1400, wxPos = new Float32Array(wxCount * 3), wxSeed = new Float32Array(wxCount);
  for (let n = 0; n < wxCount; n++) { wxPos[n * 3] = (Math.random() - 0.5) * 110; wxPos[n * 3 + 1] = Math.random() * 45; wxPos[n * 3 + 2] = (Math.random() - 0.5) * 110; wxSeed[n] = Math.random(); }
  const wxGeo = new THREE.BufferGeometry(); wxGeo.setAttribute("position", new THREE.BufferAttribute(wxPos, 3));
  const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return t; })();
  const wxMat = new THREE.PointsMaterial({ size: 0.35, map: dotTex, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.9, fog: true });
  const wx = new THREE.Points(wxGeo, wxMat); wx.frustumCulled = false; wx.visible = false; scene.add(wx);
  function setTheme(id) {
    theme = THEMES[id] || THEMES.harbour;
    for (const k in theme.day) day[k] = C(theme.day[k]);
    sunBase = 2.7 * theme.sunK; glowExtra = theme.glow || 0;
    wx.visible = !!theme.weather;
    if (theme.weather === "snow") { wxMat.size = 0.38; wxMat.color.setHex(0xffffff); wxMat.blending = THREE.NormalBlending; }
    if (theme.weather === "rain") { wxMat.size = 0.16; wxMat.color.setHex(0xcfd8e6); wxMat.blending = THREE.NormalBlending; }
    if (theme.weather === "lanterns") { wxMat.size = 0.7; wxMat.color.setHex(0xffb35a); wxMat.blending = THREE.AdditiveBlending; }
    wxMat.needsUpdate = true;
    setNightThemed(nightAmt);
  }
  const _setNight = setNight;
  // (setNight is re-applied with the island's daylight strength and window glow)
  function setNightThemed(v) { _setNight(v); sun.intensity = sunBase - v * 1.7 * Math.min(1, sunBase / 2.7); glassMat.emissiveIntensity = Math.max(glassMat.emissiveIntensity, glowExtra * 1.2); }

  const propGroup = new THREE.Group(); scene.add(propGroup); let propObjs = [];
  function setProps(list) {
    for (const o of propObjs) propGroup.remove(o); propObjs = [];
    for (const p of list) { const o = makeProp(p.type, p.seed || 0); const [cx, cz] = cellCenter(p.i, p.j); const y = p.type === "boat" ? 0.05 : BASE + p.k * H; o.position.set(cx, y, cz); o.userData.baseY = y; o.rotation.y = (p.seed || 0) * 1.3; propGroup.add(o); propObjs.push(o); }
  }
  function fireworks(x, y, z, n = 3) {
    const cols = [0xff6b6b, 0xffd166, 0x6bdcff, 0xb48cff, 0x7cff9b];
    for (let b = 0; b < n; b++) { const bx = x + (Math.random() - 0.5) * 16, by = y + 10 + Math.random() * 8, bz = z + (Math.random() - 0.5) * 16; const col = new THREE.Color(cols[(b + Math.floor(Math.random() * 5)) % 5]); setTimeout(() => puff(bx, by, bz, col, 26, 9), b * 260); }
  }

  function setTown(built) {
    const swap = (mesh, geo) => { mesh.geometry.dispose(); mesh.geometry = geo || new THREE.BufferGeometry(); };
    swap(town, built.main); swap(glass, built.glass); swap(foam, built.foam); swap(pick, built.pick);
    pick.userData.info = built.pickInfo;
  }

  let time = 0;
  function update(dt, camPos) {
    time += dt; seaMat.userData.u.uTime.value = time; sky.userData.update(time, camPos);
    for (const b of boats) { const u = b.userData; const a = u.ph + time * u.w; b.position.set(Math.cos(a) * u.r, Math.sin(time * 1.3 + u.bob) * 0.08 - 0.05, Math.sin(a) * u.r); b.rotation.y = -a + (u.w > 0 ? 0 : Math.PI) + Math.PI; b.rotation.z = Math.sin(time * 0.9 + u.bob) * 0.04; }
    for (const g of gulls) { const u = g.userData; const a = u.ph + time * u.w; g.position.set(Math.cos(a) * u.r, u.h + Math.sin(time * 0.6 + u.ph) * 1.5, Math.sin(a) * u.r); g.rotation.y = -a + (u.w > 0 ? Math.PI : 0); const f = Math.sin(time * u.fl + u.ph) * 0.6; u.wl.rotation.z = f; u.wr.rotation.z = -f; g.rotation.z = u.w > 0 ? -0.25 : 0.25; }
    for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 300) c.position.x = -300; }
    for (const o of propObjs) o.userData.update && o.userData.update(time, nightAmt);
    if (wx.visible) { const a = wxGeo.attributes.position.array, w = theme.weather; for (let n = 0; n < wxCount; n++) { const s = wxSeed[n]; if (w === "snow") { a[n * 3 + 1] -= dt * (1.2 + s * 1.2); a[n * 3] += Math.sin(time * 0.7 + s * 20) * dt * 0.6; if (a[n * 3 + 1] < 0) a[n * 3 + 1] = 45; } else if (w === "rain") { a[n * 3 + 1] -= dt * (22 + s * 8); if (a[n * 3 + 1] < 0) a[n * 3 + 1] = 45; } else { a[n * 3 + 1] += dt * (0.6 + s * 0.8); a[n * 3] += Math.sin(time * 0.3 + s * 30) * dt * 0.3; if (a[n * 3 + 1] > 45) a[n * 3 + 1] = 0; } } wxGeo.attributes.position.needsUpdate = true; }
    for (let n = rings.length - 1; n >= 0; n--) { const m = rings[n]; m.userData.t += dt; const t = m.userData.t / 1.1; m.scale.setScalar(1 + t * 5); m.material.opacity = Math.max(0, 0.8 * (1 - t)); if (t >= 1) { scene.remove(m); m.material.dispose(); rings.splice(n, 1); } }
    for (let n = puffs.length - 1; n >= 0; n--) { const m = puffs[n]; const u = m.userData; u.t += dt; u.vy -= 9 * dt; m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; m.scale.setScalar(Math.max(0.01, 1 - u.t / 0.8)); m.material.opacity = Math.max(0, 1 - u.t / 0.8); if (u.t > 0.8) { scene.remove(m); m.material.dispose(); puffs.splice(n, 1); } }
  }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    foamTex.dispose();
  }
  return { scene, sea, town, glass, foam, pick, sun, update, setNight: setNightThemed, setTheme, setProps, fireworks, setTown, setGhost, hideGhost, ring, puff, dispose, getNight: () => nightAmt };
}
