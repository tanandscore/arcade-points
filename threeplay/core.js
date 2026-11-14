"use client";
// Shared 3D toolkit for the "big adventure" free games (Spellwright, Starbound Rebels, Skyguard Squad).
// One rig = renderer + scene + camera + post-processing + keyboard/mouse + particles + sound + a fixed game loop.
import * as THREE from "three";
import { createCinematic } from "@/lib/cinematic/post";
import { makeSkyDome, glowTexture } from "@/lib/cinematic/atmos";

export { THREE };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- sound: tiny synth so there are no audio files to download ----------
export function createSound() {
  let ac = null, master = null, on = true, musicNodes = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); } catch { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }
  function tone(freq, dur, type = "sine", vol = 0.2, slide = 0, delay = 0) {
    const a = ctx(); if (!a || !on) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.2, lp = 2000, delay = 0) {
    const a = ctx(); if (!a || !on) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = buf; f.type = "lowpass"; f.frequency.value = lp;
    g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(a.currentTime + delay);
  }
  const FX = {
    cast: () => { tone(520, 0.14, "triangle", 0.16, 420); tone(1040, 0.1, "sine", 0.06, 300); },
    zap: () => { tone(880, 0.12, "sawtooth", 0.09, -500); noise(0.08, 0.07, 6000); },
    hit: () => { noise(0.14, 0.22, 1800); tone(140, 0.12, "square", 0.1, -60); },
    boom: () => { noise(0.6, 0.35, 700); tone(70, 0.5, "sine", 0.3, -35); },
    gale: () => { noise(0.5, 0.25, 1400); tone(200, 0.4, "sine", 0.1, 300); },
    ice: () => { tone(1500, 0.2, "triangle", 0.1, -700); tone(2200, 0.12, "sine", 0.05, -900, 0.04); },
    ward: () => { tone(330, 0.3, "sine", 0.14, 160); tone(660, 0.3, "sine", 0.07, 120); },
    pick: () => { tone(660, 0.08, "triangle", 0.14); tone(990, 0.12, "triangle", 0.14, 0, 0.07); },
    ring: () => { tone(740, 0.1, "sine", 0.15); tone(1110, 0.16, "sine", 0.12, 0, 0.06); },
    hurt: () => { tone(180, 0.2, "sawtooth", 0.18, -90); noise(0.12, 0.2, 900); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, "triangle", 0.16, 0, i * 0.1)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.14, 0, i * 0.14)); },
    whoosh: () => { noise(0.35, 0.12, 900); },
    boost: () => { noise(0.5, 0.18, 2500); tone(220, 0.5, "sawtooth", 0.07, 400); },
    laser: () => { tone(1300, 0.14, "square", 0.07, -900); },
    blade: () => { tone(110, 0.5, "sawtooth", 0.05, 4); },
    clang: () => { tone(900, 0.2, "square", 0.1, -300); tone(1350, 0.25, "triangle", 0.08, -200); noise(0.06, 0.12, 5000); },
    punch: () => { noise(0.1, 0.3, 1200); tone(100, 0.14, "sine", 0.3, -50); },
    jump: () => { tone(300, 0.18, "sine", 0.1, 260); },
    click: () => { tone(700, 0.05, "square", 0.05); },
    alarm: () => { tone(520, 0.12, "square", 0.08); tone(390, 0.12, "square", 0.08, 0, 0.14); },
  };
  function music(kind = "calm") {
    const a = ctx(); if (!a || musicNodes) return; if (!on) return;
    const scales = { calm: [0, 3, 7, 10, 12, 15], epic: [0, 2, 3, 7, 8, 12], space: [0, 7, 12, 14, 19, 24], city: [0, 4, 7, 9, 12, 16] };
    const sc = scales[kind] || scales.calm, base = kind === "space" ? 55 : kind === "epic" ? 49 : 58, id = { t: 0, step: 0 };
    const pad = a.createOscillator(), pg = a.createGain(); pad.type = "sine"; pad.frequency.value = base; pg.gain.value = 0.05; pad.connect(pg); pg.connect(master); pad.start();
    const pad2 = a.createOscillator(), pg2 = a.createGain(); pad2.type = "triangle"; pad2.frequency.value = base * 1.5; pg2.gain.value = 0.02; pad2.connect(pg2); pg2.connect(master); pad2.start();
    const iv = setInterval(() => { if (!on) return; const n = sc[(id.step * 3 + (id.step >> 2)) % sc.length]; tone(base * 4 * Math.pow(2, n / 12), 1.4, "sine", 0.035); id.step++; if (id.step % 8 === 0) tone(base * 2, 2.4, "triangle", 0.04); }, kind === "epic" ? 360 : 520);
    musicNodes = { pad, pad2, iv };
  }
  function stopMusic() { if (!musicNodes) return; try { musicNodes.pad.stop(); musicNodes.pad2.stop(); } catch {} clearInterval(musicNodes.iv); musicNodes = null; }
  return {
    play(k) { const f = FX[k]; if (f) f(); }, tone, noise, music, stopMusic, resume: ctx,
    setOn(v) { on = v; if (!v) stopMusic(); }, isOn: () => on, dispose() { stopMusic(); try { ac && ac.close(); } catch {} ac = null; },
  };
}

