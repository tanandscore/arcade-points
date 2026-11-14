"use client";
import { THREE, mesh, glowMesh, sprite, rnd, stoneTexture, floorTexture, grassTexture, noiseTexture, shade } from "@/threeplay/core";

export function torch(color = 0xffa040, light = true, intensity = 14, dist = 20) {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.3, 6), 0x3a2a1c, { rough: 0.8 }); pole.position.y = 0.65; g.add(pole);
  const bowl = mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.2, 8), 0x2a2a30, { rough: 0.5, metal: 0.6 }); bowl.position.y = 1.35; g.add(bowl);
  const core = sprite(0xfff0b0, 0.7, 1), halo = sprite(color, 2.0, 0.8); core.position.y = halo.position.y = 1.6; g.add(halo); g.add(core);
  let L = null; if (light) { L = new THREE.PointLight(color, intensity, dist, 1.6); L.position.y = 1.9; g.add(L); }
  g.userData.tick = (t, ph = 0) => { const f = 0.85 + 0.15 * Math.sin(t * 17 + ph) * Math.sin(t * 6.1 + ph); core.scale.set(0.6 * f, 0.9 * f, 1); halo.scale.set(1.9 * f, 2.2 * f, 1); if (L) L.intensity = intensity * (0.8 + 0.2 * f); };
  return g;
}

export function pillar(h = 7, r = 0.7, tex) {
  const g = new THREE.Group(); const t = tex || stoneTexture("#8a8a96", "#4a4a56", 1, 3);
  const sh = mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), 0x9a9aa6, { map: t, rough: 0.9 }); sh.position.y = h / 2; g.add(sh);
  const base = mesh(new THREE.BoxGeometry(r * 2.8, 0.5, r * 2.8), 0x8a8a96, { map: t, rough: 0.9 }); base.position.y = 0.25; g.add(base);
  const cap = mesh(new THREE.BoxGeometry(r * 2.8, 0.5, r * 2.8), 0x8a8a96, { map: t, rough: 0.9 }); cap.position.y = h - 0.25; g.add(cap);
  return g;
}

// A distant fairy-tale castle: keep, towers with cone roofs, curtain walls, glowing windows
export function makeCastle(seed = 1) {
  const g = new THREE.Group(), tex = stoneTexture("#8c8a98", "#4a4858", 2, 3), roof = 0x3a3f8a;
  const R = (n) => { const x = Math.sin(seed * 999 + n * 77.7) * 10000; return x - Math.floor(x); };
  const keep = mesh(new THREE.BoxGeometry(26, 34, 22), 0x9a98a8, { map: tex, rough: 0.9 }); keep.position.y = 17; g.add(keep);
  const kr = mesh(new THREE.ConeGeometry(19, 20, 4), roof, { rough: 0.8 }); kr.position.y = 44; kr.rotation.y = Math.PI / 4; g.add(kr);
  const spots = [[-17, -12], [17, -12], [-17, 12], [17, 12], [0, -16], [-26, 0], [26, 0]];
  spots.forEach((p, i) => { const h = 38 + R(i) * 22, r = 4 + R(i + 9) * 2; const t = mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 14), 0x908ea0, { map: tex, rough: 0.9 }); t.position.set(p[0], h / 2, p[1]); g.add(t); const c = mesh(new THREE.ConeGeometry(r * 1.35, r * 3.2, 14), i % 2 ? roof : 0x7a2a5a, { rough: 0.8 }); c.position.set(p[0], h + r * 1.6, p[1]); g.add(c); const fl = glowMesh(new THREE.SphereGeometry(0.22, 6, 6), 0xffe0a0, 0); fl.position.set(p[0], h + r * 3.3, p[1]); g.add(fl); });
  for (let i = 0; i < 46; i++) { const a = R(i + 50), b = R(i + 80); const w = glowMesh(new THREE.BoxGeometry(0.9, 2.2, 0.2), 0xffd488, 1.6 + R(i) * 1.4); const face = Math.floor(a * 4); const y = 4 + b * 28; if (face === 0) w.position.set(-11 + R(i + 5) * 22, y, 11.1); else if (face === 1) { w.position.set(-11 + R(i + 5) * 22, y, -11.1); } else if (face === 2) { w.position.set(13.1, y, -9 + R(i + 5) * 18); w.rotation.y = Math.PI / 2; } else { w.position.set(-13.1, y, -9 + R(i + 5) * 18); w.rotation.y = Math.PI / 2; } g.add(w); }
  const wall = mesh(new THREE.BoxGeometry(70, 10, 3), 0x8a8898, { map: tex, rough: 0.9 }); wall.position.set(0, 5, 24); g.add(wall);
  return g;
}

export function makeTerrain(hf, size, seg, colorFn) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = hf(x, z); p.setY(i, y); colorFn(y, x, z, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: noiseTexture("#ffffff", 22, size / 14, size / 14) })); m.receiveShadow = true; return m;
}

export function makeTrees(hf, n, area, avoid = () => false, colors = [0x2c6a3a, 0x347a40, 0x255a34]) {
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 2, 6), leafG = new THREE.ConeGeometry(1.7, 5, 7);
  const tr = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 1 }), n), lf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) { const x = rnd(-area, area), z = rnd(-area, area), y = hf(x, z); if (avoid(x, y, z) || y < 1.2 || y > 62) continue; const sc = rnd(0.8, 2.2); s.set(sc, sc, sc); pos.set(x, y + sc, z); m.compose(pos, q, s); tr.setMatrixAt(k, m); pos.set(x, y + sc * 2 + 1.8 * sc, z); m.compose(pos, q, s); lf.setMatrixAt(k, m); c.setHex(colors[(Math.random() * colors.length) | 0]).offsetHSL(0, 0, rnd(-0.04, 0.04)); lf.setColorAt(k, c); k++; }
  tr.count = lf.count = k; tr.castShadow = lf.castShadow = false; const g = new THREE.Group(); g.add(tr); g.add(lf); return g;
}

export function runeFloor(radius, color = 0x6fa8ff) {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d");
  g.fillStyle = "#4a4756"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${rnd(0, 0.04)})`; g.fillRect(rnd(0, 1024), rnd(0, 1024), rnd(2, 12), rnd(2, 12)); }
  g.translate(512, 512); const col = "#" + new THREE.Color(color).getHexString();
  g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 14; g.lineWidth = 6;
  for (const r of [470, 440, 300, 150]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
  g.lineWidth = 4; for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * 6.283); g.beginPath(); g.moveTo(0, 150); g.lineTo(0, 300); g.stroke(); g.beginPath(); g.moveTo(-24, 380); g.lineTo(0, 350); g.lineTo(24, 380); g.lineTo(0, 410); g.closePath(); g.stroke(); g.restore(); }
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 - 1.57; g.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); } g.closePath(); g.stroke();
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 - 1.57 + 3.14159 / 6 * 2; g.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); } g.closePath(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0x4a6ac0, emissiveIntensity: 0.45, roughness: 0.55, metalness: 0.1 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
export { stoneTexture, floorTexture, grassTexture, noiseTexture, shade };
