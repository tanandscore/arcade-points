"use client";
// Skyguard city: a procedural skyscraper city (merged geometry, window textures, traffic, lamps). All art is built in code.
import { THREE, mesh, glowMesh, sprite, rnd, clamp } from "@/threeplay/core";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const N = 8, P = 90, BLK = 64, HALF = (N * P) / 2;
const PAL = [["#4a5468", "#ffd98a"], ["#5a4a48", "#ffe9b0"], ["#3a4a58", "#9fe0ff"], ["#56565e", "#ffcf7a"], ["#403a52", "#ffb0e0"]];

function facadeTex(wall, lit, seed, emissive) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 192; const g = c.getContext("2d");
  g.fillStyle = emissive ? "#000" : wall; g.fillRect(0, 0, 128, 192);
  let s = seed * 9301 + 49297; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
    const x = col * 32 + 5, y = row * 32 + 7, on = r() < 0.55;
    if (emissive) { if (on) { g.fillStyle = r() < 0.2 ? "#ffffff" : lit; g.globalAlpha = 0.55 + r() * 0.45; g.fillRect(x, y, 22, 18); g.globalAlpha = 1; } }
    else { g.fillStyle = on ? "#1c2230" : "#10151f"; g.fillRect(x, y, 22, 18); g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x, y, 22, 3); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
export function scaledBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, fw = [d, d, 0, 0, w, w];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; if (f === 2 || f === 3) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, uv.getX(i) * (fw[f] / 16), uv.getY(i) * (h / 24)); }
  return geo;
}
const FMAT = {};
export function facadeMat(pi, night) {
  const k = pi + (night ? "n" : "d"); if (FMAT[k]) return FMAT[k]; const [wall, lit] = PAL[pi % PAL.length];
  return (FMAT[k] = new THREE.MeshStandardMaterial({ map: facadeTex(wall, lit, pi + 3, false), emissiveMap: facadeTex(wall, lit, pi + 3, true), emissive: 0xffffff, emissiveIntensity: night ? 1.5 : 0.08, roughness: 0.7, metalness: 0.15 }));
}
function groundTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"), k = 512 / P, b = (P - BLK) / 2;
  g.fillStyle = "#23262e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},.025)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 2 + Math.random() * 6); }
  g.fillStyle = "#555a64"; g.fillRect(b * k - 6, b * k - 6, BLK * k + 12, BLK * k + 12); g.fillStyle = "#3a3e46"; g.fillRect(b * k, b * k, BLK * k, BLK * k);
  g.strokeStyle = "#d9d27a"; g.lineWidth = 3; g.setLineDash([22, 18]);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 0); g.moveTo(0, 512); g.lineTo(512, 512); g.moveTo(0, 0); g.lineTo(0, 512); g.moveTo(512, 0); g.lineTo(512, 512); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// opts: mood "dusk" | "night" | "day" | "dawn"
