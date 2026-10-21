// In-car (cockpit) view: dashboard, live gauge cluster, steering wheel that turns, window pillars, mirror,
// a glowing nav screen, rain drops on the windscreen and wipers. Everything is attached to the camera.
import * as THREE from "three";

function clusterCanvas() { const c = document.createElement("canvas"); c.width = 512; c.height = 256; return c; }

function drawCluster(ctx, kmh, rpm, gear, nitro, t, accent) {
  const W = 512, H = 256; ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#07080c"); bg.addColorStop(1, "#10131c"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const dial = (cx, cy, r, v, maxLabel, ticks, red) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    if (red) { ctx.strokeStyle = "#ff3030"; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * (0.8 + 1.4 * red), Math.PI * 2.2); ctx.stroke(); }
    ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * v)); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.fillStyle = "#cfd6e8"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
    for (let k = 0; k <= ticks; k++) { const a = Math.PI * (0.8 + 1.4 * k / ticks); const x1 = cx + Math.cos(a) * (r - 14), y1 = cy + Math.sin(a) * (r - 14), x2 = cx + Math.cos(a) * (r - 24), y2 = cy + Math.sin(a) * (r - 24); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.fillText(String(Math.round(k * maxLabel / ticks)), cx + Math.cos(a) * (r - 40), cy + Math.sin(a) * (r - 40) + 4); }
    const a = Math.PI * (0.8 + 1.4 * v); ctx.strokeStyle = "#ff8a2d"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); ctx.stroke();
    ctx.fillStyle = "#1a1d27"; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill();
  };
  dial(110, 138, 96, Math.min(1, rpm), 8, 8, 0.82);
  dial(402, 138, 96, Math.min(1, kmh / 320), 320, 8, 0);
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "bold 62px monospace"; ctx.fillText(String(Math.round(kmh)), 256, 120);
  ctx.fillStyle = "#8fa0c0"; ctx.font = "bold 16px monospace"; ctx.fillText("KM/H", 256, 142);
  ctx.fillStyle = accent; ctx.font = "bold 44px monospace"; ctx.fillText(gear <= 0 ? "N" : String(gear), 256, 196);
  ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(196, 214, 120, 10); ctx.fillStyle = "#3df0ff"; ctx.fillRect(196, 214, 120 * Math.max(0, Math.min(1, nitro / 100)), 10);
  ctx.fillStyle = "#8fa0c0"; ctx.font = "11px monospace"; ctx.fillText("NITRO", 256, 240);
  if (Math.floor(t * 2) % 2 === 0 && rpm > 0.9) { ctx.fillStyle = "#ff3030"; ctx.beginPath(); ctx.arc(256, 28, 9, 0, 7); ctx.fill(); }
}

function dropsTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const x = c.getContext("2d");
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 520; i++) {
    const px = rnd() * 1024, py = rnd() * 512, r = 2 + rnd() * rnd() * 11;
    const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.35, "rgba(190,215,255,0.35)"); g.addColorStop(1, "rgba(120,150,210,0.04)");
    x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r * 0.86, r, 0, 0, 7); x.fill();
    if (r > 7 && rnd() < 0.5) { x.strokeStyle = "rgba(190,215,255,0.16)"; x.lineWidth = r * 0.5; x.beginPath(); x.moveTo(px, py + r); x.lineTo(px + (rnd() - 0.5) * 6, py + r + 20 + rnd() * 70); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createCockpit(accentHex = "#2de2ff") {
  const group = new THREE.Group(); group.visible = false; group.renderOrder = 50;
  const dark = new THREE.MeshLambertMaterial({ color: 0x08090c });
  const leather = new THREE.MeshLambertMaterial({ color: 0x0f1015 });
  const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(accentHex) });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };

  // dashboard: a wide soft slab, a raised hood over the gauges, an accent stitch line
  add(new THREE.BoxGeometry(2.8, 0.34, 0.9), leather, 0, -0.5, -0.8, -0.1);
  add(new THREE.BoxGeometry(0.5, 0.08, 0.3), dark, 0, -0.27, -0.68, -0.25);
  add(new THREE.BoxGeometry(2.7, 0.008, 0.008), accent, 0, -0.325, -0.4, -0.1);
  // door tops and A-pillars, roof header
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.3, 0.2, 1.2), dark, s * 0.85, -0.3, -0.5, 0, 0, s * 0.15);
    add(new THREE.BoxGeometry(0.07, 1.5, 0.08), dark, s * 0.78, 0.12, -0.55, 0.05, 0, s * 0.5);
    add(new THREE.BoxGeometry(0.03, 0.012, 0.6), accent, s * 0.74, -0.2, -0.5);
  }
  add(new THREE.BoxGeometry(3.2, 0.12, 0.16), dark, 0, 0.36, -0.55, 0.3);
  add(new THREE.BoxGeometry(0.34, 0.085, 0.07), dark, 0, 0.25, -0.5, -0.1);
  add(new THREE.BoxGeometry(0.3, 0.06, 0.012), new THREE.MeshStandardMaterial({ color: 0x202a3a, roughness: 0.04, metalness: 1 }), 0, 0.25, -0.462, -0.1);

  // instrument cluster (live canvas)
  const cc = clusterCanvas(), cctx = cc.getContext("2d"); const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  const cluster = add(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshBasicMaterial({ map: ctex }), 0, -0.205, -0.64, -0.5);
  add(new THREE.PlaneGeometry(0.385, 0.205), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, -0.205, -0.643, -0.5);
  // centre navigation screen
  const nc = document.createElement("canvas"); nc.width = 256; nc.height = 128; const nctx = nc.getContext("2d"); const ntex = new THREE.CanvasTexture(nc); ntex.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: ntex }), -0.46, -0.24, -0.66, -0.4, 0.3);
  // steering wheel
  const wheel = new THREE.Group(); wheel.position.set(0, -0.3, -0.5); wheel.rotation.x = -0.8; group.add(wheel);
  const spin = new THREE.Group(); wheel.add(spin);
  add(new THREE.TorusGeometry(0.175, 0.024, 12, 40), leather, 0, 0, 0, 0, 0, 0, spin);
  add(new THREE.TorusGeometry(0.175, 0.006, 6, 40, 0.5), accent, 0, 0, 0.0, 0, 0, Math.PI * 0.5 - 0.25, spin).position.z = 0.025;
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 20), dark, 0, 0, 0, Math.PI / 2, 0, 0, spin);
  for (const a of [0, 2.1, 4.2]) add(new THREE.BoxGeometry(0.17, 0.028, 0.012), dark, Math.cos(a + 1.57) * 0.09, Math.sin(a + 1.57) * 0.09, 0, 0, 0, a + 1.57, spin);
  // windscreen rain drops + wipers
  const dtex = dropsTexture(); dtex.wrapS = dtex.wrapT = THREE.RepeatWrapping; dtex.repeat.set(3, 2);
  const dmat = new THREE.MeshBasicMaterial({ map: dtex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending });
  const glassM = add(new THREE.PlaneGeometry(2.2, 1.1), dmat, 0, 0.12, -0.5); glassM.renderOrder = 60;
  const wipers = [-0.3, 0.3].map((px) => { const p = new THREE.Group(); p.position.set(px, -0.22, -0.5); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.4, 0.005), new THREE.MeshBasicMaterial({ color: 0x050506 })); arm.position.y = 0.2; p.add(arm); group.add(p); p.visible = false; return p; });
  const lamp = new THREE.PointLight(new THREE.Color(accentHex), 0.25, 1.6); lamp.position.set(0, -0.2, -0.3); group.add(lamp);

  let frame = 0, wipeT = 0, nTick = 0;
  function update(dt, v, rain, t, accentCss) {
    spin.rotation.z = -v.steer * 1.9;
    frame++;
    if (frame % 2 === 0) { drawCluster(cctx, v.speed * 3.6, v.rpm, v.gear, v.nitro, t, accentCss || "#2de2ff"); ctex.needsUpdate = true; }
    if (frame % 6 === 0) { // little nav screen: dark map with a moving road line and a blue arrow
      nctx.fillStyle = "#0a1220"; nctx.fillRect(0, 0, 256, 128); nctx.strokeStyle = "#1c3350"; nctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) { nctx.beginPath(); nctx.moveTo(((k * 41 + t * 18) % 300) - 20, 0); nctx.lineTo(((k * 41 + t * 18) % 300) - 60, 128); nctx.stroke(); }
      nctx.strokeStyle = "#ffb703"; nctx.lineWidth = 6; nctx.beginPath(); nctx.moveTo(128, 128); nctx.lineTo(128 + Math.sin(t * 0.7) * 18, 70); nctx.lineTo(150, 0); nctx.stroke();
      nctx.fillStyle = "#3df0ff"; nctx.beginPath(); nctx.moveTo(128, 82); nctx.lineTo(118, 106); nctx.lineTo(138, 106); nctx.closePath(); nctx.fill();
      nctx.fillStyle = "#fff"; nctx.font = "bold 14px monospace"; nctx.fillText(Math.round(v.speed * 3.6) + " km/h", 8, 18); ntex.needsUpdate = true;
    }
    // rain + wipers
    dmat.opacity += (Math.min(1, rain * 1.6) - dmat.opacity) * Math.min(1, dt * 2);
    const wiping = rain > 0.15; wipeT += dt * (wiping ? 1 : 0);
    if (wiping) {
      const ph = (wipeT * 0.9) % 1; const sw = ph < 0.5 ? ph * 2 : (1 - ph) * 2;
      for (const w of wipers) { w.visible = true; w.rotation.z = 0.7 - sw * 1.4; }
      dtex.offset.y = (dtex.offset.y + dt * (0.03 + v.speed * 0.0015)) % 1;
    } else for (const w of wipers) w.visible = false;
    lamp.intensity = 0.3 + (v.nos ? 0.5 : 0);
  }
  return { group, update };
}
