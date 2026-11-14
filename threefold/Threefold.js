"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { THREE, createRig, clearScene, mesh, sprite, grassTexture } from "@/threeplay/core";
import { LEVELS, HEROES, createThreefold, makeHero } from "./engine";

// Threefold — a free puzzle-platformer: swap between a Warden, a Wisp and an Archer to get past physics puzzles, traps and monsters.
const KEY = "ts-threefold-v1";
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const GOLD = "#ffd24a", INK = "rgba(14,12,28,0.84)", EDGE = "rgba(255,210,74,0.45)";
const panel = { background: INK, border: `1px solid ${EDGE}`, borderRadius: 8, color: "#f4efe0", fontFamily: FONT };
const emptyProg = () => ({ stars: Array(LEVELS.length).fill(-1), best: Array(LEVELS.length).fill(0) });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.stars && s.best) return s; } catch {} return emptyProg(); }
const sumStars = (p) => p.stars.reduce((a, b) => a + Math.max(0, b), 0);
const powerOf = (p) => Math.min(6, 1 + Math.floor(sumStars(p) / 3));
const totalScore = (p) => p.best.reduce((a, b) => a + b, 0);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const qa = () => typeof window !== "undefined" && !!window.__QA_UNLOCK;

function buildMenuScene(rig) {
  clearScene(rig); const s = rig.scene; if (rig.cine.bloom) rig.cine.bloom.strength = 0.5;
  rig.setSky({ zenith: 0x3a78d0, mid: 0x9ac0f0, horizon: 0xf6e0b8, sunDir: [0.5, 0.25, -0.7], sunColor: 0xfff0c0, sunSize: 0.02, glow: 1, cloud: 0.5 }); s.fog = new THREE.FogExp2(0xd8e4e0, 0.01);
  s.add(new THREE.HemisphereLight(0xdfeaff, 0x5a6a50, 1.7)); const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(-10, 20, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -12; sc.right = sc.top = 12; s.add(sun);
  const gnd = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 4, 40), new THREE.MeshStandardMaterial({ map: grassTexture("#4f9a3f", 8, 8), roughness: 1 })); gnd.position.y = -2; gnd.receiveShadow = true; s.add(gnd);
  const hs = HEROES.map((d, i) => { const m = makeHero(d); m.position.set((i - 1) * 2.4, 0.95, 0); m.rotation.y = 0.5 - i * 0.5; s.add(m); return m; });
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = 9 + Math.random() * 25, sz = 0.8 + Math.random() * 1.6; const t = mesh(new THREE.ConeGeometry(1.3 * sz, 4.6 * sz, 7), 0x3f8a3a, { rough: 1 }); t.position.set(Math.cos(a) * r, 2.3 * sz, -Math.abs(Math.sin(a)) * r - 3); s.add(t); }
  return { update(dt, t) { rig.camera.position.set(Math.sin(t * 0.15) * 4, 2.6, 9); rig.camera.lookAt(0, 1.7, 0); hs.forEach((h, i) => { h.userData.arms[1].rotation.z = Math.sin(t * 1.5 + i) * 0.15 - 0.3; h.position.y = 0.95 + Math.sin(t * 2 + i) * 0.02; }); } };
}

function Bar({ v, max, color, w = 140, h = 10 }) { return (<div style={{ width: w, height: h, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, height: "100%", background: color, transition: "width 90ms" }} /></div>); }
function Stars({ n, size = 16 }) { return <span style={{ letterSpacing: 2, fontSize: size, color: GOLD }}>{[0, 1, 2].map((i) => <span key={i} style={{ opacity: i < n ? 1 : 0.22 }}>★</span>)}</span>; }

