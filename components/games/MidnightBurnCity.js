"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createCityWorld } from "@/lib/midnightBurn/open/world";
import { buildContent } from "@/lib/midnightBurn/open/content";
import { createGame, EMPTY_CAREER, MEDALS } from "@/lib/midnightBurn/open/sim";
import { createCityView } from "@/lib/midnightBurn/open/render";
import { buildBaseMap, drawMinimap, MAP_S, MAP_PX } from "@/lib/midnightBurn/open/maps";
import { districtAt } from "@/lib/midnightBurn/open/geo";
import { DT } from "@/lib/midnightBurn/open/drive";
import * as P from "@/lib/midnightBurn/physics";
import * as D from "@/lib/midnightBurn/drivers";
import { DEFAULT_SPEC, specOf } from "@/lib/midnightBurn/cars";
import { Showroom, CustomisePanel, pendingItems } from "./MidnightBurnGarage";
import { useStage, stageBoxStyle } from "./FullscreenStage";
import { sfx, isMuted, toggleMuted } from "@/lib/sound";
import { createCarAudio } from "@/lib/midnightBurn/engineAudio";

// MIDNIGHT BURN — MUMBAI UNDERGROUND. A free-roam night city built on Mumbai, Thane and Navi Mumbai: highways,
// flyovers, sea bridges, hills and docks, with street races, duels against ten named drivers, drift zones, speed
// traps, deliveries, hidden stashes, famous sights and four kinds of shop.
//
// lib/midnightBurn/open/*   — the city, the physics, the events and the 3D view (the game rules live in sim.js)
// this file                  — menus, HUD, map, shops and the game loop

