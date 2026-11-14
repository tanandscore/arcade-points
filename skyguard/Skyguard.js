"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { THREE, createRig, clearScene } from "@/threeplay/core";
import { MISSIONS, MOODS, createFly } from "./fly";
import { FIGHTS, createBrawl } from "./brawl";
import { buildCity } from "./city";
import { makeHero } from "./figures";

// Skyguard — a free 3D superhero game: Sky Patrol (flight missions over the city) and Street Justice (street fights).
const KEY = "ts-skyguard-v1";
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const GOLD = "#ffc83a", SKY = "#6fb4ff", INK = "rgba(8,12,28,0.82)", EDGE = "rgba(111,180,255,0.5)";
const panel = { background: INK, border: `1px solid ${EDGE}`, borderRadius: 8, color: "#eaf3ff", fontFamily: FONT };
const emptyProg = () => ({ fly: Array(MISSIONS.length).fill(-1), brawl: Array(FIGHTS.length).fill(-1), best: { fly: Array(MISSIONS.length).fill(0), brawl: Array(FIGHTS.length).fill(0) } });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.fly && s.brawl && s.best) return s; } catch {} return emptyProg(); }
const sumStars = (p) => [...p.fly, ...p.brawl].reduce((a, b) => a + Math.max(0, b), 0);
const powerOf = (p) => Math.min(6, 1 + Math.floor(sumStars(p) / 4));
const totalScore = (p) => [...p.best.fly, ...p.best.brawl].reduce((a, b) => a + b, 0);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const qa = () => typeof window !== "undefined" && !!window.__QA_UNLOCK;

function buildMenuScene(rig) {
  clearScene(rig); const s = rig.scene, m = MOODS.dusk; if (rig.cine.bloom) rig.cine.bloom.strength = 0.7;
  rig.setSky(m.sky); s.fog = new THREE.FogExp2(m.fog, m.fd); s.add(new THREE.HemisphereLight(m.hemi[0], m.hemi[1], m.hemi[2]));
  const sun = new THREE.DirectionalLight(m.sun[0], m.sun[1]); sun.position.set(...m.sun[2]); s.add(sun);
  const city = buildCity(rig, { mood: "night", seed: 5 }); const hero = makeHero(); s.add(hero); hero.userData.aura.material.opacity = 0.0;
  return { update(dt, t) {
    city.update(dt, t); const a = t * 0.16, R = 150; hero.position.set(Math.cos(a) * R, 78 + Math.sin(t * 0.7) * 6, Math.sin(a) * R - 20);
    const vx = -Math.sin(a), vz = Math.cos(a), vd = new THREE.Vector3(vx, 0.04, vz).normalize(), chest = new THREE.Vector3(0, -1, 0).addScaledVector(vd, vd.y).normalize(), xA = new THREE.Vector3().crossVectors(vd, chest).normalize();
    hero.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, vd, chest)); const u = hero.userData; u.arms[0].rotation.x = u.arms[1].rotation.x = Math.PI * 0.99; u.cape.rotation.x = 1.4 + Math.sin(t * 8) * 0.06;
    rig.camera.position.set(Math.cos(a - 0.45) * (R + 30), 92, Math.sin(a - 0.45) * (R + 30) - 20); rig.camera.lookAt(hero.position.x, hero.position.y - 2, hero.position.z);
    if (Math.random() < 0.6) rig.fx.spark(hero.position.clone().addScaledVector(vd, -2.4), 0x9fd8ff, 1.2, 0.4, 0.4);
  } };
}

function Bar({ v, max, color, w = 220, h = 12, label }) { return (<div style={{ width: w, height: h, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6, overflow: "hidden", position: "relative" }}><div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, height: "100%", background: color, transition: "width 90ms" }} />{label ? <span style={{ position: "absolute", left: 6, top: -1, fontSize: h - 3, lineHeight: `${h}px`, fontWeight: 700, textShadow: "0 1px 2px #000" }}>{label}</span> : null}</div>); }
function Stars({ n, size = 16 }) { return <span style={{ letterSpacing: 2, fontSize: size, color: GOLD }}>{[0, 1, 2].map((i) => <span key={i} style={{ opacity: i < n ? 1 : 0.22 }}>★</span>)}</span>; }

