// Operation Blacksite — first-person engine. One match = 5 v 5 on the Foundry Yard map: buy phase,
// attackers carry the bomb to plant it, defenders stop them, sides swap at half time.
// The React component only draws menus/HUD from hudState(); everything else happens here.
import * as THREE from "three";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { createCinematic } from "@/lib/cinematic/post";
import { createGameMusic } from "@/lib/cinematic/music";
import { loadMap, createMap, SITES, TERROR_SPAWNS, POLICE_SPAWNS, CELL, COLS, ROWS } from "./map";
import { buildWorld } from "./world";
import { createFx } from "./fx";
import { createViewModel } from "./viewmodel";
import { createSfx } from "./sfx";
import { buildSoldier, poseSoldier, TEAM_LOOK } from "./soldier";
import { createBotBrain } from "./bots";
import { WEAPONS, GRENADES, ARMOR_PRICE, KIT_PRICE, START_MONEY, MAX_MONEY, ECON, buyCatalog, recoilStep, computeDamage, modelOf, MODEL_IDS, PENETRATION } from "./weapons";

export const DIFFS = {
  recruit: { label: "RECRUIT", react: 620, aimErr: 3.4, aimRate: 6, headChance: 0.12, hear: 0.7, spreadMul: 1.5, dmgMul: 0.85, scoreMult: 1 },
  veteran: { label: "VETERAN", react: 380, aimErr: 1.9, aimRate: 9, headChance: 0.25, hear: 1.0, spreadMul: 1.0, dmgMul: 1.0, scoreMult: 1.4 },
  elite: { label: "ELITE", react: 210, aimErr: 1.0, aimRate: 14, headChance: 0.4, hear: 1.2, spreadMul: 0.85, dmgMul: 1.1, scoreMult: 1.9 },
};
export const MATCH = { rounds: 10, toWin: 6, freeze: 10, live: 100, plant: 3.2, defuse: 10, defuseKit: 5, bomb: 40, endHold: 5.5 };
const FRIENDS = ["Reyes", "Kade", "Voss", "Milo", "Osei", "Brandt", "Iker", "Suri"];
const FOES = ["Hex", "Rook", "Zane", "Dmitri", "Cobra", "Nyx", "Tavo", "Ash", "Pike", "Vega"];
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GRAV = 15.5, JUMP = 5.3, RUN = 5.6, EYE = 1.62;

