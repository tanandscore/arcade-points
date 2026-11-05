"use client";

import { useEffect, useRef, useState } from "react";
import { createEngine, DIFFS, MATCH, QUALITY } from "@/blacksite/engine/engine";
import { MAP_LIST as ALL_MAPS } from "@/blacksite/engine/map";
import { useMapSwitches } from "@/lib/useMapSwitches";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";
import { mpStatus, openRoom, randomCode, cleanCode } from "@/blacksite/mpClient";


// Operation Blacksite — first-person tactical shooter. This file is only the screen furniture
// (menus, HUD, buy menu, scoreboard). The game itself lives in lib/blacksite/engine.js.
const CT = "#3ea8ff", TT = "#ff6a4a", AMBER = "#ffb703";
const mono = { fontFamily: "ui-monospace, Menlo, Consolas, monospace" };
const pad2 = (n) => String(Math.max(0, n)).padStart(2, "0");
const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${pad2(Math.floor(Math.max(0, s) % 60))}`;

const BOTS_A = ["Reyes", "Kade", "Voss", "Milo", "Osei"], BOTS_B = ["Hex", "Rook", "Zane", "Dmitri", "Cobra"]; // same names the room server gives the bots

function Key({ children }) { return <span style={{ ...mono, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 4, padding: "1px 6px", fontSize: 11, background: "rgba(255,255,255,0.08)" }}>{children}</span>; }

export default function OperationBlacksite({ onFinish, accentColor = "#ff2d95" }) {
  const wrapRef = useRef(null), mountRef = useRef(null), radarRef = useRef(null), crossRef = useRef(null), hitRef = useRef(null), hurtRef = useRef(null), dmgRef = useRef(null), scopeRef = useRef(null);
  const engineRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu"); // menu | lobby | playing | result
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
  // ---- multiplayer (admins only while it is "coming soon"; see blacksite/server/room.js) ----
  const [mp, setMp] = useState(null); // {signedIn, admin, comingSoon, name}
  const [lobby, setLobby] = useState(null); // the room's lobby report
  const [mpErr, setMpErr] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mpBusy, setMpBusy] = useState(false);
  const roomRef = useRef(null), myUidRef = useRef(null);

  useEffect(() => { try { const m = localStorage.getItem("blacksite-map"), q = localStorage.getItem("blacksite-quality-v2"); if (m && ALL_MAPS.some((x) => x.id === m)) setMapId(m); if (q && QUALITY[q]) setQuality(q); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("blacksite-map", mapId); localStorage.setItem("blacksite-quality-v2", quality); } catch {} }, [mapId, quality]);
  useEffect(() => { const coarse = window.matchMedia("(pointer: coarse)").matches; setDeviceOk(!coarse && window.innerWidth >= 900); }, []);
  useEffect(() => { fetch("/api/difficulty-scores?game=operationblacksite").then((r) => r.json()).then((d) => setBests(d.bests || {})).catch(() => {}); }, []);
  useEffect(() => () => { if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; } leaveRoom(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mpStatus().then(setMp); }, []);

  function dropEngine() { if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; } }
  function leaveRoom(quiet) { const r = roomRef.current; roomRef.current = null; if (r) r.close(); dropEngine(); if (!quiet) { setLobby(null); setResult(null); setPhase("menu"); } }

  async function openOnline(create) {
    setMpErr("");
    const code = create ? randomCode() : cleanCode(joinCode);
    if (!create && code.length !== 5) { setMpErr("Room codes are 5 letters or numbers."); return; }
    setMpBusy(true); const st = await mpStatus(); setMp(st); setMpBusy(false);
    if (!st.canPlay || !st.ticket) { setMpErr(st.signedIn ? "Multiplayer is coming soon." : "Sign in to play online."); return; }
    leaveRoom(true); setLobby(null);
    const room = openRoom({ code, create, ticket: st.ticket, map: mapId, base: typeof window !== "undefined" ? window.__BS_MP_BASE : undefined }, { // __BS_MP_BASE: local testing only
      onWelcome: (m) => { myUidRef.current = m.uid; },
      onLobby: (m) => setLobby(m),
      onStart: (m) => startOnline(m),
      onGame: (from, d) => { const e = engineRef.current; if (e) e.netReceive(from, d); },
      onLeft: (m) => { const e = engineRef.current; if (e && e.netLeft) e.netLeft(m.slot); },
      onEnded: () => { dropEngine(); setResult(null); setPhase("lobby"); },
      onError: (text, fatal) => { setMpErr(text); if (fatal) { roomRef.current = null; dropEngine(); setLobby(null); setPhase("menu"); } },
      onClose: (reason) => { roomRef.current = null; dropEngine(); setLobby(null); setResult(null); setPhase("menu"); setMpErr(reason === "Joined again elsewhere" ? "You joined this room from another tab." : reason === "Too many messages" ? "You were disconnected for sending too much." : "The connection to the room was lost."); },
    });
    roomRef.current = room; setPhase("lobby");
  }

  // the room says go: the match runs on the game server; this browser draws it and sends what you do
  function startOnline(m) {
    const room = roomRef.current; if (!room) return;
    dropEngine(); stage.enter();
    const eng = createEngine({
      mount: mountRef.current, difficulty: m.cfg.diff, mapId: m.cfg.map, quality,
      onMatchEnd: (r) => { finalScore.current = 0; setResult(r); setPhase("result"); }, // online matches don't count towards scores or points
      net: { role: "client", myId: m.you, roster: m.roster, seed: m.seed, send: (s) => { const rr = roomRef.current; if (rr) rr.send(s); } },
    });
    if (!eng) { setWebglFail(true); leaveRoom(); return; }
    engineRef.current = eng; setResult(null); setPhase("playing"); eng.start(); room.ready(); setHud(eng.hudState());
  }

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
              <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8, color: side === "police" ? CT : TT }}>YOU: {hud.sideName}{hud.net ? <span style={{ color: "#7dffe8" }}>{"  ·  ONLINE · "}{`${Math.round(hud.net.ping)} ms`}</span> : null}</div>
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
            {/* team radio: the last few calls, under the radar */}
            {hud.radioLog && hud.radioLog.length > 0 && (
              <div style={{ position: "absolute", left: 12, top: 192, display: "flex", flexDirection: "column", gap: 3, maxWidth: 420 }}>
                {hud.radioLog.map((r, i) => (
                  <div key={i + r.text} style={{ fontSize: 12.5, background: "rgba(5,8,12,0.62)", padding: "2px 9px", borderRadius: 4, borderLeft: `3px solid ${side === "police" ? CT : TT}`, opacity: Math.max(0.25, 1 - Math.max(0, r.age - 5) / 2), textShadow: "0 1px 3px #000" }}>
                    <span style={{ color: side === "police" ? CT : TT, fontWeight: 700 }}>{r.name}</span> <span style={{ opacity: 0.6, fontSize: 10 }}>(RADIO)</span>: {r.text}
                  </div>
                ))}
              </div>
            )}
            {/* radio menu (Z / X / V) */}
            {hud.radioMenu && (
              <div style={{ position: "absolute", left: 12, top: "40%", minWidth: 280, background: "rgba(5,8,12,0.82)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "8px 12px", fontSize: 13, lineHeight: 1.75, pointerEvents: "auto" }}>
                <div style={{ fontWeight: 800, letterSpacing: 2, marginBottom: 4, color: side === "police" ? CT : TT }}>{hud.radioMenu.title}</div>
                {hud.radioMenu.items.map((it) => (
                  <div key={it.id} onClick={() => eng && eng.radioCommand(it.id) && eng.closeRadio()} style={{ cursor: "pointer" }}><span style={{ color: AMBER, marginRight: 8 }}>{it.n}.</span>{it.text}</div>
                ))}
                <div style={{ opacity: 0.6, marginTop: 2 }}><span style={{ color: AMBER, marginRight: 8 }}>0.</span>Exit</div>
              </div>
            )}

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

            {/* online: waiting for the match to begin */}
            {hud.net && hud.net.waiting && (
              <div style={{ position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", textShadow: "0 2px 10px #000" }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>WAITING FOR PLAYERS</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Everyone&apos;s game is loading — the match begins as soon as they are in.</div>
              </div>
            )}

            {/* pause */}
            {hud.paused && !hud.menuOpen && (
              <div onClick={() => eng && eng.resume()} style={{ position: "absolute", inset: 0, pointerEvents: "auto", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}>
                <div style={{ textAlign: "center", maxWidth: 520 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, marginBottom: 8 }}>{hud.net ? "MOUSE RELEASED" : "PAUSED"}</div>
                  <div style={{ fontSize: 15, marginBottom: 16 }}>{hud.net ? "This is an online match — it keeps going without you. Click anywhere to get back in." : "Click anywhere to capture the mouse and continue"}</div>
                  <div style={{ fontSize: 12, lineHeight: 2, opacity: 0.9 }}>
                    <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> move · <Key>Mouse</Key> aim · <Key>Click</Key> fire · <Key>R</Key> reload · <Key>E</Key> plant / defuse · <Key>Space</Key> jump<br />
                    <Key>Shift</Key> walk quietly · <Key>C</Key> crouch · <Key>1</Key>-<Key>6</Key> weapons &amp; grenades · <Key>Right-click</Key> scope / knife stab / short throw · <Key>B</Key> buy (start of round) · <Key>Tab</Key> scoreboard · <Key>M</Key> music<br />
                    <Key>Z</Key> radio commands · <Key>X</Key> group orders · <Key>V</Key> responses — then press the number
                  </div>
                  <div style={{ marginTop: 16, display: "flex", gap: 24, justifyContent: "center", fontSize: 12, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <label>Mouse sensitivity <input type="range" min="0.3" max="3" step="0.05" defaultValue={hud.sens} onChange={(e) => eng.setSens(parseFloat(e.target.value))} /></label>
                    <label>Sound <input type="range" min="0" max="1" step="0.05" defaultValue={hud.vol} onChange={(e) => eng.setVolume(parseFloat(e.target.value))} /></label>
                    <button onClick={() => eng.toggleMusic()} style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "2px 10px", background: "rgba(255,255,255,0.1)", color: "#fff" }}>♪ {hud.musicOn ? "Music on" : "Music off"}</button>
                    {hud.net && <button onClick={() => leaveRoom()} style={{ border: "1px solid #ff7a7a", borderRadius: 6, padding: "2px 10px", background: "rgba(255,80,80,0.15)", color: "#fff" }}>Leave match</button>}
                    {hud.radioVoiceAvail && <button onClick={() => { eng.toggleRadioVoice(); setHud(eng.hudState()); }} style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "2px 10px", background: "rgba(255,255,255,0.1)", color: "#fff" }}>📻 {hud.radioVoice ? "Radio voices on" : "Radio voices off"}</button>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* title menu */}
        {phase === "menu" && (() => {
          const glass = { background: "rgba(14,20,30,0.72)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, backdropFilter: "blur(10px)", padding: 16 };
          const label = { ...mono, fontSize: 10, letterSpacing: 3, opacity: 0.6, margin: "0 0 10px" };
          const chip = (on) => ({ ...mono, cursor: "pointer", color: "#fff", borderRadius: 999, padding: "7px 14px", fontSize: 11, fontWeight: 700, border: `1px solid ${on ? accentColor : "rgba(255,255,255,0.16)"}`, background: on ? `${accentColor}33` : "rgba(255,255,255,0.04)", boxShadow: on ? `0 0 14px ${accentColor}55` : "none", transition: "all .15s" });
          const skies = { bazaar: "linear-gradient(180deg,#5d9ae0 0%,#cfe2f2 55%,#d9bb88 56%,#b89a6c 100%)", harbor: "linear-gradient(180deg,#86b0dc 0%,#f6d9ae 52%,#6a747c 53%,#2f6f9a 100%)", quarter: "linear-gradient(180deg,#9ab0d4 0%,#ffc58a 55%,#c8a478 56%,#8a6a48 100%)", foundry: "linear-gradient(180deg,#0a1426 0%,#3c5870 55%,#2a3038 56%,#12161a 100%)" };
          const mpLive = mp && mp.open;
          return (
          <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "radial-gradient(ellipse at 15% 0%, #1d2d44 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, #2a1620 0%, transparent 50%), #070a10", color: "#fff", padding: "clamp(12px,3vw,28px)" }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                <div>
                  <p style={{ ...mono, fontSize: 10, letterSpacing: 4, color: AMBER, margin: 0 }}>5 v 5 TACTICAL SHOOTER</p>
                  <h1 className="font-pixel" style={{ fontSize: "clamp(20px,4vw,34px)", color: accentColor, margin: "6px 0 0", letterSpacing: 2, textShadow: `0 0 24px ${accentColor}66` }}>OPERATION BLACKSITE</h1>
                </div>
                <p style={{ ...mono, fontSize: 11, opacity: 0.65, margin: 0 }}>{MAP_LIST.length} maps · day &amp; night · radio-talking bots</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={glass}>
                    <p style={label}>MISSION</p>
                    <div style={{ display: "grid", gap: 10, fontSize: 12, lineHeight: 1.55 }}>
                      <div style={{ borderLeft: `3px solid ${TT}`, paddingLeft: 10 }}><b style={{ color: TT }}>NIGHTFALL · attack</b><br />Carry the bomb to site A or B and plant it (hold <Key>E</Key>). Guard it until it blows. You start on this side.</div>
                      <div style={{ borderLeft: `3px solid ${CT}`, paddingLeft: 10 }}><b style={{ color: CT }}>SENTINEL · defend</b><br />Stop the plant, or defuse in time (hold <Key>E</Key>). Sides swap after round 5. First to {MATCH.toWin} rounds wins.</div>
                    </div>
                  </div>
                  <div style={glass}>
                    <p style={label}>MAP</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                      {MAP_LIST.map((m) => { const on = mapId === m.id; return (
                        <button key={m.id} onClick={() => setMapId(m.id)} style={{ borderRadius: 10, border: `2px solid ${on ? accentColor : "rgba(255,255,255,0.12)"}`, boxShadow: on ? `0 0 18px ${accentColor}55` : "none", background: "#0c121b", color: "#fff", padding: 0, cursor: "pointer", overflow: "hidden", textAlign: "left", transform: on ? "translateY(-2px)" : "none", transition: "all .15s" }}>
                          <div style={{ height: 62, background: skies[m.id], position: "relative" }}>{on && <span style={{ ...mono, position: "absolute", top: 6, right: 6, fontSize: 9, fontWeight: 800, background: accentColor, color: "#0b0b14", borderRadius: 4, padding: "1px 6px" }}>SELECTED</span>}</div>
                          <div style={{ padding: "7px 10px" }}><div style={{ ...mono, fontSize: 12, fontWeight: 700 }}>{m.name}</div><div style={{ ...mono, fontSize: 10, color: AMBER }}>{m.tagline}</div></div>
                        </button>); })}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={glass}>
                    <p style={label}>OPPONENT SKILL</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {Object.entries(DIFFS).map(([id, d]) => { const on = difficulty === id; return (
                        <button key={id} onClick={() => setDifficulty(id)} style={{ borderRadius: 10, border: `1px solid ${on ? accentColor : "rgba(255,255,255,0.14)"}`, background: on ? `${accentColor}22` : "rgba(255,255,255,0.03)", boxShadow: on ? `0 0 14px ${accentColor}44` : "none", color: "#fff", padding: "10px 6px", cursor: "pointer" }}>
                          <div style={{ ...mono, fontSize: 12, fontWeight: 700 }}>{d.label}</div><div style={{ ...mono, fontSize: 10, color: AMBER }}>×{d.scoreMult} score</div><div style={{ ...mono, fontSize: 10, opacity: 0.55 }}>{bests[id] != null ? `Best ${bests[id]}` : "No runs yet"}</div>
                        </button>); })}
                    </div>
                    <p style={{ ...label, marginTop: 16 }}>PICTURE QUALITY</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {Object.entries(QUALITY).map(([id, q]) => <button key={id} onClick={() => setQuality(id)} style={chip(quality === id)}>{q.label}</button>)}
                    </div>
                  </div>
                  {webglFail && <p style={{ color: "#ff7a7a", fontSize: 12, margin: 0 }}>Your browser could not start 3D graphics, so the game can't run here.</p>}
                  <button onClick={deploy} className="font-pixel" style={{ fontSize: 15, letterSpacing: 3, padding: "18px 20px", borderRadius: 12, background: `linear-gradient(135deg, ${accentColor}, ${AMBER})`, color: "#0b0b14", border: "none", cursor: "pointer", boxShadow: `0 8px 30px ${accentColor}55` }}>▶ DEPLOY · SOLO</button>
                  <div style={{ ...glass, borderColor: "rgba(125,255,232,0.35)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <b style={{ ...mono, fontSize: 13, letterSpacing: 3, color: "#7dffe8" }}>ONLINE · 5 v 5</b>
                      <span style={{ ...mono, fontSize: 10, padding: "3px 10px", borderRadius: 999, background: mpLive ? "rgba(125,255,232,0.18)" : mp && mp.admin ? "rgba(255,183,3,0.18)" : "rgba(255,255,255,0.1)", color: mpLive ? "#7dffe8" : mp && mp.admin ? AMBER : "#cfd8e6" }}>{mpLive ? "LIVE" : mp && mp.admin ? "COMING SOON · ADMIN PREVIEW" : "COMING SOON"}</span>
                    </div>
                    <p style={{ ...mono, fontSize: 11, opacity: 0.8, margin: "8px 0 0", lineHeight: 1.6 }}>Play with friends — share a room code, pick a side, bots fill empty places.</p>
                    {mp && mp.canPlay && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <button disabled={mpBusy} onClick={() => openOnline(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "none", background: "#7dffe8", color: "#0b0b14", cursor: "pointer" }}>CREATE ROOM</button>
                        <span style={{ ...mono, fontSize: 11, opacity: 0.6 }}>or</span>
                        <input value={joinCode} onChange={(e) => setJoinCode(cleanCode(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") openOnline(false); }} placeholder="CODE" maxLength={5} style={{ ...mono, width: 90, fontSize: 13, letterSpacing: 3, padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.3)", color: "#fff", textTransform: "uppercase" }} />
                        <button disabled={mpBusy} onClick={() => openOnline(false)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "1px solid #7dffe8", background: "transparent", color: "#7dffe8", cursor: "pointer" }}>JOIN</button>
                      </div>
                    )}
                    {mpErr && <p style={{ ...mono, fontSize: 11, color: "#ff8a8a", margin: "8px 0 0" }}>{mpErr}</p>}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <button onClick={() => setShowHow((v) => !v)} style={{ ...mono, fontSize: 11, color: AMBER, background: "none", border: "none", cursor: "pointer" }}>{showHow ? "Hide controls ▲" : "Show controls ▼"}</button>
                    <p style={{ ...mono, fontSize: 10, opacity: 0.45, margin: "4px 0 0" }}>Headphones recommended — sound is placed in 3D.</p>
                  </div>
                </div>
              </div>
              {showHow && (
                <div style={{ ...glass, ...mono, fontSize: 11, lineHeight: 2, marginTop: 14 }}>
                  <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> move · <Key>Mouse</Key> aim · <Key>Left click</Key> fire · <Key>Right click</Key> scope (sniper) / stab (knife) / short throw (grenade) · <Key>R</Key> reload · <Key>E</Key> hold to plant or defuse<br />
                  <Key>Space</Key> jump (crates!) · <Key>Shift</Key> walk silently · <Key>C</Key> crouch · <Key>1</Key> main gun <Key>2</Key> pistol <Key>3</Key> knife <Key>4</Key> flash <Key>5</Key> smoke <Key>6</Key> frag · <Key>Q</Key> last weapon · <Key>B</Key> buy menu (round start) · <Key>Tab</Key> scoreboard · <Key>M</Key> music<br />
                  <Key>Z</Key> radio commands (cover me, follow me, hold, regroup…) · <Key>X</Key> group orders (go go go, fall back, storm the front…) · <Key>V</Key> responses (affirmative, enemy spotted, need backup…) — then press the number. Your bots answer and do what you ask.<br />
                  Tips: standing still makes shots accurate (stop, then shoot). Footsteps are loud — walk with Shift near enemies. Spray pulls your aim up: pull the mouse down. Smokes block sight, flashes blind whoever is looking.
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* online lobby */}
        {phase === "lobby" && (
          <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "radial-gradient(ellipse at 50% 20%, #12262a 0%, #080b10 70%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, ...mono }}>
            {!lobby ? <div style={{ fontSize: 13, opacity: 0.8 }}>Connecting to the room…</div> : (() => {
              const me = lobby.members.find((x) => x.uid === myUidRef.current); const isHost = lobby.host === myUidRef.current;
              const col = (squad) => { const base = squad === "A" ? 0 : 5; const c = squad === "A" ? TT : CT; return (
                <div style={{ border: `1px solid ${c}66`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${c}`, paddingBottom: 4, marginBottom: 6 }}>
                    <b style={{ color: c, letterSpacing: 1 }}>{squad === "A" ? "NIGHTFALL" : "SENTINEL"}</b><span style={{ fontSize: 10, opacity: 0.7 }}>{squad === "A" ? "attacks first" : "defends first"}</span>
                  </div>
                  {[0, 1, 2, 3, 4].map((i) => { const m = lobby.members.find((x) => x.slot === base + i); return (
                    <div key={i} style={{ fontSize: 12.5, padding: "4px 2px", display: "flex", justifyContent: "space-between", opacity: m ? 1 : 0.45, fontWeight: m && m.uid === myUidRef.current ? 800 : 400 }}>
                      <span>{m ? m.name : `🤖 ${(squad === "A" ? BOTS_A : BOTS_B)[i]}`}</span>
                      <span style={{ fontSize: 10, color: AMBER }}>{m ? [m.host ? "LEADER" : "", m.uid === myUidRef.current ? "YOU" : ""].filter(Boolean).join(" · ") : "bot"}</span>
                    </div>); })}
                  {me && me.squad !== squad && <button onClick={() => roomRef.current && roomRef.current.team(squad)} style={{ ...mono, marginTop: 6, width: "100%", fontSize: 11, padding: "6px", borderRadius: 6, border: `1px solid ${c}`, background: "transparent", color: c, cursor: "pointer" }}>JOIN {squad === "A" ? "NIGHTFALL" : "SENTINEL"}</button>}
                </div>); };
              const mapName = (ALL_MAPS.find((x) => x.id === lobby.cfg.map) || {}).name || lobby.cfg.map;
              return (
                <div style={{ width: "min(720px, 100%)", textAlign: "center" }}>
                  <p className="font-pixel" style={{ fontSize: 16, color: accentColor, margin: 0, letterSpacing: 2 }}>ONLINE ROOM</p>
                  <div style={{ margin: "10px 0 4px", fontSize: 11, opacity: 0.7 }}>ROOM CODE — share it with the other players</div>
                  <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: "#7dffe8" }}>{lobby.code}</span>
                    <button onClick={() => { try { navigator.clipboard.writeText(lobby.code); } catch {} }} style={{ ...mono, fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}>COPY</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0", textAlign: "left" }}>{col("A")}{col("B")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12, textAlign: "left", fontSize: 11 }}>
                    <label>MAP<br />{isHost ? (
                      <select value={lobby.cfg.map} onChange={(e) => roomRef.current && roomRef.current.cfg({ map: e.target.value })} style={{ ...mono, width: "100%", marginTop: 4, padding: 6, borderRadius: 6, background: "#10161e", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                        {MAP_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>) : <b style={{ display: "block", marginTop: 6, fontSize: 13 }}>{mapName}</b>}</label>
                    <label>BOT SKILL<br />{isHost ? (
                      <select value={lobby.cfg.diff} onChange={(e) => roomRef.current && roomRef.current.cfg({ diff: e.target.value })} style={{ ...mono, width: "100%", marginTop: 4, padding: 6, borderRadius: 6, background: "#10161e", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                        {Object.entries(DIFFS).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
                      </select>) : <b style={{ display: "block", marginTop: 6, fontSize: 13 }}>{(DIFFS[lobby.cfg.diff] || {}).label || lobby.cfg.diff}</b>}</label>
                  </div>
                  {lobby.phase === "playing" ? <p style={{ fontSize: 12, opacity: 0.8 }}>A match is being played in this room…</p>
                    : isHost ? <button onClick={() => roomRef.current && roomRef.current.start()} className="font-pixel" style={{ fontSize: 12, padding: "12px 34px", borderRadius: 8, background: accentColor, color: "#0b0b14", border: "none", cursor: "pointer" }}>START MATCH</button>
                    : <p style={{ fontSize: 12, opacity: 0.8 }}>Waiting for the room leader to start the match…</p>}
                  {mpErr && <p style={{ fontSize: 11, color: "#ff8a8a", marginTop: 8 }}>{mpErr}</p>}
                  <div style={{ marginTop: 12 }}><button onClick={() => { setMpErr(""); leaveRoom(); }} style={{ ...mono, fontSize: 11, padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", cursor: "pointer" }}>LEAVE ROOM</button></div>
                  <p style={{ fontSize: 10, opacity: 0.5, marginTop: 10 }}>Multiplayer is a preview for admins. Matches run on our game server, which checks every move and shot. If a player leaves, a bot takes over. Online matches don&apos;t count towards scores or points.</p>
                </div>);
            })()}
          </div>
        )}

        {/* result */}
        {phase === "result" && result && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,10,0.92)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ width: "min(460px, 92%)" }}>
              <p className="font-pixel" style={{ fontSize: 20, color: result.won ? AMBER : "#ff3ea5", marginBottom: 6 }}>{result.won ? "MATCH WON" : result.rounds.you === result.rounds.them ? "DRAW" : "MATCH LOST"}</p>
              <p style={{ ...mono, fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Rounds: {result.rounds.you} — {result.rounds.them}</p>
              <div style={{ ...mono, fontSize: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, marginBottom: 14, lineHeight: 1.9 }}>
                {result.stats.kills} kills · {result.stats.hs} headshots · {result.stats.deaths} deaths<br />{result.stats.plants} plants · {result.stats.defuses} defuses · {result.stats.damage} damage dealt<br />Match MVP: {result.mvp}{!result.online && <><br /><b style={{ color: AMBER, fontSize: 16 }}>SCORE {result.score}</b></>}
              </div>
              {result.online ? (
                <div>
                  {lobby && lobby.host === myUidRef.current
                    ? <button onClick={() => roomRef.current && roomRef.current.end()} className="font-pixel" style={{ fontSize: 11, padding: "10px 28px", borderRadius: 8, background: "#7dffe8", color: "#0b0b14", border: "none", cursor: "pointer" }}>BACK TO LOBBY</button>
                    : <p style={{ ...mono, fontSize: 12, opacity: 0.8 }}>Waiting for the room leader to go back to the lobby…</p>}
                  <div style={{ marginTop: 10 }}><button onClick={() => leaveRoom()} style={{ ...mono, fontSize: 11, padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", cursor: "pointer" }}>LEAVE ROOM</button></div>
                  <p style={{ ...mono, fontSize: 10, opacity: 0.5, marginTop: 8 }}>Online matches don&apos;t count towards scores or points.</p>
                </div>
              ) : <button onClick={() => onFinish(finalScore.current)} className="font-pixel" style={{ fontSize: 11, padding: "10px 28px", borderRadius: 8, background: result.won ? AMBER : "#ff3ea5", color: "#0b0b14", border: "none", cursor: "pointer" }}>CONTINUE</button>}
            </div>
          </div>
        )}
      </div>
      {phase === "playing" && <p style={{ ...mono, fontSize: 10, opacity: 0.55, textAlign: "center", marginTop: 6, color: "#a99fd6" }}>Esc releases the mouse · M music · B buy at round start · Tab scoreboard · Z / X / V radio</p>}
    </div>
  );
}