// ---------- particles: one draw call, up to N live sparks ----------
export function createParticles(scene, max = 1400) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), siz = new Float32Array(max), alp = new Float32Array(max);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), ttl = new Float32Array(max), grav = new Float32Array(max), s0 = new Float32Array(max), drag = new Float32Array(max), c0 = new Float32Array(max * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aColor", new THREE.BufferAttribute(col, 3)); g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1)); g.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uScale: { value: 600 } },
    vertexShader: "attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a *= a; gl_FragColor = vec4(vC * a * vA, a * vA); }",
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 20; scene.add(pts);
  let head = 0; const c = new THREE.Color();
  function emit(x, y, z, vx, vy, vz, color, size, t, gr = 0, dg = 1) {
    const i = head; head = (head + 1) % max; c.set(color);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    c0[i * 3] = c.r; c0[i * 3 + 1] = c.g; c0[i * 3 + 2] = c.b; s0[i] = size; ttl[i] = t; life[i] = t; grav[i] = gr; drag[i] = dg;
  }
  return {
    emit,
    burst(p, color, n = 14, speed = 4, t = 0.6, size = 0.5, gr = 6) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), s = speed * rnd(0.3, 1); emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, color, size * rnd(0.6, 1.2), t * rnd(0.6, 1.1), gr, 1.5); } },
    spark(p, color, size = 0.5, t = 0.35, spread = 0.6) { emit(p.x + rnd(-spread, spread) * 0.2, p.y + rnd(-spread, spread) * 0.2, p.z + rnd(-spread, spread) * 0.2, rnd(-spread, spread), rnd(-spread, spread), rnd(-spread, spread), color, size, t, 0, 2); },
    ring(p, color, n = 24, r = 3, t = 0.6, size = 0.5, up = 0) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; emit(p.x, p.y, p.z, Math.cos(a) * r, up, Math.sin(a) * r, color, size, t, 0, 1.2); } },
    update(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) { alp[i] = 0; continue; }
        life[i] -= dt; if (life[i] <= 0) { alp[i] = 0; siz[i] = 0; continue; }
        const k = life[i] / ttl[i], dm = Math.exp(-drag[i] * dt);
        vel[i * 3] *= dm; vel[i * 3 + 1] = vel[i * 3 + 1] * dm - grav[i] * dt; vel[i * 3 + 2] *= dm;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        col[i * 3] = c0[i * 3]; col[i * 3 + 1] = c0[i * 3 + 1]; col[i * 3 + 2] = c0[i * 3 + 2]; siz[i] = s0[i] * (0.4 + 0.6 * k); alp[i] = Math.min(1, k * 2.2);
      }
      g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = true;
    },
    setScale(h) { mat.uniforms.uScale.value = h * 0.9; }, dispose() { g.dispose(); mat.dispose(); scene.remove(pts); },
  };
}

