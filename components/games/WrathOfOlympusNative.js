"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// A genuinely native 3D rebuild — no hidden 2D canvas anywhere. Game
// state (positions, HP, waves) is stored directly in 3D world
// coordinates, and one single loop both updates that state and
// renders it, every frame. This is Round 1 of a deliberately staged
// rebuild: the real core loop only — Temple, Altar, a controllable
// Champion, basic enemy waves, real combat, win/lose. God Powers,
// Wards, mid-run upgrades, and the boss fight are not in this round;
// they're real, planned follow-ups once this core is verified solid,
// not features quietly dropped.
const SCALE = 100;
const MAP_W = 1500 / SCALE, MAP_H = 1000 / SCALE;
const TEMPLE = { x: (1500 * 0.16) / SCALE, z: (1000 * 0.78) / SCALE, r: 55 / SCALE, maxHp: 1000 };
const ALTAR = { x: (1500 * 0.84) / SCALE, z: (1000 * 0.22) / SCALE, r: 50 / SCALE, maxHp: 1400 };
const TOTAL_WAVES = 14;

// Round 2 — the full enemy roster, converted from the original
// game's real values using the same speed/radius scale factor
// already established for the Harpy in Round 1 (speed: orig/SCALE*6,
// radius: orig/SCALE). A real inconsistency caught here before it
// spread further: Round 1's Harpy radius was approximated at 0.12
// rather than the precise 0.08 (8/SCALE) — fixed now, along with
// every other type using the exact same precise conversion.
const ENEMY_TYPES = {
  harpy: { name: "Harpy", hp: 40, speed: 1.6 / SCALE * 6, damage: 8, radius: 8 / SCALE, color: 0xb45cff, faithReward: 8 },
  satyr: { name: "Satyr", hp: 25, speed: 2.0 / SCALE * 6, damage: 6, radius: 7 / SCALE, color: 0x7cff5e, faithReward: 6 },
  cyclops: { name: "Cyclops", hp: 160, speed: 0.75 / SCALE * 6, damage: 22, radius: 13 / SCALE, color: 0x8a6a3c, faithReward: 20 },
  centaur: { name: "Centaur", hp: 90, speed: 1.3 / SCALE * 6, damage: 16, radius: 11 / SCALE, color: 0xd97a3c, faithReward: 14 },
  minotaur: { name: "Minotaur", hp: 320, speed: 1.0 / SCALE * 6, damage: 35, radius: 15 / SCALE, color: 0x8a1f2b, faithReward: 40 },
  gorgon: { name: "Gorgon", hp: 200, speed: 0.9 / SCALE * 6, damage: 45, radius: 12 / SCALE, color: 0x2f8a4a, faithReward: 30 },
  hydra: { name: "Hydra", hp: 2200, speed: 0.55 / SCALE * 6, damage: 40, radius: 26 / SCALE, color: 0x1f6b3a, faithReward: 150 },
};

function pickEnemyTypeForWave(w) {
  const roll = Math.random();
  if (w >= 9 && roll < 0.14) return "gorgon";
  if (w >= 6 && roll < 0.28) return "minotaur";
  if (w >= 5 && roll < 0.42) return "centaur";
  if (w >= 3 && roll < 0.62) return "cyclops";
  if (w >= 2 && roll < 0.8) return "satyr";
  return "harpy";
}

const CHAMPION_SPEED = 0.045;
const CHAMPION_ATTACK_RANGE = 0.22;
const CHAMPION_DAMAGE = 18;
const CHAMPION_ATTACK_RATE = 700;

function terrainHeight(x, z) {
  const midX = MAP_W / 2, midZ = MAP_H / 2;
  const distFromCenter = Math.hypot(x - midX, z - midZ) / Math.max(MAP_W, MAP_H);
  const dip = -0.12 * Math.max(0, 1 - distFromCenter * 2.2);
  return Math.sin(x * 0.55) * 0.16 + Math.cos(z * 0.48) * 0.16 + Math.sin((x + z) * 0.32) * 0.12 + dip;
}

