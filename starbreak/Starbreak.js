"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { THREE, createRig, clearScene, sprite, mesh } from "@/threeplay/core";
import { MISSIONS, createFlight, makeShip } from "./flight";
import { DUELS, createBlade } from "./blade";

// Starbreak — a free 3D space-rebels game: starfighter missions (dogfights, convoy, asteroids, warships, trench run) and energy-blade duels.
const KEY = "ts-starbreak-v1";
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const AMB = "#ffb347", CY = "#6fd0ff", INK = "rgba(6,10,24,0.82)", EDGE = "rgba(111,208,255,0.5)";
const panel = { background: INK, border: `1px solid ${EDGE}`, borderRadius: 8, color: "#e8f2ff", fontFamily: FONT };
const emptyProg = () => ({ flight: Array(MISSIONS.length).fill(-1), blade: Array(DUELS.length).fill(-1), best: { flight: Array(MISSIONS.length).fill(0), blade: Array(DUELS.length).fill(0) } });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.flight && s.blade && s.best) return s; } catch {} return emptyProg(); }
const sumStars = (p) => [...p.flight, ...p.blade].reduce((a, b) => a + Math.max(0, b), 0);
const powerOf = (p) => Math.min(6, 1 + Math.floor(sumStars(p) / 4));
const totalScore = (p) => [...p.best.flight, ...p.best.blade].reduce((a, b) => a + b, 0);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const qa = () => typeof window !== "undefined" && !!window.__QA_UNLOCK;

function buildMenuScene(rig) {
  clearScene(rig); const s = rig.scene; if (rig.cine.bloom) rig.cine.bloom.strength = 0.6;
  rig.setSky({ zenith: 0x010208, mid: 0x04061a, horizon: 0x0a0f2a, sunDir: [0.7, 0.3, 0.6], sunColor: 0xffe0b0, sunSize: 0.012, glow: 0.5, cloud: 0, stars: 2.0 });
  s.add(new THREE.HemisphereLight(0x4a5a9a, 0x1a1a2a, 1.0)); const sun = new THREE.DirectionalLight(0xffe4c0, 3); sun.position.set(100, 40, 60); s.add(sun);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 32), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 1, emissive: 0x0a1a30, emissiveIntensity: 0.5 })); planet.position.set(-200, -260, -500); s.add(planet);
  const atm = sprite(0x6aa0ff, 900, 0.35); atm.position.copy(planet.position); s.add(atm);
  for (const [c, sz, p] of [[0xff4a8a, 900, [500, 200, -900]], [0x4a6aff, 1100, [-600, 300, -1000]]]) { const n = sprite(c, sz, 0.25); n.position.set(...p); s.add(n); }
  const fleet = []; for (let i = 0; i < 5; i++) { const sh = makeShip("dart"); sh.position.set(-14 + i * 7, (i % 2) * 2, -i * 6); sh.rotation.y = 0; s.add(sh); fleet.push(sh); }
  const foes = []; for (let i = 0; i < 3; i++) { const sh = makeShip("talon"); sh.position.set(60 + i * 20, 10 + i * 6, -120 - i * 25); sh.rotation.y = Math.PI; s.add(sh); foes.push(sh); }
  return { update(dt, t) { rig.camera.position.set(Math.sin(t * 0.12) * 26, 6 + Math.sin(t * 0.2) * 3, 34); rig.camera.lookAt(0, 0, -10); fleet.forEach((sh, i) => { sh.position.z -= dt * (18 + i); if (sh.position.z < -300) sh.position.z = 40; sh.rotation.z = Math.sin(t + i) * 0.25; if (Math.random() < 0.5) rig.fx.spark(new THREE.Vector3(sh.position.x, sh.position.y, sh.position.z + 3.4), 0x6fd0ff, 0.9, 0.4, 0.2); }); foes.forEach((sh, i) => { sh.position.z += dt * 30; if (sh.position.z > 60) sh.position.z = -300; }); } };
}

