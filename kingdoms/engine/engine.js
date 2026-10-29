// Ashtide — a calm town builder. Click the water to raise a house, click a house to build up
// or out, right-click to take one away. This file runs the scene, camera, mouse and scoring.
import * as THREE from "three";
import { createWorld } from "./world";
import { buildTown, PALETTE, BASE_COLOURS } from "./build";
import { loadProgress, saveProgress, levelOf, titleOf, unlocksAt, analyse, DISCOVERIES, makeWish, wishProgress, PROPS, propById, ISLANDS, EXTRA_COLOURS } from "./progress";
import { N, H, BASE, MAXK, S, hash, key, unkey, cellCorners, cellCenter, cellAt, inRadius } from "./grid";
import { isMuted } from "@/lib/sound";

const SAVE_KEY = "ashtide-town-v1";
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const GOALS = [
  { id: "g1", title: "Lay the first stones", hint: "Build 6 houses", need: (s) => [s.houses, 6] },
  { id: "g2", title: "A splash of colour", hint: "Use 4 different colours", need: (s) => [s.colors, 4] },
  { id: "g3", title: "Garden in the sky", hint: "Make a rooftop garden: build a tall house next to a lower one", need: (s) => [s.terraces, 1] },
  { id: "g4", title: "Reach for the sky", hint: "Stack a tower 4 floors high", need: (s) => [s.tallest, 4] },
  { id: "g5", title: "A bridge over the water", hint: "Build a house that hangs out over the water, touching another house", need: (s) => [s.bridges, 1] },
  { id: "g6", title: "A little harbour town", hint: "Build 25 houses", need: (s) => [s.houses, 25] },
  { id: "g7", title: "Rainbow quay", hint: "Use 7 different colours", need: (s) => [s.colors, 7] },
  { id: "g8", title: "Skyline", hint: "Stack a tower 6 floors high", need: (s) => [s.tallest, 6] },
  { id: "g9", title: "Grand harbour", hint: "Build 60 houses", need: (s) => [s.houses, 60] },
  { id: "g10", title: "Hanging gardens", hint: "Make 6 rooftop gardens", need: (s) => [s.terraces, 6] },
];
const GOAL_BONUS = 150;