const SAVE_KEYS = { now: "midnightburn.city.v2", "2046": "midnightburn.city2046.v1" };
let ERA = "now"; const saveKey = () => SAVE_KEYS[ERA];
const CUR = "₹";
const STARTERS = P.CARS.filter((c) => !c.locked);
const PAINTS = ["#2de2ff", "#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#f2f2f2"];
const TYPE_LABEL = { circuit: "Circuit", sprint: "Sprint", knockout: "Knockout", drag: "Drag race", duel: "Ladder duel", drift: "Drift zone", trap: "Speed trap", delivery: "Delivery" };
const TYPE_ICON = { circuit: "🏁", sprint: "🏁", knockout: "💀", drag: "⚡", duel: "👑", drift: "🌀", delivery: "📦", trap: "📷" };
const MEDAL_COL = { gold: "#ffd23a", silver: "#d6dbe6", bronze: "#d98a4a", none: "#667" };
const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const hexInt = (h) => parseInt(h.slice(1), 16);
const fmtTime = (t) => { const m = Math.floor(t / 60); const s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, "0")}`; };
const money = (n) => CUR + Math.round(n).toLocaleString();

const CACHES = {}; // the city takes a couple of seconds to build; keep each era for the next visit
function getCity() { if (!CACHES[ERA]) { const world = createCityWorld(7, ERA); CACHES[ERA] = { world, content: buildContent(world), base: null }; } return CACHES[ERA]; }

function loadSave() { try { const s = localStorage.getItem(saveKey()); return s ? JSON.parse(s) : null; } catch { return null; } }
function writeSave(c) { try { localStorage.setItem(saveKey(), JSON.stringify(c)); } catch {} }

function makeEngine() { try { return createCarAudio(isMuted); } catch { return null; } }

function Bar({ label, value, max = 1, color, right }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-mono text-textDim text-left">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden"><div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
      {right != null && <span className="w-12 text-right text-[10px] font-mono text-textLight">{right}</span>}
    </div>
  );
}
const Btn = ({ children, onClick, color = "#2de2ff", disabled, small, className = "" }) => (
  <button onClick={onClick} disabled={disabled} className={`font-pixel ${small ? "text-[9px] px-3 py-2" : "text-[11px] px-5 py-3"} rounded-md text-bgDeep disabled:opacity-35 disabled:cursor-not-allowed ${className}`} style={{ background: color }}>{children}</button>
);

function MidnightBurnCityInner({ onFinish, accentColor, onMood, onClassic, musicRef }) {
  const stage = useStage();
  const mountRef = useRef(null);
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu"); // menu | loading | play
  const [save, setSave] = useState(null);
  const [newCar, setNewCar] = useState("kestrel");
  const [newPaint, setNewPaint] = useState("#2de2ff");
  const [progress, setProgress] = useState(0);
  const [loadMsg, setLoadMsg] = useState("");
  const [hud, setHud] = useState(null);
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState("map");
  const [shop, setShop] = useState(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [camLabel, setCamLabel] = useState("CHASE");
  const [draft, setDraft] = useState(null);
  const [sel, setSel] = useState(null); // selected thing on the map
  const [evFilter, setEvFilter] = useState("all");
  const [tick, setTick] = useState(0);
  const keys = useRef({});
  const gref = useRef(null);
  const vref = useRef(null);
  const submitted = useRef(false);
  const accent = accentColor || "#ff2d95";
  const [era, setEraS] = useState("now");
  function pickEra(e) { ERA = e; setEraS(e); setSave(loadSave()); sfx.tap(); }

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setDeviceOk(!coarse && window.innerWidth >= 900); setMutedState(isMuted()); setSave(loadSave());
  }, []);
  useEffect(() => { if (typeof window !== "undefined" && window.__MB_TEST) window.__mbCity = { get G() { return gref.current; }, get view() { return vref.current; }, setPhase }; }, []);
  const speedBucket = hud ? Math.min(5, Math.floor(hud.kmh / 45)) : 0;
  useEffect(() => { if (!onMood) return; onMood(phase !== "playing" ? 0.2 : paused ? 0.25 : hud && hud.ev ? 1 : 0.4 + speedBucket * 0.1); }, [phase, paused, hud && !!hud.ev, speedBucket]); // eslint-disable-line
  useEffect(() => { musicRef && musicRef.current && musicRef.current.setNitro(!!(hud && hud.nos)); }, [hud && hud.nos]); // eslint-disable-line
  const [radioNote, setRadioNote] = useState(null);
  useEffect(() => { const m = musicRef && musicRef.current; if (!m) return undefined; let first = true; return m.onChange((s) => { if (first) { first = false; } setRadioNote({ name: s.name, tag: s.tag, t: Date.now() }); setTimeout(() => setRadioNote((r) => (r && Date.now() - r.t > 4500 ? null : r)), 4800); }); }, []); // eslint-disable-line

  // ---- start / continue -------------------------------------------------------------------------------------------------------------
  function begin(fresh) {
    sfx.click(); stage.enter(); setPhase("loading"); setProgress(0); setFailed(false); setLoadMsg("Building the city…");
    const s = fresh ? null : save;
    if (fresh) { const c = EMPTY_CAREER(); c.car = newCar; c.spec = { ...DEFAULT_SPEC, car: newCar, color: newPaint }; try { localStorage.removeItem(saveKey()); } catch {} setSave(null); window.__mbFresh = c; } else window.__mbFresh = null;
    submitted.current = false;
    setTimeout(() => { setPhase("play"); }, 60);
  }

  // ---- the game itself --------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if ((phase !== "play" && phase !== "playing") || !mountRef.current) return undefined;
    let alive = true, raf = 0, view = null, G = null, eng = null, ro = null;
    const mount = mountRef.current;
    (async () => {
      await new Promise((r) => setTimeout(r, 30));
      let city; try { city = getCity(); } catch (e) { console.error(e); setFailed(true); return; }
      if (!alive) return;
      if (!city.base) { setLoadMsg("Drawing the map…"); await new Promise((r) => setTimeout(r, 10)); city.base = buildBaseMap(city.world.city); }
      let career = window.__mbFresh || loadSave() || EMPTY_CAREER(); window.__mbFresh = null;
      if (!career.spec) career = { ...career, spec: { ...DEFAULT_SPEC, car: career.car, color: PAINTS[0] } };
      G = createGame(city.world, city.content, career, {
        seed: 1 + Math.floor(Math.random() * 999),
        hooks: { onSave: (c) => writeSave(c), onToast: (t, k) => { if (k === "good" || k === "level") sfx.correct(); else if (k === "warn") sfx.wrong(); else if (k === "go") sfx.click(); }, onPickup: () => sfx.correct() },
      });
      gref.current = G;
      try { view = createCityView(mount, G, { lite: false }); } catch (e) { console.error(e); setFailed(true); return; }
      vref.current = view;
      setLoadMsg("Loading the streets…");
      await view.preload((p) => alive && setProgress(Math.min(1, p)));
      if (!alive) return;
      ro = new ResizeObserver(() => view.resize()); ro.observe(mount);
      eng = makeEngine();
      setPhase("playing");
      let last = performance.now(), acc = 0, hudT = 0, lastDist = "", pauseLatch = false;
      let mini = null, mctx = null;
      const inputNow = () => {
        const k = keys.current; const up = k.w || k.ArrowUp, dn = k.s || k.ArrowDown, lf = k.a || k.ArrowLeft, rt = k.d || k.ArrowRight;
        return { throttle: up ? 1 : 0, brake: dn ? 1 : 0, steer: (rt ? 1 : 0) - (lf ? 1 : 0), hand: !!k[" "], nos: !!(k.Shift) };
      };
      const loop = (now) => {
        if (!alive) return; raf = requestAnimationFrame(loop);
        let dt = Math.min(0.1, (now - last) / 1000); last = now;
        const pausedNow = G.pause || G.state === "shop";
        let simSteps = 0;
        if (!G.pause) { acc += dt; while (acc >= DT && simSteps < 6) { G.step(inputNow(), DT); acc -= DT; simSteps++; } if (acc > DT * 6) acc = 0; }
        view.update(G.pause ? 0 : dt, simSteps ? DT : 0);
        const P1 = G.player;
        if (eng) { const run = G.run; eng.set({ rpm: P1.rpm, nos: P1.nos, thr: !!inputNow().throttle && !pausedNow, shifting: P1.shiftT > 0, squeal: pausedNow ? 0 : (P1.drifting ? Math.min(1, P1.slip * 2) : P1.braking && P1.speed > 25 ? 0.5 : 0), v: pausedNow ? 0 : P1.speed, rain: G.weather.rain, car: G.career.car, cam: vref.current ? vref.current.cam.mode : 0, hit: pausedNow ? 0 : P1.hit, nm: !!G.nmFlash, tunnel: !!(P1.surfRoad && P1.surfRoad.tunnel), wetRoad: G.weather.rain > 0.3 }); }
        if (!mini || !mini.isConnected) { mini = miniRef.current; mctx = mini ? mini.getContext("2d") : null; }
        if (mctx && !G.pause) drawMinimap(mctx, mini.width, city.base, G);
        hudT -= dt;
        if (hudT <= 0 || G.state !== "roam") {
          hudT = 0.1;
          const dd = districtAt(P1.x, P1.z); const dname = dd ? dd.name : "Open road";
          const run = G.run; let ev = null;
          if (run) {
            const E = run.ev; ev = { id: E.id, name: E.name, type: E.type, state: run.state, cd: Math.ceil(run.cd || 0), t: run.t };
            if (run.route && run.kind !== "drift" && run.kind !== "delivery") {
              const all = [{ me: true, s: 0 }, ...run.racers.map((r) => ({ r, s: 0 }))];
              const gl = run.route.gates.length; const myProg = run.gate + Math.max(0, 1 - Math.hypot(run.route.pts[run.route.gates[Math.min(gl - 1, run.gate)]].x - P1.x, run.route.pts[run.route.gates[Math.min(gl - 1, run.gate)]].z - P1.z) / 340);
              let pos = 1; for (const r of run.racers) { if (r.out) continue; const g = r.finished ? gl + 1 : (() => { let q = 0; while (q < gl && run.route.gates[q] <= r.drv.pi) q++; return q + Math.max(0, 1 - Math.abs(run.route.pts[run.route.gates[Math.min(gl - 1, q)]].s - run.route.pts[Math.min(run.route.pts.length - 1, r.drv.pi)].s) / 340); })(); if (run.pFinished ? (r.finished && r.finT < run.pFinT) : g > myProg) pos++; }
              ev.pos = run.pFinished ? run.finishOrder.indexOf("p") + 1 : pos; ev.n = run.racers.filter((r) => !r.out).length + 1; ev.lap = run.lap; ev.laps = run.laps; ev.gate = Math.min(run.gate, gl); ev.gates = gl; ev.elim = run.elimT > 0 ? run.elimT : 0;
              const rival = run.racers.find((r) => !r.out); if (rival && run.ev.type === "duel") { ev.vs = rival.name; ev.gap = Math.round((run.route.pts[Math.min(run.route.pts.length - 1, rival.drv.pi)].s - run.route.pts[run.route.gates[Math.min(gl - 1, Math.max(0, run.gate - 1))]].s) * 0) + 0; ev.gapM = Math.round(((() => { let sP = 0; const gp = run.route.pts[run.route.gates[Math.min(gl - 1, run.gate)]]; sP = gp.s - Math.hypot(gp.x - P1.x, gp.z - P1.z); return sP; })()) - run.route.pts[Math.min(run.route.pts.length - 1, rival.drv.pi)].s); }
            }
            if (run.kind === "drift") { ev.score = Math.round(run.score); ev.bank = Math.round(run.bank); ev.chain = run.chain; ev.left = run.timeLeft; ev.inside = !!run.inside; ev.goals = E.goals; }
            if (run.kind === "delivery") { ev.left = run.timeLeft; ev.cargo = Math.round(run.cargo); }
          }
          const near = G.near, sn = G.shopNear;
          const nav = G.nav && G.nav.target ? Math.round(Math.hypot(G.nav.target.x - P1.x, G.nav.target.z - P1.z)) : null;
          setHud({
            kmh: Math.round(P1.speed * 3.6), gear: P1.fwd < -0.5 ? "R" : P1.gear, rpm: P1.rpm, nitro: P1.nitro, nos: P1.nos, drift: Math.round(G.roamDrift || 0), driftOn: P1.drifting,
            cash: G.career.cash, xp: G.career.xp, level: G.level(), score: G.score(), district: dname, wet: G.weather.rain, state: G.state, ev, result: G.result, toasts: G.toasts.map((t) => ({ ...t })),
            near: near ? { id: near.id, name: near.name, type: near.type, locked: !G.isUnlocked(near), why: G.lockReason(near) } : null, shopNear: sn ? { id: sn.id, name: sn.name } : null, nav,
            flash: G.flash ? G.flash.text : null, nm: !!G.nmFlash, stash: G.career.stash.length, stashTotal: G.content.stashes.length, sights: G.career.sights.length, sightsTotal: G.content.sights.length,
            hit: G.cam.hit > 6,
          });
        }
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (eng) eng.stop(); if (view) view.dispose(); if (G) { G.career.pos = { x: G.player.x, z: G.player.z, yaw: G.player.yaw }; writeSave(G.career); setSave(G.career); } gref.current = null; vref.current = null; };
  }, [phase === "play" || phase === "playing"]); // eslint-disable-line

  // ---- keys ----------------------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    const kn = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    function down(e) {
      const k = kn(e); const G = gref.current;
      if (G && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Tab"].includes(k)) e.preventDefault();
      if (!e.repeat) keys.current[k === "Shift" ? "Shift" : k] = true; if (e.key === "Shift") keys.current.Shift = true;
      if (!G) return;
      if (k === "p" || k === "Escape") { if (G.state === "shop") closeShop(); else if (G.state !== "result") togglePause(); }
      if (k === "m") { if (!G.pause) { setTab("map"); togglePause(true); } else if (tabRef.current === "map") togglePause(false); else setTab("map"); }
      if (k === "Enter") { if (G.pause || G.state === "result") { if (G.state === "result") closeResult(); return; } if (G.state === "roam") { if (G.shopNear) openShop(); else if (G.near) G.startNear(); } }
      if (k === "c") { const v = vref.current; if (v) { v.cam.mode = (v.cam.mode + 1) % 4; v.setCameraMode(v.cam.mode); setCamLabel(["CHASE", "FAR", "HOOD", "COCKPIT"][v.cam.mode]); } }
      if (k === "r" && !G.pause && G.state !== "result") G.reset();
      if (k === "f") stage.toggle();
      if (k === "f") { stage.toggle(); }
      if (k === "n") { musicRef && musicRef.current && musicRef.current.next(); }
      if (k === "x" && G.run && G.state === "event") { G.abortEvent(); }
      if (k === "g" && !G.pause && G.near) { G.setWaypoint(G.near.sx, G.near.sz, G.near.name); }
      if (k === "t" && !G.pause) { G.clearWaypoint(); }
    }
    function up(e) { const k = kn(e); keys.current[k] = false; if (e.key === "Shift") keys.current.Shift = false; }
    function blur() { keys.current = {}; const G = gref.current; if (G && G.state !== "result" && G.state !== "shop" && !G.pause) togglePause(true); }
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }); // eslint-disable-line
  const tabRef = useRef(tab); tabRef.current = tab;
  const wasFull = useRef(false); const reenter = useRef(false);
  useEffect(() => { // Esc leaves fullscreen without telling the page about the key, so leaving fullscreen pauses the game
    if (wasFull.current && !stage.isFull) { reenter.current = true; const G = gref.current; if (G && G.state !== "result" && G.state !== "shop" && !G.pause) togglePause(true); }
    wasFull.current = stage.isFull;
  }, [stage.isFull]); // eslint-disable-line
  useEffect(() => { const vis = () => { const G = gref.current; if (document.hidden && G && G.state !== "result" && G.state !== "shop" && !G.pause) togglePause(true); }; document.addEventListener("visibilitychange", vis); return () => document.removeEventListener("visibilitychange", vis); }, []); // eslint-disable-line

  function togglePause(v) { const G = gref.current; if (!G) return; G.pause = v === undefined ? !G.pause : v; if (!G.pause && reenter.current) { reenter.current = false; try { stage.enter(); } catch {} } if (G.pause && stage.isFull) reenter.current = false; keys.current = {}; setPaused(G.pause); setSel(null); if (G.pause) sfx.tap(); }
  function closeResult() { const G = gref.current; if (G && G.state === "result") { sfx.click(); G.closeResult(); } }
  function openShop() { const G = gref.current; const s = G && G.shopOpen(); if (s) { sfx.select && sfx.select(); setShop(s); setDraft(null); setTick((t) => t + 1); keys.current = {}; } }
  function closeShop() { const G = gref.current; if (!G) return; G.shopClose(); setShop(null); setDraft(null); vref.current && vref.current.refreshPlayer(); }
  function quit(submit) {
    const G = gref.current; const score = G ? G.score() : 0; if (G) writeSave(G.career);
    stage.exit(); setPhase("menu"); setPaused(false); setHud(null); setShop(null); setSave(loadSave());
    if (submit && !submitted.current) { submitted.current = true; onFinish(Math.max(0, Math.round(score))); }
  }

  if (deviceOk === null) return null;
  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">🏎️</p><p className="font-pixel text-xs text-accentAmber mb-3">KEYBOARD AND LARGE SCREEN REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Midnight Burn is a full 3D open-world street racer played with the keyboard. Please open it on a laptop or desktop.</p>
      </div>
    );
  }

  // =============================== MENU ====================================================================================================
  if (phase === "menu") {
    const lvl = save ? D.levelOf(save.xp) : 1;
    const doneN = save ? Object.keys(save.done || {}).length : 0;
    const spec = specOf({ ...DEFAULT_SPEC, car: newCar, color: newPaint });
    return (
      <div className="text-center">
        <p className="font-pixel text-base mb-1" style={{ color: accent }}>MIDNIGHT BURN</p>
        <p className="font-pixel text-[10px] text-accentCyan mb-3">MUMBAI UNDERGROUND</p>
        <p className="font-mono text-[11px] text-textDim mb-1 max-w-2xl mx-auto">
          One huge night city, free to roam: South Mumbai, the Sea Link, Bandra Kurla, Dharavi, Powai, Thane, Navi Mumbai, the JNPT docks and the Sahyadri ghats.
          Find the races, beat the ten names on the Underground Ladder, drift, hit the speed cameras, run deliveries, and build your dream car.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-4">{"56 events · 18 famous sights · 90 cash stashes · 6 shops · day-and-night rain"}</p>
        {save && (
          <div className="max-w-xl mx-auto mb-5 rounded-xl border border-lineColor bg-bgPanel p-4 text-left">
            <p className="font-pixel text-[9px] text-accentAmber mb-2">YOUR CAREER</p>
            <div className="grid grid-cols-4 gap-2 font-mono text-[10px] text-textDim text-center">
              <div><p className="text-textLight text-sm">{lvl}</p>LEVEL</div>
              <div><p className="text-textLight text-sm">{money(save.cash)}</p>CASH</div>
              <div><p className="text-textLight text-sm">{doneN}</p>EVENTS</div>
              <div><p className="text-textLight text-sm">{(save.sights || []).length}/18</p>SIGHTS</div>
            </div>
            <div className="flex gap-3 justify-center mt-4">
              <Btn onClick={() => begin(false)} color={accent}>CONTINUE ▸</Btn>
              <Btn small color="#9fd4ff" onClick={() => { if (!submitted.current) { submitted.current = true; let s = 0; for (const d of Object.values(save.done || {})) s += d.pts || 0; s += (save.stash || []).length * 30 + (save.sights || []).length * 120 + Math.floor((save.odo || 0) / 1000) * 5 + Math.floor(save.nearMiss || 0) * 4; onFinish(Math.round(s)); } }}>SUBMIT CAREER SCORE</Btn>
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-center mb-4 flex-wrap max-w-3xl mx-auto">
          {[["now", "MUMBAI · TODAY", "The city as it is: Sea Link, Atal Setu, Marine Drive, Dharavi, BKC."], ["2046", "MUMBAI · 2046", "20 years on: wider smart roads, six metro lines on glowing viaducts, the Goregaon–Mulund twin tunnels under the national park, the coastal road, a taller glass skyline."]].map(([k, t, d]) => (
            <button key={k} onClick={() => pickEra(k)} className="rounded-xl border p-3 text-left flex-1 min-w-[240px] hover:bg-bgPanel3" style={{ borderColor: era === k ? accent : "#2a2a44", background: era === k ? "rgba(255,255,255,0.05)" : undefined }}>
              <p className="font-pixel text-[10px] mb-1" style={{ color: era === k ? accent : "#cfd2ff" }}>{t}</p><p className="text-[11px] text-textDim">{d}</p>
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-textDim mb-2">{save ? "OR START A NEW CAREER" : "PICK YOUR STARTER"}</p>
        <Showroom spec={spec} height={220} className="max-w-2xl mx-auto mb-3" />
        <div className="grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-3">
          {STARTERS.map((c) => {
            const s = P.makeStats(c); return (
              <button key={c.id} onClick={() => { setNewCar(c.id); sfx.tap(); }} className="rounded-xl border p-3 text-left hover:bg-bgPanel3" style={{ borderColor: newCar === c.id ? newPaint : "#2a2a44", background: newCar === c.id ? "rgba(255,255,255,0.04)" : undefined }}>
                <p className="font-pixel text-[10px] mb-1" style={{ color: newCar === c.id ? newPaint : "#cfd2ff" }}>{c.name.toUpperCase()}</p>
                <p className="text-[11px] text-textDim mb-2">{c.blurb}</p>
                <div className="flex flex-col gap-1"><Bar label="SPEED" value={s.vmax / 62} max={1.5} color={newPaint} /><Bar label="ACCEL" value={s.accel / 26} max={1.5} color={newPaint} /><Bar label="HANDLE" value={(s.yaw * s.grip) / (2.5 * 5.2)} max={1.5} color={newPaint} /></div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-center gap-2 mb-4">{PAINTS.map((c) => <button key={c} onClick={() => { setNewPaint(c); sfx.tap(); }} aria-label={`Paint ${c}`} className="w-7 h-7 rounded-full border-2" style={{ background: c, borderColor: newPaint === c ? "#fff" : "transparent" }} />)}</div>
        <div className="flex gap-3 justify-center flex-wrap mb-5">
          <Btn onClick={() => { if (!save || window.confirm("Start a new career? Your saved career will be replaced.")) begin(true); }} color={save ? "#667" : accent}>{save ? "NEW CAREER" : "START ▸"}</Btn>
          {onClassic && <Btn small color="#b45cff" onClick={onClassic}>CLASSIC CIRCUITS (6 TRACK MODE)</Btn>}
        </div>
        <div className="max-w-xl mx-auto text-left rounded-lg border border-lineColor bg-bgPanel p-4">
          <p className="font-pixel text-[9px] text-accentCyan mb-2">CONTROLS</p>
          <ul className="font-mono text-[11px] text-textDim space-y-1">
            <li><span className="text-textLight">W S / ↑ ↓</span> gas and brake (hold S to reverse) &nbsp; <span className="text-textLight">A D / ← →</span> steer</li>
            <li><span className="text-textLight">SPACE</span> handbrake — hold it through a bend to drift &nbsp; <span className="text-textLight">SHIFT</span> nitrous</li>
            <li><span className="text-textLight">ENTER</span> start the event or shop you're parked at &nbsp; <span className="text-textLight">G</span> set GPS to it &nbsp; <span className="text-textLight">T</span> clear GPS</li>
            <li><span className="text-textLight">N</span> next radio station &nbsp; <span className="text-textLight">M</span> map &amp; events &nbsp; <span className="text-textLight">P / ESC</span> pause &nbsp; <span className="text-textLight">R</span> reset car on the road &nbsp; <span className="text-textLight">C</span> camera &nbsp; <span className="text-textLight">X</span> abandon event &nbsp; <span className="text-textLight">F</span> fullscreen</li>
            <li className="text-textDim/80">Drifting and near-misses with traffic fill your nitrous. Drive left, like in India.</li>
          </ul>
        </div>
      </div>
    );
  }

  // =============================== LOADING / PLAYING ======================================================================================
  const G = gref.current;
  const playing = phase === "playing";
  const frame = (
    <div className="bg-black overflow-hidden border border-lineColor" style={stageBoxStyle(stage.isFull, { borderRadius: stage.isFull ? 0 : 12 })}>
      <div ref={mountRef} className="absolute inset-0" />
      {(phase === "loading" || phase === "play") && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: "rgba(0,0,0,0.92)" }}>
          <p className="font-pixel text-sm mb-2" style={{ color: accent }}>MIDNIGHT BURN</p>
          <p className="font-mono text-[11px] text-textDim mb-3">{loadMsg}</p>
          <div className="w-64 h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden"><div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: accent }} /></div>
        </div>
      )}
      {failed && <div className="absolute inset-0 flex items-center justify-center text-center p-6 bg-black"><div><p className="font-mono text-xs text-accentMagenta mb-4">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration on.</p><Btn small onClick={() => quit(false)}>BACK</Btn></div></div>}
      {playing && radioNote && !shop && <div className="absolute pointer-events-none text-center" style={{ left: 0, right: 0, bottom: 150, textShadow: "0 0 8px #000" }}><p className="font-pixel text-[10px]" style={{ color: accent }}>♪ {radioNote.name}</p><p className="font-mono text-[10px] text-white/70">{radioNote.tag}</p></div>}
      {playing && hud && !shop && <Hud hud={hud} accent={accent} miniRef={miniRef} camLabel={camLabel} muted={muted} G={G} onPause={() => togglePause(true)} paused={paused} />}
      {playing && hud && hud.result && <ResultCard res={hud.result} accent={accent} onClose={closeResult} />}
      {playing && shop && G && <ShopPanel key={tick} G={G} shop={shop} draft={draft} setDraft={setDraft} onClose={closeShop} accent={accent} refresh={() => { setTick((t) => t + 1); vref.current && vref.current.refreshPlayer(); }} onQuit={() => quit(true)} />}
      {playing && paused && G && <PausePanel G={G} tab={tab} setTab={setTab} sel={sel} setSel={setSel} evFilter={evFilter} setEvFilter={setEvFilter} accent={accent} onResume={() => togglePause(false)} onQuit={quit} muted={muted} onMute={() => setMutedState(toggleMuted())} />}
    </div>
  );
  return <div>{frame}</div>;
}

// =============================== HUD ======================================================================================================
function Hud({ hud, accent, miniRef, camLabel, G, onPause, paused }) {
  const stage = useStage();
  const lp = D.levelProgress(hud.xp); const ev = hud.ev;
  const rpmCol = hud.rpm > 0.92 ? "#ff3b3b" : "#ffffff";
  return (
    <div className="absolute inset-0 pointer-events-none select-none font-mono text-white" style={{ textShadow: "0 0 8px rgba(0,0,0,0.95)" }}>
      {/* top left: who you are */}
      <div className="absolute top-3 left-4 w-52">
        <div className="flex items-center gap-2"><span className="font-pixel text-lg" style={{ color: accent }}>{lp.level}</span>
          <div className="flex-1"><div className="h-1.5 rounded-full bg-black/60 overflow-hidden border border-white/20"><div className="h-full" style={{ width: `${Math.round(lp.frac * 100)}%`, background: accent }} /></div><p className="text-[9px] text-white/60 mt-0.5">LEVEL · {lp.need ? `${lp.into}/${lp.need} XP` : "MAX"}</p></div></div>
        <p className="text-sm mt-1">{money(hud.cash)}</p>
        <p className="text-[10px] text-white/60">SCORE {hud.score.toLocaleString()}</p>
      </div>
      {/* pause button — always clickable, same as P / Esc */}
      <button onClick={() => stage.toggle()} aria-label="Fullscreen" className="pointer-events-auto absolute font-pixel text-[9px] rounded-md px-2.5 py-1.5" style={{ top: 12, left: 352, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", textShadow: "none" }}>{stage.isFull ? "⛶ EXIT FULL (F)" : "⛶ FULLSCREEN (F)"}</button>
      <button onClick={onPause} aria-label="Pause" className="pointer-events-auto absolute font-pixel text-[9px] rounded-md px-2.5 py-1.5" style={{ top: 12, left: 232, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", textShadow: "none" }}>❚❚ PAUSE (P)</button>
      {/* top right: place and weather */}
      <div className="absolute top-3 right-4 text-right">
        <p className="text-sm tracking-wide">{hud.district.toUpperCase()}</p>
        <p className="text-[10px] text-white/60">{hud.wet > 0.3 ? "RAIN" : "CLEAR NIGHT"} · CAM {camLabel} (C)</p>
        <p className="text-[10px] text-white/45">💰 {hud.stash}/{hud.stashTotal} · 🏛 {hud.sights}/{hud.sightsTotal}</p>
      </div>
      {/* event panel */}
      {ev && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center">
          <p className="font-pixel text-[10px] text-accentCyan">{ev.name.toUpperCase()}</p>
          {ev.pos != null && <p className="font-pixel text-2xl" style={{ color: accent }}>{ORD[ev.pos - 1]}<span className="text-xs text-white/70"> /{ev.n}</span></p>}
          {ev.laps > 1 && <p className="text-[11px] text-white/80">LAP {ev.lap}/{ev.laps}</p>}
          {ev.gates != null && <p className="text-[10px] text-white/60">CHECKPOINT {ev.gate}/{ev.gates}</p>}
          {ev.state === "go" && <p className="text-lg">{fmtTime(ev.t)}</p>}
          {ev.vs && <p className="text-[11px]" style={{ color: ev.gapM >= 0 ? "#6bff6b" : "#ff6b6b" }}>VS {ev.vs.toUpperCase()} · {ev.gapM >= 0 ? "+" : ""}{ev.gapM} m</p>}
          {ev.elim > 0 && <p className="font-pixel text-[11px] text-accentMagenta animate-pulse">ELIMINATION IN {Math.ceil(ev.elim)}</p>}
          {ev.score != null && (<><p className="font-pixel text-xl" style={{ color: "#ff8a2d" }}>{ev.score.toLocaleString()}</p><p className="text-[11px] text-white/80">{ev.left.toFixed(0)}s · {ev.inside ? "IN THE ZONE" : "RETURN TO THE RING"}</p>{ev.bank > 0 && <p className="text-[12px]" style={{ color: "#ffd23a" }}>+{ev.bank.toLocaleString()} ×{(1 + Math.min(4, ev.chain * 0.45)).toFixed(1)}</p>}<p className="text-[9px] text-white/50">BRONZE {ev.goals[0].toLocaleString()} · SILVER {ev.goals[1].toLocaleString()} · GOLD {ev.goals[2].toLocaleString()}</p></>)}
          {ev.cargo != null && (<><p className="text-lg">{Math.max(0, ev.left).toFixed(0)}s</p><p className="text-[11px]" style={{ color: ev.cargo > 60 ? "#6bff6b" : "#ff6b6b" }}>CARGO {ev.cargo}%</p></>)}
          <p className="text-[9px] text-white/40 mt-0.5">X abandon</p>
        </div>
      )}
      {/* countdown */}
      {ev && ev.state === "countdown" && <div className="absolute inset-0 flex items-center justify-center"><p className="font-pixel text-7xl" style={{ color: accent, textShadow: "0 0 30px " + accent }}>{Math.max(1, Math.min(3, ev.cd))}</p></div>}
      {/* toasts */}
      <div className="absolute flex flex-col items-center gap-1" style={{ top: 150, left: "20%", width: "60%" }}>
        {hud.toasts.slice(-4).map((t) => (
          <div key={t.id} className="px-3 py-1 rounded font-pixel text-[10px]" style={{ background: "rgba(0,0,0,0.55)", color: t.kind === "warn" ? "#ff6b6b" : t.kind === "good" ? "#6bff9a" : t.kind === "level" ? "#ffd23a" : t.kind === "go" ? "#2de2ff" : "#fff", opacity: Math.min(1, t.ttl) }}>{t.text}</div>
        ))}
      </div>
      {hud.flash && <div className="absolute top-1/3 left-1/2 -translate-x-1/2"><p className="font-pixel text-3xl" style={{ color: "#ff4d4d", textShadow: "0 0 20px #ff4d4d" }}>{hud.flash}</p></div>}
      {hud.nm && <div className="absolute top-[42%] left-1/2 -translate-x-1/2"><p className="font-pixel text-sm text-accentCyan">NEAR MISS +NITRO</p></div>}
      {hud.drift > 80 && !ev && <div className="absolute top-[46%] left-1/2 -translate-x-1/2"><p className="font-pixel text-lg" style={{ color: "#ff8a2d" }}>DRIFT {hud.drift.toLocaleString()}</p></div>}
      {/* prompts */}
      {!ev && hud.state === "roam" && (hud.shopNear || hud.near) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center rounded-lg px-4 py-2" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.25)" }}>
          {hud.shopNear ? (<><p className="font-pixel text-[11px] text-accentAmber">{hud.shopNear.name.toUpperCase()}</p><p className="text-[10px] text-white/80">ENTER — go inside</p></>) : (<><p className="font-pixel text-[11px]" style={{ color: hud.near.locked ? "#ff6b6b" : "#2de2ff" }}>{TYPE_ICON[hud.near.type]} {hud.near.name.toUpperCase()}</p><p className="text-[10px] text-white/80">{hud.near.locked ? hud.near.why.toUpperCase() : "ENTER — start · G — set GPS"}</p></>)}
        </div>
      )}
      {/* minimap */}
      <div className="absolute bottom-3 left-4">
        <canvas ref={miniRef} width={200} height={200} style={{ width: 168, height: 168, borderRadius: "50%", background: "rgba(0,0,0,0.5)" }} />
        {hud.nav != null && <p className="text-[10px] text-center text-accentCyan mt-1">GPS · {hud.nav >= 1000 ? (hud.nav / 1000).toFixed(1) + " km" : hud.nav + " m"}</p>}
      </div>
      {/* speedo */}
      <div className="absolute bottom-3 right-4 text-right w-56">
        <p className="font-pixel text-4xl leading-none" style={{ color: rpmCol }}>{hud.kmh}<span className="text-[10px] text-white/60"> KM/H</span></p>
        <p className="text-sm mt-1">GEAR <span style={{ color: accent }}>{hud.gear}</span></p>
        <div className="h-1.5 mt-1 rounded-full bg-black/60 overflow-hidden border border-white/20"><div className="h-full" style={{ width: `${Math.round(hud.rpm * 100)}%`, background: hud.rpm > 0.9 ? "#ff3b3b" : "#ffffff" }} /></div>
        <p className="text-[9px] text-white/60 mt-1">NITROUS (SHIFT)</p>
        <div className="h-2 rounded-full bg-black/60 overflow-hidden border border-white/20"><div className="h-full" style={{ width: `${Math.round(hud.nitro)}%`, background: hud.nos ? "#fff" : "linear-gradient(90deg,#2de2ff,#b45cff)" }} /></div>
      </div>
      {hud.hit && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 90px rgba(255,60,60,0.35)" }} />}
    </div>
  );
}

// =============================== RESULT ==================================================================================================
function ResultCard({ res, accent, onClose }) {
  const m = res.medal; const ev = res.ev;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="w-[420px] max-w-[90%] rounded-xl border border-lineColor bg-bgPanel p-5 text-center">
        <p className="font-pixel text-[10px] text-textDim mb-1">{ev.name.toUpperCase()}</p>
        <p className="font-pixel text-2xl mb-1" style={{ color: MEDAL_COL[m] }}>{m === "none" ? (res.outcome === "out" ? "ELIMINATED" : res.outcome === "dnf" ? "FAILED" : res.pos ? ORD[res.pos - 1] + " PLACE" : "NO MEDAL") : m.toUpperCase() + " MEDAL"}</p>
        {res.pos > 0 && <p className="font-mono text-[11px] text-textDim mb-2">You finished {ORD[res.pos - 1]} of {res.total}</p>}
        {res.score != null && <p className="font-mono text-sm text-textLight mb-1">Drift score {res.score.toLocaleString()} <span className="text-textDim">(bronze {res.goals[0].toLocaleString()} · silver {res.goals[1].toLocaleString()} · gold {res.goals[2].toLocaleString()})</span></p>}
        {res.cargo != null && <p className="font-mono text-[11px] text-textLight mb-1">Cargo {res.cargo}% · {Math.max(0, res.timeLeft).toFixed(0)}s to spare</p>}
        {res.rows && res.rows.length > 0 && <div className="my-3 text-left font-mono text-[11px]">{res.rows.map((r, i) => <div key={i} className="flex justify-between py-0.5 border-b border-lineColor" style={{ color: r.me ? accent : "#c8cbe8" }}><span>{i + 1}. {r.name}</span><span>{r.t != null ? fmtTime(r.t) : "DNF"}</span></div>)}</div>}
        {res.reward && (res.reward.cash > 0 || res.reward.xp > 0) && <p className="font-mono text-[12px] text-accentAmber my-2">+{money(res.reward.cash)} · +{res.reward.xp} XP</p>}
        {res.unlocked && <p className="font-pixel text-[10px] text-accentCyan my-2">NEW CAR UNLOCKED: {P.CARS.find((c) => c.id === res.unlocked).name.toUpperCase()}</p>}
        <Btn onClick={onClose} color={accent}>CONTINUE (ENTER)</Btn>
      </div>
    </div>
  );
}

// =============================== SHOPS ====================================================================================================
function ShopPanel({ G, shop, draft, setDraft, onClose, accent, refresh, onQuit }) {
  const career = G.career; const spec = specOf({ ...(career.spec || DEFAULT_SPEC), car: career.car });
  const shown = draft || spec; const pending = draft ? pendingItems(draft, career.owned) : []; const pendCost = pending.reduce((a, x) => a + x.cost, 0);
  const car = P.CARS.find((c) => c.id === career.car);
  const stats = P.makeStats(car, career.levels, spec.kit);
  const apply = () => { if (!draft) return; if (career.cash < pendCost) { sfx.wrong(); return; } sfx.correct(); career.cash -= pendCost; career.owned.push(...pending.map((x) => `${x.group}:${x.id}`)); career.spec = { ...draft, car: undefined }; career.spec.car = career.car; setDraft(null); G.restat(); refresh(); };
  const pick = (id) => { if (!career.carsOwned.includes(id)) { sfx.wrong(); return; } sfx.tap(); career.car = id; career.spec = { ...(career.spec || DEFAULT_SPEC), car: id }; setDraft(null); G.restat(); refresh(); };
  const buy = (id) => { if (G.buyUpgrade(id)) { sfx.correct(); refresh(); } else sfx.wrong(); };
  const kind = shop.kind;
  return (
    <div className="absolute inset-0 pointer-events-auto overflow-y-auto" style={{ background: "rgba(4,4,12,0.92)" }}>
      <div className="max-w-4xl mx-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <div><p className="font-pixel text-sm text-accentAmber">{shop.icon} {shop.name.toUpperCase()}</p><p className="font-mono text-[10px] text-textDim">{shop.blurb}</p></div>
          <div className="text-right"><p className="font-mono text-sm text-textLight">{money(career.cash)}</p><Btn small onClick={onClose} color="#667">LEAVE (ESC)</Btn></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Showroom spec={shown} height={260} />
            <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-lineColor bg-bgPanel p-3"><p className="font-pixel text-[9px] text-accentCyan mb-1">{car.name.toUpperCase()}</p>
              <Bar label="SPEED" value={stats.vmax} max={100} color={accent} right={Math.round(stats.vmax * 3.6) + " km/h"} /><Bar label="ACCEL" value={stats.accel} max={45} color={accent} /><Bar label="GRIP" value={stats.grip} max={9} color={accent} /><Bar label="NITRO" value={stats.nitroPower} max={1.5} color={accent} /></div>
          </div>
          <div>
            {kind === "perf" && (<div className="flex flex-col gap-3"><p className="font-pixel text-[9px] text-accentCyan">PERFORMANCE</p>{P.UPGRADES.map((u) => { const lv = career.levels[u.id]; const max = lv >= u.max; const cost = u.cost[lv]; return (
              <div key={u.id} className="rounded-lg border border-lineColor bg-bgPanel p-3"><div className="flex justify-between items-center"><div><p className="font-pixel text-[10px] text-textLight">{u.name.toUpperCase()}</p><p className="font-mono text-[10px] text-textDim">{u.blurb}</p></div><Btn small disabled={max || career.cash < cost} onClick={() => buy(u.id)} color={accent}>{max ? "MAX" : `BUY ${money(cost)}`}</Btn></div>
                <div className="flex gap-1 mt-2">{Array.from({ length: u.max }).map((_, i) => <div key={i} className="flex-1 h-1.5 rounded" style={{ background: i < lv ? accent : "#222238" }} />)}</div></div>); })}</div>)}
            {kind === "visual" && (<div><p className="font-pixel text-[9px] text-accentCyan mb-2">LOOKS</p><CustomisePanel draft={shown} owned={career.owned} accent={accent} currency={CUR} onChange={(d) => { setDraft(d); sfx.tap(); }} />
              <div className="mt-3 flex items-center gap-3"><Btn small color={accent} disabled={!draft || career.cash < pendCost} onClick={apply}>{draft ? (pendCost ? `BUY & APPLY ${money(pendCost)}` : "APPLY") : "NO CHANGES"}</Btn>{draft && <Btn small color="#667" onClick={() => setDraft(null)}>RESET</Btn>}</div></div>)}
            {(kind === "lot" || kind === "home") && (<div><p className="font-pixel text-[9px] text-accentCyan mb-2">{kind === "lot" ? "THE LOT" : "YOUR CARS"}</p><div className="flex flex-col gap-2">{P.CARS.map((c) => { const own = career.carsOwned.includes(c.id); const s = P.makeStats(c); const need = c.id === "phantom" ? "Beat Saint (#4) on the Ladder" : c.id === "specter" ? "Beat Kage (#1) on the Ladder" : ""; return (
              <div key={c.id} className="rounded-lg border bg-bgPanel p-3 flex items-center gap-3" style={{ borderColor: career.car === c.id ? accent : "#2a2a44" }}><div className="flex-1"><p className="font-pixel text-[10px] text-textLight">{c.name.toUpperCase()}</p><p className="font-mono text-[10px] text-textDim">{c.blurb}</p><p className="font-mono text-[9px] text-textDim mt-1">{Math.round(s.vmax * 3.6)} km/h · accel {s.accel.toFixed(0)} · grip {s.grip.toFixed(1)}</p></div>
                <Btn small disabled={!own || career.car === c.id} onClick={() => pick(c.id)} color={accent}>{career.car === c.id ? "DRIVING" : own ? "DRIVE" : "LOCKED"}</Btn>{!own && <p className="font-mono text-[9px] text-accentAmber w-32">{need}</p>}</div>); })}</div>
              {kind === "home" && (<div className="mt-4 rounded-lg border border-lineColor bg-bgPanel p-3 font-mono text-[11px] text-textDim"><p className="font-pixel text-[9px] text-accentAmber mb-2">CAREER</p>
                <p>Level {G.level()} · {Object.keys(career.done).length}/{G.events.length} events done · {career.sights.length}/{G.content.sights.length} sights · {career.stash.length}/{G.content.stashes.length} stashes</p>
                <p>Distance {(career.odo / 1000).toFixed(1)} km · top speed {career.topSpeed} km/h · {Math.floor(career.nearMiss)} near misses · best drift {career.bestDrift.toLocaleString()}</p>
                <p className="mt-2 text-textLight">Career score: {G.score().toLocaleString()}</p><div className="mt-3"><Btn small color="#9fd4ff" onClick={onQuit}>SAVE, SUBMIT SCORE & EXIT</Btn></div></div>)}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================== PAUSE: map, events, career ============================================================================
function PausePanel({ G, tab, setTab, sel, setSel, evFilter, setEvFilter, accent, onResume, onQuit, muted, onMute }) {
  const stage = useStage();
  const tabs = [["map", "MAP"], ["events", "EVENTS"], ["career", "CAREER"], ["options", "OPTIONS"]];
  return (
    <div className="absolute inset-0 pointer-events-auto flex flex-col" style={{ background: "rgba(4,4,12,0.94)" }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-lineColor">
        <p className="font-pixel text-[11px] mr-3" style={{ color: accent }}>PAUSED</p>
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); sfx.tap(); }} className="font-pixel text-[9px] px-3 py-1.5 rounded" style={{ background: tab === k ? accent : "transparent", color: tab === k ? "#07070f" : "#aab" }}>{l}</button>)}
        <div className="flex-1" /><Btn small color="#9fd0ff" onClick={() => stage.toggle()}>{stage.isFull ? "EXIT FULLSCREEN" : "⛶ FULLSCREEN"}</Btn><Btn small color="#6bff9a" onClick={onResume}>RESUME (P)</Btn>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "map" && <MapTab G={G} sel={sel} setSel={setSel} accent={accent} onResume={onResume} />}
        {tab === "events" && <EventsTab G={G} filter={evFilter} setFilter={setEvFilter} accent={accent} onResume={onResume} />}
        {tab === "career" && <CareerTab G={G} accent={accent} onQuit={() => onQuit(true)} />}
        {tab === "options" && <div className="p-6 max-w-md mx-auto flex flex-col gap-3 items-stretch">
          <Btn onClick={onMute} color="#9fd4ff">{muted ? "SOUND OFF — TURN ON" : "SOUND ON — TURN OFF"}</Btn>
          <Btn color="#ffb703" onClick={() => { G.reset(); onResume(); }}>RESET CAR ON THE ROAD</Btn>
          <Btn color="#b45cff" onClick={() => { G.clearWaypoint(); sfx.tap(); }}>CLEAR GPS</Btn>
          <Btn color="#667" onClick={() => onQuit(false)}>SAVE &amp; EXIT TO MENU</Btn>
          <Btn color={accent} onClick={() => onQuit(true)}>SAVE, SUBMIT SCORE &amp; EXIT</Btn>
          <p className="font-mono text-[10px] text-textDim text-center">Your career saves automatically in this browser.</p>
        </div>}
      </div>
    </div>
  );
}

function eventPoint(G, ev) { return [ev.sx, ev.sz]; }
function MapTab({ G, sel, setSel, accent, onResume }) {
  const cv = useRef(null); const [dim, setDim] = useState(640);
  const things = useMemo(() => {
    const a = []; for (const ev of G.events) a.push({ kind: "event", id: ev.id, x: ev.sx, z: ev.sz, ev });
    for (const sh of G.content.shops) a.push({ kind: "shop", id: sh.id, x: sh.x, z: sh.z, sh });
    for (const s of G.content.sights) a.push({ kind: "sight", id: s.id, x: s.x, z: s.z, s }); return a;
  }, [G]);
  const base = useMemo(() => { try { return buildBaseMap(G.city); } catch { return null; } }, [G]);
  useEffect(() => { const r = () => { const h = window.innerHeight; const el = cv.current && cv.current.parentElement; const w = el ? el.clientWidth : 800; setDim(Math.max(360, Math.min(w, (el ? el.clientHeight : h) || h) - 8)); }; r(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);
  const k = dim / 6400;
  useEffect(() => {
    const c = cv.current; if (!c || !base) return; const g = c.getContext("2d"); g.clearRect(0, 0, dim, dim); g.drawImage(base, 0, 0, dim, dim);
    const P1 = G.player; const dot = (x, z, col, r, ring) => { g.fillStyle = col; g.beginPath(); g.arc(x * k, z * k, r, 0, 7); g.fill(); g.strokeStyle = ring || "rgba(0,0,0,0.8)"; g.lineWidth = 1.4; g.stroke(); };
    for (const t of things) {
      const isSel = sel && sel.id === t.id;
      if (t.kind === "event") { const done = G.career.done[t.id]; const unl = G.isUnlocked(t.ev); dot(t.x, t.z, t.ev.type === "trap" ? "#ff6b6b" : !unl ? "#6b2a2a" : done ? MEDAL_COL[done.medal] : "#ffffff", isSel ? 7 : 4.5, isSel ? accent : undefined); }
      else if (t.kind === "shop") dot(t.x, t.z, "#ffb703", isSel ? 8 : 6, isSel ? accent : "#fff");
      else dot(t.x, t.z, G.career.sights.includes(t.id) ? "#6bff9a" : "#9fd4ff", isSel ? 6 : 3.4, isSel ? accent : undefined);
    }
    if (G.nav && G.nav.line && G.nav.line.length > 1) { g.strokeStyle = "#2de2ff"; g.lineWidth = 2.5; g.beginPath(); G.nav.line.forEach((p, i) => (i ? g.lineTo(p.x * k, p.z * k) : g.moveTo(p.x * k, p.z * k))); g.stroke(); }
    if (G.nav && G.nav.target) dot(G.nav.target.x, G.nav.target.z, "#2de2ff", 7, "#fff");
    g.save(); g.translate(P1.x * k, P1.z * k); g.rotate(P1.yaw + Math.PI / 2); g.fillStyle = "#ff2d95"; g.strokeStyle = "#fff"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  }, [dim, sel, base, things, G]); // eslint-disable-line
  function click(e) {
    const r = cv.current.getBoundingClientRect(); const px = (e.clientX - r.left) / k * (cv.current.width / r.width) * 0 + (e.clientX - r.left) * (dim / r.width) / k, pz = (e.clientY - r.top) * (dim / r.height) / k;
    let best = null, bd = 22 / k; for (const t of things) { const d = Math.hypot(t.x - px, t.z - pz); if (d < bd) { bd = d; best = t; } }
    if (best) { setSel(best); sfx.tap(); } else { setSel({ kind: "point", id: "pt", x: px, z: pz }); }
  }
  const info = sel && (() => {
    if (sel.kind === "event") { const ev = sel.ev; const done = G.career.done[ev.id]; const unl = G.isUnlocked(ev); const seen = G.career.seen.includes(ev.id) && ev.type !== "trap";
      return { title: ev.name, sub: `${TYPE_LABEL[ev.type]} · ${ev.area || ""} · LV ${ev.level}`, body: ev.blurb, rows: [ev.reward ? `Reward up to ${money(ev.reward.cash)} · ${ev.reward.xp} XP` : "", done ? `Best: ${done.medal.toUpperCase()}${done.best != null ? " · " + (ev.type === "trap" ? done.best + " km/h" : ev.type === "drift" ? done.best.toLocaleString() : fmtTime(done.best)) : ""}` : "Not completed", !unl ? "🔒 " + G.lockReason(ev) : ""], ev, travel: seen && unl && ev.type !== "trap", pt: [ev.sx, ev.sz], label: ev.name }; }
    if (sel.kind === "shop") return { title: sel.sh.name, sub: "Shop", body: sel.sh.blurb, rows: [], travel: G.career.seen.includes(sel.sh.id), pt: [sel.sh.x, sel.sh.z], label: sel.sh.name };
    if (sel.kind === "sight") return { title: sel.s.name, sub: G.career.sights.includes(sel.id) ? "Discovered ✔" : "Undiscovered sight (+₹300, +110 XP)", body: "", rows: [], travel: false, pt: [sel.x, sel.z], label: sel.s.name };
    return { title: "Map point", sub: "", body: "", rows: [], travel: false, pt: [sel.x, sel.z], label: "Waypoint" };
  })();
  return (
    <div className="h-full flex">
      <div className="flex-1 flex items-center justify-center p-2 min-w-0"><canvas ref={cv} width={dim} height={dim} onClick={click} className="cursor-crosshair rounded-lg border border-lineColor" style={{ width: dim, height: dim }} /></div>
      <div className="w-72 shrink-0 border-l border-lineColor p-4 overflow-y-auto">
        <p className="font-pixel text-[9px] text-accentCyan mb-2">MAP</p>
        <p className="font-mono text-[10px] text-textDim mb-3">Click anything to see it. Click empty map to drop a GPS pin. <span className="text-white">● white</span> events · <span style={{ color: "#ffb703" }}>● shops</span> · <span style={{ color: "#9fd4ff" }}>● sights</span></p>
        {info ? (<div className="rounded-lg border border-lineColor bg-bgPanel p-3"><p className="font-pixel text-[10px] text-textLight">{info.title.toUpperCase()}</p><p className="font-mono text-[10px] text-accentAmber mb-2">{info.sub}</p>{info.body && <p className="font-mono text-[10px] text-textDim mb-2">{info.body}</p>}{info.rows.filter(Boolean).map((r, i) => <p key={i} className="font-mono text-[10px] text-textLight">{r}</p>)}
          <div className="flex flex-col gap-2 mt-3"><Btn small color="#2de2ff" onClick={() => { G.setWaypoint(info.pt[0], info.pt[1], info.label); sfx.correct(); onResume(); }}>SET GPS &amp; RESUME</Btn>
            <Btn small color="#ffb703" disabled={!info.travel || !!G.run} onClick={() => { if (G.teleport(info.pt[0] - 0, info.pt[1] - 0)) { onResume(); } }}>{info.travel ? "FAST TRAVEL" : "FAST TRAVEL (visit it first)"}</Btn></div></div>) : <p className="font-mono text-[10px] text-textDim">Nothing selected.</p>}
      </div>
    </div>
  );
}

function EventsTab({ G, filter, setFilter, accent, onResume }) {
  const types = ["all", "circuit", "sprint", "knockout", "drag", "duel", "drift", "trap", "delivery"];
  const list = G.events.filter((e) => filter === "all" || e.type === filter).sort((a, b) => a.level - b.level);
  const done = Object.keys(G.career.done).length;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[11px] text-textDim mb-3">{done}/{G.events.length} events completed · Level {G.level()}. Drive to an event's glowing start marker and press ENTER. Set a GPS pin with G (or from the map).</p>
        <div className="flex flex-wrap gap-1.5 mb-4">{types.map((t) => <button key={t} onClick={() => { setFilter(t); sfx.tap(); }} className="font-pixel text-[8px] px-2.5 py-1.5 rounded border" style={{ borderColor: filter === t ? accent : "#2a2a44", color: filter === t ? accent : "#99a" }}>{t === "all" ? "ALL" : TYPE_LABEL[t].toUpperCase()}</button>)}</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {list.map((ev) => { const d = G.career.done[ev.id]; const unl = G.isUnlocked(ev); return (
            <div key={ev.id} className="rounded-lg border border-lineColor bg-bgPanel p-3 flex gap-3 items-start" style={{ opacity: unl ? 1 : 0.55 }}>
              <div className="text-xl">{TYPE_ICON[ev.type]}</div>
              <div className="flex-1 min-w-0"><p className="font-pixel text-[9px] text-textLight truncate">{ev.name.toUpperCase()}</p><p className="font-mono text-[9px] text-textDim">{TYPE_LABEL[ev.type]} · {ev.area} · LV {ev.level}</p><p className="font-mono text-[9px] mt-1" style={{ color: d ? MEDAL_COL[d.medal] : "#889" }}>{d ? d.medal.toUpperCase() + (d.best != null ? " · " + (ev.type === "trap" ? d.best + " km/h" : ev.type === "drift" ? d.best.toLocaleString() : fmtTime(d.best)) : "") : unl ? "NOT DONE" : "🔒 " + G.lockReason(ev)}</p></div>
              <Btn small color="#2de2ff" onClick={() => { G.setWaypoint(ev.sx, ev.sz, ev.name); sfx.correct(); onResume(); }}>GPS</Btn>
            </div>); })}
        </div>
      </div>
    </div>
  );
}

function CareerTab({ G, accent, onQuit }) {
  const c = G.career; const lp = D.levelProgress(c.xp);
  const stat = (l, v) => <div className="rounded-lg border border-lineColor bg-bgPanel p-3 text-center"><p className="font-pixel text-sm text-textLight">{v}</p><p className="font-mono text-[9px] text-textDim mt-1">{l}</p></div>;
  const golds = Object.values(c.done).filter((d) => d.medal === "gold").length;
  const ladder = D.DRIVERS.slice().reverse().map((d) => ({ d, beaten: !!c.done["duel-" + d.id] }));
  return (
    <div className="h-full overflow-y-auto p-4"><div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4"><span className="font-pixel text-3xl" style={{ color: accent }}>{lp.level}</span><div className="flex-1"><Bar label="LEVEL" value={lp.frac} max={1} color={accent} right={lp.need ? `${lp.into}/${lp.need}` : "MAX"} /></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">{stat("CAREER SCORE", G.score().toLocaleString())}{stat("CASH", money(c.cash))}{stat("EVENTS DONE", `${Object.keys(c.done).length}/${G.events.length}`)}{stat("GOLD MEDALS", golds)}{stat("DISTANCE", (c.odo / 1000).toFixed(1) + " km")}{stat("TOP SPEED", c.topSpeed + " km/h")}{stat("NEAR MISSES", Math.floor(c.nearMiss))}{stat("BEST DRIFT", c.bestDrift.toLocaleString())}{stat("SIGHTS", `${c.sights.length}/${G.content.sights.length}`)}{stat("CASH STASHES", `${c.stash.length}/${G.content.stashes.length}`)}{stat("PLAY TIME", Math.floor(c.playT / 60) + " min")}{stat("CARS OWNED", c.carsOwned.length + "/5")}</div>
      <p className="font-pixel text-[9px] text-accentCyan mb-2">THE UNDERGROUND LADDER</p>
      <div className="grid sm:grid-cols-2 gap-1.5 mb-5">{ladder.map(({ d, beaten }) => <div key={d.id} className="rounded border border-lineColor bg-bgPanel px-3 py-2 flex items-center gap-2" style={{ opacity: beaten ? 1 : 0.7 }}><span className="font-pixel text-[10px] w-7" style={{ color: d.accent }}>#{d.rank}</span><div className="flex-1"><p className="font-mono text-[11px] text-textLight">{d.name} <span className="text-textDim">— {d.title}</span></p><p className="font-mono text-[9px] text-textDim">LV {d.reqLevel} · {require_home(d.id)}</p></div><span className="font-mono text-[10px]" style={{ color: beaten ? "#6bff9a" : "#889" }}>{beaten ? "BEATEN" : "—"}</span></div>)}</div>
      <Btn color={accent} onClick={onQuit}>SAVE, SUBMIT SCORE &amp; EXIT</Btn>
    </div></div>
  );
}
const HOME = { pixel: "Colaba Causeway", rook: "Sewri Docks", nova: "Bandra Reclamation", mako: "Airoli Docks", juno: "Yeoor Hills", dagger: "Thane Station Road", saint: "Marine Drive", vex: "Palm Beach Road", nyx: "Atal Setu", kage: "Bandra–Worli Sea Link" };
const require_home = (id) => HOME[id] || "";

// =============================== the public component ==================================================================================
export default function MidnightBurnCity(props) { return <MidnightBurnCityInner {...props} />; }
