// Wrath of Olympus — the "table" where everything meets: it runs the game clock, reads the mouse and
// keyboard, turns clicks into orders, draws the minimap and tells the screen (React) what to show.
import { createSim } from "./sim";
import { createAI } from "./ai";
import { createRenderer } from "./render";
import { N, UNITS, BUILDINGS, TECHS, POWERS, AGES, DIFFICULTY, RES, canAfford, costText, BUILD_ORDER, HEROES, ABILITIES, GODS, GOD_CHOICES, RELICS, XP_AT, MAX_LEVEL, HERO_UNLOCK2, WILD } from "./defs";
import { REVIVE_COST } from "./heroes";
import { T_GRASS, T_DIRT, T_SAND, T_WATER, T_ROCK } from "./mapgen";
import { isMuted } from "@/lib/sound";

const HOTKEYS = ["q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v"];
const STEP = 1 / 30;
const MAX_ZOOM = 64, MIN_ZOOM = 8;

export function createEngine({ mount, onState, onMsg, difficulty = "veteran", seed, interactive = true, preserve = false, hero = "achilles", scenario = null, blessings = null }) {
  seed = (scenario && scenario.seed) || seed || ((Math.random() * 99999) | 0) + 1;
  const S = createSim({ seed, difficulty, hero, scenario, blessings });
  const ai = createAI(S, 1, difficulty); S.ais.push(ai);
  const R = createRenderer(mount, S, { preserve });
  const me = 0;
  const diff = DIFFICULTY[difficulty];
  const scnMult = (scenario && scenario.scoreMult) || 1;

  // ---- state ----------------------------------------------------------------------------------------
  let sel = []; const groups = {}; let lastGroupKey = null, lastGroupT = 0;
  let placing = null; // { kind }
  let targeting = null; // power key
  let abilityTarget = null; // { slot, key } while the player is picking a spot for a champion ability
  let godChoice = null; // { age } while the "choose your god" window is open
  let paused = false, speed = 1, running = false, playing = false;
  let msgs = []; let alertSpot = null; const mmPings = [];
  let hoverEnt = null, mouse = { x: 0, y: 0, inside: false }, drag = null, pan = null;
  const keys = new Set();
  let lastClick = { t: 0, id: 0 };
  let result = null;
  let dirty = true, uiT = 0, mmT = 0;
  const cam = { x: 0, z: 0, tx: 0, tz: 0, dist: 30, td: 30 };
  const tc0 = S.buildings.find((b) => b.owner === me && b.kind === "town_center");
  cam.x = cam.tx = tc0.x + 3; cam.z = cam.tz = tc0.z - 3; // looks slightly toward the middle of the map

  // ---- little sounds (no files; made with the browser's synth) ------------------------------------------------
  let actx = null; const lastSfx = {};
  function ctx() { if (!actx) { try { const C = window.AudioContext || window.webkitAudioContext; actx = C ? new C() : null; } catch { actx = null; } } if (actx && actx.state === "suspended") actx.resume().catch(() => {}); return actx; }
  function tone(f, d, type = "sine", vol = 0.08, slide = 0, delay = 0) {
    if (isMuted()) return; const c = ctx(); if (!c) return; const t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, vol = 0.1, freq = 800, delay = 0) {
    if (isMuted()) return; const c = ctx(); if (!c) return; const t = c.currentTime + delay; const len = Math.floor(c.sampleRate * d), b = c.createBuffer(1, len, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  function snd(name) {
    const now = performance.now(); if (now - (lastSfx[name] || 0) < (name === "hit" || name === "shot" ? 90 : 40)) return; lastSfx[name] = now;
    switch (name) {
      case "click": tone(620, 0.05, "triangle", 0.05); break;
      case "select": tone(780, 0.05, "triangle", 0.045); tone(980, 0.05, "triangle", 0.03, 0, 0.04); break;
      case "order": tone(330, 0.07, "square", 0.03); break;
      case "place": tone(160, 0.08, "square", 0.07); noise(0.09, 0.08, 1400); break;
      case "built": tone(523, 0.16, "triangle", 0.07); tone(659, 0.16, "triangle", 0.07, 0, 0.12); tone(784, 0.3, "triangle", 0.07, 0, 0.24); break;
      case "trained": tone(660, 0.1, "triangle", 0.06); tone(880, 0.16, "triangle", 0.06, 0, 0.09); break;
      case "alert": tone(220, 0.35, "sawtooth", 0.07, -60); tone(165, 0.5, "sawtooth", 0.07, -40, 0.3); break;
      case "hit": noise(0.06, 0.07, 2200); tone(180, 0.05, "square", 0.03); break;
      case "shot": noise(0.05, 0.03, 4000); break;
      case "boom": noise(0.5, 0.2, 500); tone(70, 0.4, "sine", 0.18, -30); break;
      case "bolt": noise(1.0, 0.25, 900); tone(55, 0.9, "sawtooth", 0.14, -20); break;
      case "heal": [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, "sine", 0.05, 0, i * 0.08)); break;
      case "age": [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, "triangle", 0.08, 0, i * 0.14)); break;
      case "levelup": [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.07, 0, i * 0.07)); break;
      case "ability": tone(300, 0.25, "sawtooth", 0.06, 500); noise(0.18, 0.08, 2600); break;
      case "horn": tone(196, 0.7, "sawtooth", 0.07, 30); tone(262, 0.9, "sawtooth", 0.06, 20, 0.35); break;
      case "find": tone(660, 0.12, "sine", 0.06); tone(990, 0.3, "sine", 0.06, 0, 0.1); break;
      case "error": tone(140, 0.14, "square", 0.05); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, "triangle", 0.09, 0, i * 0.15)); break;
      case "lose": [392, 349, 294, 220].forEach((f, i) => tone(f, 0.6, "sawtooth", 0.06, 0, i * 0.22)); break;
      default: break;
    }
  }

  // ---- helpers --------------------------------------------------------------------------------------------
  const P0 = S.players[0];
  const get = (id) => S.ents.get(id);
  const mine = (e) => e && !e.dead && e.owner === me;
  function say(text, kind = "info") { const m = { id: Math.random(), text, kind, t: performance.now() }; msgs = [...msgs.slice(-3), m]; dirty = true; onMsg && onMsg(m); }
  function selEnts() { sel = sel.filter((id) => { const e = get(id); return e && !e.dead; }); return sel.map(get); }
  function setSel(ids) { sel = ids.slice(0, 80); if (!sel.length) cancelModes(); dirty = true; }
  function cancelModes() { placing = null; targeting = null; abilityTarget = null; R.hideGhost(); R.setTargetRing(null); }
  const heroEnt = () => (P0.hero && P0.hero.unit && !P0.hero.unit.dead ? P0.hero.unit : null);
  const selUnits = () => selEnts().filter((e) => e.type === "unit" && e.owner === me);
  const selBuildings = () => selEnts().filter((e) => e.type === "building" && e.owner === me);
  function nearestTreeAt(x, z, r = 0.9) { let best = null, bd = r * r; for (const n of S.nodes) { if (n.dead) continue; const dx = n.x - x, dz = n.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = n; } } return best; }
  function entityUnderMouse(nx, ny) {
    const e = R.pickEntity(nx, ny); if (e) return e;
    const g = R.groundAt(nx, ny); const n = nearestTreeAt(g.x, g.z); return n && S.vis[Math.floor(n.z) * N + Math.floor(n.x)] > 0 ? n : null;
  }
  const ndc = (ev) => { const r = R.el.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * 2 - 1, y: -(((ev.clientY - r.top) / r.height) * 2 - 1), px: ev.clientX - r.left, py: ev.clientY - r.top, w: r.width, h: r.height }; };

  // ---- the command card (what the buttons do) ---------------------------------------------------------------
  function reasonFor(cost, minAge, extra) {
    if (P0.age < minAge) return `Needs the ${AGES[minAge].short} Age`; if (!canAfford(P0.res, cost)) return "Not enough resources"; return extra || null;
  }
  function commands() {
    const out = []; const us = selUnits(), bs = selBuildings(); const all = selEnts();
    if (bs.length && !us.length) {
      const b = bs.slice().sort((a, c) => a.queue.length - c.queue.length)[0]; if (!b.done) return [{ id: "delete", icon: "🗑️", name: "Cancel construction", desc: "Stop building this and get nothing back.", enabled: true, key: "Delete" }];
      for (const k of b.def.trains || []) { const d = UNITS[k]; if (d.god && !P0.gods.includes(d.god)) continue; const popFull = S.popOf(me) + P0.reserved + d.pop > S.capOf(me); const cst = S.costOf(me, k); const reason = reasonFor(cst, d.age, popFull ? "Build more houses" : b.queue.length >= 6 ? "Queue is full" : null); out.push({ id: `train:${k}`, icon: d.icon, name: d.name, cost: costText(cst), desc: d.desc + (d.pop > 1 ? ` (takes ${d.pop} homes)` : ""), enabled: !reason, reason, bID: b.id }); }
      const techs = Object.keys(TECHS).filter((k) => (TECHS[k].from === b.kind) && !P0.techs.has(k) && !S.buildings.some((bb) => bb.owner === me && !bb.dead && bb.queue.some((q) => q.key === k)));
      for (const k of techs) { const t = TECHS[k]; const reason = reasonFor(t.cost, t.age); out.push({ id: `tech:${k}`, icon: t.icon, name: t.name, cost: costText(t.cost), desc: t.desc, enabled: !reason, reason, bID: b.id }); }
      if (b.kind === "town_center") { const next = AGES[P0.age + 1]; if (next) { const reason = P0.ageBusy ? "Already advancing" : reasonFor(next.cost, 0); out.push({ id: "age", icon: "🏺", name: `Advance to ${next.short} Age`, cost: costText(next.cost), desc: (P0.age === 0 ? "Unlocks archers, horsemen, towers and more." : "Unlocks catapults and the strongest upgrades.") + (GOD_CHOICES[P0.age + 1] ? " You will choose a new god to follow." : ""), enabled: !reason, reason, bID: b.id }); } }
      out.push({ id: "delete", icon: "🗑️", name: "Demolish", desc: "Tear this building down.", enabled: true, key: "Delete", danger: true });
    } else if (us.length === 1 && us[0].isHero) {
      const H = P0.hero; const keysA = HEROES[H.id].abilities;
      keysA.forEach((k, slot) => { const A = ABILITIES[k]; const locked = slot === 1 && H.level < HERO_UNLOCK2; const cd = Math.max(0, H.readyAt[slot] - S.t); const reason = locked ? `Unlocks at level ${HERO_UNLOCK2}` : cd > 0 ? `Recharging (${Math.ceil(cd)}s)` : null; out.push({ id: `ability:${slot}`, icon: A.icon, name: A.name, desc: A.desc, cost: `Recharge ${A.cd}s`, enabled: !reason, reason }); });
      out.push({ id: "stop", icon: "✋", name: "Stop", desc: "Stand still.", enabled: true });
    } else if (us.length) {
      if (us.some((u) => u.cls === "villager")) {
        for (const k of BUILD_ORDER) { const d = BUILDINGS[k]; const reason = reasonFor(d.cost, d.age); out.push({ id: `build:${k}`, icon: d.icon, name: d.name, cost: costText(d.cost), desc: d.desc, enabled: !reason, reason }); }
      }
      out.push({ id: "stop", icon: "✋", name: "Stop", desc: "Stand still.", enabled: true });
    }
    return out.slice(0, 12).map((c, i) => ({ ...c, key: c.key || HOTKEYS[i].toUpperCase() }));
  }
  function runCmd(id) {
    const [t, arg] = id.split(":"); const bs = selBuildings();
    const err = (r) => { if (r && !r.ok) { say(r.reason || "Can't do that", "warn"); snd("error"); return false; } return true; };
    if (t === "build") {
      const d = BUILDINGS[arg]; const reason = reasonFor(d.cost, d.age); if (reason) { say(reason, "warn"); snd("error"); return; }
      placing = { kind: arg }; targeting = null; snd("click"); dirty = true; return;
    }
    if (t === "stop") { S.cmdStop(me, sel); snd("order"); return; }
    if (t === "ability") { beginAbility(+arg); return; }
    if (t === "revive") { reviveHero(); return; }
    if (t === "delete") { const list = selEnts().filter((e) => e.owner === me); list.forEach((e) => err(S.cmdDelete(me, e.id))); setSel([]); snd("order"); return; }
    const b = bs.slice().sort((a, c) => a.queue.length - c.queue.length)[0]; if (!b) return;
    if (t === "train") { if (err(S.cmdTrain(me, b.id, arg))) snd("click"); } else if (t === "tech") { if (err(S.cmdResearch(me, b.id, arg))) snd("click"); } else if (t === "age") { if (GOD_CHOICES[P0.age + 1]) { godChoice = { bId: b.id, age: P0.age + 1 }; snd("click"); } else if (err(S.cmdAge(me, b.id))) { snd("click"); say(`Advancing to the ${AGES[P0.age + 1].short} Age…`); } }
    dirty = true;
  }
  function chooseGod(god) {
    if (!godChoice) return; const r = S.cmdAge(me, godChoice.bId, god); godChoice = null; dirty = true;
    if (r.ok) { snd("click"); say(`You follow ${GODS[god].name}. Advancing to the next age…`, "good"); } else { say(r.reason || "Can't do that", "warn"); snd("error"); }
  }
  function cancelGod() { godChoice = null; dirty = true; }
  function beginAbility(slot) {
    const u = heroEnt(); if (!u) { say("Your champion has fallen — revive them at a Temple or Town Center", "warn"); snd("error"); return; }
    const key = HEROES[P0.hero.id].abilities[slot], A = ABILITIES[key];
    if (slot === 1 && P0.hero.level < HERO_UNLOCK2) { say(`Unlocks at level ${HERO_UNLOCK2}`, "warn"); snd("error"); return; }
    if (P0.hero.readyAt[slot] > S.t) { say("That ability is still recharging", "warn"); snd("error"); return; }
    if (A.target === "self") { const r = S.cmdAbility(me, slot); if (!r.ok) { say(r.reason, "warn"); snd("error"); } return; }
    abilityTarget = { slot, key }; targeting = null; placing = null; R.hideGhost(); snd("click"); dirty = true;
  }
  function reviveHero() { const r = S.cmdRevive(me); if (r.ok) { snd("click"); say("Your champion is being called back…", "good"); } else { say(r.reason, "warn"); snd("error"); } dirty = true; }
  function selectHero() { const u = heroEnt(); if (!u) { say("Your champion has fallen", "warn"); return; } if (sel.length === 1 && sel[0] === u.id) centerOn(u.x, u.z); else { setSel([u.id]); centerOn(u.x, u.z); } snd("select"); }
  function beginPower(key) {
    if (!P0.heroId || !HEROES[P0.heroId].powers.includes(key)) return;
    const pw = POWERS[key]; if (!S.buildings.some((b) => !b.dead && b.done && b.owner === me && b.kind === "temple")) { say("Build a Temple to call on the gods", "warn"); snd("error"); return; }
    if (P0.favor < pw.favor) { say("Not enough favor yet", "warn"); snd("error"); return; } if (P0.powerCd[key] > S.t) { say("That power is still recharging", "warn"); snd("error"); return; }
    if (!pw.needsTarget) { const r = S.cmdPower(me, key); if (r.ok) snd("heal"); return; }
    targeting = key; placing = null; R.hideGhost(); snd("click"); dirty = true;
  }
  function cancelQueue(bId, idx) { const r = S.cmdCancel(me, bId, idx); if (r.ok) snd("click"); dirty = true; }
  function centerOn(x, z) { cam.tx = x; cam.tz = z; }
  function selectIdle() { const v = S.units.filter((u) => !u.dead && u.owner === me && u.cls === "villager" && u.order.type === "idle"); if (!v.length) { say("No idle citizens", "info"); return; } const cur = sel.length === 1 ? v.findIndex((u) => u.id === sel[0]) : -1; const u = v[(cur + 1) % v.length]; setSel([u.id]); centerOn(u.x, u.z); snd("select"); }
  function selectArmy() { const a = S.units.filter((u) => !u.dead && u.owner === me && u.cls !== "villager").map((u) => u.id); if (!a.length) { say("You have no soldiers", "info"); return; } setSel(a); snd("select"); }
  function goHome() { const t = S.buildings.find((b) => !b.dead && b.owner === me && b.kind === "town_center"); if (t) { centerOn(t.x + 3, t.z - 4); setSel([t.id]); snd("select"); } }

  // ---- mouse ------------------------------------------------------------------------------------------------
  const boxEl = document.createElement("div"); Object.assign(boxEl.style, { position: "absolute", border: "1px solid #7dff8a", background: "rgba(125,255,138,0.12)", display: "none", pointerEvents: "none", zIndex: 5 }); mount.appendChild(boxEl);
  function placeAt(ev) {
    const n = ndc(ev); const g = R.groundAt(n.x, n.y); const d = BUILDINGS[placing.kind]; return { ix: Math.round(g.x - d.size / 2), iz: Math.round(g.z - d.size / 2) };
  }
  function onDown(ev) {
    if (!playing || result) return; ctx(); const n = ndc(ev);
    if (ev.button === 1) { pan = { x: ev.clientX, y: ev.clientY, cx: cam.tx, cz: cam.tz }; ev.preventDefault(); return; }
    if (ev.button === 2) { rightClick(ev, n); return; }
    if (ev.button !== 0) return;
    if (placing) {
      const { ix, iz } = placeAt(ev); const ids = selUnits().filter((u) => u.cls === "villager").map((u) => u.id);
      const r = S.cmdPlace(me, placing.kind, ix, iz, ids, ev.shiftKey);
      if (r.ok) { snd("place"); if (!ev.shiftKey || !canAfford(P0.res, BUILDINGS[placing.kind].cost)) { placing = null; R.hideGhost(); } } else { say(r.reason, "warn"); snd("error"); }
      dirty = true; return;
    }
    if (abilityTarget) {
      const g = R.groundAt(n.x, n.y); const r = S.cmdAbility(me, abilityTarget.slot, g.x, g.z); if (r.ok) { abilityTarget = null; R.setTargetRing(null); } else { say(r.reason, "warn"); snd("error"); }
      dirty = true; return;
    }
    if (targeting) {
      const g = R.groundAt(n.x, n.y); const r = S.cmdPower(me, targeting, g.x, g.z); if (r.ok) { snd(targeting === "bolt" || targeting === "quake" || targeting === "storm" ? "bolt" : "heal"); targeting = null; R.setTargetRing(null); } else { say(r.reason, "warn"); snd("error"); }
      dirty = true; return;
    }
    drag = { x: n.px, y: n.py, nx: n.x, ny: n.y, shift: ev.shiftKey, moved: false };
  }
  function onMove(ev) {
    const n = ndc(ev); mouse = { x: n.px, y: n.py, inside: true, w: n.w, h: n.h };
    if (pan) { const k = cam.dist * 0.0022; const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y; const rx = 0.7071, rz = 0.7071, fx = 0.7071, fz = -0.7071; cam.tx = pan.cx - dx * k * rx + dy * k * fx; cam.tz = pan.cz - dx * k * rz + dy * k * fz; return; }
    if (placing) { const { ix, iz } = placeAt(ev); const ok = S.placementOk(placing.kind, ix, iz) && canAfford(P0.res, BUILDINGS[placing.kind].cost); R.showGhost(placing.kind, ix, iz, ok); }
    if (targeting) { const g = R.groundAt(n.x, n.y); R.setTargetRing(g, POWERS[targeting].radius || 1, targeting === "bolt" ? 0xbfdcff : 0x8dffa0); }
    if (abilityTarget) { const g = R.groundAt(n.x, n.y); const A = ABILITIES[abilityTarget.key], u = heroEnt(); const far = u && Math.hypot(g.x - u.x, g.z - u.z) > A.range + 0.5; R.setTargetRing(g, A.radius || 1.2, far ? 0xff6a5a : 0xffe08a); }
    if (drag) { const dx = n.px - drag.x, dy = n.py - drag.y; if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true; if (drag.moved) { Object.assign(boxEl.style, { display: "block", left: `${Math.min(drag.x, n.px)}px`, top: `${Math.min(drag.y, n.py)}px`, width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px` }); } }
  }
  function hoverUpdate() {
    if (!mouse.inside || drag || placing || targeting || abilityTarget || !playing) { if (hoverEnt) { hoverEnt = null; R.setHover(0); } return; }
    const r = R.el.getBoundingClientRect(); const e = entityUnderMouse((mouse.x / r.width) * 2 - 1, -((mouse.y / r.height) * 2 - 1));
    hoverEnt = e; R.setHover(e ? e.id : 0);
    const us = selUnits(); R.el.style.cursor = e && e.owner !== me && e.owner >= 0 && (e.type === "unit" || e.type === "building") && us.length ? "crosshair" : e && e.type === "node" && us.some((u) => u.cls === "villager") ? "copy" : e && e.owner === me ? "pointer" : "default";
  }
  function onUp(ev) {
    if (ev.button === 1) { pan = null; return; }
    if (ev.button !== 0 || !drag) return; const n = ndc(ev); const d = drag; drag = null; boxEl.style.display = "none";
    if (d.moved) { // box select: only your own units (or one building if no units)
      const x0 = Math.min(d.x, n.px), x1 = Math.max(d.x, n.px), y0 = Math.min(d.y, n.py), y1 = Math.max(d.y, n.py);
      const inBox = (e) => { const p = R.project(e.x, R.heightAt(e.x, e.z) + 0.6, e.z); const sx = (p.x * 0.5 + 0.5) * n.w, sy = (-p.y * 0.5 + 0.5) * n.h; return !p.behind && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; };
      let ids = S.units.filter((u) => !u.dead && u.owner === me && inBox(u)).map((u) => u.id);
      if (!ids.length) { const b = S.buildings.find((bb) => !bb.dead && bb.owner === me && inBox(bb)); if (b) ids = [b.id]; }
      if (d.shift) ids = [...new Set([...sel, ...ids])]; if (ids.length) snd("select"); setSel(ids); return;
    }
    const e = entityUnderMouse(n.x, n.y);
    if (!e) { if (!d.shift) setSel([]); return; }
    const now = performance.now();
    if (e.type === "unit" && e.owner === me && lastClick.id === e.id && now - lastClick.t < 380) { // double-click: everything of this kind on screen
      const same = S.units.filter((u) => !u.dead && u.owner === me && u.kind === e.kind && (() => { const p = R.project(u.x, 0.5, u.z); return !p.behind && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; })()).map((u) => u.id);
      setSel(same); snd("select"); lastClick = { t: 0, id: 0 }; return;
    }
    lastClick = { t: now, id: e.id };
    if (d.shift && e.owner === me && e.type === "unit") { sel = sel.includes(e.id) ? sel.filter((i) => i !== e.id) : [...sel, e.id].filter((i) => get(i)?.type === "unit"); dirty = true; snd("select"); return; }
    setSel([e.id]); snd("select");
  }
  function rightClick(ev, n) {
    if (placing || targeting || abilityTarget) { cancelModes(); dirty = true; return; }
    const us = selUnits(), bs = selBuildings(); if (!us.length && !bs.length) return;
    const e = entityUnderMouse(n.x, n.y); const g = R.groundAt(n.x, n.y); const ids = us.map((u) => u.id);
    if (us.length) {
      if (e && e.owner !== me && e.owner >= 0 && (e.type === "unit" || e.type === "building") && !e.dead) { S.cmdAttack(me, ids, e.id); R.ping(e.x, e.z, "attack"); snd("order"); return; }
      if (e && (e.type === "node" || (e.type === "building" && e.def.farm && e.owner === me))) { const vs = us.filter((u) => u.cls === "villager").map((u) => u.id); if (vs.length) { S.cmdGather(me, vs, e.id); const rest = us.filter((u) => u.cls !== "villager").map((u) => u.id); if (rest.length) S.cmdMove(me, rest, g.x, g.z); R.ping(e.x, e.z, "move"); snd("order"); return; } }
      if (e && e.owner === me && e.type === "building" && (!e.done || e.hp < e.maxHp) && us.some((u) => u.cls === "villager")) { S.cmdBuild(me, us.filter((u) => u.cls === "villager").map((u) => u.id), e.id, e.done); R.ping(e.x, e.z, "move"); snd("order"); return; }
      S.cmdMove(me, ids, g.x, g.z); R.ping(g.x, g.z, "move"); snd("order");
    } else if (bs.length) {
      for (const b of bs) if (b.done && b.def.trains) { const tn = e && e.type === "node" ? e.id : 0; S.cmdRally(me, b.id, e ? e.x : g.x, e ? e.z : g.z, tn); }
      R.ping(e ? e.x : g.x, e ? e.z : g.z, "rally"); snd("order"); dirty = true;
    }
  }
  function onWheel(ev) { ev.preventDefault(); cam.td = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.td * (ev.deltaY > 0 ? 1.1 : 0.9))); }
  function onLeave() { mouse.inside = false; if (drag && !drag.moved) drag = null; }
  function onKeyDown(ev) {
    if (!playing || result) return; const tg = ev.target; if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k.startsWith("Arrow")) { keys.add(k); ev.preventDefault(); return; }
    if (k === "Escape") { if (godChoice) { cancelGod(); } else if (placing || targeting || abilityTarget) { cancelModes(); dirty = true; } else if (sel.length) setSel([]); return; }
    if (k === "Delete" || k === "Backspace") { const list = selEnts().filter((e) => e.owner === me); if (list.length) { runCmd("delete"); } return; }
    if (k === " ") { ev.preventDefault(); if (alertSpot) centerOn(alertSpot.x, alertSpot.z); return; }
    if (k === "." || k === "i") { selectIdle(); return; }
    if (k === "h") { goHome(); return; }
    if (k === "Tab" || k === "t") { ev.preventDefault(); selectHero(); return; }
    if (k === ",") { selectArmy(); return; }
    if (k === "p") { paused = !paused; dirty = true; return; }
    if (ev.shiftKey && (k === "q" || k === "w")) { ev.preventDefault(); beginAbility(k === "q" ? 0 : 1); return; }
    const dg = /^Digit([1-9])$/.exec(ev.code || "");
    if (dg) {
      const k = dg[1];
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { ev.preventDefault(); groups[k] = sel.slice(); say(`Group ${k} saved`, "info"); return; }
      const g = (groups[k] || []).filter((i) => { const e = get(i); return e && !e.dead; });
      if (g.length) { const now = performance.now(); setSel(g); snd("select"); if (lastGroupKey === k && now - lastGroupT < 450) { const e = get(g[0]); centerOn(e.x, e.z); } lastGroupKey = k; lastGroupT = now; }
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const idx = HOTKEYS.indexOf(k); if (idx >= 0) { const c = commands()[idx]; if (c) { if (c.enabled) runCmd(c.id); else { say(c.reason || "Can't do that", "warn"); snd("error"); } } }
  }
  function onKeyUp(ev) { keys.delete(ev.key); }
  const onCtx = (e) => e.preventDefault();
  if (interactive) {
    R.el.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); R.el.addEventListener("wheel", onWheel, { passive: false }); R.el.addEventListener("pointerleave", onLeave); R.el.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
  }

  // ---- minimap -------------------------------------------------------------------------------------------------
  const tile = document.createElement("canvas"); tile.width = tile.height = N; {
    const g = tile.getContext("2d"), im = g.createImageData(N, N); const col = { [T_GRASS]: [104, 150, 66], [T_DIRT]: [150, 124, 80], [T_SAND]: [206, 190, 140], [T_WATER]: [58, 120, 170], [T_ROCK]: [120, 118, 110] };
    for (let i = 0; i < N * N; i++) { const c = col[S.map.terrain[i]] || col[T_GRASS]; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
    for (const nd of S.nodes) { const c = nd.kind === "tree" ? [58, 98, 44] : nd.kind === "gold" ? [236, 190, 50] : nd.kind === "stone" ? [170, 170, 170] : [190, 50, 90]; for (let j = 0; j < nd.w; j++) for (let i = 0; i < nd.w; i++) { const o = ((nd.iz + j) * N + nd.ix + i) * 4; im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; } }
    g.putImageData(im, 0, 0);
  }
  const fogC = document.createElement("canvas"); fogC.width = fogC.height = N; const fogCtx = fogC.getContext("2d"); const fogIm = fogCtx.createImageData(N, N);
  const SQ = Math.SQRT2;
  function mmMatrix(size) { const sc = size / (N * SQ), k = sc / SQ; return [k, -k, k, k, size / 2 - k * N, size / 2]; }
  function drawMinimap(canvas) {
    const size = canvas.width; const g = canvas.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, size, size);
    g.save(); g.beginPath(); g.moveTo(size / 2, 0); g.lineTo(size, size / 2); g.lineTo(size / 2, size); g.lineTo(0, size / 2); g.closePath(); g.clip();
    g.fillStyle = "#000"; g.fillRect(0, 0, size, size);
    const m = mmMatrix(size); g.setTransform(...m); g.imageSmoothingEnabled = false; g.drawImage(tile, 0, 0);
    // what the player can see
    for (let i = 0; i < N * N; i++) { const v = S.vis[i]; fogIm.data[i * 4] = 0; fogIm.data[i * 4 + 1] = 0; fogIm.data[i * 4 + 2] = 4; fogIm.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 120 : 255; }
    fogCtx.putImageData(fogIm, 0, 0); g.drawImage(fogC, 0, 0);
    const col = ["#4aa0ff", "#ff4a3a", "#e6c34a"];
    for (const b of S.buildings) { if (b.dead) continue; if (b.owner !== me && S.vis[Math.floor(b.z) * N + Math.floor(b.x)] === 0) continue; g.fillStyle = col[b.owner]; g.fillRect(b.ix, b.iz, b.w, b.w); }
    for (const u of S.units) { if (u.dead) continue; if (u.owner !== me && S.vis[Math.floor(u.z) * N + Math.floor(u.x)] !== 2) continue; g.fillStyle = col[u.owner]; const sz = u.isHero ? 3 : 1.8; g.fillRect(u.x - sz / 2, u.z - sz / 2, sz, sz); }
    // the map's secrets: rumours first (vague circles), real icons once found (all of them at once with Odysseus)
    const sense = P0.heroId && HEROES[P0.heroId].passive.poiSense; g.textAlign = "center"; g.textBaseline = "middle";
    for (const r of S.rumours) { const p = S.ents.get(r.poiId); if (!p || p.found[0] || p.cleared || sense) continue; g.strokeStyle = r.kind === "relic" ? "rgba(255,225,120,.85)" : "rgba(235,235,235,.55)"; g.lineWidth = 0.9; g.setLineDash([2, 2]); g.beginPath(); g.arc(r.x, r.z, r.r, 0, 6.3); g.stroke(); g.setLineDash([]); g.fillStyle = "rgba(255,255,255,.8)"; g.font = "bold 7px sans-serif"; g.fillText("?", r.x, r.z); }
    for (const p of S.pois) { if (!(p.found[0] || sense)) continue; if (p.poi === "shrine") { g.fillStyle = p.visited[0] ? "rgba(140,140,255,.5)" : "#b9a6ff"; g.beginPath(); g.arc(p.x, p.z, 1.9, 0, 6.3); g.fill(); } else if (!p.cleared) { g.fillStyle = p.relic ? "#ffd84a" : "#e6c34a"; g.save(); g.translate(p.x, p.z); g.rotate(Math.PI / 4); g.fillRect(-1.7, -1.7, 3.4, 3.4); g.restore(); if (p.relic) { g.strokeStyle = "#fff6c0"; g.lineWidth = 0.7; g.beginPath(); g.arc(p.x, p.z, 3, 0, 6.3); g.stroke(); } } }
    for (const r of S.relics) { if (r.state === "ground" && r.found[0]) { g.fillStyle = "#fff6a0"; g.beginPath(); g.arc(r.x, r.z, 1.6, 0, 6.3); g.fill(); } }
    { const hu = heroEnt(); if (hu) { g.strokeStyle = "#fff"; g.lineWidth = 0.9; g.beginPath(); g.arc(hu.x, hu.z, 2.4, 0, 6.3); g.stroke(); } }
    const now = performance.now(); for (let i = mmPings.length - 1; i >= 0; i--) { const p = mmPings[i], a = (now - p.t) / 3000; if (a >= 1) { mmPings.splice(i, 1); continue; } g.strokeStyle = `rgba(255,80,60,${1 - a})`; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.z, 2 + a * 9 * (0.5 + Math.abs(Math.sin(a * 14))), 0, 6.3); g.stroke(); }
    // the camera's view
    const gp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => R.groundAt(a, b));
    g.setTransform(1, 0, 0, 1, 0, 0); g.restore(); g.save(); g.setTransform(...m); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 1.1; g.beginPath(); gp.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.closePath(); g.stroke(); g.restore();
  }
  function minimapToWorld(px, py, size) { const k = size / (N * SQ) / SQ; const sx = px - size / 2, sy = py - size / 2; const dx = (sx - sy) / (2 * k), dz = (sx + sy) / (2 * k); return { x: Math.max(4, Math.min(N - 4, dx + N / 2)), z: Math.max(4, Math.min(N - 4, dz + N / 2)) }; }
  function minimapClick(px, py, size, right) {
    const w = minimapToWorld(px, py, size);
    if (right && selUnits().length) { S.cmdMove(me, sel, w.x, w.z); snd("order"); return; }
    centerOn(w.x, w.z);
  }

  // ---- state for the screen ---------------------------------------------------------------------------------------
  function orderText(u) {
    const o = u.order || {}; switch (o.type) { case "move": return "Moving"; case "attack": return "Attacking"; case "gather": return o.phase === "toDrop" ? "Carrying to a drop-off" : "Gathering"; case "build": return "Building"; case "repair": return "Repairing"; default: return "Idle"; }
  }
  function describe(e) {
    const d = { id: e.id, type: e.type, kind: e.kind, owner: e.owner, name: e.def.name, icon: e.def.icon, hp: Math.ceil(e.hp), maxHp: e.maxHp, desc: e.def.desc, hero: !!e.isHero, level: e.lvl || 0, statuses: e.st ? Object.keys(e.st).filter((k) => e.st[k] > S.t) : [] };
    if (e.type === "unit") { Object.assign(d, { atk: e.def.atk + (e.def.atk > 0 && P0.techs.has("melee") && e.owner === me && ["hoplite", "horseman", "hero"].includes(e.kind) ? 2 : 0), range: e.def.range, mArm: e.def.mArm, pArm: e.def.pArm, state: orderText(e), carry: e.carry && e.carry.amt > 0 ? `${e.carry.amt} ${e.carry.res}` : "" }); }
    else if (e.type === "building") { d.done = e.done; d.progress = e.progress; d.queue = e.queue.map((q) => ({ label: q.type === "unit" ? UNITS[q.kind].name : q.type === "tech" ? TECHS[q.key].name : q.type === "revive" ? "Reviving your champion" : "Next Age", icon: q.type === "unit" ? UNITS[q.kind].icon : q.type === "tech" ? TECHS[q.key].icon : q.type === "revive" ? HEROES[P0.heroId].icon : "🏺", pct: q.pct ?? q.t / q.total })); d.rally = !!e.rally; d.mArm = e.def.mArm; d.pArm = e.def.pArm; if (e.def.popCap) d.popCap = e.def.popCap; }
    else if (e.type === "node") { d.left = Math.ceil(e.amount); d.res = e.res; d.name = e.def.name; }
    return d;
  }
  function buildState() {
    const ents = selEnts(); let selInfo = null;
    if (ents.length === 1) selInfo = { single: describe(ents[0]) };
    else if (ents.length > 1) { const c = {}; ents.forEach((e) => { (c[e.kind] ||= { kind: e.kind, name: e.def.name, icon: e.def.icon, n: 0, ids: [] }).n++; c[e.kind].ids.push(e.id); }); selInfo = { group: Object.values(c), total: ents.length }; }
    const vill = S.units.filter((u) => !u.dead && u.owner === me && u.cls === "villager"); const idle = vill.filter((u) => u.order.type === "idle").length;
    const army = S.units.filter((u) => !u.dead && u.owner === me && u.cls !== "villager").length;
    const hasTemple = S.buildings.some((b) => !b.dead && b.done && b.owner === me && b.kind === "temple");
    const gatherers = { food: 0, wood: 0, gold: 0, stone: 0 }; vill.forEach((u) => { if (u.order.type === "gather" && u.carry.res) gatherers[u.carry.res]++; });
    const H = P0.hero; const hu = heroEnt(); const hd = H ? HEROES[H.id] : null;
    const heroState = H ? { id: H.id, name: hd.name, title: hd.title, icon: hd.icon, color: hd.color, level: H.level, maxLevel: MAX_LEVEL, xp: H.xp - XP_AT[H.level - 1], xpNext: H.level < MAX_LEVEL ? XP_AT[H.level] - XP_AT[H.level - 1] : 0, state: H.state, hp: hu ? Math.ceil(hu.hp) : 0, maxHp: hu ? hu.maxHp : 0, selected: !!hu && sel.includes(hu.id), carry: H.carry ? (RELICS[S.ents.get(H.carry).relic] || {}).name : "", reviveCost: costText(REVIVE_COST(H.level)), canRevive: H.state === "dead" && canAfford(P0.res, REVIVE_COST(H.level)),
      abilities: hd.abilities.map((k, slot) => { const A = ABILITIES[k]; const locked = slot === 1 && H.level < HERO_UNLOCK2; const cd = Math.max(0, H.readyAt[slot] - S.t); return { slot, key: k, name: A.name, icon: A.icon, desc: A.desc, locked, unlockLevel: HERO_UNLOCK2, cd, cdTotal: A.cd, ready: !locked && cd <= 0 && !!hu, target: A.target, active: !!abilityTarget && abilityTarget.slot === slot }; }) } : null;
    const enemyH = S.players[1].hero;
    const wonderMe = P0.wonder ? Math.max(0, Math.ceil(P0.wonder.until - S.t)) : 0, wonderEn = S.players[1].wonder ? Math.max(0, Math.ceil(S.players[1].wonder.until - S.t)) : 0;
    return {
      hero: heroState, godChoice: godChoice ? { age: godChoice.age, options: GOD_CHOICES[godChoice.age].map((k) => ({ key: k, ...GODS[k] })) } : null, gods: P0.gods.map((k) => ({ key: k, name: GODS[k].name, icon: GODS[k].icon })), relics: P0.relics.map((k) => ({ key: k, ...RELICS[k] })), wonderMe, wonderEn, targetingAbility: abilityTarget ? abilityTarget.key : null,
      enemyHero: enemyH ? { name: HEROES[S.players[1].heroId].name, icon: HEROES[S.players[1].heroId].icon, level: enemyH.level, state: enemyH.state } : null,
      fates: S.fates.view(), t: S.t, res: { ...P0.res }, pop: S.popOf(me), popCap: S.capOf(me), reserved: P0.reserved, age: P0.age, ageName: AGES[P0.age].name, ageBusy: P0.ageBusy, favor: Math.floor(P0.favor), hasTemple,
      powers: (HEROES[P0.heroId].powers).map((k) => ({ key: k, ...POWERS[k], cd: Math.max(0, P0.powerCd[k] - S.t), ready: hasTemple && P0.favor >= POWERS[k].favor && P0.powerCd[k] <= S.t })),
      sel: selInfo, cmds: commands(), idle, army, villagers: vill.length, placing: placing ? placing.kind : null, targeting, paused, speed, msgs: msgs.filter((m) => performance.now() - m.t < 6000),
      over: result, enemyAge: AGES[S.players[1].age].short, stats: { ...P0.stats }, difficulty, seed, gatherers, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    };
  }

  // ---- results ------------------------------------------------------------------------------------------------------
  function computeResult(winner, t) {
    const st = P0.stats; const won = winner === me;
    const base = won ? 3000 * diff.scoreMult + Math.max(0, 1800 - t) * 1.5 * diff.scoreMult : Math.min(t, 1200) * 0.6 * diff.scoreMult;
    const fin = S.fates.finish(winner, t);
    const score = Math.round(scnMult * (base + fin.stars * 150 + fin.objectives.filter((o) => o.kind === "fate" && o.done).length * 100) + st.kills * 10 + st.razed * 40 + st.gathered / 10 + (st.monsters || 0) * 15 + (st.relics || 0) * 150 + (st.shrines || 0) * 40 + (st.lairs || 0) * 80);
    return { won, reason: S.over ? S.over.reason || null : null, mode: fin.mode, mission: fin.mission, stars: fin.stars, objectives: fin.objectives, twist: fin.twist, scenarioName: (scenario && scenario.name) || "Skirmish", wonder: !!(S.over && S.over.wonder), hero: P0.heroId, heroLevel: P0.hero ? P0.hero.level : 1, time: t, score, stats: { ...st }, difficulty, enemy: S.players[1].stats };
  }

  // ---- the game loop -------------------------------------------------------------------------------------------------
  let acc = 0, last = 0, raf = 0, evAcc = [];
  function handleEvents(evs) {
    R.onEvents(evs, me);
    for (const e of evs) {
      switch (e.type) {
        case "trained": if (e.owner === me && e.kind !== "villager") { say(`${UNITS[e.kind].name} ready`, "good"); snd("trained"); } break;
        case "built": if (e.owner === me) { say(`${BUILDINGS[e.kind].name} complete`, "good"); snd("built"); } break;
        case "tech": if (e.owner === me) { say(`${TECHS[e.key].name} researched`, "good"); snd("trained"); } break;
        case "age": say(e.owner === me ? `You have entered the ${AGES[e.age].name}!` : `Sparta enters the ${AGES[e.age].name}`, e.owner === me ? "good" : "warn"); snd("age"); if (e.owner === me) mouseHint(); break;
        case "alert": say(e.text, "alert"); alertSpot = { x: e.x, z: e.z }; mmPings.push({ x: e.x, z: e.z, t: performance.now() }); snd("alert"); break;
        case "hit": if (visNear(e.x, e.z)) snd("hit"); break;
        case "shot": if (visNear(e.sx, e.sz)) snd("shot"); break;
        case "boom": if (visNear(e.x, e.z)) snd("boom"); break;
        case "bolt": snd("bolt"); break;
        case "collapse": if (visNear(e.x, e.z)) snd("boom"); break;
        case "depleted": { if (e.kind === "tree") { const g = tile.getContext("2d"); g.fillStyle = "rgb(104,150,66)"; g.fillRect(Math.floor(e.x), Math.floor(e.z), 1, 1); } break; }
        case "over": break;
        case "levelup": if (e.owner === me) { say(`${HEROES[P0.heroId].name} reached level ${e.level}!${e.level === HERO_UNLOCK2 ? " A second ability is unlocked." : ""}`, "good"); snd("levelup"); } break;
        case "heroDown": if (e.owner === me) { say(`${HEROES[P0.heroId].name} has fallen! Bring them back from a Temple or Town Center.`, "alert"); snd("alert"); alertSpot = { x: e.x, z: e.z }; } else say(`Enemy champion ${HEROES[S.players[1].heroId].name} has fallen!`, "good"); break;
        case "heroBack": if (e.owner === me) { say(`${HEROES[P0.heroId].name} returns to battle!`, "good"); snd("trained"); } break;
        case "ability": if (visNear(e.fx, e.fz) || visNear(e.x, e.z)) snd("ability"); break;
        case "quake": case "storm": snd("bolt"); break;
        case "farsight": if (e.owner === me) snd("heal"); break;
        case "discover": snd("find"); say(e.poi === "shrine" ? "You found an Oracle's Shrine! Walk your champion to it." : e.relic ? `You found a ${e.name} — it guards a relic!` : `You found a ${e.name}. Defeat its guards for a reward.`, "good"); break;
        case "shrine": if (e.owner === me) { say("The Oracle blesses you: +50 favor, experience, and the land around is revealed.", "good"); snd("heal"); } break;
        case "lairCleared": if (e.owner === me) { say(`Den cleared! ${Object.entries(e.loot).map(([k, v]) => `+${v} ${k}`).join(", ")}${e.relic ? " — a relic lies there, take it with your champion!" : ""}`, "good"); snd("trained"); } break;
        case "relicTake": if (e.owner === me) { say(`${RELICS[e.relic].name} taken! Carry it to your Temple.`, "good"); snd("find"); } break;
        case "relicDeliver": if (e.owner === me) { say(`${RELICS[e.relic].name} is yours: ${RELICS[e.relic].desc}`, "good"); snd("age"); } else say("The enemy has claimed a relic!", "warn"); break;
        case "relicDrop": if (e.owner === me || visNear(e.x, e.z)) say("A relic was dropped!", "warn"); break;
        case "warhorn": say("A war horn sounds in the distance… an attack is coming!", "alert"); snd("horn"); if (e.x != null) mmPings.push({ x: e.x, z: e.z, t: performance.now() }); break;
        case "wonderStart": say(e.owner === me ? `Your Wonder is complete! Hold it for ${Math.round(e.time / 60)} minutes to win!` : "THE ENEMY HAS COMPLETED A WONDER! Destroy it before the time runs out!", e.owner === me ? "good" : "alert"); snd(e.owner === me ? "age" : "alert"); if (e.owner !== me) alertSpot = { x: e.x, z: e.z }; break;
        case "objective": say(e.ok ? `✔ ${e.label}` : `✖ Missed: ${e.label}`, e.ok ? "good" : "warn"); snd(e.ok ? "find" : "error"); break;
        case "omen": say(`Omen: ${e.title}. Choose within 40 seconds.`, "good"); snd("horn"); break;
        case "omenResult": say(`${e.title}: ${e.text}`, e.good ? "good" : "warn"); snd(e.good ? "trained" : "error"); break;
        case "wonderTick": say(e.owner === me ? `Your Wonder stands — ${Math.floor(e.left / 60)}:${String(e.left % 60).padStart(2, "0")} to victory` : `Enemy Wonder: ${Math.floor(e.left / 60)}:${String(e.left % 60).padStart(2, "0")} left — destroy it!`, e.owner === me ? "info" : "alert"); break;
        default: break;
      }
    }
  }
  const mouseHint = () => {};
  const visNear = (x, z) => S.vis[Math.max(0, Math.min(N - 1, Math.floor(z))) * N + Math.max(0, Math.min(N - 1, Math.floor(x)))] === 2;
  function frame(now) {
    raf = requestAnimationFrame(frame); const dtr = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
    const w = R.el.clientWidth, h = R.el.clientHeight; if (w && (R.el.width !== Math.round(w * R.renderer.getPixelRatio()) || R.el.height !== Math.round(h * R.renderer.getPixelRatio()))) R.resize(w, h, Math.max(150, Math.min(230, h * 0.27)));
    if (playing && !paused && !result) {
      acc += dtr * speed; let n = 0; while (acc >= STEP && n < 6) { S.tick(STEP); acc -= STEP; n++; }
      if (n === 6) acc = 0; const evs = S.drain(); if (evs.length) handleEvents(evs);
      if (S.over && !result) { result = computeResult(S.over.winner, S.over.t); snd(result.won ? "win" : "lose"); dirty = true; cancelModes(); }
    } else if (!playing) { // menu: let the world breathe a little
      acc += dtr; let n = 0; while (acc >= STEP && n < 3) { S.tick(STEP); acc -= STEP; n++; } S.drain();
    }
    // camera
    if (playing && !result) {
      const sp = cam.dist * 0.95; let vx = 0, vz = 0; const rx = 0.7071, rz = 0.7071, fx = 0.7071, fz = -0.7071; // screen right, screen up (in world)
      const push = (sx, sy) => { vx += sx * rx + sy * fx; vz += sx * rz + sy * fz; };
      if (keys.has("ArrowLeft")) push(-1, 0); if (keys.has("ArrowRight")) push(1, 0); if (keys.has("ArrowUp")) push(0, 1); if (keys.has("ArrowDown")) push(0, -1);
      if (mouse.inside && !drag && !pan && mouse.w) { const m = 10; if (mouse.x < m) push(-1, 0); if (mouse.x > mouse.w - m) push(1, 0); if (mouse.y < m) push(0, 1); if (mouse.y > mouse.h - m) push(0, -1); }
      cam.tx += vx * sp * dtr; cam.tz += vz * sp * dtr;
    }
    cam.tx = Math.max(8, Math.min(N - 8, cam.tx)); cam.tz = Math.max(8, Math.min(N - 8, cam.tz));
    const k = 1 - Math.exp(-dtr * 12); cam.x += (cam.tx - cam.x) * k; cam.z += (cam.tz - cam.z) * k; cam.dist += (cam.td - cam.dist) * k;
    R.setView(cam.x, cam.z, cam.dist);
    hoverT -= dtr; if (hoverT <= 0) { hoverT = 0.06; hoverUpdate(); }
    if (placing && mouse.inside) { /* ghost already follows the mouse */ }
    if (sel.length === 1) { const e = get(sel[0]); if (e && e.type === "building" && e.owner === me && e.rally) R.setRally(e.rally); else R.setRally(null); } else R.setRally(null);
    R.sync(dtr, new Set(sel), me); R.render();
    uiT -= dtr; if (uiT <= 0 || dirty) { if (uiT <= 0) uiT = 0.125; dirty = false; onState && onState(buildState()); }
  }
  let hoverT = 0;

  function start() { playing = true; running = true; dirty = true; mouse.inside = false; }
  function surrender() { if (result) return; S.over = { winner: 1, t: S.t }; }
  function setSpeed(v) { speed = v; dirty = true; }
  function setPaused(p) { paused = p; dirty = true; }
  function dispose() {
    cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
    R.el.removeEventListener("pointerdown", onDown); R.el.removeEventListener("wheel", onWheel); R.el.removeEventListener("pointerleave", onLeave); R.el.removeEventListener("contextmenu", onCtx);
    if (boxEl.parentNode) boxEl.parentNode.removeChild(boxEl); R.dispose(); try { actx && actx.close(); } catch {}
  }
  raf = requestAnimationFrame((t) => { last = t; frame(t); });
  return {
    S, R, start, dispose, runCmd, beginPower, beginAbility, reviveHero, selectHero, chooseGod, cancelGod, cancelQueue, setSel, selectIdle, selectArmy, goHome, drawMinimap, minimapClick, surrender, setSpeed, setPaused, say, snd, centerOn,
    get result() { return result; }, buildState, cancelModes, commands,
    selectKind(kind) { const ids = S.units.filter((u) => !u.dead && u.owner === me && u.kind === kind && sel.includes(u.id)).map((u) => u.id); if (ids.length) setSel(ids); },
    forceState() { dirty = true; },
    answerOmen(i) { const r = S.cmdOmen(me, i); if (!r.ok) { say(r.reason || "Can't do that", "warn"); snd("error"); } else snd("click"); dirty = true; return r; },
  };
}
