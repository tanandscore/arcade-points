"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createCityWorld } from "@/midnightburn/engine/open/world";
import { buildContent } from "@/midnightburn/engine/open/content";
import { createGame, EMPTY_CAREER, MEDALS } from "@/midnightburn/engine/open/sim";
import { createCityView } from "@/midnightburn/engine/open/render";
import { createMiniMap } from "@/midnightburn/engine/open/maps";
import { createFullMap } from "@/midnightburn/engine/open/fullMap";
import { districtAt, DISTRICTS } from "@/midnightburn/engine/open/geo";
import { IS_TOKYO, MAP_ID, chooseMap } from "@/midnightburn/engine/open/mapId";
import { T_HOME } from "@/midnightburn/engine/open/maps/tokyoContent";
import MidnightBurnIntro from "./MidnightBurnIntro";
import { createIntroScore, INTRO } from "@/midnightburn/engine/introScore";
import { DT } from "@/midnightburn/engine/open/drive";
import { garageNeed as GN } from "@/midnightburn/engine/open/garages";
import { OUT, ROSTER as RACERS, maxTier } from "@/midnightburn/engine/open/outrun";
import * as P from "@/midnightburn/engine/physics";
import * as D from "@/midnightburn/engine/drivers";
import { DEFAULT_SPEC, specOf } from "@/midnightburn/engine/cars";
import { Showroom, CustomisePanel, pendingItems } from "./MidnightBurnGarage";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { sfx, isMuted, toggleMuted } from "@/lib/sound";
import { createCarAudio } from "@/midnightburn/engine/engineAudio";

// MIDNIGHT BURN — MUMBAI UNDERGROUND. A free-roam night city built on Mumbai, Thane and Navi Mumbai: highways,
// flyovers, sea bridges, hills and docks, with street races, duels against ten named drivers, drift zones, speed
// traps, deliveries, hidden stashes, famous sights and four kinds of shop.
//
// lib/midnightBurn/open/*   — the city, the physics, the events and the 3D view (the game rules live in sim.js)
// this file                  — menus, HUD, map, shops and the game loop

