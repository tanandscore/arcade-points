"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { THREE, createRig, clearScene, mesh } from "@/threeplay/core";
import { makeCastle, makeTerrain, makeTrees } from "./scenery";
import { heightAt, COURSES, createBroomRace } from "./broom";
import { RANKS, createDuel } from "./duel";
import { FLOORS, createCrypt } from "./crypt";

// Spellwright — a free 3D wizard-school game: Duel Club (spell duels), Broom League (flying races) and the Crypt (dungeon crawl).
const KEY = "ts-spellwright-v1";
const FONT = "'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const GOLD = "#f2c230", INK = "rgba(10,12,34,0.82)", EDGE = "rgba(242,194,48,0.55)";
const panel = { background: INK, border: `1px solid ${EDGE}`, borderRadius: 10, color: "#f4ecd8", fontFamily: FONT };
const emptyProg = () => ({ duel: Array(RANKS.length).fill(-1), broom: Array(COURSES.length).fill(-1), crypt: Array(FLOORS.length).fill(-1), best: { duel: Array(RANKS.length).fill(0), broom: Array(COURSES.length).fill(0), crypt: Array(FLOORS.length).fill(0) } });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.duel && s.broom && s.crypt && s.best) return s; } catch {} return emptyProg(); }
const sumStars = (p) => [...p.duel, ...p.broom, ...p.crypt].reduce((a, b) => a + Math.max(0, b), 0);
const powerOf = (p) => Math.min(6, 1 + Math.floor(sumStars(p) / 4));
const totalScore = (p) => [...p.best.duel, ...p.best.broom, ...p.best.crypt].reduce((a, b) => a + b, 0);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const unlockedAll = () => typeof window !== "undefined" && !!window.__QA_UNLOCK;

function buildMenuScene(rig) {
  clearScene(rig); const s = rig.scene;
  rig.setSky({ zenith: 0x0a1030, mid: 0x4a3a78, horizon: 0xffa070, sunDir: [0.3, 0.1, -0.9], sunColor: 0xffb070, sunSize: 0.03, glow: 1.2, cloud: 0.5, cloudColor: 0xffb0a0, cloudShade: 0x30204a, stars: 0.8 });
  s.fog = new THREE.Fog(0x8a5a7a, 120, 900);
  s.add(new THREE.HemisphereLight(0xffb898, 0x2a2a50, 1.5)); const sun = new THREE.DirectionalLight(0xffb070, 3); sun.position.set(200, 80, -300); s.add(sun);
  const col = (y, x, z, c) => { if (y < 0.5) c.setHex(0x6a7a6a); else if (y < 55) c.setHex(0x4a6a3a); else if (y < 100) c.setHex(0x6a6a6a); else c.setHex(0xe8eef4); };
  s.add(makeTerrain(heightAt, 2400, 160, col)); const w = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 })); w.rotation.x = -Math.PI / 2; w.position.y = -0.4; s.add(w);
  const c = makeCastle(5); c.position.set(0, 36, 0); c.scale.setScalar(1.35); s.add(c); s.add(makeTrees(heightAt, 900, 700, (x, y, z) => Math.hypot(x, z) < 150));
  const birds = []; for (let i = 0; i < 8; i++) { const b = mesh(new THREE.ConeGeometry(0.4, 1.4, 4), 0x1a1a2a, { cast: false }); b.rotation.x = Math.PI / 2; s.add(b); birds.push({ b, a: Math.random() * 6.28, r: 90 + Math.random() * 60, h: 90 + Math.random() * 40, sp: 0.15 + Math.random() * 0.1 }); }
  return { update(dt, t) { const a = t * 0.05; rig.camera.position.set(Math.cos(a) * 190, 95 + Math.sin(t * 0.1) * 8, Math.sin(a) * 190); rig.camera.lookAt(0, 70, 0); for (const b of birds) { b.a += dt * b.sp; b.b.position.set(Math.cos(b.a) * b.r, b.h + Math.sin(b.a * 3) * 4, Math.sin(b.a) * b.r); b.b.rotation.y = -b.a; } } };
}

