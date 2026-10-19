"use client";

import { useEffect, useRef, useState } from "react";
import { createEngine, DIFFS, MATCH, QUALITY } from "@/blacksite/engine/engine";
import { MAP_LIST as ALL_MAPS } from "@/blacksite/engine/map";
import { useMapSwitches } from "@/lib/useMapSwitches";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";


// Operation Blacksite — first-person tactical shooter. This file is only the screen furniture
// (menus, HUD, buy menu, scoreboard). The game itself lives in lib/blacksite/engine.js.
const CT = "#3ea8ff", TT = "#ff6a4a", AMBER = "#ffb703";
const mono = { fontFamily: "ui-monospace, Menlo, Consolas, monospace" };
const pad2 = (n) => String(Math.max(0, n)).padStart(2, "0");
const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${pad2(Math.floor(Math.max(0, s) % 60))}`;

function Key({ children }) { return <span style={{ ...mono, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 4, padding: "1px 6px", fontSize: 11, background: "rgba(255,255,255,0.08)" }}>{children}</span>; }

export default function OperationBlacksite({ onFinish, accentColor = "#ff2d95" }) {
  const wrapRef = useRef(null), mountRef = useRef(null), radarRef = useRef(null), crossRef = useRef(null), hitRef = useRef(null), hurtRef = useRef(null), dmgRef = useRef(null), scopeRef = useRef(null);
  const engineRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu"); // menu | playing | result
  const [difficulty, setDifficulty] = useState("veteran");
  const mapsOff = useMapSwitches("operationblacksite");
  const MAP_LIST = ALL_MAPS.filter((m) => !mapsOff.includes(m.id)); // maps an admin switched off are hidden
  const [mapId, setMapId] = useState("bazaar");
  useEffect(() => { if (MAP_LIST.length && !MAP_LIST.some((m) => m.id === mapId)) setMapId(MAP_LIST[0].id); }, [mapsOff.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [quality, setQuality] = useState("auto");
  const [bests, setBests] = useState({});
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [webglFail, setWebglFail] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const finalScore = useRef(0);
  const stage = useStage();

  useEffect(() => { try { const m = localStorage.getItem("blacksite-map"), q = localStorage.getItem("blacksite-quality-v2"); if (m && ALL_MAPS.some((x) => x.id === m)) setMapId(m); if (q && QUALITY[q]) setQuality(q); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("blacksite-map", mapId); localStorage.setItem("blacksite-quality-v2", quality); } catch {} }, [mapId, quality]);
  useEffect(() => { const coarse = window.matchMedia("(pointer: coarse)").matches; setDeviceOk(!coarse && window.innerWidth >= 900); }, []);
  useEffect(() => { fetch("/api/difficulty-scores?game=operationblacksite").then((r) => r.json()).then((d) => setBests(d.bests || {})).catch(() => {}); }, []);
  useEffect(() => () => { if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; } }, []);

  function deploy() {
    stage.enter();
    if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; }
    const eng = createEngine({
      mount: mountRef.current, difficulty, mapId, quality,
      onMatchEnd: (r) => {
        finalScore.current = r.score; setResult(r); setPhase("result");
        fetch("/api/difficulty-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "operationblacksite", difficulty, score: r.score }) }).catch(() => {});
      },
    });
    if (!eng) { setWebglFail(true); return; }
    engineRef.current = eng; setResult(null); setPhase("playing"); eng.start(); setHud(eng.hudState());
  }

  // HUD polling (10 Hz), radar (15 Hz) and the crosshair/overlays (every frame)
  useEffect(() => {
    if (phase !== "playing") return undefined; const eng = engineRef.current; if (!eng) return undefined;
    const a = setInterval(() => setHud(eng.hudState()), 100);
    const b = setInterval(() => { if (radarRef.current) eng.drawRadar(radarRef.current); }, 66);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop); const c = eng.crosshairState(); const g = c.gap;
      if (crossRef.current) { crossRef.current.style.setProperty("--gap", `${6 + g}px`); crossRef.current.style.opacity = c.alive && !c.scoped && c.phase !== "ended" ? 1 : 0; }
      if (hitRef.current) { hitRef.current.style.opacity = c.hit; hitRef.current.style.setProperty("--hc", c.head ? "#ff3a3a" : "#ffffff"); }
      if (hurtRef.current) hurtRef.current.style.opacity = Math.min(1, c.hurt * 1.2);
      if (scopeRef.current) scopeRef.current.style.opacity = c.scoped ? 1 : 0;
      if (dmgRef.current) { const kids = dmgRef.current.children; for (let i = 0; i < kids.length; i++) { const an = c.dmg[i]; kids[i].style.opacity = an === undefined ? 0 : 0.85; if (an !== undefined) kids[i].style.transform = `rotate(${(-an * 180) / Math.PI + 180}deg)`; } }
    };
    loop();
    return () => { clearInterval(a); clearInterval(b); cancelAnimationFrame(raf); };
  }, [phase]);

  const eng = engineRef.current;
  const side = hud ? hud.side : "terrorist";

  if (deviceOk === false) {
    return (
      <div className="text-center max-w-md mx-auto p-6">
        <p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>OPERATION BLACKSITE</p>
        <p className="text-textDim text-sm mb-4">This is a first-person shooter that needs a mouse and keyboard on a larger screen. Open it on a laptop or desktop to play.</p>
        <button onClick={() => onFinish(0)} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>BACK</button>
      </div>
    );
  }

  const Bar = ({ v, c }) => <div style={{ width: 120, height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", background: c }} /></div>;
  const teamPips = (alive, color) => <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 3 }}>{alive.map((a, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: a ? color : "rgba(255,255,255,0.15)" }} />)}</div>;

  return (
    <div className="mx-auto" style={stage.isFull ? undefined : { width: "100%" }}>
      <div ref={wrapRef} style={{ ...stageBoxStyle(stage.isFull, { borderRadius: stage.isFull ? 0 : 10 }), background: "#000", overflow: "hidden", border: stage.isFull ? "none" : "1px solid rgba(169,159,214,0.3)", userSelect: "none", cursor: phase === "playing" && hud && !hud.menuOpen ? "none" : "default" }}>
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
        {!stage.isFull && phase !== "playing" && (
          <button type="button" onClick={stage.enter} style={{ position: "absolute", top: 8, right: 8, zIndex: 20, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.55)", color: "#fff", font: "11px monospace", cursor: "pointer" }}>⛶ Fullscreen</button>
        )}

        {phase === "playing" && hud && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", color: "#fff", ...mono }}>
            {/* hurt vignette, flash handled in shader */}
            <div ref={hurtRef} style={{ position: "absolute", inset: 0, opacity: 0, boxShadow: "inset 0 0 160px 40px rgba(200,0,10,0.75)" }} />
            <div ref={scopeRef} style={{ position: "absolute", inset: 0, opacity: 0, background: "radial-gradient(circle at 50% 50%, transparent 0, transparent 34%, #000 35.5%)" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(0,0,0,0.9)" }} /><div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(0,0,0,0.9)" }} />
            </div>

            {/* crosshair */}
            <div ref={crossRef} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, "--gap": "8px", transition: "opacity .1s" }}>
              {[{ left: -1, top: "calc(-1 * (var(--gap) + 9px))", width: 2, height: 9 }, { left: -1, top: "var(--gap)", width: 2, height: 9 }, { top: -1, left: "calc(-1 * (var(--gap) + 9px))", width: 9, height: 2 }, { top: -1, left: "var(--gap)", width: 9, height: 2 }].map((st, i) => <div key={i} style={{ position: "absolute", background: "#7dffe8", boxShadow: "0 0 3px #000", ...st }} />)}
              <div style={{ position: "absolute", left: -1, top: -1, width: 2, height: 2, background: "#7dffe8" }} />
            </div>
            <div ref={hitRef} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, opacity: 0, "--hc": "#fff" }}>
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], i) => <div key={i} style={{ position: "absolute", width: 9, height: 2, background: "var(--hc)", left: x * 12 - (x > 0 ? 0 : 0), top: y * 12, transform: `rotate(${x * y > 0 ? 45 : -45}deg)`, transformOrigin: "center" }} />)}
            </div>
            <div ref={dmgRef} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120, opacity: 0, transition: "opacity .15s" }}><div style={{ position: "absolute", left: 40, top: -34, width: 40, height: 14, background: "linear-gradient(#ff2a2a, transparent)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} /></div>)}
            </div>

            {/* top scoreboard */}
            <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "stretch", gap: 2, background: "rgba(5,8,12,0.72)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
                <div style={{ padding: "4px 16px", minWidth: 96, borderBottom: `3px solid ${CT}` }}><div style={{ fontSize: 22, fontWeight: 700, color: CT }}>{hud.ctScore}</div>{teamPips(hud.ctAlive, CT)}</div>
                <div style={{ padding: "4px 14px", minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: hud.bombTimer !== null ? "#ff5a4a" : "#fff" }}>{hud.bombTimer !== null ? `💣 ${Math.ceil(hud.bombTimer)}` : fmt(hud.timer)}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>ROUND {hud.round}/{hud.maxRounds}{hud.phase === "freeze" ? " · BUY" : ""}</div>
                </div>
                <div style={{ padding: "4px 16px", minWidth: 96, borderBottom: `3px solid ${TT}` }}><div style={{ fontSize: 22, fontWeight: 700, color: TT }}>{hud.tScore}</div>{teamPips(hud.tAlive, TT)}</div>
              </div>
              <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8, color: side === "police" ? CT : TT }}>YOU: {hud.sideName}</div>
            </div>

            {/* radar */}
            <div style={{ position: "absolute", left: 12, top: 12 }}><canvas ref={radarRef} width={170} height={170} style={{ width: 170, height: 170, borderRadius: "50%", boxShadow: "0 0 14px rgba(0,0,0,0.7)" }} /></div>

            {/* kill feed */}
            <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
              {hud.feed.map((f, i) => (
                <div key={i} style={{ background: "rgba(5,8,12,0.75)", border: f.you ? "1px solid #ff4a4a" : "1px solid transparent", borderRadius: 4, padding: "2px 8px", fontSize: 12, opacity: Math.max(0.2, 1 - f.age / 8) }}>
                  <span style={{ color: f.kt === "police" ? CT : TT }}>{f.k}</span> <span style={{ opacity: 0.6 }}>[{f.w}]</span> {f.head ? "🎯 " : ""}<span style={{ color: f.vt === "police" ? CT : TT }}>{f.v}</span>
                </div>
              ))}
            </div>

            {/* subtitle */}
            {hud.subtitle && (
              <div style={{ position: "absolute", top: "24%", left: 0, right: 0, textAlign: "center", textShadow: "0 2px 12px #000" }}>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 3, color: hud.subtitle.color }}>{hud.subtitle.text}</div>
                {hud.subtitle.sub && <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{hud.subtitle.sub}</div>}
              </div>
            )}
            {hud.spectating && <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, textAlign: "center", fontSize: 14, textShadow: "0 1px 6px #000" }}>SPECTATING <b style={{ color: side === "police" ? CT : TT }}>{hud.spectating}</b></div>}
            {hud.radio && <div style={{ position: "absolute", left: 200, top: 18, fontSize: 13, background: "rgba(5,8,12,0.65)", padding: "3px 10px", borderRadius: 4, borderLeft: `3px solid ${side === "police" ? CT : TT}` }}><b>{hud.radio.name}</b>: {hud.radio.text}</div>}

            {/* use prompts */}
            <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, textAlign: "center" }}>
              {hud.use ? (
                <div style={{ display: "inline-block", width: 260 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{hud.use.type === "plant" ? "PLANTING BOMB" : "DEFUSING BOMB"}</div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(100, hud.use.pct * 100)}%`, height: "100%", background: hud.use.type === "plant" ? "#ff8a4a" : CT }} /></div>
                </div>
              ) : hud.canPlant && hud.phase === "live" ? <div style={{ fontSize: 14, textShadow: "0 1px 6px #000" }}>Hold <Key>E</Key> to plant the bomb</div>
                : hud.canDefuse && hud.phase === "live" ? <div style={{ fontSize: 14, textShadow: "0 1px 6px #000" }}>Hold <Key>E</Key> to defuse</div> : null}
            </div>

            {/* bottom left: health, armor, money, callout */}
            <div style={{ position: "absolute", left: 16, bottom: 14, textShadow: "0 2px 6px #000" }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{hud.callout}</div>
              <div style={{ display: "flex", gap: 22, alignItems: "flex-end" }}>
                <div><div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: hud.hp < 30 ? "#ff4a4a" : "#fff" }}>{hud.hp}</div><div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3 }}>HEALTH</div><Bar v={hud.hp} c={hud.hp < 30 ? "#ff4a4a" : "#6aff9a"} /></div>
                <div><div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{hud.armor}</div><div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3 }}>ARMOR</div><Bar v={hud.armor} c={CT} /></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 18, color: "#9dff7a" }}>${hud.money}{hud.kit ? "  🛠" : ""}{hud.hasBomb ? "  💣" : ""}</div>
            </div>

            {/* bottom right: weapon */}
            <div style={{ position: "absolute", right: 18, bottom: 14, textAlign: "right", textShadow: "0 2px 6px #000" }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{hud.weapon}{hud.reloading ? " · reloading" : ""}</div>
              {hud.mag !== null && <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, color: hud.mag <= 5 ? "#ff6a4a" : "#fff" }}>{hud.mag}<span style={{ fontSize: 20, opacity: 0.6 }}> / {hud.reserve}</span></div>}
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>{["flash", "smoke", "he"].map((n, i) => hud.nades[n] > 0 ? <span key={n} style={{ marginLeft: 10 }}>[{i + 4}] {n === "he" ? "FRAG" : n.toUpperCase()}{hud.nades[n] > 1 ? ` ×${hud.nades[n]}` : ""}</span> : null)}</div>
            </div>

            {/* buy menu */}
            {hud.buy && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", pointerEvents: "auto" }}>
                <div style={{ width: "min(900px, 94%)", background: "rgba(8,12,18,0.96)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: side === "police" ? CT : TT }}>BUY — {hud.sideName}</div>
                    <div style={{ fontSize: 22, color: "#9dff7a", fontWeight: 700 }}>${hud.money}</div>
                    <div style={{ fontSize: 14 }}>{Math.ceil(hud.timer)}s</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    {["Pistols", "SMGs", "Rifles", "Gear", "Grenades"].map((cat) => (
                      <div key={cat}>
                        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, letterSpacing: 1 }}>{cat.toUpperCase()}</div>
                        {hud.buy.map((it, idx) => it.cat !== cat ? null : (
                          <button key={it.id} onClick={() => eng && eng.buy(it.id)} disabled={it.owned || it.price > hud.money}
                            style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: "8px 8px", borderRadius: 6, border: `1px solid ${it.owned ? "#3a7a4a" : "rgba(255,255,255,0.2)"}`, background: it.owned ? "rgba(60,140,80,0.2)" : "rgba(255,255,255,0.05)", color: "#fff", opacity: it.price > hud.money && !it.owned ? 0.4 : 1, cursor: "pointer", fontSize: 12 }}>
                            <span style={{ opacity: 0.6 }}>{idx + 1}</span> <b>{it.name}</b>{it.count > 0 ? ` ×${it.count}` : ""}<br />
                            <span style={{ opacity: 0.65, fontSize: 10 }}>{it.note}</span><br /><span style={{ color: "#9dff7a" }}>{it.price ? `$${it.price}` : "FREE"}</span>{it.owned ? "  ✔" : ""}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, opacity: 0.85 }}>
                    <span>Press the number next to an item, or click it. Plan: {hud.side === "terrorist" ? "carry the bomb to a site and plant it" : "stop the bomb being planted, or defuse it"}.</span>
                    <button onClick={() => eng && eng.closeBuy()} style={{ pointerEvents: "auto", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "4px 14px", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}>CLOSE (B)</button>
                  </div>
                </div>
              </div>
            )}

            {/* scoreboard */}
            {hud.scoreboard && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
                <div style={{ width: "min(760px, 92%)", background: "rgba(8,12,18,0.94)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: 14 }}>
                  {[["SENTINEL", CT, hud.board.ct, hud.ctScore], ["NIGHTFALL", TT, hud.board.t, hud.tScore]].map(([name, col, rows, sc]) => (
                    <div key={name} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `2px solid ${col}`, paddingBottom: 3, color: col, fontWeight: 700 }}><span>{name}</span><span>{sc}</span></div>
                      {rows.map((r, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px", fontSize: 13, padding: "3px 0", opacity: r.alive ? 1 : 0.45, fontWeight: r.you ? 800 : 400, color: r.you ? "#fff" : "#cfd8e6" }}>
                          <span>{r.you ? "▶ " : ""}{r.name}</span><span>{r.k} K</span><span>{r.d} D</span><span style={{ color: "#9dff7a" }}>{r.money !== null ? `$${r.money}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* pause */}
            {hud.paused && !hud.menuOpen && (
              <div onClick={() => eng && eng.resume()} style={{ position: "absolute", inset: 0, pointerEvents: "auto", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}>
                <div style={{ textAlign: "center", maxWidth: 520 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, marginBottom: 8 }}>PAUSED</div>
                  <div style={{ fontSize: 15, marginBottom: 16 }}>Click anywhere to capture the mouse and continue</div>
                  <div style={{ fontSize: 12, lineHeight: 2, opacity: 0.9 }}>
                    <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> move · <Key>Mouse</Key> aim · <Key>Click</Key> fire · <Key>R</Key> reload · <Key>E</Key> plant / defuse · <Key>Space</Key> jump<br />
                    <Key>Shift</Key> walk quietly · <Key>C</Key> crouch · <Key>1</Key>-<Key>6</Key> weapons &amp; grenades · <Key>Right-click</Key> scope / knife stab / short throw · <Key>B</Key> buy (start of round) · <Key>Tab</Key> scoreboard · <Key>M</Key> music
                  </div>
                  <div style={{ marginTop: 16, display: "flex", gap: 24, justifyContent: "center", fontSize: 12, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <label>Mouse sensitivity <input type="range" min="0.3" max="3" step="0.05" defaultValue={hud.sens} onChange={(e) => eng.setSens(parseFloat(e.target.value))} /></label>
                    <label>Sound <input type="range" min="0" max="1" step="0.05" defaultValue={hud.vol} onChange={(e) => eng.setVolume(parseFloat(e.target.value))} /></label>
                    <button onClick={() => eng.toggleMusic()} style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "2px 10px", background: "rgba(255,255,255,0.1)", color: "#fff" }}>♪ {hud.musicOn ? "Music on" : "Music off"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* title menu */}
        {phase === "menu" && (
          <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "radial-gradient(ellipse at 50% 20%, #17222f 0%, #080b10 70%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
            <div style={{ width: "min(780px, 100%)", textAlign: "center" }}>
              <p className="font-pixel" style={{ fontSize: 22, color: accentColor, margin: 0, letterSpacing: 2 }}>OPERATION BLACKSITE</p>
              <p style={{ ...mono, fontSize: 12, opacity: 0.75, margin: "8px 0 14px" }}>5 v 5 first-person tactical shooter · {MAP_LIST.length} maps · day and night</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left", marginBottom: 14, fontSize: 12, lineHeight: 1.55 }}>
                <div style={{ border: `1px solid ${TT}66`, borderRadius: 8, padding: 10 }}><b style={{ color: TT }}>NIGHTFALL (attack)</b><br />Carry the bomb to site A or B and plant it (hold <Key>E</Key>). Protect it until it explodes. First half you play this side.</div>
                <div style={{ border: `1px solid ${CT}66`, borderRadius: 8, padding: 10 }}><b style={{ color: CT }}>SENTINEL (defend)</b><br />Stop the plant, or defuse the bomb in time (hold <Key>E</Key>). Sides swap after round 5. First to {MATCH.toWin} rounds wins.</div>
              </div>
              <p style={{ ...mono, fontSize: 11, opacity: 0.7, marginBottom: 6 }}>CHOOSE MAP</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
                {MAP_LIST.map((m) => { const sky = { bazaar: "linear-gradient(180deg,#5d9ae0 0%,#cfe2f2 55%,#d9bb88 56%,#b89a6c 100%)", harbor: "linear-gradient(180deg,#86b0dc 0%,#f6d9ae 52%,#6a747c 53%,#2f6f9a 100%)", quarter: "linear-gradient(180deg,#9ab0d4 0%,#ffc58a 55%,#c8a478 56%,#8a6a48 100%)", foundry: "linear-gradient(180deg,#0a1426 0%,#3c5870 55%,#2a3038 56%,#12161a 100%)" }[m.id]; return (
                  <button key={m.id} onClick={() => setMapId(m.id)} style={{ borderRadius: 8, border: `2px solid ${mapId === m.id ? accentColor : "rgba(169,159,214,0.3)"}`, background: "rgba(255,255,255,0.04)", color: "#fff", padding: 0, cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
                    <div style={{ height: 54, background: sky }} />
                    <div style={{ padding: "6px 9px" }}><div style={{ ...mono, fontSize: 12, fontWeight: 700 }}>{m.name}</div><div style={{ ...mono, fontSize: 10, color: AMBER }}>{m.tagline}</div></div>
                  </button>); })}
              </div>
              <p style={{ ...mono, fontSize: 11, opacity: 0.7, marginBottom: 6 }}>PICTURE QUALITY</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
                {Object.entries(QUALITY).map(([id, q]) => (
                  <button key={id} onClick={() => setQuality(id)} style={{ borderRadius: 8, border: `2px solid ${quality === id ? accentColor : "rgba(169,159,214,0.3)"}`, background: "rgba(255,255,255,0.04)", color: "#fff", padding: 8, cursor: "pointer" }}>
                    <div style={{ ...mono, fontSize: 11, fontWeight: 700 }}>{q.label}</div>
                  </button>
                ))}
              </div>
              <p style={{ ...mono, fontSize: 11, opacity: 0.7, marginBottom: 6 }}>CHOOSE OPPONENT SKILL</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                {Object.entries(DIFFS).map(([id, d]) => (
                  <button key={id} onClick={() => setDifficulty(id)} style={{ borderRadius: 8, border: `2px solid ${difficulty === id ? accentColor : "rgba(169,159,214,0.3)"}`, background: "rgba(255,255,255,0.04)", color: "#fff", padding: 10, cursor: "pointer" }}>
                    <div style={{ ...mono, fontSize: 12, fontWeight: 700 }}>{d.label}</div><div style={{ ...mono, fontSize: 10, color: AMBER }}>×{d.scoreMult} score</div><div style={{ ...mono, fontSize: 10, opacity: 0.6 }}>{bests[id] != null ? `Best: ${bests[id]}` : "No runs yet"}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowHow((v) => !v)} style={{ ...mono, fontSize: 11, color: AMBER, background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>{showHow ? "Hide controls ▲" : "Show controls ▼"}</button>
              {showHow && (
                <div style={{ ...mono, fontSize: 11, lineHeight: 2, opacity: 0.9, marginBottom: 10, textAlign: "left", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 10 }}>
                  <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> move · <Key>Mouse</Key> aim · <Key>Left click</Key> fire · <Key>Right click</Key> scope (sniper) / stab (knife) / short throw (grenade) · <Key>R</Key> reload · <Key>E</Key> hold to plant or defuse<br />
                  <Key>Space</Key> jump (crates!) · <Key>Shift</Key> walk silently · <Key>C</Key> crouch · <Key>1</Key> main gun <Key>2</Key> pistol <Key>3</Key> knife <Key>4</Key> flash <Key>5</Key> smoke <Key>6</Key> frag · <Key>Q</Key> last weapon · <Key>B</Key> buy menu (round start) · <Key>Tab</Key> scoreboard · <Key>M</Key> music<br />
                  Tips: standing still makes shots accurate (stop, then shoot). Footsteps are loud — walk with Shift near enemies. Spray pulls your aim up: pull the mouse down. Smokes block sight, flashes blind whoever is looking.
                </div>
              )}
              {webglFail && <p style={{ color: "#ff7a7a", fontSize: 12 }}>Your browser could not start 3D graphics, so the game can't run here.</p>}
              <button onClick={deploy} className="font-pixel" style={{ fontSize: 12, padding: "12px 34px", borderRadius: 8, background: accentColor, color: "#0b0b14", border: "none", cursor: "pointer" }}>DEPLOY</button>
              <p style={{ ...mono, fontSize: 10, opacity: 0.5, marginTop: 10 }}>Headphones recommended — sound is placed in 3D.</p>
            </div>
          </div>
        )}

        {/* result */}
        {phase === "result" && result && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,10,0.92)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ width: "min(460px, 92%)" }}>
              <p className="font-pixel" style={{ fontSize: 20, color: result.won ? AMBER : "#ff3ea5", marginBottom: 6 }}>{result.won ? "MATCH WON" : result.rounds.you === result.rounds.them ? "DRAW" : "MATCH LOST"}</p>
              <p style={{ ...mono, fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Rounds: {result.rounds.you} — {result.rounds.them}</p>
              <div style={{ ...mono, fontSize: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, marginBottom: 14, lineHeight: 1.9 }}>
                {result.stats.kills} kills · {result.stats.hs} headshots · {result.stats.deaths} deaths<br />{result.stats.plants} plants · {result.stats.defuses} defuses · {result.stats.damage} damage dealt<br />Match MVP: {result.mvp}<br /><b style={{ color: AMBER, fontSize: 16 }}>SCORE {result.score}</b>
              </div>
              <button onClick={() => onFinish(finalScore.current)} className="font-pixel" style={{ fontSize: 11, padding: "10px 28px", borderRadius: 8, background: result.won ? AMBER : "#ff3ea5", color: "#0b0b14", border: "none", cursor: "pointer" }}>CONTINUE</button>
            </div>
          </div>
        )}
      </div>
      {phase === "playing" && <p style={{ ...mono, fontSize: 10, opacity: 0.55, textAlign: "center", marginTop: 6, color: "#a99fd6" }}>Esc releases the mouse · M music · B buy at round start · Tab scoreboard</p>}
    </div>
  );
}
