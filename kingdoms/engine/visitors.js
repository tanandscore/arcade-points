// Ashtide visitors (Upgrade 131): a merchant ship that calls at the town and drifting bottles to fish out of the sea.
// Only the moving parts live here; what they pay is decided in progress.js.
import * as THREE from "three";
import { RADIUS, S } from "./grid";

const EDGE = RADIUS * S; // world distance from the middle to the edge of the building area

export function createVisitors(scene, { onDock, onBottle }) {
  // ---- the merchant ship: a two-masted trader, bigger than the little boats that circle the bay ----
  const ship = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.85 }), trim = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.6 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.9, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 7.2), wood); hull.position.y = 0.35; hull.castShadow = true; ship.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.6, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), wood); bow.position.set(0, 0.35, 4.7); bow.scale.set(1, 0.72, 1); ship.add(bow);
  const stern = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.0, 1.8), wood); stern.position.set(0, 1.2, -2.8); stern.castShadow = true; ship.add(stern);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.14, 7.3), trim); rail.position.y = 0.95; ship.add(rail);
  for (const [z, h] of [[1.6, 7.2], [-1.4, 6.2]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 6), wood); mast.position.set(0, h / 2 + 0.6, z); ship.add(mast);
    for (const [y, w, hh] of [[h * 0.42 + 0.6, 3.6, h * 0.36], [h * 0.82 + 0.6, 2.6, h * 0.26]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, hh, 4, 1), sailMat); const p = s.geometry.attributes.position; for (let n = 0; n < p.count; n++) p.setZ(n, 0.35 * Math.cos((p.getX(n) / w) * Math.PI)); s.geometry.computeVertexNormals(); s.position.set(0, y, z + 0.15); s.castShadow = true; ship.add(s); }
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0xe0523f, side: THREE.DoubleSide })); flag.position.set(0.45, 8.1, 1.6); ship.add(flag);
  const lamp = new THREE.PointLight(0xffc878, 0, 22, 2); lamp.position.set(0, 2.4, -2.8); ship.add(lamp);
  ship.visible = false; scene.add(ship);
  const S_ = { state: "away", t: 0, wait: 25, ang: 0, shells: 0 }; // first ship comes quickly so new players meet it
  const FAR = 170, DOCK = EDGE + 7;
  const pos = (r) => ship.position.set(Math.cos(S_.ang) * r, 0, Math.sin(S_.ang) * r);

  // ---- drifting bottles ----
  const bottles = [];
  const glassM = new THREE.MeshStandardMaterial({ color: 0x8fe6c8, roughness: 0.15, metalness: 0.1, emissive: 0x3fd0a0, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 });
  const corkM = new THREE.MeshStandardMaterial({ color: 0xb98a55 }); const haloM = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const hitGeo = new THREE.SphereGeometry(2.2, 8, 6); const hitM = new THREE.MeshBasicMaterial({ visible: false });
  function spawnBottle() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.0, 10), glassM); const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.45, 8), glassM); neck.position.y = 0.7; const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 8), corkM); cork.position.y = 0.98;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 24).rotateX(-Math.PI / 2), haloM); halo.position.y = -0.2;
    const tilt = new THREE.Group(); tilt.add(body, neck, cork); tilt.rotation.z = 0.5; g.add(tilt, halo);
    const hit = new THREE.Mesh(hitGeo, hitM); g.add(hit);
    const a = Math.random() * Math.PI * 2, r = EDGE + 1.5 + Math.random() * 6;
    g.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r); g.userData = { t: 0, life: 50, ph: Math.random() * 6, hit, halo, tilt }; scene.add(g); bottles.push(g);
  }
  function dropBottle(n) { const g = bottles[n]; scene.remove(g); bottles.splice(n, 1); }
  let bottleWait = 40;

  function update(dt, time, { playing, houses, minHouses, every, shells, night }) {
    // ship
    if (S_.state === "away") {
      if (playing && houses >= minHouses) { S_.wait -= dt; if (S_.wait <= 0) { S_.state = "in"; S_.t = 0; S_.ang = Math.random() * Math.PI * 2; S_.shells = shells; ship.visible = true; } }
    } else {
      S_.t += dt; lamp.intensity = night * 14; flag.rotation.y = Math.sin(time * 5) * 0.4;
      const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
      if (S_.state === "in") { const k = ease(S_.t / 16); pos(FAR + (DOCK - FAR) * k); ship.rotation.y = Math.atan2(-Math.cos(S_.ang), -Math.sin(S_.ang)); if (S_.t >= 16) { S_.state = "dock"; S_.t = 0; onDock && onDock(S_.shells, ship.position); } }
      else if (S_.state === "dock") { pos(DOCK); if (S_.t >= 9) { S_.state = "out"; S_.t = 0; } }
      else if (S_.state === "out") { const k = Math.pow(Math.min(1, S_.t / 16), 2); pos(DOCK + (FAR - DOCK) * k); ship.rotation.y = Math.atan2(-Math.cos(S_.ang), -Math.sin(S_.ang)) + Math.PI * Math.min(1, S_.t / 5); if (S_.t >= 16) { S_.state = "away"; S_.wait = every; ship.visible = false; } }
      ship.position.y = Math.sin(time * 1.1) * 0.12 - 0.05; ship.rotation.z = Math.sin(time * 0.9) * 0.03;
    }
    // bottles
    if (playing && houses >= 3) { bottleWait -= dt; if (bottleWait <= 0 && bottles.length < 2) { spawnBottle(); bottleWait = 50 + Math.random() * 40; } }
    for (let n = bottles.length - 1; n >= 0; n--) {
      const g = bottles[n], u = g.userData; u.t += dt; g.position.y = 0.25 + Math.sin(time * 1.6 + u.ph) * 0.14; u.tilt.rotation.z = 0.5 + Math.sin(time * 1.1 + u.ph) * 0.2; g.rotation.y += dt * 0.3;
      const s = 1 + Math.sin(time * 3 + u.ph) * 0.18; u.halo.scale.setScalar(s); const fade = Math.min(1, u.t / 1.5, (u.life - u.t) / 3); g.scale.setScalar(Math.max(0.01, fade));
      if (u.t >= u.life) dropBottle(n);
    }
    glassM.emissiveIntensity = 0.7 + night * 1.2;
  }
  // a click on the sea: returns true (and pays) if it landed on a bottle
  function tryClick(ray) {
    for (let n = 0; n < bottles.length; n++) { const g = bottles[n]; g.updateMatrixWorld(true); if (ray.intersectObject(g.userData.hit, false).length) { const p = g.position.clone(); dropBottle(n); onBottle && onBottle(p); return true; } }
    return false;
  }
  return { update, tryClick, debug: { ship: S_, bottles, spawnBottle, shipObj: ship } };
}