export default function Skyguard({ onFinish, accentColor = "#4aa3ff" }) {
  const stage = useStage();
  const mountRef = useRef(null), rigRef = useRef(null), modeRef = useRef(null), menuRef = useRef(null), screenRef = useRef("home"), launchRef = useRef(null);
  const [screen, setScreenS] = useState("home"), [prog, setProg] = useState(emptyProg), [hud, setHud] = useState(null), [result, setResult] = useState(null), [fail, setFail] = useState(false), [paused, setPaused] = useState(false), [sound, setSound] = useState(true), [locked, setLocked] = useState(false), [kind, setKind] = useState("fly");
  const progRef = useRef(prog); progRef.current = prog;
  const setScreen = useCallback((s) => { screenRef.current = s; setScreenS(s); }, []);
  useEffect(() => { setProg(load()); }, []);
  const save = useCallback((p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, []);
  const toMenu = useCallback((to = "home") => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.camera.fov = 58; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix(); rig.paused = false; rig.unlock(); rig.sound.stopMusic(); menuRef.current = buildMenuScene(rig); setHud(null); setResult(null); setPaused(false); setScreen(to);
  }, [setScreen]);
  useEffect(() => {
    let rig; try { rig = createRig(mountRef.current, { exposure: 1.1, bloom: [0.5, 0.6, 0.82], far: 1800, shadows: true, grade: { vig: 0.38, grain: 0.012, sat: 1.08, contrast: 1.07 } }); } catch (e) { setFail(true); return; }
    rigRef.current = rig; rig.update = (dt, t) => { if (modeRef.current) modeRef.current.update(dt, t); else if (menuRef.current) menuRef.current.update(dt, t); };
    rig.setLockHandler((on) => { setLocked(on); if (!on && screenRef.current === "play") { rig.paused = true; setPaused(true); } });
    menuRef.current = buildMenuScene(rig); rig.start();
    const iv = setInterval(() => { if (modeRef.current && !rig.paused) setHud(modeRef.current.snapshot()); }, 80);
    const esc = (e) => { if (e.code === "Escape" && screenRef.current === "play") { rig.paused = !rig.paused; setPaused(rig.paused); if (!rig.paused) { try { rig.el.requestPointerLock(); } catch {} } } };
    window.addEventListener("keydown", esc);
    if (window.__QA_UNLOCK) window.__sg = { rig, launch: (k, i) => launchRef.current(k, i), toMenu, mode: () => modeRef.current, prog: () => progRef.current };
    return () => { clearInterval(iv); window.removeEventListener("keydown", esc); if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null; rig.dispose(); rigRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const record = useCallback((k, i, stars, score) => { setProg((p) => { const n = JSON.parse(JSON.stringify(p)); n[k][i] = Math.max(n[k][i], stars); n.best[k][i] = Math.max(n.best[k][i], score); save(n); return n; }); }, [save]);
  const launch = useCallback((k, i) => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.paused = false; rig.sound.resume(); rig.sound.setOn(true); rig.sound.stopMusic(); rig.sound.music(k === "fly" ? "city" : "epic");
    const power = powerOf(progRef.current); setResult(null); setPaused(false); setKind(k); setHud(null); rig.camera.fov = 66; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix();
    if (k === "fly") modeRef.current = createFly(rig, { mission: i, power, onEnd: (won, d) => {
      const par = MISSIONS[i].par, stars = won ? 1 + (d.hull >= 60 ? 1 : 0) + (d.time < par ? 1 : 0) : 0; const score = won ? Math.round(2000 + d.kills * 60 + d.hull * 6 + Math.max(0, par - d.time) * 8 + d.acc * 400 + d.saved * 150 + i * 250 + stars * 300) : d.kills * 60;
      if (won) record("fly", i, stars, score); rig.unlock(); setResult({ kind: "fly", idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Hull left", Math.round(d.hull) + "%"], ["Enemies stopped", d.kills], ["Heat vision accuracy", Math.round(d.acc * 100) + "%"]] }); setScreen("result");
    } });
    else modeRef.current = createBrawl(rig, { duel: i, power, onEnd: (won, d) => {
      const par = FIGHTS[i].par, stars = won ? 1 + (d.taken < d.maxHp * 0.5 ? 1 : 0) + (d.time < par ? 1 : 0) : 0; const score = won ? Math.round(1500 + Math.max(0, par - d.time) * 12 + d.hp * 8 + d.kills * 40 + d.throws * 60 + i * 250 + stars * 300) : d.kills * 40;
      if (won) record("brawl", i, stars, score); rig.unlock(); setResult({ kind: "brawl", idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Damage taken", Math.round(d.taken)], ["Enemies beaten", d.kills], ["Things thrown", d.throws]] }); setScreen("result");
    } });
    setScreen("play"); stage.enter && stage.enter();
  }, [record, setScreen, stage]);
  launchRef.current = launch;
  function exitGame() { const rig = rigRef.current; if (rig) rig.unlock(); onFinish(totalScore(progRef.current)); }
  function toggleSound() { const rig = rigRef.current; if (!rig) return; const v = !sound; setSound(v); rig.sound.setOn(v); if (v && screenRef.current === "play") rig.sound.music(kind === "fly" ? "city" : "epic"); }
  function resume() { const rig = rigRef.current; if (!rig) return; rig.paused = false; setPaused(false); try { rig.el.requestPointerLock(); } catch {} rig.el.focus(); }
  if (fail) return (<div className="text-center max-w-md mx-auto p-6"><p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>SKYGUARD</p><p className="text-textDim text-sm">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration turned on.</p><button onClick={() => onFinish(0)} className="mt-4 px-4 py-2 rounded bg-white/10 text-white text-sm">Back</button></div>);
  const unl = (k, i) => qa() || i === 0 || prog[k][i - 1] >= 1;
  const playing = screen === "play" || screen === "result";
  const info = { fly: ["🦅 Sky Patrol", "Fly over the city: rings, fires, drones, getaway cars, missiles and a warship.", MISSIONS.length], brawl: ["👊 Street Justice", "Punch, burn, slam and throw cars at gangs and giant robots.", FIGHTS.length] };
  const items = kind === "fly" ? MISSIONS : FIGHTS;
  const btn = { ...panel, padding: "6px 12px", cursor: "pointer", fontSize: 13 };
  return (
    <div style={stageBoxStyle(stage.isFull, { background: "#03050c", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT })}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 6 }}>
        <button onClick={toggleSound} style={btn}>{sound ? "🔊" : "🔇"}</button>
        <button onClick={() => (stage.isFull ? stage.exit() : stage.enter())} style={btn}>{stage.isFull ? "Exit full screen" : "Full screen"}</button>
        {screen !== "home" && screen !== "play" ? <button onClick={() => toMenu("home")} style={btn}>Main menu</button> : null}
        {screen === "home" ? <button onClick={exitGame} style={btn}>Leave</button> : null}
      </div>
      {screen === "home" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "radial-gradient(ellipse at center, rgba(3,5,12,0.05), rgba(3,5,12,0.68))" }}>
          <div style={{ textAlign: "center", color: "#fff", textShadow: "0 0 30px rgba(111,180,255,.6), 0 4px 20px #000" }}>
            <div style={{ fontSize: "clamp(34px,6.6vw,86px)", letterSpacing: "0.2em", fontWeight: 800, lineHeight: 1, paddingLeft: "0.2em" }}>SKYGUARD</div>
            <div style={{ fontSize: "clamp(12px,1.5vw,18px)", opacity: 0.92, marginTop: 8, letterSpacing: "0.18em", color: GOLD }}>KESTREL PROTECTS HALCYON CITY</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
            {Object.entries(info).map(([k, [name, desc, n]]) => { const got = prog[k].filter((s) => s >= 1).length, st = prog[k].reduce((a, b) => a + Math.max(0, b), 0); return (
              <button key={k} onClick={() => { rigRef.current && rigRef.current.sound.play("click"); setKind(k); setScreen("select"); }} style={{ ...panel, width: "min(320px,40vw)", minWidth: 220, padding: "16px 18px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{name}</div>
                <div style={{ fontSize: 13, opacity: 0.88, margin: "6px 0 10px", lineHeight: 1.4 }}>{desc}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{got} / {n} cleared · <span style={{ color: GOLD }}>{st} ★</span></div>
              </button>); })}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
            <span style={{ ...panel, padding: "6px 12px" }}>Hero power <b style={{ color: GOLD }}>{powerOf(prog)}</b> <span style={{ opacity: 0.7 }}>(earn stars to raise it)</span></span>
            <button onClick={() => setScreen("help")} style={btn}>How to play</button>
          </div>
        </div>
      )}
      {screen === "select" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,12,0.76)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px 20px", gap: 12 }}>
          <div style={{ color: GOLD, fontSize: 26, fontWeight: 700 }}>{info[kind][0]}</div>
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
        <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,12,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...panel, maxWidth: 800, width: "100%", padding: "20px 24px", maxHeight: "90%", overflow: "auto" }}>
            <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>How to play</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14, lineHeight: 1.55 }}>
              <div><b style={{ color: GOLD }}>Sky Patrol (flying)</b><br />Mouse: steer · W: fly forward · S: slow / back<br />A D: slide sideways · Space: up · C: down<br />Shift: sonic boost (smashes drones and cars)<br />Hold left click: heat vision (it overheats, let it cool)<br />Hold right click: frost breath (puts out fires)</div>
              <div><b style={{ color: GOLD }}>Street Justice (fighting)</b><br />W A S D: move · Mouse: turn the camera<br />Left click: punch (click again for a 3-hit combo)<br />Hold right click: heat vision on your target<br />Space: dash (dodges everything) · Q: ground slam<br />E: throw a car or crate that is next to you<br />Tab: change target<br /><br /><b style={{ color: GOLD }}>Tip</b> Esc pauses and frees your mouse.</div>
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}><button onClick={() => setScreen("home")} style={{ ...btn, padding: "8px 18px" }}>Got it</button></div>
          </div>
        </div>
      )}
      {playing && hud && hud.kind ? <Hud hud={hud} /> : null}
      {screen === "play" && !paused && !locked && hud && hud.phase !== "intro" ? <div style={{ position: "absolute", bottom: 14, left: 14, ...panel, padding: "5px 10px", fontSize: 12, opacity: 0.85, pointerEvents: "none" }}>Click the game once to aim with your mouse. Esc lets go.</div> : null}
      {screen === "play" && paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,12,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 8 }}>
          <div style={{ color: GOLD, fontSize: 30, fontWeight: 700 }}>Paused</div>
          <button onClick={resume} style={{ ...btn, padding: "10px 28px", fontSize: 16 }}>Resume</button>
          <button onClick={() => { const m = modeRef.current; launch(kind, m ? (m.fight ? FIGHTS.indexOf(m.fight) : MISSIONS.indexOf(m.mission)) : 0); }} style={{ ...btn, padding: "8px 22px" }}>Restart</button>
          <button onClick={() => toMenu("select")} style={{ ...btn, padding: "8px 22px" }}>Quit to menu</button>
        </div>
      )}
      {screen === "result" && result && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,12,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8 }}>
          <div style={{ ...panel, padding: "22px 34px", textAlign: "center", minWidth: 340 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: result.won ? GOLD : "#ff8a7a" }}>{result.won ? (result.kind === "fly" ? "Mission complete!" : "Victory!") : result.kind === "fly" ? "Mission failed" : "Defeated"}</div>
            {result.won ? <div style={{ margin: "6px 0 10px" }}><Stars n={result.stars} size={34} /></div> : <div style={{ margin: "8px 0", opacity: 0.8, fontSize: 14 }}>Shake it off and try again.</div>}
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>{result.lines.map(([a, b]) => <div key={a}><span style={{ opacity: 0.7 }}>{a}</span> &nbsp; <b>{b}</b></div>)}<div style={{ marginTop: 6, fontSize: 18 }}>Score <b style={{ color: GOLD }}>{result.score.toLocaleString()}</b></div></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => launch(result.kind, result.idx)} style={{ ...btn, padding: "9px 20px" }}>Try again</button>
              {result.won && result.idx + 1 < info[result.kind][2] ? <button onClick={() => launch(result.kind, result.idx + 1)} style={{ ...btn, padding: "9px 20px", background: GOLD, color: "#1a1428", borderColor: GOLD, fontWeight: 700 }}>Next</button> : null}
              <button onClick={() => { setKind(result.kind); toMenu("select"); }} style={{ ...btn, padding: "9px 20px" }}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Hud({ hud }) {
  const big = hud.msg, base = { position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, color: "#eaf3ff" };
  const bigStyle = { position: "absolute", top: "30%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(36px,7vw,100px)", fontWeight: 800, color: GOLD, textShadow: "0 0 24px rgba(0,0,0,.8)", letterSpacing: "0.05em" };
  const tip = hud.tip ? <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", ...panel, padding: "8px 16px", fontSize: 14, maxWidth: "62%", textAlign: "center" }}>{hud.tip}</div> : null;
  const hurt = hud.hurt > 0 ? <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 140px 30px rgba(255,60,40,${Math.min(0.65, hud.hurt * 1.6)})` }} /> : null;
  if (hud.kind === "fly") {
    return (<div style={base}>
      {hurt}
      <div style={{ position: "absolute", top: 12, left: 14, display: "flex", flexDirection: "column", gap: 5 }}>
        <Bar v={hud.hull} max={hud.maxHull} color="linear-gradient(90deg,#2a8ae0,#8fe0ff)" w={230} h={15} label="Health" />
        <Bar v={hud.heat * 100} max={100} color={hud.over ? "#ff3a2a" : "linear-gradient(90deg,#e0c030,#ff6a30)"} w={190} h={11} label={hud.over ? "Heat vision cooling…" : "Heat vision"} />
        <Bar v={hud.boost} max={100} color="linear-gradient(90deg,#8a6aff,#cfe8ff)" w={160} h={9} />
      </div>
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title} · {fmtT(hud.time)}</div>
        {hud.obj ? <div style={{ ...panel, marginTop: 4, padding: "4px 12px", fontSize: 13, display: "inline-block" }}>{hud.obj}</div> : null}
      </div>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15, border: `2px solid ${hud.firing ? "#ff5a4a" : "rgba(255,255,255,0.8)"}`, borderRadius: 15 }}><div style={{ position: "absolute", left: 12, top: 12, width: 4, height: 4, borderRadius: 2, background: "#fff" }} /></div>
      {hud.marks.map((m, i) => m.on ? (<div key={i} style={{ position: "absolute", left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%,-50%)", width: m.t === "e" ? 28 : 34, height: m.t === "e" ? 28 : 34, border: `2px solid ${m.t === "e" ? (m.lock ? "#ff5a4a" : "rgba(255,110,90,0.85)") : m.t === "f" ? "#ff9a3a" : m.t === "p" ? "#6fffa0" : m.t === "h" ? "#6fb4ff" : GOLD}`, borderRadius: m.t === "e" ? 3 : 17 }}><span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", fontSize: 10, whiteSpace: "nowrap", textShadow: "0 1px 2px #000" }}>{m.t === "f" ? `${Math.max(0, m.pct)}% · ` : ""}{m.d}m</span></div>) : null)}
      <div style={{ position: "absolute", left: 14, bottom: 14, ...panel, padding: "8px 12px" }}><span style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(hud.speed * 3.6)}</span> <span style={{ fontSize: 11, opacity: 0.7 }}>km/h · {hud.alt} m up</span></div>
      {hud.toast ? <div style={{ position: "absolute", top: "20%", left: 0, right: 0, textAlign: "center", fontSize: 26, fontWeight: 700, color: GOLD, textShadow: "0 2px 12px #000" }}>{hud.toast}</div> : null}
      {big ? <div style={bigStyle}>{big}</div> : null}{tip}
    </div>);
  }
  const key = (k, n, ok, extra) => <div key={k} style={{ width: 70, textAlign: "center", opacity: ok ? 1 : 0.45 }}><div style={{ height: 40, borderRadius: 8, border: `2px solid ${ok ? SKY : "#555"}`, background: "rgba(8,12,28,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ok ? GOLD : "#999", fontSize: 14 }}>{k}</div><div style={{ fontSize: 11, marginTop: 2 }}>{n}{extra || ""}</div></div>;
  return (<div style={base}>
    {hurt}
    <div style={{ position: "absolute", top: 12, left: 14, display: "flex", flexDirection: "column", gap: 5 }}>
      <Bar v={hud.hp} max={hud.maxHp} color="linear-gradient(90deg,#2a8ae0,#8fe0ff)" w={250} h={18} label={`${Math.ceil(hud.hp)}`} />
      <Bar v={hud.energy} max={100} color="linear-gradient(90deg,#e0a020,#ffe060)" w={200} h={11} label="Power" />
    </div>
    <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center", minWidth: 300 }}>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title} · {hud.wave} · {hud.left} left · {fmtT(hud.time)}</div>
      {hud.target ? <div style={{ margin: "6px auto 0", width: 300 }}><div style={{ fontSize: 13, marginBottom: 2 }}>{hud.target.name}</div><Bar v={hud.target.hp} max={hud.target.max} color="linear-gradient(90deg,#8a2a2a,#e0584a)" w={300} h={12} /></div> : null}
    </div>
    {hud.marks.map((m, i) => m.on ? (<div key={i} style={{ position: "absolute", left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%,-100%)", width: m.kind === "boss" ? 90 : 46 }}><div style={{ height: 5, background: "rgba(0,0,0,0.6)", border: `1px solid ${m.lock ? GOLD : "rgba(255,255,255,0.35)"}`, borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.max(0, m.hp) * 100}%`, height: "100%", background: m.tele ? "#ff3a2a" : "#e0584a" }} /></div>{m.tele ? <div style={{ textAlign: "center", color: "#ff5a4a", fontWeight: 800, fontSize: 16, textShadow: "0 1px 4px #000" }}>!</div> : null}</div>) : null)}
    <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
      {[key("LMB", "Punch", true, hud.combo ? ` ×${hud.combo}` : ""), key("RMB", "Heat", hud.energy > 2), key("Space", "Dash", true), key("Q", "Slam", hud.slamCd <= 0 && hud.energy >= 35, hud.slamCd > 0 ? ` ${hud.slamCd.toFixed(0)}s` : ""), key("E", "Throw", hud.prop)]}
    </div>
    {hud.toast ? <div style={{ position: "absolute", top: "22%", left: 0, right: 0, textAlign: "center", fontSize: 30, fontWeight: 800, color: GOLD, textShadow: "0 3px 14px #000" }}>{hud.toast}</div> : null}
    {big ? <div style={{ ...bigStyle, color: "#fff" }}>{big}</div> : null}{tip}
  </div>);
}
