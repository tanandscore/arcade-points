"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as P from "@/lib/midnightBurn/physics";
import * as Q from "@/lib/midnightBurn/quests";
import * as D from "@/lib/midnightBurn/drivers";
import { DEFAULT_SPEC, specOf } from "@/lib/midnightBurn/cars";
import { Showroom, CustomisePanel, LadderPanel, pendingItems, looksKeys } from "./MidnightBurnGarage";
import { createWorld } from "@/lib/midnightBurn/scene";
import { useStage, stageBoxStyle } from "./FullscreenStage";

import { createMusicPlayer } from "@/lib/midnightBurn/music";
import { sfx, isMuted, toggleMuted } from "@/lib/sound";

// MIDNIGHT BURN — the flagship. An original neon night street-racing
// career across six maps. Race five rivals through traffic, drift and
// draft for style, spend winnings in the garage, and when a race ends
// the map opens up as a free-roam playground with three quests built
// for that road (speed traps, drift zones, gate runs, traffic
// weaving). Your career score is the best race on each map plus every
// quest you have completed.
//
// lib/midnightBurn/physics.js  — the pure simulation (also bot-tested)
// lib/midnightBurn/quests.js   — quest placement and rules
// lib/midnightBurn/scene.js    — the three.js world
// this file                    — menus, garage, HUD, and the game loop

const POSITION_POINTS = [1200, 850, 600, 400, 250, 100];
const POSITION_CASH = [900, 650, 450, 300, 200, 100];
const STYLE_CAP = 2500;
const UNLOCK_POS = 4; // finish 4th or better to open the next map
const PAINTS = ["#2de2ff", "#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#f2f2f2"];
const RIVAL_COLORS = ["#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#2de2ff", "#f2f2f2"];
const RIVAL_NAMES = ["Dash", "Echo", "Fuse", "Grit", "Hawk", "Ion", "Jolt"];
const XP_BY_POS = [300, 220, 160, 110, 70, 40];
const QUEST_XP = 150;
const STARTERS = P.CARS.filter((c) => !c.locked);
const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const WEATHER_LABEL = { clear: "Clear night", rain: "Heavy rain", fog: "Mountain fog", storm: "Thunderstorm" };
const QUEST_ICON = { speed: "⚡", drift: "🌀", gates: "🎯", near: "🚗" };

const hexInt = (h) => parseInt(h.slice(1), 16);
const cssColor = (n) => "#" + n.toString(16).padStart(6, "0");
const fmtTime = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

function makeEngine() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700; f.connect(master);
    const mk = (type, g) => { const o = ctx.createOscillator(); o.type = type; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(f); o.start(); return o; };
    const o1 = mk("sawtooth", 1), o2 = mk("square", 0.7), o3 = mk("triangle", 0.35);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (type, freq, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = freq; bf.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(bf); bf.connect(g); g.connect(ctx.destination); s.start();
      return g;
    };
    const squealG = noise("bandpass", 1750, 5);
    const windG = noise("lowpass", 650, 0.7);
    return {
      set(s) {
        const t = ctx.currentTime;
        const hz = 34 + s.rpm * 150 + (s.nos ? 10 : 0);
        o1.frequency.setTargetAtTime(hz, t, 0.04);
        o2.frequency.setTargetAtTime(hz * 0.5, t, 0.04);
        o3.frequency.setTargetAtTime(hz * 2, t, 0.04);
        f.frequency.setTargetAtTime(420 + s.rpm * 1500 + (s.thr ? 450 : 0), t, 0.06);
        const m = isMuted() ? 0 : (0.045 + (s.thr ? 0.03 : 0) + (s.nos ? 0.02 : 0)) * (s.shifting ? 0.35 : 1);
        master.gain.setTargetAtTime(m, t, 0.05);
        squealG.gain.setTargetAtTime(isMuted() ? 0 : s.squeal * 0.07, t, 0.05);
        windG.gain.setTargetAtTime(isMuted() ? 0 : Math.min(1, s.v / 70) * 0.05, t, 0.2);
      },
      resume() { if (ctx.state === "suspended") ctx.resume(); },
      stop() { try { master.gain.value = 0; squealG.gain.value = 0; windG.gain.value = 0; o1.stop(); o2.stop(); o3.stop(); ctx.close(); } catch {} },
    };
  } catch {
    return null;
  }
}