const SAVE_KEYS = { now: "midnightburn.city.v2", "2046": "midnightburn.city2046.v1", free: "mumbaistreet.free.v1", tokyo: "midnightburn.tokyo.v1" };
let ERA = "2046", TIER = "full"; const saveKey = () => (IS_TOKYO ? SAVE_KEYS.tokyo : TIER === "free" ? SAVE_KEYS.free : SAVE_KEYS[ERA]);
const FREE_LIMITS = { events: 12, types: ["circuit", "sprint", "drag"], stashes: 40, sights: 8 }; // the free game: the same present-day city, fewer things to do
const CUR = IS_TOKYO ? "¥" : "₹";
const SIGHTS_N = IS_TOKYO ? 42 : 33, EVENTS_N = IS_TOKYO ? 70 : 69; // how many famous sights / events the map has (shown in the menu)
const ALL_STARTERS = P.CARS.filter((c) => !c.locked);
const PAINTS = ["#2de2ff", "#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#f2f2f2"];
const TYPE_LABEL = { circuit: "Circuit", sprint: "Sprint", knockout: "Knockout", drag: "Drag race", duel: "Blacklist rival", drift: "Drift zone", trap: "Speed trap", delivery: "Delivery" };
const TYPE_ICON = { circuit: "🏁", sprint: "🏁", knockout: "💀", drag: "⚡", duel: "👑", drift: "🌀", delivery: "📦", trap: "📷" };
const MEDAL_COL = { gold: "#ffd23a", silver: "#d6dbe6", bronze: "#d98a4a", none: "#667" };
const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const hexInt = (h) => parseInt(h.slice(1), 16);
const fmtTime = (t) => { const m = Math.floor(t / 60); const s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, "0")}`; };
const money = (n) => CUR + Math.round(n).toLocaleString();

const CACHES = {}; // the city takes a couple of seconds to build; keep each era for the next visit
function getCity() {
  const key = ERA + ":" + TIER;
  if (!CACHES[key]) {
    const world = createCityWorld(7, ERA); const content = buildContent(world);
    if (TIER === "free") { // trimmed content: three kinds of race, a handful of stashes and sights, only the home garage
      content.events = content.events.filter((e) => FREE_LIMITS.types.includes(e.type)).slice(0, FREE_LIMITS.events);
      content.stashes = content.stashes.slice(0, FREE_LIMITS.stashes); content.sights = content.sights.slice(0, FREE_LIMITS.sights); content.shops = content.shops.filter((s) => s.id === "home"); content.garages = [];
    }
    CACHES[key] = { world, content, base: null };
  }
  return CACHES[key];
}

// Upgrade 37: Mumbai Drift and Tokyo Drift are two separate careers. Each has its own save (cash, cars, level, upgrades, events, sights, position) under its own key, and nothing is ever copied from one to the other.
const careerKeyOf = (id) => (id === "tokyo" ? SAVE_KEYS.tokyo : SAVE_KEYS["2046"]);
function readCareer(key, id) {
  try {
    const s = localStorage.getItem(key); if (!s) return null; const c = JSON.parse(s);
    if (c && c.map && c.map !== id) return null; // a save stamped for the other city is never used here
    return c;
  } catch { return null; }
}
function loadSave() {
  try {
    const own = readCareer(saveKey(), IS_TOKYO ? "tokyo" : "mumbai");
    if (IS_TOKYO && TIER !== "free" && own && !own.map && !own.pos && !Object.keys(own.done || {}).length && !(own.stash || []).length && !(own.sights || []).length && !(own.seen || []).length) {
      // an older version copied the old Mumbai career's cash, XP and cars into a brand-new Tokyo save the first time Tokyo opened. If nothing has been done in Tokyo yet it is only that copy: drop it, Tokyo starts clean
      localStorage.removeItem(saveKey()); return null;
    }
    if (own) return own;
    if (TIER !== "free" && ERA === "2046" && !IS_TOKYO) { // only for Mumbai Drift: the present-day Mumbai map moved to the free game, so its money, XP and cars carry over once and the map starts fresh
      const old = localStorage.getItem(SAVE_KEYS.now); if (!old) return null; const c = JSON.parse(old); delete c.pos; c.done = {}; c.stash = []; c.sights = []; c.seen = []; c.map = "mumbai"; localStorage.setItem(saveKey(), JSON.stringify(c)); return c;
    }
    return null;
  } catch { return null; }
}
function writeSave(c) { try { c.map = IS_TOKYO ? "tokyo" : "mumbai"; localStorage.setItem(saveKey(), JSON.stringify(c)); } catch {} }
// a one-line summary of a city's own career for the city picker
function careerLine(id) { const c = readCareer(careerKeyOf(id), id); if (!c) return "NEW CAREER"; return `LV ${D.levelOf(c.xp || 0)} · ${Object.keys(c.done || {}).length} events · ${(id === "tokyo" ? "¥" : "₹")}${Math.round(c.cash || 0).toLocaleString()}`; }

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

function MidnightBurnCityInner({ onFinish, accentColor, onMood, onClassic, musicRef, tier = "full" }) {
  const free = tier === "free"; TIER = tier; ERA = free ? "now" : "2046"; const STARTERS = free ? ALL_STARTERS.slice(0, 1) : [...ALL_STARTERS, ...P.START_HERO_CARS];
  const stage = useStage();
  const mountRef = useRef(null);
  const miniRef = useRef(null); const gpsRef = useRef(null);
  const mapRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu"); // menu | loading | play
  const [save, setSave] = useState(null);
  const [newCar, setNewCar] = useState("kestrel"); const [startAt, setStartAt] = useState("home"); // where a new career begins: the home garage, or the iconic Palm Beach Road drag strip
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
  const [era, setEraS] = useState(free ? "now" : "2046");
  function pickEra(e) { ERA = e; setEraS(e); setSave(loadSave()); sfx.tap(); }

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setDeviceOk(!coarse && window.innerWidth >= 900); setMutedState(isMuted()); setSave(loadSave());
  }, []);
  useEffect(() => { if (typeof window !== "undefined" && window.__MB_TEST) window.__mbCity = { get G() { return gref.current; }, get view() { return vref.current; }, get gps() { return gpsRef.current; }, setPhase }; }, []);
  const speedBucket = hud ? Math.min(5, Math.floor(hud.kmh / 45)) : 0;
  // the radio is loud while you roam and on free quests (deliveries, drift zones, speed traps); a little lower during races and duels
  useEffect(() => { const m = musicRef && musicRef.current; if (!m || !m.setLevel) return; const ty = hud && hud.ev && hud.ev.type; const racing = ty === "circuit" || ty === "sprint" || ty === "knockout" || ty === "drag" || ty === "duel"; m.setLevel(racing && hud.ev.state !== "done" ? 0.62 : 1); }, [hud && hud.ev && hud.ev.type, hud && hud.ev && hud.ev.state]); // eslint-disable-line
  useEffect(() => { if (!onMood) return; onMood(phase !== "playing" ? 0.2 : paused ? 0.25 : hud && hud.ev ? (["drift", "delivery", "trap"].includes(hud.ev.type) ? 0.85 : 0.72) : 0.55 + speedBucket * 0.1); }, [phase, paused, hud && !!hud.ev, speedBucket]); // eslint-disable-line
  useEffect(() => { musicRef && musicRef.current && musicRef.current.setNitro(!!(hud && hud.nos)); }, [hud && hud.nos]); // eslint-disable-line
  useEffect(() => { try { const m = musicRef && musicRef.current; const g = gref.current; if (m && m.setBass && g) m.setBass([0, 4, 7, 10][g.career.audio || 0]); } catch {} }, [phase]); // the car's audio system sets the radio's bass // eslint-disable-line
  const [radioNote, setRadioNote] = useState(null);
  const [intro, setIntro] = useState(null); const introRef = useRef(null); const introWant = useRef(false);
  useEffect(() => { const m = musicRef && musicRef.current; if (!m) return undefined; let first = true; return m.onChange((s) => { if (first) { first = false; } setRadioNote({ name: s.name, tag: s.tag, t: Date.now() }); setTimeout(() => setRadioNote((r) => (r && Date.now() - r.t > 4500 ? null : r)), 4800); }); }, []); // eslint-disable-line

  // ---- start / continue -------------------------------------------------------------------------------------------------------------
  function begin(fresh) {
    sfx.click(); stage.enter(); setPhase("loading"); setProgress(0); setFailed(false); setLoadMsg("Building the city…");
    const s = fresh ? null : save;
    if (fresh) { const c = EMPTY_CAREER(); c.car = newCar; c.spec = { ...DEFAULT_SPEC, car: newCar, color: newPaint }; try { localStorage.removeItem(saveKey()); } catch {} setSave(null); window.__mbFresh = c; window.__mbStartAt = startAt; } else { window.__mbFresh = null; window.__mbStartAt = null; }
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
      const wasFresh = !!window.__mbFresh; let career = window.__mbFresh || loadSave() || EMPTY_CAREER(); window.__mbFresh = null;
      if (!career.spec) career = { ...career, spec: { ...DEFAULT_SPEC, car: career.car, color: PAINTS[0] } };
      G = createGame(city.world, city.content, career, {
        seed: 1 + Math.floor(Math.random() * 999), free,
        hooks: { onSave: (c) => writeSave(c), onToast: (t, k) => { if (k === "good" || k === "level") sfx.correct(); else if (k === "warn") sfx.wrong(); else if (k === "go") sfx.click(); }, onCue: (n) => { try { if (eng) eng.cue(n); } catch {} }, onPickup: () => sfx.correct(), onFind: () => { try { sfx.newBest(); } catch {} } },
      });
      gref.current = G;
      if (wasFresh && !free && (window.__mbStartAt === "palm" || window.__mbStartAt === "hakone")) { try { G.goToEvent(window.__mbStartAt === "hakone" ? "drift-hakone" : "drag-palm"); } catch (e) { console.error(e); } } window.__mbStartAt = null;
      try { view = createCityView(mount, G, { lite: free, noPeople: free }); } catch (e) { console.error(e); setFailed(true); return; }
      vref.current = view;
      setLoadMsg("Loading the streets…");
      await view.preload((p) => alive && setProgress(Math.min(1, p)));
      if (!alive) return;
      ro = new ResizeObserver(() => view.resize()); ro.observe(mount);
      eng = makeEngine();
      setPhase("playing");
      let last = performance.now(), acc = 0, hudT = 0, lastDist = "", pauseLatch = false;
      let mini = null, mctx = null; const gps = createMiniMap(city.world.city); gpsRef.current = gps; let gpsT = 0;
      const inputNow = () => {
        const k = keys.current; const up = k.w || k.ArrowUp, dn = k.s || k.ArrowDown, lf = k.a || k.ArrowLeft, rt = k.d || k.ArrowRight;
        return { throttle: up ? 1 : 0, brake: dn ? 1 : 0, steer: (rt ? 1 : 0) - (lf ? 1 : 0), hand: !!k[" "], nos: !!(k.Shift) };
      };

      // ---- the cinematic intro: real-time shots over the live city, scripted camera, generated score ----------------------------------------
      const ictl = { active: false, t0: 0, shot: -1, busy: false, saved: null, score: null, p0: null, inp: { throttle: 0, brake: 0, steer: 0, hand: false, nos: false }, lastUi: 0, rev: 0 };
      const hqShop = G.content.shops.find((s) => s.id === "home"); const dadar = DISTRICTS.find((d) => d.id === "dadar");
      const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
      function autopilot(P, throttle, nos) {
        const n = city.world.city.nearestRoad(P.x, P.z, 80, null, P.y); let steer = 0;
        if (n) { const r = n.road; const j = Math.min(r.pts.length - 1, n.i + 7); const a = r.pts[n.i], b = r.pts[j]; let yawT = Math.atan2(b.z - a.z, b.x - a.x); if (Math.cos(yawT - P.yaw) < 0) { const j2 = Math.max(0, n.i - 7); const bb = r.pts[j2]; yawT = Math.atan2(bb.z - a.z, bb.x - a.x); } steer = Math.max(-1, Math.min(1, wrapA(yawT - P.yaw) * 2.4)); }
        return { throttle, brake: 0, steer, hand: false, nos: !!nos };
      }
      // where each shot happens and what time of day it is: golden-hour Sea Link fly-by, a cruise under the metro viaduct, dusk at HQ, then the night drop
      const bc = city.world.city;
      const introSpots = () => {
        let sea = 1212, under = 97;
        try {
          const wr = bc.roads.find((q) => q.id === (IS_TOKYO ? "r4" : "weh")), sl = (city.world.landmarks || []).find((l) => l.id === (IS_TOKYO ? "rainbow" : "sealink"));
          if (IS_TOKYO) sea = 14;
          else if (wr && sl) { let bk = 0, bd = 1e9; wr.pts.forEach((p, k) => { const d = Math.hypot(p.x - sl.x, p.z - sl.z); if (d < bd) { bd = d; bk = k; } }); sea = Math.max(5, bk - 52); }
          if (wr && bc.metro) {
            const mp = []; for (const L of bc.metro) for (let k = 0; k < L.pts.length; k += 2) mp.push(L.pts[k]);
            let run = 0;
            for (let i = 20; i < wr.pts.length - 80 && !run; i += 3) { const p = wr.pts[i]; if (p.tun || p.y - p.g < 6) continue; let ok = false; for (const m of mp) { if (Math.abs(m.x - p.x) < 20 && Math.abs(m.z - p.z) < 20 && m.y - p.y > 4 && m.y - p.y < 14) { ok = true; break; } } if (ok) run = i; }
            if (run) under = Math.max(5, run - 14);
          }
        } catch (e) { console.error(e); }
        return { sea, under };
      };
      async function enterShot(i) {
        ictl.shot = i; ictl.busy = true;
        try {
          const S = [{ tod: "golden", road: IS_TOKYO ? "rainbow" : "weh", at: "sea", v: 36 }, { tod: "golden", road: IS_TOKYO ? "r4" : "weh", at: "under", v: 30 }, { tod: "dusk", hq: true }, { tod: "night" }][i];
          if (view.setTimeOfDay) view.setTimeOfDay(S.tod, true);
          if (S.road) { ictl.spots = ictl.spots || introSpots(); if (!G.placeOnRoad(S.road, ictl.spots[S.at], S.v)) G.teleport(hqShop.x, hqShop.z); }
          else if (S.hq) G.teleport(hqShop.x, hqShop.z);
          await view.preload();
          const P = G.player; ictl.p0 = { x: P.x, y: P.y, z: P.z, yaw: P.yaw };
        } catch (e) { console.error(e); }
        ictl.busy = false;
      }
      function introFrame() {
        const T = typeof window !== "undefined" && window.__introT != null ? window.__introT : Math.max(0, (performance.now() - ictl.t0) / 1000);
        const sh = T < INTRO.CUTS[0] ? 0 : T < INTRO.CUTS[1] ? 1 : T < INTRO.CUTS[2] ? 2 : 3;
        if (sh !== ictl.shot && !ictl.busy) enterShot(sh);
        const P = G.player, p0 = ictl.p0 || { x: P.x, y: P.y, z: P.z, yaw: P.yaw };
        G.traffic.length = 0; ictl.inp = { throttle: 0, brake: 0, steer: 0, hand: false, nos: false }; ictl.rev = 0.18;
        const ts = (a) => T - a; let cam = null;
        const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
        if (ictl.shot === 0) {
          // a drone sweeping round the car as it crosses the Sea Link: starts behind and high, ends low and ahead, the towers rising behind it
          ictl.inp = autopilot(P, 0.8, false); ictl.rev = 0.55 + Math.min(0.4, T * 0.05);
          const k = Math.min(1, T / INTRO.CUTS[0]), e = k * k * (3 - 2 * k), f = -34 + 56 * e, s = 30 - 8 * e, h = 15 - 11 * e;
          cam = { x: P.x + cy * f - sy * s, y: P.y + h, z: P.z + sy * f + cy * s, lx: P.x + cy * (7 + 8 * e), ly: P.y + 1.4 + 20 * (1 - e) * (1 - e) * 0.4, lz: P.z + sy * (7 + 8 * e) };
        }
        else if (ictl.shot === 1) {
          const t1 = ts(INTRO.CUTS[0]); ictl.inp = autopilot(P, 1, false); ictl.rev = 0.5 + Math.min(0.5, t1 * 0.12);
          const cy0 = Math.cos(p0.yaw), sy0 = Math.sin(p0.yaw);
          if (t1 < 3.9) cam = { x: p0.x + cy0 * 48 - sy0 * 3.4, y: p0.y + 1.25, z: p0.z + sy0 * 48 + cy0 * 3.4, lx: P.x + cy * 3, ly: P.y + 0.7, lz: P.z + sy * 3 };
          else cam = { x: P.x - cy * 6.2 - sy * 2.2, y: P.y + 1.05, z: P.z - sy * 6.2 + cy * 2.2, lx: P.x + cy * 12, ly: P.y + 0.9, lz: P.z + sy * 12 };
        } else if (ictl.shot === 2) {
          const t2 = ts(INTRO.CUTS[1]); const a = p0.yaw + Math.PI * 0.85 - t2 * 0.216, r = 6.6 - t2 * 0.12; // ends at a front three-quarter view, not dead ahead of the headlamps (that blew out to white at dusk)
          cam = { x: P.x + Math.cos(a) * r, y: P.y + 1.15 + t2 * 0.1, z: P.z + Math.sin(a) * r, lx: P.x, ly: P.y + 0.55, lz: P.z };
          ictl.rev = 0.18 + 0.78 * Math.max(0, Math.sin(Math.max(0, t2 - 3.2) * 1.9)) * (t2 > 3.2 ? 1 : 0); ictl.revThr = ictl.rev > 0.4;
        } else if (ictl.shot === 3) {
          const t3 = ts(INTRO.CUTS[2]); ictl.inp = autopilot(P, t3 > 0.25 ? 1 : 0, t3 > 0.9); ictl.rev = P.rpm;
          const L = t3 < 2.4 ? 0 : t3 < 4.6 ? 1 : t3 < 7.4 ? 2 : 3;
          if (L === 0) cam = { x: P.x - cy * (5 + t3 * 0.3) - sy * 0.5, y: P.y + 0.85, z: P.z - sy * (5 + t3 * 0.3) + cy * 0.5, lx: P.x + cy * 6, ly: P.y + 0.7, lz: P.z + sy * 6 };
          else if (L === 1) cam = { x: P.x - sy * 3.3 + cy * 1.2, y: P.y + 0.5, z: P.z + cy * 3.3 + sy * 1.2, lx: P.x + cy * 0.6, ly: P.y + 0.45, lz: P.z + sy * 0.6 };
          else if (L === 2) cam = { x: P.x + cy * 7.5 + sy * 2.6, y: P.y + 0.75, z: P.z + sy * 7.5 - cy * 2.6, lx: P.x, ly: P.y + 0.7, lz: P.z };
          else cam = { x: P.x - cy * 12, y: P.y + 4.4, z: P.z - sy * 12, lx: P.x + cy * 10, ly: P.y + 0.8, lz: P.z + sy * 10 };
        }
        view.debugCam = cam;
        const now = performance.now(); if (now - ictl.lastUi > 45) { ictl.lastUi = now; setIntro({ t: T, hold: ictl.busy }); }
        if (T >= INTRO.END) endIntro();
      }
      async function startIntro() {
        if (ictl.active || G.run) return;
        ictl.saved = { player: G.player, pause: G.pause }; ictl.spots = null; G.pause = false; setPaused(false); keys.current = {};
        ictl.active = true; ictl.shot = -1; ictl.busy = true; ictl.p0 = null; ictl.t0 = performance.now() + 250;
        G.racers.length = 0; G.racerT = 1e9; // no street racers wandering through the intro film
        setIntro({ t: 0, hold: true });
        const m = musicRef && musicRef.current; if (m && m.duck) m.duck(true);
        try { ictl.score = createIntroScore(isMuted); if (ictl.score) ictl.score.resume(); } catch {}
        ictl.busy = false;
      }
      function endIntro() {
        if (!ictl.active) return; ictl.active = false; view.debugCam = null;
        if (ictl.score) { ictl.score.stop(0.5); ictl.score = null; }
        const m = musicRef && musicRef.current; if (m && m.duck) m.duck(false);
        if (ictl.saved) { try { if (view.resumeAutoClock) view.resumeAutoClock(); } catch {} G.player = ictl.saved.player; G.pause = false; G.traffic.length = 0; G.racers.length = 0; G.racerT = 16; view.refreshPlayer(); view.setCameraMode(0); view.cam.snap = true; ictl.saved = null; }
        G.career.introSeen = true; try { writeSave(G.career); } catch {}
        setIntro(null);
      }
      introRef.current = { get active() { return ictl.active; }, start: startIntro, skip: endIntro };
      if (!free && (wasFresh || introWant.current)) { introWant.current = false; startIntro(); }
      const loop = (now) => {
        if (!alive) return; raf = requestAnimationFrame(loop);
        const cpu0 = performance.now(); // Upgrade 37: how much of the frame is spent on the processor (game step, preparing objects, HUD) tells the picture-quality governor whether a smaller picture could help at all
        let dt = Math.min(0.1, (now - last) / 1000); last = now;
        const pausedNow = G.pause || G.state === "shop";
        let simSteps = 0;
        if (!G.pause) { acc += dt; while (acc >= DT && simSteps < 6) { G.step(ictl.active ? ictl.inp : inputNow(), DT); acc -= DT; simSteps++; } if (acc > DT * 6) acc = 0; }
        if (ictl.active) introFrame();
        view.update(G.pause ? 0 : dt, simSteps ? DT : 0);
        const P1 = G.player;
        if (eng) { const run = G.run; eng.set({ rpm: ictl.active ? Math.max(ictl.rev, P1.rpm * (ictl.shot === 0 || ictl.shot === 1 || ictl.shot === 3 ? 1 : 0)) : P1.rpm, nos: P1.nos, thr: ictl.active ? (ictl.shot === 2 ? !!ictl.revThr : !!ictl.inp.throttle) : (!!inputNow().throttle && !pausedNow), shifting: P1.shiftT > 0, squeal: pausedNow ? 0 : (P1.drifting ? Math.min(1, P1.slip * 2) : P1.braking && P1.speed > 25 ? 0.5 : 0), v: pausedNow ? 0 : P1.speed, rain: G.weather.rain, car: G.career.car, cam: ictl.active ? 0 : (vref.current ? vref.current.cam.mode : 0), hit: pausedNow ? 0 : P1.hit, nm: !!G.nmFlash, rival: pausedNow ? null : (() => { const rr = G.run && G.run.rival ? G.run.rival : G.racerNear, rv = rr && rr.v; if (!rv) return null; const q = G.racerTo(rr), dd = Math.max(1, q.d); return { d: q.d, side: Math.max(-1, Math.min(1, q.right / 14)), rpm: Math.max(0, Math.min(1, rv.rpm != null ? rv.rpm : rv.speed / 60)), rel: -(((rv.vx || 0) - (P1.vx || 0)) * (rv.x - P1.x) + ((rv.vz || 0) - (P1.vz || 0)) * (rv.z - P1.z)) / dd }; })(), tunnel: !!(P1.surfRoad && P1.surfRoad.tunnel), wetRoad: G.weather.rain > 0.3 }); }
        if (!mini || !mini.isConnected) { mini = miniRef.current; mctx = mini ? mini.getContext("2d") : null; }
        if (mctx && !G.pause) { try { gps.draw(mctx, mini.width, G, dt); } catch (e) { if (!gps.failed) { gps.failed = true; console.error(e); } } }
        hudT -= dt;
        if (hudT <= 0) { // the HUD is redrawn 10 times a second while roaming, 20 in events (it used to be every frame during an event)
          hudT = G.state === "roam" ? 0.1 : 0.05;
          const dd = districtAt(P1.x, P1.z); const dname = dd ? dd.name : "Open road";
          const run = G.run; let ev = null;
          if (run) {
            const E = run.ev; ev = { id: E.id, name: E.name, type: E.type, state: run.state, cd: Math.ceil(run.cd || 0), t: run.t };
            if (run.kind === "outrun") { const rv = run.rival; ev.outrun = { vs: rv.name, tag: rv.def.tag, tier: rv.tier, lead: Math.round(run.lead), win: OUT.WIN_GAP, live: run.live, lights: Math.max(1, Math.ceil(run.lights)), left: Math.max(0, run.timeLeft), hold: run.hold, side: run.holdSide, off: Math.round(run.pOff || 0), rkmh: Math.round(rv.v.speed * 3.6) }; }
            if (run.route && run.kind !== "drift" && run.kind !== "delivery" && run.kind !== "outrun") {
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
          let turn = null; try { const rl = run && run.route && run.kind !== "drift" && run.kind !== "delivery" ? run.route.pts : G.nav && G.nav.line; if (rl && !G.pause) { turn = gps.hint(P1, rl); if (turn && run && run.route && run.kind !== "outrun") { const gi = run.route.gates, gp = run.route.pts[gi[Math.min(gi.length - 1, run.gate)]]; turn.gate = Math.round(Math.hypot(gp.x - P1.x, gp.z - P1.z)); } } } catch (e) { turn = null; }
          setHud({
            kmh: Math.round(P1.speed * 3.6), gear: P1.fwd < -0.5 ? "R" : P1.gear, rpm: P1.rpm, nitro: P1.nitro, nos: P1.nos, drift: Math.round(G.roamDrift || 0), driftOn: P1.drifting,
            cash: G.career.cash, xp: G.career.xp, level: G.level(), bl: G.blacklistRank(), score: G.score(), fest: vref.current ? vref.current.festivalActive : "off", district: dname, wet: G.weather.rain, state: G.state, ev, result: G.result, toasts: G.toasts.map((t) => ({ ...t })), chat: G.chat ? { id: G.chat.id, name: G.chat.name, tag: G.chat.tag, tier: G.chat.tier, color: G.chat.color, text: G.chat.text, f: G.chat.ttl / G.chat.ttl0 } : null,
            near: near ? { id: near.id, name: near.name, type: near.type, locked: !G.isUnlocked(near), why: G.lockReason(near) } : null, shopNear: sn ? { id: sn.id, name: sn.name } : null, nav,
            gps: turn ? { d: turn.d, dir: turn.dir, ang: turn.ang, end: turn.end, wrong: turn.wrong, gate: turn.gate } : null, zoom: gps.mode, flash: G.flash ? G.flash.text : null, nm: !!G.nmFlash, stash: G.career.stash.length, stashTotal: G.content.stashes.length, sights: G.career.sights.length, sightsTotal: G.content.sights.length,
            hit: G.cam.hit > 6,
            racerNear: G.racerNear ? { name: G.racerNear.name, tag: G.racerNear.def.tag, tier: G.racerNear.tier } : null,
            racerSeen: (() => { if (G.run || !G.racers.length) return null; let b = null; for (const r of G.racers) { const q = G.racerTo(r); if (q.d < OUT.SEE_R && (!b || q.d < b.d)) b = { name: r.name, tag: r.def.tag, tier: r.tier, d: Math.round(q.d), ahead: q.ahead, right: q.right }; } return b; })(),
            gar: (() => { const gp = G.garageProgress(); return gp.active ? { found: gp.found, total: gp.total, held: gp.held, more: gp.more, next: gp.nextLevel, hint: G.garageHint ? Math.round(G.garageHint.d) : null } : null; })(),
          });
        }
        if (view.noteCpu) view.noteCpu(performance.now() - cpu0);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => { alive = false; try { if (introRef.current && introRef.current.active) introRef.current.skip(); } catch {} cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (eng) eng.stop(); if (view) view.dispose(); if (G) { G.career.pos = { x: G.player.x, z: G.player.z, yaw: G.player.yaw }; writeSave(G.career); setSave(G.career); } gref.current = null; vref.current = null; };
  }, [phase === "play" || phase === "playing"]); // eslint-disable-line

  // ---- keys ----------------------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    const kn = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    function down(e) {
      const k = kn(e); const G = gref.current;
      if (G && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Tab"].includes(k)) e.preventDefault();
      if (!e.repeat) keys.current[k === "Shift" ? "Shift" : k] = true; if (e.key === "Shift") keys.current.Shift = true;
      if (!G) return;
      if (introRef.current && introRef.current.active) { if (["Escape", "Enter", " ", "p"].includes(k)) introRef.current.skip(); return; }
      if (k === "p" || k === "Escape") { if (G.state === "shop") closeShop(); else if (G.state !== "result") togglePause(); }
      if (k === "m") { if (!G.pause) { setTab("map"); togglePause(true); } else if (tabRef.current === "map") togglePause(false); else setTab("map"); }
      if (k === "Enter") { if (G.pause || G.state === "result") { if (G.state === "result") closeResult(); return; } if (G.state === "roam") { if (G.shopNear) openShop(); else if (G.near) G.startNear(); else if (G.racerNear) challenge(); } }
      if (k === "l" && !G.pause && G.state === "roam" && G.racerNear) challenge();
      if (k === "c") { const v = vref.current; if (v) { v.cam.mode = (v.cam.mode + 1) % (free ? 2 : 4); v.setCameraMode(v.cam.mode); setCamLabel(["CHASE", "FAR", "HOOD", "COCKPIT"][v.cam.mode]); } }
      if (k === "r" && !G.pause && G.state !== "result") G.reset();
      if (k === "f") stage.toggle();
      if (k === "n") { musicRef && musicRef.current && musicRef.current.next(); }
      if (k === "x" && G.run && G.state === "event") { G.abortEvent(); }
      if (k === "g" && !G.pause && G.near) { G.setWaypoint(G.near.sx, G.near.sz, G.near.name); }
      if (k === "t" && !G.pause) { G.clearWaypoint(); }
      if (k === "z" && !G.pause && gpsRef.current) { gpsRef.current.cycleMode(); sfx.tap(); }
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
  function challenge() { const G = gref.current; if (G && G.startOutrun()) { sfx.select && sfx.select(); keys.current = {}; setTick((t) => t + 1); } }
  function openShop() { const G = gref.current; const s = G && G.shopOpen(); if (s) { sfx.select && sfx.select(); setShop(s); setDraft(null); setTick((t) => t + 1); keys.current = {}; } }
  function closeShop() { const G = gref.current; if (!G) return; G.shopClose(); setShop(null); setDraft(null); vref.current && vref.current.refreshPlayer(); }
  function quit(submit) {
    const G = gref.current; const score = G ? G.score() : 0; if (G) writeSave(G.career);
    stage.exit(); setPhase("menu"); setPaused(false); setHud(null); setShop(null); setSave(loadSave());
    if (submit && !submitted.current) { submitted.current = true; onFinish(Math.max(0, Math.round(score)), IS_TOKYO ? { board: "tokyo" } : undefined); }
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
    const cityCols = IS_TOKYO ? "#ff5aa5" : "#ffb347";
    const panel = "rounded-2xl border border-white/10 p-4 md:p-5 backdrop-blur";
    const panelBg = { background: "linear-gradient(160deg, rgba(20,16,38,0.85), rgba(10,8,22,0.85))" };
    const head = "font-mono text-[10px] tracking-[0.25em] text-white/50 mb-3";
    const begin_ = [IS_TOKYO ? ["home", "🏠", "THE HOME GARAGE", "Start in Ginza and find your own first race. The whole city is open."] : ["home", "🏠", "THE HOME GARAGE", "Start in Bandra Kurla and find your own first race. The whole city is open."], IS_TOKYO ? ["palm", "⚡", "THE WANGAN: MIDNIGHT DRAG", "The iconic bayshore strip. One rival beside you, 700 metres, nitrous on the button."] : ["palm", "⚡", "PALM BEACH ROAD: MIDNIGHT DRAG", "The iconic Navi Mumbai strip. One rival beside you, 700 metres, nitrous on the button."], ...(IS_TOKYO ? [["hakone", "🌄", "HAKONE TURNPIKE: MIDNIGHT DRIFT", "The legendary mountain road. Slide hairpin after hairpin in the dark."]] : [])];
    return (
      <div className="relative rounded-2xl overflow-hidden text-left" style={{ background: `radial-gradient(ellipse at 20% 0%, ${cityCols}22 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, #5b2cff22 0%, transparent 50%), #07050f` }}>
        <div className="p-4 md:p-7 max-w-5xl mx-auto">
          {/* hero */}
          <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.35em] mb-1" style={{ color: cityCols }}>{free ? "FREE EDITION · MUMBAI TODAY" : IS_TOKYO ? "TOKYO DRIFT" : "MUMBAI DRIFT"}</p>
              <h2 className="font-pixel text-xl md:text-3xl" style={{ color: accent, textShadow: `0 0 28px ${accent}66` }}>{free ? "MUMBAI STREET RACER" : "MIDNIGHT BURN"}</h2>
              <p className="font-mono text-[11px] text-white/60 mt-2">{free ? "12 races · 8 sights · 40 cash stashes · standard graphics" : `${EVENTS_N} events · ${SIGHTS_N} sights · 300 stashes · 6 shops · always-night city with rain`}</p>
            </div>
            {!free && (
              <div className="flex gap-2 flex-wrap" role="group" aria-label="Choose your city">
                {[["mumbai", "MUMBAI", "#ffb347"], ["tokyo", "TOKYO", "#ff5aa5"]].map(([id, name, col]) => (
                  <button key={id} onClick={() => { if (id !== MAP_ID) { sfx.tap(); chooseMap(id); } }} aria-pressed={id === MAP_ID} className="rounded-full border px-5 py-2 font-pixel text-[10px] transition" style={{ borderColor: id === MAP_ID ? col : "rgba(255,255,255,0.15)", color: id === MAP_ID ? "#0b0b14" : "#cfd2ff", background: id === MAP_ID ? col : "rgba(255,255,255,0.04)", boxShadow: id === MAP_ID ? `0 0 20px ${col}66` : "none" }}>{name}</button>))}
              </div>)}
          </div>
          <p className="font-mono text-[11px] text-white/65 mb-5 max-w-3xl leading-relaxed">
            {IS_TOKYO ? "One huge night city, free to roam: Shibuya, Shinjuku, the Rainbow Bridge, Daikoku Pier, the Aqua-Line and the mountain passes." : "One huge night city, free to roam: South Mumbai, the Sea Link, Bandra Kurla, Powai, Thane, Navi Mumbai, the JNPT docks and the Sahyadri ghats."}{" "}
            Win races, work down the Blacklist, drift, beat the speed cameras and build your dream car.{!free && " Each city keeps its own career."}
          </p>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* left: car */}
            <div className={panel + " lg:col-span-3"} style={panelBg}>
              <p className={head}>{save ? "START A NEW CAREER · PICK A CAR" : "PICK YOUR STARTER"}</p>
              <Showroom spec={spec} height={230} className="mb-3" />
              <div className="flex gap-2 mb-4 items-center"><span className="font-mono text-[10px] text-white/50 mr-1">PAINT</span>{PAINTS.map((c) => <button key={c} onClick={() => { setNewPaint(c); sfx.tap(); }} aria-label={`Paint ${c}`} className="w-6 h-6 rounded-full border-2 transition" style={{ background: c, borderColor: newPaint === c ? "#fff" : "transparent", transform: newPaint === c ? "scale(1.18)" : "none" }} />)}</div>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {STARTERS.map((c) => { const st = P.cityStats(c), on = newCar === c.id; return (
                  <button key={c.id} onClick={() => { setNewCar(c.id); sfx.tap(); }} className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5" style={{ borderColor: on ? newPaint : "rgba(255,255,255,0.12)", background: on ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)", boxShadow: on ? `0 0 18px ${newPaint}44` : "none" }}>
                    <p className="font-pixel text-[10px] mb-1" style={{ color: on ? newPaint : "#cfd2ff" }}>{c.name.toUpperCase()}{c.hero && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded border" style={{ borderColor: "#ffb347", color: "#ffb347" }}>HERO</span>}</p>
                    <p className="text-[10px] text-white/55 mb-2 leading-snug">{c.blurb}</p>
                    <div className="flex flex-col gap-1"><Bar label="SPEED" value={st.vmax / 62} max={1.5} color={newPaint} /><Bar label="ACCEL" value={st.accel / 26} max={1.5} color={newPaint} /><Bar label="HANDLE" value={(st.yaw * st.grip) / (2.5 * 5.2)} max={1.5} color={newPaint} /></div>
                  </button>); })}
              </div>
            </div>

            {/* right: career + how to begin */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {save && (
                <div className={panel} style={{ ...panelBg, borderColor: `${accent}66` }}>
                  <p className={head}>{free ? "YOUR CAREER" : IS_TOKYO ? "YOUR TOKYO CAREER" : "YOUR MUMBAI CAREER"}</p>
                  <div className="grid grid-cols-4 gap-2 font-mono text-[9px] text-white/50 text-center mb-4">
                    {[[lvl, "LEVEL"], [money(save.cash), "CASH"], [doneN, "EVENTS"], [`${(save.sights || []).length}/${SIGHTS_N}`, "SIGHTS"]].map(([v, l]) => <div key={l} className="rounded-lg bg-white/5 py-2"><p className="text-white text-sm font-bold">{v}</p>{l}</div>)}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Btn onClick={() => begin(false)} color={accent}>CONTINUE ▸</Btn>
                    {!free && <Btn small color="#c7a6ff" onClick={() => { introWant.current = true; begin(false); }}>▶ INTRO</Btn>}
                    <Btn small color="#9fd4ff" onClick={() => { if (!submitted.current) { submitted.current = true; let sc = 0; for (const d of Object.values(save.done || {})) sc += d.pts || 0; sc += (save.stash || []).length * 30 + (save.sights || []).length * 120 + Math.floor((save.odo || 0) / 1000) * 5 + Math.floor(save.nearMiss || 0) * 4; onFinish(Math.round(sc), IS_TOKYO ? { board: "tokyo" } : undefined); } }}>SUBMIT SCORE</Btn>
                  </div>
                </div>)}
              {free ? (
                <div className={panel} style={{ ...panelBg, borderColor: "#ffb34766" }}>
                  <p className={head} style={{ color: "#ffb347" }}>FREE EDITION</p>
                  <p className="text-[11px] text-white/60 leading-relaxed">Race across today's Mumbai on standard graphics. The full <span className="text-white">Midnight Burn: Mumbai Drift</span> adds the future city, 67 events, the ten-driver ladder, car customisation, rain, shadows, crowds and the radio.</p>
                </div>
              ) : (
                <div className={panel} style={panelBg}>
                  <p className={head}>HOW DO YOU WANT TO BEGIN?</p>
                  <div className="flex flex-col gap-2">
                    {begin_.map(([k, ic, t, d]) => { const on = startAt === k; return (
                      <button key={k} onClick={() => { setStartAt(k); sfx.tap(); }} className="rounded-xl border p-3 text-left flex gap-3 items-start transition" style={{ borderColor: on ? "#ffb347" : "rgba(255,255,255,0.12)", background: on ? "rgba(255,179,71,0.09)" : "rgba(255,255,255,0.02)", boxShadow: on ? "0 0 16px #ffb34744" : "none" }}>
                        <span className="text-xl leading-none">{ic}</span>
                        <span><span className="block font-pixel text-[9px] mb-1" style={{ color: on ? "#ffb347" : "#cfd2ff" }}>{t}</span><span className="block text-[10px] text-white/55 leading-snug">{d}</span></span>
                      </button>); })}
                  </div>
                </div>)}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { if (!save || window.confirm(free ? "Start a new career? Your saved career will be replaced." : `Start a new ${IS_TOKYO ? "Tokyo" : "Mumbai"} career? Your saved ${IS_TOKYO ? "Tokyo" : "Mumbai"} career will be replaced. The other city's career is not touched.`)) begin(true); }} className="flex-1 font-pixel text-[12px] tracking-widest py-4 rounded-xl transition hover:brightness-110" style={{ background: save ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${accent}, #ffb347)`, color: save ? "#cfd2ff" : "#0b0b14", boxShadow: save ? "none" : `0 8px 30px ${accent}55`, border: save ? "1px solid rgba(255,255,255,0.18)" : "none", minWidth: 180 }}>{save ? "NEW CAREER" : "START ▸"}</button>
                {onClassic && <Btn small color="#b45cff" onClick={onClassic}>CLASSIC CIRCUITS</Btn>}
              </div>
            </div>
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03]">
            <summary className="px-4 py-3 cursor-pointer font-mono text-[10px] tracking-[0.25em] text-white/60">CONTROLS</summary>
            <ul className="font-mono text-[11px] text-white/60 space-y-1 px-4 pb-4">
              <li><span className="text-white">W S / ↑ ↓</span> gas and brake (hold S to reverse) &nbsp; <span className="text-white">A D / ← →</span> steer</li>
              <li><span className="text-white">SPACE</span> handbrake — hold through a bend to drift &nbsp; <span className="text-white">SHIFT</span> nitrous</li>
              <li><span className="text-white">ENTER</span> start the event or shop you're parked at &nbsp; <span className="text-white">G</span> set GPS to it &nbsp; <span className="text-white">T</span> clear GPS</li>
              <li><span className="text-white">ENTER or L</span> beside a street racer (pink dot on the minimap): challenge it to an outrun. Open up a {OUT.WIN_GAP} m lead to win.</li>
              <li><span className="text-white">N</span> next radio station &nbsp; <span className="text-white">M</span> map &amp; events &nbsp; <span className="text-white">P / ESC</span> pause &nbsp; <span className="text-white">R</span> reset car &nbsp; <span className="text-white">C</span> camera &nbsp; <span className="text-white">X</span> abandon event &nbsp; <span className="text-white">F</span> fullscreen</li>
              <li>Drifting and near-misses with traffic fill your nitrous. Drive on the left, like in India and Japan.</li>
            </ul>
          </details>
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
      {playing && hud && !shop && !intro && <Hud hud={hud} accent={accent} miniRef={miniRef} camLabel={camLabel} muted={muted} G={G} onPause={() => togglePause(true)} paused={paused} />}
      {playing && hud && hud.result && <ResultCard res={hud.result} accent={accent} onClose={closeResult} />}
      {playing && shop && G && <ShopPanel key={tick} G={G} shop={shop} draft={draft} setDraft={setDraft} onClose={closeShop} accent={accent} refresh={() => { setTick((t) => t + 1); vref.current && vref.current.refreshPlayer(); }} onQuit={() => quit(true)} musicRef={musicRef} />}
      {playing && intro && <MidnightBurnIntro t={intro.t} hold={intro.hold} era={ERA} carName={(G && G.career && G.career.car) || ""} onSkip={() => introRef.current && introRef.current.skip()} />}
      {playing && paused && !intro && G && <PausePanel view={vref.current} G={G} tab={tab} setTab={setTab} sel={sel} setSel={setSel} evFilter={evFilter} setEvFilter={setEvFilter} accent={accent} onResume={() => togglePause(false)} onQuit={quit} muted={muted} onMute={() => setMutedState(toggleMuted())} onIntro={() => { const G2 = gref.current; if (G2 && !G2.run && introRef.current) { G2.pause = false; setPaused(false); introRef.current.start(); } }} canIntro={!free && !(G && G.run)} free={free} />}
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
        <p className="font-pixel text-[9px] mt-0.5" style={{ color: accent }}>{hud.bl > 15 ? "BLACKLIST · UNRANKED" : hud.bl === 1 ? "BLACKLIST · #1 KING" : `BLACKLIST · #${hud.bl}`}</p>
        <p className="text-[10px] text-white/60">SCORE {hud.score.toLocaleString()}</p>
        {hud.fest && hud.fest !== "off" && <p className="text-[10px] mt-0.5" style={{ color: "#ffb347" }}>🪔 {({ ganapati: "GANESH CHATURTHI", navratri: "NAVRATRI", diwali: "DIWALI" })[hud.fest]} FESTIVAL IN THE CITY</p>}
      </div>
      {/* pause button — always clickable, same as P / Esc */}
      <button onClick={() => stage.toggle()} aria-label="Fullscreen" className="pointer-events-auto absolute font-pixel text-[9px] rounded-md px-2.5 py-1.5" style={{ top: 12, left: 352, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", textShadow: "none" }}>{stage.isFull ? "⛶ EXIT FULL (F)" : "⛶ FULLSCREEN (F)"}</button>
      <button onClick={onPause} aria-label="Pause" className="pointer-events-auto absolute font-pixel text-[9px] rounded-md px-2.5 py-1.5" style={{ top: 12, left: 232, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", textShadow: "none" }}>❚❚ PAUSE (P)</button>
      {/* top right: place and weather */}
      <div className="absolute top-3 right-4 text-right">
        <p className="text-sm tracking-wide">{hud.district.toUpperCase()}</p>
        <p className="text-[10px] text-white/60">{hud.wet > 0.3 ? "RAIN" : "CLEAR NIGHT"} · CAM {camLabel} (C)</p>
        <p className="text-[10px] text-white/45">💰 {hud.stash}/{hud.stashTotal} · 🏛 {hud.sights}/{hud.sightsTotal}{hud.gar ? ` · 🔧 ${hud.gar.found}/${hud.gar.total}` : ""}</p>
        {hud.gar && hud.gar.next && <p className="text-[10px] mt-0.5" style={{ color: hud.gar.held ? "#ffb347" : "rgba(255,255,255,0.45)" }}>{hud.gar.more > 0 ? `LEVEL ${hud.gar.next}: ${hud.gar.more} MORE HIDDEN GARAGE${hud.gar.more === 1 ? "" : "S"}` : `LEVEL ${hud.gar.next} UNLOCKED BY GARAGES`}</p>}
      </div>
      {/* event panel */}
      {ev && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center rounded px-5 py-1.5" style={{ background: "linear-gradient(180deg,rgba(24,16,6,0.78),rgba(10,7,3,0.6))", border: "1px solid rgba(255,181,46,0.55)", boxShadow: "0 0 18px rgba(255,150,30,0.18)" }}>
          <p className="font-pixel text-[10px]" style={{ color: "#ffb52e" }}>{ev.name.toUpperCase()}</p>
          {ev.pos != null && <p className="font-pixel text-2xl" style={{ color: accent }}>{ORD[ev.pos - 1]}<span className="text-xs text-white/70"> /{ev.n}</span></p>}
          {ev.laps > 1 && <p className="text-[11px] text-white/80">LAP {ev.lap}/{ev.laps}</p>}
          {ev.gates != null && <p className="text-[10px] text-white/60">CHECKPOINT {ev.gate}/{ev.gates}</p>}
          {ev.state === "go" && !ev.outrun && <p className="text-lg">{fmtTime(ev.t)}</p>}
          {ev.outrun && <OutrunBar o={ev.outrun} />}
          {ev.vs && <p className="text-[11px]" style={{ color: ev.gapM >= 0 ? "#6bff6b" : "#ff6b6b" }}>VS {ev.vs.toUpperCase()} · {ev.gapM >= 0 ? "+" : ""}{ev.gapM} m</p>}
          {ev.elim > 0 && <p className="font-pixel text-[11px] text-accentMagenta animate-pulse">ELIMINATION IN {Math.ceil(ev.elim)}</p>}
          {ev.score != null && (<><p className="font-pixel text-xl" style={{ color: "#ff8a2d" }}>{ev.score.toLocaleString()}</p><p className="text-[11px] text-white/80">{ev.left.toFixed(0)}s · {ev.inside ? "IN THE ZONE" : "RETURN TO THE RING"}</p>{ev.bank > 0 && <p className="text-[12px]" style={{ color: "#ffd23a" }}>+{ev.bank.toLocaleString()} ×{(1 + Math.min(4, ev.chain * 0.45)).toFixed(1)}</p>}<p className="text-[9px] text-white/50">BRONZE {ev.goals[0].toLocaleString()} · SILVER {ev.goals[1].toLocaleString()} · GOLD {ev.goals[2].toLocaleString()}</p></>)}
          {ev.cargo != null && (<><p className="text-lg">{Math.max(0, ev.left).toFixed(0)}s</p><p className="text-[11px]" style={{ color: ev.cargo > 60 ? "#6bff6b" : "#ff6b6b" }}>CARGO {ev.cargo}%</p></>)}
          <p className="text-[9px] text-white/40 mt-0.5">{ev.outrun ? "X give up" : "X abandon"}</p>
        </div>
      )}
      {/* countdown */}
      {ev && ev.outrun && !ev.outrun.live && <div className="absolute inset-0 flex items-center justify-center"><p className="font-pixel text-7xl" style={{ color: "#ff4fd8", textShadow: "0 0 30px #ff4fd8" }}>{Math.max(1, Math.min(3, ev.outrun.lights))}</p></div>}
      {ev && ev.state === "countdown" && <div className="absolute inset-0 flex items-center justify-center"><p className="font-pixel text-7xl" style={{ color: accent, textShadow: "0 0 30px " + accent }}>{Math.max(1, Math.min(3, ev.cd))}</p></div>}
      {/* toasts */}
      <div className="absolute flex flex-col items-center gap-1" style={{ top: 150, left: "20%", width: "60%" }}>
        {hud.toasts.slice(-4).map((t) => (
          <div key={t.id} className="px-3 py-1 rounded font-pixel text-[10px]" style={{ background: "rgba(16,10,3,0.72)", borderLeft: "3px solid #ffb52e", color: t.kind === "warn" ? "#ff6b6b" : t.kind === "good" ? "#6bff9a" : t.kind === "level" ? "#ffd23a" : t.kind === "go" ? "#2de2ff" : "#fff", opacity: Math.min(1, t.ttl) }}>{t.text}</div>
        ))}
      </div>
      {/* Upgrade 39: the other racer on the radio. Sits at the top right under the district name (clear of the map and the speedometer), fades out after a few seconds. */}
      {hud.chat && !hud.result && hud.state !== "result" && (
        <div key={hud.chat.id} className="absolute rounded-md px-3 py-1.5 pointer-events-none" style={{ right: 16, top: 100, maxWidth: 250, background: "rgba(24,0,22,0.74)", borderLeft: `3px solid ${hud.chat.color || "#ff4fd8"}`, boxShadow: "0 0 14px rgba(255,79,216,0.2)", opacity: Math.min(1, hud.chat.f * 4) }}>
          <p className="font-pixel text-[9px]" style={{ color: "#ff9bea" }}>📻 {hud.chat.name.toUpperCase()} <span className="text-white/45">· {hud.chat.tag.toUpperCase()}</span></p>
          <p className="text-[11px] italic text-white/90 leading-snug mt-0.5">“{hud.chat.text}”</p>
        </div>
      )}
      {hud.flash && <div className="absolute top-1/3 left-1/2 -translate-x-1/2"><p className="font-pixel text-3xl" style={{ color: "#ff4d4d", textShadow: "0 0 20px #ff4d4d" }}>{hud.flash}</p></div>}
      {hud.nm && <div className="absolute top-[42%] left-1/2 -translate-x-1/2"><p className="font-pixel text-sm text-accentCyan">NEAR MISS +NITRO</p></div>}
      {hud.drift > 80 && !ev && <div className="absolute top-[46%] left-1/2 -translate-x-1/2"><p className="font-pixel text-lg" style={{ color: "#ff8a2d" }}>DRIFT {hud.drift.toLocaleString()}</p></div>}
      {/* hidden garage signal: a faint "hot / cold" bar, only when one is close and still unfound */}
      {!ev && hud.state === "roam" && hud.gar && hud.gar.hint != null && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center rounded-lg px-4 py-1.5" style={{ background: "rgba(10,4,24,0.62)", border: "1px solid rgba(180,92,255,0.55)", boxShadow: "0 0 16px rgba(180,92,255,0.25)" }}>
          <p className="font-pixel text-[10px] animate-pulse" style={{ color: "#d9b3ff" }}>🔧 HIDDEN GARAGE NEARBY</p>
          <div className="mt-1 h-1.5 w-40 rounded" style={{ background: "#241a3a" }}><div className="h-full rounded" style={{ width: `${Math.round(Math.max(6, Math.min(100, (1 - hud.gar.hint / 130) * 100)))}%`, background: "linear-gradient(90deg,#7a3fd0,#d9b3ff)" }} /></div>
          <p className="text-[9px] text-white/55 mt-0.5">look beside the road · {hud.gar.hint < 60 ? "very close" : hud.gar.hint < 95 ? "getting warmer" : "somewhere near"}</p>
        </div>
      )}
      {/* street racers: a hint while one is in range, a prompt when you are alongside */}
      {!ev && hud.state === "roam" && hud.racerSeen && !hud.racerNear && !hud.shopNear && !hud.near && (() => { const r = hud.racerSeen; const dir = Math.abs(r.ahead) > Math.abs(r.right) ? (r.ahead >= 0 ? "ahead" : "behind you") : (r.right >= 0 ? "on your right" : "on your left"); return (<div className="absolute top-16 left-1/2 -translate-x-1/2 rounded-lg px-3 py-1 text-center" style={{ background: "rgba(24,0,22,0.6)", border: "1px solid rgba(255,79,216,0.5)" }}><p className="font-pixel text-[9px]" style={{ color: "#ff9bea" }}>🏁 STREET RACER · {r.name.toUpperCase()}</p><p className="text-[10px] text-white/70">{r.d} m {dir} · pull alongside to challenge</p></div>); })()}
      {!ev && hud.state === "roam" && hud.racerNear && !hud.shopNear && !hud.near && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center rounded-lg px-4 py-2" style={{ background: "rgba(24,0,22,0.72)", border: "1px solid rgba(255,79,216,0.75)", boxShadow: "0 0 18px rgba(255,79,216,0.3)" }}>
          <p className="font-pixel text-[11px]" style={{ color: "#ff9bea" }}>🏁 {hud.racerNear.name.toUpperCase()} · {hud.racerNear.tag.toUpperCase()}</p>
          <p className="text-[10px] text-white/85">ENTER or L — challenge to an outrun</p>
        </div>
      )}
      {/* prompts */}
      {!ev && hud.state === "roam" && (hud.shopNear || hud.near) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center rounded-lg px-4 py-2" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.25)" }}>
          {hud.shopNear ? (<><p className="font-pixel text-[11px] text-accentAmber">{hud.shopNear.name.toUpperCase()}</p><p className="text-[10px] text-white/80">ENTER — go inside</p></>) : (<><p className="font-pixel text-[11px]" style={{ color: hud.near.locked ? "#ff6b6b" : "#2de2ff" }}>{TYPE_ICON[hud.near.type]} {hud.near.name.toUpperCase()}</p><p className="text-[10px] text-white/80">{hud.near.locked ? hud.near.why.toUpperCase() : "ENTER — start · G — set GPS"}</p></>)}
        </div>
      )}
      {/* minimap + turn-by-turn (Upgrade 25: bigger, brighter, with the next turn spelled out) */}
      <GpsPanel hud={hud} miniRef={miniRef} accent={accent} />
      {/* speedo: a round dial in the Underground 2 style - rpm arc, tick marks, needle, gear, and a nitrous arc around the outside */}
      <div className="absolute bottom-2 right-3" style={{ width: 200, height: 200 }}>
        <Dial kmh={hud.kmh} rpm={hud.rpm} nitro={hud.nitro} nos={hud.nos} gear={hud.gear} accent={accent} />
      </div>
      {hud.hit && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 90px rgba(255,60,60,0.35)" }} />}
    </div>
  );
}

