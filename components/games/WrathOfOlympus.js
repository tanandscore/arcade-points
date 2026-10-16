"use client";

// Wrath of Olympus — a small Age-of-Empires-style war game. You lead Athens against an AI-run Sparta:
// gather food, wood, gold and stone, build a city, climb the ages, raise an army and destroy the enemy's Town Centers.
// The rules live in lib/olympus/sim.js; this file is the screen around it.
import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine } from "@/lib/olympus/engine";
import { DIFFICULTY, RES_ICON, AGES, POWERS } from "@/lib/olympus/defs";
import { createGameMusic } from "@/lib/cinematic/music";
import { useStage, stageBoxStyle } from "./FullscreenStage";

const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
const GOLD = "#e3be68", STONE = "#2a2118", STONE2 = "#3b2e20", EDGE = "#a9843c";
const bar = { background: "linear-gradient(#4a3a27,#2d2217)", border: `1px solid ${EDGE}`, boxShadow: "0 2px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,225,150,.25)", color: "#f3e7c9", fontFamily: FONT };
const chipBtn = { ...bar, borderRadius: 6, padding: "5px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function Minimap({ eng }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !eng) return undefined;
    const id = setInterval(() => { try { eng.drawMinimap(c); } catch {} }, 160);
    let down = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
    const md = (e) => { e.preventDefault(); const [x, y] = pos(e); eng.minimapClick(x, y, c.width, e.button === 2); down = e.button === 0; };
    const mm = (e) => { if (down) { const [x, y] = pos(e); eng.minimapClick(x, y, c.width, false); } };
    const mu = () => { down = false; };
    c.addEventListener("pointerdown", md); window.addEventListener("pointermove", mm); window.addEventListener("pointerup", mu); c.addEventListener("contextmenu", (e) => e.preventDefault());
    return () => { clearInterval(id); c.removeEventListener("pointerdown", md); window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu); };
  }, [eng]);
  return <canvas ref={ref} width={230} height={230} style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }} data-testid="minimap" />;
}

function HpBar({ hp, max, w = "100%" }) {
  const f = Math.max(0, Math.min(1, hp / max));
  return <div style={{ width: w, height: 9, background: "#150f08", border: "1px solid #000", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${f * 100}%`, height: "100%", background: f > 0.6 ? "#59d04a" : f > 0.3 ? "#e9c43a" : "#e0452e" }} /></div>;
}

function Info({ st, eng }) {
  const s = st.sel;
  if (!s) return <div style={{ color: "#c9b88f", fontSize: 12, lineHeight: 1.5, padding: 10 }}>
    <b style={{ color: GOLD }}>Nothing selected</b><br />Click a citizen or building. Drag a box to select a crowd. Right-click to give orders.<br />
    <span style={{ opacity: 0.8 }}>Idle citizens: <b>.</b> &nbsp; Home: <b>H</b> &nbsp; Army: <b>,</b></span>
  </div>;
  if (s.group) return <div style={{ padding: 8 }}>
    <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{s.total} selected</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{s.group.map((g) => <button key={g.kind} onClick={() => eng.setSel(g.ids)} title={g.name} style={{ ...chipBtn, padding: "4px 8px", display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 20 }}>{g.icon}</span><b>×{g.n}</b></button>)}</div>
    <div style={{ color: "#c9b88f", fontSize: 11, marginTop: 8 }}>Right-click ground to move, an enemy to attack, a tree or mine to gather.</div>
  </div>;
  const d = s.single;
  return <div style={{ display: "flex", gap: 10, padding: 8, height: "100%", boxSizing: "border-box" }}>
    <div style={{ width: 64, flex: "none", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 8, background: d.owner === 1 ? "#5a1f1a" : d.owner === 0 ? "#1d3560" : "#3a3a2a", border: `2px solid ${EDGE}`, display: "grid", placeItems: "center", fontSize: 34 }}>{d.icon}</div>
      {d.type !== "node" && <div style={{ marginTop: 5 }}><HpBar hp={d.hp} max={d.maxHp} /><div style={{ fontSize: 10, color: "#d9c9a0", marginTop: 2 }}>{d.hp}/{d.maxHp}</div></div>}
    </div>
    <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ color: GOLD, fontWeight: 800, fontSize: 14 }}>{d.name}{d.owner === 1 ? <span style={{ color: "#ff8a7a", fontWeight: 600 }}> · Sparta</span> : null}</div>
      {d.type === "unit" && <div style={{ color: "#e7dbbb" }}>⚔️ {d.atk > 0 ? d.atk : "—"} &nbsp; 🛡️ {d.mArm}/{d.pArm} &nbsp; {d.range > 2 ? `🎯 ${d.range}` : ""} {d.owner === 0 && <span style={{ color: "#9fd8ff" }}> · {d.state}{d.carry ? ` (${d.carry})` : ""}</span>}</div>}
      {d.type === "building" && !d.done && <div style={{ color: "#9fd8ff" }}>Under construction {Math.round(d.progress * 100)}%</div>}
      {d.type === "building" && d.done && d.popCap && <div style={{ color: "#e7dbbb" }}>Homes {d.popCap} people</div>}
      {d.type === "node" && <div style={{ color: "#e7dbbb" }}>{RES_ICON[d.res]} {d.left} left</div>}
      <div style={{ color: "#bfae86", fontSize: 11 }}>{d.desc}</div>
      {d.type === "building" && d.owner === 0 && d.queue && d.queue.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
        {d.queue.map((q, i) => <button key={i} title={`${q.label} — click to cancel`} onClick={() => eng.cancelQueue(d.id, i)} style={{ ...chipBtn, padding: 2, width: 40, height: 40, position: "relative", overflow: "hidden", fontSize: 20 }}>
          {q.icon}{i === 0 && <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${Math.min(100, q.pct * 100)}%`, background: "#59d04a" }} />}
        </button>)}
      </div>}
      {d.type === "building" && d.owner === 0 && d.done && d.rally && <div style={{ color: "#8fc4ff", fontSize: 10, marginTop: 3 }}>Rally flag set (right-click to move it)</div>}
    </div>
  </div>;
}