function Bar({ v, max, color, w = 220, h = 12, label }) { return (<div style={{ width: w, height: h, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6, overflow: "hidden", position: "relative" }}><div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, height: "100%", background: color, transition: "width 90ms" }} />{label ? <span style={{ position: "absolute", left: 6, top: -1, fontSize: h - 3, lineHeight: `${h}px`, fontWeight: 700, textShadow: "0 1px 2px #000" }}>{label}</span> : null}</div>); }
function Stars({ n, size = 16 }) { return <span style={{ letterSpacing: 2, fontSize: size, color: AMB }}>{[0, 1, 2].map((i) => <span key={i} style={{ opacity: i < n ? 1 : 0.22 }}>★</span>)}</span>; }

export default function Starbreak({ onFinish, accentColor = "#ff7a3a" }) {
  const stage = useStage();
  const mountRef = useRef(null), rigRef = useRef(null), modeRef = useRef(null), menuRef = useRef(null), screenRef = useRef("home"), launchRef = useRef(null);
  const [screen, setScreenS] = useState("home"), [prog, setProg] = useState(emptyProg), [hud, setHud] = useState(null), [result, setResult] = useState(null), [fail, setFail] = useState(false), [paused, setPaused] = useState(false), [sound, setSound] = useState(true), [locked, setLocked] = useState(false), [kind, setKind] = useState("flight");
  const progRef = useRef(prog); progRef.current = prog;
  const setScreen = useCallback((s) => { screenRef.current = s; setScreenS(s); }, []);
  useEffect(() => { setProg(load()); }, []);
  const save = useCallback((p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, []);
  const toMenu = useCallback((to = "home") => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.camera.fov = 58; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix(); rig.paused = false; rig.unlock(); menuRef.current = buildMenuScene(rig); setHud(null); setResult(null); setPaused(false); setScreen(to);
  }, [setScreen]);
  useEffect(() => {
    let rig; try { rig = createRig(mountRef.current, { exposure: 1.1, bloom: [0.55, 0.6, 0.8], far: 4000, shadows: true, grade: { vig: 0.4, grain: 0.012, sat: 1.08, contrast: 1.08 } }); } catch (e) { setFail(true); return; }
    rigRef.current = rig; rig.update = (dt, t) => { if (modeRef.current) modeRef.current.update(dt, t); else if (menuRef.current) menuRef.current.update(dt, t); };
    rig.setLockHandler((on) => { setLocked(on); if (!on && screenRef.current === "play") { rig.paused = true; setPaused(true); } });
    menuRef.current = buildMenuScene(rig); rig.start();
    const iv = setInterval(() => { if (modeRef.current && !rig.paused) setHud(modeRef.current.snapshot()); }, 80);
    const esc = (e) => { if (e.code === "Escape" && screenRef.current === "play") { rig.paused = !rig.paused; setPaused(rig.paused); if (!rig.paused) { try { rig.el.requestPointerLock(); } catch {} } } };
    window.addEventListener("keydown", esc);
    if (window.__QA_UNLOCK) window.__sb = { rig, launch: (k, i) => launchRef.current(k, i), toMenu, mode: () => modeRef.current, prog: () => progRef.current };
    return () => { clearInterval(iv); window.removeEventListener("keydown", esc); if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null; rig.dispose(); rigRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const record = useCallback((k, i, stars, score) => { setProg((p) => { const n = JSON.parse(JSON.stringify(p)); n[k][i] = Math.max(n[k][i], stars); n.best[k][i] = Math.max(n.best[k][i], score); save(n); return n; }); }, [save]);
  const launch = useCallback((k, i) => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.paused = false; rig.sound.resume(); rig.sound.setOn(true); rig.sound.stopMusic(); rig.sound.music(k === "flight" ? "space" : "epic");
    const power = powerOf(progRef.current); setResult(null); setPaused(false); setKind(k); setHud(null); rig.camera.fov = 66; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix();
    if (k === "flight") modeRef.current = createFlight(rig, { mission: i, power, onEnd: (won, d) => {
      const par = 110, stars = won ? 1 + (d.hull >= 60 ? 1 : 0) + (d.time < par ? 1 : 0) : 0; const score = won ? Math.round(2000 + d.kills * 60 + d.hull * 6 + d.shield * 3 + Math.max(0, par - d.time) * 8 + d.acc * 500 + i * 250 + stars * 300) : d.kills * 60;
      if (won) record("flight", i, stars, score); rig.unlock(); setResult({ kind: "flight", idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Hull left", Math.round(d.hull) + "%"], ["Kills", d.kills], ["Accuracy", Math.round(d.acc * 100) + "%"]] }); setScreen("result");
    } });
    else modeRef.current = createBlade(rig, { duel: i, power, onEnd: (won, d) => {
      const stars = won ? 1 + (d.taken < 45 ? 1 : 0) + (d.time < (i >= 4 ? 140 : 70) ? 1 : 0) : 0; const score = won ? Math.round(1500 + Math.max(0, 100 - d.time) * 12 + d.hp * 8 + d.parries * 90 + d.deflects * 50 + i * 250 + stars * 300) : 0;
      if (won) record("blade", i, stars, score); rig.unlock(); setResult({ kind: "blade", idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Damage taken", Math.round(d.taken)], ["Parries", d.parries], ["Bolts deflected", d.deflects]] }); setScreen("result");
    } });
    setScreen("play"); stage.enter && stage.enter();
  }, [record, setScreen, stage]);
  launchRef.current = launch;
  function exitGame() { const rig = rigRef.current; if (rig) rig.unlock(); onFinish(totalScore(progRef.current)); }
  function toggleSound() { const rig = rigRef.current; if (!rig) return; const v = !sound; setSound(v); rig.sound.setOn(v); if (v && screenRef.current === "play") rig.sound.music(kind === "flight" ? "space" : "epic"); }
  function resume() { const rig = rigRef.current; if (!rig) return; rig.paused = false; setPaused(false); try { rig.el.requestPointerLock(); } catch {} rig.el.focus(); }
  if (fail) return (<div className="text-center max-w-md mx-auto p-6"><p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>STARBREAK</p><p className="text-textDim text-sm">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration turned on.</p><button onClick={() => onFinish(0)} className="mt-4 px-4 py-2 rounded bg-white/10 text-white text-sm">Back</button></div>);
  const unl = (k, i) => qa() || i === 0 || prog[k][i - 1] >= 1;
  const playing = screen === "play" || screen === "result";
  const info = { flight: ["🚀 Starfighter Missions", "Dogfights, convoy guard, an asteroid field, warships and the trench run.", MISSIONS.length], blade: ["⚔️ Blade Duels", "Swing, guard and turn blaster fire back on the shooters.", DUELS.length] };
  const items = kind === "flight" ? MISSIONS : DUELS;
  const btn = { ...panel, padding: "6px 12px", cursor: "pointer", fontSize: 13 };
  return (
    <div style={stageBoxStyle(stage.isFull, { background: "#02030a", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT })}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 6 }}>
        <button onClick={toggleSound} style={btn}>{sound ? "🔊" : "🔇"}</button>
        <button onClick={() => (stage.isFull ? stage.exit() : stage.enter())} style={btn}>{stage.isFull ? "Exit full screen" : "Full screen"}</button>
        {screen !== "home" && screen !== "play" ? <button onClick={() => toMenu("home")} style={btn}>Main menu</button> : null}
        {screen === "home" ? <button onClick={exitGame} style={btn}>Leave</button> : null}
      </div>
      {screen === "home" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "radial-gradient(ellipse at center, rgba(2,3,10,0.1), rgba(2,3,10,0.7))" }}>
          <div style={{ textAlign: "center", color: "#fff", textShadow: "0 0 30px rgba(111,208,255,.6), 0 4px 20px #000" }}>
            <div style={{ fontSize: "clamp(34px,6.4vw,82px)", letterSpacing: "0.22em", fontWeight: 800, lineHeight: 1, paddingLeft: "0.22em" }}>STARBREAK</div>
            <div style={{ fontSize: "clamp(12px,1.5vw,18px)", opacity: 0.9, marginTop: 8, letterSpacing: "0.18em", color: AMB }}>THE FREE FLEET AGAINST THE IRON DOMINION</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
            {Object.entries(info).map(([k, [name, desc, n]]) => { const got = prog[k].filter((s) => s >= 1).length, st = prog[k].reduce((a, b) => a + Math.max(0, b), 0); return (
              <button key={k} onClick={() => { rigRef.current && rigRef.current.sound.play("click"); setKind(k); setScreen("select"); }} style={{ ...panel, width: "min(320px,40vw)", minWidth: 220, padding: "16px 18px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: AMB }}>{name}</div>
                <div style={{ fontSize: 13, opacity: 0.88, margin: "6px 0 10px", lineHeight: 1.4 }}>{desc}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{got} / {n} cleared · <span style={{ color: AMB }}>{st} ★</span></div>
              </button>); })}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
            <span style={{ ...panel, padding: "6px 12px" }}>Fleet power <b style={{ color: AMB }}>{powerOf(prog)}</b> <span style={{ opacity: 0.7 }}>(earn stars to raise it)</span></span>
            <button onClick={() => setScreen("help")} style={btn}>How to play</button>
          </div>
        </div>
      )}
      {screen === "select" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,10,0.74)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px 20px", gap: 12 }}>
          <div style={{ color: AMB, fontSize: 26, fontWeight: 700 }}>{info[kind][0]}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 940, overflow: "auto", maxHeight: "68%" }}>
            {items.map((x, i) => { const ok = unl(kind, i), s = prog[kind][i]; return (
              <button key={i} disabled={!ok} onClick={() => launch(kind, i)} style={{ ...panel, width: 285, padding: "12px 14px", textAlign: "left", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 16 }}>{i + 1}. {x.name}</b><Stars n={Math.max(0, s)} /></div>
                <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 3 }}>{ok ? x.sub : "Clear the one before to unlock"}</div>
                {prog.best[kind][i] ? <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4 }}>Best {prog.best[kind][i].toLocaleString()}</div> : null}
              </button>); })}
          </div>
          <button onClick={() => setScreen("home")} style={{ ...btn, padding: "8px 18px" }}>Back</button>
        </div>
      )}
      {screen === "help" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,10,0.84)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...panel, maxWidth: 780, width: "100%", padding: "20px 24px", maxHeight: "90%", overflow: "auto" }}>
            <div style={{ color: AMB, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>How to play</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14, lineHeight: 1.55 }}>
              <div><b style={{ color: AMB }}>Starfighter</b><br />Mouse or W A S D: steer · Q / E: roll<br />Left click: lasers (they overheat)<br />Hold the crosshair on a raider to lock on, then right click: missile<br />Shift: boost · Space: brake<br />Trench run: steer left, right, up and down through the gaps; right click fires the torpedo at the end.</div>
              <div><b style={{ color: AMB }}>Blade duels</b><br />W A S D: move · Space: roll<br />Left click: swing (click again to chain a combo)<br />Hold right click: guard. Guard at the last moment to PARRY a blade or send a bolt back harder.<br />E: force push · Tab: change target<br /><br /><b style={{ color: AMB }}>Tip</b> Esc pauses and frees your mouse.</div>
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}><button onClick={() => setScreen("home")} style={{ ...btn, padding: "8px 18px" }}>Got it</button></div>
          </div>
        </div>
      )}
      {playing && hud && hud.kind ? <Hud hud={hud} /> : null}
      {screen === "play" && !paused && !locked && hud && hud.phase !== "intro" ? <div style={{ position: "absolute", bottom: 14, left: 14, ...panel, padding: "5px 10px", fontSize: 12, opacity: 0.85, pointerEvents: "none" }}>Click the game once to aim with your mouse. Esc lets go.</div> : null}
      {screen === "play" && paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,10,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 8 }}>
          <div style={{ color: AMB, fontSize: 30, fontWeight: 700 }}>Paused</div>
          <button onClick={resume} style={{ ...btn, padding: "10px 28px", fontSize: 16 }}>Resume</button>
          <button onClick={() => { const m = modeRef.current; launch(kind, m ? (m.mission ? MISSIONS.indexOf(m.mission) : DUELS.indexOf(m.duel)) : 0); }} style={{ ...btn, padding: "8px 22px" }}>Restart</button>
          <button onClick={() => toMenu("select")} style={{ ...btn, padding: "8px 22px" }}>Quit to menu</button>
        </div>
      )}
      {screen === "result" && result && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,10,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8 }}>
          <div style={{ ...panel, padding: "22px 34px", textAlign: "center", minWidth: 340 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: result.won ? AMB : "#ff8a7a" }}>{result.won ? (result.kind === "flight" ? "Mission complete!" : "Victory!") : result.kind === "flight" ? "Mission failed" : "Defeated"}</div>
            {result.won ? <div style={{ margin: "6px 0 10px" }}><Stars n={result.stars} size={34} /></div> : <div style={{ margin: "8px 0", opacity: 0.8, fontSize: 14 }}>Shake it off and try again.</div>}
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>{result.lines.map(([a, b]) => <div key={a}><span style={{ opacity: 0.7 }}>{a}</span> &nbsp; <b>{b}</b></div>)}<div style={{ marginTop: 6, fontSize: 18 }}>Score <b style={{ color: AMB }}>{result.score.toLocaleString()}</b></div></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => launch(result.kind, result.idx)} style={{ ...btn, padding: "9px 20px" }}>Try again</button>
              {result.won && result.idx + 1 < info[result.kind][2] ? <button onClick={() => launch(result.kind, result.idx + 1)} style={{ ...btn, padding: "9px 20px", background: AMB, color: "#1a1428", borderColor: AMB, fontWeight: 700 }}>Next</button> : null}
              <button onClick={() => { setKind(result.kind); toMenu("select"); }} style={{ ...btn, padding: "9px 20px" }}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Hud({ hud }) {
  const big = hud.msg, base = { position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, color: "#e8f2ff" };
  const bigStyle = { position: "absolute", top: "30%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(36px,7vw,100px)", fontWeight: 800, color: AMB, textShadow: "0 0 24px rgba(0,0,0,.8)", letterSpacing: "0.05em" };
  const tip = hud.tip ? <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", ...panel, padding: "8px 16px", fontSize: 14, maxWidth: "62%", textAlign: "center" }}>{hud.tip}</div> : null;
  if (hud.kind === "flight") {
    return (<div style={base}>
      {hud.hurt > 0 ? <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 140px 30px rgba(255,60,40,${Math.min(0.65, hud.hurt * 1.6)})` }} /> : null}
      <div style={{ position: "absolute", top: 12, left: 14, display: "flex", flexDirection: "column", gap: 5 }}>
        <Bar v={hud.shield} max={hud.maxShield} color="linear-gradient(90deg,#2a8ae0,#8fe0ff)" w={230} h={14} label="Shield" />
        <Bar v={hud.hull} max={100} color="linear-gradient(90deg,#c0402a,#ff9a5a)" w={200} h={12} label="Hull" />
        <Bar v={hud.heat * 100} max={100} color={hud.over ? "#ff3a2a" : "linear-gradient(90deg,#e0c030,#ff8a30)"} w={170} h={9} />
        <div style={{ fontSize: 13 }}>Missiles <b style={{ color: AMB }}>{hud.missiles}</b></div>
      </div>
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title} · {fmtT(hud.time)}</div>
        {hud.obj ? <div style={{ ...panel, marginTop: 4, padding: "4px 12px", fontSize: 13, display: "inline-block" }}>{hud.obj}</div> : null}
      </div>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 34, height: 34, marginLeft: -17, marginTop: -17, border: `2px solid ${hud.lockT >= 1 ? "#ff5a4a" : "rgba(111,208,255,0.8)"}`, borderRadius: 17, boxShadow: hud.lockT >= 1 ? "0 0 12px #ff5a4a" : "none" }}><div style={{ position: "absolute", left: 14, top: 14, width: 4, height: 4, borderRadius: 2, background: "#fff" }} />{hud.lockT > 0 && hud.lockT < 1 ? <div style={{ position: "absolute", inset: -8 + (1 - hud.lockT) * 10, border: "1px solid #ffb347", borderRadius: 30, opacity: 0.8 }} /> : null}</div>
      {hud.marks.map((m, i) => m.on ? (<div key={i} style={{ position: "absolute", left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%,-50%)", width: m.t === "e" ? 28 : 34, height: m.t === "e" ? 28 : 34, border: `2px solid ${m.t === "e" ? (m.lock ? "#ff5a4a" : "rgba(255,90,70,0.8)") : m.t === "f" ? "#6fffa0" : m.t === "p" ? "#ffd35a" : "#ff9a3a"}`, borderRadius: m.t === "e" ? 2 : 17, boxShadow: m.lock ? "0 0 10px #ff5a4a" : "none" }}><span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", fontSize: 10, whiteSpace: "nowrap", textShadow: "0 1px 2px #000" }}>{m.d}m</span></div>) : null)}
      {hud.radar.length || !hud.trench ? <div style={{ position: "absolute", right: 16, bottom: 16, width: 110, height: 110, borderRadius: 55, background: "rgba(6,20,40,0.7)", border: `1px solid ${EDGE}` }}><div style={{ position: "absolute", left: 54, top: 54, width: 3, height: 3, background: CY }} />{hud.radar.map((r, i) => <div key={i} style={{ position: "absolute", left: 55 + r.x, top: 55 + r.y, width: 6, height: 6, marginLeft: -3, marginTop: -3, background: r.up ? "#ff6a5a" : "#ffa090", borderRadius: r.up ? 3 : 1 }} />)}</div> : null}
      <div style={{ position: "absolute", left: 14, bottom: 14, ...panel, padding: "8px 12px" }}><span style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(hud.speed * 3.6)}</span> <span style={{ fontSize: 11, opacity: 0.7 }}>km/h</span><div style={{ marginTop: 4 }}><Bar v={hud.boost} max={100} color="linear-gradient(90deg,#3aa6ff,#9fe8ff)" w={140} h={9} /></div></div>
      {hud.toast ? <div style={{ position: "absolute", top: "20%", left: 0, right: 0, textAlign: "center", fontSize: 26, fontWeight: 700, color: AMB, textShadow: "0 2px 12px #000" }}>{hud.toast}</div> : null}
      {big ? <div style={bigStyle}>{big}</div> : null}{tip}
    </div>);
  }
  return (<div style={base}>
    {hud.hurt > 0 ? <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 140px 30px rgba(255,60,40,${Math.min(0.65, hud.hurt * 1.6)})` }} /> : null}
    <div style={{ position: "absolute", top: 12, left: 14, display: "flex", flexDirection: "column", gap: 5 }}>
      <Bar v={hud.hp} max={hud.maxHp} color="linear-gradient(90deg,#c0302a,#ff6a5a)" w={240} h={18} label={`${Math.ceil(hud.hp)}`} />
      <Bar v={hud.force} max={100} color="linear-gradient(90deg,#2a8ae0,#8fe0ff)" w={200} h={11} label="Force" />
    </div>
    <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center", minWidth: 300 }}>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title} · {hud.sub} · {fmtT(hud.time)}</div>
      {hud.target ? <div style={{ margin: "6px auto 0", width: 300 }}><div style={{ fontSize: 13, marginBottom: 2 }}>{hud.target.name}{hud.target.guard ? " 🛡" : ""}</div><Bar v={hud.target.hp} max={hud.target.max} color="linear-gradient(90deg,#8a2a2a,#e0584a)" w={300} h={12} /></div> : null}
    </div>
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 5, height: 5, marginLeft: -2, marginTop: -2, borderRadius: 3, background: "rgba(255,255,255,0.6)" }} />
    <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
      {[["LMB", "Swing", true], ["RMB", "Guard", hud.force > 0], ["E", "Push", hud.pushCd <= 0 && hud.force >= 30], ["Space", "Roll", true]].map(([k, n, ok]) => <div key={k} style={{ width: 66, textAlign: "center", opacity: ok ? 1 : 0.45 }}><div style={{ height: 40, borderRadius: 8, border: `2px solid ${ok ? CY : "#555"}`, background: "rgba(8,12,28,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: CY, fontSize: 15 }}>{k}</div><div style={{ fontSize: 11, marginTop: 2 }}>{n}</div></div>)}
    </div>
    {hud.toast ? <div style={{ position: "absolute", top: "22%", left: 0, right: 0, textAlign: "center", fontSize: 30, fontWeight: 800, color: AMB, textShadow: "0 3px 14px #000" }}>{hud.toast}</div> : null}
    {big ? <div style={{ ...bigStyle, color: "#fff" }}>{big}</div> : null}{tip}
  </div>);
}
