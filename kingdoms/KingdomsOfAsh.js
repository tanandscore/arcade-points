"use client";

// Ashtide (this game's slug is still "kingdomsofash") — a calm, Townscaper-style town builder.
// Build colourful harbour houses on the water, grow towers and gardens, finish when you like.
import { useEffect, useRef, useState } from "react";
import { createEngine } from "@/kingdoms/engine/engine";
import { PALETTE } from "@/kingdoms/engine/build";
import { EXTRA_COLOURS } from "@/kingdoms/engine/progress";
import { createMoodMusic } from "@/lib/cinematic/music";
import { useStage, stageBoxStyle } from "@/games/FullscreenStage";

const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const panel = { background: "rgba(255,250,240,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 14, color: "#3a3550", boxShadow: "0 6px 24px rgba(40,40,80,0.18)" };
const btn = { ...panel, borderRadius: 10, padding: "6px 11px", font: "600 12px/1 system-ui, sans-serif", cursor: "pointer", color: "#3a3550" };
const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";

export default function Ashtide({ onFinish, accentColor = "#ffb703" }) {
  const stage = useStage();
  const mountRef = useRef(null), engRef = useRef(null), musicRef = useRef(null), toastId = useRef(0);
  const [s, setS] = useState(null);
  const [phase, setPhase] = useState("menu");            // menu | play
  const [saved, setSaved] = useState(null);
  const [fail, setFail] = useState(false);
  const [help, setHelp] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [musicOn, setMusicOn] = useState(true);
  const [flash, setFlash] = useState(0);
  const [queue, setQueue] = useState([]);        // level-ups and discoveries waiting to be shown (Upgrade 64)
  const [album, setAlbum] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    let eng;
    try {
      eng = createEngine({
        mount: mountRef.current,
        onState: (st) => { setS(st); if (st.events && st.events.length) setQueue((q) => [...q, ...st.events.filter((e) => e.type === "level" || e.type === "discovery")]); },
        onToast: (msg) => { const id = ++toastId.current; setToasts((t) => [...t.slice(-2), { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200); },
      });
    } catch { setFail(true); return undefined; }
    engRef.current = eng; setSaved(eng.savedInfo()); eng.showDemo(7, 54);
    if (typeof window !== "undefined" && window.__TS_EXPOSE) window.__ts = eng;
    return () => { eng.dispose(); engRef.current = null; try { musicRef.current && musicRef.current.stop(); } catch {} };
  }, []);

  function startMusic() {
    try {
      if (!musicRef.current) { musicRef.current = createMoodMusic("ash", "ashtide-music", { day: 0.28, night: 0.16 }); setMusicOn(musicRef.current.isEnabled()); musicRef.current.setIntensity(0.28); }
      musicRef.current.start();
    } catch {}
  }
  function begin(resume) {
    const e = engRef.current; if (!e) return;
    stage.enter(); startMusic();
    if (resume && e.startFromSave()) { /* loaded */ } else e.startNew();
    setPhase("play"); setHelp(false);
  }
  function finish() {
    const e = engRef.current; if (!e) return; e.save(); const score = e.getScore();
    fetch("/api/difficulty-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "kingdomsofash", difficulty: "cozy", score }) }).catch(() => {});
    onFinish(score);
  }
  function toggleMusic() { const m = musicRef.current; if (!m) { startMusic(); return; } const next = !m.isEnabled(); m.setEnabled(next); setMusicOn(next); }
  function photo() { const ok = engRef.current && engRef.current.photo(); setFlash((f) => f + 1); const id = ++toastId.current; setToasts((t) => [...t.slice(-2), { id, msg: ok ? "📷 Saved a picture of your town" : "Couldn't save the picture" }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600); }

  if (fail) {
    return (
      <div className="text-center max-w-md mx-auto p-6">
        <p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>ASHTIDE</p>
        <p className="text-textDim text-sm">3D graphics aren't available in this browser. Try Chrome, Edge or Firefox with hardware acceleration turned on.</p>
      </div>
    );
  }

  const playing = phase === "play";
  const pr = s && s.prog;
  const lockLv = (n) => (n < 10 ? 0 : (EXTRA_COLOURS[n - 10] || {}).lvl || 99);
  const sel = s ? s.sel : -1;
  const Goal = ({ g }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: g.done ? 0.6 : 1, marginBottom: 7 }} title={g.hint}>
      <span style={{ width: 16, height: 16, borderRadius: 8, flex: "none", marginTop: 1, background: g.done ? "#6bbf8a" : "rgba(58,53,80,0.12)", color: "#fff", fontSize: 11, textAlign: "center", lineHeight: "16px" }}>{g.done ? "✓" : ""}</span>
      <span style={{ fontSize: 12, lineHeight: 1.25 }}>
        <b style={{ textDecoration: g.done ? "line-through" : "none" }}>{g.title}</b>
        <br /><span style={{ opacity: 0.75 }}>{g.hint}{!g.done && g.need > 1 ? ` · ${g.have}/${g.need}` : ""}</span>
      </span>
    </div>
  );

  return (
    <div className="mx-auto" style={stage.isFull ? undefined : { width: "100%" }}>
      <div style={{ ...stageBoxStyle(stage.isFull, { borderRadius: stage.isFull ? 0 : 14 }), background: "#9fd3e6", overflow: "hidden", userSelect: "none", fontFamily: FONT }} onContextMenu={(e) => e.preventDefault()}>
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
        {flash > 0 && <div key={flash} style={{ position: "absolute", inset: 0, background: "#fff", animation: "tsflash 0.5s ease-out forwards", pointerEvents: "none" }} />}
        <style>{`@keyframes tsflash{from{opacity:.8}to{opacity:0}} @keyframes tsin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

        {/* soft vignette */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(30,20,60,0.28) 100%)" }} />

        {!playing && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, rgba(255,240,220,0.15), rgba(40,30,80,0.25))" }}>
            <div style={{ ...panel, padding: "26px 32px", textAlign: "center", maxWidth: 440, width: "88%", animation: "tsin .5s ease-out" }}>
              <div style={{ fontSize: 12, letterSpacing: 4, opacity: 0.6, marginBottom: 4 }}>A COZY TOWN BUILDER</div>
              <h2 style={{ fontSize: 40, margin: "0 0 6px", letterSpacing: 1, fontFamily: "Georgia, 'Times New Roman', serif", color: "#b5503f" }}>Ashtide</h2>
              <p style={{ fontSize: 14, lineHeight: 1.45, margin: "0 0 16px", opacity: 0.85 }}>Click on the water to raise a little house. Click a house to build up, out or over the sea. Colours, roofs, windows and gardens work themselves out. No timer, no enemies — just build the harbour town you like.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {saved && <button onClick={() => begin(true)} style={{ ...btn, background: "#e9a23b", color: "#fff", fontSize: 15, padding: "12px 14px", border: "none" }}>Continue · {saved.island} · level {saved.level} {saved.title}{saved.houses ? ` · ${saved.houses} blocks` : ""}</button>}
                <button onClick={() => begin(false)} style={{ ...btn, background: saved ? "rgba(255,255,255,0.9)" : "#e9a23b", color: saved ? "#3a3550" : "#fff", fontSize: 15, padding: "12px 14px", border: saved ? undefined : "none" }}>{saved ? "Start a fresh town" : "Start building"}</button>
                <button onClick={() => setHelp((h) => !h)} style={{ ...btn, background: "transparent", border: "none", boxShadow: "none", textDecoration: "underline" }}>{help ? "Hide controls" : "How to play"}</button>
              </div>
              {help && <Controls />}
            </div>
          </div>
        )}

        {playing && s && (
          <>
            {/* top left: level, wishes, island goals (Upgrade 64) */}
            <div style={{ position: "absolute", top: 10, left: 10, width: 262, animation: "tsin .4s ease-out", maxHeight: "calc(100% - 120px)", overflowY: "auto" }}>
              <div style={{ ...panel, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6 }}>{(s.islands.find((x) => x.here) || {}).name?.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: "linear-gradient(135deg,#e9a23b,#b5503f)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, boxShadow: "0 3px 10px rgba(181,80,63,.35)" }}>{pr.level}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: "#b5503f", fontWeight: 700 }}>{pr.title}</div>
                    <div style={{ height: 7, borderRadius: 4, background: "rgba(58,53,80,.12)", overflow: "hidden", marginTop: 4 }}><div style={{ height: "100%", width: `${Math.round((pr.into / pr.need) * 100)}%`, background: "linear-gradient(90deg,#f5d77c,#e9a23b)", transition: "width .6s" }} /></div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>{pr.into} / {pr.need} XP to level {pr.level + 1}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                  <span title="Shells: earned from wishes and discoveries, spent on decorations">🐚 <b>{pr.shells}</b></span>
                  <span title="Town charm">✦ <b>{s.charm.toLocaleString()}</b></span>
                  <span>{s.houses} blocks</span>
                </div>
              </div>
              <div style={{ ...panel, marginTop: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>TOWNSFOLK WISHES</div>
                {s.wishes.map((w, n) => (
                  <div key={w.id} style={{ display: "flex", gap: 8, marginBottom: 9, animation: "tsin .4s ease-out" }}>
                    <div style={{ fontSize: 22, lineHeight: "26px" }}>{w.icon}</div>
                    <div style={{ flex: 1, fontSize: 12, lineHeight: 1.3 }}>
                      <div>{w.text}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(58,53,80,.12)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round((w.have / w.need) * 100)}%`, background: "#6bbf8a" }} /></div>
                        <span style={{ fontSize: 10, opacity: 0.7, whiteSpace: "nowrap" }}>{w.have}/{w.need} · +{w.xp} XP · {w.shells}🐚</span>
                      </div>
                    </div>
                    {s.canSkip && <button title="Ask someone else (once every 90 seconds)" onClick={() => engRef.current.skipWish(n)} style={{ all: "unset", cursor: "pointer", fontSize: 12, opacity: 0.45, alignSelf: "flex-start" }}>↻</button>}
                  </div>
                ))}
              </div>
              <div style={{ ...panel, marginTop: 8, padding: "8px 12px" }}>
                <button onClick={() => setGoalsOpen((o) => !o)} style={{ all: "unset", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontWeight: 700, opacity: 0.7, width: "100%", display: "flex", justifyContent: "space-between" }}>
                  <span>ISLAND GOALS · {s.goals.filter((g) => g.done).length}/{s.goals.length}</span><span>{goalsOpen ? "–" : "+"}</span>
                </button>
                {goalsOpen && <div style={{ marginTop: 8 }}>{s.goals.filter((g) => !g.done).slice(0, 2).map((g) => <Goal key={g.id} g={g} />)}</div>}
              </div>
            </div>

            {/* top right: tools */}
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "62%" }}>
              <button style={btn} onClick={() => engRef.current.undo()} disabled={!s.canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
              <button style={btn} onClick={() => engRef.current.toggleNight()} title="Day / night (N)">{s.night > 0.5 ? "☀ Day" : "☾ Night"}</button>
              <button style={btn} onClick={() => setAlbum(true)} title="Discoveries">📖 {s.found.filter((d) => d.found).length}/{s.found.length}</button>
              <button style={btn} onClick={() => setMapOpen(true)} title="Islands">🗺️ Islands</button>
              <button style={btn} onClick={photo} title="Save a picture">📷</button>
              <button style={btn} onClick={toggleMusic} title="Music">{musicOn ? "♪" : "♪̸"}</button>
              <button style={btn} onClick={() => setHelp((h) => !h)} title="Controls">?</button>
              <button style={{ ...btn, background: "#e9a23b", color: "#fff", border: "none" }} onClick={() => setConfirm(true)}>Finish town ▸</button>
            </div>

            {help && <div style={{ position: "absolute", top: 56, right: 10, width: 300, zIndex: 5 }}><div style={{ ...panel, padding: "12px 16px" }}><Controls /></div></div>}

            {/* bottom: build colours or decorations (Upgrade 64) */}
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: "96%" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[["build", "🏠 Build"], ["decor", "🌳 Decorate"]].map(([m, t]) => <button key={m} onClick={() => engRef.current.setMode(m)} style={{ ...btn, background: s.mode === m ? "#3a3550" : "rgba(255,250,240,0.85)", color: s.mode === m ? "#fff" : "#3a3550" }}>{t}</button>)}
              </div>
              {s.mode === "build" ? (
                <div style={{ ...panel, padding: "8px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <button onClick={() => engRef.current.setColour(-1)} title="Mix colours automatically (Alt+A)" style={{ ...btn, padding: "5px 9px", background: sel < 0 ? "#3a3550" : "rgba(255,255,255,0.7)", color: sel < 0 ? "#fff" : "#3a3550", boxShadow: "none" }}>✦ Mix</button>
                  {PALETTE.map((p, n) => { const locked = n >= pr.colours; return (
                    <button key={p.name} onClick={() => !locked && engRef.current.setColour(n)} title={locked ? `${p.name} · unlocks at level ${lockLv(n)}` : `${p.name}${n < 10 ? ` (${n + 1 === 10 ? 0 : n + 1})` : ""}`} aria-label={p.name}
                      style={{ width: 26, height: 26, borderRadius: 13, background: hex(p.wall), border: sel === n ? "3px solid #3a3550" : "2px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", cursor: locked ? "default" : "pointer", transform: sel === n ? "scale(1.15)" : "none", opacity: locked ? 0.35 : 1, fontSize: 10, lineHeight: "22px", color: "#3a3550" }}>{locked ? "🔒" : ""}</button>); })}
                </div>
              ) : (
                <div style={{ ...panel, padding: "8px 10px", display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap", justifyContent: "center", maxWidth: 760 }}>
                  {s.props.map((d) => (
                    <button key={d.id} onClick={() => d.open && engRef.current.setProp(d.id)} title={d.open ? `${d.name} · ${d.cost} shells · ${d.where === "water" ? "on the water next to a house" : "on a rooftop"}` : `Unlocks at level ${d.lvl}`}
                      style={{ ...btn, padding: "5px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 58, background: s.propSel === d.id ? "#3a3550" : "rgba(255,255,255,0.75)", color: s.propSel === d.id ? "#fff" : "#3a3550", opacity: d.open ? (d.afford ? 1 : 0.6) : 0.4, boxShadow: "none" }}>
                      <span style={{ fontSize: 18 }}>{d.open ? d.icon : "🔒"}</span><span style={{ fontSize: 10 }}>{d.open ? d.name : `Level ${d.lvl}`}</span><span style={{ fontSize: 10, opacity: 0.8 }}>{d.open ? `${d.cost} 🐚` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", textShadow: "0 1px 3px rgba(0,0,0,0.5)", textAlign: "center" }}>{s.mode === "build" ? "Click water or a house to build · right-click (or Shift+click) removes · drag to look around · scroll to zoom" : "Click a rooftop (or the water by the town for boats) to place · click a decoration again to take it back (shells refunded)"}</div>
            </div>

            {/* toasts */}
            <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", pointerEvents: "none" }}>
              {toasts.map((t) => <div key={t.id} style={{ ...panel, padding: "8px 16px", fontSize: 13, fontWeight: 600, animation: "tsin .3s ease-out" }}>{t.msg}</div>)}
            </div>

            {/* level-ups and discoveries, one at a time */}
            {queue.length > 0 && (() => { const e = queue[0]; const close = () => setQueue((q) => q.slice(1)); return (
              <div style={{ position: "absolute", inset: 0, background: "rgba(30,20,60,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9 }} onClick={close}>
                <div style={{ ...panel, padding: "24px 30px", textAlign: "center", maxWidth: 380, animation: "tsin .4s ease-out" }} onClick={(ev) => ev.stopPropagation()}>
                  {e.type === "level" ? (<>
                    <div style={{ fontSize: 12, letterSpacing: 3, opacity: 0.6 }}>LEVEL UP</div>
                    <div style={{ fontSize: 54, fontWeight: 800, color: "#e9a23b", lineHeight: 1.1 }}>{e.level}</div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: "#b5503f", marginBottom: 10 }}>{e.title}</div>
                    {e.unlocks.length ? <div style={{ fontSize: 13, marginBottom: 6 }}>Unlocked:</div> : <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Keep building, something new arrives next level.</div>}
                    {e.unlocks.map((u, n) => <div key={n} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", fontSize: 14, marginBottom: 4 }}>{u.kind === "colour" ? <span style={{ width: 16, height: 16, borderRadius: 8, background: hex(u.hex), display: "inline-block", border: "2px solid #fff" }} /> : <span>{u.icon}</span>}<b>{u.name}</b><span style={{ opacity: 0.6, fontSize: 12 }}>{u.kind === "island" ? "new island" : u.kind}</span></div>)}
                  </>) : (<>
                    <div style={{ fontSize: 12, letterSpacing: 3, opacity: 0.6 }}>NEW DISCOVERY</div>
                    <div style={{ fontSize: 40 }}>📖</div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#b5503f", margin: "4px 0 6px" }}>{e.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>{e.hint}</div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>+150 XP · +20 🐚 · added to your album</div>
                  </>)}
                  <button style={{ ...btn, marginTop: 14, background: "#e9a23b", color: "#fff", border: "none", padding: "9px 18px" }} onClick={close}>Lovely ▸</button>
                </div>
              </div>); })()}

            {album && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(30,20,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9 }} onClick={() => setAlbum(false)}>
                <div style={{ ...panel, padding: "18px 22px", maxWidth: 720, width: "92%", maxHeight: "86%", overflowY: "auto" }} onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h3 style={{ margin: 0, fontFamily: "Georgia, serif", color: "#b5503f" }}>Album of Discoveries</h3><span style={{ fontSize: 12, opacity: 0.7 }}>{s.found.filter((d) => d.found).length} / {s.found.length}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, marginTop: 12 }}>
                    {s.found.map((d) => <div key={d.id} style={{ borderRadius: 10, padding: "10px 10px", background: d.found ? "linear-gradient(160deg,#fff7e6,#ffe7c2)" : "rgba(58,53,80,.06)", border: d.found ? "1px solid #e9a23b" : "1px dashed rgba(58,53,80,.25)" }}><div style={{ fontWeight: 700, fontSize: 13, color: d.found ? "#b5503f" : "rgba(58,53,80,.55)" }}>{d.found ? "✦ " + d.name : "? ? ?"}</div><div style={{ fontSize: 11, opacity: 0.75, marginTop: 3 }}>{d.hint}</div></div>)}
                  </div>
                  <button style={{ ...btn, marginTop: 12 }} onClick={() => setAlbum(false)}>Close</button>
                </div>
              </div>
            )}

            {mapOpen && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(30,20,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9 }} onClick={() => setMapOpen(false)}>
                <div style={{ ...panel, padding: "18px 22px", maxWidth: 760, width: "92%", maxHeight: "86%", overflowY: "auto" }} onClick={(ev) => ev.stopPropagation()}>
                  <h3 style={{ margin: 0, fontFamily: "Georgia, serif", color: "#b5503f" }}>The Islands</h3>
                  <p style={{ fontSize: 12, opacity: 0.75, margin: "4px 0 10px" }}>Every island keeps its own town. Your level, shells and album travel with you.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
                    {s.islands.map((x) => (
                      <div key={x.id} style={{ borderRadius: 12, padding: 12, background: x.here ? "linear-gradient(160deg,#fff3dc,#ffe0b8)" : x.open ? "rgba(255,255,255,.75)" : "rgba(58,53,80,.06)", border: x.here ? "2px solid #e9a23b" : "1px solid rgba(58,53,80,.15)" }}>
                        <div style={{ fontWeight: 700, color: x.open ? "#b5503f" : "rgba(58,53,80,.5)" }}>{x.open ? "🏝️ " : "🔒 "}{x.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.75, margin: "4px 0 8px", minHeight: 30 }}>{x.blurb}</div>
                        {x.here ? <span style={{ fontSize: 11, fontWeight: 700 }}>You are here · {x.houses} blocks</span> : x.open ? <button style={{ ...btn, background: "#e9a23b", color: "#fff", border: "none" }} onClick={() => { engRef.current.sailTo(x.id); setMapOpen(false); }}>⛵ Sail here{x.houses ? ` · ${x.houses} blocks` : ""}</button> : <span style={{ fontSize: 11 }}>Reach level {x.lvl}</span>}
                      </div>
                    ))}
                  </div>
                  <button style={{ ...btn, marginTop: 12 }} onClick={() => setMapOpen(false)}>Close</button>
                </div>
              </div>
            )}

            {confirm && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(30,20,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8 }}>
                <div style={{ ...panel, padding: "22px 28px", textAlign: "center", maxWidth: 360 }}>
                  <h3 style={{ margin: "0 0 6px", fontFamily: "Georgia, serif", fontSize: 22, color: "#b5503f" }}>Finish your town?</h3>
                  <p style={{ fontSize: 14, margin: "0 0 4px" }}>Your town has <b>{s.charm.toLocaleString()}</b> charm.</p>
                  <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 16px" }}>It's saved on this device, so you can come back and keep building any time.</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button style={{ ...btn, background: "#e9a23b", color: "#fff", border: "none", padding: "10px 16px" }} onClick={finish}>Submit my score</button>
                    <button style={{ ...btn, padding: "10px 16px" }} onClick={() => setConfirm(false)}>Keep building</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Controls() {
  const row = (k, v) => <div style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: 5, textAlign: "left" }}><b style={{ minWidth: 96, color: "#b5503f" }}>{k}</b><span>{v}</span></div>;
  return (
    <div style={{ marginTop: 14 }}>
      {row("Click water", "raise a new house")}
      {row("Click a house", "build on top, or beside it (even out over the water for a bridge)")}
      {row("Right-click", "take a house away (Shift + click also works)")}
      {row("Drag", "turn the view · right-drag to slide")}
      {row("Scroll", "zoom in and out")}
      {row("W A S D / Q E", "slide the view / turn it")}
      {row("1–9, 0", "pick a colour · ✦ Mix picks for you")}
      {row("N · Ctrl+Z", "day or night · undo")}
      {row("Decorate", "pick a decoration at the bottom, then click a rooftop (boats: the water next to a house)")}
      {row("Wishes", "townsfolk ask for things; finish them for XP and shells")}
      {row("📖 · 🗺️", "your album of discoveries · sail to other islands")}
    </div>
  );
}