export function buildCity(rig, o = {}) {
  const { scene } = rig, night = o.mood === "night" || o.mood === "dusk" || o.mood === "storm", boxes = [], towers = [];
  const rand = (() => { let s = (o.seed ?? 7) * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const gt = groundTex(); gt.repeat.set(N + 6, N + 6);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(P * (N + 6), P * (N + 6)), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.92, metalness: 0.02 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = 0; scene.add(ground);
  const groups = PAL.map(() => []);
  const addBox = (cx, cz, w, d, h, pi) => {
    const geo = scaledBox(w, h, d);
    geo.translate(cx, h / 2, cz); groups[pi].push(geo); boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y1: h });
  };
  const roofs = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const bx = (i - (N - 1) / 2) * P, bz = (j - (N - 1) / 2) * P, dist = Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2), core = clamp(1.25 - dist / 5.2, 0.25, 1.2);
    const lots = rand() < 0.3 ? 1 : 2, sz = BLK / lots;
    for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
      const w = sz - 3 - rand() * 4, d = sz - 3 - rand() * 4, h = (18 + rand() * 62) * core + (rand() < 0.12 ? 40 : 0), cx = bx - BLK / 2 + sz * (a + 0.5), cz = bz - BLK / 2 + sz * (b + 0.5);
      if (i === (N >> 1) && j === (N >> 1) && a === 0 && b === 0) continue;
      addBox(cx, cz, w, d, h, Math.floor(rand() * PAL.length)); roofs.push({ x: cx, z: cz, y: h, w, d });
      if (h > 70 && rand() < 0.8) { const sp = mesh(new THREE.CylinderGeometry(0.15, 0.4, 14, 5), 0x888c94, { metal: 0.6 }); sp.position.set(cx, h + 7, cz); scene.add(sp); const bl = glowMesh(new THREE.SphereGeometry(0.7, 8, 6), 0xff3a2a, 3); bl.position.set(cx, h + 14, cz); scene.add(bl); roofs[roofs.length - 1].beacon = bl; }
      towers.push({ x: cx, z: cz, h, w, d });
    }
  }
  // City Hall: the landmark in the middle
  const hall = new THREE.Group(), hx = 0 - P / 2 * 0 - BLK / 4 + 0, hz = 0 - BLK / 4;
  const hallMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.6, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(26, 40, 26), hallMat), mid = new THREE.Mesh(new THREE.BoxGeometry(18, 40, 18), hallMat), top = new THREE.Mesh(new THREE.BoxGeometry(11, 36, 11), hallMat), spire = new THREE.Mesh(new THREE.ConeGeometry(4.5, 26, 4), new THREE.MeshStandardMaterial({ color: 0x3a7a6a, roughness: 0.5, metalness: 0.4 }));
  base.position.y = 20; mid.position.y = 60; top.position.y = 98; spire.position.y = 129; spire.rotation.y = Math.PI / 4; [base, mid, top, spire].forEach((m) => { m.castShadow = m.receiveShadow = true; hall.add(m); });
  const clock = glowMesh(new THREE.CylinderGeometry(3, 3, 0.6, 20), 0xffe9a0, 1.5); clock.rotation.x = Math.PI / 2; clock.position.set(0, 98, 5.8); hall.add(clock);
  hall.position.set(hx, 0, hz); scene.add(hall);
  boxes.push({ x0: hx - 13, x1: hx + 13, z0: hz - 13, z1: hz + 13, y1: 40 }, { x0: hx - 9, x1: hx + 9, z0: hz - 9, z1: hz + 9, y1: 80 }, { x0: hx - 5.5, x1: hx + 5.5, z0: hz - 5.5, z1: hz + 5.5, y1: 116 });
  const hallTop = new THREE.Vector3(hx, 122, hz);
  PAL.forEach(([wall, lit], pi) => {
    if (!groups[pi].length) return;
    const geo = mergeGeometries(groups[pi]); const m = new THREE.MeshStandardMaterial({ map: facadeTex(wall, lit, pi + 3, false), emissiveMap: facadeTex(wall, lit, pi + 3, true), emissive: 0xffffff, emissiveIntensity: night ? 1.5 : 0.08, roughness: 0.7, metalness: 0.15 });
    const mm = new THREE.Mesh(geo, m); mm.castShadow = true; mm.receiveShadow = true; scene.add(mm);
  });
  // street lamps + traffic
  const lampPts = []; for (let i = -1; i < N; i++) for (let k = 0; k < N * 3; k++) { const sx = (i - (N - 1) / 2) * P + P / 2, sz = -HALF + (k + 0.5) * (P / 3); lampPts.push([sx - 11, sz], [sz, sx + 11]); }
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 5), new THREE.MeshBasicMaterial({ color: night ? 0xffe7b0 : 0xbfc4cc }), lampPts.length), mt = new THREE.Matrix4();
  lampPts.forEach(([x, z], i) => { mt.makeTranslation(x, 7, z); lamps.setMatrixAt(i, mt); }); scene.add(lamps);
  const cars = [], CARN = 70, carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, 1.3, 4.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.5 }), CARN), col = new THREE.Color();
  for (let i = 0; i < CARN; i++) { const horiz = i % 2, line = Math.floor(rand() * (N + 1)) - 1, off = (line - (N - 1) / 2) * P + P / 2, lane = rand() < 0.5 ? -4 : 4; cars.push({ horiz, c: off + lane, p: (rand() - 0.5) * N * P, v: (lane < 0 ? -1 : 1) * (9 + rand() * 9) }); carMesh.setColorAt(i, col.setHSL(rand(), 0.5, 0.45)); }
  scene.add(carMesh); const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3(), ax = new THREE.Vector3(0, 1, 0);
  const city = {
    boxes, towers, roofs, hallTop, hallPos: new THREE.Vector3(hx, 0, hz), half: HALF + 40,
    // streets are the gaps; returns a position on a street centre line
    streetPoint(i, j) { return new THREE.Vector3((i - (N - 1) / 2) * P + P / 2, 0, (j - (N - 1) / 2) * P + P / 2); },
    update(dt, t) {
      for (let i = 0; i < CARN; i++) { const c = cars[i]; c.p += c.v * dt; if (c.p > HALF + 20) c.p = -HALF - 20; if (c.p < -HALF - 20) c.p = HALF + 20; if (c.horiz) { pp.set(c.p, 0.75, c.c); q.setFromAxisAngle(ax, c.v > 0 ? Math.PI / 2 : -Math.PI / 2); } else { pp.set(c.c, 0.75, c.p); q.setFromAxisAngle(ax, c.v > 0 ? 0 : Math.PI); } tmpM.compose(pp, q, sc); carMesh.setMatrixAt(i, tmpM); }
      carMesh.instanceMatrix.needsUpdate = true; for (const r of roofs) if (r.beacon) r.beacon.material.emissiveIntensity = 1 + Math.sin(t * 3 + r.x) * 2.2;
    },
    // push a sphere out of the buildings; returns true if it touched one
    collide(p, r) {
      let hit = false;
      for (const b of boxes) { if (p.y - r > b.y1 || p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue; const dx = Math.min(p.x - (b.x0 - r), b.x1 + r - p.x), dz = Math.min(p.z - (b.z0 - r), b.z1 + r - p.z), dy = b.y1 + r - p.y; const m = Math.min(dx, dz, dy); if (m === dy) p.y = b.y1 + r; else if (m === dx) p.x += p.x - b.x0 < b.x1 - p.x ? -dx : dx; else p.z += p.z - b.z0 < b.z1 - p.z ? -dz : dz; hit = true; }
      if (p.y < r) { p.y = r; hit = true; } return hit;
    },
    dispose() {},
  };
  return city;
}