function Bar({ v, max, color, w = 220, h = 14, label }) {
  return (<div style={{ width: w, height: h, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, overflow: "hidden", position: "relative" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, height: "100%", background: color, transition: "width 90ms" }} />
    {label ? <span style={{ position: "absolute", left: 8, top: -1, fontSize: h - 3, lineHeight: `${h}px`, fontWeight: 700, textShadow: "0 1px 2px #000" }}>{label}</span> : null}
  </div>);
}
function Stars({ n, size = 16 }) { return <span style={{ letterSpacing: 2, fontSize: size, color: GOLD }}>{[0, 1, 2].map((i) => <span key={i} style={{ opacity: i < n ? 1 : 0.22 }}>★</span>)}</span>; }

export default function Spellwright({ onFinish, accentColor = "#6fa8ff" }) {
  const stage = useStage();
  const mountRef = useRef(null), rigRef = useRef(null), modeRef = useRef(null), menuRef = useRef(null), screenRef = useRef("home");
  const [screen, setScreenS] = useState("home");
  const [prog, setProg] = useState(emptyProg);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [fail, setFail] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const [locked, setLocked] = useState(false);
  const [kind, setKind] = useState("duel");
  const progRef = useRef(prog); progRef.current = prog;
  const setScreen = useCallback((s) => { screenRef.current = s; setScreenS(s); }, []);

  useEffect(() => { setProg(load()); }, []);
  const save = useCallback((p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, []);

  const toMenu = useCallback((to = "home") => {
    const rig = rigRef.current; if (!rig) return;
    if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.camera.fov = 58; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix(); rig.paused = false; rig.unlock();
    menuRef.current = buildMenuScene(rig); setHud(null); setResult(null); setPaused(false); setScreen(to);
  }, [setScreen]);

  useEffect(() => {
    let rig;
    try { rig = createRig(mountRef.current, { exposure: 1.15, bloom: [0.5, 0.65, 0.8], shadows: true, grade: { vig: 0.45, grain: 0.015, sat: 1.08, contrast: 1.07, shadow: [0.92, 0.95, 1.08], high: [1.05, 1.0, 0.94] } }); } catch (e) { setFail(true); return; }
    rigRef.current = rig; rig.update = (dt, t) => { if (modeRef.current) modeRef.current.update(dt, t); else if (menuRef.current) menuRef.current.update(dt, t); };
    rig.setLockHandler((on) => { setLocked(on); if (!on && screenRef.current === "play" && !rig.noPause) { rig.paused = true; setPaused(true); } });
    menuRef.current = buildMenuScene(rig); rig.start();
    const iv = setInterval(() => { if (modeRef.current && !rig.paused) setHud(modeRef.current.snapshot()); }, 90);
    const esc = (e) => { if (e.code === "Escape" && screenRef.current === "play" && !rig.noPause) { rig.paused = !rig.paused; setPaused(rig.paused); if (!rig.paused) { try { rig.el.requestPointerLock(); } catch {} } } };
    window.addEventListener("keydown", esc);
    if (typeof window !== "undefined" && window.__QA_UNLOCK) window.__sw = { rig, launch: (k, i) => launchRef.current(k, i), toMenu, mode: () => modeRef.current, prog: () => progRef.current };
    return () => { clearInterval(iv); window.removeEventListener("keydown", esc); if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null; rig.dispose(); rigRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const record = useCallback((k, i, stars, score) => {
    setProg((p) => { const n = JSON.parse(JSON.stringify(p)); n[k][i] = Math.max(n[k][i], stars); n.best[k][i] = Math.max(n.best[k][i], score); save(n); return n; });
  }, [save]);

  const launchRef = useRef(null);
  const launch = useCallback((k, i) => {
    const rig = rigRef.current; if (!rig) return;
    if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.paused = false; rig.sound.resume(); rig.sound.setOn(true); rig.sound.stopMusic(); rig.sound.music(k === "broom" ? "calm" : "epic");
    const power = powerOf(progRef.current); setResult(null); setPaused(false); setKind(k); setHud(null);
    rig.camera.fov = 62; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix();
    if (k === "duel") modeRef.current = createDuel(rig, { rank: i, power, onEnd: (won, d) => {
      const stars = won ? 1 + (d.taken < 45 ? 1 : 0) + (d.time < (i >= 5 ? 110 : 60) ? 1 : 0) : 0;
      const score = won ? Math.round(1500 + Math.max(0, 90 - d.time) * 15 + d.hp * 8 + d.parries * 80 + i * 250 + stars * 300) : 0;
      if (won) record("duel", i, stars, score); rig.unlock(); setResult({ kind: "duel", idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Damage taken", Math.round(d.taken)], ["Parries", d.parries]] }); setScreen("result");
    } });
    else if (k === "broom") modeRef.current = createBroomRace(rig, { course: i, onEnd: (place, d) => {
      const c = COURSES[i], won = place <= 3, stars = place === 1 ? (d.hits >= d.rings * 0.8 ? 3 : 2) : place === 2 ? 2 : place === 3 ? 1 : 0;
      const score = Math.round([0, 3000, 2000, 1200, 400][place] + d.hits * 60 + Math.max(0, c.par - d.time) * 20);
      record("broom", i, stars, score); rig.unlock(); setResult({ kind: "broom", idx: i, won, stars, score, place, lines: [["Place", ["", "1st", "2nd", "3rd", "4th"][place]], ["Rings", `${d.hits} / ${d.rings}`], ["Time", fmtT(d.time)]] }); setScreen("result");
    } });
    else modeRef.current = createCrypt(rig, { floor: i, power, onEnd: (won, d) => {
      const stars = won ? 1 + (d.hp >= d.maxHp * 0.5 ? 1 : 0) + (d.crystals >= 6 ? 1 : 0) : 0;
      const score = won ? Math.round(2000 + d.kills * 40 + d.crystals * 150 + d.hp * 8 + i * 300 + stars * 300) : Math.round(d.kills * 40);
      if (won) record("crypt", i, stars, score); rig.unlock(); setResult({ kind: "crypt", idx: i, won, stars, score, lines: [["Monsters", d.kills], ["Crystals", `${d.crystals} / 6`], ["Time", fmtT(d.time)]] }); setScreen("result");
    } });
    setScreen("play"); stage.enter && stage.enter();
  }, [record, setScreen, stage]);
  launchRef.current = launch;

  function exitGame() { const rig = rigRef.current; if (rig) rig.unlock(); onFinish(totalScore(progRef.current)); }
  function toggleSound() { const rig = rigRef.current; if (!rig) return; const v = !sound; setSound(v); rig.sound.setOn(v); if (v && screenRef.current === "play") rig.sound.music(kind === "broom" ? "calm" : "epic"); }
  function resume() { const rig = rigRef.current; if (!rig) return; rig.paused = false; setPaused(false); try { rig.el.requestPointerLock(); } catch {} rig.el.focus(); }

  if (fail) return (<div className="text-center max-w-md mx-auto p-6"><p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>SPELLWRIGHT</p><p className="text-textDim text-sm">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration turned on.</p><button onClick={() => onFinish(0)} className="mt-4 px-4 py-2 rounded bg-white/10 text-white text-sm">Back</button></div>);

  const qa = unlockedAll();
  const unl = (k, i) => qa || i === 0 || prog[k][i - 1] >= 1;
  const playing = screen === "play" || screen === "result";
  const modeInfo = { duel: ["⚡ Duel Club", "Face rival wizards in the Rune Court. Dodge, parry and out-cast them.", RANKS.length, "duel"], broom: ["🧹 Broom League", "Race three rival riders through glowing rings above the valley.", COURSES.length, "broom"], crypt: ["💀 The Crypt", "Fight through four haunted floors and bring down the Warlock.", FLOORS.length, "crypt"] };

  return (
    <div style={stageBoxStyle(stage.isFull, { background: "#05060f", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT })}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      {/* top-right controls */}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 6 }}>
        <button onClick={toggleSound} style={{ ...panel, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>{sound ? "🔊" : "🔇"}</button>
        <button onClick={() => (stage.isFull ? stage.exit() : stage.enter())} style={{ ...panel, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>{stage.isFull ? "Exit full screen" : "Full screen"}</button>
        {screen !== "home" && screen !== "play" ? <button onClick={() => toMenu("home")} style={{ ...panel, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Main menu</button> : null}
        {screen === "home" ? <button onClick={exitGame} style={{ ...panel, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>Leave</button> : null}
      </div>

      {screen === "home" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: "radial-gradient(ellipse at center, rgba(5,6,20,0.15), rgba(5,6,20,0.7))" }}>
          <div style={{ textAlign: "center", color: "#fff6d8", textShadow: "0 4px 24px rgba(0,0,0,.7)" }}>
            <div style={{ fontSize: "clamp(34px,6vw,76px)", letterSpacing: "0.12em", fontWeight: 700, lineHeight: 1 }}>SPELLWRIGHT</div>
            <div style={{ fontSize: "clamp(12px,1.6vw,19px)", opacity: 0.9, marginTop: 6, fontStyle: "italic" }}>Academy of the Ember Spire</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
            {Object.entries(modeInfo).map(([k, [name, desc, n]]) => {
              const got = prog[k].filter((s) => s >= 1).length, st = prog[k].reduce((a, b) => a + Math.max(0, b), 0);
              return (<button key={k} onClick={() => { rigRef.current && rigRef.current.sound.play("click"); setKind(k); setScreen("select"); }} style={{ ...panel, width: "min(260px,28vw)", minWidth: 190, padding: "16px 16px 14px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{name}</div>
                <div style={{ fontSize: 13, opacity: 0.88, margin: "6px 0 10px", lineHeight: 1.35 }}>{desc}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{got} / {n} cleared · <span style={{ color: GOLD }}>{st} ★</span></div>
              </button>);
            })}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#f4ecd8", fontSize: 13 }}>
            <span style={{ ...panel, padding: "6px 12px" }}>Wand power <b style={{ color: GOLD }}>{powerOf(prog)}</b> <span style={{ opacity: 0.7 }}>(earn stars to raise it)</span></span>
            <button onClick={() => setScreen("help")} style={{ ...panel, padding: "6px 12px", cursor: "pointer" }}>How to play</button>
          </div>
        </div>
      )}

      {screen === "select" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(5,6,20,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px 20px", gap: 12 }}>
          <div style={{ color: GOLD, fontSize: 26, fontWeight: 700 }}>{modeInfo[kind][0]}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 900, overflow: "auto", maxHeight: "68%" }}>
            {(kind === "duel" ? RANKS : kind === "broom" ? COURSES : FLOORS).map((x, i) => {
              const ok = unl(kind, i), s = prog[kind][i];
              return (<button key={i} disabled={!ok} onClick={() => launch(kind, i)} style={{ ...panel, width: 270, padding: "12px 14px", textAlign: "left", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 16 }}>{kind === "duel" ? `${i + 1}. ${x.name}` : `${i + 1}. ${x.name}`}</b><Stars n={Math.max(0, s)} /></div>
                <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 3 }}>{ok ? (x.title || x.sub) : "Clear the one before to unlock"}</div>
                {prog.best[kind][i] ? <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4 }}>Best {prog.best[kind][i].toLocaleString()}</div> : null}
              </button>);
            })}
          </div>
          <button onClick={() => setScreen("home")} style={{ ...panel, padding: "8px 18px", cursor: "pointer" }}>Back</button>
        </div>
      )}

      {screen === "help" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(5,6,20,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...panel, maxWidth: 760, width: "100%", padding: "20px 24px", maxHeight: "90%", overflow: "auto" }}>
            <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>How to play</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14, lineHeight: 1.5 }}>
              <div><b style={{ color: GOLD }}>Duels & the Crypt</b><br />W A S D: move · Shift: run · Space: dodge roll<br />Mouse: look and aim · Left click: Zing bolt<br />2: Gale (blast and stun) · 3: Frostbind (slow)<br />Hold right click: Aegis ward (block, or PARRY a bolt back at the last instant)<br />R: Starfall (when the gold bar is full) · Tab: lock on / switch target</div>
              <div><b style={{ color: GOLD }}>Broom League</b><br />Mouse or W A S D: steer<br />Shift: boost · Space: brake<br />Fly through glowing rings for speed. Missing one only loses the bonus.<br />Beat the three rival riders to the golden arch.<br /><br /><b style={{ color: GOLD }}>Tip</b><br />Esc pauses and frees your mouse.</div>
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}><button onClick={() => setScreen("home")} style={{ ...panel, padding: "8px 18px", cursor: "pointer" }}>Got it</button></div>
          </div>
        </div>
      )}

      {playing && hud && hud.kind ? <Hud hud={hud} kind={hud.kind} accent={accentColor} /> : null}
      {screen === "play" && !paused && !locked && hud && hud.phase !== "intro" ? <div style={{ position: "absolute", bottom: 84, left: 14, ...panel, padding: "5px 10px", fontSize: 12, opacity: 0.85, pointerEvents: "none" }}>Click the game once to aim with your mouse. Esc lets go.</div> : null}
      {screen === "play" && paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(5,6,20,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 8 }}>
          <div style={{ color: GOLD, fontSize: 30, fontWeight: 700 }}>Paused</div>
          <button onClick={resume} style={{ ...panel, padding: "10px 28px", cursor: "pointer", fontSize: 16 }}>Resume</button>
          <button onClick={() => launch(kind, result ? result.idx : lastIdx(modeRef.current, kind))} style={{ ...panel, padding: "8px 22px", cursor: "pointer" }}>Restart</button>
          <button onClick={() => toMenu("select")} style={{ ...panel, padding: "8px 22px", cursor: "pointer" }}>Quit to menu</button>
        </div>
      )}
      {screen === "result" && result && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(5,6,20,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8 }}>
          <div style={{ ...panel, padding: "22px 34px", textAlign: "center", minWidth: 340 }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: result.won ? GOLD : "#ff8a7a" }}>{result.kind === "broom" ? (result.won ? "Race complete!" : "Not this time") : result.won ? "Victory!" : "Defeated"}</div>
            {result.won ? <div style={{ margin: "6px 0 10px" }}><Stars n={result.stars} size={34} /></div> : <div style={{ margin: "8px 0", opacity: 0.8, fontSize: 14 }}>Shake it off and try again.</div>}
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>{result.lines.map(([a, b]) => <div key={a}><span style={{ opacity: 0.7 }}>{a}</span> &nbsp; <b>{b}</b></div>)}<div style={{ marginTop: 6, fontSize: 18 }}>Score <b style={{ color: GOLD }}>{result.score.toLocaleString()}</b></div></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => launch(result.kind, result.idx)} style={{ ...panel, padding: "9px 20px", cursor: "pointer" }}>Try again</button>
              {result.won && result.idx + 1 < modeInfo[result.kind][2] ? <button onClick={() => launch(result.kind, result.idx + 1)} style={{ ...panel, padding: "9px 20px", cursor: "pointer", background: GOLD, color: "#1a1428", borderColor: GOLD, fontWeight: 700 }}>Next</button> : null}
              <button onClick={() => { setKind(result.kind); toMenu("select"); }} style={{ ...panel, padding: "9px 20px", cursor: "pointer" }}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function lastIdx(mode, kind) { if (!mode) return 0; if (kind === "duel") return RANKS.indexOf(mode.rank); if (kind === "broom") return COURSES.indexOf(mode.course); if (kind === "crypt") return FLOORS.indexOf(mode.floor); return 0; }