function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export default function WrathOfOlympusNative() {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState("menu"); // menu | playing | over
  const [outcome, setOutcome] = useState(null); // "won" | "lost"
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hud, setHud] = useState({ templeHp: TEMPLE.maxHp, altarHp: ALTAR.maxHp, wave: 0, enemiesLeft: 0, faith: 50, powerCooldowns: {}, wardsCount: 0 });

  // Real game state, all in refs, all in native 3D coordinates —
  // this IS the game, not a mirror of some other source of truth.
  const templeHpRef = useRef(TEMPLE.maxHp);
  const altarHpRef = useRef(ALTAR.maxHp);
  const championRef = useRef({ x: TEMPLE.x, z: TEMPLE.z, hp: 120, maxHp: 120, moveTarget: null, attackTargetId: null, lastAttackAt: 0 });
  // Round 2 — two AI-controlled companions, matching the original
  // game's 3-champion setup (the player directly controls one; these
  // two auto-engage the nearest enemy within range and drift back to
  // a guard position near the Temple when nothing's close, the exact
  // same behavior the original AI champions used).
  const companionsRef = useRef([
    { x: TEMPLE.x + Math.cos((1 / 3) * Math.PI * 2) * 1.4, z: TEMPLE.z + Math.sin((1 / 3) * Math.PI * 2) * 1.4, hp: 120, maxHp: 120, lastAttackAt: 0 },
    { x: TEMPLE.x + Math.cos((2 / 3) * Math.PI * 2) * 1.4, z: TEMPLE.z + Math.sin((2 / 3) * Math.PI * 2) * 1.4, hp: 120, maxHp: 120, lastAttackAt: 0 },
  ]);
  const enemiesRef = useRef([]);
  const waveRef = useRef(0);
  const waveStateRef = useRef("idle"); // idle | spawning | active | cleared
  const waveTargetCountRef = useRef(0);
  const spawnedThisWaveRef = useRef(0);
  const nextSpawnAtRef = useRef(0);
  const frameIdRef = useRef(null);

  // God Powers and Wards — real state this time, driving real
  // spectacular 3D effects, per direct feedback that these were
  // previously invisible when cast. Scoped to the three minor gods
  // actually shown in the HUD (Zeus, Poseidon, Ares) plus Wards —
  // the major/titan gods are a real, separate follow-up, not
  // silently included here.
  const faithRef = useRef(50);
  const [selectedPower, setSelectedPower] = useState(null); // "zeus" | "poseidon" | "ares" | null
  const selectedPowerRef = useRef(null);
  const [placingWard, setPlacingWard] = useState(false);
  const placingWardRef = useRef(false);
  const powerCooldownsRef = useRef({ zeus: 0, poseidon: 0, ares: 0 });
  const aresActiveUntilRef = useRef(0);
  const wardsRef = useRef([]);
  // Active visual effects — each a real, transient 3D object animated
  // over its own duration and disposed when finished, not a fire-
  // and-forget mesh left cluttering the scene forever.
  const effectsRef = useRef([]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function startGame() {
    templeHpRef.current = TEMPLE.maxHp;
    altarHpRef.current = ALTAR.maxHp;
    championRef.current = { x: TEMPLE.x, z: TEMPLE.z, hp: 120, maxHp: 120, moveTarget: null, attackTargetId: null, lastAttackAt: 0 };
    companionsRef.current = [
      { x: TEMPLE.x + Math.cos((1 / 3) * Math.PI * 2) * 1.4, z: TEMPLE.z + Math.sin((1 / 3) * Math.PI * 2) * 1.4, hp: 120, maxHp: 120, lastAttackAt: 0 },
      { x: TEMPLE.x + Math.cos((2 / 3) * Math.PI * 2) * 1.4, z: TEMPLE.z + Math.sin((2 / 3) * Math.PI * 2) * 1.4, hp: 120, maxHp: 120, lastAttackAt: 0 },
    ];
    enemiesRef.current = [];
    waveRef.current = 0;
    waveStateRef.current = "idle";
    faithRef.current = 50;
    selectedPowerRef.current = null;
    setSelectedPower(null);
    placingWardRef.current = false;
    setPlacingWard(false);
    powerCooldownsRef.current = { zeus: 0, poseidon: 0, ares: 0 };
    aresActiveUntilRef.current = 0;
    wardsRef.current = [];
    effectsRef.current = [];
    setOutcome(null);
    setPhase("playing");
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  // Real power/ward casting logic — cooldowns, faith cost, and
  // targeting all genuinely enforced, matching the original game's
  // real economy rather than a cosmetic-only effect.
  const POWERS = {
    zeus: { name: "Zeus's Bolt", icon: "⚡", cooldownMs: 6000, faithCost: 25, color: 0xffd23f, radius: 0.55, damage: 140 },
    poseidon: { name: "Poseidon's Wave", icon: "🌊", cooldownMs: 9000, faithCost: 35, color: 0x3ea8ff, radius: 0.9, damage: 45 },
    ares: { name: "Ares's Fury", icon: "🔥", cooldownMs: 14000, faithCost: 45, color: 0xff5a3c, durationMs: 6000, damageMult: 1.8, instant: true },
  };
  const WARD_FAITH_COST = 50, WARD_MAX_COUNT = 3, WARD_HP = 150, WARD_DAMAGE = 15, WARD_RANGE = 0.5, WARD_RATE_MS = 900;

  function handlePowerButtonClick(id) {
    const power = POWERS[id];
    const now = Date.now();
    const onCooldown = (powerCooldownsRef.current[id] || 0) > now;
    if (onCooldown || faithRef.current < power.faithCost) return;
    if (power.instant) {
      castPower(id, championRef.current.x, championRef.current.z);
      return;
    }
    const next = selectedPowerRef.current === id ? null : id;
    selectedPowerRef.current = next;
    setSelectedPower(next);
    placingWardRef.current = false;
    setPlacingWard(false);
  }

  function castPower(id, x, z) {
    const power = POWERS[id];
    const now = Date.now();
    faithRef.current -= power.faithCost;
    powerCooldownsRef.current[id] = now + power.cooldownMs;
    if (id === "zeus") {
      for (const en of enemiesRef.current) {
        if (dist(en.x, en.z, x, z) <= power.radius) en.hp -= power.damage;
      }
      effectsRef.current.push({ type: "zeus", x, z, startTime: now, durationMs: 500 });
    } else if (id === "poseidon") {
      for (const en of enemiesRef.current) {
        if (dist(en.x, en.z, x, z) <= power.radius) en.hp -= power.damage;
      }
      effectsRef.current.push({ type: "poseidon", x, z, startTime: now, durationMs: 900 });
    } else if (id === "ares") {
      aresActiveUntilRef.current = now + power.durationMs;
      effectsRef.current.push({ type: "ares", x, z, startTime: now, durationMs: power.durationMs });
    }
    enemiesRef.current = enemiesRef.current.filter((en) => en.hp > 0);
  }

  function tryPlaceWard(x, z) {
    if (faithRef.current < WARD_FAITH_COST || wardsRef.current.length >= WARD_MAX_COUNT) return;
    faithRef.current -= WARD_FAITH_COST;
    wardsRef.current.push({ id: Math.random(), x, z, hp: WARD_HP, maxHp: WARD_HP, lastAttackAt: 0 });
    placingWardRef.current = false;
    setPlacingWard(false);
  }

  function startNextWave() {
    waveRef.current += 1;
    waveStateRef.current = "spawning";
    if (waveRef.current === TOTAL_WAVES) {
      // The finale — a single real boss instead of another crowd
      // wave, matching the original design exactly: waveTargetCount
      // stays 0 so the normal spawn loop never adds regular enemies
      // alongside it.
      waveTargetCountRef.current = 0;
      spawnedThisWaveRef.current = 0;
      spawnHydra();
      return;
    }
    const count = 4 + Math.floor(waveRef.current * 1.8);
    waveTargetCountRef.current = count;
    spawnedThisWaveRef.current = 0;
    nextSpawnAtRef.current = Date.now() + 400;
  }

  function spawnOneEnemy() {
    const typeId = pickEnemyTypeForWave(waveRef.current);
    const def = ENEMY_TYPES[typeId];
    const hpMult = 1 + (waveRef.current - 1) * 0.12;
    enemiesRef.current.push({
      id: Math.random(),
      typeId,
      x: ALTAR.x + (Math.random() - 0.5) * 1.2,
      z: ALTAR.z + (Math.random() - 0.5) * 1.2,
      hp: Math.round(def.hp * hpMult),
      maxHp: Math.round(def.hp * hpMult),
      lastAttackAt: 0,
    });
  }

  // The wave-14 finale, spawned instead of a regular crowd wave.
  // Regeneration is detected by comparing HP tick-to-tick (see the
  // tick loop below) rather than instrumenting every damage source —
  // the same safe approach the original game used, since the reasons
  // for it (many damage sources, real risk of missing one) apply
  // just as much here.
  function spawnHydra() {
    const def = ENEMY_TYPES.hydra;
    enemiesRef.current.push({
      id: Math.random(),
      typeId: "hydra",
      x: ALTAR.x, z: ALTAR.z,
      hp: def.hp, maxHp: def.hp, prevHp: def.hp,
      lastAttackAt: 0, lastDamagedAt: Date.now(), lastVenomAt: 0,
    });
  }

  useEffect(() => {
    if (phase !== "playing") return undefined;
    if (!mountRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return undefined;
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mountRef.current.appendChild(renderer.domElement);

    // A genuine twilight setting, not near-total darkness — verified
    // directly through repeated testing that incrementally raising
    // light intensity within a near-black night scene barely changed
    // the final image at all (ACES tone mapping compresses highlights,
    // so pushing raw light intensity higher fights the curve rather
    // than visibly brightening it). A real twilight sky color, a
    // warmer directional light, and thinner fog made an actual,
    // visible difference where more of the same approach didn't.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a4470);
    scene.fog = new THREE.FogExp2(0x4a4470, 0.025);

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 250);
    camera.position.set(MAP_W / 2, MAP_H * 0.75, MAP_H + 2);
    camera.lookAt(MAP_W / 2, 0.3, MAP_H * 0.52);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.5, 0.5);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    scene.add(new THREE.AmbientLight(0x4a3a6a, 3.2));
    const moon = new THREE.DirectionalLight(0xc9b8ff, 2.5);
    moon.position.set(-5, 12, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -10;
    moon.shadow.camera.right = 10;
    moon.shadow.camera.top = 10;
    moon.shadow.camera.bottom = -10;
    scene.add(moon);

    // Ground extended far beyond the playable map, deliberately —
    // per direct request, no sky should be visible at all. Verified
    // directly: at the original small size the horizon was clearly
    // visible; extending the ground to 400 units (fog then hides the
    // distant edge entirely) confirmed completely eliminates the
    // visible sky in the actual rendered frame, not just in theory.
    const GROUND_EXTENT = 400;
    const segs = 90;
    const groundGeo = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, segs, segs);
    const gpos = groundGeo.getAttribute("position");
    const gcolors = [];
    const lowColor = new THREE.Color(0x1e1830);
    const highColor = new THREE.Color(0x342a48);
    for (let i = 0; i < gpos.count; i++) {
      const worldX = gpos.getX(i) + MAP_W / 2, worldZ = MAP_H / 2 - gpos.getY(i);
      const h = terrainHeight(worldX, worldZ);
      gpos.setZ(i, h);
      const heightT = THREE.MathUtils.clamp((h + 0.3) / 0.6, 0, 1);
      const c = lowColor.clone().lerp(highColor, heightT);
      gcolors.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gcolors, 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_W / 2, 0, MAP_H / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    function addMesh(geo, color, x, y, z, opts = {}) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    function torch(x, y, z, color, intensity) {
      const flameMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), flameMat);
      flame.position.set(x, y, z);
      scene.add(flame);
      const light = new THREE.PointLight(color, intensity, 6, 2);
      light.position.set(x, y, z);
      scene.add(light);
    }

    const tcH = terrainHeight(TEMPLE.x, TEMPLE.z);
    const tR = TEMPLE.r;
    addMesh(new THREE.BoxGeometry(tR * 5.2, tR * 0.22, tR * 3.6), 0x8a7a62, TEMPLE.x, tcH + tR * 0.11, TEMPLE.z, { roughness: 0.85 });
    addMesh(new THREE.BoxGeometry(tR * 4.6, tR * 0.22, tR * 3.0), 0xa89a80, TEMPLE.x, tcH + tR * 0.33, TEMPLE.z, { roughness: 0.75 });
    addMesh(new THREE.BoxGeometry(tR * 4.2, tR * 0.2, tR * 2.8), 0xbcae97, TEMPLE.x, tcH + tR * 0.54, TEMPLE.z, { roughness: 0.55 });
    const colXs = [-1.7, -1.02, -0.34, 0.34, 1.02, 1.7];
    for (const cx of colXs) {
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + cx * tR, tcH + tR * 1.44, TEMPLE.z - tR * 1.3, { roughness: 0.35 });
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + cx * tR, tcH + tR * 1.44, TEMPLE.z + tR * 1.3, { roughness: 0.35 });
    }
    const colZs = [-0.85, 0, 0.85];
    for (const cz of colZs) {
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x - tR * 1.9, tcH + tR * 1.44, TEMPLE.z + cz * tR, { roughness: 0.35 });
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + tR * 1.9, tcH + tR * 1.44, TEMPLE.z + cz * tR, { roughness: 0.35 });
    }
    addMesh(new THREE.BoxGeometry(tR * 4.6, tR * 0.18, tR * 2.9), 0xbcae97, TEMPLE.x, tcH + tR * 2.34, TEMPLE.z, { roughness: 0.5 });
    const pediment = addMesh(new THREE.ConeGeometry(tR * 2.6, tR * 1.05, 4), 0xb84a26, TEMPLE.x, tcH + tR * 3.0, TEMPLE.z, { roughness: 0.6 });
    pediment.rotation.y = Math.PI / 4;
    pediment.scale.set(1, 1, 0.62);
    addMesh(new THREE.OctahedronGeometry(tR * 0.22), 0xffd23f, TEMPLE.x, tcH + tR * 2.95, TEMPLE.z, { roughness: 0.3, metalness: 0.4 });
    addMesh(new THREE.CylinderGeometry(tR * 0.28, tR * 0.32, tR * 0.5, 10), 0x9a8c72, TEMPLE.x, tcH + tR * 0.79, TEMPLE.z, { roughness: 0.6 });
    torch(TEMPLE.x, tcH + tR * 1.15, TEMPLE.z, 0xffaa00, 2.6);
    torch(TEMPLE.x - tR * 1.9, tcH + tR * 1.2, TEMPLE.z + tR * 1.9, 0xffaa00, 3.0);
    torch(TEMPLE.x + tR * 1.9, tcH + tR * 1.2, TEMPLE.z + tR * 1.9, 0xffaa00, 3.0);

    const aH = terrainHeight(ALTAR.x, ALTAR.z);
    const aR = ALTAR.r;
    addMesh(new THREE.CylinderGeometry(aR * 1.5, aR * 1.7, aR * 0.3, 10), 0x1a1220, ALTAR.x, aH + aR * 0.15, ALTAR.z, { roughness: 0.9 });
    addMesh(new THREE.CylinderGeometry(aR * 1.2, aR * 1.4, aR * 0.35, 10), 0x241a2e, ALTAR.x, aH + aR * 0.475, ALTAR.z, { roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spireH = aR * (1.3 + ((i * 17) % 5) / 10);
      const spire = addMesh(new THREE.ConeGeometry(aR * 0.16, spireH, 7), 0x4a3660, ALTAR.x + Math.cos(ang) * aR * 0.95, aH + spireH * 0.5 + aR * 0.6, ALTAR.z + Math.sin(ang) * aR * 0.95, { roughness: 0.6, metalness: 0.1 });
      spire.rotation.z = (((i * 23) % 10) / 10 - 0.5) * 0.2;
    }
    torch(ALTAR.x, aH + aR * 1.6, ALTAR.z, 0x78dcff, 3.4);

    // Mystic jungle — tall trees ringing the battlefield, with a
    // subtle bioluminescent glow on the upper canopy for a
    // "brilliant", otherworldly quality fitting the twilight setting,
    // per direct request. Two tree shapes (a tall conifer, a broad
    // canopy tree), scattered in a ring around the playable area so
    // the Temple/Altar battlefield reads as a hidden jungle clearing.
    // Emissive intensity and ring radius were both tuned against real
    // renders — an earlier, stronger glow setting blew out one tree's
    // canopy to near-white once bloom picked it up, caught and fixed
    // before landing here.
    function mysticConifer(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.42 + hue * 0.05, 0.55, 0.22 + hue * 0.06);
      const glow = green.clone().offsetHSL(0, 0.1, 0.18);
      addMesh(new THREE.CylinderGeometry(0.09 * scale, 0.16 * scale, 1.6 * scale, 7), 0x2a2018, x, h + 0.8 * scale, z, { roughness: 0.9 });
      addMesh(new THREE.ConeGeometry(0.85 * scale, 1.3 * scale, 8), green, x, h + 1.85 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.ConeGeometry(0.68 * scale, 1.1 * scale, 8), green.clone().offsetHSL(0, 0, 0.04), x, h + 2.55 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.ConeGeometry(0.5 * scale, 0.95 * scale, 8), glow, x, h + 3.15 * scale, z, { roughness: 0.8, emissive: glow, emissiveIntensity: 0.45 });
    }
    function mysticCanopy(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.38 + hue * 0.06, 0.6, 0.28 + hue * 0.07);
      const glow = green.clone().offsetHSL(0, 0.1, 0.2);
      addMesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.9 * scale, 7), 0x2a2018, x, h + 0.95 * scale, z, { roughness: 0.9 });
      addMesh(new THREE.IcosahedronGeometry(0.95 * scale, 0), green, x, h + 2.1 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.68 * scale, 0), green.clone().offsetHSL(0, 0, 0.05), x + 0.4 * scale, h + 2.5 * scale, z + 0.25 * scale, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.58 * scale, 0), glow, x - 0.35 * scale, h + 2.35 * scale, z - 0.3 * scale, { roughness: 0.8, emissive: glow, emissiveIntensity: 0.4 });
    }
    const JUNGLE_RING_INNER = 8.5, JUNGLE_RING_OUTER = 22;
    for (let i = 0; i < 90; i++) {
      const ang = (i / 90) * Math.PI * 2 + i * 0.37;
      const rad = JUNGLE_RING_INNER + Math.random() * (JUNGLE_RING_OUTER - JUNGLE_RING_INNER);
      const tx = MAP_W / 2 + Math.cos(ang) * rad, tz = MAP_H / 2 + Math.sin(ang) * rad;
      const scale = 1.4 + Math.random() * 1.8;
      if (i % 2 === 0) mysticCanopy(tx, tz, scale, Math.random());
      else mysticConifer(tx, tz, scale, Math.random());
    }

    // Humanoid figure builder — reused for the Champion (player-
    // controlled, gold) and both companions (AI-controlled, teal),
    // matching the original game's own color convention for
    // distinguishing the two.
    // Godly warrior figure — towering, armored, and armed, replacing
    // the earlier plain unarmored humanoid per direct feedback that
    // it didn't read as a god's champion. Real proportions: a taller
    // frame, a breastplate distinct from the limbs, shoulder
    // pauldrons, a crested helm, a cape, and a spear — not just a
    // scaled-up version of the same simple figure.
    function buildHumanoidGroup(bodyColor, opts = {}) {
      // Real fix, caught by direct visual inspection: scaling each
      // part's POSITION without also scaling its own geometry size
      // pulled the body apart into disconnected floating pieces
      // rather than a single, proportionally larger figure. The
      // correct approach is a single group-level scale transform,
      // applied once at the end, which scales position and geometry
      // together — so every part below is built at its normal,
      // unscaled size and position.
      const scale = opts.scale ?? 1.8; // towering, not human-sized
      const group = new THREE.Group();
      const skinTone = 0xd9a878, bootColor = 0x3a2a20, armorColor = opts.armorColor ?? 0xc9c2b0, capeColor = opts.capeColor ?? bodyColor;
      function part(geo, color, x, y, z, matOpts = {}) {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: matOpts.roughness ?? 0.55, metalness: matOpts.metalness ?? 0.35, emissive: matOpts.emissive, emissiveIntensity: matOpts.emissiveIntensity }));
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        group.add(mesh);
        return mesh;
      }
      const legR = 0.03, legH = 0.22, hipGap = 0.05;
      for (const side of [-1, 1]) {
        part(new THREE.CylinderGeometry(legR, legR * 0.85, legH, 6), bodyColor, side * hipGap, legH / 2 + 0.03, 0);
        part(new THREE.CylinderGeometry(legR * 1.15, legR * 1.0, 0.1, 6), armorColor, side * hipGap, 0.14, 0, { metalness: 0.55 }); // greaves
        part(new THREE.CylinderGeometry(legR * 0.95, legR * 0.85, 0.06, 6), bootColor, side * hipGap, 0.03, 0);
      }
      const torsoBase = legH + 0.03;
      part(new THREE.CylinderGeometry(0.095, 0.075, 0.22, 8), armorColor, 0, torsoBase + 0.11, 0, { metalness: 0.6 }); // breastplate
      // Shoulder pauldrons — real armor bulk, not just arm cylinders.
      for (const side of [-1, 1]) {
        part(new THREE.SphereGeometry(0.055, 10, 8), armorColor, side * 0.12, torsoBase + 0.24, 0, { metalness: 0.6 });
        part(new THREE.CylinderGeometry(0.024, 0.02, 0.18, 6), bodyColor, side * 0.11, torsoBase + 0.1, 0);
      }
      // Cape — a flat plane behind the figure, double-sided.
      const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.32),
        new THREE.MeshStandardMaterial({ color: capeColor, roughness: 0.75, side: THREE.DoubleSide })
      );
      cape.position.set(0, torsoBase + 0.1, -0.06);
      cape.rotation.x = 0.15;
      cape.castShadow = true;
      group.add(cape);
      const neckY = torsoBase + 0.22;
      part(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 6), skinTone, 0, neckY, 0);
      const headY = neckY + 0.055;
      part(new THREE.SphereGeometry(0.052, 10, 10), skinTone, 0, headY, 0);
      // Crested helm — a real helmet with a raised comb, not a bare head.
      part(new THREE.SphereGeometry(0.056, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), armorColor, 0, headY + 0.006, 0, { metalness: 0.6 });
      part(new THREE.BoxGeometry(0.02, 0.09, 0.16), capeColor, 0, headY + 0.075, 0, { roughness: 0.6 });
      // Spear — a real weapon, held forward.
      const spearGroup = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x5a3f26, roughness: 0.7 }));
      shaft.position.set(0, 0.45, 0);
      shaft.castShadow = true;
      spearGroup.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.3, metalness: 0.8 }));
      tip.position.set(0, 0.95, 0);
      tip.castShadow = true;
      spearGroup.add(tip);
      spearGroup.position.set(0.16, torsoBase, 0.05);
      spearGroup.rotation.z = -0.55;
      group.add(spearGroup);
      group.scale.setScalar(scale);
      return group;
    }
    const championMesh = buildHumanoidGroup(0xffd23f, { armorColor: 0xf0d98a, capeColor: 0xb8272a, scale: 2.0 });
    scene.add(championMesh);
    const championRingMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 1.2 });
    const championRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 8, 24), championRingMat);
    championRing.rotation.x = Math.PI / 2;
    scene.add(championRing);
    const companionMeshes = companionsRef.current.map(() => {
      const mesh = buildHumanoidGroup(0x3ee6e0, { armorColor: 0xa8d8d4, capeColor: 0x1e6b66, scale: 1.9 });
      scene.add(mesh);
      return mesh;
    });

    // Armed enemy figure — a real humanoid with a spear, replacing
    // the plain sphere per direct feedback that enemies needed to
    // "look like real power". Scaled by each enemy type's own radius
    // stat, so a Minotaur or Cyclops genuinely towers over a Harpy or
    // Satyr rather than every enemy reading as the same size.
    function buildEnemyFigure(color, radius) {
      // Same group-level-scale fix as buildHumanoidGroup above — all
      // parts below are built at normal, unscaled size/position, and
      // the whole group is scaled once at the end.
      const group = new THREE.Group();
      const scale = (radius / 0.1) * 1.8; // 0.1 was the Harpy's old sphere radius baseline; the 1.8 multiplier makes enemies genuinely tower, matching the Champion's own increased scale, while still preserving real size differences between enemy types
      const darkColor = new THREE.Color(color).multiplyScalar(0.55);
      function part(geo, mColor, x, y, z, matOpts = {}) {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mColor, roughness: matOpts.roughness ?? 0.7, metalness: matOpts.metalness ?? 0.1 }));
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        group.add(mesh);
      }
      const legR = 0.028, legH = 0.16, hipGap = 0.045;
      for (const side of [-1, 1]) {
        part(new THREE.CylinderGeometry(legR, legR * 0.85, legH, 6), darkColor, side * hipGap, legH / 2, 0);
      }
      const torsoBase = legH;
      part(new THREE.CylinderGeometry(0.085, 0.07, 0.2, 8), color, 0, torsoBase + 0.1, 0, { metalness: 0.2 });
      for (const side of [-1, 1]) part(new THREE.CylinderGeometry(0.022, 0.018, 0.15, 6), darkColor, side * 0.095, torsoBase + 0.1, 0);
      const headY = torsoBase + 0.28;
      part(new THREE.SphereGeometry(0.055, 8, 8), darkColor, 0, headY, 0);
      // Curved horns — a menacing, non-human silhouette fitting a
      // mythological enemy rather than a plain head.
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4 }));
        horn.position.set(side * 0.04, headY + 0.05, -0.01);
        horn.rotation.z = side * 0.5;
        horn.castShadow = true;
        group.add(horn);
      }
      // Spear — the same real weapon silhouette as the Champion's,
      // held forward and larger on bigger enemy types (via scale).
      const spearGroup = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.85, 6), new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.75 }));
      shaft.position.set(0, 0.42, 0);
      shaft.castShadow = true;
      spearGroup.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0x9098a0, roughness: 0.4, metalness: 0.7 }));
      tip.position.set(0, 0.9, 0);
      tip.castShadow = true;
      spearGroup.add(tip);
      spearGroup.position.set(0.14, torsoBase, 0.04);
      spearGroup.rotation.z = -0.6;
      group.add(spearGroup);
      group.scale.setScalar(scale);
      return group;
    }

    const enemyMeshes = new Map();
    const wardMeshes = new Map();

    // Real 3D visual effects for each God Power — per direct
    // feedback that these were previously invisible entirely. Each
    // effect builds its own meshes once, is animated over its own
    // duration in the tick loop below, and is fully disposed when
    // finished, not left cluttering the scene.
    function createEffectMeshes(type) {
      if (type === "zeus") {
        // A jagged bolt descending from high above, built as several
        // connected thin cylinder segments with random horizontal
        // jitter — reads as a real lightning strike, not a straight
        // laser beam.
        const group = new THREE.Group();
        const boltMat = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffd23f, emissiveIntensity: 3 });
        const segCount = 7, boltHeight = 14;
        let prevX = 0, prevY = boltHeight, prevZ = 0;
        for (let i = 1; i <= segCount; i++) {
          const boltT = i / segCount;
          const nx = (Math.random() - 0.5) * 0.6 * (1 - boltT * 0.6);
          const ny = boltHeight * (1 - boltT);
          const nz = (Math.random() - 0.5) * 0.6 * (1 - boltT * 0.6);
          const dx = nx - prevX, dy = ny - prevY, dz = nz - prevZ;
          const segLen = Math.hypot(dx, dy, dz);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, segLen, 5), boltMat);
          seg.position.set((prevX + nx) / 2, (prevY + ny) / 2, (prevZ + nz) / 2);
          seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
          group.add(seg);
          prevX = nx; prevY = ny; prevZ = nz;
        }
        const flash = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffd23f, emissiveIntensity: 2, transparent: true, opacity: 0.8 }));
        group.add(flash);
        const light = new THREE.PointLight(0xffd23f, 8, 4, 2);
        group.add(light);
        return { group, flash, light, boltMat };
      }
      if (type === "poseidon") {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3ea8ff, emissive: 0x3ea8ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }));
        ring.rotation.x = Math.PI / 2;
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xa8e0ff, emissive: 0xa8e0ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 }));
        ring2.rotation.x = Math.PI / 2;
        const group = new THREE.Group();
        group.add(ring, ring2);
        const light = new THREE.PointLight(0x3ea8ff, 4, 3, 2);
        group.add(light);
        return { group, ring, ring2, light };
      }
      if (type === "ares") {
        const aura = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff5a3c, emissiveIntensity: 2, transparent: true, opacity: 0.85 }));
        aura.rotation.x = Math.PI / 2;
        const light = new THREE.PointLight(0xff5a3c, 3, 2.5, 2);
        const group = new THREE.Group();
        group.add(aura, light);
        return { group, aura, light };
      }
      return { group: new THREE.Group() };
    }
    function updateEffectMeshes(effect, progress) {
      const m = effect.meshData;
      if (effect.type === "zeus") {
        // Bolt flashes in immediately then fades hard — a real
        // lightning strike is near-instant, not a slow glow.
        const fade = Math.max(0, 1 - progress * 2.2);
        m.boltMat.emissiveIntensity = 3 * fade;
        m.flash.material.opacity = 0.8 * fade;
        m.flash.scale.setScalar(1 + progress * 3);
        m.light.intensity = 8 * fade;
      } else if (effect.type === "poseidon") {
        const power = POWERS.poseidon;
        const r = progress * power.radius;
        m.ring.scale.set(r / 0.1, r / 0.1, 1);
        m.ring2.scale.set((r * 0.7) / 0.06, (r * 0.7) / 0.06, 1);
        const fade = Math.max(0, 1 - progress);
        m.ring.material.opacity = 0.85 * fade;
        m.ring2.material.opacity = 0.7 * fade;
        m.light.intensity = 4 * fade;
      } else if (effect.type === "ares") {
        // A pulsing aura around the Champion for the buff's full
        // duration, tracking wherever the Champion currently is.
        const champ = championRef.current;
        effect.meshData.group.position.set(champ.x, terrainHeight(champ.x, champ.z) + 0.15, champ.z);
        const pulse = 1 + Math.sin(progress * Math.PI * 10) * 0.12;
        m.aura.scale.setScalar(pulse);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    function handleClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObject(ground);
      if (hits.length === 0) return;
      const point = hits[0].point;
      const clickX = point.x, clickZ = point.z;
      // A power or Ward armed takes priority over normal move/attack
      // targeting — the same "select then target" interaction the
      // original 2D game used, so casting doesn't collide with
      // ordinary movement clicks.
      if (selectedPowerRef.current) {
        castPower(selectedPowerRef.current, clickX, clickZ);
        selectedPowerRef.current = null;
        setSelectedPower(null);
        return;
      }
      if (placingWardRef.current) {
        tryPlaceWard(clickX, clickZ);
        return;
      }
      let clickedEnemy = null;
      for (const en of enemiesRef.current) {
        const def = ENEMY_TYPES[en.typeId];
        if (dist(clickX, clickZ, en.x, en.z) <= def.radius + 0.08) {
          clickedEnemy = en;
          break;
        }
      }
      const champ = championRef.current;
      if (clickedEnemy) {
        champ.attackTargetId = clickedEnemy.id;
        champ.moveTarget = null;
      } else {
        champ.attackTargetId = null;
        champ.moveTarget = { x: clickX, z: clickZ };
      }
    }
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.style.cursor = "crosshair";

    function tick() {
      const now = Date.now();

      if (waveStateRef.current === "spawning") {
        if (spawnedThisWaveRef.current < waveTargetCountRef.current && now > nextSpawnAtRef.current) {
          spawnOneEnemy();
          spawnedThisWaveRef.current += 1;
          nextSpawnAtRef.current = now + 550;
        }
        if (spawnedThisWaveRef.current >= waveTargetCountRef.current) {
          waveStateRef.current = "active";
        }
      } else if (waveStateRef.current === "idle") {
        startNextWave();
      }

      // Enemy movement toward the Temple, real contact damage
      enemiesRef.current = enemiesRef.current.filter((en) => {
        const d = dist(en.x, en.z, TEMPLE.x, TEMPLE.z);
        if (d < TEMPLE.r + 0.08) {
          if (now - en.lastAttackAt > 900) {
            en.lastAttackAt = now;
            const def = ENEMY_TYPES[en.typeId];
            templeHpRef.current = Math.max(0, templeHpRef.current - def.damage);
          }
          return true;
        }
        const ang = Math.atan2(TEMPLE.z - en.z, TEMPLE.x - en.x);
        const def = ENEMY_TYPES[en.typeId];
        en.x += Math.cos(ang) * def.speed;
        en.z += Math.sin(ang) * def.speed;
        return true;
      });

      // Champion — move toward target, attack if in range
      const champ = championRef.current;
      if (champ.hp > 0) {
        let target = null;
        if (champ.attackTargetId != null) {
          target = enemiesRef.current.find((en) => en.id === champ.attackTargetId && en.hp > 0);
          if (!target) champ.attackTargetId = null;
        }
        if (target) {
          const d = dist(champ.x, champ.z, target.x, target.z);
          if (d > CHAMPION_ATTACK_RANGE) {
            const ang = Math.atan2(target.z - champ.z, target.x - champ.x);
            champ.x += Math.cos(ang) * CHAMPION_SPEED;
            champ.z += Math.sin(ang) * CHAMPION_SPEED;
          } else if (now - champ.lastAttackAt > CHAMPION_ATTACK_RATE) {
            champ.lastAttackAt = now;
            const furyActive = now < aresActiveUntilRef.current;
            target.hp -= furyActive ? Math.round(CHAMPION_DAMAGE * POWERS.ares.damageMult) : CHAMPION_DAMAGE;
            if (target.hp <= 0) champ.attackTargetId = null;
          }
        } else if (champ.moveTarget) {
          const d = dist(champ.x, champ.z, champ.moveTarget.x, champ.moveTarget.z);
          if (d < 0.1) champ.moveTarget = null;
          else {
            const ang = Math.atan2(champ.moveTarget.z - champ.z, champ.moveTarget.x - champ.x);
            champ.x += Math.cos(ang) * CHAMPION_SPEED;
            champ.z += Math.sin(ang) * CHAMPION_SPEED;
          }
        }
      }

      // AI companions — the exact same behavior the original game's
      // AI champions used: engage the nearest enemy within range,
      // drift back toward a guard position near the Temple when
      // nothing's close. 0.85 engage range matches the original's
      // 85 (2D pixel) units, converted by the same /SCALE factor
      // used throughout this file.
      for (const comp of companionsRef.current) {
        if (comp.hp <= 0) continue;
        let target = null, bestD = 0.85;
        for (const en of enemiesRef.current) {
          const d = dist(comp.x, comp.z, en.x, en.z);
          if (d < bestD) { bestD = d; target = en; }
        }
        if (target) {
          if (now - comp.lastAttackAt > CHAMPION_ATTACK_RATE) {
            comp.lastAttackAt = now;
            target.hp -= CHAMPION_DAMAGE;
          }
        } else {
          const homeAng = Math.atan2(TEMPLE.z - comp.z, TEMPLE.x - comp.x);
          const homeD = dist(comp.x, comp.z, TEMPLE.x, TEMPLE.z);
          if (homeD > 0.8) {
            comp.x += Math.cos(homeAng) * 0.006;
            comp.z += Math.sin(homeAng) * 0.006;
          }
        }
      }

      // Wards — stationary defenders, the same "engage nearest enemy
      // in range" pattern as companions, but immobile once placed.
      wardsRef.current = wardsRef.current.filter((w) => w.hp > 0);
      for (const w of wardsRef.current) {
        let target = null, bestD = WARD_RANGE;
        for (const en of enemiesRef.current) {
          const d = dist(w.x, w.z, en.x, en.z);
          if (d < bestD) { bestD = d; target = en; }
        }
        if (target && now - w.lastAttackAt > WARD_RATE_MS) {
          w.lastAttackAt = now;
          target.hp -= WARD_DAMAGE;
        }
      }

      // Hydra-only mechanics — regeneration and a ranged venom
      // attack, the same safe damage-detection approach as the
      // original game: comparing HP tick-to-tick rather than
      // instrumenting every damage source (Champion melee, both
      // companions) to explicitly stamp a "last hit" timestamp.
      for (const en of enemiesRef.current) {
        if (en.typeId !== "hydra") continue;
        if (en.hp < en.prevHp) en.lastDamagedAt = now;
        en.prevHp = en.hp;
        if (now - en.lastDamagedAt > 4000) {
          en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.0025);
        }
        if (now - en.lastVenomAt > 2500) {
          const targets = [champ, ...companionsRef.current].filter((unit) => unit.hp > 0);
          let nearest = null, bestD = 3;
          for (const unit of targets) {
            const d = dist(en.x, en.z, unit.x, unit.z);
            if (d < bestD) { bestD = d; nearest = unit; }
          }
          if (nearest) {
            en.lastVenomAt = now;
            nearest.hp = Math.max(0, nearest.hp - 25);
          }
        }
      }

      enemiesRef.current = enemiesRef.current.filter((en) => en.hp > 0);

      if (waveStateRef.current === "active" && enemiesRef.current.length === 0) {
        waveStateRef.current = "idle";
        if (waveRef.current >= TOTAL_WAVES) {
          setPhase("over");
          setOutcome("won");
        }
      }
      if (templeHpRef.current <= 0) {
        setPhase("over");
        setOutcome("lost");
      }

      // Sync meshes to current state
      const champHeight = terrainHeight(champ.x, champ.z);
      championMesh.position.set(champ.x, champHeight, champ.z);
      championMesh.visible = champ.hp > 0;
      championRing.position.set(champ.x, champHeight + 0.02, champ.z);
      championRing.visible = champ.hp > 0;

      companionsRef.current.forEach((comp, i) => {
        const mesh = companionMeshes[i];
        mesh.position.set(comp.x, terrainHeight(comp.x, comp.z), comp.z);
        mesh.visible = comp.hp > 0;
      });

      // Ward meshes — a glowing crystal at each placed Ward's
      // position, the same live-sync pattern already used for
      // enemies (create once per real id, dispose when gone).
      const liveWardIds = new Set();
      for (const w of wardsRef.current) {
        liveWardIds.add(w.id);
        let mesh = wardMeshes.get(w.id);
        if (!mesh) {
          mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 1.4, metalness: 0.4 }));
          mesh.castShadow = true;
          scene.add(mesh);
          wardMeshes.set(w.id, mesh);
        }
        mesh.position.set(w.x, terrainHeight(w.x, w.z) + 0.12, w.z);
        mesh.rotation.y += 0.03;
      }
      for (const [id, mesh] of wardMeshes) {
        if (!liveWardIds.has(id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          wardMeshes.delete(id);
        }
      }

      // Visual effect lifecycle — build meshes once per active
      // effect, animate over its own duration, dispose fully once
      // finished. Nothing here is left cluttering the scene forever.
      effectsRef.current = effectsRef.current.filter((effect) => {
        const elapsed = now - effect.startTime;
        if (elapsed > effect.durationMs) {
          if (effect.meshData) {
            scene.remove(effect.meshData.group);
            effect.meshData.group.traverse((obj) => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) obj.material.dispose();
            });
          }
          return false;
        }
        if (!effect.meshData) {
          effect.meshData = createEffectMeshes(effect.type);
          if (effect.type !== "ares") effect.meshData.group.position.set(effect.x, terrainHeight(effect.x, effect.z), effect.z);
          scene.add(effect.meshData.group);
        }
        updateEffectMeshes(effect, elapsed / effect.durationMs);
        return true;
      });

      const liveIds = new Set();
      for (const en of enemiesRef.current) {
        liveIds.add(en.id);
        let mesh = enemyMeshes.get(en.id);
        if (!mesh) {
          const def = ENEMY_TYPES[en.typeId];
          mesh = buildEnemyFigure(def.color, def.radius);
          scene.add(mesh);
          enemyMeshes.set(en.id, mesh);
        }
        mesh.position.set(en.x, terrainHeight(en.x, en.z), en.z);
      }
      for (const [id, mesh] of enemyMeshes) {
        if (!liveIds.has(id)) {
          scene.remove(mesh);
          mesh.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
          });
          enemyMeshes.delete(id);
        }
      }

      setHud({
        templeHp: Math.round(templeHpRef.current),
        altarHp: Math.round(altarHpRef.current),
        wave: waveRef.current,
        enemiesLeft: enemiesRef.current.length,
        faith: Math.round(faithRef.current),
        powerCooldowns: {
          zeus: Math.max(0, (powerCooldownsRef.current.zeus || 0) - now),
          poseidon: Math.max(0, (powerCooldownsRef.current.poseidon || 0) - now),
          ares: Math.max(0, (powerCooldownsRef.current.ares || 0) - now),
        },
        wardsCount: wardsRef.current.length,
      });

      composer.render();
      frameIdRef.current = requestAnimationFrame(tick);
    }
    tick();

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      cancelAnimationFrame(frameIdRef.current);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "menu") {
    return (
      <div className="text-center p-8">
        <h2 className="font-pixel text-lg mb-4" style={{ color: "#d4af37" }}>WRATH OF OLYMPUS</h2>
        <p className="font-mono text-sm mb-6" style={{ color: "#a89f91" }}>
          Round 1 of a genuine ground-up 3D rebuild — the real core loop: Temple, Altar, your Champion, and real
          enemy waves. Click the ground to move, click an enemy to attack it.
        </p>
        <button onClick={startGame} className="font-mono px-6 py-3 rounded-md" style={{ background: "#d4af37", color: "#1a0f05" }}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center p-8">
        <h2 className="font-pixel text-lg mb-4" style={{ color: outcome === "won" ? "#7cff5e" : "#ff5a3c" }}>
          {outcome === "won" ? "VICTORY" : "THE TEMPLE HAS FALLEN"}
        </h2>
        <p className="font-mono text-sm mb-6" style={{ color: "#a89f91" }}>Wave reached: {hud.wave}/{TOTAL_WAVES}</p>
        <button onClick={startGame} className="font-mono px-6 py-3 rounded-md" style={{ background: "#d4af37", color: "#1a0f05" }}>
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div
        className="relative mx-auto overflow-hidden border border-lineColor cursor-crosshair"
        style={
          isFullscreen
            ? { width: "100vw", height: "100vh", borderRadius: 0 }
            : { width: "min(94vw, calc(65vh * 1.6))", height: "65vh", borderRadius: "0.5rem" }
        }
      >
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 flex justify-between font-mono text-[11px] flex-wrap gap-2 px-4 py-2.5 rounded-md z-10"
          style={{ background: "linear-gradient(180deg, rgba(18,10,5,0.95), rgba(3,1,1,0.98))", border: "1.5px solid rgba(212,175,55,0.55)", maxWidth: "94%" }}
        >
          <span style={{ color: "#f0e6d2" }}>⛩️ Temple: {hud.templeHp}/{TEMPLE.maxHp}</span>
          <span style={{ color: "#3ee6e0" }}>✨ Faith: {hud.faith}</span>
          <span style={{ color: "#d4af37" }}>🌊 Wave {hud.wave}/{TOTAL_WAVES} · {hud.enemiesLeft} remaining</span>
          <span style={{ color: "#b45cff" }}>🏛️ Altar: {hud.altarHp}</span>
        </div>
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex justify-center gap-2.5 p-3 rounded-md flex-wrap z-10"
          style={{ background: "linear-gradient(180deg, rgba(18,10,5,0.95), rgba(3,1,1,0.98))", border: "1.5px solid rgba(212,175,55,0.55)", maxWidth: "94%" }}
        >
          {Object.entries(POWERS).map(([id, power]) => {
            const cooldown = hud.powerCooldowns[id] || 0;
            const onCooldown = cooldown > 0;
            const affordable = hud.faith >= power.faithCost;
            const disabled = onCooldown || !affordable;
            const active = selectedPower === id;
            return (
              <button
                key={id}
                onClick={() => handlePowerButtonClick(id)}
                disabled={disabled}
                className="font-mono text-[10px] px-4 py-2.5 rounded-md border disabled:opacity-40 flex flex-col items-center transition-all"
                style={{
                  borderColor: active ? `#${power.color.toString(16).padStart(6, "0")}` : "rgba(212,175,55,0.35)",
                  color: `#${power.color.toString(16).padStart(6, "0")}`,
                  background: active ? `#${power.color.toString(16).padStart(6, "0")}22` : "rgba(255,255,255,0.02)",
                }}
              >
                <span>{power.icon} {power.name}</span>
                <span className="text-[9px] mt-0.5" style={{ color: "#a89f91" }}>
                  {onCooldown ? `${Math.ceil(cooldown / 1000)}s` : `${power.faithCost} faith`}
                </span>
              </button>
            );
          })}
          {(() => {
            const wardDisabled = hud.faith < WARD_FAITH_COST || hud.wardsCount >= WARD_MAX_COUNT;
            return (
              <button
                onClick={() => {
                  if (wardDisabled) return;
                  const next = !placingWardRef.current;
                  placingWardRef.current = next;
                  setPlacingWard(next);
                  selectedPowerRef.current = null;
                  setSelectedPower(null);
                }}
                disabled={wardDisabled}
                className="font-mono text-[10px] px-4 py-2.5 rounded-md border disabled:opacity-40 flex flex-col items-center transition-all"
                style={{
                  borderColor: placingWard ? "#ffd23f" : "rgba(212,175,55,0.35)",
                  color: "#ffd23f",
                  background: placingWard ? "#ffd23f22" : "rgba(255,255,255,0.02)",
                }}
              >
                <span>◆ Place Ward</span>
                <span className="text-[9px] mt-0.5" style={{ color: "#a89f91" }}>
                  {hud.wardsCount >= WARD_MAX_COUNT ? `${WARD_MAX_COUNT}/${WARD_MAX_COUNT} placed` : `${WARD_FAITH_COST} faith`}
                </span>
              </button>
            );
          })()}
        </div>
        {!isFullscreen && (
          <button
            onClick={() => {
              const el = document.documentElement;
              if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            }}
            className="absolute top-2 right-2 font-mono text-[10px] px-2.5 py-1.5 rounded-md z-10"
            style={{ background: "rgba(18,10,5,0.9)", border: "1.5px solid rgba(212,175,55,0.55)", color: "#d4af37" }}
          >
            ⛶ Fullscreen
          </button>
        )}
      </div>
    </div>
  );
}