// =============================== GPS PANEL ===============================================================================================
const fmtDist = (d) => (d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.max(0, Math.round(d / 10) * 10) + " m");
function TurnArrow({ dir, ang, end, size = 46 }) {
  const uturn = !end && ang > 2.3, st = { filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))" };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ ...st, transform: dir < 0 ? "scaleX(-1)" : "none" }} fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
      {end ? <><path d="M14 42 V8" /><path d="M14 9 H36 L30 17 L36 25 H14" fill="#ffd23a" stroke="#ffd23a" strokeWidth="3" /></>
        : dir === 0 ? <path d="M24 42 V10 M12 22 L24 9 L36 22" />
        : uturn ? <path d="M34 42 V18 Q34 8 24 8 Q14 8 14 18 V28 M6 21 L14 31 L22 21" />
        : ang < 1.0 ? <path d="M16 42 V30 Q16 22 24 18 L34 12 M27 8 L36 12 L32 21" />
        : <path d="M12 42 V27 Q12 17 22 17 H35 M28 8 L37 17 L28 26" />}
    </svg>
  );
}
function GpsPanel({ hud, miniRef, accent }) {
  const [vp, setVp] = useState(() => (typeof window !== "undefined" ? [window.innerWidth, window.innerHeight] : [1280, 720]));
  useEffect(() => { const f = () => setVp([window.innerWidth, window.innerHeight]); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const racing = !!(hud.ev && hud.ev.gates != null), g = hud.gps;
  const S = Math.max(176, Math.min(360, Math.round(Math.min(vp[1] * 0.3, vp[0] * 0.24) * (hud.ev ? 1.2 : 1)))); // bigger on bigger screens, a little bigger again during a race
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1), px = Math.round(S * dpr);
  const col = racing ? "#ffc23a" : "#e9a23b";
  let banner = null;
  if (g && g.wrong) banner = (<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 animate-pulse" style={{ background: "rgba(150,10,10,0.88)", border: "2px solid #ff6b6b" }}><span className="text-xl">⚠</span><span className="font-pixel text-[10px]">WRONG WAY — TURN AROUND</span></div>);
  else if (g) banner = (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1" style={{ background: "rgba(6,12,22,0.86)", border: `2px solid ${col}`, boxShadow: `0 0 14px ${col}55` }}>
      <TurnArrow dir={g.dir} ang={g.ang} end={g.end} size={Math.round(S * 0.22)} />
      <div className="leading-tight">
        <div className="font-pixel" style={{ fontSize: Math.round(S * 0.085), color: "#fff" }}>{fmtDist(g.d)}</div>
        <div className="font-mono" style={{ fontSize: Math.max(9, Math.round(S * 0.05)), color: col }}>{g.end ? (racing ? "FINISH" : "DESTINATION") : g.ang > 2.3 ? "U-TURN" : g.ang > 1.0 ? (g.dir < 0 ? "TURN LEFT" : "TURN RIGHT") : g.dir < 0 ? "BEAR LEFT" : "BEAR RIGHT"}</div>
      </div>
    </div>);
  return (
    <div className="absolute bottom-3 left-4 flex flex-col items-start gap-1.5" style={{ width: S }}>
      {banner}
      <div style={{ position: "relative", width: S, height: S, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.75))" }}>
        <canvas ref={miniRef} width={px} height={px} style={{ width: S, height: S, borderRadius: "50%", background: "#0b1b2b" }} />
      </div>
      <div className="font-mono flex justify-between w-full px-1 whitespace-nowrap" style={{ fontSize: Math.max(9, Math.round(S * 0.05)), textShadow: "0 0 6px #000, 0 0 3px #000" }}>
        <span style={{ color: col }}>{racing && g && g.gate != null ? "NEXT CHECKPOINT · " + fmtDist(g.gate) : hud.nav != null ? "GPS · " + fmtDist(hud.nav) : "NO GPS ROUTE SET"}</span>
        <span className="text-white/65">ZOOM {String(hud.zoom || "auto").toUpperCase()} (Z)</span>
      </div>
    </div>
  );
}

// =============================== RESULT ==================================================================================================
function OutrunBar({ o }) {
  const frac = Math.max(-1, Math.min(1, o.lead / o.win)), ahead = o.lead >= 0, col = ahead ? "#6bff9a" : "#ff6b6b";
  return (
    <div className="mt-1 mx-auto" style={{ width: 300 }}>
      <div className="flex justify-between font-pixel text-[9px]"><span style={{ color: "#ff6b6b" }}>{o.vs.toUpperCase()}</span><span style={{ color: "#6bff9a" }}>YOU</span></div>
      <div className="relative h-3 rounded" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.3)" }}>
        <div className="absolute top-0 bottom-0" style={{ left: "50%", width: `${Math.abs(frac) * 50}%`, transform: frac < 0 ? "translateX(-100%)" : "none", background: col, boxShadow: `0 0 10px ${col}` }} />
        <div className="absolute w-px bg-white/80" style={{ left: "50%", top: -2, bottom: -2 }} />
      </div>
      <p className="font-pixel text-lg leading-tight mt-0.5" style={{ color: col }}>{ahead ? "+" : ""}{o.lead} m</p>
      <p className="text-[10px] text-white/70">{!o.live ? "GET READY…" : o.hold > 0.05 ? (o.side > 0 ? `HOLD THE LEAD · ${Math.max(0, OUT.HOLD - o.hold).toFixed(1)}` : `CLOSE THE GAP · ${Math.max(0, OUT.HOLD - o.hold).toFixed(1)}`) : `OPEN A ${o.win} m LEAD TO WIN`} · {Math.ceil(o.left)}s left</p>
    </div>
  );
}
function ResultCard({ res, accent, onClose }) {
  const m = res.medal; const ev = res.ev;
  if (res.outrun) {
    const o = res.outrun; const car = P.CARS.find((c) => c.id === o.car);
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: "rgba(0,0,0,0.65)" }}>
        <div className="w-[420px] max-w-[90%] rounded-xl border bg-bgPanel p-5 text-center" style={{ borderColor: o.won ? "#6bff9a" : "#ff6b6b" }}>
          <p className="font-pixel text-[10px] text-textDim mb-1">{ev.name.toUpperCase()}</p>
          <p className="font-pixel text-2xl mb-1" style={{ color: o.won ? "#6bff9a" : "#ff6b6b" }}>{o.won ? "OUTRUN WON" : "OUTRUN LOST"}</p>
          <p className="font-mono text-[11px] text-textDim mb-2">{o.name} · {o.tag}{car ? " · " + car.name : ""} · {["STREET", "PRO", "ACE"][o.tier - 1]}</p>
          <p className="font-mono text-[11px] italic text-textLight mb-2">“{o.line}”</p>
          <p className="font-mono text-[11px] text-textDim mb-1">Gap at the end {o.lead >= 0 ? "+" : ""}{o.lead} m · {fmtTime(o.time)}</p>
          {o.won && res.reward && <p className="font-mono text-[12px] text-accentAmber my-2">+{money(res.reward.cash)} · +{res.reward.xp} XP</p>}
          {!o.won && res.reward && res.reward.xp > 0 && <p className="font-mono text-[11px] text-textDim my-2">+{res.reward.xp} XP for trying</p>}
          {o.won && o.first && <p className="font-pixel text-[9px] text-accentCyan my-1">FIRST TIME BEATING {o.name.toUpperCase()}: 60% BONUS</p>}
          {o.won && o.streak > 1 && <p className="font-pixel text-[9px] my-1" style={{ color: "#ffd23a" }}>{o.streak} OUTRUNS WON IN A ROW: +{Math.min(5, o.streak - 1) * 10}% BONUS</p>}
          <Btn onClick={onClose} color={accent}>CONTINUE (ENTER)</Btn>
        </div>
      </div>
    );
  }
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
        {res.rival && <div className="my-2 rounded-lg border border-lineColor bg-bgPanel px-3 py-2"><p className="font-pixel text-[9px]" style={{ color: res.rival.rankUp ? "#6bff9a" : "#ff6b6b" }}>{res.rival.rankUp ? (res.rival.rank === 1 ? "YOU ARE #1 ON THE BLACKLIST" : `BLACKLIST #${res.rival.rank} — ${res.rival.name.toUpperCase()} BEATEN`) : `${res.rival.name.toUpperCase()} HOLDS #${res.rival.rank}`}</p><p className="font-mono text-[10px] text-textDim mt-1">“{res.rival.line}”</p></div>}
        {res.unlocked && <p className="font-pixel text-[10px] text-accentCyan my-2">NEW CAR UNLOCKED: {P.CARS.find((c) => c.id === res.unlocked).name.toUpperCase()}</p>}
        <Btn onClick={onClose} color={accent}>CONTINUE (ENTER)</Btn>
      </div>
    </div>
  );
}