export function createEngine({ mount, onState, onToast, interactive = true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const el = renderer.domElement; el.style.display = "block"; el.style.width = "100%"; el.style.height = "100%"; el.style.touchAction = "none";
  mount.appendChild(el);

  const world = createWorld(renderer);
  world.pick.material.side = THREE.DoubleSide;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1600);

  // ---- state -------------------------------------------------------------------------------
  let voxels = new Map();           // key -> { c }
  let history = [];
  let sel = -1;                     // -1 = pick colours automatically
  let counter = 0, bonus = 0;
  const goalsDone = new Set();
  let night = 0, nightTarget = 0;
  let stats = { houses: 0, colors: 0, terraces: 0, bridges: 0, tallest: 0, towers: 0 };
  let charm = 0;
  let playing = false;
  // ---- Upgrade 64: the long game (levels, wishes, discoveries, shells, decorations, islands) ----------------------------------------
  const P = loadProgress();
  let props = new Map();            // key(i,j,k) -> type   (k is the slot above the top house, or 0 for a boat on the water)
  let mode = "build", propSel = PROPS[0].id;
  let lastAnalysis = null; const events = [];
  const unlockedColours = () => BASE_COLOURS + EXTRA_COLOURS.filter((c) => c.lvl <= P.level).length;
  function gainXp(n, why) {
    const before = levelOf(P.xp).level; P.xp += Math.round(n); const after = levelOf(P.xp).level; P.level = after;
    if (after > before) { for (let L = before + 1; L <= after; L++) events.push({ type: "level", level: L, title: titleOf(L), unlocks: unlocksAt(L) }); world.fireworks(0, 6, 0, 5); sfxLevel(); }
    saveProgress(P);
  }

  // ---- camera ------------------------------------------------------------------------------
  const cam = { az: 0.75, el: 0.62, dist: 52, tx: 0, ty: 3, tz: 0, az2: 0.75, el2: 0.62, dist2: 52, tx2: 0, tz2: 0 };
  function applyCamera(dt) {
    const k = 1 - Math.pow(0.0008, dt);
    cam.az += (cam.az2 - cam.az) * k; cam.el += (cam.el2 - cam.el) * k; cam.dist += (cam.dist2 - cam.dist) * k; cam.tx += (cam.tx2 - cam.tx) * k; cam.tz += (cam.tz2 - cam.tz) * k;
    const ce = Math.cos(cam.el);
    camera.position.set(cam.tx + Math.sin(cam.az) * ce * cam.dist, cam.ty + Math.sin(cam.el) * cam.dist, cam.tz + Math.cos(cam.az) * ce * cam.dist);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }

  // ---- audio -------------------------------------------------------------------------------
  let actx = null, ambient = null;
  function audio() {
    if (actx) return actx;
    try { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } catch { actx = null; }
    if (actx && !ambient) startAmbient();
    return actx;
  }
  function startAmbient() {
    try {
      const len = actx.sampleRate * 3, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let n = 0; n < len; n++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.12; d[n] = last; }
      const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      const g = actx.createGain(); g.gain.value = 0.0;
      const lfo = actx.createOscillator(); lfo.frequency.value = 0.11; const lg = actx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(actx.destination); src.start(); lfo.start(); g.gain.value = 0.09; ambient = { g };
    } catch { ambient = null; }
  }
  function tone(freq, dur, type = "triangle", vol = 0.12, when = 0) {
    if (isMuted()) return; const a = audio(); if (!a) return;
    try {
      const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch {}
  }
  const sfxPlace = (k) => { const f = 262 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19][Math.min(k, 8)] / 12); tone(f * 0.5, 0.22, "sine", 0.18); tone(f, 0.16, "triangle", 0.1, 0.01); };
  const sfxRemove = () => { tone(196, 0.14, "triangle", 0.1); tone(147, 0.2, "sine", 0.1, 0.05); };
  const sfxGoal = () => [523, 659, 784, 1047].forEach((f, n) => tone(f, 0.45, "sine", 0.12, n * 0.1));
  const sfxBad = () => tone(130, 0.12, "square", 0.05);
  const sfxLevel = () => [392, 523, 659, 784, 1047, 1319].forEach((f, n) => tone(f, 0.6, "triangle", 0.11, n * 0.09));
  const sfxFind = () => [784, 988, 1175, 1568].forEach((f, n) => tone(f, 0.5, "sine", 0.1, n * 0.07));
  const sfxCoin = () => { tone(1319, 0.12, "square", 0.04); tone(1760, 0.18, "square", 0.04, 0.06); };

  // ---- town helpers ------------------------------------------------------------------------
  const has = (i, j, k) => voxels.has(key(i, j, k));
  const snapshot = () => [...voxels].map(([q, v]) => { const [i, j, k] = unkey(q); return [i, j, k, v.c]; });

  function canPlace(i, j, k) {
    if (!inRadius(i, j) || k < 0 || k >= MAXK || has(i, j, k) || props.has(key(i, j, k))) return false;
    if (k === 0) return true;
    if (has(i, j, k - 1)) return true;
    return DIRS4.some(([di, dj]) => has(i + di, j + dj, k));
  }
  function pickColour(i, j, k) {
    if (sel >= 0) return sel;
    const used = new Set();
    for (const [di, dj] of DIRS4) for (const kk of [k, k - 1]) { const v = voxels.get(key(i + di, j + dj, kk)); if (v) used.add(v.c); }
    const below = voxels.get(key(i, j, k - 1)); if (below) used.add(below.c);
    const NC = unlockedColours(); let c = Math.floor(hash(counter, i * 31 + j, 77) * NC);
    for (let t = 0; t < NC && used.has(c); t++) c = (c + 1) % NC;
    return c;
  }
  function prune() {
    const seen = new Set(), stack = [];
    for (const [q] of voxels) if (q % 16 === 0) { seen.add(q); stack.push(q); }
    while (stack.length) {
      const q = stack.pop(); const [i, j, k] = unkey(q);
      const nb = [[i, j, k + 1], [i, j, k - 1], ...DIRS4.map(([di, dj]) => [i + di, j + dj, k])];
      for (const [a, b, c] of nb) { if (c < 0 || c >= MAXK) continue; const kq = key(a, b, c); if (voxels.has(kq) && !seen.has(kq)) { seen.add(kq); stack.push(kq); } }
    }
    let removed = 0; for (const q of [...voxels.keys()]) if (!seen.has(q)) { voxels.delete(q); removed++; }
    dropLoose();
    return removed;
  }

  // decorations that lost the house under them go back to your shell purse
  function dropLoose() {
    for (const [q, t] of [...props]) { const [i, j, k] = unkey(q); const d = propById[t]; const ok = d && (d.where === "water" ? !has(i, j, 0) : has(i, j, k - 1) && !has(i, j, k)); if (!ok) { props.delete(q); P.shells += d ? d.cost : 0; } }
  }
  const propList = () => [...props].map(([q, type]) => { const [i, j, k] = unkey(q); return { i, j, k, type, seed: (i * 7 + j * 13) % 11 }; });
  function computeStats(built) {
    const cols = new Map(); let tallest = 0, towers = 0;
    for (const [q] of voxels) {
      const [i, j, k] = unkey(q); if (k !== 0) continue; let h = 1; while (has(i, j, h)) h++;
      cols.set(i * 64 + j, h); tallest = Math.max(tallest, h); if (h >= 3) towers += h - 2;
    }
    const b = built.stats;
    stats = { houses: b.houses, colors: b.colors.size, terraces: b.terraces, bridges: b.bridges, tallest, towers };
    charm = b.houses * 10 + b.colors.size * 20 + b.terraces * 30 + b.bridges * 35 + towers * 25 + bonus;
  }
  function checkGoals(silent) {
    for (const g of GOALS) {
      if (goalsDone.has(g.id)) continue; const [have, need] = g.need(stats);
      if (have >= need) { goalsDone.add(g.id); bonus += GOAL_BONUS; charm += GOAL_BONUS; if (!silent) { sfxGoal(); onToast && onToast(`✦ ${g.title} — +${GOAL_BONUS} charm · +100 XP`); gainXp(100); } }
    }
  }
  // wishes and discoveries (Upgrade 64)
  function fillWishes(a) {
    P.wishes = (P.wishes || []).filter((w) => w && w.kind);
    while (P.wishes.length < 3) { P.wishSeed = (P.wishSeed || 1) + 1; const pal = PALETTE.slice(0, unlockedColours()); const w = makeWish(P, a, pal, P.wishSeed); if (!P.wishes.some((x) => x.kind === w.kind && x.t === w.t && x.c === w.c)) P.wishes.push(w); }
  }
  function checkProgress(silent) {
    const a = analyse(voxels, props); a.terraces = stats.terraces; lastAnalysis = a;
    if (!playing) return;
    fillWishes(a);
    if (silent) return;
    for (let n = 0; n < P.wishes.length; n++) {
      const w = P.wishes[n]; const [have, need] = wishProgress(w, a);
      if (have >= need) { P.shells += w.shells; events.push({ type: "wish", wish: w }); onToast && onToast(`${w.icon} ${w.folk} is delighted! +${w.xp} XP · +${w.shells} 🐚`); sfxGoal(); sfxCoin(); P.wishes.splice(n, 1); n--; gainXp(w.xp); }
    }
    for (const d of DISCOVERIES) {
      if (P.found[d.id]) continue;
      let ok = false; try { ok = d.test(a, P); } catch {}
      if (ok) { P.found[d.id] = { at: Date.now(), island: P.island }; P.shells += 20; events.push({ type: "discovery", id: d.id, name: d.name, hint: d.hint }); sfxFind(); onToast && onToast(`📖 Discovery: ${d.name}! +150 XP · +20 🐚`); gainXp(150); }
    }
    fillWishes(a); saveProgress(P);
  }
  function summary() {
    return {
      houses: stats.houses, charm, colors: stats.colors, tallest: stats.tallest, terraces: stats.terraces, bridges: stats.bridges, night: nightTarget, sel, canUndo: history.length > 0,
      goals: GOALS.map((g) => { const [have, need] = g.need(stats); return { id: g.id, title: g.title, hint: g.hint, done: goalsDone.has(g.id), have: Math.min(have, need), need }; }), playing,
      // Upgrade 64
      prog: (() => { const lv = levelOf(P.xp); return { level: lv.level, into: lv.into, need: lv.need, title: titleOf(lv.level), shells: P.shells, colours: unlockedColours(), island: P.island }; })(),
      wishes: (P.wishes || []).map((w) => { const [have, need] = lastAnalysis ? wishProgress(w, lastAnalysis) : [0, 1]; return { id: w.id, folk: w.folk, icon: w.icon, role: w.role, text: w.text, xp: w.xp, shells: w.shells, have: Math.min(have, need), need }; }),
      found: DISCOVERIES.map((d) => ({ id: d.id, name: d.name, hint: d.hint, found: !!P.found[d.id] })),
      islands: ISLANDS.map((x) => ({ ...x, open: x.lvl <= P.level, here: x.id === P.island, houses: (P.towns[x.id] && P.towns[x.id].v ? P.towns[x.id].v.length : 0) })),
      mode, propSel, props: PROPS.map((d) => ({ ...d, open: d.lvl <= P.level, afford: P.shells >= d.cost })), canSkip: Date.now() - (P.skipAt || 0) > 90000,
      events: events.splice(0),
    };
  }
  function emit() { onState && onState(summary()); }

  let dirty = true, saveTimer = null;
  function rebuild(silentGoals) {
    const flatTops = new Set(); for (const [q, t] of props) { if (t === "boat") continue; const [i, j, k] = unkey(q); flatTops.add(key(i, j, k - 1)); }
    const built = buildTown(voxels, { flatTops }); world.setTown(built); world.setProps(propList()); computeStats(built); checkGoals(silentGoals); checkProgress(silentGoals); emit(); dirty = true; updateHover();
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 500);
  }
  function save() {
    if (!playing) return;
    P.towns[P.island] = { v: snapshot(), props: [...props], bonus, goals: [...goalsDone], counter, night: nightTarget, charm: Math.round(charm) };
    saveProgress(P);
    if (P.island === "harbour") try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: snapshot(), bonus, goals: [...goalsDone], counter, night: nightTarget })); } catch {}
  }
  function pushHistory() { history.push({ v: snapshot(), bonus, goals: [...goalsDone], props: [...props] }); if (history.length > 80) history.shift(); }

  function place(i, j, k, c, opts = {}) {
    if (!canPlace(i, j, k)) { if (!opts.quiet) sfxBad(); return false; }
    if (!opts.noHistory) pushHistory();
    counter++; voxels.set(key(i, j, k), { c: c ?? pickColour(i, j, k) });
    if (!opts.quiet && playing) { const mx = P.maxBlocks[P.island] || 0; if (voxels.size > mx) { P.maxBlocks[P.island] = voxels.size; gainXp(4); } } // XP for growing the town (rebuilding the same blocks again earns nothing)
    if (!opts.quiet) {
      const [cx, cz] = cellCenter(i, j); const y = BASE + k * H + H * 0.5;
      world.puff(cx, y, cz, new THREE.Color(PALETTE[voxels.get(key(i, j, k)).c % PALETTE.length].wall), 10, 3.2);
      if (k === 0) world.ring(cx, cz); sfxPlace(k);
    }
    if (!opts.deferRebuild) rebuild(opts.quiet);
    return true;
  }
  function remove(i, j, k) {
    if (!has(i, j, k)) return false; pushHistory();
    const [cx, cz] = cellCenter(i, j); const col = new THREE.Color(PALETTE[voxels.get(key(i, j, k)).c % PALETTE.length].wall);
    voxels.delete(key(i, j, k)); dropLoose(); const extra = prune();
    world.puff(cx, BASE + k * H + H * 0.5, cz, col, 12, 4); if (k === 0) world.ring(cx, cz); sfxRemove();
    if (extra > 0) onToast && onToast(`${extra} floating block${extra > 1 ? "s" : ""} crumbled into the sea`);
    rebuild(); return true;
  }
  function undo() {
    const h = history.pop(); if (!h) return;
    voxels = new Map(h.v.map(([i, j, k, c]) => [key(i, j, k), { c }])); bonus = h.bonus; goalsDone.clear(); h.goals.forEach((g) => goalsDone.add(g)); if (h.props) props = new Map(h.props);
    sfxRemove(); rebuild(true);
  }
  function load(list, extra) {
    voxels = new Map(list.map(([i, j, k, c]) => [key(i, j, k), { c }])); history = []; props = new Map((extra && extra.props) || []);
    bonus = extra?.bonus || 0; goalsDone.clear(); (extra?.goals || []).forEach((g) => goalsDone.add(g)); counter = extra?.counter || list.length;
    rebuild(true);
  }
  function clearAll() { pushHistory(); voxels = new Map(); props = new Map(); bonus = 0; goalsDone.clear(); rebuild(true); }

  // a pretty little starter town for the title screen and for testing
  function demoList(seed = 1, count = 46) {
    const m = new Set(), out = []; const cx = N / 2 - 1, cz = N / 2 - 1;
    const can = (i, j, k) => inRadius(i, j) && k < MAXK && !m.has(key(i, j, k)) && (k === 0 || m.has(key(i, j, k - 1)) || DIRS4.some(([a, b]) => m.has(key(i + a, j + b, k))));
    const add = (i, j, k) => { if (!can(i, j, k)) return false; m.add(key(i, j, k)); out.push([i, j, k, Math.floor(hash(i, j, seed + k * 3) * BASE_COLOURS)]); return true; };
    add(cx, cz, 0);
    for (let g = 1; out.length < count && g < 8000; g++) {
      const [i, j, k] = out[Math.floor(hash(g, seed, 5) * out.length)]; const r = hash(g, seed, 6);
      if (r < 0.3) { if (k < 3 || hash(g, 9, seed) < 0.08) add(i, j, k + 1); }
      else { const [di, dj] = DIRS4[Math.floor(hash(g, seed, 7) * 4)]; if (k === 0 || m.has(key(i + di, j + dj, k - 1)) || hash(g, 3, seed) < 0.12) add(i + di, j + dj, k); }
    }
    return out;
  }

  // ---- picking -----------------------------------------------------------------------------
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let mouse = { x: 0, y: 0, inside: false }; let shiftDown = false;
  let hoverBuild = null, hoverRemove = null;
  function pickAt() {
    ndc.set((mouse.x / el.clientWidth) * 2 - 1, -(mouse.y / el.clientHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    let build = null, rem = null;
    const info = world.pick.userData.info;
    if (info && info.length && world.pick.geometry.attributes.position) {
      const hits = ray.intersectObject(world.pick, false);
      if (hits.length) {
        const f = info[hits[0].faceIndex];
        if (f) {
          rem = [f.i, f.j, f.k];
          if (f.top) build = [f.i, f.j, f.k + 1]; else if (f.bottom) build = null; else build = [f.i + f.di, f.j + f.dj, f.k];
          return { build, rem };
        }
      }
    }
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(waterPlane, p)) { const c = cellAt(p.x, p.z); if (c && !has(c[0], c[1], 0)) build = [c[0], c[1], 0]; }
    return { build, rem };
  }
  // decorating (Upgrade 64): where would the selected decoration go?
  function decorTarget() {
    const { build, rem } = pickAt(); const d = propById[propSel]; if (!d) return null;
    const why = (ok, msg) => ({ ok, msg });
    if (rem) {
      let [i, j, k] = rem; while (has(i, j, k + 1)) k++; const kk = k + 1, slot = key(i, j, kk);
      if (props.has(slot)) return { i, j, k: kk, slot, exists: true };
      if (d.where !== "top") return { i, j, k: kk, slot, ...why(false, `${d.name}s go on the water next to the town`) };
      if (kk < (d.minH || 0)) return { i, j, k: kk, slot, ...why(false, `A ${d.name.toLowerCase()} needs a house at least ${d.minH} floors high`) };
      return { i, j, k: kk, slot, ...why(true) };
    }
    if (build && build[2] === 0) {
      const [i, j] = build, slot = key(i, j, 0);
      if (props.has(slot)) return { i, j, k: 0, slot, exists: true };
      if (d.where !== "water") return { i, j, k: 0, slot, ...why(false, `${d.name}s go on top of a house`) };
      const near = DIRS4.some(([di, dj]) => has(i + di, j + dj, 0));
      return { i, j, k: 0, slot, ...why(near && inRadius(i, j), "Boats moor right next to a house") };
    }
    return null;
  }
  function decorClick() {
    const t = decorTarget(); if (!t) { sfxBad(); return; } const d = propById[propSel];
    if (t.exists) { pushHistory(); const old = props.get(t.slot); props.delete(t.slot); P.shells += propById[old] ? propById[old].cost : 0; sfxRemove(); rebuild(); return; }
    if (d.lvl > P.level) { sfxBad(); onToast && onToast(`🔒 ${d.name} unlocks at level ${d.lvl}`); return; }
    if (!t.ok) { sfxBad(); onToast && onToast(t.msg); return; }
    if (P.shells < d.cost) { sfxBad(); onToast && onToast(`Not enough shells: ${d.name} costs ${d.cost} 🐚 (wishes and discoveries earn more)`); return; }
    pushHistory(); props.set(t.slot, propSel); P.shells -= d.cost; sfxCoin();
    const [cx, cz] = cellCenter(t.i, t.j); world.puff(cx, BASE + t.k * H + 0.6, cz, new THREE.Color(0xfff2c0), 12, 3); rebuild();
  }
  function updateHover() {
    if (!interactive || !mouse.inside || !playing) { world.hideGhost(); hoverBuild = hoverRemove = null; return; }
    if (mode === "decor") {
      const t = decorTarget(); if (!t) { world.hideGhost(); el.style.cursor = "grab"; return; }
      const d = propById[propSel]; const ok = t.exists || (t.ok && d.lvl <= P.level && P.shells >= d.cost);
      const y0 = t.k === 0 ? 0.05 : BASE + t.k * H; world.setGhost(cellCorners(t.i, t.j), y0, y0 + 1.1, t.exists ? 0xff9a7a : 0xfff2c0, ok); el.style.cursor = ok ? "pointer" : "not-allowed"; return;
    }
    const { build, rem } = pickAt(); hoverBuild = build; hoverRemove = rem;
    if (shiftDown && rem) { const [i, j, k] = rem; world.setGhost(cellCorners(i, j), BASE + k * H - 0.02, BASE + (k + 1) * H + 0.02, 0xff6666, false); el.style.cursor = "not-allowed"; return; }
    if (build) {
      const [i, j, k] = build; const ok = canPlace(i, j, k);
      const c = sel >= 0 ? sel : pickColour(i, j, k);
      world.setGhost(cellCorners(i, j), BASE + k * H, BASE + (k + 1) * H, PALETTE[c % PALETTE.length].wall, ok); el.style.cursor = ok ? "pointer" : "not-allowed";
    } else { world.hideGhost(); el.style.cursor = "grab"; }
  }

  // ---- input -------------------------------------------------------------------------------
  const drag = { on: false, btn: -1, sx: 0, sy: 0, lx: 0, ly: 0, moved: false };
  const keys = {};
  const onDown = (e) => {
    audio(); if (!interactive) return; el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    drag.on = true; drag.btn = e.button; drag.sx = drag.lx = e.clientX; drag.sy = drag.ly = e.clientY; drag.moved = false;
  };
  const onMove = (e) => {
    const r = el.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    if (drag.on) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
      if (drag.moved) {
        if (drag.btn === 0) { cam.az2 -= dx * 0.006; cam.el2 = Math.max(0.12, Math.min(1.45, cam.el2 + dy * 0.005)); }
        else { const sp = cam.dist2 * 0.0016; const rx = Math.cos(cam.az), rz = -Math.sin(cam.az), fx = -Math.sin(cam.az), fz = -Math.cos(cam.az); cam.tx2 += (-dx * rx + dy * fx) * sp; cam.tz2 += (-dx * rz + dy * fz) * sp; clampTarget(); }
        el.style.cursor = "grabbing"; world.hideGhost(); return;
      }
    }
    dirtyHover = true;
  };
  let dirtyHover = false;
  const onUp = (e) => {
    if (!drag.on) return; drag.on = false; el.releasePointerCapture?.(e.pointerId);
    if (drag.moved) { el.style.cursor = "grab"; return; }
    if (!playing) return;
    const { build, rem } = pickAt();
    if (mode === "decor" && e.button === 0 && !e.shiftKey) { decorClick(); return; }
    if (e.button === 0) { if (e.shiftKey && rem) remove(...rem); else if (build) place(build[0], build[1], build[2]); else sfxBad(); }
    else if (e.button === 2 && rem) remove(...rem);
  };
  const onLeave = () => { mouse.inside = false; world.hideGhost(); };
  const onWheel = (e) => { e.preventDefault(); cam.dist2 = Math.max(16, Math.min(110, cam.dist2 * Math.exp(e.deltaY * 0.0012))); };
  const onCtx = (e) => e.preventDefault();
  function clampTarget() { const m = 30; const r = Math.hypot(cam.tx2, cam.tz2); if (r > m) { cam.tx2 *= m / r; cam.tz2 *= m / r; } }
  const kd = (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase(); keys[k] = true; if (k === "shift") { shiftDown = true; dirtyHover = true; }
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); undo(); }
    else if (k === "n") toggleNight();
    else if (/^[0-9]$/.test(k)) { const n = k === "0" ? 9 : Number(k) - 1; setColour(n); }
    else if (k === "a" && e.altKey) setColour(-1);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  };
  const ku = (e) => { const k = e.key.toLowerCase(); keys[k] = false; if (k === "shift") { shiftDown = false; dirtyHover = true; } };
  const blur = () => { for (const k of Object.keys(keys)) keys[k] = false; shiftDown = false; };
  if (interactive) {
    el.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave); el.addEventListener("wheel", onWheel, { passive: false }); el.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);
  }

  function setMode(m) { mode = m === "decor" ? "decor" : "build"; emit(); dirtyHover = true; }
  function setProp(id) { if (!propById[id]) return; propSel = id; mode = "decor"; emit(); dirtyHover = true; }
  function skipWish(n) { if (Date.now() - (P.skipAt || 0) < 90000) return; P.skipAt = Date.now(); P.wishes.splice(n, 1); if (lastAnalysis) fillWishes(lastAnalysis); saveProgress(P); emit(); }
  function sailTo(id) {
    const isl = ISLANDS.find((x) => x.id === id); if (!isl || isl.lvl > P.level || id === P.island) return false;
    save(); P.island = id; saveProgress(P); world.setTheme(isl.theme);
    const t = P.towns[id]; if (t && t.v && t.v.length) { load(t.v, t); nightTarget = t.night ? 1 : 0; } else { history = []; voxels = new Map(); props = new Map(); bonus = 0; goalsDone.clear(); counter = 0; rebuild(true); }
    cam.az2 = 0.75; cam.el2 = 0.55; cam.dist2 = 34; cam.tx2 = cam.tz2 = 0; world.fireworks(0, 4, 0, 2); onToast && onToast(`⛵ Welcome to ${isl.name}`); emit(); return true;
  }
  function setColour(n) { if (n >= unlockedColours()) { sfxBad(); return; } sel = n < 0 ? -1 : Math.min(n, PALETTE.length - 1); mode = "build"; emit(); dirtyHover = true; }
  function toggleNight() { nightTarget = nightTarget > 0.5 ? 0 : 1; emit(); }

  // ---- loop --------------------------------------------------------------------------------
  let w = 1, h = 1;
  function resize() { w = mount.clientWidth || w; h = mount.clientHeight || h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(mount); window.addEventListener("resize", resize); resize();

  let raf = 0, last = performance.now(), running = true, idleSpin = true;
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) {
      const sp = cam.dist2 * 0.55 * dt, fx = -Math.sin(cam.az), fz = -Math.cos(cam.az), rx = Math.cos(cam.az), rz = -Math.sin(cam.az);
      let mx = 0, mz = 0; if (keys.w || keys.arrowup) { mx += fx; mz += fz; } if (keys.s || keys.arrowdown) { mx -= fx; mz -= fz; } if (keys.d || keys.arrowright) { mx += rx; mz += rz; } if (keys["a"] && !keys.control || keys.arrowleft) { mx -= rx; mz -= rz; }
      if (mx || mz) { cam.tx2 += mx * sp; cam.tz2 += mz * sp; clampTarget(); dirtyHover = true; }
      if (keys.q) cam.az2 += dt * 1.1; if (keys.e) cam.az2 -= dt * 1.1;
    } else if (idleSpin) cam.az2 += dt * 0.07, cam.az += dt * 0.07;
    if (Math.abs(night - nightTarget) > 0.001) { night += Math.sign(nightTarget - night) * Math.min(Math.abs(nightTarget - night), dt * 0.7); world.setNight(night); }
    applyCamera(dt); world.update(dt, camera.position);
    if (dirtyHover) { dirtyHover = false; updateHover(); }
    renderer.render(world.scene, camera);
  }
  raf = requestAnimationFrame(frame);

  // ---- public ------------------------------------------------------------------------------
  function photo() {
    world.hideGhost(); renderer.render(world.scene, camera);
    try { const a = document.createElement("a"); a.href = el.toDataURL("image/png"); a.download = "my-ashtide-town.png"; document.body.appendChild(a); a.click(); a.remove(); return true; } catch { return false; }
  }
  function themeHere() { const isl = ISLANDS.find((x) => x.id === P.island) || ISLANDS[0]; world.setTheme(isl.theme); }
  function startNew() { history = []; voxels = new Map(); props = new Map(); bonus = 0; goalsDone.clear(); counter = 0; playing = true; idleSpin = false; themeHere(); cam.az2 = 0.75; cam.el2 = 0.55; cam.dist2 = 30; cam.tx2 = cam.tz2 = 0; rebuild(true); }
  function townHere() {
    let t = P.towns[P.island];
    if ((!t || !t.v || !t.v.length) && P.island === "harbour") { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); if (d && d.v && d.v.length) { t = { ...d, props: [] }; P.towns.harbour = t; P.maxBlocks.harbour = Math.max(P.maxBlocks.harbour || 0, d.v.length); saveProgress(P); } } catch {} } // a town from before Upgrade 64
    return t && t.v && t.v.length ? t : null;
  }
  function startFromSave() {
    try {
      const d = townHere(); if (!d) return false; themeHere();
      playing = true; load(d.v, d); nightTarget = d.night ? 1 : 0; idleSpin = false; cam.el2 = 0.55; cam.dist2 = 36; cam.tx2 = cam.tz2 = 0; rebuild(true); emit(); return true;
    } catch { return false; }
  }
  function savedInfo() { const d = townHere(); const lv = levelOf(P.xp); const isl = ISLANDS.find((x) => x.id === P.island) || ISLANDS[0]; return d || P.xp > 0 ? { houses: d ? d.v.length : 0, level: lv.level, title: titleOf(lv.level), island: isl.name, found: Object.keys(P.found).length } : null; }
  function showDemo(seed = 7, count = 52) { playing = false; idleSpin = true; themeHere(); load(demoList(seed, count), {}); world.hideGhost(); }
  function pause(on) { playing = !on; if (on) world.hideGhost(); }
  function dispose() {
    running = false; cancelAnimationFrame(raf); clearTimeout(saveTimer); if (playing) save();
    window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); window.removeEventListener("resize", resize);
    if (ro) ro.disconnect(); world.dispose(); renderer.dispose(); try { mount.removeChild(el); } catch {}
    try { actx && actx.close(); } catch {}
  }

  return {
    startNew, startFromSave, savedInfo, showDemo, pause, dispose, place, remove, undo, clearAll, setColour, toggleNight, photo, summary, emit, save, canPlace, setMode, setProp, skipWish, sailTo, progress: () => P,
    debugProp(i, j, k, t) { props.set(key(i, j, k), t); rebuild(); }, // (tests)
    getScore: () => { let sum = Math.round(charm); for (const [id, t] of Object.entries(P.towns)) if (id !== P.island) sum += t.charm || 0; return sum + levelOf(P.xp).level * 100; }, get stats() { return stats; },
    setCamera(o) { Object.assign(cam, o); }, resize, world, camera, renderer, voxels: () => voxels,
    setNightNow(v) { nightTarget = v; night = v; world.setNight(v); },
  };
}