function CommandCard({ st, eng, setTip }) {
  const cmds = st.cmds;
  if (!cmds.length) return <div style={{ color: "#8d7e5c", fontSize: 11, padding: 8 }}>Select a citizen to build, or a building to train.</div>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 4, padding: 5, height: "100%", boxSizing: "border-box" }}>
    {cmds.map((c) => <button key={c.id} onClick={() => (c.enabled ? eng.runCmd(c.id) : eng.say(c.reason || "Can't do that", "warn"))} onMouseEnter={() => setTip(c)} onMouseLeave={() => setTip(null)}
      style={{ ...chipBtn, padding: 0, height: "100%", minHeight: 0, opacity: c.enabled ? 1 : 0.45, position: "relative", fontSize: 22, display: "grid", placeItems: "center", background: c.danger ? "linear-gradient(#5a2a22,#341610)" : bar.background }} data-cmd={c.id}>
      {c.icon}<span style={{ position: "absolute", left: 3, top: 1, fontSize: 9, color: GOLD, fontWeight: 800 }}>{c.key}</span>
    </button>)}
  </div>;
}

export default function WrathOfOlympus({ onFinish, accentColor = "#ffb703" }) {
  const stage = useStage();
  const mountRef = useRef(null), engRef = useRef(null), musicRef = useRef(null), doneRef = useRef(false);
  const [phase, setPhase] = useState("menu"); // menu | play
  const [diff, setDiff] = useState("veteran");
  const [st, setSt] = useState(null);
  const [eng, setEng] = useState(null);
  const [tip, setTip] = useState(null);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [fail, setFail] = useState(false);
  const [musicOn, setMusicOn] = useState(true);

  const stopAll = useCallback(() => {
    try { engRef.current && engRef.current.dispose(); } catch {} engRef.current = null; setEng(null);
    try { musicRef.current && musicRef.current.stop(); } catch {} musicRef.current = null;
  }, []);
  useEffect(() => () => stopAll(), [stopAll]);

  function begin() {
    stopAll(); doneRef.current = false; setMenu(false); setSt(null);
    try {
      const e = createEngine({ mount: mountRef.current, difficulty: diff, onState: (s) => setSt(s) });
      engRef.current = e; setEng(e); e.start();
      if (typeof window !== "undefined" && window.__OL_EXPOSE) { window.__ol = e; }
    } catch (err) { console.error(err); setFail(true); return; }
    stage.enter();
    try { musicRef.current = createGameMusic("olympus", "olympus-music"); setMusicOn(musicRef.current.isEnabled()); musicRef.current.setIntensity(0.3); musicRef.current.start(); } catch {}
    setPhase("play");
  }
  useEffect(() => { if (!st || !st.over || doneRef.current) return; doneRef.current = true; const r = st.over; if (musicRef.current) { try { musicRef.current.stinger(r.won ? "win" : "lose"); musicRef.current.setIntensity(0.15); } catch {} } fetch("/api/difficulty-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "wrathofolympus", difficulty: r.difficulty, score: r.score }) }).catch(() => {}); }, [st]);
  useEffect(() => { if (musicRef.current && st) musicRef.current.setIntensity(Math.min(0.8, 0.28 + (st.army || 0) * 0.01 + (st.age || 0) * 0.08)); }, [st && st.age, st && Math.floor((st.army || 0) / 5)]); // eslint-disable-line
  function toggleMusic() { const m = musicRef.current; if (!m) return; m.setEnabled(!m.isEnabled()); setMusicOn(m.isEnabled()); }
  function again() { stopAll(); setPhase("menu"); setSt(null); }
  function finish() { onFinish(st && st.over ? st.over.score : 0); }

  const box = stageBoxStyle(stage.isFull, { background: "#0b0906", overflow: "hidden", borderRadius: stage.isFull ? 0 : 12, userSelect: "none", fontFamily: FONT });
  const playing = phase === "play" && st;

  return (
    <div style={box} data-wrath-root>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, display: playing ? "block" : "none" }} data-testid="world" />
      {fail && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#f3e7c9", background: "#120d08", padding: 24, textAlign: "center" }}>This game needs 3D graphics (WebGL), which your browser couldn&apos;t start. Try another browser or turn on hardware acceleration.</div>}

      {phase === "menu" && !fail && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, #5a3d1f 0%, #2a1c10 55%, #0e0905 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#f3e7c9", padding: 16, overflow: "auto" }}>
        <div style={{ fontSize: "clamp(11px,1.4vw,14px)", letterSpacing: 6, color: "#c9a44a" }}>⚡ A GAME OF EMPIRES ⚡</div>
        <h1 style={{ margin: "4px 0 2px", fontSize: "clamp(28px,5vw,56px)", color: GOLD, textShadow: "0 3px 0 #5a3d12, 0 0 28px rgba(255,200,90,.35)", letterSpacing: 2 }}>WRATH OF OLYMPUS</h1>
        <p style={{ maxWidth: 620, textAlign: "center", fontSize: "clamp(12px,1.35vw,15px)", lineHeight: 1.55, color: "#e1d3ae", margin: "6px 0 14px" }}>Lead Athens. Gather food, wood, gold and stone. Build a city, climb through the three ages, raise an army and destroy every Town Center of Sparta before they destroy yours.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
          {Object.entries(DIFFICULTY).map(([k, d]) => <button key={k} onClick={() => setDiff(k)} style={{ ...bar, width: 190, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left", outline: diff === k ? `3px solid ${accentColor}` : "none", opacity: diff === k ? 1 : 0.8 }}>
            <div style={{ fontWeight: 800, color: GOLD, fontSize: 15 }}>{d.name}</div><div style={{ fontSize: 11, color: "#d6c8a2", marginTop: 3, lineHeight: 1.4 }}>{d.desc}</div><div style={{ fontSize: 10, color: "#9c8f6c", marginTop: 5 }}>Score ×{d.scoreMult}</div>
          </button>)}
        </div>
        <button onClick={begin} data-testid="start" style={{ ...bar, padding: "12px 38px", fontSize: 18, fontWeight: 900, letterSpacing: 2, borderRadius: 10, cursor: "pointer", color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)", border: "1px solid #fff0b0" }}>BEGIN THE WAR</button>
        <button onClick={() => setHelp((h) => !h)} style={{ ...chipBtn, marginTop: 12 }}>{help ? "Hide" : "How to play"}</button>
        {help && <div style={{ ...bar, maxWidth: 640, marginTop: 10, padding: 14, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>
          <b style={{ color: GOLD }}>Start:</b> select your Town Center (click it) and train Citizens. Right-click a tree, berries or a mine with citizens selected to make them gather. Build Houses so you can have more people.<br />
          <b style={{ color: GOLD }}>Grow:</b> Farms give endless food. Build a Barracks for hoplites, then advance to the Classical Age at the Town Center for archers, horsemen and towers. Temples give you the gods&apos; powers.<br />
          <b style={{ color: GOLD }}>Fight:</b> drag a box around soldiers, then right-click an enemy to attack. Spears beat horses, horses beat archers, archers beat spears. Catapults smash buildings.<br />
          <b style={{ color: GOLD }}>Keys:</b> arrows or screen edge to scroll · mouse wheel to zoom · middle-drag to pan · Q W E R / A S D F / Z X C V = the buttons · . idle citizen · H home · , all soldiers · Space jump to attack · Ctrl or Shift + 1–9 save a group · P pause · Esc cancel.
        </div>}
      </div>}

      {playing && !st.over && <>
        {/* top bar */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, ...bar, borderRadius: 0, borderWidth: "0 0 1px 0", display: "flex", alignItems: "center", gap: 14, padding: "5px 12px", fontSize: 13, fontWeight: 700, zIndex: 10 }}>
          {["food", "wood", "gold", "stone"].map((r) => <div key={r} title={r} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 64 }}><span style={{ fontSize: 17 }}>{RES_ICON[r]}</span><span style={{ color: st.res[r] < 25 ? "#ff9a8a" : "#fff" }}>{Math.floor(st.res[r])}</span><span style={{ fontSize: 10, color: "#9fd8ff" }}>{st.gatherers[r] ? `🧑${st.gatherers[r]}` : ""}</span></div>)}
          <div title="People / homes" style={{ color: st.pop + st.reserved >= st.popCap ? "#ff9a8a" : "#fff" }}>👥 {st.pop}/{st.popCap}</div>
          <div title="Favor of the gods" style={{ color: st.hasTemple ? "#ffe58a" : "#8d7e5c" }}>✨ {st.favor}</div>
          <div style={{ flex: 1, textAlign: "center", color: GOLD }}>🏺 {st.ageName}{st.ageBusy ? " — advancing…" : ""}</div>
          <div style={{ color: "#ff9a8a", fontSize: 11 }}>Sparta: {st.enemyAge}</div>
          <div style={{ display: "flex", gap: 4 }}>
          {st.powers.map((p) => <button key={p.key} onClick={() => eng.beginPower(p.key)} onMouseEnter={() => setTip({ name: p.name, key: "", cost: `✨ ${p.favor} favor`, desc: p.desc, enabled: p.ready, reason: !st.hasTemple ? "Build a Temple first" : p.cd > 0 ? `Recharging (${Math.ceil(p.cd)}s)` : "Not enough favor" })} onMouseLeave={() => setTip(null)}
            style={{ ...chipBtn, padding: "2px 7px", fontSize: 17, opacity: p.ready ? 1 : 0.4, borderColor: p.ready ? "#ffe58a" : EDGE }} data-power={p.key}>{p.icon}</button>)}
          </div>
          <div>{fmtT(st.t)}</div>
          <button style={chipBtn} onClick={() => eng.setSpeed(st.speed === 1 ? 2 : 1)} title="Game speed">{st.speed}×</button>
          <button style={chipBtn} onClick={toggleMusic} title="Music">{musicOn ? "🎵" : "🔇"}</button>
          <button style={chipBtn} onClick={() => { setMenu(true); eng.setPaused(true); }} data-testid="menu-btn">Menu</button>
        </div>

        {/* messages */}
        <div style={{ position: "absolute", left: 12, top: 50, display: "flex", flexDirection: "column", gap: 4, zIndex: 9, pointerEvents: "none" }}>
          {st.msgs.map((m) => <div key={m.id} style={{ ...bar, padding: "4px 10px", borderRadius: 6, fontSize: 12, color: m.kind === "alert" ? "#ff8a7a" : m.kind === "warn" ? "#ffd27a" : m.kind === "good" ? "#a8f0a0" : "#f3e7c9", border: `1px solid ${m.kind === "alert" ? "#a03a2a" : EDGE}` }}>{m.text}</div>)}
        </div>

        {/* mode banner */}
        {(st.placing || st.targeting) && <div style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", ...bar, padding: "6px 16px", borderRadius: 8, fontSize: 13, zIndex: 9, pointerEvents: "none", color: GOLD }}>{st.placing ? "Click to place · hold Shift to place more · right-click or Esc to cancel" : `${POWERS[st.targeting].name}: click the map · Esc to cancel`}</div>}

        {/* bottom panel */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "27%", minHeight: 150, maxHeight: 230, display: "flex", gap: 0, background: `linear-gradient(#3b2e20,${STONE})`, borderTop: `3px solid ${EDGE}`, boxShadow: "0 -4px 16px rgba(0,0,0,.6)", zIndex: 10, color: "#f3e7c9", fontFamily: FONT }}>
          <div style={{ height: "100%", aspectRatio: "1 / 1", flex: "none", padding: 6, boxSizing: "border-box", position: "relative" }}>
            <div style={{ width: "100%", height: "100%", background: "#000", border: `2px solid ${EDGE}`, borderRadius: 4, overflow: "hidden" }}><Minimap eng={eng} /></div>
            <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", flexDirection: "column", gap: 3 }}>
              <button style={{ ...chipBtn, padding: "3px 6px", fontSize: 11, opacity: st.idle ? 1 : 0.55 }} onClick={() => eng.selectIdle()} title="Idle citizens (.)">🧑‍🌾 {st.idle}</button>
              <button style={{ ...chipBtn, padding: "3px 6px", fontSize: 11, opacity: st.army ? 1 : 0.55 }} onClick={() => eng.selectArmy()} title="All soldiers (,)">⚔️ {st.army}</button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, margin: "6px 0", background: "linear-gradient(#2a2118,#1a140d)", border: `1px solid ${EDGE}`, borderRadius: 4, overflow: "auto" }}><Info st={st} eng={eng} /></div>
          <div style={{ width: "min(34%, 330px)", flex: "none", padding: "6px", boxSizing: "border-box", position: "relative", height: "100%" }}>
            {tip && <div style={{ position: "absolute", right: 6, bottom: "100%", width: 260, ...bar, padding: 9, borderRadius: 8, fontSize: 12, lineHeight: 1.45, zIndex: 20, marginBottom: 4 }}>
              <div style={{ fontWeight: 800, color: GOLD }}>{tip.name} <span style={{ color: "#9c8f6c", fontWeight: 600 }}>({tip.key})</span></div>
              {tip.cost && <div>{tip.cost}</div>}<div style={{ color: "#d6c8a2" }}>{tip.desc}</div>{!tip.enabled && tip.reason && <div style={{ color: "#ff9a8a", marginTop: 3 }}>⚠ {tip.reason}</div>}
            </div>}
            <div style={{ background: "linear-gradient(#2a2118,#1a140d)", border: `1px solid ${EDGE}`, borderRadius: 4, height: "100%" }}><CommandCard st={st} eng={eng} setTip={setTip} /></div>
          </div>
        </div>

        {(menu || st.paused) && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 30 }}>
          <div style={{ ...bar, padding: 20, borderRadius: 12, display: "flex", flexDirection: "column", gap: 9, minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: GOLD }}>Paused</div>
            <button style={{ ...chipBtn, padding: 10 }} onClick={() => { setMenu(false); eng.setPaused(false); }}>Resume</button>
            <button style={{ ...chipBtn, padding: 10 }} onClick={() => setHelp((h) => !h)}>Controls</button>
            {help && <div style={{ fontSize: 11.5, lineHeight: 1.55, textAlign: "left", color: "#d6c8a2" }}>Arrows / screen edge: scroll · Wheel: zoom · Middle-drag: pan · Left-click: select · Drag: box select · Right-click: move / attack / gather / rally · Q W E R A S D F Z X C V: buttons · . idle citizen · H home · , soldiers · Space: last attack · Ctrl/Shift+1–9 save group, 1–9 recall · P pause · Esc cancel</div>}
            <button style={{ ...chipBtn, padding: 10, color: "#ff9a8a" }} onClick={() => { setMenu(false); eng.setPaused(false); eng.surrender(); }}>Surrender</button>
          </div>
        </div>}
      </>}

      {playing && st.over && <div style={{ position: "absolute", inset: 0, background: "rgba(5,3,1,.72)", display: "grid", placeItems: "center", zIndex: 40, padding: 12, overflow: "auto" }}>
        <div style={{ ...bar, padding: "22px 30px", borderRadius: 14, textAlign: "center", minWidth: 300, maxWidth: 440 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: st.over.won ? "#ffe58a" : "#ff8a7a", letterSpacing: 2 }}>{st.over.won ? "VICTORY" : "DEFEAT"}</div>
          <div style={{ color: "#d6c8a2", fontSize: 13, margin: "4px 0 14px" }}>{st.over.won ? "Sparta's Town Centers lie in ruins. Athens is victorious!" : "Your last Town Center has fallen. Athens is lost."}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 20px", fontSize: 13, textAlign: "left", margin: "0 auto 14px", maxWidth: 280 }}>
            <span>Time</span><b>{fmtT(st.over.time)}</b><span>Enemies defeated</span><b>{st.over.stats.kills}</b><span>Your people lost</span><b>{st.over.stats.lost}</b><span>Buildings destroyed</span><b>{st.over.stats.razed}</b><span>Resources gathered</span><b>{Math.round(st.over.stats.gathered)}</b><span>Buildings built</span><b>{st.over.stats.built}</b><span>Units trained</span><b>{st.over.stats.trained}</b>
          </div>
          <div style={{ fontSize: 13, color: "#9c8f6c" }}>Score ({DIFFICULTY[st.over.difficulty].name})</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: GOLD, marginBottom: 14 }}>{st.over.score}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button style={{ ...chipBtn, padding: "10px 18px" }} onClick={again}>Play again</button>
            <button style={{ ...chipBtn, padding: "10px 18px", color: "#2a1c08", background: "linear-gradient(#f4d27a,#c4912f)" }} onClick={finish} data-testid="finish">Finish</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
