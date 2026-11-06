// Operation Blacksite — daylight dressing for the three outdoor maps. Plastered, painted and weathered facades (one skin per wall face),
// arched windows with shutters, flower boxes and iron balconies, wooden doors, striped awnings, ivy, tiled eaves and parapets, string lights,
// painted shop signs, soft ground-contact shadows, stains on the floor, and a living skyline beyond the walls: domes and minarets (bazaar),
// cranes, ships, stacked containers and the sea (harbor), pitched tile roofs, a bell tower and hills (old quarter).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { wallSkin } from "./skins";
import { cpuCanvas } from "./cpucanvas";

const cv = (w, h) => cpuCanvas(w, h);
const mkTex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
function rngOf(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shade = (n, k) => { const r = Math.min(255, ((n >> 16) & 255) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k); return `rgb(${r | 0},${g | 0},${b | 0})`; };

// ---- facade skins -----------------------------------------------------------------------------------------------------------------
const SKIN_BASES = {
  bazaar: [0xcdb68c, 0xc2a97c, 0xd6c298, 0xb89f72, 0xcab488],
  harbor: [0x9a9ea2, 0xaeaaa0, 0x8a9096, 0xa0503a, 0x7a8890],
  quarter: [0xc8b090, 0xbca488, 0xd2c0a2, 0xb09880, 0xcdb99c],
};
const doorTexture = (col) => { const c = cv(128, 256), g = c.getContext("2d"), r = rngOf(col); g.fillStyle = hex(col); g.fillRect(0, 0, 128, 256); for (let x = 0; x < 128; x += 21) { g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x, 0, 2, 256); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,230,200"},0.08)`; g.fillRect(x + r() * 18, r() * 256, 1 + r() * 2, 8 + r() * 30); } } g.fillStyle = "#20201e"; for (const y of [40, 128, 216]) { g.fillRect(0, y - 6, 128, 12); for (let x = 8; x < 128; x += 20) { g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fill(); } } g.fillStyle = "#d0a840"; g.beginPath(); g.arc(98, 130, 6, 0, 6.3); g.fill(); return mkTex(c); };
const awningTexture = () => { const c = cv(128, 64), g = c.getContext("2d"); for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16) % 2 ? "#ffffff" : "#d4d4d4"; g.fillRect(x, 0, 16, 64); } g.fillStyle = "rgba(0,0,0,0.15)"; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 1, 64); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.22)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 64); g.fillStyle = "rgba(255,255,255,0.92)"; for (let x = 0; x < 128; x += 8) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 8, 56); g.lineTo(x + 4, 64); g.fill(); } return mkTex(c, true, true); };
const ivyTexture = () => { const c = cv(128, 256), g = c.getContext("2d"), r = rngOf(7); g.clearRect(0, 0, 128, 256); for (let i = 0; i < 380; i++) { const y = 256 - Math.pow(r(), 2.1) * 256, x = r() * 128; g.fillStyle = ["#3a5a30", "#44663a", "#527244", "#2c4a28", "#62804a"][(r() * 5) | 0]; g.beginPath(); g.ellipse(x, y, 4 + r() * 6, 3 + r() * 5, r() * 3, 0, 6.3); g.fill(); } return mkTex(c); };
const shadowTexture = () => { const c = cv(8, 64), g = c.getContext("2d"); const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, "rgba(30,20,12,0.78)"); gr.addColorStop(0.35, "rgba(30,20,12,0.3)"); gr.addColorStop(0.7, "rgba(30,20,12,0.08)"); gr.addColorStop(1, "rgba(34,22,12,0)"); g.fillStyle = gr; g.fillRect(0, 0, 8, 64); return mkTex(c); };
const stainTexture = (seed, kind) => { const c = cv(128, 128), g = c.getContext("2d"), r = rngOf(seed); g.clearRect(0, 0, 128, 128); const n = kind === "oil" ? 6 : 14; for (let i = 0; i < n; i++) { const x = 20 + r() * 88, y = 20 + r() * 88, rad = 8 + r() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const col = kind === "oil" ? "20,22,26" : kind === "sand" ? "225,200,150" : "70,52,34"; gr.addColorStop(0, `rgba(${col},${0.22 + r() * 0.25})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } return mkTex(c); };
const windowGlassTexture = () => { const c = cv(64, 128), g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#5a7898"); gr.addColorStop(0.5, "#26394a"); gr.addColorStop(1, "#141e28"); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); g.strokeStyle = "rgba(10,14,18,0.8)"; g.lineWidth = 3; g.strokeRect(0, 0, 64, 128); g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 128); g.moveTo(0, 56); g.lineTo(64, 56); g.stroke(); g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.moveTo(6, 4); g.lineTo(26, 4); g.lineTo(6, 50); g.fill(); return mkTex(c); };
const farWindowTex = (base) => { const c = cv(128, 128), g = c.getContext("2d"), r = rngOf(base); g.fillStyle = hex(base); g.fillRect(0, 0, 128, 128); for (let y = 8; y < 128; y += 26) for (let x = 8; x < 128; x += 24) { g.fillStyle = r() < 0.2 ? "#d8e4ea" : "#2e3e50"; g.fillRect(x, y, 10, 14); } const im = g.getImageData(0, 0, 128, 128), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0); return mkTex(c, true, true); };

// ---- geometry helpers ------------------------------------------------------------------------------------------------------------
function archShape(w, h, p = new THREE.Shape()) { const r = w / 2; p.moveTo(-r, 0); p.lineTo(r, 0); p.lineTo(r, h - r); p.absarc(0, h - r, r, 0, Math.PI, false); p.lineTo(-r, 0); return p; }
function archFrame(w, h, t, depth) { const s = archShape(w + t * 2, h + t); const hole = new THREE.Path(); const r = w / 2; hole.moveTo(-r, 0.0); hole.lineTo(-r, h - r); hole.absarc(0, h - r, r, Math.PI, 0, true); hole.lineTo(r, 0.0); hole.lineTo(-r, 0.0); s.holes.push(hole); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); return g; }
const withColor = (geo, col) => { const g = geo.index ? geo.toNonIndexed() : geo; const c = new THREE.Color(col); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); if (g.attributes.uv === undefined) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g; };
const xf = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)); const g = geo.clone(); g.applyMatrix4(m); return g; };
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
const stripUV = (g) => { const n = nonIdx(g); return n; };
function mergeColored(list) { const gs = list.map((g) => { const n = nonIdx(g); if (!n.attributes.color) { const a = new Float32Array(n.attributes.position.count * 3).fill(1); n.setAttribute("color", new THREE.BufferAttribute(a, 3)); } if (!n.attributes.uv) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); if (!n.attributes.normal) n.computeVertexNormals(); for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) n.deleteAttribute(k); return n; }); return mergeGeometries(gs, false); }

export function addDayDress(scene, ctx) {
  const { faces, R, map, CELL, WALL_H, P, track, W, D, look, def } = ctx; const kind = look.dress; const out = { update: () => {} };
  const dummy = new THREE.Object3D(); dummy.rotation.order = "YXZ"; const std = (o) => track(new THREE.MeshStandardMaterial(o));
  const inst = (geo, material, list, fn, shadow = false) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, material, list.length); const col = new THREE.Color(); let any = false;
    list.forEach((f, n) => { const c = fn(f, n); dummy.position.copy(c.pos); dummy.rotation.set(c.rx || 0, Math.atan2(f.nx, f.nz) + (c.ry || 0), c.rz || 0); dummy.scale.set(c.sx || 1, c.sy || 1, c.sz || 1); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); if (c.color !== undefined) { col.setHex(c.color); im.setColorAt(n, col); any = true; } });
    dummy.scale.set(1, 1, 1); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  const pick = (a) => a[Math.floor(R() * a.length)];
  const zid = (f) => (f.zone ? f.zone.id : "");

  // ---- facade skins: five painted variants, one sheet over each exposed wall face -------------------------------------------------
  const bases = SKIN_BASES[kind] || SKIN_BASES.bazaar; const skins = bases.map((b, i) => wallSkin(101 + i * 17, b, kind, i));
  const skinMats = skins.map((t) => track(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  const skinGeo = new THREE.PlaneGeometry(CELL * 1.0, WALL_H * 0.995); const groups = skins.map(() => []);
  for (const f of faces) { const k = Math.floor(R() * skins.length); f.skin = k; groups[k].push(f); }
  groups.forEach((list, k) => inst(skinGeo, skinMats[k], list, (f) => ({ pos: P(f, WALL_H * 0.4975, 0.03) }), false));

  // ground-contact shadow at the foot of every wall
  const aoMat = track(new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  inst(new THREE.PlaneGeometry(CELL, 1.5), aoMat, faces, (f) => ({ pos: P(f, 0.75, 0.05), color: undefined }));
  // contact shadow on the floor itself (a darker strip right at the base)
  const aoFloor = track(new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  inst(new THREE.PlaneGeometry(CELL, 1.0), aoFloor, faces, (f) => ({ pos: new THREE.Vector3(f.x + f.nx * 0.5, 0.02, f.z + f.nz * 0.5), rx: -Math.PI / 2, ry: 0 }));

  // ---- windows: arched, framed in stone, glass that reflects the sky, wooden shutters, sills, flower boxes ----------------------------------
  const winW = 0.84, winH = 1.5; const stoneCol = look.trim ?? 0xe6d4b2;
  const frameGeo = archFrame(winW, winH, 0.12, 0.14); const glassGeo = xf(new THREE.ShapeGeometry(archShape(winW, winH), 10), 0, 0, 0.05);
  const glassUV = glassGeo.attributes.uv; { const pos = glassGeo.attributes.position; for (let i = 0; i < pos.count; i++) glassUV.setXY(i, (pos.getX(i) + winW / 2) / winW, pos.getY(i) / winH); }
  const shutterPalette = kind === "harbor" ? [0x44586a, 0x5e3a2e] : [0x4a6a58, 0x3c5a7a, 0x6a4a34, 0x7a3a34, 0x44444a];
  const shL = xf(new THREE.BoxGeometry(winW * 0.52, winH * 0.96, 0.035), -winW / 2 - winW * 0.26 * Math.cos(0.9) + winW * 0.02, winH * 0.48, 0.16, 0, 0.9, 0);
  const shR = xf(new THREE.BoxGeometry(winW * 0.52, winH * 0.96, 0.035), winW / 2 + winW * 0.26 * Math.cos(0.9) - winW * 0.02, winH * 0.48, 0.16, 0, -0.9, 0);
  const slats = (sx) => { const parts = []; for (let k = 0; k < 7; k++) parts.push(xf(new THREE.BoxGeometry(winW * 0.46, 0.012, 0.012), sx * (winW / 2 + winW * 0.26 * Math.cos(0.9) - winW * 0.02), 0.2 + k * 0.18, 0.18, 0, sx * -0.9, 0)); return parts; };
  const sill = xf(new THREE.BoxGeometry(winW + 0.42, 0.07, 0.24), 0, -0.035, 0.12);
  const flowerCols = [0xb04050, 0xc8aa4a, 0xdcdcd4, 0xa0609a, 0xc87a3a];
  const fb = [xf(new THREE.BoxGeometry(winW + 0.2, 0.2, 0.22), 0, -0.18, 0.2), ...Array.from({ length: 9 }, (_, i) => withColor(xf(new THREE.IcosahedronGeometry(0.075 + (i % 3) * 0.015, 0), -winW / 2 - 0.02 + (i / 8) * (winW + 0.04), -0.02 + (i % 2) * 0.04, 0.2 + ((i * 7) % 3 - 1) * 0.03), i % 4 === 0 ? flowerCols[i % 5] : 0x3a7a30))];
  const boxWood = withColor(fb[0], 0x6a4a2c);
  const flowers = mergeColored([boxWood, ...fb.slice(1)]);
  const winFaces = faces.filter((f, n) => f.zone && R() < (kind === "harbor" ? 0.1 : 0.34));
  const frameMat = std({ color: stoneCol, roughness: 0.9 }); const glassMat = std({ map: windowGlassTexture(), roughness: 0.12, metalness: 0.35, envMapIntensity: 1.8 });
  const wood = std({ color: 0xffffff, roughness: 0.85 }); const flowerMat = std({ color: 0xffffff, vertexColors: true, roughness: 0.9 });
  const rows = (f) => (R() < 0.55 ? [1.9, 4.35] : [4.0]); const wins = []; winFaces.forEach((f) => rows(f).forEach((y) => wins.push({ f, y })));
  const winInst = (geo, mat, extra) => inst(geo, mat, wins, (w) => ({ pos: P(w.f, w.y, 0.03), ...(extra ? extra(w) : {}) })); // pos uses face basis
  const asFace = (w) => w.f; // helper for inst (needs f.nx/nz)
  const instW = (geo, mat, colorFn, shadow = false) => { const list = wins.map((w) => ({ nx: w.f.nx, nz: w.f.nz, x: w.f.x, z: w.f.z, y: w.y, c: w })); if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); const col = new THREE.Color(); list.forEach((q, n) => { const off = (((q.c.f.ci * 7 + q.c.f.cj * 13) % 3) - 1) * 0.5; const ox = (q.nz !== 0 ? 1 : 0) * 0, ox2 = 0; dummy.position.set(q.x + q.nx * 0.03 + (q.nz !== 0 ? off : 0), q.y, q.z + q.nz * 0.03 + (q.nx !== 0 ? off : 0)); dummy.rotation.set(0, Math.atan2(q.nx, q.nz), 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); if (colorFn) { col.setHex(colorFn(q.c, n)); im.setColorAt(n, col); } }); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im; };
  instW(frameGeo, frameMat, null, true); instW(glassGeo, glassMat, null);
  instW(mergeGeometries([nonIdx(shL), nonIdx(shR)].map((g) => { const x = g.clone(); for (const k of Object.keys(x.attributes)) if (!["position", "normal", "uv"].includes(k)) x.deleteAttribute(k); return x; }), false), std({ color: 0xffffff, roughness: 0.85 }), (w, n) => pick(shutterPalette), true);
  instW(nonIdx(sill), frameMat, null, true);
  { const list = wins.filter((w) => R() < 0.14); const im = new THREE.InstancedMesh(flowers, flowerMat, list.length); list.forEach((w, n) => { const f = w.f; const off = (((f.ci * 7 + f.cj * 13) % 3) - 1) * 0.5; dummy.position.set(f.x + f.nx * 0.03 + (f.nz !== 0 ? off : 0), w.y, f.z + f.nz * 0.03 + (f.nx !== 0 ? off : 0)); dummy.rotation.set(0, Math.atan2(f.nx, f.nz), 0); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); }); im.receiveShadow = true; if (list.length) scene.add(im); }

  // ---- doors with studs and a stone arch -----------------------------------------------------------------------------------------------
  const doorFaces = faces.filter((f) => f.zone && R() < (kind === "harbor" ? 0.08 : 0.16) && !winFaces.includes(f));
  const doorW = 1.1, doorH = 2.35;
  const doorFrame = archFrame(doorW, doorH, 0.16, 0.16); const doorLeaf = xf(new THREE.ShapeGeometry(archShape(doorW, doorH), 10), 0, 0, 0.06);
  { const pos = doorLeaf.attributes.position, uv = doorLeaf.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + doorW / 2) / doorW, pos.getY(i) / doorH); }
  const doorTex = [0x5a3a22, 0x3a4a5a, 0x4a5a3a, 0x6a2a22].map(doorTexture);
  const doorMats = doorTex.map((t) => std({ map: t, roughness: 0.8 }));
  const dgroups = doorTex.map(() => []); doorFaces.forEach((f) => dgroups[Math.floor(R() * doorTex.length)].push(f));
  dgroups.forEach((list, k) => inst(doorLeaf, doorMats[k], list, (f) => ({ pos: P(f, 0.02, 0.03) })));
  inst(doorFrame, frameMat, doorFaces, (f) => ({ pos: P(f, 0.02, 0.03) }), true);
  inst(new THREE.BoxGeometry(doorW + 0.5, 0.12, 0.5), frameMat, doorFaces, (f) => ({ pos: P(f, 0.06, 0.28) }), true);

  // ---- striped awnings over doors and some windows -------------------------------------------------------------------------------------
  const awnFaces = faces.filter((f) => f.zone && R() < (kind === "harbor" ? 0.03 : 0.1));
  const awnMat = track(new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.9, side: THREE.DoubleSide }));
  const awnPal = look.awning || [0xc8402a, 0x2a6aa8];
  inst(new THREE.PlaneGeometry(CELL * 0.86, 1.25), awnMat, awnFaces, (f) => ({ pos: P(f, 3.05, 0.62), rx: -0.5, color: pick(awnPal) }), true);
  inst(new THREE.CylinderGeometry(0.03, 0.03, CELL * 0.88, 6).rotateZ(Math.PI / 2), std({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }), awnFaces, (f) => ({ pos: P(f, 2.58, 1.2) }));

  // ---- iron balconies with a flower box -------------------------------------------------------------------------------------------------
  if (kind !== "harbor") {
    const balFaces = faces.filter((f) => f.zone && R() < 0.07 && !awnFaces.includes(f));
    const iron = std({ color: 0x1c1d20, roughness: 0.45, metalness: 0.8 }); const parts = [xf(new THREE.BoxGeometry(2.0, 0.12, 0.74), 0, 0, 0.37)];
    parts.push(xf(new THREE.BoxGeometry(2.0, 0.05, 0.05), 0, 0.98, 0.72)); for (let k = 0; k <= 9; k++) parts.push(xf(new THREE.BoxGeometry(0.03, 0.92, 0.03), -0.98 + k * 0.218, 0.5, 0.72)); for (const s of [-1, 1]) { parts.push(xf(new THREE.BoxGeometry(0.05, 0.05, 0.7), s * 0.99, 0.98, 0.37)); for (let k = 1; k < 3; k++) parts.push(xf(new THREE.BoxGeometry(0.03, 0.92, 0.03), s * 0.99, 0.5, 0.1 + k * 0.2)); }
    inst(mergeGeometries(parts.map(nonIdx).map((g) => { const x = g.clone(); for (const k of Object.keys(x.attributes)) if (!["position", "normal", "uv"].includes(k)) x.deleteAttribute(k); return x; }), false), iron, balFaces, (f) => ({ pos: P(f, 3.5, 0.03) }), true);
    inst(flowers, flowerMat, balFaces, (f) => ({ pos: P(f, 3.62, 0.62), sx: 1.5 }));
    // arched French door behind each balcony
    inst(frameGeo, frameMat, balFaces, (f) => ({ pos: P(f, 3.62, 0.04), sy: 1.2 }), true); inst(glassGeo, glassMat, balFaces, (f) => ({ pos: P(f, 3.62, 0.04), sy: 1.2 }));
  }

  // ---- ivy, string lights, hanging banners ----------------------------------------------------------------------------------------------
  if (kind !== "harbor") {
    const ivyF = faces.filter((f) => f.zone && R() < 0.07); const ivyMat = track(new THREE.MeshStandardMaterial({ map: ivyTexture(), transparent: true, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide }));
    inst(new THREE.PlaneGeometry(CELL * 0.9, 3.8), ivyMat, ivyF, (f) => ({ pos: P(f, 1.9, 0.09) }));
    const bulbF = faces.filter((f) => f.zone && R() < 0.04); const bulbMat = track(new THREE.MeshBasicMaterial({ color: 0xfff0b8, toneMapped: false })); const wire = std({ color: 0x1a1a1a, roughness: 0.6 });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 5), bulbMat, bulbF.length * 7); let bi = 0;
    bulbF.forEach((f) => { for (let k = 0; k < 7; k++) { const u = (k / 6 - 0.5) * CELL * 0.94, sag = Math.sin((k / 6) * Math.PI) * -0.22; const sx = f.nz !== 0 ? u : 0, sz = f.nx !== 0 ? u : 0; dummy.position.set(f.x + f.nx * 0.28 + sx, 4.95 + sag, f.z + f.nz * 0.28 + sz); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); bulbs.setMatrixAt(bi++, dummy.matrix); } });
    if (bulbF.length) scene.add(bulbs);
    const wireG = new THREE.BoxGeometry(CELL * 0.96, 0.012, 0.012); inst(wireG, wire, bulbF, (f) => ({ pos: P(f, 4.86, 0.28), ry: f.nz !== 0 ? 0 : Math.PI / 2 }));
    inst(wireG, wire, bulbF, (f) => ({ pos: P(f, 4.86, 0.28), ry: f.nz !== 0 ? 0 : Math.PI / 2 })); // (same strand twice is harmless; keeps thin wire visible)
    const banF = faces.filter((f) => f.zone && R() < 0.04); const banMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }));
    inst(new THREE.PlaneGeometry(0.62, 1.9), banMat, banF, (f) => ({ pos: P(f, 4.4, 0.34), color: pick([0x9a4034, 0x35607e, 0xb08c3a, 0x44704f, 0xd8d0c0]), rx: 0.06 }));
    inst(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6).rotateZ(Math.PI / 2), wire, banF, (f) => ({ pos: P(f, 5.38, 0.34), ry: 0 }));
  } else {
    // harbor: coloured roller doors, hazard-striped bases, bollard lamps already in the skin; add steel roller doors and signal lamps
    const rollF = faces.filter((f) => f.zone && R() < 0.1); const rollMat = std({ color: 0x8a8f94, roughness: 0.5, metalness: 0.6 });
    inst(new THREE.BoxGeometry(CELL * 0.8, 3.2, 0.12), rollMat, rollF, (f) => ({ pos: P(f, 1.6, 0.07), color: pick([0x8a8f94, 0x9a4a2a, 0x2a5a7a]) }), true);
    const lampF = faces.filter((f) => f.zone && R() < 0.12); inst(new THREE.SphereGeometry(0.13, 8, 6), track(new THREE.MeshBasicMaterial({ color: 0xff3a1a, toneMapped: false })), lampF, (f) => ({ pos: P(f, 3.6, 0.2) }));
  }

  // ---- eaves, parapets and cornices along the roofline ----------------------------------------------------------------------------------------------
  const topF = faces;
  if (kind === "quarter") {
    const tile = std({ color: look.roof ?? 0xa8704a, roughness: 0.8 }); inst(new THREE.BoxGeometry(CELL * 1.02, 0.16, 0.95), tile, topF, (f) => ({ pos: P(f, WALL_H + 0.1, 0.45), rx: 0.2 }), true);
    inst(new THREE.BoxGeometry(CELL * 1.02, 0.26, 0.3), frameMat, topF, (f) => ({ pos: P(f, WALL_H - 0.3, 0.16) }), true);
  } else if (kind === "bazaar") {
    const merlon = new THREE.BoxGeometry(0.5, 0.5, 0.34); inst(new THREE.BoxGeometry(CELL * 1.02, 0.28, 0.4), frameMat, topF, (f) => ({ pos: P(f, WALL_H + 0.03, 0.2) }), true);
    for (const o of [-0.8, 0, 0.8]) inst(merlon, frameMat, topF, (f) => ({ pos: new THREE.Vector3(f.x + f.nx * 0.2 + (f.nz !== 0 ? o : 0), WALL_H + 0.39, f.z + f.nz * 0.2 + (f.nx !== 0 ? o : 0)), ry: 0 }), true);
  } else {
    inst(new THREE.BoxGeometry(CELL * 1.02, 0.34, 0.4), std({ color: 0x6a6e72, roughness: 0.6, metalness: 0.5 }), topF, (f) => ({ pos: P(f, WALL_H + 0.1, 0.2) }), true);
  }

  // ---- painted shop signs on selected zones -------------------------------------------------------------------------------------------------------------
  const signList = def.signZones || [];
  const signTexDay = (text, color, sub) => { const c = cv(512, 192), g = c.getContext("2d"); g.fillStyle = "#f4ead2"; g.fillRect(0, 0, 512, 192); g.strokeStyle = color; g.lineWidth = 12; g.strokeRect(14, 14, 484, 164); g.fillStyle = color; g.font = "bold 78px ui-sans-serif, Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, sub ? 82 : 96); if (sub) { g.font = "bold 30px ui-sans-serif, sans-serif"; g.fillText(sub, 256, 148); } return mkTex(c); };
  const used = new Set();
  for (const [zoneId, text, color, sub] of signList) {
    const cand = faces.filter((f) => f.zone && f.zone.id === zoneId && !used.has(f));
    if (!cand.length) continue; const zr = def.zones.find((z) => z.id === zoneId).rect; const cx = ((zr[0] + zr[2] + 1) / 2) * CELL, cz = ((zr[1] + zr[3] + 1) / 2) * CELL;
    cand.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)); const f = cand[0]; used.add(f);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.98), track(new THREE.MeshStandardMaterial({ map: signTexDay(text, color, sub), roughness: 0.7 }))); m.position.copy(P(f, 4.3, 0.1)); m.rotation.y = Math.atan2(f.nx, f.nz); m.castShadow = false; scene.add(m);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.74, 1.12, 0.06), std({ color: 0x3a2a1c, roughness: 0.8 })); frame.position.copy(P(f, 4.3, 0.06)); frame.rotation.y = m.rotation.y; scene.add(frame);
  }

  // ---- stains and tracks on the floor -------------------------------------------------------------------------------------------------------------------------
  const stainKinds = kind === "harbor" ? ["oil", "oil", "dirt"] : kind === "bazaar" ? ["sand", "dirt", "sand"] : ["dirt", "dirt", "sand"];
  const stainMats = stainKinds.map((k, i) => track(new THREE.MeshBasicMaterial({ map: stainTexture(300 + i * 11, k), transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  const stPlane = new THREE.PlaneGeometry(1, 1); stPlane.rotateX(-Math.PI / 2);
  stainMats.forEach((m, k) => { const n = 46; const im = new THREE.InstancedMesh(stPlane, m, n); let c = 0; for (let tries = 0; tries < 300 && c < n; tries++) { const i = Math.floor(R() * map.COLS), j = Math.floor(R() * map.ROWS); if (map.solid[j * map.COLS + i]) continue; const x = (i + R()) * CELL, z = (j + R()) * CELL; const s = 1.2 + R() * 3.8; dummy.position.set(x, 0.012 + k * 0.001, z); dummy.rotation.set(0, R() * 6.28, 0); dummy.scale.set(s, 1, s * (0.6 + R() * 0.8)); dummy.updateMatrix(); im.setMatrixAt(c++, dummy.matrix); } im.count = c; dummy.scale.set(1, 1, 1); scene.add(im); });

  // ---- skyline and scenery beyond the walls -----------------------------------------------------------------------------------------------------------------
  const far = look.far || {}; const skyCols = look.skylineColors || [0xd8c8a8];
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std({ color: far.ground ?? 0xb8996a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.12, D / 2); ground.receiveShadow = true; scene.add(ground);
  if (look.sea) { const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 520), std({ color: look.sea, roughness: 0.08, metalness: 0.55, envMapIntensity: 1.4 })); sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, -0.05, kind === "harbor" ? D + 270 : D + 300); scene.add(sea); if (kind === "quarter") { sea.position.set(-330, -0.05, D / 2); sea.rotation.z = Math.PI / 2; } }
  const farTexes = skyCols.map((c, i) => farWindowTex(c)); const farMats = farTexes.map((t) => std({ map: t, roughness: 0.95 }));
  const bld = new THREE.BoxGeometry(1, 1, 1); const placed = [];
  const addBlock = (x, z, w, d, h, ci) => { const m = new THREE.Mesh(bld, farMats[ci % farMats.length]); m.scale.set(w, h, d); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); farMats[ci % farMats.length].map.repeat.set(Math.max(1, w / 9), Math.max(1, h / 9)); placed.push({ x, z, w, d, h }); return m; };
  const roofMat = std({ color: look.roof ?? 0xa8704a, roughness: 0.8 }); const domeGold = std({ color: 0xe0b440, roughness: 0.3, metalness: 0.8 }); const domeTeal = std({ color: 0x2a9aa0, roughness: 0.4, metalness: 0.4 }); const white = std({ color: 0xf0e8d8, roughness: 0.8 });
  const sideN = () => { const arr = []; for (let side = 0; side < 4; side++) { let t = -30; while (t < (side % 2 ? D : W) + 30) { const w = 9 + R() * 12, dep = 9 + R() * 14, gap = 1 + R() * 4; const off = 5 + R() * 30; const x = side === 0 ? t + w / 2 : side === 1 ? W + off + dep / 2 : side === 2 ? t + w / 2 : -off - dep / 2; const z = side === 0 ? -off - dep / 2 : side === 1 ? t + w / 2 : side === 2 ? D + off + dep / 2 : t + w / 2; arr.push({ x, z, w: side % 2 ? dep : w, d: side % 2 ? w : dep, side }); t += w + gap; } } return arr; };
  for (const b of sideN()) {
    if (kind === "harbor" && ((b.side === 2) || R() < 0.15)) continue; // sea side stays open
    if (kind === "quarter" && b.side === 3) continue;
    const h = kind === "harbor" ? 6 + R() * 8 : 9 + R() * 17; const ci = Math.floor(R() * 6);
    addBlock(b.x, b.z, b.w, b.d, h, ci);
    if (kind === "quarter") { const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.72, 3.4 + R() * 2.2, 4), roofMat); r.rotation.y = Math.PI / 4; r.scale.set(b.w / Math.max(b.w, b.d), 1, b.d / Math.max(b.w, b.d)); r.position.set(b.x, h + 1.7, b.z); r.castShadow = true; scene.add(r); }
    else if (kind === "bazaar" && R() < 0.4) { const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(b.w, b.d) * 0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), R() < 0.5 ? domeGold : domeTeal); dome.position.set(b.x, h, b.z); dome.castShadow = true; scene.add(dome); const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), domeGold); spire.position.set(b.x, h + Math.min(b.w, b.d) * 0.4 + 1.2, b.z); scene.add(spire); }
    else if (kind === "bazaar" && R() < 0.25) { const mn = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 22, 12), white); mn.position.set(b.x + b.w * 0.3, h + 11, b.z); mn.castShadow = true; scene.add(mn); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.6, 12), domeTeal); cone.position.set(b.x + b.w * 0.3, h + 23.8, b.z); scene.add(cone); const bal = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 12), white); bal.position.set(b.x + b.w * 0.3, h + 19, b.z); scene.add(bal); }
    else if (kind === "harbor") { const tank = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 12), std({ color: 0x8a8f94, roughness: 0.6, metalness: 0.4 })); tank.position.set(b.x, h + 1.5, b.z); scene.add(tank); }
  }
  if (kind === "quarter") { // bell tower with a clock face
    const tx = W + 24, tz = D * 0.3; addBlock(tx, tz, 8, 8, 34, 2); const pyr = new THREE.Mesh(new THREE.ConeGeometry(6.4, 11, 4), roofMat); pyr.rotation.y = Math.PI / 4; pyr.position.set(tx, 39.5, tz); pyr.castShadow = true; scene.add(pyr);
    const ck = cv(128, 128), cg = ck.getContext("2d"); cg.fillStyle = "#f4ecd8"; cg.beginPath(); cg.arc(64, 64, 60, 0, 6.3); cg.fill(); cg.strokeStyle = "#2a2018"; cg.lineWidth = 6; cg.stroke(); cg.lineWidth = 5; cg.beginPath(); cg.moveTo(64, 64); cg.lineTo(64, 24); cg.moveTo(64, 64); cg.lineTo(92, 74); cg.stroke(); const face = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ map: mkTex(ck) })); face.position.set(tx - 4.05, 28, tz); face.rotation.y = -Math.PI / 2; scene.add(face);
  }
  if (kind === "harbor") { // gantry cranes, a ship and stacked containers on the sea side
    const steel = std({ color: 0xd8582a, roughness: 0.5, metalness: 0.4 }); const gray = std({ color: 0x6a7076, roughness: 0.6, metalness: 0.5 });
    for (const cx of [W * 0.22, W * 0.52, W * 0.8]) { const g = new THREE.Group(); const legs = [[-9, -6], [9, -6], [-9, 6], [9, 6]]; legs.forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 38, 1.2), steel); l.position.set(x, 19, z); g.add(l); }); const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 2.2), steel); beam.position.set(0, 38, -6); g.add(beam); const beam2 = beam.clone(); beam2.position.z = 6; g.add(beam2); const boom = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 56), steel); boom.position.set(0, 39, -22); boom.rotation.x = -0.12; g.add(boom); const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), gray); cab.position.set(0, 36, -14); g.add(cab); g.position.set(cx, 0, -50); scene.add(g); }
    const hull = new THREE.Mesh(new THREE.BoxGeometry(150, 14, 28), std({ color: 0x2a3a4a, roughness: 0.5, metalness: 0.3 })); hull.position.set(W * 0.62, 7, D + 120); scene.add(hull); const stripe = new THREE.Mesh(new THREE.BoxGeometry(151, 3, 28.2), std({ color: 0xb02a22, roughness: 0.6 })); stripe.position.set(W * 0.62, 12, D + 120); scene.add(stripe); const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 20), std({ color: 0xe8e8e4, roughness: 0.6 })); bridge.position.set(W * 0.62 - 55, 24, D + 120); scene.add(bridge);
    const cc = look.contCols || [0xb8402a]; for (let k = 0; k < 40; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(12.2, 2.6, 2.5), std({ color: cc[k % cc.length], roughness: 0.6, metalness: 0.4 })); m.position.set(W * 0.62 - 50 + (k % 8) * 12.4, 16.6 + Math.floor(k / 20) * 2.7, D + 120 + (Math.floor(k / 8) % 2 ? 4 : -4)); scene.add(m); }
  }
  // hills and tree lines
  const hillMat = std({ color: far.hills ?? 0x6a7a6a, roughness: 1 }); const nh = 9; for (let k = 0; k < nh; k++) { const a = (k / nh) * Math.PI * 2 + 0.3, rr = 360 + R() * 80; const hl = new THREE.Mesh(new THREE.SphereGeometry(70 + R() * 70, 16, 8), hillMat); hl.scale.set(1.8, 0.45 + R() * 0.3, 1.3); hl.position.set(W / 2 + Math.cos(a) * rr, -8, D / 2 + Math.sin(a) * rr); scene.add(hl); }
  const trunkM = std({ color: 0x5a4028, roughness: 0.9 }); const leafM = [std({ color: 0x3f7a34, roughness: 0.9 }), std({ color: 0x4a8a3a, roughness: 0.9 }), std({ color: 0x2f6a30, roughness: 0.9 })];
  const palms = kind !== "quarter"; const NT = 50; const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), trunkM, NT); const crowns = new THREE.InstancedMesh(palms ? new THREE.ConeGeometry(2.8, 2.2, 7) : new THREE.IcosahedronGeometry(2.6, 1), leafM[1], NT);
  let nt = 0; for (let tries = 0; tries < 400 && nt < NT; tries++) { const a = R() * 4; let x, z; const off = 4 + R() * 24; if (a < 1) { x = R() * W; z = -off; } else if (a < 2) { x = W + off; z = R() * D; } else if (a < 3) { x = R() * W; z = D + off; } else { x = -off; z = R() * D; } if (placed.some((p) => Math.abs(p.x - x) < p.w / 2 + 3 && Math.abs(p.z - z) < p.d / 2 + 3)) continue; if (kind === "harbor" && z > D) continue; if (kind === "quarter" && x < 0) continue; const h = palms ? 6 + R() * 5 : 3 + R() * 2; dummy.position.set(x, h / 2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); trunks.setMatrixAt(nt, dummy.matrix); dummy.position.set(x, h + (palms ? 0.6 : 1.8), z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.setScalar(0.8 + R() * 0.6); dummy.updateMatrix(); crowns.setMatrixAt(nt, dummy.matrix); nt++; }
  trunks.count = nt; crowns.count = nt; trunks.castShadow = true; crowns.castShadow = true; scene.add(trunks, crowns); dummy.scale.set(1, 1, 1);
  return out;
}
