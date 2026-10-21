"use client";

// Ashtide (this game's slug is still "kingdomsofash") — a calm, Townscaper-style town builder.
// Build colourful harbour houses on the water, grow towers and gardens, finish when you like.
import { useEffect, useRef, useState } from "react";
import { createEngine } from "@/kingdoms/engine/engine";
import { PALETTE } from "@/kingdoms/engine/build";
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

  useEffect(() => {
    let eng;
    try {
      eng = createEngine({
        mount: mountRef.current,
        onState: (st) => setS(st),
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
                {saved && <button onClick={() => begin(true)} style={{ ...btn, background: "#e9a23b", color: "#fff", fontSize: 15, padding: "12px 14px", border: "none" }}>Continue your town · {saved.houses} blocks</button>}
                <button onClick={() => begin(false)} style={{ ...btn, background: saved ? "rgba(255,255,255,0.9)" : "#e9a23b", color: saved ? "#3a3550" : "#fff", fontSize: 15, padding: "12px 14px", border: saved ? undefined : "none" }}>{saved ? "Start a fresh town" : "Start building"}</button>
                <button onClick={() => setHelp((h) => !h)} style={{ ...btn, background: "transparent", border: "none", boxShadow: "none", textDecoration: "underline" }}>{help ? "Hide controls" : "How to play"}</button>
              </div>
              {help && <Controls />}
            </div>
          </div>
        )}

        {playing && s && (
          <>
            {/* top left: charm + goals */}
            <div style={{ position: "absolute", top: 10, left: 10, width: 232, animation: "tsin .4s ease-out" }}>
              <div style={{ ...panel, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "#b5503f", fontWeight: 700 }}>Ashtide</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{s.houses} blocks · {s.colors} colours</span>
                </div>
                <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.6, marginTop: 4 }}>TOWN CHARM</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#3a3550", lineHeight: 1.05 }}>{s.charm.toLocaleString()}</div>
              </div>
              <div style={{ ...panel, marginTop: 8, padding: "8px 12px" }}>
                <button onClick={() => setGoalsOpen((o) => !o)} style={{ all: "unset", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontWeight: 700, opacity: 0.7, width: "100%", display: "flex", justifyContent: "space-between" }}>
                  <span>LITTLE GOALS · {s.goals.filter((g) => g.done).length}/{s.goals.length}</span><span>{goalsOpen ? "–" : "+"}</span>
                </button>
                {goalsOpen && <div style={{ marginTop: 8, maxHeight: stage.isFull ? "46vh" : "30vh", overflowY: "auto" }}>{s.goals.filter((g) => !g.done).slice(0, 3).map((g) => <Goal key={g.id} g={g} />)}{s.goals.filter((g) => g.done).slice(-2).map((g) => <Goal key={g.id} g={g} />)}</div>}
              </div>
            </div>

            {/* top right: tools */}
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "62%" }}>
              <button style={btn} onClick={() => engRef.current.undo()} disabled={!s.canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
              <button style={btn} onClick={() => engRef.current.toggleNight()} title="Day / night (N)">{s.night > 0.5 ? "☀ Day" : "☾ Night"}</button>
              <button style={btn} onClick={photo} title="Save a picture">📷</button>
              <button style={btn} onClick={toggleMusic} title="Music">{musicOn ? "♪" : "♪̸"}</button>
              <button style={btn} onClick={() => setHelp((h) => !h)} title="Controls">?</button>
              <button style={{ ...btn, background: "#e9a23b", color: "#fff", border: "none" }} onClick={() => setConfirm(true)}>Finish town ▸</button>
            </div>

            {help && <div style={{ position: "absolute", top: 56, right: 10, width: 300, zIndex: 5 }}><div style={{ ...panel, padding: "12px 16px" }}><Controls /></div></div>}

            {/* bottom: colour picker */}
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: "96%" }}>
              <div style={{ ...panel, padding: "8px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={() => engRef.current.setColour(-1)} title="Mix colours automatically (Alt+A)" style={{ ...btn, padding: "5px 9px", background: sel < 0 ? "#3a3550" : "rgba(255,255,255,0.7)", color: sel < 0 ? "#fff" : "#3a3550", boxShadow: "none" }}>✦ Mix</button>
                {PALETTE.map((p, n) => (
                  <button key={p.name} onClick={() => engRef.current.setColour(n)} title={`${p.name} (${n + 1 === 10 ? 0 : n + 1})`} aria-label={p.name}
                    style={{ width: 26, height: 26, borderRadius: 13, background: hex(p.wall), border: sel === n ? "3px solid #3a3550" : "2px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", cursor: "pointer", transform: sel === n ? "scale(1.18)" : "none", transition: "transform .12s" }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", textShadow: "0 1px 3px rgba(0,0,0,0.5)", textAlign: "center" }}>Click water or a house to build · right-click (or Shift+click) removes · drag to look around · scroll to zoom</div>
            </div>

            {/* toasts */}
            <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", pointerEvents: "none" }}>
              {toasts.map((t) => <div key={t.id} style={{ ...panel, padding: "8px 16px", fontSize: 13, fontWeight: 600, animation: "tsin .3s ease-out" }}>{t.msg}</div>)}
            </div>

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
    </div>
  );
}
