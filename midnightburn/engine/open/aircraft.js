// Midnight Burn — airliners. A proper aeroplane built from lofted parts: a tapered fuselage with an up-swept tail, swept wings with winglets,
// twin engines with inlets, a tail fin and tailplane, a nose cockpit, a lit window strip, a painted cheat-line, retractable undercarriage
// and the real set of night lights (red/green navigation lights, white strobes, a red belly beacon and landing lights).
// The model points along +x, y is up, z is the right wing.
import * as THREE from "three";

// swept wing panel for the +z side: root chord, tip chord, span, sweep of the tip's leading edge, dihedral lift at the tip and thickness
function panel(root, tip, span, sweep, lift, tR, tT) {
  const A = [0, tR / 2, 0], B = [-root, tR / 2, 0], C = [-sweep - tip, lift + tT / 2, span], D = [-sweep, lift + tT / 2, span];
  const a = [0, -tR / 2, 0], b = [-root, -tR / 2, 0], c = [-sweep - tip, lift - tT / 2, span], d = [-sweep, lift - tT / 2, span];
  const pos = []; const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  quad(A, B, C, D); quad(a, d, c, b); quad(A, D, d, a); quad(B, b, c, C); quad(A, a, b, B); quad(D, C, c, d);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const glowTex = (() => { if (typeof document === "undefined") return null; const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
const windowTex = (() => { if (typeof document === "undefined") return null; const c = document.createElement("canvas"); c.width = 256; c.height = 16; const x = c.getContext("2d"); x.fillStyle = "#0a0a10"; x.fillRect(0, 0, 256, 16); x.fillStyle = "#ffe3a8"; for (let i = 0; i < 32; i++) x.fillRect(i * 8 + 1, 3, 5, 9); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();

export const LIVERIES = [[0xd8261f, 0xf2f2f2], [0x1c4fa8, 0xe8c24a], [0xf28a00, 0x2a2a30], [0x1a8a4a, 0xf2f2f2], [0x5b2d8e, 0xf2c14a], [0xc99a2e, 0x1c2a4a], [0x20a6c8, 0xf2f2f2]];
const SPEC = {
  narrow: { L: 37.5, R: 1.95, root: 6.4, tip: 1.7, span: 17.2, sweep: 7.6, wx: 2.2, ey: -1.5, ez: 5.8, eR: 1.05, eL: 3.8, fin: [6.6, 2.5, 7.0, 4.2], stab: [3.8, 1.3, 6.4, 3.0], gear: 1.75 },
  wide: { L: 63.7, R: 3.1, root: 11.5, tip: 3.0, span: 30.5, sweep: 13.5, wx: 4.0, ey: -2.3, ez: 10.2, eR: 1.75, eL: 6.2, fin: [11, 4, 11.5, 7], stab: [6.4, 2.0, 10.5, 5.0], gear: 2.7 },
};

export function makeAirliner(kind, livIdx, envMap) {
  const S = SPEC[kind] || SPEC.narrow; const [tailC, accC] = LIVERIES[livIdx % LIVERIES.length];
  const g = new THREE.Group(); const u = { gear: null, strobes: [], nav: [], beacon: null, landing: [], S };
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f3f6, roughness: 0.38, metalness: 0.45, envMap, envMapIntensity: 0.8, vertexColors: true });
  const wingM = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.45, metalness: 0.5, envMap, envMapIntensity: 0.7, side: THREE.DoubleSide });
  const tailM = new THREE.MeshStandardMaterial({ color: tailC, roughness: 0.4, metalness: 0.3, envMap, envMapIntensity: 0.6, side: THREE.DoubleSide });
  const accM = new THREE.MeshStandardMaterial({ color: accC, roughness: 0.45, metalness: 0.2 }), darkM = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35, metalness: 0.7, envMap, envMapIntensity: 0.9 });
  const engM = new THREE.MeshStandardMaterial({ color: 0xe4e7ec, roughness: 0.35, metalness: 0.6, envMap, envMapIntensity: 0.7 });
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  // fuselage: a lathe turned about its length, tail swept upwards, white top and grey belly
  { const N = 40, pts = []; for (let i = 0; i <= N; i++) { const v = i / N; let r = 1; if (v < 0.2) r = 0.1 + 0.9 * Math.sin((v / 0.2) * Math.PI / 2); else if (v > 0.9) r = Math.sqrt(Math.max(0.0025, 1 - Math.pow((v - 0.9) / 0.1, 2))); pts.push(new THREE.Vector2(r * S.R, (v - 0.5) * S.L)); }
    const fg = new THREE.LatheGeometry(pts, 22); fg.rotateZ(-Math.PI / 2); const pa = fg.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const tx = (-x - S.L * 0.3) / (S.L * 0.2); if (tx > 0) pa.setY(i, y + tx * tx * S.R * 0.55); const c = y < -S.R * 0.28 ? 0.62 : 1; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c; }
    fg.setAttribute("color", new THREE.BufferAttribute(col, 3)); fg.computeVertexNormals(); add(fg, white, 0, 0, 0); }
  // cockpit glass, cheat-line, lit passenger windows
  add(new THREE.BoxGeometry(S.R * 0.55, S.R * 0.26, S.R * 1.55), darkM, S.L / 2 - S.R * 1.55, S.R * 0.38, 0).rotation.z = -0.35;
  for (const sd of [-1, 1]) {
    add(new THREE.BoxGeometry(S.L * 0.78, S.R * 0.1, 0.06), accM, S.L * 0.02, -S.R * 0.05, sd * (S.R * 0.995));
    const wm = new THREE.MeshBasicMaterial({ map: windowTex, toneMapped: false }); const wp = new THREE.PlaneGeometry(S.L * 0.62, S.R * 0.17); wp.rotateY(sd > 0 ? 0 : Math.PI); const w = add(wp, wm, S.L * 0.04, S.R * 0.3, sd * (S.R * 0.955)); wm.map = windowTex.clone(); wm.map.needsUpdate = true; wm.map.repeat.set(S.L * 0.62 / 3.2, 1); wm.map.wrapS = THREE.RepeatWrapping;
  }
  // wings with winglets, engines with inlets
  const wg = panel(S.root, S.tip, S.span, S.sweep, S.span * 0.07, S.R * 0.28, S.R * 0.1);
  for (const sd of [1, -1]) {
    const w = add(wg, wingM, S.wx, -S.R * 0.42, 0); w.scale.z = sd;
    const wl = add(new THREE.BoxGeometry(S.tip * 1.1, S.R * 0.95, 0.12), wingM, S.wx - S.sweep - S.tip * 0.55, -S.R * 0.42 + S.span * 0.07 + S.R * 0.45, sd * S.span); wl.rotation.x = sd * 0.12; wl.rotation.z = 0.18;
    const ex = S.wx + 1.6, ez = sd * S.ez; add(new THREE.BoxGeometry(S.eL * 0.6, S.eR * 0.9, 0.3), wingM, ex - 0.2, S.ey * 0.55, ez);
    const eng = add(new THREE.CylinderGeometry(S.eR, S.eR * 0.82, S.eL, 20), engM, ex, S.ey, ez); eng.rotation.z = Math.PI / 2;
    const inlet = add(new THREE.CylinderGeometry(S.eR * 0.9, S.eR * 0.9, 0.3, 20), darkM, ex + S.eL / 2 + 0.05, S.ey, ez); inlet.rotation.z = Math.PI / 2;
    const noz = add(new THREE.ConeGeometry(S.eR * 0.6, S.eR * 1.1, 16), darkM, ex - S.eL / 2 - S.eR * 0.45, S.ey, ez); noz.rotation.z = Math.PI / 2;
    const band = add(new THREE.CylinderGeometry(S.eR * 1.02, S.eR * 1.02, 0.35, 20), tailM, ex + S.eL * 0.32, S.ey, ez); band.rotation.z = Math.PI / 2;
    // tailplane
    const sp = S.stab; add(panel(sp[0], sp[1], sp[2], sp[3], 0.5, S.R * 0.14, S.R * 0.07), wingM, -S.L / 2 + sp[0] + 0.5, S.R * 0.62, 0).scale.z = sd;
    // navigation lights at the wingtips
    const tipX = S.wx - S.sweep - S.tip * 0.5, tipY = -S.R * 0.42 + S.span * 0.07 + 0.2;
    const nv = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: sd > 0 ? 0x30ff60 : 0xff2a2a, toneMapped: false })); nv.position.set(tipX, tipY, sd * (S.span + 0.1)); g.add(nv); u.nav.push(nv);
    const sv = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); sv.position.set(tipX - S.tip * 0.4, tipY, sd * (S.span + 0.1)); g.add(sv); u.strobes.push(sv);
    for (const m of [nv, sv]) { if (glowTex) { const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: m.material.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp2.scale.setScalar(kind === "wide" ? 26 : 18); m.add(sp2); m.userData.sp = sp2; } }
  }
  // vertical fin (the livery colour) with a rudder stripe
  { const f = S.fin; const fin = new THREE.Mesh(panel(f[0], f[1], f[2], f[3], 0, S.R * 0.12, S.R * 0.07), tailM); fin.rotation.x = -Math.PI / 2; fin.position.set(-S.L / 2 + f[0] + 1.5, S.R * 0.78, 0); g.add(fin); }
  // landing lights + belly beacon + tail strobe
  { const lm = new THREE.MeshBasicMaterial({ color: 0xfff6dd, toneMapped: false }); for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lm); l.position.set(S.wx + 1.5, -S.R * 0.55, sd * S.R * 2.4); g.add(l); u.landing.push(l); }
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); bm.position.set(0, -S.R * 0.98, 0); g.add(bm); u.beacon = bm;
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); ts.position.set(-S.L / 2 - 0.2, S.R * 0.95, 0); g.add(ts); u.strobes.push(ts);
    if (glowTex) for (const m of [bm, ts, ...u.landing]) { const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: m.material.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp2.scale.setScalar(m === bm ? 14 : 22); m.add(sp2); m.userData.sp = sp2; } }
  // undercarriage: nose leg and two main bogies
  { const gr = new THREE.Group(); const wh = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 }), st = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.4, metalness: 0.8 });
    const leg = (x, z, wheels) => { const l = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, S.gear, 8), st); sh.position.y = -S.R * 0.6 - S.gear / 2 + 0.4; l.add(sh); for (const wz of wheels) { const w = new THREE.Mesh(new THREE.CylinderGeometry(S.gear * 0.3, S.gear * 0.3, 0.38, 14), wh); w.rotation.x = Math.PI / 2; w.position.set(0, -S.R * 0.6 - S.gear + 0.4 + S.gear * 0.3 - 0.3, wz); l.add(w); } l.position.set(x, 0, z); gr.add(l); };
    leg(S.L / 2 - S.R * 3.2, 0, [-0.28, 0.28]); for (const sd of [-1, 1]) leg(-S.L * 0.06, sd * S.R * 1.55, [-0.35, 0.35]);
    g.add(gr); u.gear = gr; }
  u.sprites = []; g.traverse((o) => { if (o.isSprite) u.sprites.push(o); }); g.userData = u; g.traverse((o) => { o.frustumCulled = false; }); return g;
}