// Picture quality presets: render scale, pixel-ratio ceiling, shadow map size and anti-aliasing samples.
export const QUALITY = {
  low: { label: "Performance", scale: 0.8, maxPR: 1, shadow: 1024, samples: 0 },
  medium: { label: "Balanced", scale: 1, maxPR: 1.25, shadow: 2048, samples: 2 },
  high: { label: "High", scale: 1, maxPR: 2, shadow: 4096, samples: 4 },
  ultra: { label: "Ultra (4K)", scale: 1.5, maxPR: 2.5, shadow: 4096, samples: 4 },
};
export function createEngine({ mount, difficulty = "veteran", onMatchEnd, bests, mapId = "bazaar", quality = "high" }) {
  const diff = DIFFS[difficulty] || DIFFS.veteran;
  loadMap(mapId); const map = createMap(); const look = map.def.look; const day = look.mode === "day"; const Q = QUALITY[quality] || QUALITY.high;
  const lowq = typeof window !== "undefined" && window.__BS_LOWQ;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch { return null; }
  let width = mount.clientWidth || 1280, height = mount.clientHeight || 720;
  renderer.setPixelRatio(lowq ? 0.6 : Math.min((window.devicePixelRatio || 1) * Q.scale, Q.maxPR)); renderer.setSize(width, height);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none"; renderer.domElement.tabIndex = 0;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(78, width / height, 0.05, 700); scene.add(camera);
  const world = buildWorld(scene, renderer, map, { shadowSize: lowq ? 1024 : Q.shadow });
  const fx = createFx(scene); if (day && fx.setTint) fx.setTint(look.dust ?? 0xd8c8a0); const sfx = createSfx(); const muzzleLight = new THREE.PointLight(0xffb060, 0, 16, 2); scene.add(muzzleLight); const vm = createViewModel(scene.environment, day ? { hemi: look.hemi, sun: look.sun } : null);
  // colour grade: a calm, slightly bleached, contrasty "camera" look (think tactical-shooter screenshots), not a candy-bright one
  const GRADE = day ? { vig: 0.26, grain: 0.011, sat: 0.93, contrast: 1.12, shadow: [0.92, 0.98, 1.07], high: [1.07, 1.0, 0.9], ca: 0.0002 } : { vig: 0.34, grain: 0.015, sat: 0.96, contrast: 1.1, shadow: [0.9, 1, 1.05], high: [1, 1.03, 0.95], ca: 0.0004 };
  const cine = createCinematic(renderer, scene, camera, { exposure: look.exposure, bloom: look.bloom, samples: lowq ? 0 : Q.samples, grade: GRADE });
  if (cine.composer) { const pass = new RenderPass(vm.scene, vm.camera); pass.clear = false; pass.clearDepth = true; cine.composer.insertPass(pass, 1); }
  let music = null; try { music = createGameMusic("blacksite", "blacksite-music"); } catch { music = null; }

  // ---------------------------------------------------------------------------------------------------------------------------------
  const E = { map, fx, sfx, scene, camera, diff, ents: [], noises: [], intel: { police: {}, terrorist: {} }, round: { phase: "menu", t: 0, no: 0, plan: "", timeLeft: 0 }, autopilot: false };
  let simTime = 0; E.now = () => simTime;
  const R = E.round;
  const score = { you: 0, them: 0 }; const lossStreak = { you: 0, them: 0 }; let half = 1; let over = false;
  const feed = []; let radioMsg = null; let subtitle = { text: "", sub: "", t: -99, color: "#fff" }; let radioLast = { terrorist: -9, police: -9 };
  const stats = { kills: 0, hs: 0, plants: 0, defuses: 0, deaths: 0, damage: 0 };
  const bomb = { state: "carried", x: 0, y: 0, z: 0, site: null, timer: MATCH.bomb, defuser: null, dropId: 0, beepT: 0, planter: null };
  E.bomb = bomb;
  const pstate = { locked: false, paused: false, menuOpen: false, scoreboard: false, scoped: 0, zoomStep: 0, hitMark: 0, hitHead: false, flashAmt: 0, hurt: 0, dmgDirs: [], shake: 0, landDip: 0, stepT: 0, bob: 0, lastZone: "", punch: { yaw: 0, pitch: 0 }, yawRaw: 0, use: false, usePrev: false, fireHeld: false, lastTeamKey: "" };
  const input = { keys: {}, lDown: false, rDown: false, lPress: false, rPress: false, dx: 0, dy: 0, sens: 1 };
  try { const sv = parseFloat(localStorage.getItem("blacksite-sens") || ""); if (!Number.isNaN(sv)) input.sens = sv; } catch {}
  E.testNoLock = typeof window !== "undefined" && !!window.__BS_NOLOCK;
  const tmpDir = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Vector3();

  // ---- entities ------------------------------------------------------------------------------------------------------------------
  const mkEnt = (id, name, squad, isPlayer) => ({
    id, name, squad, isPlayer, team: "terrorist", x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, alive: true, money: START_MONEY, kills: 0, deaths: 0, hs: 0, assists: 0,
    primary: null, secondary: "pistol", cur: "pistol", prev: "pistol", ammo: {}, nades: { flash: 0, smoke: 0, he: 0 }, kit: false, hasBomb: false, crouch: 0, onGround: true, nextShot: 0, reloadEnd: 0, drawEnd: 0, spray: 0, lastShotT: -9,
    flashedUntil: 0, fireAnim: 0, dead: 0, use: null, income: 0, ai: { startAt: 0, nextThink: 0 }, model: null, label: null, lastDamageT: -9, spawnIdx: 0,
  });
  const player = mkEnt(0, "You", "you", true); E.player = player;
  E.ents.push(player);
  for (let i = 0; i < 4; i++) E.ents.push(mkEnt(1 + i, FRIENDS[i], "you", false));
  for (let i = 0; i < 5; i++) E.ents.push(mkEnt(5 + i, FOES[i], "them", false));
  const teamOfSquad = (sq) => ((sq === "you") === (half === 1) ? "terrorist" : "police");
  function giveLoadout(e, fresh) {
    if (fresh) { e.primary = null; e.secondary = "pistol"; e.armor = 0; e.kit = false; e.nades = { flash: 0, smoke: 0, he: 0 }; e.ammo = { pistol: { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve }, knife: { mag: 1, reserve: 0 } }; }
    if (!e.ammo.knife) e.ammo.knife = { mag: 1, reserve: 0 }; if (!e.ammo.pistol) e.ammo.pistol = { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve };
    e.cur = e.primary || "pistol"; e.prev = "pistol";
  }
  function rebuildModel(e) {
    if (e.isPlayer) return; if (e.model) scene.remove(e.model.root);
    e.model = buildSoldier(e.team, { seed: (e.id ?? 0) * 17 + Math.floor(Math.random() * 9000), weapon: modelOf(e.cur, e.team) && MODEL_IDS.includes(modelOf(e.cur, e.team)) ? modelOf(e.cur, e.team) : "pistol" }); scene.add(e.model.root);
    if (e.label) scene.remove(e.label);
    // name tag with a team-coloured marker; teammates' tags show through walls so friends are never mistaken for foes
    const c = document.createElement("canvas"); c.width = 256; c.height = 96; const g = c.getContext("2d"); const col = "#" + TEAM_LOOK[e.team].accent.toString(16).padStart(6, "0");
    g.font = "600 30px ui-sans-serif, system-ui, sans-serif"; g.textAlign = "center"; g.lineJoin = "round"; g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,0.7)"; g.strokeText(e.name, 128, 36); g.fillStyle = "#e9eef2"; g.fillText(e.name, 128, 36);
    g.beginPath(); g.moveTo(114, 52); g.lineTo(142, 52); g.lineTo(128, 74); g.closePath(); g.fillStyle = "rgba(0,0,0,0.7)"; g.fill(); g.beginPath(); g.moveTo(118, 55); g.lineTo(138, 55); g.lineTo(128, 69); g.closePath(); g.fillStyle = col; g.fill();
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const mate = e.team === teamOfSquad("you");
    e.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: !mate, toneMapped: false })); e.label.renderOrder = 20; e.label.scale.set(1.1, 0.41, 1); scene.add(e.label);
  }
  let vmTeam = null;
  const brain = createBotBrain(E);
  E.inSite = (e, s) => { const k = SITES[s]; return Math.hypot(e.x - k.cx, e.z - k.cz) < k.r; };
  const zoneName = (x, z) => { const zn = map.zoneAt(x, z); return zn ? zn.name : ""; };
  const eyeY = (e) => e.y + EYE - e.crouch * 0.42;

  // ---- economy and buying -------------------------------------------------------------------------------------------------------------
  function addMoney(e, v) { e.money = clamp(e.money + v, 0, MAX_MONEY); }
  function buyItem(e, id) {
    const side = e.team; const item = buyCatalog(side).find((i) => i.id === id); if (!item) return false;
    if (e.money < item.price) return false;
    if (id === "armor") { if (e.armor >= 100) return false; e.armor = 100; }
    else if (id === "kit") { if (e.kit) return false; e.kit = true; }
    else if (GRENADES[id]) { if (e.nades[id] >= GRENADES[id].max) return false; e.nades[id]++; }
    else if (id === "pistol") { e.ammo.pistol = { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve }; }
    else if (WEAPONS[id] && WEAPONS[id].slot === 1) { e.primary = id; e.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }; e.cur = id; }
    else return false;
    e.money -= item.price; if (e.isPlayer) { sfx.buy(); vm.drawNow(); syncVm(); } return true;
  }
  function botBuy(e) {
    const m = e.money; const rifle = e.team === "terrorist" ? "rifleT" : "rifleCT", smg = e.team === "terrorist" ? "smgT" : "smgCT";
    const have = !!e.primary; const teamSniper = E.ents.some((o) => o.team === e.team && o.primary === "sniper");
    if (!have) {
      if (m >= 5400 && !teamSniper && Math.random() < 0.18) buyItem(e, "sniper");
      else if (m >= 2300 && m < 3600 && Math.random() < 0.16) { buyItem(e, "dmr"); buyItem(e, "armor"); }
      else if (m >= 1200 && m < 2000 && Math.random() < 0.16) buyItem(e, "shotgun");
      else if (m >= 700 && m < 1300 && Math.random() < 0.3) buyItem(e, "deagle");
      else if (m >= WEAPONS[rifle].price + 1000) { buyItem(e, rifle); buyItem(e, "armor"); }
      else if (m >= WEAPONS[rifle].price && Math.random() < 0.7) buyItem(e, rifle);
      else if (m >= WEAPONS[smg].price + 1000 && Math.random() < 0.7) { buyItem(e, smg); buyItem(e, "armor"); }
      else if (m >= WEAPONS[smg].price + 300 && Math.random() < 0.5) buyItem(e, smg);
    } else if (e.armor < 50 && e.money > 1700) buyItem(e, "armor");
    if (e.team === "police" && e.money > 1400 && Math.random() < 0.6) buyItem(e, "kit");
    if (e.money > 1200 && Math.random() < 0.7) buyItem(e, "smoke"); if (e.money > 900 && Math.random() < 0.6) buyItem(e, "flash"); if (e.money > 2500 && Math.random() < 0.3) buyItem(e, "he");
    e.cur = e.primary || "pistol";
  }

  // ---- round flow -------------------------------------------------------------------------------------------------------------------------------
  function say(text, sub = "", color = "#ffffff") { subtitle = { text, sub, t: simTime, color }; }
  function beginRound() {
    R.no++; const prevHalf = half; half = R.no <= 5 ? 1 : 2; const swapped = half !== prevHalf; const newMatch = R.no === 1;
    for (const e of E.ents) {
      e.team = teamOfSquad(e.squad); const fresh = newMatch || swapped || !e.alive;
      if (newMatch || swapped) { e.money = START_MONEY; if (swapped) { e.kills = 0; e.deaths = 0; } }
      if (fresh) giveLoadout(e, true); else giveLoadout(e, false);
      e.alive = true; e.hp = 100; e.vx = e.vy = e.vz = 0; e.crouch = 0; e.dead = 0; e.use = null; e.hasBomb = false; e.nextShot = 0; e.reloadEnd = 0; e.spray = 0; e.flashedUntil = 0; e.income = 0; e.roundKills = 0;
      if (e.primary && !e.ammo[e.primary]) e.ammo[e.primary] = { mag: WEAPONS[e.primary].mag, reserve: WEAPONS[e.primary].reserve };
      if (!e.isPlayer && (swapped || newMatch || !e.model || e.model.team !== e.team)) rebuildModel(e);
    }
    const byTeam = { terrorist: E.ents.filter((e) => e.team === "terrorist"), police: E.ents.filter((e) => e.team === "police") };
    for (const t of ["terrorist", "police"]) { const spawns = (t === "terrorist" ? TERROR_SPAWNS : POLICE_SPAWNS).slice().sort(() => Math.random() - 0.5); byTeam[t].forEach((e, i) => { const sp = spawns[i % spawns.length]; e.x = sp.x + (i >= spawns.length ? 1.2 : 0); e.z = sp.z; e.y = 0; e.yaw = t === "terrorist" ? 0 : Math.PI; e.pitch = 0; }); }
    // bomb to a random attacker (never the human unless they are the only one alive)
    const ts = byTeam.terrorist; const carrier = ts.filter((e) => !e.isPlayer)[Math.floor(Math.random() * Math.max(1, ts.filter((e) => !e.isPlayer).length))] || ts[0]; const pickPlayer = Math.random() < 0.25 && ts.includes(player); const c = pickPlayer ? player : carrier; c.hasBomb = true;
    Object.assign(bomb, { state: "carried", site: null, timer: MATCH.bomb, defuser: null, planter: null, x: 0, z: 0, y: 0 }); if (bombMesh) bombMesh.visible = false;
    // bots buy now; the human buys during the freeze
    for (const e of E.ents) { if (!e.isPlayer || E.autopilot) botBuy(e); }
    for (const e of E.ents) { e.cur = e.primary || "pistol"; }
    fx.reset(); grenades.forEach((g) => scene.remove(g.mesh)); grenades.length = 0; E.noises.length = 0;
    R.phase = "freeze"; R.t = 0; R.timeLeft = MATCH.live; R.endInfo = null; R.plan = "";
    if (vmTeam !== player.team) { vm.setTeam(player.team, TEAM_LOOK[player.team].accent); vmTeam = player.team; }
    brain.planRound(); syncVm(); pstate.scoped = 0; pstate.zoomStep = 0; pstate.punch = { yaw: 0, pitch: 0 }; pstate.flashAmt = 0; pstate.dmgDirs.length = 0; pstate.spectate = null;
    player.yaw = player.team === "terrorist" ? 0 : Math.PI; pstate.yawRaw = player.yaw; player.pitch = 0;
    if (swapped) say("SIDES SWAPPED", "You are now " + TEAM_LOOK[player.team].name, "#ffd070"); else say("ROUND " + R.no, "Buy phase — press B", "#ffffff");
    pstate.menuOpen = !E.autopilot; if (pstate.menuOpen && !E.testNoLock) { try { document.exitPointerLock(); } catch {} }
    if (music) { music.setMood && music.setMood(""); music.setIntensity(0.22); }
    if (swapped) sfx.swap();
  }
  function aliveCount(team) { return E.ents.filter((e) => e.alive && e.team === team).length; }
  function endRound(winTeam, reason) {
    if (R.phase !== "live") return; R.phase = "ended"; R.t = 0;
    const winSquad = E.ents.find((e) => e.team === winTeam).squad; const youWon = winSquad === "you"; score[winSquad]++;
    const loseSquad = winSquad === "you" ? "them" : "you"; lossStreak[winSquad] = 0; lossStreak[loseSquad]++;
    const plantedTeam = bomb.state === "planted" || bomb.state === "exploded" || bomb.state === "defused";
    for (const e of E.ents) { const winner = e.team === winTeam; let inc = winner ? (winTeam === "terrorist" && bomb.state === "exploded" ? ECON.plantedWin : ECON.win) : Math.min(ECON.lossMax, ECON.loss + Math.max(0, lossStreak[e.squad] - 1) * ECON.lossStep) + (e.team === "terrorist" && plantedTeam ? ECON.plantedLoss : 0); inc += e.income; addMoney(e, inc); }
    const teamName = TEAM_LOOK[winTeam].name; say(youWon ? "ROUND WON" : "ROUND LOST", reason, youWon ? "#7dffb0" : "#ff7a7a"); R.endInfo = { winTeam, youWon, reason };
    if (music) { music.stinger(youWon ? "win" : "lose"); music.setIntensity(0.2); }
  }
  function nextAfterEnd() {
    const played = score.you + score.them; const lead = Math.abs(score.you - score.them);
    const done = score.you >= MATCH.toWin || score.them >= MATCH.toWin || (played >= MATCH.rounds && score.you !== score.them);
    if (done) { finishMatch(); return; } beginRound();
  }
  function finishMatch() {
    over = true; R.phase = "over"; const won = score.you > score.them; const draw = score.you === score.them;
    const raw = score.you * 150 + stats.kills * 20 + stats.hs * 10 + stats.plants * 40 + stats.defuses * 60 + (won ? 300 : 0); const final = Math.round(raw * diff.scoreMult);
    R.result = { won, score: final, rounds: { ...score }, stats: { ...stats }, mvp: E.ents.slice().sort((a, b) => b.kills - a.kills)[0].name };
    try { document.exitPointerLock(); } catch {}
    if (music) music.stinger(won ? "win" : "lose"); sfx.stopAmbient();
    if (onMatchEnd) onMatchEnd(R.result);
  }

  // ---- bomb ---------------------------------------------------------------------------------------------------------------------------------------------
  let bombMesh = null, bombLight = null, bombLed = null, bombCan = null, bombTex = null;
  function ensureBombMesh() {
    if (bombMesh) return; bombMesh = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.34), new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: 0.6, metalness: 0.4 })); body.position.y = 0.1; body.castShadow = true; bombMesh.add(body);
    for (let i = 0; i < 3; i++) { const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10), new THREE.MeshStandardMaterial({ color: [0xb02a1a, 0xc9a227, 0x2a4a9a][i], roughness: 0.5 })); cy.rotation.z = Math.PI / 2; cy.position.set(0, 0.24, -0.09 + i * 0.09); bombMesh.add(cy); }
    bombCan = document.createElement("canvas"); bombCan.width = 128; bombCan.height = 48; bombTex = new THREE.CanvasTexture(bombCan); bombTex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: bombTex, toneMapped: false })); disp.rotation.x = -Math.PI / 2; disp.position.set(0, 0.202, 0.08); bombMesh.add(disp);
    bombLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })); bombLed.position.set(0.18, 0.22, 0.1); bombMesh.add(bombLed);
    bombLight = new THREE.PointLight(0xff2a20, 0, 14, 2); bombLight.position.y = 0.5; bombMesh.add(bombLight); scene.add(bombMesh); bombMesh.visible = false;
  }
  function setBombAt(x, z) { ensureBombMesh(); const y = map.groundAt(x, z, 3, 0.2); bomb.x = x; bomb.z = z; bomb.y = y; bombMesh.position.set(x, y, z); bombMesh.visible = true; }
  function dropBomb(e) { e.hasBomb = false; bomb.state = "dropped"; bomb.dropId++; setBombAt(e.x, e.z); }
  E.startUse = (e) => {
    if (e.use || !e.alive || R.phase !== "live") return false;
    if (e.team === "terrorist" && e.hasBomb && bomb.state === "carried") { const s = E.inSite(e, "A") ? "A" : E.inSite(e, "B") ? "B" : null; if (!s || !e.onGround) return false; e.use = { type: "plant", t: 0, site: s }; if (e.isPlayer) say("PLANTING...", "", "#ffd070"); E.noises.push({ x: e.x, z: e.z, r: 12, team: e.team, t: simTime, kind: "plant" }); sfx.pin(e.isPlayer ? null : { x: e.x, y: 1, z: e.z }); return true; }
    if (e.team === "police" && bomb.state === "planted" && Math.hypot(e.x - bomb.x, e.z - bomb.z) < 2.6 && e.onGround && !bomb.defuser) { e.use = { type: "defuse", t: 0 }; bomb.defuser = e.id; E.noises.push({ x: e.x, z: e.z, r: 14, team: e.team, t: simTime, kind: "defuse" }); return true; }
    return false;
  };
  E.cancelUse = (e) => { if (e.use && e.use.type === "defuse" && bomb.defuser === e.id) bomb.defuser = null; e.use = null; };
  E.holdUse = (e, dt) => {
    if (!e.use) { E.startUse(e); return; }
    e.use.t += dt;
    if (e.use.type === "plant") { if (!E.inSite(e, e.use.site) || !e.alive || !e.hasBomb) { e.use = null; return; } if (e.use.t >= MATCH.plant) { plantBomb(e, e.use.site); e.use = null; } }
    else { const need = e.kit ? MATCH.defuseKit : MATCH.defuse; if (bomb.state !== "planted") { e.use = null; bomb.defuser = null; return; } if (Math.hypot(e.x - bomb.x, e.z - bomb.z) > 2.9) { E.cancelUse(e); return; } if (e.use.t >= need) { defused(e); e.use = null; } }
  };
  function plantBomb(e, site) {
    e.hasBomb = false; bomb.state = "planted"; bomb.site = site; bomb.timer = MATCH.bomb; bomb.planter = e.id; bomb.beepT = 0; setBombAt(e.x + Math.sin(e.yaw) * -0.7, e.z + Math.cos(e.yaw) * -0.7);
    if (map.isBlocked(bomb.x, bomb.z)) setBombAt(e.x, e.z); sfx.plant({ x: bomb.x, y: 0.3, z: bomb.z }); addMoney(e, ECON.plant); if (e.isPlayer) stats.plants++;
    say("BOMB PLANTED", "Site " + site + " — " + MATCH.bomb + " seconds", "#ff8a6a"); radio(e, "planted", site); if (music) { music.stinger("plant"); music.setMood && music.setMood("bomb"); music.setIntensity(0.62); }
  }
  function defused(e) {
    bomb.state = "defused"; bomb.defuser = null; sfx.defuse({ x: bomb.x, y: 0.3, z: bomb.z }); addMoney(e, ECON.defuse); if (e.isPlayer) stats.defuses++; if (music) music.stinger("defuse");
    endRound("police", "Bomb defused"); if (bombLight) bombLight.intensity = 0;
  }
  function explodeBomb() {
    bomb.state = "exploded"; fx.blast(bomb.x, 1, bomb.z, 12, 0xff8a30); sfx.explode({ x: bomb.x, y: 1, z: bomb.z }); pstate.shake = Math.max(pstate.shake, clamp(1.4 - Math.hypot(player.x - bomb.x, player.z - bomb.z) / 60, 0.3, 1.4)); pstate.flashAmt = Math.max(pstate.flashAmt, 0.3);
    for (const e of E.ents) { if (!e.alive) continue; const d = Math.hypot(e.x - bomb.x, e.z - bomb.z); if (d < 36) { const dmg = 520 * Math.pow(1 - d / 36, 1.6); damage(e, dmg, null, "bomb", false, null); } }
    if (music) music.stinger("explode"); if (bombLight) bombLight.intensity = 0; if (bombMesh) bombMesh.visible = false; endRound("terrorist", "Bomb exploded");
  }
  function updateBomb(dt) {
    if (bomb.state === "dropped") {
      for (const e of E.ents) if (e.alive && e.team === "terrorist" && Math.hypot(e.x - bomb.x, e.z - bomb.z) < 1.2) { e.hasBomb = true; bomb.state = "carried"; if (bombMesh) bombMesh.visible = false; if (e.isPlayer) say("YOU PICKED UP THE BOMB", "", "#ffd070"); break; }
    }
    if (bomb.state === "planted") {
      bomb.timer -= dt; const frac = clamp(bomb.timer / MATCH.bomb, 0, 1); const interval = 0.12 + frac * frac * 0.95; bomb.beepT -= dt;
      if (bomb.beepT <= 0) { bomb.beepT = interval; sfx.beep({ x: bomb.x, y: 0.4, z: bomb.z }, bomb.timer < 10); bombLed.visible = true; bomb.ledOn = 0.08; if (bombCan) { const g = bombCan.getContext("2d"); g.fillStyle = "#050806"; g.fillRect(0, 0, 128, 48); g.fillStyle = "#ff3a2a"; g.font = "bold 34px ui-monospace, monospace"; g.textAlign = "center"; g.fillText(String(Math.max(0, Math.ceil(bomb.timer))).padStart(2, "0"), 64, 36); bombTex.needsUpdate = true; } }
      bomb.ledOn = (bomb.ledOn || 0) - dt; bombLed.visible = bomb.ledOn > 0; bombLight.intensity = bomb.ledOn > 0 ? 160 : 8;
      if (bomb.timer <= 0 && R.phase === "live") explodeBomb();
    }
  }

  // ---- grenades -------------------------------------------------------------------------------------------------------------------------------------------------
  const grenades = [];
  E.throwNade = (e, type, yaw, pitch, speed) => {
    if (!(e.nades[type] > 0) || !e.alive) return false; e.nades[type]--; const cp = Math.cos(pitch);
    const dir = new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp); const col = type === "flash" ? 0xcfcfc0 : type === "smoke" ? 0x6a8a78 : 0x5a6a38;
    const mesh = new THREE.Mesh(type === "he" ? new THREE.SphereGeometry(0.06, 10, 8) : new THREE.CylinderGeometry(0.045, 0.045, 0.13, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.5 })); mesh.castShadow = true; scene.add(mesh);
    grenades.push({ type, owner: e, x: e.x + dir.x * 0.5, y: eyeY(e) - 0.15, z: e.z + dir.z * 0.5, vx: dir.x * speed + e.vx * 0.5, vy: dir.y * speed + 0.8, vz: dir.z * speed + e.vz * 0.5, fuse: GRENADES[type].fuse + (type === "smoke" ? 0.2 : 0.3), mesh, bounces: 0, rest: false });
    sfx.pin(e.isPlayer ? null : { x: e.x, y: 1.4, z: e.z }); if (e.isPlayer) { vm.throwNade(); autoSwitchAfterThrow(e, type); } return true;
  };
  function autoSwitchAfterThrow(e, type) { setTimeout(() => { if (e.nades[type] <= 0 && e.cur === type) { e.cur = e.primary || "pistol"; syncVm(); } }, 480); }
  function updateGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i]; g.fuse -= dt;
      if (!g.rest) {
        g.vy -= 16 * dt; const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt; const dx = nx - g.x, dy = ny - g.y, dz = nz - g.z, L = Math.hypot(dx, dy, dz) || 1e-6;
        const h = map.raycast(g.x, g.y, g.z, dx / L, dy / L, dz / L, L + 0.08);
        if (h && h.kind !== "sky" && h.t <= L + 0.06) {
          const n = { x: h.nx, y: h.ny, z: h.nz }; const vn = g.vx * n.x + g.vy * n.y + g.vz * n.z; g.vx -= 1.5 * vn * n.x; g.vy -= 1.5 * vn * n.y; g.vz -= 1.5 * vn * n.z; g.vx *= 0.62; g.vz *= 0.62; g.vy *= 0.7; g.x += dx / L * Math.max(0, h.t - 0.05); g.y += dy / L * Math.max(0, h.t - 0.05); g.z += dz / L * Math.max(0, h.t - 0.05);
          g.bounces++; if (g.bounces < 6) sfx.grenadeBounce({ x: g.x, y: g.y, z: g.z }); if (n.y > 0.5 && Math.abs(g.vy) < 1.2) { g.vy = 0; g.rest = true; g.vx *= 0.3; g.vz *= 0.3; }
        } else { g.x = nx; g.y = ny; g.z = nz; }
        if (g.y < 0.07) { g.y = 0.07; g.vy = Math.abs(g.vy) * 0.38; g.vx *= 0.7; g.vz *= 0.7; g.bounces++; if (g.bounces < 6) sfx.grenadeBounce({ x: g.x, y: g.y, z: g.z }); if (Math.abs(g.vy) < 0.8) { g.vy = 0; g.rest = true; } }
        const p = { x: g.x, z: g.z }; map.collide(p, 0.07, g.y, 0.12); if (Math.hypot(p.x - g.x, p.z - g.z) > 1e-4) { g.vx *= -0.4; g.vz *= -0.4; g.x = p.x; g.z = p.z; }
      } else { g.vx *= 0.9; g.vz *= 0.9; }
      g.mesh.position.set(g.x, g.y, g.z); g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      if (g.fuse <= 0) { detonate(g); scene.remove(g.mesh); grenades.splice(i, 1); }
    }
  }
  function detonate(g) {
    const pos = { x: g.x, y: g.y, z: g.z };
    if (g.type === "smoke") { fx.smoke(g.x, g.y, g.z, 4.6, 19); sfx.smokePop(pos); E.noises.push({ x: g.x, z: g.z, r: 14, team: g.owner.team, t: simTime, kind: "nade" }); }
    else if (g.type === "flash") {
      fx.blast(g.x, g.y + 0.4, g.z, 1.4, 0xffffff); sfx.flashBang(pos, false);
      for (const e of E.ents) {
        if (!e.alive) continue; const ex = e.x, ey = eyeY(e), ez = e.z; const dx = g.x - ex, dy = g.y - ey, dz = g.z - ez, d = Math.hypot(dx, dy, dz); if (d > 48 || !map.hasLineOfSight(g.x, g.y, g.z, ex, ey, ez)) continue;
        const fwd = { x: -Math.sin(e.yaw) * Math.cos(e.pitch), y: Math.sin(e.pitch), z: -Math.cos(e.yaw) * Math.cos(e.pitch) }; const dot = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / (d || 1); const f = clamp((dot + 0.3) / 1.3, 0.12, 1); const amt = (1 - d / 48) * f;
        if (amt > 0.05) { if (e.isPlayer) { pstate.flashAmt = Math.max(pstate.flashAmt, amt); e.flashedUntil = simTime + 0.6 + 4.2 * amt; sfx.flashBang(null, true); } else e.flashedUntil = simTime + 0.5 + 4.2 * amt; }
      }
    } else {
      fx.blast(g.x, g.y + 0.3, g.z, 4.6, 0xff9a40); sfx.explode(pos); pstate.shake = Math.max(pstate.shake, clamp(0.9 - Math.hypot(player.x - g.x, player.z - g.z) / 25, 0, 0.9));
      for (const e of E.ents) { if (!e.alive) continue; const d = Math.hypot(e.x - g.x, e.z - g.z, (e.y + 1) - g.y); if (d > 10 || !map.hasLineOfSight(g.x, g.y + 0.2, g.z, e.x, e.y + 1.0, e.z)) continue; if (e.team === g.owner.team && e !== g.owner) continue; damage(e, 105 * Math.pow(1 - d / 10, 1.2), g.owner, "he", false, null); }
    }
  }

  // ---- shooting and damage ---------------------------------------------------------------------------------------------------------------------------------------
  function inaccuracy(e) {
    const def = WEAPONS[e.cur]; if (!def || !def.spread) return 0; const speed = Math.hypot(e.vx, e.vz); const mv = clamp(speed / RUN, 0, 1);
    let s = def.spread[0] + (def.spread[1] - def.spread[0]) * Math.pow(mv, 0.8); if (!e.onGround) s = def.spread[2]; if (e.crouch > 0.5) s *= def.crouchMul;
    if (def.kind === "sniper") { if (!(e.isPlayer && pstate.scoped > 0.5)) s = def.unscopedSpread; else if (mv > 0.1) s = def.spread[1]; } else s += Math.min(e.spray, 14) * 0.0016;
    return s;
  }
  function rayEnt(e, ox, oy, oz, dx, dy, dz, maxT) {
    // head sphere + body cylinder
    const h = 1.8 - e.crouch * 0.45; const hy = e.y + h - 0.17, hr = 0.2;
    let best = null;
    { const px = ox - e.x, py = oy - hy, pz = oz - e.z; const b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - hr * hr, disc = b * b - c; if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, head: true }; } }
    { const px = ox - e.x, pz = oz - e.z; const a = dx * dx + dz * dz; if (a > 1e-8) { const b = px * dx + pz * dz, c = px * px + pz * pz - 0.34 * 0.34, disc = b * b - a * c; if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / a; if (t > 0 && t < maxT) { const y = oy + dy * t; if (y >= e.y && y <= e.y + h - 0.3 && (!best || t < best.t)) best = { t, head: false }; } } } }
    return best;
  }
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3(), _e = new THREE.Vector3();
  // One bullet (or shotgun pellet): flies until it hits a soldier, or passes through thin props such as crates, barrels and market stalls
  // (losing power each time) before stopping in a wall. Returns where it ended.
  const _end = new THREE.Vector3(), _pt = new THREE.Vector3();
  function traceShot(e, def, ox, oy, oz, dx, dy, dz) {
    let sx = ox, sy = oy, sz = oz, power = 1, travelled = 0; const hitSet = [];
    for (let pass = 0; pass < 3; pass++) {
      const room = 160 - travelled; const wall = map.raycast(sx, sy, sz, dx, dy, dz, room); const wallT = wall ? wall.t : room;
      let hit = null; for (const t of E.ents) { if (!t.alive || t.team === e.team || hitSet.includes(t)) continue; const r = rayEnt(t, sx, sy, sz, dx, dy, dz, wallT); if (r && (!hit || r.t < hit.r.t)) hit = { t, r }; }
      if (hit) {
        hitSet.push(hit.t); const dist = travelled + hit.r.t; _pt.set(sx + dx * hit.r.t, sy + dy * hit.r.t, sz + dz * hit.r.t);
        const dm = computeDamage(def, dist, hit.r.head, hit.t.armor); fx.bloodHit(_pt, new THREE.Vector3(dx, dy, dz), hit.r.head);
        damage(hit.t, dm.dmg * power * (e.isPlayer ? 1 : diff.dmgMul), e, def.id, hit.r.head, _pt, dm.armorLoss);
        return _end.copy(_pt);
      }
      const ex = sx + dx * wallT, ey = sy + dy * wallT, ez = sz + dz * wallT;
      const pk = wall && wall.kind === "prop" && wall.box ? PENETRATION[wall.box.kind] : undefined;
      if (pk !== undefined && (def.pen ?? 0.6) > 0 && pass < 2) {
        const keep = pk * (def.pen ?? 0.6) * 1.15; if (power * keep < 0.22) { fx.impact(_pt.set(ex, ey, ez), { x: wall.nx, y: wall.ny, z: wall.nz }, "prop"); return _end.copy(_pt); }
        fx.impact(_pt.set(ex, ey, ez), { x: wall.nx, y: wall.ny, z: wall.nz }, "prop"); const bx = wall.box; let t2 = wallT;
        for (; t2 < wallT + 3; t2 += 0.06) { const px = sx + dx * t2, py = sy + dy * t2, pz = sz + dz * t2; if (px < bx.x0 - 1e-3 || px > bx.x1 + 1e-3 || pz < bx.z0 - 1e-3 || pz > bx.z1 + 1e-3 || py < bx.y0 || py > bx.y1) break; }
        power *= keep; sx += dx * (t2 + 0.03); sy += dy * (t2 + 0.03); sz += dz * (t2 + 0.03); travelled += t2 + 0.03; continue;
      }
      if (wall && wall.kind !== "sky") fx.impact(_pt.set(ex, ey, ez), { x: wall.nx, y: wall.ny, z: wall.nz }, wall.kind);
      return _end.set(ex, ey, ez);
    }
    return _end.set(sx, sy, sz);
  }
  E.shoot = (e, dirIn) => {
    const def = WEAPONS[e.cur]; if (!def || !def.mag || !e.alive || R.phase !== "live") return false;
    const am = e.ammo[e.cur]; if (!am || simTime < e.nextShot || simTime < e.reloadEnd || simTime < e.drawEnd) return false; if (am.mag <= 0) { if (e.isPlayer && simTime > (e.emptyT || 0)) { sfx.empty(); e.emptyT = simTime + 0.3; if (am.reserve > 0) E.reload(e); } return false; }
    e.nextShot = simTime + def.rate; am.mag--; if (simTime - e.lastShotT > def.rate * 1.9 + 0.12) e.spray = 0; e.lastShotT = simTime; const sprayN = e.spray; e.spray++;
    if (dirIn) _d.set(dirIn.x, dirIn.y, dirIn.z); else { const cpv = Math.cos(e.pitch + (e.isPlayer ? pstate.punch.pitch : 0)), yy = e.yaw + (e.isPlayer ? pstate.punch.yaw : 0); _d.set(-Math.sin(yy) * cpv, Math.sin(e.pitch + (e.isPlayer ? pstate.punch.pitch : 0)), -Math.cos(yy) * cpv); }
    _d.normalize(); const baseSp = inaccuracy(e) * (e.isPlayer ? 1 : diff.spreadMul); const pellets = def.pellets || 1;
    const ox = e.x, oy = eyeY(e), oz = e.z; const base = _d.clone();
    let mz; if (e.isPlayer) { mz = vm.muzzleWorld(new THREE.Vector3()); } else { const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw); mz = new THREE.Vector3(ox - Math.sin(e.yaw) * 0.7 + rx * 0.18, oy - 0.25, oz - Math.cos(e.yaw) * 0.7 + rz * 0.18); }
    for (let pi = 0; pi < pellets; pi++) {
      const sp = baseSp + (def.cone || 0); _d.copy(base);
      if (sp > 0) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * sp; const up = Math.abs(_d.y) > 0.95 ? _m.set(1, 0, 0) : _m.set(0, 1, 0); const rt = _e.copy(_d).cross(up).normalize(); const u = _o.copy(rt).cross(_d).normalize(); _d.addScaledVector(rt, Math.cos(a) * r).addScaledVector(u, Math.sin(a) * r).normalize(); }
      const end = traceShot(e, def, ox, oy, oz, _d.x, _d.y, _d.z);
      if (pi < 3) fx.tracer(mz, end, def.tracer, def.kind === "sniper" ? 0.05 : 0.03);
      // a round whizzing past the player's head
      if (!e.isPlayer && player.alive && e.team !== player.team) { const px = player.x - ox, py = eyeY(player) - oy, pz = player.z - oz; const tc = clamp(px * _d.x + py * _d.y + pz * _d.z, 0, Math.hypot(end.x - ox, end.y - oy, end.z - oz)); const cx = ox + _d.x * tc - player.x, cy = oy + _d.y * tc - eyeY(player), cz = oz + _d.z * tc - player.z; const dd = Math.hypot(cx, cy, cz); if (dd < 2.4 && tc > 2.5) { sfx.whiz(dd, cx, cz, player.yaw); pstate.shake = Math.max(pstate.shake, 0.12); pstate.suppress = 1; } }
    }
    fx.muzzle(e.isPlayer ? new THREE.Vector3(ox - Math.sin(e.yaw) * 0.6, oy - 0.1, oz - Math.cos(e.yaw) * 0.6) : mz, def.kind === "sniper" || def.kind === "shotgun" ? 1.4 : 1, def.kind === "pistol" ? 0xffd890 : 0xffc070);
    if (muzzleLight) { muzzleLight.position.copy(e.isPlayer ? camera.position : mz); if (e.isPlayer) { muzzleLight.position.x -= Math.sin(e.yaw) * 0.7; muzzleLight.position.z -= Math.cos(e.yaw) * 0.7; } muzzleLight.intensity = (def.kind === "sniper" || def.kind === "shotgun" ? 90 : 55) * (day ? 0.5 : 1); muzzleLight.userData.life = 0.07; }
    sfx.shot(def.kind, e.isPlayer ? null : { x: e.x, y: oy, z: e.z }, false, def.id); e.fireAnim = 0.09; E.noises.push({ x: e.x, z: e.z, r: def.noise, team: e.team, t: simTime, kind: "shot" });
    if (e.isPlayer) { const [ky, kp] = recoilStep(def, sprayN); const ads = pstate.scoped > 0.5 ? 0.6 : 1; pstate.punch.yaw += ((ky * Math.PI) / 180) * ads; pstate.punch.pitch += ((kp * Math.PI) / 180) * ads; pstate.punch.t = simTime; vm.kick(def.kind === "sniper" || def.kind === "shotgun" ? 1 : 0.6); const ej = vm.ejectWorld(new THREE.Vector3()); if (def.kind !== "sniper") fx.shell(ej, Math.cos(e.yaw) * 2 + Math.random(), 2 + Math.random(), -Math.sin(e.yaw) * 2 + Math.random() - 0.5); if (def.kind === "sniper") { pstate.scoped = 0; pstate.zoomStep = 0; } pstate.fireFlicker = 1; }
    return true;
  };
  E.reload = (e) => {
    const def = WEAPONS[e.cur]; if (!def || !def.mag) return; const am = e.ammo[e.cur]; if (!am || am.mag >= def.mag || am.reserve <= 0 || simTime < e.reloadEnd) return;
    e.reloadEnd = simTime + def.reload; e.reloading = e.cur; sfx.reload(e.isPlayer ? null : { x: e.x, y: 1.2, z: e.z }); if (e.isPlayer) { vm.reload(def.reload); pstate.scoped = 0; pstate.zoomStep = 0; }
  };
  function finishReloads() {
    for (const e of E.ents) { if (e.reloading && simTime >= e.reloadEnd) { const id = e.reloading; e.reloading = null; if (e.cur === id) { const def = WEAPONS[id], am = e.ammo[id]; const need = def.mag - am.mag, take = Math.min(need, am.reserve); am.mag += take; am.reserve -= take; } } }
  }
  function damage(t, dmg, attacker, weaponId, head, hitPos, armorLoss = null) {
    if (!t.alive) return; dmg = Math.round(dmg); if (dmg <= 0) return;
    if (armorLoss === null) { if (t.armor > 0) { const absorbed = dmg * 0.4; const loss = Math.min(t.armor, absorbed * 0.5); t.armor -= loss; dmg = Math.round(dmg - absorbed * (loss / Math.max(0.01, absorbed * 0.5))); } } else t.armor = Math.max(0, t.armor - armorLoss);
    t.hp -= dmg; t.lastDamageT = simTime; t.lastAttacker = attacker; if (weaponId !== "bomb") t.slowUntil = simTime + 0.2 + Math.min(0.25, dmg / 260); // being hit slows you briefly
    if (attacker && attacker.isPlayer) { pstate.hitMark = 1; pstate.hitHead = head; sfx.hit(head); stats.damage += dmg; if (music) combatGlow = 1; }
    if (t.isPlayer) { pstate.hurt = Math.min(1, pstate.hurt + dmg / 60); sfx.hurt(); pstate.punch.pitch += 0.012 + dmg / 3000; pstate.punch.yaw += (Math.random() - 0.5) * (0.01 + dmg / 2000); pstate.punch.t = simTime; pstate.shake = Math.max(pstate.shake, 0.25 + dmg / 120); if (attacker) pstate.dmgDirs.push({ x: attacker.x, z: attacker.z, t: simTime }); combatGlow = 1; }
    else if (attacker) { const ai = t.ai; if (!ai.targetId && !ai.visible) { ai.search = { x: attacker.x, z: attacker.z, until: simTime + 6 }; ai.alertUntil = simTime + 3; ai.noise = { x: attacker.x, z: attacker.z, t: simTime, kind: "shot" }; } }
    if (t.hp <= 0) kill(t, attacker, weaponId, head);
  }
  function kill(t, attacker, weaponId, head) {
    t.alive = false; t.hp = 0; t.deaths++; t.dead = 0; t.use = null; if (bomb.defuser === t.id) bomb.defuser = null; sfx.death(t.isPlayer ? null : { x: t.x, y: 1, z: t.z });
    if (t.hasBomb) dropBomb(t);
    if (attacker && attacker !== t) { attacker.kills++; if (head) attacker.hs++; const w = WEAPONS[weaponId]; addMoney(attacker, w ? w.kill : weaponId === "he" ? 300 : 300); attacker.roundKills = (attacker.roundKills || 0) + 1; if (attacker.isPlayer) { stats.kills++; if (head) stats.hs++; } }
    if (t.isPlayer) { stats.deaths++; pstate.scoped = 0; pstate.zoomStep = 0; pstate.menuOpen = false; }
    feed.push({ t: simTime, k: attacker ? attacker.name : "World", v: t.name, w: weaponId === "bomb" ? "bomb" : weaponId === "he" ? "frag" : (WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId), head, kt: attacker ? attacker.team : null, vt: t.team, you: (attacker && attacker.isPlayer) || t.isPlayer }); if (feed.length > 6) feed.shift();
    if (t.ai) { t.ai.targetId = null; }
    if (R.phase === "live") { const cT = aliveCount("terrorist"), cP = aliveCount("police"); if (cP === 0) endRound("terrorist", "All Sentinels eliminated"); else if (cT === 0 && bomb.state !== "planted") endRound("police", "All Nightfall eliminated"); }
  }
  function radio(e, key, arg) {
    if (R.phase !== "live" || simTime - radioLast[e.team] < 2.2) return; const playerTeam = player.team; if (e.team !== playerTeam || e === player) return; radioLast[e.team] = simTime;
    let text = ""; if (key === "spotted" && arg) text = "Enemy spotted — " + (zoneName(arg.x, arg.z) || "ahead"); else if (key === "planted") text = "Bomb is down at " + arg; else if (key === "rotate") text = "Rotating to " + arg; if (!text) return; radioMsg = { name: e.name, text, t: simTime }; sfx.radio();
  }
  E.radio = radio;

  // ---- weapons: switching ----------------------------------------------------------------------------------------------------------------------------------------------------
  function syncVm() { vm.setTeam && 0; const id = player.cur; vm.setWeapon(id === "knife" ? "knife" : modelOf(id, player.team)); }
  function switchTo(e, id) {
    if (!e.alive || e.cur === id) return false;
    if (id === "pistol") { if (!e.ammo.pistol) return false; } else if (id === "knife") { } else if (GRENADES[id]) { if (!(e.nades[id] > 0)) return false; } else if (WEAPONS[id] && WEAPONS[id].slot === 1) { if (e.primary !== id) return false; } else return false;
    e.prev = e.cur; e.cur = id; e.drawEnd = simTime + 0.4; e.reloadEnd = Math.min(e.reloadEnd, simTime); e.reloading = null; if (e.isPlayer) { vm.cancelReload(); pstate.scoped = 0; pstate.zoomStep = 0; syncVm(); sfx.swap(); } return true;
  }
  const slotWeapon = (e, n) => (n === 1 ? e.primary : n === 2 ? "pistol" : n === 3 ? "knife" : n === 4 ? "flash" : n === 5 ? "smoke" : n === 6 ? "he" : null);

  // ---- player ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  let combatGlow = 0;
  function updatePlayer(dt) {
    const p = player; if (!p.alive) return; const canAct = R.phase === "live";
    if (!E.autopilot) {
      // look
      const fov = camera.fov; const sens = 0.0021 * input.sens * (fov / 78); p.yaw -= input.dx * sens; p.pitch = clamp(p.pitch - input.dy * sens, -1.5, 1.5); input.dx = 0; input.dy = 0;
      const keys = input.keys; const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); const walking = !!(keys.ShiftLeft || keys.ShiftRight); const wantCrouch = !!(keys.KeyC || keys.ControlLeft);
      p.crouch += ((wantCrouch ? 1 : 0) - p.crouch) * Math.min(1, dt * 10);
      const def = WEAPONS[p.cur] || {}; let spd = RUN * (def.speed || 1) * (walking ? 0.46 : 1) * (1 - p.crouch * 0.58) * (pstate.scoped > 0.5 ? 0.6 : 1); if (simTime < (p.slowUntil || 0)) spd *= 0.62; if (!canAct) spd = 0;
      const sinY = Math.sin(p.yaw), cosY = Math.cos(p.yaw); let wx = -sinY * f + cosY * r, wz = -cosY * f - sinY * r; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
      const accel = p.onGround ? 46 : 5; const tvx = wx * spd, tvz = wz * spd; const dvx = tvx - p.vx, dvz = tvz - p.vz; const dl = Math.hypot(dvx, dvz); const step = (wl > 0.01 ? accel : 64) * dt;
      if (dl <= step || dl < 1e-6) { if (p.onGround || wl > 0.01) { p.vx = tvx; p.vz = tvz; } } else if (p.onGround || wl > 0.01) { p.vx += (dvx / dl) * step; p.vz += (dvz / dl) * step; }
      if (keys.Space && p.onGround && canAct) { p.vy = JUMP; p.onGround = false; keys.Space = false; sfx.step({ x: p.x, y: 0.5, z: p.z }, 0.6, map.floorAt(p.x, p.z)); }
      p.walkingFlag = walking;
    } else { /* brain drives movement */ }
    // gravity and landing
    const wasGround = p.onGround; p.vy -= GRAV * dt; if (!E.autopilot) { p.x += p.vx * dt; p.z += p.vz * dt; const h = 1.8 - p.crouch * 0.45; const pp = { x: p.x, z: p.z }; map.collide(pp, 0.36, p.y, h); p.x = pp.x; p.z = pp.z; }
    p.y += p.vy * dt; const g = map.groundAt(p.x, p.z, p.y, 0.3);
    if (p.y <= g + 1e-4 && p.vy <= 0) { if (!wasGround && p.vy < -4) { pstate.landDip = Math.min(0.14, -p.vy * 0.012); sfx.land({ x: p.x, y: 0.2, z: p.z }); E.noises.push({ x: p.x, z: p.z, r: 20, team: p.team, t: simTime, kind: "step" }); } p.y = g; p.vy = 0; p.onGround = true; } else p.onGround = p.y <= g + 0.02 && p.vy <= 0;
    // footsteps (audible to everyone unless walking/crouching)
    const speed = Math.hypot(p.vx, p.vz); if (p.onGround && speed > 3.4 && !(p.walkingFlag) && p.crouch < 0.5) { pstate.stepT -= dt * (speed / 5.6); if (pstate.stepT <= 0) { pstate.stepT = 0.36; sfx.step({ x: p.x, y: 0.1, z: p.z }, 0.7, map.floorAt(p.x, p.z)); E.noises.push({ x: p.x, z: p.z, r: 17, team: p.team, t: simTime, kind: "step" }); } } else if (speed < 3.4) pstate.stepT = Math.min(pstate.stepT, 0.1);
    if (p.onGround && speed > 1) pstate.bob += dt * speed * 1.8;
    // pickup bomb etc handled in updateBomb. Actions:
    if (E.autopilot) return;
    if (!canAct) return;
    // use (plant / defuse)
    if (input.keys.KeyE) { if (!p.use) E.startUse(p); if (p.use) { if (speed > 1.2) E.cancelUse(p); else E.holdUse(p, dt); } } else if (p.use) E.cancelUse(p);
    // switching
    for (let n = 1; n <= 6; n++) { if (input.keys["Digit" + n]) { input.keys["Digit" + n] = false; const id = slotWeapon(p, n); if (id) { if (GRENADES[id] && p.cur === id) continue; switchTo(p, id); } } }
    if (input.keys.KeyQ) { input.keys.KeyQ = false; switchTo(p, p.prev); }
    if (input.wheel) { const order = [p.primary, "pistol", "knife"].filter(Boolean); let i = order.indexOf(p.cur); if (i < 0) i = 0; i = (i + (input.wheel > 0 ? 1 : -1) + order.length) % order.length; input.wheel = 0; switchTo(p, order[i]); }
    if (input.keys.KeyR) { input.keys.KeyR = false; E.reload(p); }
    // firing
    const cur = WEAPONS[p.cur]; const lP = input.lPress, rP = input.rPress; input.lPress = false; input.rPress = false;
    if (GRENADES[p.cur]) { if (lP || rP) { const power = rP ? 8.5 : 17; const ok = E.throwNade(p, p.cur, p.yaw, p.pitch + 0.12, power); } }
    else if (cur && cur.kind === "knife") {
      if ((lP || rP) && simTime >= p.nextShot) { const stab = rP; p.nextShot = simTime + (stab ? 1.0 : 0.5); vm.slash(stab); sfx.knife(null); const fwd = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }; for (const t of E.ents) { if (!t.alive || t.team === p.team) continue; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d < 2.3 && (dx * fwd.x + dz * fwd.z) / (d || 1) > 0.5) { const back = (-Math.sin(t.yaw)) * fwd.x + (-Math.cos(t.yaw)) * fwd.z > 0.4; damage(t, stab ? (back ? 180 : 65) : back ? 90 : 40, p, "knife", false, null, 0); break; } } }
    } else if (cur) {
      if (cur.kind === "sniper" && rP && simTime >= p.drawEnd && simTime >= p.reloadEnd) { pstate.zoomStep = (pstate.zoomStep + 1) % 3; sfx.ui(); }
      else if (cur.kind !== "sniper") { /* pistols / rifles: right click does nothing */ }
      const want = cur.auto ? input.lDown : lP; if (want) E.shoot(p, null);
    }
    // keep reload from being cancelled by weapon swap bugs
  }
  function updateViewState(dt) {
    const p = player; const target = p.alive && WEAPONS[p.cur] && WEAPONS[p.cur].zoom && pstate.zoomStep > 0 ? WEAPONS[p.cur].zoom[pstate.zoomStep - 1] : 78; camera.fov += (target - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); pstate.scoped = p.alive && pstate.zoomStep > 0 && Math.abs(camera.fov - target) < 20 ? 1 : 0;
    // punch recovery (starts a beat after the last shot)
    const idle = simTime - (pstate.punch.t || 0); const rec = idle > 0.1 ? Math.min(1, dt * (4 + Math.min(idle, 0.6) * 8)) : 0; pstate.punch.yaw -= pstate.punch.yaw * rec; pstate.punch.pitch -= pstate.punch.pitch * rec;
    if (player.alive && player.hp < 35 && R.phase !== "over") { pstate.heartT = (pstate.heartT || 0) - dt; if (pstate.heartT <= 0) { sfx.heart(1 - player.hp / 50); pstate.heartT = 0.55 + player.hp / 80; } }
    pstate.hitMark = Math.max(0, pstate.hitMark - dt * 5); pstate.hurt = Math.max(0, pstate.hurt - dt * 1.2); pstate.shake = Math.max(0, pstate.shake - dt * 2.2); pstate.landDip = Math.max(0, pstate.landDip - dt * 0.6); pstate.flashAmt = Math.max(0, pstate.flashAmt - dt * (pstate.flashAmt > 0.5 ? 0.18 : 0.35)); combatGlow = Math.max(0, combatGlow - dt * 0.3);
    for (let i = pstate.dmgDirs.length - 1; i >= 0; i--) if (simTime - pstate.dmgDirs[i].t > 1.4) pstate.dmgDirs.splice(i, 1);
  }

  // soldiers you can't see still make noise: footsteps carry (louder on tile and metal, softer on dirt) and enemy bots can hear yours
  function botFootsteps(e, dt) {
    const sp = Math.hypot(e.vx, e.vz); if (sp > 3.6 && e.crouch < 0.5) { e.stepT = (e.stepT === undefined ? 0.2 : e.stepT) - dt * (sp / 5.6); if (e.stepT <= 0) { e.stepT = 0.36; const surf = map.floorAt(e.x, e.z); sfx.step({ x: e.x, y: 0.1, z: e.z }, 0.75, surf); E.noises.push({ x: e.x, z: e.z, r: 15, team: e.team, t: simTime, kind: "step" }); } } else e.stepT = Math.min(e.stepT === undefined ? 0.2 : e.stepT, 0.12);
  }
  // ---- simulation step ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function stepSim(dt) {
    if (R.phase === "menu" || over) return; simTime += dt; R.t += dt;
    E.noises = E.noises.filter((n) => simTime - n.t < 0.6);
    for (const e of E.ents) { if (e.fireAnim > 0) e.fireAnim -= dt; if (!e.alive && e.dead < 1) e.dead = Math.min(1, e.dead + dt * 2.2); }
    if (R.phase === "freeze") { if (R.t >= MATCH.freeze) { R.phase = "live"; R.t = 0; sfx.roundStart(); pstate.menuOpen = false; say("GO", "", "#ffffff"); for (const e of E.ents) e.ai.startAt = simTime + 0.2 + Math.random() * (e.team === "terrorist" ? 1.6 : 0.6); if (!E.testNoLock && !pstate.locked && !E.autopilot) { /* click to resume handled by overlay */ } } }
    else if (R.phase === "live") { R.timeLeft = Math.max(0, MATCH.live - R.t); if (R.timeLeft <= 0 && bomb.state !== "planted") endRound("police", "Time ran out"); }
    else if (R.phase === "ended") { if (R.t >= MATCH.endHold) nextAfterEnd(); }
    finishReloads();
    if (R.phase === "live" || R.phase === "freeze") { updatePlayer(dt); if (E.autopilot) { const ap = player; ap.ai = ap.ai || {}; brain.update(ap, dt); ap.fireAnim = Math.max(0, ap.fireAnim); if (!player.alive) { } else { const g = map.groundAt(ap.x, ap.z, ap.y, 0.3); ap.y = g; ap.onGround = true; } } for (const e of E.ents) if (!e.isPlayer && e.alive) { brain.update(e, dt); const g = map.groundAt(e.x, e.z, e.y, 0.3); e.y = g; e.onGround = true; botFootsteps(e, dt); } }
    else updatePlayer(dt);
    updateBomb(dt); updateGrenades(dt); updateViewState(dt);
    // pick up the bomb as autopilot / bots walk over it is handled in updateBomb
    if (music && R.phase === "live" && Math.floor(simTime * 4) !== Math.floor((simTime - dt) * 4)) { music.setIntensity(clamp(0.24 + (bomb.state === "planted" ? 0.34 : 0) + combatGlow * 0.38, 0, 1)); }
  }

  // ---- drawing -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const camPos = new THREE.Vector3();
  function updateVisuals(dt, t) {
    const p = player; let ex = p.x, ey = eyeY(p), ez = p.z, yaw = p.yaw, pitch = p.pitch; let spectating = null;
    if (!p.alive && R.phase !== "menu") { spectating = E.ents.find((e) => e.alive && e.team === p.team && !e.isPlayer) || null; if (spectating) { ex = spectating.x; ey = eyeY(spectating); ez = spectating.z; yaw = spectating.yaw; pitch = spectating.pitch; } else { ey = p.y + 0.4; pitch = -0.4; } }
    const bobY = p.alive ? Math.sin(pstate.bob * 2) * 0.012 * clamp(Math.hypot(p.vx, p.vz) / RUN, 0, 1) : 0; const dip = pstate.landDip;
    const sh = pstate.shake; camera.position.set(ex + (Math.random() - 0.5) * sh * 0.05, ey + bobY - dip + (Math.random() - 0.5) * sh * 0.05, ez + (Math.random() - 0.5) * sh * 0.05);
    const pu = p.alive ? pstate.punch : { yaw: 0, pitch: 0 }; camera.rotation.set(clamp(pitch + pu.pitch, -1.55, 1.55), yaw + pu.yaw, (p.alive ? (Math.sin(pstate.bob) * 0.003 + (input.keys.KeyD ? -0.008 : 0) + (input.keys.KeyA ? 0.008 : 0)) : 0) + (Math.random() - 0.5) * sh * 0.01, "YXZ");
    camPos.copy(camera.position);
    world.update(dt, t, camPos, () => sfx.thunder());
    // viewmodel
    vm.camera.position.copy(camera.position); vm.camera.quaternion.copy(camera.quaternion); vm.camera.updateMatrixWorld();
    if (p.alive) {
      const def = WEAPONS[p.cur]; const speed = Math.hypot(p.vx, p.vz); vm.update(dt, { speed01: clamp(speed / RUN, 0, 1), onGround: p.onGround, crouch: p.crouch > 0.5, lookDX: lastLookDX, lookDY: lastLookDY, scoped: pstate.scoped > 0.5, hidden: R.phase === "over" }); lastLookDX *= 0.8; lastLookDY *= 0.8;
      // nearest lamp tints the weapon
      let bl = null, bd = 160; for (const l of world.lamps) { const d = (l.x - p.x) ** 2 + (l.z - p.z) ** 2; if (d < bd) { bd = d; bl = l; } } if (bl) vm.setLamp(bl.color, 2.2 * Math.max(0, 1 - Math.sqrt(bd) / 12)); else vm.setLamp(0xffc880, 0);
    } else { vm.update(dt, { speed01: 0, onGround: true, crouch: false, lookDX: 0, lookDY: 0, scoped: false, hidden: true }); }
    // soldiers
    for (const e of E.ents) {
      if (e.isPlayer || !e.model) continue; const m = e.model; m.root.visible = true; m.root.position.set(e.x, e.y, e.z); m.root.rotation.order = "YXZ"; m.root.rotation.y = e.yaw;
      poseSoldier(m, { speed: e.alive ? clamp(Math.hypot(e.vx, e.vz) / RUN, 0, 1.1) : 0, crouch: e.crouch, pitch: e.pitch, fire: e.fireAnim > 0 ? 1 : 0, dead: e.alive ? 0 : e.dead, dt, baseY: e.y, aim: e.fireAnim > 0 || e.aiming ? 1 : 0, weapon: MODEL_IDS.includes(modelOf(e.cur, e.team)) ? modelOf(e.cur, e.team) : undefined });
      e.label.visible = e.alive && e.team === player.team; e.label.position.set(e.x, e.y + 2.3 - e.crouch * 0.4, e.z);
    }
    // grenade in-hand etc. nothing. Ambient sound follows listener.
    sfx.listener(camera.position.x, camera.position.y, camera.position.z, yaw); sfx.setAmbientMuffle(map.isRoofed(ex, ez) ? 1 : 0);
    // flash and hurt overlays are drawn by the page from hudState; push shader values here
    if (cine.grade) { const g = cine.grade; g.uFlash.value = pstate.flashAmt > 0.02 ? Math.min(1, pstate.flashAmt * 1.6) : 0; g.uFlashColor.value.set(1, 1, 1); g.uBlur.value = clamp(pstate.flashAmt * 0.8, 0, 0.8) + (pstate.hurt > 0.5 ? 0.15 : 0); g.uSat.value = (p.alive ? GRADE.sat : 0.35) * (1 - pstate.hurt * 0.25); g.uVig.value = GRADE.vig + pstate.hurt * 0.4 + (pstate.scoped ? 0.5 : 0); }
    if (muzzleLight && muzzleLight.userData.life > 0) { muzzleLight.userData.life -= dt; if (muzzleLight.userData.life <= 0) muzzleLight.intensity = 0; else muzzleLight.intensity *= 0.82; }
    fx.update(dt, t);
  }
  let lastLookDX = 0, lastLookDY = 0;

  // ---- radar --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const mapCanvas = document.createElement("canvas"); mapCanvas.width = COLS * 4; mapCanvas.height = ROWS * 4;
  { const g = mapCanvas.getContext("2d"); g.fillStyle = "#07090c"; g.fillRect(0, 0, mapCanvas.width, mapCanvas.height); for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { if (map.solid[j * COLS + i]) continue; g.fillStyle = map.roof[j * COLS + i] ? "#2a3440" : "#3c4a58"; g.fillRect(i * 4, j * 4, 4, 4); } g.fillStyle = "#58687a"; for (const b of map.boxes) { if (b.y1 < 1) continue; g.fillRect((b.x0 / CELL) * 4, (b.z0 / CELL) * 4, ((b.x1 - b.x0) / CELL) * 4, ((b.z1 - b.z0) / CELL) * 4); } }
  function drawRadar(canvas) {
    const g = canvas.getContext("2d"); const S = canvas.width; const sc = 4 / CELL * 2.2; const p = player; const view = p.alive ? p : E.ents.find((e) => e.alive && e.team === p.team) || p;
    g.save(); g.clearRect(0, 0, S, S); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip(); g.fillStyle = "#05070a"; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2); g.rotate(view.yaw); g.translate(-view.x * sc, -view.z * sc); g.scale(sc / (4 / CELL), sc / (4 / CELL)); g.drawImage(mapCanvas, 0, 0, COLS * CELL, ROWS * CELL); g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(S / 2, S / 2); g.rotate(view.yaw); const toR = (x, z) => [(x - view.x) * sc, (z - view.z) * sc];
    for (const k of ["A", "B"]) { const [rx, rz] = toR(SITES[k].cx, SITES[k].cz); g.fillStyle = "#" + SITES[k].color.toString(16).padStart(6, "0"); g.font = "bold 16px ui-monospace, monospace"; g.textAlign = "center"; g.save(); g.translate(rx, rz); g.rotate(-view.yaw); g.fillText(k, 0, 6); g.restore(); }
    if (bomb.state === "dropped" || bomb.state === "planted") { const [bx, bz] = toR(bomb.x, bomb.z); g.fillStyle = bomb.state === "planted" ? (Math.floor(simTime * 3) % 2 ? "#ff3a2a" : "#ff9a8a") : "#ffd070"; g.fillRect(bx - 4, bz - 4, 8, 8); }
    for (const e of E.ents) { if (!e.alive) continue; const mate = e.team === p.team; let show = mate; if (!mate) { show = E.ents.some((m) => m.alive && m.team === p.team && !m.isPlayer && m.ai && m.ai.visible && m.ai.targetId === e.id) || simTime - (e.lastShotT || -9) < 0.6 && false; if (!show) continue; } const [rx, rz] = toR(e.x, e.z); const col = "#" + TEAM_LOOK[e.team].accent.toString(16).padStart(6, "0"); g.fillStyle = mate ? (e === p ? "#ffffff" : col) : "#ff3030"; g.beginPath(); g.arc(rx, rz, e === p ? 4.5 : 4, 0, 7); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 1.6; g.beginPath(); g.moveTo(rx, rz); g.lineTo(rx - Math.sin(e.yaw) * 10, rz - Math.cos(e.yaw) * 10); g.stroke(); }
    g.restore(); g.save(); g.strokeStyle = "rgba(180,200,230,0.5)"; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(S / 2, S / 2 - 6); g.lineTo(S / 2 - 4, S / 2 + 4); g.lineTo(S / 2 + 4, S / 2 + 4); g.fill(); g.restore();
  }

  // ---- HUD snapshot -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  function hudState() {
    const p = player; const am = p.ammo[p.cur]; const def = WEAPONS[p.cur]; const you = (sq) => E.ents.filter((e) => e.squad === sq); const near = p.alive || true;
    const youScore = score.you, themScore = score.them; const side = p.team;
    const ct = E.ents.filter((e) => e.team === "police"), tt = E.ents.filter((e) => e.team === "terrorist");
    const ctScore = side === "police" ? youScore : themScore, tScore = side === "terrorist" ? youScore : themScore;
    return {
      phase: R.phase, round: R.no, maxRounds: MATCH.rounds, half, side, sideName: TEAM_LOOK[side].name, locked: pstate.locked, paused: pstate.paused, menuOpen: pstate.menuOpen, scoreboard: pstate.scoreboard,
      timer: R.phase === "freeze" ? Math.max(0, MATCH.freeze - R.t) : R.timeLeft, bombTimer: bomb.state === "planted" ? Math.max(0, bomb.timer) : null, bombState: bomb.state, bombSite: bomb.site, hasBomb: p.hasBomb,
      ctScore, tScore, ctAlive: ct.map((e) => e.alive), tAlive: tt.map((e) => e.alive), ctNames: ct.map((e) => e.name), tNames: tt.map((e) => e.name),
      hp: Math.max(0, Math.ceil(p.hp)), armor: Math.ceil(p.armor), money: p.money, alive: p.alive, weapon: p.cur === "knife" ? "Combat Knife" : GRENADES[p.cur] ? GRENADES[p.cur].name : def ? def.name : "", cur: p.cur, mag: am && def && def.mag ? am.mag : null, reserve: am && def && def.mag ? am.reserve : null, reloading: simTime < p.reloadEnd,
      nades: { ...p.nades }, kit: p.kit, primary: p.primary, scoped: pstate.scoped, zoomStep: pstate.zoomStep, sniper: !!(def && def.kind === "sniper"),
      subtitle: simTime - subtitle.t < 3.2 || R.phase === "ended" ? subtitle : null, radio: radioMsg && simTime - radioMsg.t < 4 ? radioMsg : null,
      feed: feed.filter((f) => simTime - f.t < 7).map((f) => ({ ...f, age: simTime - f.t })), callout: zoneName(p.alive ? p.x : camera.position.x, p.alive ? p.z : camera.position.z),
      use: p.use ? { type: p.use.type, pct: p.use.t / (p.use.type === "plant" ? MATCH.plant : p.kit ? MATCH.defuseKit : MATCH.defuse) } : null,
      canPlant: p.alive && p.team === "terrorist" && p.hasBomb && bomb.state === "carried" && (E.inSite(p, "A") || E.inSite(p, "B")), canDefuse: p.alive && p.team === "police" && bomb.state === "planted" && Math.hypot(p.x - bomb.x, p.z - bomb.z) < 2.6,
      hit: pstate.hitMark, hitHead: pstate.hitHead, hurt: pstate.hurt, flash: pstate.flashAmt, dmgDirs: pstate.dmgDirs.map((d) => wrap(Math.atan2(-(d.x - p.x), -(d.z - p.z)) - p.yaw)),
      spectating: !p.alive && R.phase !== "ended" ? (E.ents.find((e) => e.alive && e.team === p.team && !e.isPlayer) || {}).name || null : null,
      buy: pstate.menuOpen ? buyCatalog(p.team).map((i) => ({ ...i, owned: i.id === "armor" ? p.armor >= 100 : i.id === "kit" ? p.kit : GRENADES[i.id] ? p.nades[i.id] >= GRENADES[i.id].max : i.id === p.primary || (i.id === "pistol" && false), count: GRENADES[i.id] ? p.nades[i.id] : 0 })) : null,
      board: { ct: ct.map((e) => ({ name: e.name, k: e.kills, d: e.deaths, alive: e.alive, money: e.team === p.team ? e.money : null, you: e.isPlayer })), t: tt.map((e) => ({ name: e.name, k: e.kills, d: e.deaths, alive: e.alive, money: e.team === p.team ? e.money : null, you: e.isPlayer })) },
      over, result: R.result || null, plan: null, inaccuracy: inaccuracy(p), crouch: p.crouch, moving: Math.hypot(p.vx, p.vz) / RUN, musicOn: music ? music.isEnabled() : false, sens: input.sens, vol: sfx.getVolume(), roundEnd: R.endInfo,
    };
  }

  function crosshairState() {
    const p = player; const inacc = p.alive ? inaccuracy(p) : 0; const fov = (camera.fov * Math.PI) / 180; const gap = (Math.tan(inacc) / Math.tan(fov / 2)) * (height / 2);
    return { gap: clamp(gap, 0, 90), hit: pstate.hitMark, head: pstate.hitHead, hurt: pstate.hurt, scoped: pstate.scoped, alive: p.alive, flash: pstate.flashAmt, dmg: pstate.dmgDirs.map((d) => wrap(Math.atan2(-(d.x - p.x), -(d.z - p.z)) - p.yaw)), phase: R.phase };
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const el = renderer.domElement;
  const kd = (e) => {
    if (R.phase === "menu" || over) return; if (["Tab", "Space", "ArrowUp", "ArrowDown", "KeyB"].includes(e.code)) e.preventDefault(); if (e.repeat && e.code !== "Space") return;
    if (e.code === "Tab") { pstate.scoreboard = true; return; }
    if (e.code === "KeyB") { if (R.phase === "freeze" && player.alive) { pstate.menuOpen = !pstate.menuOpen; if (pstate.menuOpen) { try { document.exitPointerLock(); } catch {} } else requestLock(); sfx.ui(); } return; }
    if (e.code === "KeyM") { if (music) { music.setEnabled(!music.isEnabled()); } return; }
    if (pstate.menuOpen && /^Digit[1-9]$/.test(e.code)) { const items = buyCatalog(player.team); const it = items[parseInt(e.code.slice(5), 10) - 1]; if (it) buyItem(player, it.id); return; }
    input.keys[e.code] = true;
  };
  const ku = (e) => { if (e.code === "Tab") { pstate.scoreboard = false; e.preventDefault(); } input.keys[e.code] = false; };
  const mm = (e) => { if (pstate.locked || E.testNoLock) { input.dx += e.movementX || 0; input.dy += e.movementY || 0; lastLookDX = e.movementX || 0; lastLookDY = e.movementY || 0; } };
  const md = (e) => { if (R.phase === "menu" || over) return; if (!pstate.locked && !E.testNoLock && !pstate.menuOpen) { requestLock(); return; } if (e.button === 0) { input.lDown = true; input.lPress = true; } if (e.button === 2) { input.rDown = true; input.rPress = true; } };
  const mu = (e) => { if (e.button === 0) input.lDown = false; if (e.button === 2) input.rDown = false; };
  const wh = (e) => { input.wheel += Math.sign(e.deltaY); };
  const ctx = (e) => e.preventDefault();
  const plc = () => { pstate.locked = document.pointerLockElement === el; if (!pstate.locked) { input.lDown = false; input.rDown = false; } };
  function requestLock() { if (E.testNoLock) return; try { el.requestPointerLock && el.requestPointerLock(); } catch {} }
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("mousemove", mm); el.addEventListener("mousedown", md); window.addEventListener("mouseup", mu); el.addEventListener("wheel", wh, { passive: true }); el.addEventListener("contextmenu", ctx); document.addEventListener("pointerlockchange", plc);
  const blur = () => { input.keys = {}; input.lDown = false; input.rDown = false; }; window.addEventListener("blur", blur);

  // ---- loop -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  let raf = 0, last = performance.now(), tAcc = 0, running = true, acc = 0; const STEP = 1 / 60;
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame); let dt = Math.min(0.05, (now - last) / 1000); last = now; tAcc += dt;
    pstate.paused = !E.testNoLock && !pstate.locked && !pstate.menuOpen && (R.phase === "live" || R.phase === "freeze") && !E.autopilot && !E.forceRun;
    if (!pstate.paused && !(E.hold)) { acc += dt; let n = 0; while (acc >= STEP && n < 5) { stepSim(STEP); acc -= STEP; n++; } if (n === 5) acc = 0; }
    updateVisuals(dt, tAcc);
    if (R.phase !== "menu") { cine.render(dt); if (!cine.composer) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vm.scene, vm.camera); renderer.autoClear = true; } }
  }
  function resize() { width = mount.clientWidth || width; height = mount.clientHeight || height; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); vm.resize(width / height); cine.setSize(width, height); }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(mount); window.addEventListener("resize", resize);

  function start() {
    sfx.start(); sfx.startAmbient(day ? map.def.id : "night"); if (music) music.start(); score.you = 0; score.them = 0; lossStreak.you = lossStreak.them = 0; half = 1; R.no = 0; over = false; stats.kills = stats.hs = stats.plants = stats.defuses = stats.deaths = stats.damage = 0;
    for (const e of E.ents) { e.kills = e.deaths = e.hs = 0; e.money = START_MONEY; } beginRound(); R.phase = "freeze"; resize(); requestLock();
  }
  raf = requestAnimationFrame(frame);
  function dispose() {
    running = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); window.removeEventListener("blur", blur); window.removeEventListener("resize", resize); document.removeEventListener("pointerlockchange", plc); if (ro) ro.disconnect();
    try { document.exitPointerLock(); } catch {} try { sfx.stopAmbient(); sfx.stop(); } catch {} try { music && music.stop(); } catch {} try { world.dispose(); cine.dispose(); renderer.dispose(); } catch {} if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  const api = {
    start, dispose, hudState, crosshairState, drawRadar, input, E, requestLock, buy: (id) => buyItem(player, id), closeBuy() { pstate.menuOpen = false; requestLock(); sfx.ui(); }, openBuy() { if (R.phase === "freeze" && player.alive) { pstate.menuOpen = true; try { document.exitPointerLock(); } catch {} } },
    setSens(v) { input.sens = v; try { localStorage.setItem("blacksite-sens", String(v)); } catch {} }, setVolume: (v) => sfx.setVolume(v), toggleMusic() { if (music) music.setEnabled(!music.isEnabled()); },
    resume() { requestLock(); }, sim(seconds, dt = 1 / 30) { const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) stepSim(dt); }, brain, bomb, player, pstate, score, camera, renderer, scene, world, vm, fx, sfx, map, setAutopilot(on) { E.autopilot = on; if (on) { player.ai = player.ai || {}; Object.assign(player.ai, { startAt: 0, nextThink: 0 }); brain.planRound(); botBuy(player); player.cur = player.primary || "pistol"; } }, skipFreeze() { if (R.phase === "freeze") R.t = MATCH.freeze; }, ents: E.ents, endNow(team, why) { endRound(team, why || "test"); },
  };
  if (typeof window !== "undefined" && window.__BS_EXPOSE) window.__bs = api;
  return api;
}