// ---------- procedural textures (no image downloads) ----------
function cv(w, h, fn, repeat) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t; }
export function stoneTexture(base = "#7a7a86", mortar = "#3a3a44", rx = 4, ry = 4) {
  return cv(256, 256, (g, w, h) => {
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    const rows = 6, bh = h / rows;
    for (let r = 0; r < rows; r++) { const n = 3, bw = w / n, off = (r % 2) * bw * 0.5; for (let i = -1; i <= n; i++) { const x = i * bw + off, sh = rnd(-18, 18); g.fillStyle = shade(base, sh); g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${rnd(0, 0.07)})`; g.fillRect(x + rnd(2, bw - 4), r * bh + rnd(2, bh - 4), rnd(1, 5), rnd(1, 3)); } } }
  }, [rx, ry]);
}
export function floorTexture(a = "#58545e", b = "#47434d", rx = 8, ry = 8) {
  return cv(256, 256, (g, w, h) => { const n = 4, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * s, y * s, s, s); g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1); for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${rnd(0, 0.04)})`; g.fillRect(x * s + rnd(0, s), y * s + rnd(0, s), rnd(2, 10), rnd(2, 10)); } } }, [rx, ry]);
}
export function grassTexture(base = "#3f7a3a", rx = 30, ry = 30) {
  return cv(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = shade(base, rnd(-30, 30)); g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(2, 6)); } }, [rx, ry]);
}
export function metalTexture(base = "#8a93a3", rx = 3, ry = 3) {
  return cv(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const n = 4, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(base, rnd(-12, 12)); g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4); g.strokeStyle = "rgba(0,0,0,.45)"; g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2); g.fillStyle = "rgba(255,255,255,.25)"; for (const [dx, dy] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { g.beginPath(); g.arc(x * s + dx, y * s + dy, 2, 0, 7); g.fill(); } } }, [rx, ry]);
}
export function noiseTexture(base = "#888", amt = 26, rx = 6, ry = 6) { return cv(128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = shade(base, rnd(-amt, amt)); g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 4), rnd(1, 4)); } }, [rx, ry]); }
export function shade(hex, d) { const h = new THREE.Color(hex).getHex(); const r = clamp(((h >> 16) & 255) + d, 0, 255), g = clamp(((h >> 8) & 255) + d, 0, 255), b = clamp((h & 255) + d, 0, 255); return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`; }

// Tiny helpers for building things out of simple shapes
export function mesh(geo, color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0.05, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map || null, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1, flatShading: !!o.flat, side: o.side ?? THREE.FrontSide });
  const me = new THREE.Mesh(geo, m); me.castShadow = o.cast !== false; me.receiveShadow = o.recv !== false; return me;
}
export function glowMesh(geo, color, ei = 2) { return mesh(geo, color, { emissive: color, ei, rough: 0.4, cast: false }); }
export function sprite(color, size, op = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op, fog: false })); s.scale.set(size, size, 1); return s; }

// ---------- the rig ----------
export function createRig(mount, o = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: !!o.preserve });
  const maxPr = o.pixelRatio ?? 1.5; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPr));
  renderer.shadowMap.enabled = o.shadows !== false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement; el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;outline:none"; el.tabIndex = 0; mount.appendChild(el);
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(o.fov ?? 62, 16 / 9, 0.1, o.far ?? 900);
  const cine = createCinematic(renderer, scene, camera, { exposure: o.exposure ?? 1.1, bloom: o.bloom ?? [0.45, 0.6, 0.82], grade: o.grade ?? { vig: 0.4, grain: 0.015, sat: 1.05, contrast: 1.06 } });
  const fx = createParticles(scene, o.particles ?? 1400);
  const sound = createSound();
  const keys = new Set(), pressed = new Set(), mouse = { dx: 0, dy: 0, left: false, right: false, clickL: false, clickR: false, x: 0.5, y: 0.5 };
  let locked = false, onLock = null, running = false, raf = 0, tAcc = 0, last = 0, frame = 0, slow = 0; const subs = [];
  const rig = { THREE, renderer, scene, camera, fx, sound, cine, keys, pressed, mouse, el, mount, time: 0, shake: 0, paused: false, w: 1280, h: 720, sky: null, update: null, setLockHandler(f) { onLock = f; }, isLocked: () => locked };
  function size() { const w = Math.max(320, mount.clientWidth || 1280), h = Math.max(200, mount.clientHeight || 720); rig.w = w; rig.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); cine.setSize(w, h); fx.setScale(h); }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null; if (ro) ro.observe(mount); window.addEventListener("resize", size); size();
  const kd = (e) => { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault(); };
  const ku = (e) => { keys.delete(e.code); };
  const mm = (e) => { if (locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } const r = el.getBoundingClientRect(); if (r.width) { mouse.x = (e.clientX - r.left) / r.width; mouse.y = (e.clientY - r.top) / r.height; } };
  const md = (e) => { if (e.button === 0) { mouse.left = true; mouse.clickL = true; } if (e.button === 2) { mouse.right = true; mouse.clickR = true; } if (!locked && o.lock !== false && !rig.paused) { try { el.requestPointerLock && el.requestPointerLock(); } catch {} } el.focus(); };
  const mu = (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; };
  const cm = (e) => e.preventDefault();
  const pl = () => { const was = locked; locked = document.pointerLockElement === el; if (was && !locked && onLock) onLock(false); if (!was && locked && onLock) onLock(true); };
  const blur = () => { keys.clear(); mouse.left = mouse.right = false; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur); el.addEventListener("mousemove", mm); document.addEventListener("mousemove", mm); el.addEventListener("mousedown", md); window.addEventListener("mouseup", mu); el.addEventListener("contextmenu", cm); document.addEventListener("pointerlockchange", pl);
  function loop(ts) {
    raf = requestAnimationFrame(loop); if (!running) return;
    let dt = (ts - last) / 1000; last = ts; if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.05);
    if (!rig.paused) { rig.time += dt; if (rig.update) rig.update(dt, rig.time); fx.update(dt); if (rig.sky) rig.sky.userData.update(rig.time, camera.position); }
    // adaptive quality: if frames are slow for a while, drop the pixel ratio once or twice
    frame++; slow = dt > 0.034 ? slow + 1 : Math.max(0, slow - 1); if (slow > 50 && renderer.getPixelRatio() > 0.8) { renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() - 0.25)); slow = 0; size(); }
    if (rig.shake > 0) { camera.position.x += rnd(-1, 1) * rig.shake * 0.12; camera.position.y += rnd(-1, 1) * rig.shake * 0.12; rig.shake = Math.max(0, rig.shake - dt * 3); }
    cine.render(dt); pressed.clear(); mouse.dx = mouse.dy = 0; mouse.clickL = mouse.clickR = false;
  }
  rig.start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  rig.stop = () => { running = false; };
  rig.setSky = (opts) => { if (rig.sky) { scene.remove(rig.sky); } rig.sky = makeSkyDome(opts); scene.add(rig.sky); };
  rig.unlock = () => { try { document.exitPointerLock && document.exitPointerLock(); } catch {} };
  rig.screenshot = () => { try { return el.toDataURL("image/jpeg", 0.9); } catch { return null; } };
  rig.dispose = () => {
    running = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener("resize", size);
    window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); document.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); document.removeEventListener("pointerlockchange", pl);
    rig.unlock(); sound.dispose(); fx.dispose(); cine.dispose();
    scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { const ms = Array.isArray(ob.material) ? ob.material : [ob.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch {} if (el.parentNode) el.parentNode.removeChild(el);
  };
  return rig;
}
// Clear everything a mode added so the next mode starts on a clean stage
export function clearScene(rig) {
  const keep = new Set([rig.sky]); if (rig.cine && rig.cine.bloom) rig.cine.bloom.strength = 0.5;
  for (const ch of [...rig.scene.children]) { if (keep.has(ch) || ch.isPoints) continue; rig.scene.remove(ch); ch.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { const ms = Array.isArray(ob.material) ? ob.material : [ob.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
  rig.scene.fog = null; rig.scene.background = null;
}
// Move toward a target value at a fixed speed
export const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
// A "world-space" floating label (damage numbers etc.) is done in the React HUD instead; this converts a 3D point to screen %.
export function toScreen(rig, p, out = { x: 0, y: 0, on: false }) { const v = new THREE.Vector3(p.x, p.y, p.z).project(rig.camera); out.x = (v.x * 0.5 + 0.5) * 100; out.y = (-v.y * 0.5 + 0.5) * 100; out.on = v.z < 1 && v.z > -1; return out; }