function Hud({ hud, kind, accent }) {
  const big = hud.msg;
  const spell = (key, name, cd, max, ready, color) => (<div style={{ width: 62, textAlign: "center", opacity: ready ? 1 : 0.5 }}><div style={{ position: "relative", width: 54, height: 54, margin: "0 auto", borderRadius: 12, border: `2px solid ${ready ? color : "#555"}`, background: "rgba(8,10,30,0.8)", boxShadow: ready ? `0 0 14px ${color}88` : "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color, fontSize: 20 }}>{key}{cd > 0 ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.min(100, (cd / max) * 100)}%`, background: "rgba(0,0,0,0.6)", borderRadius: 10 }} /> : null}</div><div style={{ fontSize: 11, marginTop: 2, color: "#f4ecd8" }}>{name}</div></div>);
  if (kind === "broom") {
    return (<div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, color: "#fff6d8" }}>
      <div style={{ position: "absolute", top: 12, left: 14, ...panel, padding: "8px 14px" }}><div style={{ fontSize: 12, opacity: 0.75 }}>{hud.name}</div><div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{["", "1st", "2nd", "3rd", "4th"][hud.place] || "-"} <span style={{ fontSize: 13, opacity: 0.8 }}>of 4</span></div></div>
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", ...panel, padding: "6px 16px", textAlign: "center" }}><div style={{ fontSize: 12, opacity: 0.7 }}>Rings</div><b style={{ fontSize: 20 }}>{hud.ring} / {hud.rings}</b> <span style={{ marginLeft: 12, opacity: 0.8 }}>{fmtT(hud.time)}</span></div>
      <div style={{ position: "absolute", bottom: 18, left: 18, ...panel, padding: "10px 14px" }}><div style={{ fontSize: 12, opacity: 0.7 }}>Speed</div><b style={{ fontSize: 26 }}>{Math.round(hud.speed * 3.6)}</b> <span style={{ fontSize: 12, opacity: 0.7 }}>km/h</span><div style={{ marginTop: 6 }}><Bar v={hud.boost} max={100} color="linear-gradient(90deg,#3aa6ff,#9fe8ff)" w={170} h={12} label="Boost" /></div></div>
      {hud.scrape ? <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 120px 20px rgba(255,120,60,0.45)" }} /> : null}
      {big ? <div style={{ position: "absolute", top: "30%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(40px,8vw,110px)", fontWeight: 700, color: GOLD, textShadow: "0 4px 24px #000" }}>{big}</div> : null}
      {hud.tip ? <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", ...panel, padding: "8px 16px", fontSize: 14, maxWidth: "60%", textAlign: "center" }}>{hud.tip}</div> : null}
    </div>);
  }
  return (<div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, color: "#fff6d8" }}>
    {hud.hurt > 0 ? <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 140px 30px rgba(220,30,30,${Math.min(0.7, hud.hurt * 1.6)})` }} /> : null}
    <div style={{ position: "absolute", top: 12, left: 14, display: "flex", flexDirection: "column", gap: 5 }}>
      <Bar v={hud.hp} max={hud.maxHp} color="linear-gradient(90deg,#c0302a,#ff6a5a)" w={240} h={18} label={`${Math.ceil(hud.hp)}`} />
      <Bar v={hud.mana} max={100} color="linear-gradient(90deg,#2a5ac0,#6fa8ff)" w={210} h={12} />
      <Bar v={hud.ult} max={100} color="linear-gradient(90deg,#c08a10,#ffd35a)" w={180} h={9} />
    </div>
    <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center", minWidth: 300 }}>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title}{hud.sub ? ` · ${hud.sub}` : ""}</div>
      {kind === "crypt" ? <div style={{ fontSize: 13, marginTop: 2 }}>Room {hud.room}/{hud.rooms} · Crystals {hud.crystals}/6 · {fmtT(hud.time)}</div> : <div style={{ fontSize: 13, marginTop: 2 }}>{fmtT(hud.time)}</div>}
      {hud.target ? <div style={{ margin: "6px auto 0", width: 300 }}><div style={{ fontSize: 13, marginBottom: 2 }}>{hud.target.name}{hud.target.frozen ? " ❄" : ""}</div><Bar v={hud.target.hp} max={hud.target.max} color="linear-gradient(90deg,#8a2a2a,#e0584a)" w={300} h={12} /></div> : null}
      {kind === "crypt" && hud.obj ? <div style={{ ...panel, marginTop: 8, padding: "4px 12px", fontSize: 13, display: "inline-block" }}>{hud.obj}</div> : null}
    </div>
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, background: "rgba(255,255,255,0.7)", boxShadow: "0 0 6px #fff" }} />
    <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
      {spell("LMB", "Zing", 0, 1, true, "#7fd4ff")}{spell("2", "Gale", hud.cd.gale, 4.5, hud.ready.gale, "#cfe8ff")}{spell("3", "Frost", hud.cd.frost, 2.6, hud.ready.frost, "#9ef0ff")}{spell("RMB", "Ward", 0, 1, hud.mana > 5, "#6fa8ff")}{spell("R", "Starfall", 0, 1, hud.ready.star, "#ffd35a")}
    </div>
    {hud.toast ? <div style={{ position: "absolute", top: "22%", left: 0, right: 0, textAlign: "center", fontSize: 30, fontWeight: 700, color: GOLD, textShadow: "0 3px 14px #000" }}>{hud.toast}</div> : null}
    {big ? <div style={{ position: "absolute", top: "32%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(40px,8vw,110px)", fontWeight: 700, color: "#fff6d8", textShadow: "0 4px 24px #000" }}>{big}</div> : null}
    {hud.tip ? <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", ...panel, padding: "8px 16px", fontSize: 14, maxWidth: "62%", textAlign: "center" }}>{hud.tip}</div> : null}
  </div>);
}