// A plaza arena for the street fights: a roundish paved court ringed by buildings, with parked cars and crates to throw.
export function buildPlaza(rig, o = {}) {
  const { scene } = rig, R = o.R ?? 17, props = [], rim = [];
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R + 2, R + 2, 0.4, 56), new THREE.MeshStandardMaterial({ color: o.floor ?? 0x4a4e58, roughness: 0.85 })); floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const road = new THREE.Mesh(new THREE.RingGeometry(R - 3, R + 6, 56), new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.95 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; scene.add(road);
  const mark = glowMesh(new THREE.TorusGeometry(R - 0.8, 0.07, 6, 72), o.ring ?? 0xffd24a, 1.4); mark.rotation.x = Math.PI / 2; mark.position.y = 0.04; scene.add(mark);
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 1 })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.5; scene.add(gnd);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd(-0.05, 0.05), d = R + 12 + rnd(0, 14), w = rnd(10, 18), h = rnd(26, 110), dd = rnd(10, 18);
    const b = new THREE.Mesh(scaledBox(w, h, dd), facadeMat(i % PAL.length, o.night !== false)); b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); b.rotation.y = -a + Math.PI / 2; scene.add(b);
  }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const pole = mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 6), 0x2a2d36, { metal: 0.5 }); pole.position.set(Math.cos(a) * (R + 0.5), 4, Math.sin(a) * (R + 0.5)); scene.add(pole); const lh = glowMesh(new THREE.SphereGeometry(0.5, 8, 6), o.lamp ?? 0xffe0a0, 3); lh.position.set(Math.cos(a) * (R + 0.5), 8.1, Math.sin(a) * (R + 0.5)); scene.add(lh); if (i % 3 === 0) { const pl = new THREE.PointLight(o.lamp ?? 0xffe0a0, 14, 30, 1.6); pl.position.copy(lh.position); scene.add(pl); } }
  const make = (kind, x, z, ang) => {
    const g = new THREE.Group(), hue = rnd(0, 1), c = new THREE.Color().setHSL(hue, 0.55, 0.42);
    if (kind === "car") { const b = mesh(new THREE.BoxGeometry(2.1, 0.8, 4.4), c, { metal: 0.5, rough: 0.35 }); b.position.y = 0.7; g.add(b); const t = mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), c.clone().multiplyScalar(0.8), { metal: 0.5, rough: 0.3 }); t.position.set(0, 1.35, -0.2); g.add(t); const gl = mesh(new THREE.BoxGeometry(1.7, 0.5, 2.0), 0x20303c, { metal: 0.8, rough: 0.1 }); gl.position.set(0, 1.38, -0.2); gl.scale.set(1.02, 0.9, 1.02); g.add(gl); for (const [sx, sz] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]]) { const w = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), 0x15171c); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, 0.4, sz); g.add(w); } const hl = glowMesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), 0xfff2c0, 1.5); hl.position.set(0, 0.8, 2.22); g.add(hl); }
    else { const b = mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), 0x9a7a4a, { rough: 0.9 }); b.position.y = 0.7; g.add(b); const s = mesh(new THREE.BoxGeometry(1.45, 0.12, 1.45), 0x6a4e2a); s.position.y = 0.7; g.add(s); }
    g.position.set(x, 0, z); g.rotation.y = ang; scene.add(g);
    const p = { kind, node: g, pos: g.position, vel: new THREE.Vector3(), r: kind === "car" ? 2.2 : 0.9, flying: false, hp: 1, dead: false, held: false, spin: 0 }; props.push(p); return p;
  };
  (o.props || []).forEach(([k, x, z, a]) => make(k, x, z, a || 0));
  return { R, props, make, collide(p, r) { const d = Math.hypot(p.x, p.z), lim = R - 0.6 - r; if (d > lim) { p.x *= lim / d; p.z *= lim / d; } } };
}