export default function Threefold({ onFinish, accentColor = "#ffd24a" }) {
  const stage = useStage();
  const mountRef = useRef(null), rigRef = useRef(null), modeRef = useRef(null), menuRef = useRef(null), screenRef = useRef("home"), launchRef = useRef(null);
  const [screen, setScreenS] = useState("home"), [prog, setProg] = useState(emptyProg), [hud, setHud] = useState(null), [result, setResult] = useState(null), [fail, setFail] = useState(false), [paused, setPaused] = useState(false), [sound, setSound] = useState(true);
  const progRef = useRef(prog); progRef.current = prog;
  const setScreen = useCallback((s) => { screenRef.current = s; setScreenS(s); }, []);
  useEffect(() => { setProg(load()); }, []);
  const save = useCallback((p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, []);
  const toMenu = useCallback((to = "home") => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.camera.fov = 50; rig.camera.up.set(0, 1, 0); rig.camera.updateProjectionMatrix(); rig.paused = false; rig.sound.stopMusic(); menuRef.current = buildMenuScene(rig); setHud(null); setResult(null); setPaused(false); setScreen(to);
  }, [setScreen]);
  useEffect(() => {
    let rig; try { rig = createRig(mountRef.current, { exposure: 1.1, bloom: [0.4, 0.6, 0.85], far: 400, lock: false, shadows: true, grade: { vig: 0.35, grain: 0.01, sat: 1.1, contrast: 1.06 } }); } catch (e) { setFail(true); return; }
    rigRef.current = rig; rig.update = (dt, t) => { if (modeRef.current) modeRef.current.update(dt, t); else if (menuRef.current) menuRef.current.update(dt, t); };
    menuRef.current = buildMenuScene(rig); rig.start();
    const iv = setInterval(() => { if (modeRef.current && !rig.paused) setHud(modeRef.current.snapshot()); }, 80);
    const esc = (e) => { if (e.code === "Escape" && screenRef.current === "play") { rig.paused = !rig.paused; setPaused(rig.paused); } };
    window.addEventListener("keydown", esc);
    if (window.__QA_UNLOCK) window.__tf = { rig, launch: (i) => launchRef.current(i), toMenu, mode: () => modeRef.current, prog: () => progRef.current };
    return () => { clearInterval(iv); window.removeEventListener("keydown", esc); if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null; rig.dispose(); rigRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const record = useCallback((i, stars, score) => { setProg((p) => { const n = JSON.parse(JSON.stringify(p)); n.stars[i] = Math.max(n.stars[i], stars); n.best[i] = Math.max(n.best[i], score); save(n); return n; }); }, [save]);
  const launch = useCallback((i) => {
    const rig = rigRef.current; if (!rig) return; if (modeRef.current && modeRef.current.dispose) modeRef.current.dispose(); modeRef.current = null;
    rig.paused = false; rig.sound.resume(); rig.sound.setOn(true); rig.sound.stopMusic(); rig.sound.music("calm");
    const power = powerOf(progRef.current); setResult(null); setPaused(false); setHud(null);
    modeRef.current = createThreefold(rig, { level: i, power, onEnd: (won, d) => {
      const par = LEVELS[i].par, stars = won ? 1 + (d.sparks >= Math.ceil(d.total * 0.7) ? 1 : 0) + (d.deaths === 0 ? 1 : 0) : 0, score = won ? Math.round(1500 + d.sparks * 60 + d.hp * 3 + Math.max(0, par - d.time) * 6 + i * 200 + stars * 300) : d.sparks * 30;
      if (won) record(i, stars, score); setResult({ idx: i, won, stars, score, lines: [["Time", fmtT(d.time)], ["Sparks", `${d.sparks} / ${d.total}`], ["Heroes lost", d.deaths]] }); setScreen("result");
    } });
    setScreen("play"); stage.enter && stage.enter();
  }, [record, setScreen, stage]);
  launchRef.current = launch;
  function exitGame() { onFinish(totalScore(progRef.current)); }
  function toggleSound() { const rig = rigRef.current; if (!rig) return; const v = !sound; setSound(v); rig.sound.setOn(v); if (v && screenRef.current === "play") rig.sound.music("calm"); }
  if (fail) return (<div className="text-center max-w-md mx-auto p-6"><p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>THREEFOLD</p><p className="text-textDim text-sm">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration turned on.</p><button onClick={() => onFinish(0)} className="mt-4 px-4 py-2 rounded bg-white/10 text-white text-sm">Back</button></div>);
  const unl = (i) => qa() || i === 0 || prog.stars[i - 1] >= 1;
  const btn = { ...panel, padding: "6px 12px", cursor: "pointer", fontSize: 13 };
  return (
    <div style={stageBoxStyle(stage.isFull, { background: "#0a0c14", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT })}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, cursor: screen === "play" ? "crosshair" : "default" }} />
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 6 }}>
        <button onClick={toggleSound} style={btn}>{sound ? "🔊" : "🔇"}</button>
        <button onClick={() => (stage.isFull ? stage.exit() : stage.enter())} style={btn}>{stage.isFull ? "Exit full screen" : "Full screen"}</button>
        {screen === "play" ? <button onClick={() => { const rig = rigRef.current; if (rig) { rig.paused = true; setPaused(true); } }} style={btn}>Pause</button> : null}
        {screen !== "home" && screen !== "play" ? <button onClick={() => toMenu("home")} style={btn}>Main menu</button> : null}
        {screen === "home" ? <button onClick={exitGame} style={btn}>Leave</button> : null}
      </div>
      {screen === "home" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: "5%", gap: 14, background: "linear-gradient(rgba(10,12,20,0.05), rgba(10,12,20,0.5))" }}>
          <div style={{ textAlign: "center", color: "#fff", textShadow: "0 3px 24px rgba(0,0,0,.7)" }}>
            <div style={{ fontSize: "clamp(34px,6.4vw,84px)", letterSpacing: "0.16em", fontWeight: 800, lineHeight: 1, paddingLeft: "0.16em" }}>THREEFOLD</div>
            <div style={{ fontSize: "clamp(12px,1.5vw,18px)", marginTop: 6, letterSpacing: "0.16em", color: GOLD }}>THREE HEROES · ONE WAY THROUGH</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center", paddingBottom: "6%" }}>
            <button onClick={() => { rigRef.current && rigRef.current.sound.play("click"); setScreen("select"); }} style={{ ...btn, padding: "14px 34px", fontSize: 20, fontWeight: 700, background: GOLD, color: "#241a08", borderColor: GOLD }}>Play</button>
            <button onClick={() => setScreen("help")} style={{ ...btn, padding: "12px 20px", fontSize: 15 }}>How to play</button>
            <span style={{ ...panel, padding: "8px 14px", fontSize: 13 }}>Hero power <b style={{ color: GOLD }}>{powerOf(prog)}</b> · {sumStars(prog)} ★</span>
          </div>
        </div>
      )}
      {screen === "select" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,20,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px 20px", gap: 12 }}>
          <div style={{ color: GOLD, fontSize: 26, fontWeight: 700 }}>Choose a level</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 940, overflow: "auto", maxHeight: "68%" }}>
            {LEVELS.map((x, i) => { const ok = unl(i), s = prog.stars[i]; return (
              <button key={i} disabled={!ok} onClick={() => launch(i)} style={{ ...panel, width: 285, padding: "12px 14px", textAlign: "left", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 16 }}>{i + 1}. {x.name}</b><Stars n={Math.max(0, s)} /></div>
                <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 3 }}>{ok ? x.sub : "Clear the one before to unlock"}</div>
                {prog.best[i] ? <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4 }}>Best {prog.best[i].toLocaleString()}</div> : null}
              </button>); })}
          </div>
          <button onClick={() => setScreen("home")} style={{ ...btn, padding: "8px 18px" }}>Back</button>
        </div>
      )}
      {screen === "help" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,20,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...panel, maxWidth: 820, width: "100%", padding: "20px 24px", maxHeight: "90%", overflow: "auto" }}>
            <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>How to play</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>A D walk · Space jump · <b>1 2 3</b> (or Tab) swap hero. Reach the glowing gate with any hero. Collect sparks for stars; life crystals revive fallen heroes.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px", fontSize: 13.5, lineHeight: 1.55, marginTop: 12 }}>
              <div><b style={{ color: "#c8d0e0" }}>1 · Warden</b><br />Left click: sword (smashes cracked walls)<br />Hold right click: shield against arrows<br />Strong, but slow.</div>
              <div><b style={{ color: "#a98aff" }}>2 · Wisp</b><br />Left click: conjure a crate (3 at once)<br />Hold right click: drag crates with your mind<br />Stack them to climb or bridge pits.</div>
              <div><b style={{ color: "#8ae09a" }}>3 · Archer</b><br />Hold left click to draw, release to shoot<br />Shoot glowing targets to open doors<br />Hold Space in the air to glide.</div>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>Pressure plates open doors while something heavy sits on them: push a crate onto one. Spikes are deadly. Esc pauses.</div>
            <div style={{ textAlign: "right", marginTop: 14 }}><button onClick={() => setScreen("home")} style={{ ...btn, padding: "8px 18px" }}>Got it</button></div>
          </div>
        </div>
      )}
      {(screen === "play" || screen === "result") && hud && hud.kind ? <Hud hud={hud} /> : null}
      {screen === "play" && paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,20,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 8 }}>
          <div style={{ color: GOLD, fontSize: 30, fontWeight: 700 }}>Paused</div>
          <button onClick={() => { const rig = rigRef.current; if (rig) { rig.paused = false; setPaused(false); } }} style={{ ...btn, padding: "10px 28px", fontSize: 16 }}>Resume</button>
          <button onClick={() => { const m = modeRef.current; launch(m ? LEVELS.indexOf(m.level) : 0); }} style={{ ...btn, padding: "8px 22px" }}>Restart</button>
          <button onClick={() => toMenu("select")} style={{ ...btn, padding: "8px 22px" }}>Quit to menu</button>
        </div>
      )}
      {screen === "result" && result && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,20,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8 }}>
          <div style={{ ...panel, padding: "22px 34px", textAlign: "center", minWidth: 340 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: result.won ? GOLD : "#ff8a7a" }}>{result.won ? "Level clear!" : "The heroes fell"}</div>
            {result.won ? <div style={{ margin: "6px 0 10px" }}><Stars n={result.stars} size={34} /></div> : <div style={{ margin: "8px 0", opacity: 0.8, fontSize: 14 }}>Think about which hero fits the problem and try again.</div>}
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>{result.lines.map(([a, b]) => <div key={a}><span style={{ opacity: 0.7 }}>{a}</span> &nbsp; <b>{b}</b></div>)}<div style={{ marginTop: 6, fontSize: 18 }}>Score <b style={{ color: GOLD }}>{result.score.toLocaleString()}</b></div></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => launch(result.idx)} style={{ ...btn, padding: "9px 20px" }}>Try again</button>
              {result.won && result.idx + 1 < LEVELS.length ? <button onClick={() => launch(result.idx + 1)} style={{ ...btn, padding: "9px 20px", background: GOLD, color: "#241a08", borderColor: GOLD, fontWeight: 700 }}>Next</button> : null}
              <button onClick={() => toMenu("select")} style={{ ...btn, padding: "9px 20px" }}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Hud({ hud }) {
  const base = { position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, color: "#f4efe0" };
  return (<div style={base}>
    <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 8 }}>
      {hud.heroes.map((h, i) => (<div key={i} style={{ ...panel, padding: "6px 10px", width: 132, opacity: h.alive ? 1 : 0.4, borderColor: h.active ? h.color : "rgba(255,255,255,0.2)", boxShadow: h.active ? `0 0 14px ${h.color}` : "none" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", justifyContent: "space-between" }}><span style={{ color: h.color }}>{i + 1} · {h.name}</span><span>{h.alive ? "" : "✖"}</span></div>
        <div style={{ marginTop: 4 }}><Bar v={h.hp} max={h.max} color={`linear-gradient(90deg,#c0392b,${h.color})`} w={112} h={8} /></div>
      </div>))}
    </div>
    <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center", marginTop: 62 }}><div style={{ fontSize: 13, opacity: 0.85 }}>{hud.title} · {fmtT(hud.time)} · <span style={{ color: GOLD }}>✦ {hud.sparks}/{hud.total}</span>{hud.hero === "wisp" ? ` · crates ${hud.conj}/3` : ""}</div></div>
    {hud.toast ? <div style={{ position: "absolute", top: "26%", left: 0, right: 0, textAlign: "center", fontSize: 26, fontWeight: 700, color: GOLD, textShadow: "0 2px 12px #000" }}>{hud.toast}</div> : null}
    {hud.msg ? <div style={{ position: "absolute", top: "32%", left: 0, right: 0, textAlign: "center", fontSize: "clamp(34px,6vw,90px)", fontWeight: 800, color: GOLD, textShadow: "0 0 24px rgba(0,0,0,.8)", letterSpacing: "0.05em" }}>{hud.msg}</div> : null}
    {hud.tip ? <div style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", ...panel, padding: "8px 16px", fontSize: 14, maxWidth: "70%", textAlign: "center" }}>{hud.tip}</div> : null}
  </div>);
}