// the plain-words "what the next tier does" line for one tuning part
function gainText(id, a, b) {
  const pc = (x, y) => Math.round((y / x - 1) * 100);
  switch (id) {
    case "engine": return `Top speed ${Math.round(a.vmax * 3.6)} → ${Math.round(b.vmax * 3.6)} km/h · launch +${pc(a.accel, b.accel)}%`;
    case "turbo": return `Top speed ${Math.round(a.vmax * 3.6)} → ${Math.round(b.vmax * 3.6)} km/h · pull +${pc(a.accel, b.accel)}%`;
    case "gears": return `Gear change ${a.shift.toFixed(2)}s → ${b.shift.toFixed(2)}s · less power lost between gears`;
    case "tires": return `Grip +${pc(a.grip, b.grip)}% · steering +${pc(a.yaw, b.yaw)}%`;
    case "brakes": return `Braking power +${pc(a.brake, b.brake)}%`;
    case "weight": return `Launch +${pc(a.accel, b.accel)}% · steering +${pc(a.yaw, b.yaw)}% · grip +${pc(a.grip, b.grip)}%`;
    case "aero": return `Downforce level ${a.aero} → ${b.aero} · more grip, most of all at high speed`;
    case "diff": return `Slides lose ${Math.round((b.diff) * 15)}% less speed · better in the wet`;
    default: return `Nitrous kick +${pc(a.nitroPower, b.nitroPower)}% · lasts ${Math.round((b.nitroDrain < a.nitroDrain ? a.nitroDrain / b.nitroDrain - 1 : 0) * 100)}% longer`;
  }
}