function StatBar({ label, value, max = 1.5, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-mono text-textDim text-left">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
        <div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function carRatings(car, lv, kit = "stock") {
  const s = P.makeStats(car, lv, kit);
  return { speed: s.vmax / 62, accel: s.accel / 26, handling: (s.yaw * s.grip) / (2.5 * 5.2), nitro: s.nitroPower };
}

const EMPTY_CAREER = {
  levels: { engine: 0, tires: 0, nitro: 0 }, cash: 0, unlocked: 0, best: {}, questsDone: [], questPts: 0,
  xp: 0, owned: [], ladder: 0, carsOwned: ["kestrel", "brute", "gecko"], duelPts: 0,
};
const HARBOR_IDX = Math.max(0, P.TRACKS.findIndex((t) => t.id === "harbor"));

function MidnightBurnInner({ onFinish, accentColor, onMood, musicRef }) {
  const mountRef = useRef(null);
  const frameBoxRef = useRef(null);
  const stage = useStage();
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu"); // menu | garage | race | final
  const [spec, setSpec] = useState(DEFAULT_SPEC); // the look you race with
  const [draft, setDraft] = useState(null); // a look being tried on in the garage
  const [tab, setTab] = useState("maps");
  const [duelTarget, setDuelTarget] = useState(null);
  const carId = spec.car;
  const paint = spec.color;
  const setCarId = (id) => { setSpec((s) => ({ ...s, car: id })); setDraft((d) => d && { ...d, car: id }); };
  const setPaint = (c) => { setSpec((s) => ({ ...s, color: c })); setDraft((d) => d && { ...d, color: c }); };
  const [mapIdx, setMapIdx] = useState(0);
  const [career, setCareer] = useState(EMPTY_CAREER);
  const [raceKey, setRaceKey] = useState(0);
  const [raceUi, setRaceUi] = useState("countdown"); // countdown | racing | results | roam
  const [result, setResult] = useState(null);
  const [hud, setHud] = useState(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [webglFailed, setWebglFailed] = useState(false);
  const [camLabel, setCamLabel] = useState("CHASE");
  const [notice, setNotice] = useState("");

  const keys = useRef({});
  const raceRef = useRef(null);
  const ctlRef = useRef({});
  ctlRef.current = { carId, paint, mapIdx, career, spec, duel: duelTarget };
  const submittedRef = useRef(false);

  // every map's track and quest set, built once (used by the garage previews)
  const mapInfo = useMemo(() => P.TRACKS.map((def, i) => {
    const track = P.buildTrack(def);
    return { def, track, quests: Q.questsFor(track, i) };
  }), []);

  // test-only handles (only exist when a test page sets window.__MB_TEST)
  useEffect(() => {
    if (typeof window !== "undefined" && window.__MB_TEST) window.__mbApi = { setCareer, setMapIdx, setSpec, setTab };
  }, []);

  // tell the soundtrack what is going on (calm in menus, full power in a race)
  useEffect(() => {
    if (!onMood) return;
    if (phase !== "race") onMood(0.25);
    else if (raceUi === "racing") onMood(1);
    else if (raceUi === "results") onMood(0.3);
    else onMood(0.6);
  }, [phase, raceUi]);

  const duelSpec = useMemo(() => (duelTarget ? specOf(duelTarget.car) : null), [duelTarget]);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setDeviceOk(!coarse && window.innerWidth >= 900);
    setMutedState(isMuted());
  }, []);

  // keyboard
  useEffect(() => {
    function down(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
      keys.current[k] = true;
      const R = raceRef.current;
      if ((k === "p" || k === "Escape") && R && (R.state === "racing" || R.state === "roam")) { R.paused = !R.paused; setPaused(R.paused); }
      if (k === "f") toggleFullscreen();
      if (k === "c" && R) { R.camMode = (R.camMode + 1) % 3; R.world.setCameraMode(R.camMode); setCamLabel(["CHASE", "FAR", "HOOD"][R.camMode]); }
      if (k === "Enter" && R && R.state === "roam") window.dispatchEvent(new CustomEvent("mb-exit-roam"));
      if (k === "r" && R && R.state === "roam") { R.player.d = 0; R.player.h = 0; R.player.tv = 0; R.player.v *= 0.4; }
    }
    function up(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current[k] = false;
    }
    function blur() {
      keys.current = {};
      const R = raceRef.current;
      if (R && (R.state === "racing" || R.state === "roam") && !R.paused) { R.paused = true; setPaused(true); }
    }
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  function toggleFullscreen() {
    stage.toggle();
  }

  // ---- the race + free roam ---------------------------------------------
  useEffect(() => {
    if (phase !== "race" || !mountRef.current) return undefined;
    const { carId: cid, paint: pcol, mapIdx: mi, career: cr, spec: sp, duel } = ctlRef.current;
    const info = mapInfo[mi];
    const def = info.def;
    const track = info.track;
    const carDef = P.CARS.find((c) => c.id === cid);
    const rng = P.makeRng(1234 + mi * 77);

    const stats = P.makeStats(carDef, cr.levels, sp.kit);
    const player = P.newCar(duel ? -10 : -33, 3.4, stats);
    player.nitro = 35;
    const rivalCount = duel ? 1 : 5;
    const laps = duel ? duel.laps : def.laps;
    const rivalCars = [], rivalAi = [], rivalDefs = [];
    const gridS = [-6, -6, -15, -15, -24];
    const gridD = [-3.4, 3.4, -3.4, 3.4, -3.4];
    const rl = Math.min(5, mi);
    for (let i = 0; i < rivalCount; i++) {
      if (duel) {
        const dcd = P.CARS.find((c) => c.id === duel.car.car);
        const lv = duel.carLevel;
        const dc = P.newCar(-10, -3.4, P.makeStats(dcd, { engine: lv, tires: lv, nitro: lv }, duel.car.kit));
        dc.nitro = 60;
        rivalCars.push(dc);
        rivalAi.push({ lane: -3.4, pace: duel.ai.base, latG: duel.ai.latG, useNos: duel.ai.useNos, base: duel.ai.base, block: duel.ai.block });
        rivalDefs.push({ color: hexInt(duel.accent), car: dcd.id, name: duel.name, spec: specOf(duel.car) });
        continue;
      }
      const cd = STARTERS[(i + mi) % STARTERS.length];
      const st = P.makeStats(cd, { engine: rl, tires: rl, nitro: rl });
      const c = P.newCar(gridS[i], gridD[i], st);
      c.nitro = 60;
      rivalCars.push(c);
      const base = 0.83 + mi * 0.025 + i * 0.012;
      rivalAi.push({ lane: gridD[i], pace: base, latG: 0.78, useNos: mi > 0, base });
      const rcol = RIVAL_COLORS[(i + mi) % RIVAL_COLORS.length];
      rivalDefs.push({ color: hexInt(rcol), car: cd.id, name: RIVAL_NAMES[(i + mi * 2) % RIVAL_NAMES.length], spec: D.rivalSpec(i, mi, cd.id, rcol) });
    }
    const traffic = P.makeTraffic(track, duel ? duel.traffic : def.traffic, rng, [0, -30]);

    let world;
    try {
      world = createWorld(mountRef.current, track, {
        player: { color: hexInt(pcol), car: cid, spec: sp },
        rivals: rivalDefs,
        trafficKinds: traffic.map((t) => t.kind),
        trafficHues: traffic.map((t) => t.hue),
      });
    } catch (err) {
      setWebglFailed(true);
      return undefined;
    }
    setWebglFailed(false);

    const R = {
      def, track, world, player, rivals: rivalCars, rivalAi, rivalDefs, traffic, mapIdx: mi,
      playerAi: { lane: 0, pace: 0.55, latG: 0.7, useNos: false },
      state: "countdown", countdown: 3.4, t: 0, acc: 0, paused: false,
      laps, duel, total: track.L * laps, style: 0, mult: 1, multT: 0, driftAcc: 0,
      hitCd: 0, popups: [], popupId: 0, lastCount: 4, hudT: 0,
      stats: { drift: 0, near: 0, draft: 0, crashes: 0 }, camMode: 0, result: null,
      quests: Q.newQuestState(info.quests, cr.questsDone), questDefs: info.quests, toasts: [],
    };
    raceRef.current = R;
    setRaceUi("countdown");
    setResult(null);
    setPaused(false);
    setShowHint(true);
    setCamLabel("CHASE");
    const engine = makeEngine();
    engine?.resume();
    if (typeof window !== "undefined" && window.__MB_TEST) window.__mb = R;

    function popup(text, color) {
      R.popups.push({ id: R.popupId++, text, color, t: 0 });
      if (R.popups.length > 4) R.popups.shift();
    }
    function toast(text, sub, color) {
      R.toasts.push({ id: R.popupId++, text, sub, color, t: 0 });
      if (R.toasts.length > 3) R.toasts.shift();
    }
    function playerPosition() {
      let pos = 1;
      for (const r of R.rivals) {
        if (r.finished && !R.player.finished) pos++;
        else if (r.finished && R.player.finished) { if (r.finishTime < R.player.finishTime) pos++; }
        else if (!R.player.finished && r.progress > R.player.progress) pos++;
      }
      return pos;
    }

    function readInput() {
      const k = keys.current;
      return {
        throttle: k.ArrowUp || k.w ? 1 : 0,
        brake: k.ArrowDown || k.s ? 1 : 0,
        steer: (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0),
        hand: !!k[" "],
        nos: !!k.Shift,
      };
    }

    // shared by the race and free roam: contacts, near misses, drifting
    function styleTick(scoring) {
      const pl = R.player;
      const roaming = R.state === "roam";
      const out = { near: false, crashed: false, driftGain: 0 };
      R.hitCd = Math.max(0, R.hitCd - P.DT);
      for (const T of R.traffic) {
        if (P.resolveContact(track, pl, T)) {
          if (R.hitCd <= 0) {
            R.hitCd = 0.6; R.mult = 1; R.stats.crashes++; R.driftAcc = 0; out.crashed = true;
            pl.crashT = 0.35; pl.bump = true; sfx.hit(); popup("CRASH", "#ff4d4d");
          }
        }
        if (!roaming) for (const r of R.rivals) P.resolveContact(track, r, T);
      }
      if (!roaming) {
        for (const r of R.rivals) {
          if (P.resolveContact(track, pl, r) && R.hitCd <= 0) { R.hitCd = 0.5; R.mult = Math.max(1, R.mult - 0.5); sfx.hit(); }
        }
        for (let i = 0; i < R.rivals.length; i++) for (let j = i + 1; j < R.rivals.length; j++) P.resolveContact(track, R.rivals[i], R.rivals[j]);
      }
      for (const c of roaming ? [pl] : [pl, ...R.rivals]) c.d = Math.max(-track.halfW + 1, Math.min(track.halfW - 1, c.d));
      if (pl.wallHit) { R.mult = 1; R.driftAcc = 0; sfx.hit(); popup("WALL", "#ff8a4d"); R.stats.crashes++; out.crashed = true; }

      if (pl.drifting) {
        const pts = pl.v * pl.slip * 4.0 * R.mult * P.DT;
        out.driftGain = pts;
        R.driftAcc += pts;
        if (scoring) { R.style += pts; R.stats.drift += pts; }
        pl.nitro = Math.min(100, pl.nitro + 14 * P.DT);
        R.multT = 0;
      } else if (R.driftAcc > 40) {
        popup(`DRIFT +${Math.round(R.driftAcc)}`, "#ff2d95");
        R.mult = Math.min(4, R.mult + 0.25);
        R.driftAcc = 0;
      } else R.driftAcc = 0;

      for (const T of R.traffic) {
        const dsT = P.wrapDelta(track, T.s - pl.s);
        const gapSide = Math.abs(T.d - pl.d) - P.CAR_WID;
        if (Math.abs(dsT) < 3.2 && gapSide > 0.02 && gapSide < 1.35 && pl.v > 30 && R.t - (T.nearT ?? -9) > 3) {
          T.nearT = R.t;
          const pts = 100 * R.mult;
          if (scoring) { R.style += pts; R.stats.near += pts; }
          pl.nitro = Math.min(100, pl.nitro + 10);
          R.mult = Math.min(4, R.mult + 0.25);
          out.near = true;
          sfx.correct(); popup(`NEAR MISS${scoring ? ` +${Math.round(pts)}` : ""}`, "#2de2ff");
        }
        if (dsT > 3 && dsT < 20 && Math.abs(T.d - pl.d) < 1.9 && pl.v > 40) {
          pl.nitro = Math.min(100, pl.nitro + 7 * P.DT);
          if (scoring) { const pts = 10 * R.mult * P.DT; R.style += pts; R.stats.draft += pts; }
        }
      }
      R.multT += P.DT;
      if (R.multT > 5) R.mult = Math.max(1, R.mult - 0.2 * P.DT);
      return out;
    }

    function simStep() {
      const auto = typeof window !== "undefined" && window.__MB_TEST && window.__MB_AUTO;
      if (R.state === "countdown") {
        R.countdown -= P.DT;
        const n = Math.ceil(R.countdown - 0.4);
        if (n !== R.lastCount) {
          R.lastCount = n;
          if (n > 0 && n <= 3) sfx.tap();
          if (n <= 0) sfx.boost();
        }
        if (R.countdown <= 0) { R.state = "racing"; setRaceUi("racing"); setTimeout(() => setShowHint(false), 7000); }
        for (const c of [R.player, ...R.rivals]) { c.v = 0; c.steer = 0; }
        P.stepTraffic(track, R.traffic);
        return;
      }
      R.t += P.DT;

      // ---------- free roam ----------
      if (R.state === "roam") {
        const input = auto ? P.aiInput(track, R.player, R.playerAi, R.traffic, []) : readInput();
        const wasNos = R.player.nos;
        P.stepCar(track, R.player, input);
        if (R.player.nos && !wasNos) sfx.boost();
        P.stepTraffic(track, R.traffic);
        const st = styleTick(false);
        const evs = Q.stepQuests(track, R.quests, {
          dt: P.DT, player: R.player, near: st.near, crashed: st.crashed, driftGain: st.driftGain,
        });
        for (const e of evs) {
          const d = e.q.def;
          if (e.kind === "complete") {
            sfx.newBest();
            toast(`QUEST COMPLETE  ${QUEST_ICON[d.type]}`, `${d.title}  ·  +${d.reward.pts} pts  ·  +$${d.reward.cash}`, "#6bff6b");
          } else if (e.kind === "miss") {
            sfx.wrong(); toast(e.text, d.title, "#ff8a4d");
          } else if (e.kind === "progress") {
            popup(`${d.title.toUpperCase()} ${e.text}`, "#2de2ff");
          }
        }
        return;
      }

      // ---------- race ----------
      let input;
      if (R.state === "finished" || auto) {
        input = P.aiInput(track, R.player, R.state === "finished" ? R.playerAi : { lane: 0, pace: 1.0, latG: 0.82, useNos: true }, R.traffic, R.rivals);
        if (R.state === "finished") input.nos = false;
      } else input = readInput();
      const wasNos = R.player.nos;
      P.stepCar(track, R.player, input);
      if (R.player.nos && !wasNos) sfx.boost();

      // rivals, with gentle rubber-banding so the race stays close
      R.rivals.forEach((r, i) => {
        const ai = R.rivalAi[i];
        const gap = R.player.progress - r.progress;
        if (R.duel) {
          // duels: far less rubber-banding, and the tougher drivers block
          ai.pace = r.finished ? 0.5 : ai.base + Math.max(-0.03, Math.min(0.04, gap / 900));
          const ahead = r.progress - R.player.progress;
          if (ai.block && !r.finished && ahead > 0 && ahead < 38) {
            const room = track.halfW - 3.2;
            ai.lane = Math.max(-room, Math.min(room, ai.lane + (R.player.d - ai.lane) * ai.block * 0.06));
          }
        } else ai.pace = r.finished ? 0.5 : ai.base + Math.max(-0.07, Math.min(0.08, gap / 420));
        P.stepCar(track, r, P.aiInput(track, r, ai, R.traffic, [R.player, ...R.rivals]));
        if (!r.finished && r.progress >= R.total) { r.finished = true; r.finishTime = R.t; }
      });
      P.stepTraffic(track, R.traffic);

      styleTick(R.state === "racing");

      if (R.state === "racing" && R.player.progress >= R.total) {
        const pl = R.player;
        pl.finished = true; pl.finishTime = R.t;
        const pos = playerPosition();
        const style = Math.round(Math.min(STYLE_CAP, R.style));
        R.state = "finished";
        if (pos === 1) sfx.newBest(); else sfx.win();
        let res;
        if (R.duel) {
          const dr = R.duel;
          const win = pos === 1;
          const rematch = ctlRef.current.career.ladder >= 11 - dr.rank;
          const k = rematch ? 0.2 : 1;
          res = {
            duel: dr, win, rematch, pos, style, time: R.t,
            pts: win && !rematch ? dr.reward.pts : 0,
            earned: win ? Math.round(dr.reward.cash * k) : 100,
            xp: win ? (rematch ? 40 : dr.reward.xp) : 60,
            gap: Math.round(R.player.progress - R.rivals[0].progress),
            unlockCar: win && !rematch ? dr.unlockCar || null : null,
          };
        } else {
          res = {
            pos, style, pts: POSITION_POINTS[pos - 1] + style, earned: POSITION_CASH[pos - 1] + Math.round(style / 6),
            xp: XP_BY_POS[pos - 1] + Math.round(style / 10),
            time: R.t, drift: Math.round(R.stats.drift), near: Math.round(R.stats.near),
            draft: Math.round(R.stats.draft), crashes: R.stats.crashes, capped: R.style > STYLE_CAP,
            unlock: pos <= UNLOCK_POS && R.mapIdx < P.TRACKS.length - 1,
          };
        }
        R.result = res;
        setResult(res);
        setRaceUi("results");
      }
    }

    function startRoam() {
      if (R.state !== "finished") return;
      R.state = "roam";
      R.player.finished = false;
      R.world.setRivalsVisible(false);
      R.world.questMarkers(R.questDefs);
      R.hitCd = 0; R.mult = 1; R.driftAcc = 0; R.multT = 0;
      R.playerAi = { lane: 0, pace: 0.55, latG: 0.7, useNos: false };
      setRaceUi("roam");
      setShowHint(true);
      setTimeout(() => setShowHint(false), 9000);
    }
    // fold the race result and any quests completed into the career, then leave
    function commit() {
      if (!R.result || R.committed) return;
      R.committed = true;
      const done = R.quests.filter((q) => q.done).map((q) => q.def.id);
      window.dispatchEvent(new CustomEvent("mb-commit", { detail: { result: R.result, done } }));
    }
    window.addEventListener("mb-start-roam", startRoam);
    window.addEventListener("mb-exit-roam", commit);
    window.addEventListener("mb-skip", commit);

    // loop
    let raf = 0;
    let last = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const realDt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!R.paused) {
        const testMult = typeof window !== "undefined" && window.__MB_TEST && window.__MB_STEPS ? window.__MB_STEPS : 1;
        R.acc += realDt * testMult;
        const cap = 8 * testMult;
        let guard = 0;
        while (R.acc >= P.DT && guard++ < cap) { simStep(); R.acc -= P.DT; }
        if (guard >= cap) R.acc = 0;
      }
      R.world.update({ player: R.player, rivals: R.rivals, traffic: R.traffic }, R.paused ? 0 : realDt, realDt);
      if (R.state === "roam") R.world.setQuestState(R.quests, R.t);
      R.world.render();
      const k = keys.current;
      const pl = R.player;
      musicRef?.current?.setNitro(pl.nos);
      engine?.set({
        rpm: pl.rpm, thr: !!(k.ArrowUp || k.w), nos: pl.nos, v: pl.v, shifting: pl.shiftT > 0,
        squeal: pl.drifting ? 1 : (pl.braking && pl.v > 25 ? 0.5 : 0),
      });

      for (const p of R.popups) p.t += realDt;
      R.popups = R.popups.filter((p) => p.t < 1.6);
      for (const p of R.toasts) p.t += realDt;
      R.toasts = R.toasts.filter((p) => p.t < 3.4);
      R.hudT += realDt;
      if (R.hudT > 0.08) {
        R.hudT = 0;
        const lap = Math.min(R.laps, Math.max(0, Math.floor(pl.progress / R.track.L)) + 1);
        const ordered = [{ me: true, prog: R.result ? R.total + 1e6 - pl.finishTime : pl.progress }]
          .concat(R.rivals.map((r) => ({ me: false, prog: r.finished ? R.total + 1e6 - r.finishTime : r.progress })));
        ordered.sort((a, b) => b.prog - a.prog);
        const pos = R.result ? R.result.pos : ordered.findIndex((o) => o.me) + 1;
        setHud({
          speed: Math.round(pl.v * P.KMH * 1.1), pos, lap, laps: R.laps, n: R.rivals.length + 1,
          gap: Math.round(pl.progress - R.rivals[0].progress), gear: pl.gear, rpm: pl.rpm,
          time: R.t, nitro: pl.nitro, nos: pl.nos, mult: R.mult, style: Math.round(Math.min(STYLE_CAP, R.style)),
          popups: R.popups.map((p) => ({ ...p })), toasts: R.toasts.map((p) => ({ ...p })),
          countdown: R.state === "countdown" ? Math.ceil(R.countdown - 0.4) : null,
          drifting: pl.drifting, drift: Math.round(R.driftAcc), roam: R.state === "roam",
          quests: R.state === "roam" ? R.quests.map((q) => ({ ...Q.questLine(q), type: q.def.type, desc: q.def.desc })) : null,
          dots: [{ me: true, s: pl.s }].concat(R.state === "roam" ? [] : R.rivals.map((r, i) => ({ me: false, s: r.s, c: cssColor(R.rivalDefs[i].color) }))),
        });
      }
    }
    raf = requestAnimationFrame(frame);

    const onResize = () => world.resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      window.removeEventListener("mb-start-roam", startRoam);
      window.removeEventListener("mb-exit-roam", commit);
      window.removeEventListener("mb-skip", commit);
      engine?.stop();
      world.dispose();
      raceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, raceKey]);

  // career update when a race (and optional free roam) is over
  useEffect(() => {
    function onCommit(e) {
      const { result: res, done } = e.detail;
      const prev = ctlRef.current.career;
      const lvBefore = D.levelOf(prev.xp);
      const bits = [];
      let next;
      if (res.duel) {
        // ---- underground duel ----
        const dr = res.duel;
        next = { ...prev, cash: prev.cash + res.earned, xp: prev.xp + res.xp, duelPts: prev.duelPts + res.pts };
        if (res.win && !res.rematch) {
          next.ladder = Math.max(prev.ladder, 11 - dr.rank);
          bits.push(dr.rank === 1 ? `YOU BEAT KAGE. THE CITY IS YOURS.` : `YOU BEAT ${dr.name.toUpperCase()} (#${dr.rank})`);
          if (res.unlockCar) {
            next.carsOwned = [...prev.carsOwned, res.unlockCar];
            bits.push(`NEW CAR UNLOCKED: ${P.CARS.find((c) => c.id === res.unlockCar).name}`);
          }
        } else if (res.win) bits.push(`Rematch won against ${dr.name}`);
        else bits.push(`${dr.name} won this time. Try again.`);
        bits.push(`+$${res.earned}`, `+${res.xp} XP`);
        if (res.pts) bits.push(`+${res.pts} pts`);
        setTab("ladder");
      } else {
        // ---- normal race + quests ----
        const mi = ctlRef.current.mapIdx;
        const info = mapInfo[mi];
        const newlyDone = done.filter((id) => !prev.questsDone.includes(id));
        let qCash = 0, qPts = 0;
        for (const q of info.quests) if (newlyDone.includes(q.id)) { qCash += q.reward.cash; qPts += q.reward.pts; }
        const id = info.def.id;
        const best = { ...prev.best };
        if (!best[id] || res.pts > best[id].pts) best[id] = { pos: res.pos, pts: res.pts, time: res.time };
        const unlocked = res.pos <= UNLOCK_POS ? Math.max(prev.unlocked, Math.min(P.TRACKS.length - 1, mi + 1)) : prev.unlocked;
        next = {
          ...prev, cash: prev.cash + res.earned + qCash, best, unlocked, xp: prev.xp + res.xp + newlyDone.length * QUEST_XP,
          questsDone: [...prev.questsDone, ...newlyDone], questPts: prev.questPts + qPts,
        };
        bits.push(`Race: +$${res.earned}`, `+${res.xp + newlyDone.length * QUEST_XP} XP`);
        if (newlyDone.length) bits.push(`${newlyDone.length} quest${newlyDone.length > 1 ? "s" : ""}: +$${qCash} and +${qPts} pts`);
        if (unlocked > prev.unlocked) bits.push(`NEW MAP UNLOCKED: ${P.TRACKS[unlocked].name}`);
        setMapIdx(unlocked > prev.unlocked ? unlocked : mi);
        setTab("maps");
      }
      const lvAfter = D.levelOf(next.xp);
      if (lvAfter > lvBefore) bits.unshift(`LEVEL UP! You are now level ${lvAfter}`);
      setCareer(next);
      setNotice(bits.join("   ·   "));
      setResult(null);
      setDuelTarget(null);
      setPhase("garage");
    }
    window.addEventListener("mb-commit", onCommit);
    return () => window.removeEventListener("mb-commit", onCommit);
  }, [mapInfo]);

  // ---- actions ----------------------------------------------------------
  function startCareer() {
    sfx.select();
    setCareer(EMPTY_CAREER); setMapIdx(0); setNotice("");
    submittedRef.current = false;
    setPhase("garage");
  }
  function startRace() {
    sfx.click();
    stage.enter();
    setNotice("");
    setDraft(null);
    setDuelTarget(null);
    setRaceKey((k) => k + 1);
    setPhase("race");
  }
  function openDuel(driver) {
    sfx.select();
    setDraft(null);
    setDuelTarget(driver);
    setPhase("intro");
  }
  function startDuel() {
    sfx.click();
    stage.enter();
    setNotice("");
    setMapIdx(HARBOR_IDX);
    setRaceKey((k) => k + 1);
    setPhase("race");
  }
  const shown = draft || spec;
  const pending = draft ? pendingItems(draft, career.owned) : [];
  const pendingCost = pending.reduce((a, x) => a + x.cost, 0);
  function applyLook() {
    if (!draft) return;
    if (career.cash < pendingCost) { sfx.wrong(); return; }
    sfx.correct();
    setCareer({ ...career, cash: career.cash - pendingCost, owned: [...career.owned, ...pending.map((x) => `${x.group}:${x.id}`)] });
    setSpec(draft);
    setDraft(null);
  }
  function pickCar(id) {
    if (!career.carsOwned.includes(id)) { sfx.wrong(); return; }
    sfx.tap();
    setCarId(id);
  }
  function buy(id) {
    const u = P.UPGRADES.find((x) => x.id === id);
    const lvl = career.levels[id];
    if (lvl >= u.max) return;
    const cost = u.cost[lvl];
    if (career.cash < cost) { sfx.wrong(); return; }
    sfx.correct();
    setCareer({ ...career, cash: career.cash - cost, levels: { ...career.levels, [id]: lvl + 1 } });
  }
  const totalScore = Object.values(career.best).reduce((a, b) => a + b.pts, 0) + career.questPts + career.duelPts;
  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onFinish(Math.max(0, Math.round(totalScore)));
  }

  if (deviceOk === null) return null;
  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">🏎️</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">KEYBOARD AND LARGE SCREEN REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Midnight Burn is a full 3D street racer played with the keyboard. Please open it on a laptop or desktop.
        </p>
      </div>
    );
  }

  const car = P.CARS.find((c) => c.id === carId);

  // ---------------- menu ----------------
  if (phase === "menu") {
    return (
      <div className="text-center">
        <p className="font-pixel text-base mb-1" style={{ color: accentColor || "#ff2d95" }}>MIDNIGHT BURN</p>
        <p className="font-mono text-[11px] text-textDim mb-1 max-w-xl mx-auto">
          A six-map night street-racing career. Beat five rivals through traffic, drift and draft for style, build your dream car in the garage,
          then climb the Underground Ladder against ten named drivers, one by one.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-5">Harbor Loop · Downtown Grid · Foundry Run · Neon Strip · Skyline Ridge · Eclipse Raceway</p>
        <Showroom spec={spec} height={250} className="max-w-3xl mx-auto mb-4" />
        <div className="grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-5">
          {STARTERS.map((c) => {
            const r = carRatings(c, { engine: 0, tires: 0, nitro: 0 });
            return (
              <button
                key={c.id}
                onClick={() => { setCarId(c.id); sfx.tap(); }}
                className="rounded-xl border p-4 text-left transition-colors hover:bg-bgPanel3"
                style={{ borderColor: carId === c.id ? paint : "#2a2a44", background: carId === c.id ? "rgba(255,255,255,0.04)" : undefined }}
              >
                <p className="font-pixel text-[10px] mb-1" style={{ color: carId === c.id ? paint : "#cfd2ff" }}>{c.name.toUpperCase()}</p>
                <p className="text-[11px] text-textDim mb-3">{c.blurb}</p>
                <div className="flex flex-col gap-1.5">
                  <StatBar label="SPEED" value={r.speed} color={paint} />
                  <StatBar label="ACCEL" value={r.accel} color={paint} />
                  <StatBar label="HANDLE" value={r.handling} color={paint} />
                </div>
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[10px] text-textDim mb-2">PAINT</p>
        <div className="flex justify-center gap-2 mb-6">
          {PAINTS.map((c) => (
            <button
              key={c}
              onClick={() => { setPaint(c); sfx.tap(); }}
              aria-label={`Paint ${c}`}
              className="w-7 h-7 rounded-full border-2"
              style={{ background: c, borderColor: paint === c ? "#fff" : "transparent" }}
            />
          ))}
        </div>
        <div className="max-w-md mx-auto text-left rounded-lg border border-lineColor bg-bgPanel p-4 mb-6">
          <p className="font-pixel text-[9px] text-accentCyan mb-2">CONTROLS</p>
          <ul className="font-mono text-[11px] text-textDim space-y-1">
            <li><span className="text-textLight">W / ↑</span> accelerate &nbsp; <span className="text-textLight">S / ↓</span> brake</li>
            <li><span className="text-textLight">A D / ← →</span> steer</li>
            <li><span className="text-textLight">SPACE</span> handbrake (hold it through a bend to drift)</li>
            <li><span className="text-textLight">SHIFT</span> nitrous &nbsp; <span className="text-textLight">C</span> camera (chase / far / hood)</li>
            <li><span className="text-textLight">P</span> pause &nbsp; <span className="text-textLight">F</span> fullscreen &nbsp; <span className="text-textLight">R</span> reset car (free roam)</li>
          </ul>
        </div>
        <button onClick={startCareer} className="font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep" style={{ background: paint }}>
          START CAREER ▸
        </button>
      </div>
    );
  }

  // ---------------- garage ----------------
  if (phase === "garage") {
    const sel = mapInfo[mapIdx];
    const gcar = P.CARS.find((c) => c.id === shown.car);
    const r = carRatings(gcar, career.levels, shown.kit);
    const racesDone = Object.keys(career.best).length;
    const selBest = career.best[sel.def.id];
    const lp = D.levelProgress(career.xp);
    const nextDriver = D.DRIVERS.find((d) => d.rank === 10 - career.ladder);
    const tabs = [["maps", "MAPS"], ["ladder", "LADDER"], ["custom", "CUSTOMISE"], ["upgrades", "UPGRADES"]];
    const carNames = Object.fromEntries(P.CARS.map((c) => [c.id, c.name]));
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <p className="font-pixel text-[10px]" style={{ color: paint }}>GARAGE</p>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[10px] px-2 py-1 rounded border" style={{ borderColor: paint, color: paint }}>LV {lp.level}</span>
              <div className="w-28 h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
                <div className="h-full" style={{ width: `${Math.round(lp.frac * 100)}%`, background: paint }} />
              </div>
              <span className="font-mono text-[10px] text-textDim">{lp.need ? `${lp.into}/${lp.need} XP` : "MAX"}</span>
            </div>
          </div>
          <div className="text-right font-mono text-[12px]">
            <span className="text-accentAmber">CASH ${career.cash.toLocaleString()}</span>
            <span className="text-textDim"> &nbsp;|&nbsp; </span>
            <span className="text-textLight">SCORE {totalScore.toLocaleString()}</span>
          </div>
        </div>
        {notice && <p className="font-mono text-[11px] text-accentCyan mb-3 text-center">{notice}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          {/* left: showroom, car, stats, race */}
          <div className="flex flex-col gap-3">
            <Showroom spec={shown} height={290} />
            <div className="flex flex-wrap gap-1.5">
              {P.CARS.map((c) => {
                const own = career.carsOwned.includes(c.id);
                const need = c.id === "phantom" ? "beat #4 Saint" : "beat #1 Kage";
                return (
                  <button
                    key={c.id}
                    onClick={() => pickCar(c.id)}
                    className="rounded-md border px-2.5 py-1.5 text-left"
                    style={{ borderColor: shown.car === c.id ? paint : "#2a2a44", opacity: own ? 1 : 0.5, background: shown.car === c.id ? "rgba(255,255,255,0.07)" : undefined }}
                  >
                    <span className="block font-mono text-[11px] text-textLight">{own ? "" : "🔒 "}{c.name}</span>
                    {!own && <span className="block font-mono text-[9px] text-accentAmber">{need}</span>}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-lineColor bg-bgPanel p-3 flex flex-col gap-1.5">
              <StatBar label="SPEED" value={r.speed} color={paint} />
              <StatBar label="ACCEL" value={r.accel} color={paint} />
              <StatBar label="HANDLE" value={r.handling} color={paint} />
              <StatBar label="NITRO" value={r.nitro} color={paint} />
            </div>
            <button onClick={startRace} className="font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep" style={{ background: paint }}>
              {selBest ? "RACE AGAIN" : "START RACE"} &middot; {sel.def.name.toUpperCase()} ▸
            </button>
            {racesDone + (career.ladder > 0 ? 1 : 0) > 0 && (
              <button onClick={() => { sfx.click(); setPhase("final"); }} className="font-mono text-[11px] px-4 py-2 rounded-md border border-lineColor text-textDim hover:text-textLight">
                CASH OUT &amp; SUBMIT SCORE ({totalScore.toLocaleString()})
              </button>
            )}
          </div>

          {/* right: tabs */}
          <div className="rounded-xl border border-lineColor bg-bgPanel p-4">
            <div className="flex gap-1 mb-3 flex-wrap">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); sfx.tap(); }}
                  className="font-pixel text-[8px] px-2.5 py-1.5 rounded-md border"
                  style={{ borderColor: tab === id ? paint : "#2a2a44", color: tab === id ? paint : "#8a8aa8", background: tab === id ? "rgba(255,255,255,0.05)" : undefined }}
                >
                  {label}
                  {id === "custom" && draft && pending.length > 0 ? " •" : ""}
                </button>
              ))}
            </div>

            {tab === "maps" && (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {mapInfo.map((m, i) => {
                    const locked = i > career.unlocked;
                    const b = career.best[m.def.id];
                    const qd = m.quests.filter((q) => career.questsDone.includes(q.id)).length;
                    const active = i === mapIdx;
                    return (
                      <button
                        key={m.def.id}
                        disabled={locked}
                        onClick={() => { setMapIdx(i); sfx.tap(); }}
                        className="rounded-lg border p-2 text-left disabled:opacity-40 transition-colors"
                        style={{ borderColor: active ? cssColor(m.def.palette.neonA) : "#2a2a44", background: active ? "rgba(255,255,255,0.05)" : undefined }}
                      >
                        <div className="flex justify-between items-start">
                          <p className="font-pixel text-[8px]" style={{ color: cssColor(m.def.palette.neonA) }}>{i + 1}. {m.def.name.toUpperCase()}</p>
                          <span className="text-[11px]">{locked ? "🔒" : b ? ORD[b.pos - 1] : ""}</span>
                        </div>
                        <p className="font-mono text-[9px] text-textDim mt-1">{WEATHER_LABEL[m.def.weather]} &middot; {(m.track.L / 1000).toFixed(1)} km</p>
                        <p className="font-mono text-[9px] text-textDim">{locked ? `Finish ${ORD[UNLOCK_POS - 1]}+ on the last map` : `Quests ${qd}/3${b ? ` · ${b.pts.toLocaleString()}` : ""}`}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="font-pixel text-[10px] mb-1" style={{ color: cssColor(sel.def.palette.neonA) }}>{sel.def.name.toUpperCase()}</p>
                <p className="font-mono text-[10px] text-textDim mb-1">{sel.def.blurb}</p>
                <p className="font-mono text-[10px] text-textDim">{sel.def.laps} laps &middot; 6 cars &middot; {sel.def.traffic} traffic &middot; {WEATHER_LABEL[sel.def.weather]}</p>
                <p className="font-mono text-[10px] text-textDim mt-1">Points: {POSITION_POINTS.map((p, i) => `${ORD[i]} ${p}`).join(" · ")} + style</p>
                <p className="font-pixel text-[8px] text-accentAmber mt-3 mb-1.5">AFTER-RACE QUESTS</p>
                <div className="flex flex-col gap-1.5">
                  {sel.quests.map((q) => {
                    const done = career.questsDone.includes(q.id);
                    return (
                      <div key={q.id} className="font-mono text-[10px]">
                        <span className="text-textLight" style={done ? { color: "#6bff6b" } : undefined}>{done ? "✓" : QUEST_ICON[q.type]} {q.title}</span>
                        <span className="text-textDim"> — {q.desc} </span>
                        <span className="text-accentAmber">+{q.reward.pts} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "ladder" && (
              <div>
                <p className="font-mono text-[10px] text-textDim mb-2">
                  Ten drivers rule the Underground. Beat them one at a time, from #10 up to the Midnight King. Each duel is a 1v1 on Harbor Loop.
                  {nextDriver && lp.level < nextDriver.reqLevel ? ` Next up: ${nextDriver.name}, who needs you at level ${nextDriver.reqLevel}. Race the maps to earn XP.` : ""}
                </p>
                <LadderPanel drivers={D.DRIVERS} beaten={career.ladder} level={lp.level} onPick={openDuel} carNames={carNames} />
              </div>
            )}

            {tab === "custom" && (
              <div>
                <CustomisePanel draft={shown} owned={career.owned} accent={paint} onChange={(d) => { setDraft(d); sfx.tap(); }} />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-lineColor pt-3">
                  {draft && pending.length > 0 ? (
                    <>
                      <span className="font-mono text-[10px] text-textDim">{pending.length} new part{pending.length > 1 ? "s" : ""} · <span className="text-accentAmber">${pendingCost}</span></span>
                      <span className="flex gap-2">
                        <button onClick={() => setDraft(null)} className="font-mono text-[10px] px-2.5 py-1.5 rounded-md border border-lineColor text-textDim">REVERT</button>
                        <button onClick={applyLook} disabled={career.cash < pendingCost} className="font-pixel text-[9px] px-3 py-1.5 rounded-md text-bgDeep disabled:opacity-40" style={{ background: paint }}>
                          BUY &amp; EQUIP
                        </button>
                      </span>
                    </>
                  ) : draft ? (
                    <>
                      <span className="font-mono text-[10px] text-textDim">Free changes</span>
                      <button onClick={() => { setSpec(draft); setDraft(null); sfx.correct(); }} className="font-pixel text-[9px] px-3 py-1.5 rounded-md text-bgDeep" style={{ background: paint }}>EQUIP</button>
                    </>
                  ) : (
                    <span className="font-mono text-[10px] text-textDim">Pick parts to try them on the car. Kits change how it drives.</span>
                  )}
                </div>
              </div>
            )}

            {tab === "upgrades" && (
              <div className="flex flex-col gap-3">
                {P.UPGRADES.map((u) => {
                  const lvl = career.levels[u.id];
                  const maxed = lvl >= u.max;
                  const cost = maxed ? null : u.cost[lvl];
                  return (
                    <div key={u.id}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-[11px] text-textLight">{u.name}</p>
                          <p className="font-mono text-[10px] text-textDim">{u.blurb}</p>
                        </div>
                        <button
                          onClick={() => buy(u.id)}
                          disabled={maxed || career.cash < cost}
                          className="font-mono text-[10px] px-2.5 py-1 rounded-md border disabled:opacity-40"
                          style={{ borderColor: paint, color: paint }}
                        >
                          {maxed ? "MAX" : `$${cost}`}
                        </button>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {Array.from({ length: u.max }).map((_, i) => (
                          <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < lvl ? paint : "#23233a" }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- duel intro ----------------
  if (phase === "intro" && duelTarget) {
    const d = duelTarget;
    const rematch = career.ladder >= 11 - d.rank;
    const dcar = P.CARS.find((c) => c.id === d.car.car);
    const accent = d.accent;
    return (
      <div className="max-w-4xl mx-auto">
        <p className="font-pixel text-[9px] text-textDim mb-2 text-center">UNDERGROUND LADDER &middot; {rematch ? "REMATCH" : "DUEL"} &middot; HARBOR LOOP &middot; {d.laps} LAPS</p>
        <div className="grid md:grid-cols-2 gap-4 items-stretch">
          <Showroom spec={duelSpec} height={300} />
          <div className="rounded-xl border bg-bgPanel p-4 flex flex-col text-left" style={{ borderColor: accent }}>
            <p className="font-pixel text-lg" style={{ color: accent }}>#{d.rank} {d.name.toUpperCase()}</p>
            <p className="font-mono text-[11px] text-textLight mb-0.5">{d.title}</p>
            <p className="font-mono text-[10px] text-textDim mb-3">{d.full}{d.age ? `, ${d.age}` : ""} &middot; {d.from} &middot; {dcar.name}</p>
            <p className="font-mono text-[11px] text-textDim mb-3">{d.bio}</p>
            <p className="font-mono text-[12px] italic mb-3" style={{ color: accent }}>&ldquo;{d.taunt}&rdquo;</p>
            <p className="font-mono text-[10px] text-textDim">Style: <span className="text-textLight">{d.style}</span></p>
            <p className="font-mono text-[10px] text-textDim mb-3">
              Pace: <span className="text-textLight">{Math.round(d.ai.base * 100)}%</span>
              {d.ai.useNos ? " · uses nitrous" : ""}{d.ai.block ? " · blocks you" : ""}
            </p>
            <p className="font-mono text-[10px] text-accentAmber">
              {rematch ? "Rematch pays 20% cash and a little XP." : `Win: $${d.reward.cash.toLocaleString()} · ${d.reward.xp} XP · ${d.reward.pts} pts${d.unlockCar ? " · NEW CAR" : ""}`}
            </p>
            <div className="flex-1" />
            <button onClick={startDuel} className="mt-4 font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accent }}>START DUEL ▸</button>
            <button onClick={() => { setDuelTarget(null); setPhase("garage"); setTab("ladder"); }} className="mt-2 font-mono text-[11px] text-textDim hover:text-textLight">← back to the garage</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- final ----------------
  if (phase === "final") {
    return (
      <div className="max-w-md mx-auto text-center">
        <p className="font-pixel text-sm mb-1" style={{ color: paint }}>CAREER SUMMARY</p>
        <p className="font-mono text-[11px] text-textDim mb-5">Your best race on each map, every quest, and every driver you beat on the ladder.</p>
        <div className="rounded-xl border border-lineColor bg-bgPanel p-4 mb-5 text-left font-mono text-[11px]">
          {mapInfo.filter((m) => career.best[m.def.id]).map((m) => {
            const b = career.best[m.def.id];
            return (
              <div key={m.def.id} className="flex justify-between py-1 border-b border-lineColor">
                <span className="text-textDim">{m.def.name}</span>
                <span className="text-textLight">{ORD[b.pos - 1]} &middot; {b.pts.toLocaleString()} pts</span>
              </div>
            );
          })}
          {career.ladder > 0 && (
            <div className="flex justify-between py-1 border-b border-lineColor">
              <span className="text-textDim">Underground Ladder ({career.ladder}/10 beaten)</span>
              <span className="text-textLight">{career.duelPts.toLocaleString()} pts</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-lineColor">
            <span className="text-textDim">Quests ({career.questsDone.length} done)</span>
            <span className="text-textLight">{career.questPts.toLocaleString()} pts</span>
          </div>
          <div className="flex justify-between pt-3">
            <span className="text-accentAmber">TOTAL SCORE</span>
            <span className="text-accentAmber">{totalScore.toLocaleString()}</span>
          </div>
        </div>
        <button onClick={submit} className="font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep" style={{ background: paint }}>
          SUBMIT SCORE ▸
        </button>
        <button onClick={() => setPhase("garage")} className="block mx-auto mt-3 font-mono text-[11px] text-textDim hover:text-textLight">
          ← back to the garage
        </button>
      </div>
    );
  }

  // ---------------- race / free roam ----------------
  const def = mapInfo[mapIdx].def;
  const roam = raceUi === "roam";
  const mini = (() => {
    const tr = raceRef.current?.track;
    if (!tr) return null;
    const pts = [];
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let s = 0; s < tr.L; s += 18) {
      const p = P.sampleTrack(tr, s);
      pts.push(p);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const sc = 110 / Math.max(maxX - minX, maxZ - minZ);
    const ox = 10 + (110 - (maxX - minX) * sc) / 2, oz = 10 + (110 - (maxZ - minZ) * sc) / 2;
    const proj = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
    return { d: "M" + pts.map((p) => proj(p.x, p.z).join(",")).join(" L") + " Z", proj, tr };
  })();

  return (
    <div>
      <div
        ref={frameBoxRef}
        className="bg-black overflow-hidden border border-lineColor"
        style={stageBoxStyle(stage.isFull, { borderRadius: stage.isFull ? 0 : 12 })}
      >
        <div ref={mountRef} className="absolute inset-0" />
        {webglFailed && (
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <p className="font-mono text-xs text-accentMagenta">3D graphics aren't available in this browser, so the race can't start. Try Chrome, Edge or Firefox with hardware acceleration on.</p>
          </div>
        )}
        {hud && !webglFailed && (
          <div className="absolute inset-0 pointer-events-none select-none font-mono text-white" style={{ textShadow: "0 0 8px rgba(0,0,0,0.9)" }}>
            {!roam && (
              <div className="absolute top-3 left-4">
                <p className="font-pixel text-2xl" style={{ color: paint }}>{ORD[hud.pos - 1]}<span className="text-xs text-white/70"> /{hud.n}</span></p>
                <p className="text-[11px] text-white/80">LAP {hud.lap}/{hud.laps}</p>
                {raceRef.current?.duel && (
                  <p className="text-[11px] mt-1" style={{ color: raceRef.current.duel.accent }}>
                    VS {raceRef.current.duel.name.toUpperCase()} &middot; <span style={{ color: hud.gap >= 0 ? "#6bff6b" : "#ff6b6b" }}>{hud.gap >= 0 ? "+" : ""}{hud.gap} m</span>
                  </p>
                )}
              </div>
            )}
            <div className="absolute top-3 right-4 text-right">
              <p className="text-lg">{roam ? "FREE ROAM" : fmtTime(hud.time)}</p>
              <p className="text-[10px] text-white/70">{def.name.toUpperCase()} &middot; {WEATHER_LABEL[def.weather].toUpperCase()}</p>
              <p className="text-[10px] text-white/50">CAM: {camLabel} (C)</p>
            </div>
            {!roam && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center">
                <p className="text-[10px] text-white/70">STYLE</p>
                <p className="font-pixel text-sm" style={{ color: "#ffd23f" }}>{hud.style.toLocaleString()}</p>
                <p className="text-[11px]" style={{ color: hud.mult > 1 ? "#2de2ff" : "#aaa" }}>x{hud.mult.toFixed(2)}</p>
              </div>
            )}
            <div className="absolute bottom-4 left-4">
              <div className="flex items-end gap-3">
                <div>
                  <p className="font-pixel text-3xl leading-none">{hud.speed}</p>
                  <p className="text-[10px] text-white/70">KM/H</p>
                </div>
                <div>
                  <p className="font-pixel text-lg leading-none" style={{ color: hud.rpm > 0.93 ? "#ff4d4d" : "#fff" }}>{hud.gear}</p>
                  <p className="text-[10px] text-white/70">GEAR</p>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-40 rounded-full bg-black/60 border border-white/25 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.round(hud.rpm * 100)}%`, background: hud.rpm > 0.9 ? "#ff4d4d" : "#fff" }} />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-56">
              <div className="flex justify-between text-[10px] mb-1">
                <span style={{ color: hud.nos ? "#6fd0ff" : "#fff" }}>NITRO</span>
                <span className="text-white/60">SHIFT</span>
              </div>
              <div className="h-2.5 rounded-full bg-black/60 border border-white/30 overflow-hidden">
                <div className="h-full" style={{ width: `${hud.nitro}%`, background: hud.nos ? "#6fd0ff" : "linear-gradient(90deg,#2de2ff,#b45cff)", boxShadow: hud.nos ? "0 0 12px #6fd0ff" : "none" }} />
              </div>
            </div>
            {mini && (
              <svg className="absolute bottom-3 right-3 w-[130px] h-[130px] rounded-lg bg-black/40" viewBox="0 0 130 130">
                <path d={mini.d} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                {roam && raceRef.current?.questDefs.map((q, qi) => {
                  const s = q.type === "drift" ? q.s0 : q.type === "gates" ? q.gates[0].s : q.s;
                  if (s === undefined) return null;
                  const p = P.sampleTrack(mini.tr, s);
                  const [x, y] = mini.proj(p.x, p.z);
                  const done = hud.quests && hud.quests[qi]?.text === "COMPLETE";
                  return <circle key={q.id} cx={x} cy={y} r="3.5" fill={done ? "#6bff6b" : "#ffd23f"} stroke="#000" strokeWidth="0.8" />;
                })}
                {hud.dots.map((dd, i) => {
                  const p = P.sampleTrack(mini.tr, dd.s);
                  const [x, y] = mini.proj(p.x, p.z);
                  return <circle key={i} cx={x} cy={y} r={dd.me ? 4 : 3} fill={dd.me ? paint : dd.c} stroke={dd.me ? "#fff" : "none"} strokeWidth="1" />;
                })}
              </svg>
            )}
            {roam && hud.quests && (
              <div className="absolute left-4 top-24 w-[250px] rounded-lg bg-black/55 border border-white/15 p-2.5">
                <p className="font-pixel text-[9px] mb-1.5" style={{ color: "#ffd23f" }}>QUESTS</p>
                {hud.quests.map((q, i) => (
                  <div key={i} className="mb-1.5 last:mb-0">
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: q.text === "COMPLETE" ? "#6bff6b" : "#fff" }}>{QUEST_ICON[q.type]} {q.title}</span>
                      <span className="text-white/70">{q.text}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/15 overflow-hidden mt-0.5">
                      <div className="h-full" style={{ width: `${Math.round(q.frac * 100)}%`, background: q.text === "COMPLETE" ? "#6bff6b" : "#2de2ff" }} />
                    </div>
                    <p className="text-[9px] text-white/50 mt-0.5 leading-tight">{q.desc}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="absolute left-1/2 top-[30%] -translate-x-1/2 text-center">
              {hud.popups.map((p) => (
                <p key={p.id} className="font-pixel text-[11px]" style={{ color: p.color, opacity: Math.max(0, 1 - p.t / 1.6), transform: `translateY(${-p.t * 14}px)` }}>
                  {p.text}
                </p>
              ))}
              {hud.drifting && hud.drift > 15 && <p className="font-pixel text-xs" style={{ color: "#ff2d95" }}>DRIFT {hud.drift}</p>}
            </div>
            <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center">
              {hud.toasts.map((p) => (
                <div key={p.id} style={{ opacity: Math.max(0, Math.min(1, (3.4 - p.t) * 1.5)) }}>
                  <p className="font-pixel text-sm" style={{ color: p.color }}>{p.text}</p>
                  <p className="text-[11px] text-white/80">{p.sub}</p>
                </div>
              ))}
            </div>
            {hud.countdown !== null && (
              <p className="absolute inset-0 flex items-center justify-center font-pixel text-7xl" style={{ color: hud.countdown <= 0 ? "#6bff6b" : "#fff" }}>
                {hud.countdown <= 0 ? "GO!" : hud.countdown}
              </p>
            )}
            {showHint && raceUi !== "results" && (
              <p className="absolute bottom-[96px] left-1/2 -translate-x-1/2 text-[10px] text-white/70 text-center">
                {roam
                  ? "Find the glowing quest markers  ·  R reset car  ·  ENTER to leave free roam"
                  : "W/S gas & brake  ·  A/D steer  ·  hold SPACE in a bend to drift  ·  SHIFT nitro  ·  C camera"}
              </p>
            )}
          </div>
        )}
        <div className="absolute top-14 right-4 pointer-events-auto flex gap-1">
          <button onClick={() => setMutedState(toggleMuted())} className="text-[10px] font-mono px-2 py-1 rounded bg-black/50 text-white/80">{muted ? "🔇" : "🔊"}</button>
          <button onClick={toggleFullscreen} className="text-[10px] font-mono px-2 py-1 rounded bg-black/50 text-white/80">⛶</button>
        </div>
        {roam && (
          <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 pointer-events-auto">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("mb-exit-roam"))}
              className="font-pixel text-[9px] px-4 py-2 rounded-md text-bgDeep"
              style={{ background: paint }}
            >
              LEAVE FREE ROAM ▸ (ENTER)
            </button>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <p className="font-pixel text-lg text-white mb-3">PAUSED</p>
            <button
              onClick={() => { const R = raceRef.current; if (R) { R.paused = false; setPaused(false); } }}
              className="font-pixel text-[10px] px-5 py-2.5 rounded-md text-bgDeep pointer-events-auto"
              style={{ background: paint }}
            >
              RESUME (P)
            </button>
          </div>
        )}
        {raceUi === "results" && result && result.duel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="rounded-xl border bg-bgPanel p-6 w-[380px] text-center" style={{ borderColor: result.duel.accent }}>
              <p className="font-pixel text-xl mb-1" style={{ color: result.win ? "#ffd23f" : "#ff6b6b" }}>{result.win ? "YOU WIN" : "YOU LOST"}</p>
              <p className="font-mono text-[11px] text-textDim mb-3">vs #{result.duel.rank} {result.duel.name} &middot; {fmtTime(result.time)}</p>
              <p className="font-mono text-[12px] italic mb-4" style={{ color: result.duel.accent }}>&ldquo;{result.win ? result.duel.loss : result.duel.win}&rdquo;</p>
              <div className="text-left font-mono text-[11px] space-y-1 mb-4">
                <div className="flex justify-between"><span className="text-textDim">Cash</span><span>${result.earned}</span></div>
                <div className="flex justify-between"><span className="text-textDim">XP</span><span>+{result.xp}</span></div>
                {result.pts > 0 && <div className="flex justify-between"><span className="text-textDim">Score</span><span className="text-accentAmber">+{result.pts}</span></div>}
                {result.unlockCar && <p className="pt-1" style={{ color: "#6bff6b" }}>New car unlocked: {P.CARS.find((c) => c.id === result.unlockCar).name}!</p>}
                {result.win && !result.rematch && result.duel.rank > 1 && <p className="pt-1" style={{ color: "#6bff6b" }}>The next driver on the ladder is waiting.</p>}
              </div>
              <button onClick={() => window.dispatchEvent(new CustomEvent("mb-skip"))} className="w-full font-pixel text-[10px] px-5 py-2.5 rounded-md text-bgDeep" style={{ background: paint }}>
                BACK TO THE LADDER ▸
              </button>
            </div>
          </div>
        )}
        {raceUi === "results" && result && !result.duel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <div className="rounded-xl border border-lineColor bg-bgPanel p-6 w-[360px] text-center">
              <p className="font-pixel text-xl mb-1" style={{ color: result.pos === 1 ? "#ffd23f" : paint }}>{ORD[result.pos - 1]} PLACE</p>
              <p className="font-mono text-[11px] text-textDim mb-4">{def.name} &middot; {fmtTime(result.time)}</p>
              <div className="text-left font-mono text-[11px] space-y-1 mb-4">
                <div className="flex justify-between"><span className="text-textDim">Position</span><span>{POSITION_POINTS[result.pos - 1]}</span></div>
                <div className="flex justify-between"><span className="text-textDim">Drifting</span><span>{result.drift}</span></div>
                <div className="flex justify-between"><span className="text-textDim">Near misses</span><span>{result.near}</span></div>
                <div className="flex justify-between"><span className="text-textDim">Drafting</span><span>{result.draft}</span></div>
                <div className="flex justify-between"><span className="text-textDim">Style total{result.capped ? " (capped)" : ""}</span><span>{result.style}</span></div>
                <div className="flex justify-between border-t border-lineColor pt-1 mt-1"><span className="text-accentAmber">Race score</span><span className="text-accentAmber">{result.pts.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-textDim">Cash earned</span><span>${result.earned}</span></div>
                {result.unlock && <p className="pt-1" style={{ color: "#6bff6b" }}>Next map unlocked!</p>}
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("mb-start-roam"))}
                className="w-full font-pixel text-[10px] px-5 py-2.5 rounded-md text-bgDeep mb-2"
                style={{ background: paint }}
              >
                FREE ROAM &amp; QUESTS ▸
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("mb-skip"))}
                className="w-full font-mono text-[11px] px-4 py-2 rounded-md border border-lineColor text-textDim hover:text-textLight"
              >
                Skip to the garage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// The public component: the game plus the soundtrack and its on/off button.
export default function MidnightBurnClassic(props) {
  const musicRef = useRef(null);
  const [musicOn, setMusicOn] = useState(true);
  useEffect(() => {
    const m = createMusicPlayer();
    musicRef.current = m;
    setMusicOn(m.isEnabled());
    return () => { m.stop(); musicRef.current = null; };
  }, []);
  const kick = () => { musicRef.current && musicRef.current.isEnabled() && musicRef.current.start(); };
  return (
    <div onPointerDownCapture={kick} onKeyDownCapture={kick} className="relative">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => { const m = musicRef.current; if (!m) return; const on = !m.isEnabled(); m.setEnabled(on); setMusicOn(on); }}
          className="font-mono text-[10px] px-2.5 py-1 rounded-md border border-lineColor text-textDim hover:text-textLight"
          title="Soundtrack on / off"
        >
          {musicOn ? "♪ SOUNDTRACK ON" : "♪ SOUNDTRACK OFF"}
        </button>
      </div>
      <MidnightBurnInner {...props} musicRef={musicRef} onMood={(v) => musicRef.current && musicRef.current.setIntensity(v)} />
    </div>
  );
}