// =============================== SHOPS ====================================================================================================
function ShopPanel({ G, shop, draft, setDraft, onClose, accent, refresh, onQuit, musicRef }) {
  const career = G.career; const spec = specOf({ ...(career.spec || DEFAULT_SPEC), car: career.car });
  const shown = draft || spec; const pending = draft ? pendingItems(draft, career.owned) : []; const pendCost = pending.reduce((a, x) => a + x.cost, 0);
  const car = P.CARS.find((c) => c.id === career.car);
  const tune = G.tuneOf(car.id); const stats = P.cityStats(car, tune, spec.kit); const rating = P.carRating(stats);
  const apply = () => { if (!draft) return; if (career.cash < pendCost) { sfx.wrong(); return; } sfx.correct(); career.cash -= pendCost; career.owned.push(...pending.map((x) => `${x.group}:${x.id}`)); career.spec = { ...draft, car: undefined }; career.spec.car = career.car; setDraft(null); G.restat(); refresh(); };
  const pick = (id) => { if (!career.carsOwned.includes(id)) { sfx.wrong(); return; } sfx.tap(); career.car = id; career.spec = { ...(career.spec || DEFAULT_SPEC), car: id }; setDraft(null); G.restat(); refresh(); };
  const buy = (id) => { if (G.buyUpgrade(id)) { sfx.correct(); refresh(); } else sfx.wrong(); };
  const garage = shop.kind === "garage"; const [sec, setSec] = useState("perf"); const kind = garage ? sec : shop.kind; // a hidden garage is every workshop in one: its carousel strip switches sections
  const shownA = useMemo(() => ({ ...shown, audio: career.audio || 0 }), [shown, career.audio]); // eslint-disable-line react-hooks/exhaustive-deps
  const visualRating = Math.min(10, 4.5 + (career.owned.length + pending.length) * 0.1 + (career.audio || 0) * 0.3);
  const AUD = [{ n: "Stock speakers", cost: 0, db: 0 }, { n: "Audio Layout 1", cost: 2500, db: 4 }, { n: "Audio Layout 2", cost: 6000, db: 7 }, { n: "Audio Layout 3", cost: 12000, db: 10 }];
  const audOwned = career.audioOwned || [0];
  const setAudio = (i) => { const o = AUD[i]; const owned = audOwned.includes(i); if (!owned) { if (career.cash < o.cost) { sfx.wrong(); return; } career.cash -= o.cost; career.audioOwned = [...audOwned, i]; } career.audio = i; sfx.correct(); try { const m = musicRef && musicRef.current; m && m.setBass && m.setBass(o.db); } catch {} refresh(); };
  const buyCar = (c) => { if (career.carsOwned.includes(c.id) || !c.price || career.cash < c.price || !G.carUnlocked(c)) { sfx.wrong(); return; } career.cash -= c.price; career.carsOwned.push(c.id); sfx.correct(); pick(c.id); };
  return (
    <div className="absolute inset-0 pointer-events-auto overflow-y-auto" style={{ background: "radial-gradient(ellipse at 50% 18%, #20202c 0%, #0a0a12 62%, #040408 100%)" }}>
      <div className="max-w-5xl mx-auto p-4">
        <p className="italic font-bold text-xl" style={{ color: "#c6ff5a", textShadow: "0 0 10px rgba(150,255,60,0.35)", fontFamily: "Georgia, serif" }}>{shop.name}</p>
        {/* the Underground-2 carousel strip: every garage section, the current one lit */}
        <div className="mt-1 mb-1 rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))", border: "1px solid rgba(255,255,255,0.18)" }}>
          {[["perf", "🔧", "Performance"], ["visual", "🎨", "Visual"], ["lot", "🚗", "Cars"], ["audio", "🔊", "Audio"], ["home", "🏠", "Garage"]].map(([k, ic, lb]) => (
            <div key={k} onClick={garage ? () => { setSec(k); sfx.tap(); } : undefined} className="flex-1 text-center rounded-md py-1" style={{ cursor: garage ? "pointer" : "default", background: kind === k ? "rgba(20,30,10,0.85)" : "rgba(0,0,0,0.25)", border: kind === k ? "2px solid #c6ff5a" : "2px solid transparent", boxShadow: kind === k ? "0 0 12px rgba(150,255,60,0.35)" : "none", opacity: kind === k ? 1 : 0.55 }}>
              <div className="text-2xl leading-none">{ic}</div><p className="text-[9px] font-mono text-white/70">{lb}</p></div>))}
          <div className="text-right pl-2 border-l border-white/20"><p className="text-[9px] font-mono text-white/60">CASH</p><p className="font-mono text-sm text-white">{money(career.cash)}</p></div>
        </div>
        <p className="italic text-sm mb-3 text-center" style={{ color: "#c6ff5a", fontFamily: "Georgia, serif" }}>{shop.blurb}</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 30px rgba(255,200,60,0.12)" }}>
              <Showroom spec={shownA} height={290} />
              <div className="absolute left-3 top-2 pointer-events-none"><p className="font-mono text-[10px] text-white/70">{car.name.toUpperCase()}</p><p className="font-mono text-[10px]" style={{ color: "#ffd23a" }}>VISUAL RATING {visualRating.toFixed(2)} ★</p></div>
            </div>
            <div className="mt-2 rounded-md px-3 py-2" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {[["ACCELERATION", stats.accel / 62], ["TOP SPEED", stats.vmax / 102], ["HANDLING", stats.grip / 12], ["BRAKING", (stats.brake - 1) / 0.32 * 0.6 + 0.35], ["NITROUS", (stats.nitroPower - 1) / 0.5 * 0.7 + 0.3]].map(([l, v]) => (
                <div key={l} className="flex items-center gap-2 mb-1"><span className="w-28 text-[10px] font-bold italic" style={{ color: "#c6ff5a", fontFamily: "Georgia, serif" }}>{l}</span><div className="flex-1 h-2 rounded-sm" style={{ background: "#26261f" }}><div className="h-full rounded-sm" style={{ width: `${Math.round(Math.min(1, v) * 100)}%`, background: "linear-gradient(90deg,#3fae1d,#9aff3a)", boxShadow: "0 0 6px #6bff2a" }} /></div></div>))}
              <p className="text-[9px] font-mono text-white/50 mt-1">{Math.round(stats.vmax * 3.6)} km/h top · nitro {stats.nitroPower.toFixed(2)}x</p><p className="mt-1 font-pixel text-[10px]" style={{ color: "#ffd23a" }}>RATING {rating} · CLASS {P.carClass(rating)}</p>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={onClose} className="px-5 py-1 rounded-full text-xs italic font-bold text-white" style={{ border: "2px solid rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.5)", fontFamily: "Georgia, serif" }}>Back</button>
              <button onClick={onClose} className="px-5 py-1 rounded-full text-xs italic font-bold text-white" style={{ border: "2px solid rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.5)", fontFamily: "Georgia, serif" }}>Continue</button>
              <button onClick={onQuit} className="px-5 py-1 rounded-full text-xs italic font-bold text-white" style={{ border: "2px solid rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.5)", fontFamily: "Georgia, serif" }}>Quit Game</button>
            </div>
          </div>
          <div>
            {kind === "perf" && (<div className="flex flex-col gap-3"><p className="font-pixel text-[9px] text-accentCyan">PERFORMANCE — {car.name.toUpperCase()}</p><p className="font-mono text-[10px] text-textDim -mt-1">Nine tuning lines. Upgrades stay on this car. A faster car costs more to tune, but every step gains more. The best tiers need a higher driver level (you are level {G.level()}).</p>{P.CITY_UPGRADES.map((u) => { const lv = tune[u.id] || 0; const max = lv >= u.max; const cost = G.upgradeCost(u.id); const nx = max ? null : P.cityStats(car, { ...tune, [u.id]: lv + 1 }, spec.kit); const need = max ? 1 : G.upgradeLock(u.id); const locked = !max && G.level() < need; return (
              <div key={u.id} className="rounded-lg border border-lineColor bg-bgPanel p-3" style={{ opacity: locked ? 0.7 : 1 }}><div className="flex justify-between items-center gap-2"><div><p className="font-pixel text-[10px] text-textLight">{u.name.toUpperCase()} <span className="text-textDim">LV {lv}/{u.max}</span></p><p className="font-mono text-[10px] text-textDim">{u.blurb}</p>{!max && !locked && <p className="font-mono text-[10px] mt-1" style={{ color: "#9aff3a" }}>NEXT: {gainText(u.id, stats, nx)}</p>}{locked && <p className="font-mono text-[10px] mt-1" style={{ color: "#ffb347" }}>Tier {lv + 1} opens at driver level {need}</p>}</div><Btn small disabled={max || locked || career.cash < cost} onClick={() => buy(u.id)} color={accent}>{max ? "MAX" : locked ? `LEVEL ${need}` : `BUY ${money(cost)}`}</Btn></div>
                <div className="flex gap-1 mt-2">{Array.from({ length: u.max }).map((_, i) => <div key={i} className="flex-1 h-1.5 rounded" style={{ background: i < lv ? accent : "#222238" }} />)}</div></div>); })}</div>)}
            {kind === "audio" && (<div><p className="font-pixel text-[9px] text-accentCyan mb-2">AUDIO SHOP</p><div className="flex flex-col gap-2">{AUD.map((o, i) => { const owned = audOwned.includes(i), on = (career.audio || 0) === i; return (
              <div key={i} className="rounded-lg border bg-bgPanel p-3 flex items-center gap-3" style={{ borderColor: on ? "#c6ff5a" : "#2a2a44" }}><div className="flex-1"><p className="font-pixel text-[10px] text-textLight">{o.n.toUpperCase()}</p><p className="font-mono text-[10px] text-textDim">{i === 0 ? "The radio as it comes." : `Subwoofers and amps: +${o.db} dB of bass on the radio. ${i === 3 ? "A full boot of blue-lit speakers." : i === 2 ? "Two subs and a lit amp rack." : "A single sub and amp."}`}</p></div>
                <Btn small disabled={on || (!owned && career.cash < o.cost)} onClick={() => setAudio(i)} color={accent}>{on ? "INSTALLED" : owned ? "SWITCH" : `BUY ${money(o.cost)}`}</Btn></div>); })}</div>
              <p className="font-mono text-[10px] text-textDim mt-3">The speaker stacks beside your car on the turntable show the layout; the bass boost is heard on the radio while you drive.</p></div>)}
            {kind === "visual" && (<div><p className="font-pixel text-[9px] text-accentCyan mb-2">LOOKS</p><CustomisePanel draft={shown} owned={career.owned} accent={accent} currency={CUR} onChange={(d) => { setDraft(d); sfx.tap(); }} />
              <div className="mt-3 flex items-center gap-3"><Btn small color={accent} disabled={!draft || career.cash < pendCost} onClick={apply}>{draft ? (pendCost ? `BUY & APPLY ${money(pendCost)}` : "APPLY") : "NO CHANGES"}</Btn>{draft && <Btn small color="#667" onClick={() => setDraft(null)}>RESET</Btn>}</div></div>)}
            {(kind === "lot" || kind === "home") && (<div><p className="font-pixel text-[9px] text-accentCyan mb-2">{kind === "lot" ? "THE LOT" : "YOUR CARS"}</p><div className="flex flex-col gap-2">{[...P.CARS].sort((a, b) => P.carRating(P.cityStats(a)) - P.carRating(P.cityStats(b))).map((c) => { const own = career.carsOwned.includes(c.id); const s = P.cityStats(c, own ? G.tuneOf(c.id) : undefined); const rt = P.carRating(s); const lockedLvl = !own && !G.carUnlocked(c); const need = c.id === "phantom" ? "Beat Saint (#4) on the Ladder" : c.id === "specter" ? "Beat Kage (#1) on the Ladder" : lockedLvl ? `Unlocks at level ${c.level} · ${money(c.price)}` : ""; return (
              <div key={c.id} className="rounded-lg border bg-bgPanel p-3 flex items-center gap-3" style={{ borderColor: career.car === c.id ? accent : "#2a2a44" }}><div className="flex-1"><p className="font-pixel text-[10px] text-textLight">{c.name.toUpperCase()}{c.hero && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded border" style={{ borderColor: "#ffb347", color: "#ffb347" }}>HERO</span>}</p><p className="font-mono text-[10px] text-textDim">{c.blurb}</p><p className="font-mono text-[9px] text-textDim mt-1">{Math.round(s.vmax * 3.6)} km/h · accel {s.accel.toFixed(0)} · grip {s.grip.toFixed(1)} · <span style={{ color: "#ffd23a" }}>RATING {rt} · CLASS {P.carClass(rt)}</span></p></div>
                <Btn small disabled={career.car === c.id || (!own && !c.price) || lockedLvl || (!own && career.cash < c.price)} onClick={() => (own ? pick(c.id) : buyCar(c))} color={accent}>{career.car === c.id ? "DRIVING" : own ? "DRIVE" : lockedLvl ? "LOCKED" : c.price ? `BUY ${money(c.price)}` : "LOCKED"}</Btn>{!own && need && <p className="font-mono text-[9px] text-accentAmber w-32">{need}</p>}</div>); })}</div>
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
function PausePanel({ G, tab, setTab, sel, setSel, evFilter, setEvFilter, accent, onResume, onQuit, muted, onMute, onIntro, canIntro, view, free }) {
  const stage = useStage(); const [resSel, setResSel] = useState(view ? view.resolution : "auto"); const [reflOn, setReflOn] = useState(view && view.reflections ? true : false); const [resSize, setResSize] = useState(""); const RESM = [["auto", "AUTO"], ["hd", "HD 1080p"], ["qhd", "QHD 1440p"], ["4k", "4K 2160p"], ["low", "SAVER"]]; const pickRes = (m) => { if (!view) return; view.setResolution(m); setResSel(m); setTimeout(() => { try { const s = view.renderSize; setResSize(s[0] + " × " + s[1]); } catch {} }, 80); }; const todNow = view && view.timeOfDayLabel ? view.timeOfDayLabel : ""; const [fch, setFch] = useState(view ? view.festivalChoice : "auto"); const FCH = [["auto", "AUTO (BY DATE)"], ["ganapati", "GANESH CHATURTHI"], ["navratri", "NAVRATRI"], ["diwali", "DIWALI"], ["off", "OFF"]];
  const cycleFest = () => { if (!view) return; const k = FCH[(FCH.findIndex((f) => f[0] === fch) + 1) % FCH.length][0]; view.setFestival(k); setFch(k); sfx.tap(); };
  const tabs = [["map", "MAP"], ["events", "EVENTS"], ["career", "CAREER"], ["options", "OPTIONS"]];
  return (
    <div className="absolute inset-0 pointer-events-auto flex flex-col" style={{ background: "rgba(4,4,12,0.94)" }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-lineColor">
        <p className="font-pixel text-[11px] mr-3" style={{ color: accent }}>PAUSED</p>
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); sfx.tap(); }} className="font-pixel text-[9px] px-3 py-1.5 rounded" style={{ background: tab === k ? accent : "transparent", color: tab === k ? "#07070f" : "#aab" }}>{l}</button>)}
        <div className="flex-1" />{!free && todNow && <span className="font-mono text-[10px] px-2 py-1 rounded border border-white/15" style={{ color: "#ffb48a" }}>{"🌅 " + todNow}</span>}{!free && !IS_TOKYO && view && view.festivalActive && view.festivalActive !== "off" && <span className="font-mono text-[10px] px-2 py-1 rounded border border-white/15" style={{ color: "#ffb347" }}>{"🪔 " + ({ ganapati: "GANESH CHATURTHI", navratri: "NAVRATRI", diwali: "DIWALI" })[view.festivalActive]}</span>}<Btn small color="#9fd0ff" onClick={() => stage.toggle()}>{stage.isFull ? "EXIT FULLSCREEN" : "⛶ FULLSCREEN"}</Btn>{!free && <Btn small color="#c7a6ff" disabled={!canIntro} onClick={onIntro}>▶ WATCH INTRO</Btn>}<Btn small color="#6bff9a" onClick={onResume}>RESUME (P)</Btn>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "map" && <MapTab G={G} sel={sel} setSel={setSel} accent={accent} onResume={onResume} />}
        {tab === "events" && <EventsTab G={G} filter={evFilter} setFilter={setEvFilter} accent={accent} onResume={onResume} />}
        {tab === "career" && <CareerTab G={G} accent={accent} onQuit={() => onQuit(true)} onResume={onResume} />}
        {tab === "options" && <div className="p-6 max-w-md mx-auto flex flex-col gap-3 items-stretch">
          <Btn onClick={onMute} color="#9fd4ff">{muted ? "SOUND OFF — TURN ON" : "SOUND ON — TURN OFF"}</Btn>
          {!free && view && <div className="rounded-lg border border-white/15 p-3"><div className="font-mono text-[10px] text-textDim mb-2 tracking-widest">PICTURE QUALITY</div><div className="grid grid-cols-3 gap-2">{RESM.map(([k, l]) => <Btn key={k} small color={resSel === k ? accent : "#667"} onClick={() => pickRes(k)}>{l}</Btn>)}</div><p className="font-mono text-[10px] text-textDim mt-2">{resSize ? "Drawing " + resSize + " pixels. " : ""}AUTO is the smooth-play mode: it watches your frame rate all the time and quietly moves between 8 picture steps (sharpness, shadows, glow, crowds, plants) so the game stays smooth on an everyday laptop.{view.quality && resSel === "auto" ? " Right now: step " + (view.quality.level + 1) + " of " + view.quality.steps + " (" + view.quality.name + ")." : ""} SAVER is the lightest fixed setting. HD, QHD and 4K lock the sharpness and need a stronger graphics card.</p></div>}
          {!free && todNow && <div className="rounded-lg border border-white/15 p-3"><div className="font-mono text-[10px] text-textDim mb-2 tracking-widest">TIME OF DAY</div><p className="font-mono text-[11px] text-textLight">{"🌅 Right now: " + todNow}</p><p className="font-mono text-[10px] text-textDim mt-2">The hours pass by themselves: sunset, then dusk as the lamps come on, then a long night, and the glow slowly returns. It can't be changed.</p></div>}
          {!free && view && view.setReflections && <div className="rounded-lg border border-white/15 p-3"><div className="font-mono text-[10px] text-textDim mb-2 tracking-widest">WET-ROAD REFLECTIONS</div><div className="grid grid-cols-2 gap-2">{[[false, "OFF"], [true, "ON"]].map(([v, l]) => <Btn key={l} small color={reflOn === v ? accent : "#667"} onClick={() => { view.setReflections(v); setReflOn(v); }}>{l}</Btn>)}</div><p className="font-mono text-[10px] text-textDim mt-2">In the rain the road mirrors the buildings and neon. It draws the city a second time, so it needs a strong graphics card. Off by default.</p></div>}
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
let lastMapSpan = 8000; // how far across the map was last time (metres): the map opens at the same zoom again, centred on the car
export function MapTab({ G, sel, setSel, accent, onResume }) {
  const wrap = useRef(null), cv = useRef(null), selRef = useRef(sel), raf = useRef(0), settle = useRef(0), drag = useRef(null), hover = useRef(null);
  const [size, setSize] = useState([800, 600]); const [ready, setReady] = useState(false);
  const things = useMemo(() => {
    const a = []; for (const ev of G.events) a.push({ kind: "event", id: ev.id, x: ev.sx, z: ev.sz, ev, name: ev.name });
    for (const sh of G.shopList()) a.push({ kind: "shop", id: sh.id, x: sh.x, z: sh.z, sh, name: sh.name });
    for (const s of G.content.sights) a.push({ kind: "sight", id: s.id, x: s.lx ?? s.x, z: s.lz ?? s.z, s, name: s.name }); return a; // sights are drawn where the monument itself stands (the road point beside it is only the GPS target)
  }, [G]);
  // The big map is drawn as sharp lines for the part of the world on screen (engine/open/fullMap.js), and every marker is placed from real world metres
  const fm = useMemo(() => createFullMap(G.city), [G]);
  selRef.current = sel;
  const paint = useRef(null);
  paint.current = () => {
    raf.current = 0; const c = cv.current; if (!c) return; const g = c.getContext("2d"), v = fm.view; g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    fm.draw(g);
    const s0 = selRef.current, P1 = G.player, at = (x, z) => fm.toScreen(x, z);
    const dot = (x, z, col, r, ring) => { const [sx, sy] = at(x, z); if (sx < -20 || sy < -20 || sx > v.w + 20 || sy > v.h + 20) return; g.fillStyle = col; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.strokeStyle = ring || "rgba(0,0,0,0.85)"; g.lineWidth = ring ? 2 : 1.5; g.stroke(); };
    if (G.nav && G.nav.line && G.nav.line.length > 1) {
      const L = G.nav.line, st = L.length > 1500 ? 2 : 1; g.lineJoin = g.lineCap = "round";
      const trace = () => { g.beginPath(); for (let i = 0; i < L.length; i += st) { const [sx, sy] = at(L[i].x, L[i].z); if (i === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy); } };
      trace(); g.strokeStyle = "rgba(0,0,0,0.8)"; g.lineWidth = 6; g.stroke(); trace(); g.strokeStyle = "#2de2ff"; g.lineWidth = 3.4; g.stroke();
    }
    const labelsOn = v.ppm >= 0.3; let selT = null;
    for (const t of things) {
      const isSel = s0 && s0.id === t.id; if (isSel) selT = t;
      if (t.kind === "event") { const done = G.career.done[t.id]; const unl = G.isUnlocked(t.ev); dot(t.x, t.z, t.ev.type === "trap" ? "#ff6b6b" : !unl ? "#7a3030" : done ? MEDAL_COL[done.medal] : "#ffffff", isSel ? 8 : 5.5, isSel ? accent : undefined); }
      else if (t.kind === "shop") dot(t.x, t.z, t.sh.kind === "garage" ? "#b45cff" : "#ffb703", isSel ? 9 : 7, isSel ? accent : "#fff");
      else dot(t.x, t.z, G.career.sights.includes(t.id) ? "#6bff9a" : "#9fd4ff", isSel ? 7 : 4.4, isSel ? accent : undefined);
    }
    const tag = (t, big) => { const [sx, sy] = at(t.x, t.z); if (sx < -60 || sy < -20 || sx > v.w + 60 || sy > v.h + 20) return; g.font = `${big ? 700 : 600} ${big ? 12 : 10.5}px system-ui, Arial, sans-serif`; g.textAlign = "left"; g.textBaseline = "middle"; g.lineWidth = 3.2; g.lineJoin = "round"; g.strokeStyle = "rgba(4,9,16,0.9)"; g.fillStyle = big ? "#fff" : "rgba(214,228,248,0.92)"; g.strokeText(t.name, sx + 11, sy - 1); g.fillText(t.name, sx + 11, sy - 1); };
    if (labelsOn) for (const t of things) if (t.kind !== "event" && t !== selT) tag(t, false);
    const hv = hover.current && things.find((t) => t.id === hover.current); if (hv && hv !== selT) tag(hv, false);
    if (selT) tag(selT, true);
    if (G.nav && G.nav.target) { const [sx, sy] = at(G.nav.target.x, G.nav.target.z); g.strokeStyle = "#fff"; g.fillStyle = "#2de2ff"; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 7.5, 0, 7); g.fill(); g.stroke(); g.strokeStyle = "rgba(45,226,255,0.55)"; g.beginPath(); g.arc(sx, sy, 14, 0, 7); g.stroke(); }
    if (s0 && s0.kind === "point") { const [sx, sy] = at(s0.x, s0.z); g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 9, 0, 7); g.moveTo(sx - 14, sy); g.lineTo(sx + 14, sy); g.moveTo(sx, sy - 14); g.lineTo(sx, sy + 14); g.stroke(); }
    // the car: a pink arrow pointing the way it faces; if it is off screen, an arrow at the edge shows which way to go
    const [px, py] = at(P1.x, P1.z), off = px < 14 || py < 14 || px > v.w - 14 || py > v.h - 14;
    g.save();
    if (!off) { g.translate(px, py); g.fillStyle = "rgba(255,45,149,0.22)"; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill(); g.rotate(P1.yaw + Math.PI / 2); }
    else { const ang = Math.atan2(py - v.h / 2, px - v.w / 2), k2 = Math.min((v.w / 2 - 22) / Math.max(1e-6, Math.abs(Math.cos(ang))), (v.h / 2 - 22) / Math.max(1e-6, Math.abs(Math.sin(ang)))); g.translate(v.w / 2 + Math.cos(ang) * k2, v.h / 2 + Math.sin(ang) * k2); g.rotate(ang + Math.PI / 2); }
    g.fillStyle = "#ff2d95"; g.strokeStyle = "#fff"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, -11); g.lineTo(8.5, 10); g.lineTo(0, 5); g.lineTo(-8.5, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
  };
  const request = () => { if (!raf.current) raf.current = requestAnimationFrame(() => paint.current && paint.current()); };
  const refineSoon = (ms = 130) => { clearTimeout(settle.current); settle.current = setTimeout(() => { fm.refine(); lastMapSpan = fm.span; request(); }, ms); };
  useEffect(() => { const el = wrap.current; if (!el) return; const f = () => setSize([Math.max(320, Math.round(el.clientWidth)), Math.max(260, Math.round(el.clientHeight))]); f(); setReady(true); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(f) : null; if (ro) ro.observe(el); window.addEventListener("resize", f); return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", f); }; }, []);
  const started = useRef(false);
  useEffect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), c = cv.current; if (!c || !ready) return;
    c.width = Math.round(size[0] * dpr); c.height = Math.round(size[1] * dpr); fm.resize(size[0], size[1], dpr);
    if (!started.current) { started.current = true; fm.focus(G.player.x, G.player.z, lastMapSpan); }
    fm.refine(); request();
  }, [size, fm, ready]); // eslint-disable-line
  useEffect(() => { request(); }, [sel, things]); // eslint-disable-line
  useEffect(() => { // the mouse wheel zooms towards the pointer (a real listener, because the page must not scroll)
    const c = cv.current; if (!c) return;
    const wheel = (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); fm.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016))); request(); refineSoon(); };
    c.addEventListener("wheel", wheel, { passive: false });
    return () => { c.removeEventListener("wheel", wheel); clearTimeout(settle.current); if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [fm]); // eslint-disable-line
  const spot = (e) => { const r = cv.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const nearest = (sx, sy) => { let best = null, bd = 15; for (const t of things) { const [tx, ty] = fm.toScreen(t.x, t.z); const d = Math.hypot(tx - sx, ty - sy); if (d < bd) { bd = d; best = t; } } return best; };
  function down(e) { if (e.button !== 0) return; const [sx, sy] = spot(e); drag.current = { sx, sy, x0: sx, y0: sy, moved: false }; try { cv.current.setPointerCapture(e.pointerId); } catch {} }
  function move(e) {
    const [sx, sy] = spot(e), d = drag.current;
    if (d) { if (!d.moved && Math.hypot(sx - d.x0, sy - d.y0) > 4) d.moved = true; if (d.moved) { fm.pan(sx - d.sx, sy - d.sy); d.sx = sx; d.sy = sy; request(); refineSoon(); } return; }
    const h = nearest(sx, sy), id = h ? h.id : null; if (id !== hover.current) { hover.current = id; cv.current.style.cursor = id ? "pointer" : "crosshair"; request(); }
  }
  function up(e) {
    const d = drag.current; drag.current = null; if (!d) return; try { cv.current.releasePointerCapture(e.pointerId); } catch {}
    if (d.moved) return; const [sx, sy] = spot(e), best = nearest(sx, sy);
    if (best) { setSel(best); sfx.tap(); } else { const [wx, wz] = fm.toWorld(sx, sy); setSel({ kind: "point", id: "pt", x: wx, z: wz }); }
  }
  const zoomBtn = (k) => { fm.zoomAt(fm.view.w / 2, fm.view.h / 2, k); request(); refineSoon(60); sfx.tap(); };
  const goMe = () => { fm.focus(G.player.x, G.player.z, Math.min(fm.span, 8000)); request(); refineSoon(40); sfx.tap(); };
  const goAll = () => { fm.fitAll(); request(); refineSoon(40); sfx.tap(); };
  const info = sel && (() => {
    if (sel.kind === "event") { const ev = sel.ev; const done = G.career.done[ev.id]; const unl = G.isUnlocked(ev); const seen = G.career.seen.includes(ev.id) && ev.type !== "trap";
      return { title: ev.name, sub: `${TYPE_LABEL[ev.type]} · ${ev.area || ""} · LV ${ev.level}`, body: ev.blurb, rows: [ev.reward ? `Reward up to ${money(ev.reward.cash)} · ${ev.reward.xp} XP` : "", done ? `Best: ${done.medal.toUpperCase()}${done.best != null ? " · " + (ev.type === "trap" ? done.best + " km/h" : ev.type === "drift" ? done.best.toLocaleString() : fmtTime(done.best)) : ""}` : "Not completed", !unl ? "🔒 " + G.lockReason(ev) : ""], ev, travel: seen && unl && ev.type !== "trap", pt: [ev.sx, ev.sz], label: ev.name }; }
    if (sel.kind === "shop") return { title: sel.sh.name, sub: sel.sh.kind === "garage" ? "Hidden garage · found" : "Shop", body: sel.sh.blurb, rows: [], travel: G.career.seen.includes(sel.sh.id), pt: [sel.sh.x, sel.sh.z], label: sel.sh.name };
    if (sel.kind === "sight") return { title: sel.s.name, sub: G.career.sights.includes(sel.id) ? "Discovered ✔" : "Undiscovered sight (+₹300, +110 XP)", body: "", rows: [], travel: false, pt: [sel.s.x, sel.s.z], label: sel.s.name };
    return { title: "Map point", sub: "", body: "", rows: [], travel: false, pt: [sel.x, sel.z], label: "Waypoint" };
  })();
  return (
    <div className="h-full flex">
      <div className="flex-1 p-2 min-w-0 min-h-0"><div ref={wrap} className="rounded-lg border border-lineColor" style={{ position: "relative", width: "100%", height: "100%", minHeight: 260, overflow: "hidden", background: "#09192a" }}>
        <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="cursor-crosshair select-none" style={{ position: "absolute", left: 0, top: 0, width: size[0], height: size[1], touchAction: "none" }} />
        <div className="flex flex-col gap-1.5" style={{ position: "absolute", top: 8, right: 8 }}>{[["+", () => zoomBtn(1.6), "Zoom in"], ["−", () => zoomBtn(1 / 1.6), "Zoom out"], ["ME", goMe, "Centre on your car"], ["ALL", goAll, "Show the whole map"]].map(([l, f, t]) => <button key={l} type="button" title={t} onClick={f} className="font-pixel text-[9px] rounded border px-2.5 py-2" style={{ background: "rgba(8,14,24,0.88)", borderColor: "rgba(190,215,250,0.45)", color: "#e8f0ff", minWidth: 40 }}>{l}</button>)}</div>
      </div></div>
      <div className="w-72 shrink-0 border-l border-lineColor p-4 overflow-y-auto">
        <p className="font-pixel text-[9px] text-accentCyan mb-2">MAP</p>
        <p className="font-mono text-[10px] text-textDim mb-3">Click anything to see it. Click empty map to drop a GPS pin. Mouse wheel zooms, drag moves the map, ME finds your car. <span className="text-white">● white</span> events · <span style={{ color: "#ffb703" }}>● shops</span> · <span style={{ color: "#b45cff" }}>● hidden garages (only once found)</span> · <span style={{ color: "#9fd4ff" }}>● sights</span></p>
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

function CareerTab({ G, accent, onQuit, onResume }) {
  const c = G.career; const lp = D.levelProgress(c.xp); const [, bump] = useState(0); const gp = G.garageProgress();
  const drive = (id) => { if (G.run || !c.carsOwned.includes(id)) { sfx.wrong(); return; } c.car = id; c.spec = { ...(c.spec || DEFAULT_SPEC), car: id }; G.restat(); sfx.tap(); bump((n) => n + 1); };
  const stat = (l, v) => <div className="rounded-lg border border-lineColor bg-bgPanel p-3 text-center"><p className="font-pixel text-sm text-textLight">{v}</p><p className="font-mono text-[9px] text-textDim mt-1">{l}</p></div>;
  const golds = Object.values(c.done).filter((d) => d.medal === "gold").length;
  const list = G.blacklist.map((r) => ({ r, st: G.rivalState(r) })).reverse();
  return (
    <div className="h-full overflow-y-auto p-4"><div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4"><span className="font-pixel text-3xl" style={{ color: accent }}>{gp.active ? gp.level : lp.level}</span><div className="flex-1"><Bar label="LEVEL" value={gp.held ? 1 : lp.frac} max={1} color={gp.held ? "#ffb347" : accent} right={gp.held ? `LEVEL ${gp.nextLevel} READY · NEEDS GARAGES` : lp.need ? `${lp.into}/${lp.need}` : "MAX"} /></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">{stat("CAREER SCORE", G.score().toLocaleString())}{stat("CASH", money(c.cash))}{stat("EVENTS DONE", `${Object.keys(c.done).length}/${G.events.length}`)}{stat("GOLD MEDALS", golds)}{stat("DISTANCE", (c.odo / 1000).toFixed(1) + " km")}{stat("TOP SPEED", c.topSpeed + " km/h")}{stat("NEAR MISSES", Math.floor(c.nearMiss))}{stat("BEST DRIFT", c.bestDrift.toLocaleString())}{stat("SIGHTS", `${c.sights.length}/${G.content.sights.length}`)}{stat("CASH STASHES", `${c.stash.length}/${G.content.stashes.length}`)}{stat("PLAY TIME", Math.floor(c.playT / 60) + " min")}{stat("CARS OWNED", c.carsOwned.length + "/5")}</div>
      {gp.active && (() => {
        const found = G.garages.filter((g) => G.garageFound(g.id)); const P1 = G.player;
        const hidden = G.garages.filter((g) => !G.garageFound(g.id)).map((g) => ({ g, d: Math.hypot(g.bx - P1.x, g.bz - P1.z) })).sort((a, b) => a.d - b.d).slice(0, 6);
        const levels = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((L) => [L, GN(L, gp.total)]);
        return (<div className="mb-5">
          <p className="font-pixel text-[9px] text-accentCyan mb-1">HIDDEN GARAGES <span className="text-textDim normal-case">· none is on the map or the GPS until you drive past it. Each new level needs more of them found.</span></p>
          <div className="rounded border border-lineColor bg-bgPanel p-3">
            <Bar label="FOUND" value={gp.found} max={Math.max(1, gp.total)} color="#b45cff" right={`${gp.found}/${gp.total}`} />
            <p className="font-mono text-[10px] mt-2" style={{ color: gp.held ? "#ffb347" : "#aab" }}>{gp.nextLevel ? (gp.more > 0 ? `Level ${gp.nextLevel} needs ${gp.need} garages found: ${gp.more} to go.${gp.held ? " You already have the XP for it." : ""}` : `You have enough garages for level ${gp.nextLevel}.`) : "Top level reached."}</p>
            <div className="flex flex-wrap gap-1 mt-2">{levels.map(([L, n]) => <span key={L} className="font-mono text-[9px] px-1.5 py-0.5 rounded border" style={{ borderColor: gp.found >= n ? "#b45cff" : "#2a2a44", color: gp.found >= n ? "#d9b3ff" : "#778" }}>LV {L}: {n}</span>)}</div>
            {hidden.length > 0 && <div className="mt-3"><p className="font-mono text-[10px] text-textDim mb-1">RUMOURS · the closest ones to you (look beside the road, a "hidden garage nearby" signal shows when you are within about 130 m):</p>{hidden.map(({ g, d }) => <p key={g.id} className="font-mono text-[10px] text-textLight">• {g.clue} <span className="text-textDim">· about {d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d / 50) * 50 + " m"} away</span></p>)}</div>}
            {found.length > 0 && <div className="mt-3"><p className="font-mono text-[10px] text-textDim mb-1">FOUND</p><div className="flex flex-col gap-1">{found.map((g) => <div key={g.id} className="flex items-center gap-2"><span className="font-mono text-[10px] text-textLight flex-1 truncate">🔧 {g.name} <span className="text-textDim">· {g.area}</span></span><Btn small color="#b45cff" onClick={() => { G.setWaypoint(g.x, g.z, g.name); sfx.correct(); onResume && onResume(); }}>GPS</Btn></div>)}</div></div>}
          </div>
        </div>);
      })()}
      {(() => { const oc = c.outruns || { w: 0, l: 0, streak: 0, best: 0, beaten: {} }, mt = maxTier(G.level()); return (<div className="mb-5">
        <p className="font-pixel text-[9px] text-accentCyan mb-1">STREET RACERS <span className="text-textDim normal-case">· they cruise the roads at night (a pink dot on the minimap). Pull alongside one, press ENTER or L, and open up a {OUT.WIN_GAP} m lead to win an outrun.</span></p>
        <div className="rounded border border-lineColor bg-bgPanel p-3">
          <div className="grid grid-cols-4 gap-2 mb-2">{stat("OUTRUNS WON", oc.w)}{stat("LOST", oc.l)}{stat("STREAK", oc.streak)}{stat("BEST STREAK", oc.best)}</div>
          <div className="grid sm:grid-cols-2 gap-1">{RACERS.map((r) => { const n = (oc.beaten || {})[r.id] || 0, lock = r.tier > mt; const car = P.CARS.find((k) => k.id === r.car); return (
            <div key={r.id} className="flex items-center gap-2 rounded border px-2 py-1" style={{ borderColor: n ? "#2f6b4a" : "#2a2a44", opacity: lock ? 0.5 : 1 }}>
              <span className="font-pixel text-[8px] w-9" style={{ color: ["#9fd", "#ffd23a", "#ff8a8a"][r.tier - 1] }}>{["STREET", "PRO", "ACE"][r.tier - 1]}</span>
              <div className="flex-1 min-w-0"><p className="font-mono text-[10px] text-textLight truncate">{r.name} <span className="text-textDim">· {r.tag}</span></p><p className="font-mono text-[9px] text-textDim">{car ? car.name : r.car}</p></div>
              <span className="font-mono text-[9px]" style={{ color: n ? "#6bff9a" : "#889" }}>{lock ? `from level ${r.tier === 3 ? 6 : 3}` : n ? `beaten ×${n}` : "not beaten yet"}</span>
            </div>); })}</div>
        </div>
      </div>); })()}
      <p className="font-pixel text-[9px] text-accentCyan mb-2">YOUR CARS <span className="text-textDim normal-case">· switch any time between races · new hero cars appear in the Car Lot at levels 2, 3, 4, 5, 6, 7, 8 and 10 — buy them with cash</span></p>
      <div className="grid sm:grid-cols-3 gap-1.5 mb-5">{P.CARS.filter((k) => c.carsOwned.includes(k.id) || k.hero).map((k) => { const own = c.carsOwned.includes(k.id); return (
        <button key={k.id} disabled={!own || c.car === k.id || !!G.run} onClick={() => drive(k.id)} className="rounded border px-3 py-2 text-left" style={{ borderColor: c.car === k.id ? accent : "#2a2a44", background: "#12122a", opacity: own ? 1 : 0.55 }}>
          <span className="font-pixel text-[9px] text-textLight">{k.name.toUpperCase()}</span>{k.hero && <span className="ml-1 text-[8px]" style={{ color: "#ffb347" }}>HERO</span>}
          <span className="block font-mono text-[9px] text-textDim">{c.car === k.id ? "driving now" : own ? "tap to drive" : G.carUnlocked(k) ? `in the Car Lot · ${money(k.price)}` : `unlocks at level ${k.level}`}</span>
        </button>); })}</div>
      <p className="font-pixel text-[9px] text-accentCyan mb-1">THE BLACKLIST <span className="text-textDim normal-case">· fifteen rivals, #15 up to #1. Finish a rival's milestones, then challenge them. Win and you take their place — and their car.</span></p>
      <div className="flex flex-col gap-1.5 mb-5">{list.map(({ r, st }) => {
        const open = !st.beaten && st.prevBeaten; const ev = G.eventById["duel-" + r.id];
        return (
        <details key={r.id} open={open} className="rounded border border-lineColor bg-bgPanel" style={{ opacity: st.beaten ? 0.75 : st.prevBeaten ? 1 : 0.55 }}>
          <summary className="px-3 py-2 flex items-center gap-2 cursor-pointer"><span className="font-pixel text-[10px] w-8" style={{ color: r.accent }}>#{r.rank}</span><div className="flex-1 min-w-0"><p className="font-mono text-[11px] text-textLight truncate">{r.name} <span className="text-textDim">— {r.title}</span></p><p className="font-mono text-[9px] text-textDim">{r.from} · {P.CARS.find((k) => k.id === r.car.car).name}</p></div><span className="font-mono text-[10px]" style={{ color: st.beaten ? "#6bff9a" : st.ready ? "#ffb703" : "#889" }}>{st.beaten ? "BEATEN" : st.ready ? "READY" : `${st.msCount}/${st.ms.length}`}</span></summary>
          <div className="px-3 pb-3">
            <p className="font-mono text-[10px] text-textDim mb-2">{r.bio}</p>
            <div className="flex flex-col gap-1 mb-2">{st.ms.map((m, i) => <div key={i} className="flex items-center gap-2"><span className="text-[11px]" style={{ color: m.done ? "#6bff9a" : "#889" }}>{m.done ? "✔" : "○"}</span><span className="font-mono text-[10px] flex-1" style={{ color: m.done ? "#9fe8b8" : "#cfd3e6" }}>{m.label}</span>{m.kind !== "race" && <span className="font-mono text-[9px] text-textDim">{m.have.toLocaleString()}/{m.need.toLocaleString()}</span>}</div>)}</div>
            <div className="flex items-center gap-2 flex-wrap"><span className="font-mono text-[9px] text-textDim">Reward {money(r.reward.cash)} · {r.reward.xp} XP{r.unlockCar ? " · wins you the " + P.CARS.find((k) => k.id === r.unlockCar).name : ""}</span>
              {ev && !st.beaten && <Btn small color="#2de2ff" onClick={() => { G.setWaypoint(ev.sx, ev.sz, ev.name); sfx.correct(); onResume && onResume(); }}>GPS TO {r.name.toUpperCase()}</Btn>}</div>
          </div>
        </details>); })}</div>
      <Btn color={accent} onClick={onQuit}>SAVE, SUBMIT SCORE &amp; EXIT</Btn>
    </div></div>
  );
}
const HOME = IS_TOKYO ? T_HOME : { pixel: "Colaba Causeway", rook: "Sewri Docks", nova: "Bandra Reclamation", mako: "Airoli Docks", juno: "Yeoor Hills", dagger: "Thane Station Road", saint: "Marine Drive", vex: "Palm Beach Road", nyx: "Atal Setu", kage: "Bandra–Worli Sea Link" };
const require_home = (id) => HOME[id] || "";

// =============================== the public component ==================================================================================

// round speedometer: 270-degree sweep, 0-300 km/h, rpm arc, nitrous arc outside
function Dial({ kmh, rpm, nitro, nos, gear, accent }) {
  const C0 = 100, SW = 270, A0 = 135, MAXK = 300;
  const pt = (r, deg) => { const t = (deg * Math.PI) / 180; return [C0 + r * Math.cos(t), C0 + r * Math.sin(t)]; };
  const arc = (r, f) => { const f2 = Math.max(0.001, Math.min(1, f)); const [x1, y1] = pt(r, A0), [x2, y2] = pt(r, A0 + SW * f2); return `M ${x1} ${y1} A ${r} ${r} 0 ${SW * f2 > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const fr = Math.max(0, Math.min(1, (kmh || 0) / MAXK)); const needle = pt(70, A0 + SW * fr);
  const ticks = []; for (let k = 0; k <= MAXK; k += 20) { const f = k / MAXK, big = k % 40 === 0; const [x1, y1] = pt(big ? 66 : 70, A0 + SW * f), [x2, y2] = pt(76, A0 + SW * f); ticks.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={k > 240 ? "#ff5050" : "#ffe9c4"} strokeWidth={big ? 2.4 : 1.2} />); if (big) { const [lx, ly] = pt(54, A0 + SW * f); ticks.push(<text key={"t" + k} x={lx} y={ly + 3.5} fontSize="10" fill="#ffd9a0" textAnchor="middle" fontFamily="monospace">{k}</text>); } }
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" style={{ filter: "drop-shadow(0 0 8px rgba(255,170,40,0.4))" }}>
      <circle cx={C0} cy={C0} r="96" fill="rgba(14,10,4,0.78)" stroke="rgba(255,190,80,0.6)" strokeWidth="2.5" />
      <path d={arc(90, 1)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
      <path d={arc(90, (nitro || 0) / 100)} fill="none" stroke={nos ? "#ffffff" : "#ffb52e"} strokeWidth="6" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px #ff9a1a)" }} />
      <path d={arc(82, rpm || 0)} fill="none" stroke={(rpm || 0) > 0.88 ? "#ff3b3b" : "#ffe2a0"} strokeWidth="3" strokeLinecap="round" />
      {ticks}
      <line x1={C0} y1={C0} x2={needle[0]} y2={needle[1]} stroke="#ff4a3a" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #ff4a3a)" }} />
      <circle cx={C0} cy={C0} r="7" fill="#1a1d28" stroke="#ffc060" strokeWidth="2" />
      <text x={C0} y={C0 + 34} textAnchor="middle" fontSize="30" fontWeight="bold" fill="#ffffff" fontFamily="monospace">{kmh}</text>
      <text x={C0} y={C0 + 46} textAnchor="middle" fontSize="8" fill="#d8b070" fontFamily="monospace">KM/H</text>
      <text x={C0} y={C0 - 20} textAnchor="middle" fontSize="22" fontWeight="bold" fill={accent} fontFamily="monospace">{gear}</text>
      <text x={C0} y={C0 + 62} textAnchor="middle" fontSize="7" fill="#ffb52e" fontFamily="monospace">NITROUS · SHIFT</text>
    </svg>
  );
}

export default function MidnightBurnCity(props) { return <MidnightBurnCityInner {...props} />; }
