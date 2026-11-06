"use client";

// Story mode screens for Midnight Burn: "THE LAST GHOST" (Upgrade 61). The director (engine/open/story.js) runs the scenes on the live
// city; this file only draws: letterbox dialogue, the dashcam "found footage" look, title cards, mission objectives, the tailing meter,
// the pass / fail cards, and the story panel on the menu.
import { useEffect, useMemo, useState } from "react";
import { CHAPTERS, FOOTAGE_TOTAL, STORY_TAG, storyScenes } from "@/midnightburn/engine/open/story";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const DISPLAY = "Impact, 'Arial Black', sans-serif";

function useNoise() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d"); const im = x.createImageData(160, 160);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0); setUrl(c.toDataURL());
    } catch {}
  }, []);
  return url;
}

function Typed({ text, shown, color = "#fff" }) {
  return (
    <span style={{ color }}>
      {text.slice(0, shown)}
      <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
    </span>
  );
}

function Speaker({ line, small }) {
  const tag = line.phone ? "◉ PHONE" : line.tape ? "▶ TAPE" : line.role;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: small ? 4 : 8 }}>
      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: small ? 11 : 13, letterSpacing: ".22em", color: line.color, textShadow: `0 0 12px ${line.color}88` }}>{line.name}</span>
      {tag && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".2em", color: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 4, padding: "1px 6px" }}>{tag}</span>}
      {line.speaking && <span aria-hidden style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 12 }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 12, background: line.color, borderRadius: 1, transformOrigin: "bottom", animation: `sgEq .${5 + i}s ${i * 0.09}s ease-in-out infinite alternate` }} />)}</span>}
    </div>
  );
}

export default function StoryLayer({ ui, onAdvance, onSkip, onExit, onVoice }) {
  const noise = useNoise();
  if (!ui) return null;
  const k = ui.kind;
  const cinematic = k === "talk" || k === "dash" || k === "card" || k === "end" || k === "busy";
  const css = `
    @keyframes sgRise{0%{opacity:0;transform:translateY(18px);letter-spacing:.6em}100%{opacity:1;transform:none;letter-spacing:.16em}}
    @keyframes sgSlam{0%{opacity:0;transform:scale(1.6);filter:blur(12px)}60%{opacity:1;transform:scale(.98);filter:blur(0)}100%{transform:scale(1)}}
    @keyframes sgBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
    @keyframes sgPulse{0%,100%{opacity:.55}50%{opacity:1}}
    @keyframes sgNoise{0%{background-position:0 0}25%{background-position:-40px 30px}50%{background-position:60px -20px}75%{background-position:-20px -50px}100%{background-position:30px 10px}}
    @keyframes sgTear{0%,86%,100%{transform:translateX(0);opacity:0}88%{transform:translateX(-14px);opacity:.9}91%{transform:translateX(10px);opacity:.7}94%{opacity:0}}
    @keyframes sgBar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
    @keyframes sgWarn{0%,100%{opacity:1}50%{opacity:.35}}
    @keyframes sgEq{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
  `;
  const GRADE = { amber: "sepia(.85) saturate(1.25) hue-rotate(-14deg) contrast(1.1) brightness(1.04)", blue: "grayscale(.5) sepia(.4) hue-rotate(170deg) saturate(1.3) contrast(1.12) brightness(.95)", red: "sepia(.7) saturate(1.9) hue-rotate(-32deg) contrast(1.12)" };
  const GRADE_COL = { amber: "#ffc04a", blue: "#7fc8ff", red: "#ff5a4a" };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 58, pointerEvents: cinematic || ui.result ? "auto" : "none", userSelect: "none", overflow: "hidden" }} onClick={cinematic || (ui.result && ui.result.ready) ? onAdvance : undefined}>
      <style>{css}</style>

      {/* ---- memory scenes: the night as one witness remembers it ---- */}
      {ui.grade && k !== "busy" && (
        <>
          <div style={{ position: "absolute", inset: 0, backdropFilter: GRADE[ui.grade.tint] || GRADE.amber, WebkitBackdropFilter: GRADE[ui.grade.tint] || GRADE.amber, pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,.55) 100%)", pointerEvents: "none" }} />
          {noise && <div style={{ position: "absolute", inset: "-60px", backgroundImage: `url(${noise})`, opacity: 0.05, mixBlendMode: "screen", animation: "sgNoise .4s steps(4) infinite", pointerEvents: "none" }} />}
          <div style={{ position: "absolute", left: 0, right: 0, top: k === "talk" ? "calc(11% + 16px)" : 96, textAlign: "center", fontFamily: MONO, fontSize: 12, letterSpacing: ".4em", color: GRADE_COL[ui.grade.tint] || "#ffc04a", textShadow: "0 0 10px #000", animation: "sgPulse 2.4s infinite", pointerEvents: "none" }}>◆ {ui.grade.label} ◆</div>
        </>
      )}

      {/* ---- dashcam footage ---- */}
      {k === "dash" && ui.dash && (
        <>
          <div style={{ position: "absolute", inset: 0, backdropFilter: "saturate(0.4) contrast(1.28) brightness(0.9) sepia(0.28) hue-rotate(-8deg)", WebkitBackdropFilter: "saturate(0.4) contrast(1.28) brightness(0.9) sepia(0.28)" }} />
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0px, rgba(0,0,0,.22) 1px, transparent 2px, transparent 4px)", mixBlendMode: "multiply" }} />
          {noise && <div style={{ position: "absolute", inset: "-60px", backgroundImage: `url(${noise})`, opacity: 0.09 + ui.dash.flash * 0.6, mixBlendMode: "screen", animation: "sgNoise .28s steps(4) infinite" }} />}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.75) 100%)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: "38%", height: 18, background: "rgba(255,255,255,.08)", animation: "sgTear 3.1s infinite" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: "71%", height: 9, background: "rgba(140,220,255,.10)", animation: "sgTear 4.3s 1.2s infinite" }} />
          <div style={{ position: "absolute", left: 28, top: 22, fontFamily: MONO, fontSize: 16, fontWeight: 800, color: "#ff3b3b", letterSpacing: ".18em", textShadow: "0 0 8px #000" }}><span style={{ animation: "sgBlink 1s infinite" }}>●</span> REC</div>
          <div style={{ position: "absolute", right: 28, top: 22, fontFamily: MONO, fontSize: 13, color: "rgba(255,255,255,.85)", letterSpacing: ".2em", textShadow: "0 0 6px #000" }}>CAM 1 · FRONT</div>
          {ui.dash.label && <div style={{ position: "absolute", left: 0, right: 0, top: 22, textAlign: "center", fontFamily: MONO, fontSize: 12, color: "#6bff9a", letterSpacing: ".3em", textShadow: "0 0 8px #000" }}>{ui.dash.label}</div>}
          <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: MONO, fontSize: 15, color: "rgba(255,255,255,.9)", letterSpacing: ".15em", textShadow: "0 0 6px #000" }}>{String(ui.dash.kmh).padStart(3, "0")} KM/H</div>
          <div style={{ position: "absolute", right: 28, bottom: 22, fontFamily: MONO, fontSize: 15, color: "rgba(255,255,255,.9)", letterSpacing: ".12em", textShadow: "0 0 6px #000" }}>{ui.dash.clock}</div>
          {ui.line && (
            <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "13%", textAlign: "center" }}>
              <div style={{ display: "inline-block", background: "rgba(0,0,0,.55)", padding: "10px 18px", borderRadius: 6, maxWidth: 900 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".25em", color: ui.line.color, marginBottom: 4 }}>{ui.line.name}</div>
                <div style={{ fontFamily: MONO, fontSize: "min(2.1vw, 20px)", lineHeight: 1.45, color: "#fff" }}><Typed text={ui.line.text} shown={ui.line.shown} /></div>
              </div>
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: Math.min(1, ui.dash.flash * 1.6) * (ui.dash.flash < 0.7 ? 1 : 0) }} />
          {ui.dash.flash >= 0.7 && <div style={{ position: "absolute", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, color: "rgba(255,255,255,.75)", letterSpacing: ".4em", fontSize: 14 }}>SIGNAL LOST</div>}
        </>
      )}

      {/* ---- letterbox dialogue ---- */}
      {k === "talk" && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "11%", background: "#000", transformOrigin: "top", animation: "sgBar .7s ease-out both" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "24%", background: "linear-gradient(180deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.86) 26%, #000 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.5) 100%)" }} />
          {ui.place && <div style={{ position: "absolute", left: 32, top: "calc(11% + 18px)", fontFamily: MONO, fontSize: 12, letterSpacing: ".32em", color: "rgba(255,255,255,.75)", textShadow: "0 0 8px #000", animation: "sgRise 1.4s ease-out both" }}>{ui.place}</div>}
          {ui.line && (
            <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "5%", maxWidth: 1040, margin: "0 auto" }}>
              <Speaker line={ui.line} />
              <div style={{ fontFamily: MONO, fontSize: "min(2.2vw, 21px)", lineHeight: 1.5, color: "#f2f2f5", minHeight: "3em" }}>
                {ui.line.phone || ui.line.who === "static" ? <span style={{ color: "rgba(255,255,255,.45)" }}>“</span> : null}
                <Typed text={ui.line.text} shown={ui.line.shown} />
                {ui.line.phone || ui.line.who === "static" ? <span style={{ color: "rgba(255,255,255,.45)" }}>”</span> : null}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: MONO, fontSize: 10, letterSpacing: ".25em", color: "rgba(255,255,255,.45)" }}>
                <span>{ui.line.i + 1} / {ui.line.n}</span>
                <span style={{ animation: ui.line.shown >= ui.line.text.length ? "sgPulse 1.1s infinite" : "none", color: ui.line.shown >= ui.line.text.length ? "#fff" : "rgba(255,255,255,.35)" }}>ENTER ▸</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- title cards ---- */}
      {(k === "card" || k === "end") && ui.card && (
        <div style={{ position: "absolute", inset: 0, background: k === "end" ? "rgba(0,0,0,.82)" : "rgba(0,0,0,.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 6%" }}>
          {ui.card.kicker && <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: ".5em", color: "#ffb347", marginBottom: 18, animation: "sgRise 1.2s ease-out both" }}>{ui.card.kicker}</div>}
          <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: "min(9vw, 13vh)", lineHeight: 1, color: "#fff", animation: "sgSlam .9s cubic-bezier(.2,.9,.2,1) both", textShadow: "0 0 22px rgba(255,255,255,.35), 0 0 60px rgba(45,226,255,.35), 4px 4px 0 rgba(255,45,149,.55)" }}>{ui.card.big}</div>
          {ui.card.sub && <div style={{ marginTop: 22, fontFamily: MONO, fontWeight: 700, fontSize: "min(1.8vw, 16px)", letterSpacing: ".35em", color: "#2de2ff", animation: "sgRise 1.6s .4s ease-out both" }}>{ui.card.sub}</div>}
          {ui.card.end && (
            <>
              {ui.card.note && <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 13, color: "rgba(255,255,255,.6)" }}>{ui.card.note}</div>}
              <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 12, letterSpacing: ".3em", color: "#6bff9a" }}>FOOTAGE RECOVERED · {ui.footage} / {ui.footageTotal}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
                {ui.card.nextCh ? <button type="button" onClick={(e) => { e.stopPropagation(); onAdvance && onAdvance(); }} style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: ".2em", fontSize: 13, padding: "12px 26px", borderRadius: 10, border: "none", cursor: "pointer", color: "#0b0b14", background: "linear-gradient(135deg, #2de2ff, #ff2d95)" }}>CHAPTER {ui.card.nextCh} ▸ {ui.card.nextTitle}</button> : null}
                <button type="button" onClick={(e) => { e.stopPropagation(); onExit && onExit(); }} style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: ".2em", fontSize: 13, padding: "12px 26px", borderRadius: 10, cursor: "pointer", color: ui.card.nextCh ? "#fff" : "#0b0b14", border: ui.card.nextCh ? "1px solid rgba(255,255,255,.35)" : "none", background: ui.card.nextCh ? "rgba(0,0,0,.4)" : "linear-gradient(135deg, #ff2d95, #ffb347)" }}>{ui.card.final ? "BACK TO THE CITY ▸" : "BACK TO MENU"}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- black dips between scenes ---- */}
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: k === "busy" ? 1 : k === "card" || k === "end" ? 0 : ui.fade || 0, pointerEvents: "none", transition: k === "busy" ? "opacity .25s" : "none" }} />
      {k === "busy" && <div style={{ position: "absolute", left: 0, right: 0, bottom: "45%", textAlign: "center", fontFamily: MONO, fontSize: 11, letterSpacing: ".5em", color: "rgba(255,255,255,.4)", animation: "sgPulse 1.2s infinite" }}>· · ·</div>}

      {/* ---- missions ---- */}
      {ui.obj && !ui.result && (
        <div style={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ display: "inline-block", background: "rgba(5,4,14,.72)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 16px", backdropFilter: "blur(4px)" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".35em", color: "#ffb347" }}>{ui.obj.title}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: "#fff", marginTop: 3 }}>{ui.obj.text}</div>
            {ui.obj.d != null && !ui.obj.gap && <div style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 3 }}>{ui.obj.d >= 1000 ? (ui.obj.d / 1000).toFixed(1) + " km" : ui.obj.d + " m"}{ui.obj.slow ? " · SLOW DOWN TO STOP" : ""}</div>}
            {ui.obj.left != null && <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 20, marginTop: 4, color: ui.obj.left < 15 ? "#ff2d55" : "#ffb347", animation: ui.obj.left < 15 ? "sgWarn .5s infinite" : "none" }}>{Math.floor(ui.obj.left / 60)}:{String(Math.floor(ui.obj.left % 60)).padStart(2, "0")}</div>}
            {ui.obj.gap && (
              <div style={{ marginTop: 6, width: 300 }}>
                <div style={{ height: 8, borderRadius: 5, background: "rgba(255,255,255,.12)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, ((ui.obj.d || 0) / ui.obj.gap) * 100)}%`, background: ui.obj.clear > 0 ? "#6bff9a" : "linear-gradient(90deg,#ff2d55,#ffb347)" }} /></div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,.6)", marginTop: 3, letterSpacing: ".15em" }}>CLOSEST HUNTER · {ui.obj.d != null ? ui.obj.d + " m" : "—"} / {ui.obj.gap} m{ui.obj.clear > 0 ? " · HOLD IT" : ""}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {ui.tail && !ui.result && (
        <div style={{ position: "absolute", left: "50%", bottom: 104, transform: "translateX(-50%)", width: 340, pointerEvents: "none", textAlign: "center" }}>
          <div style={{ position: "relative", height: 10, borderRadius: 6, background: "linear-gradient(90deg, #ff2d55 0%, #ff2d55 10%, #6bff9a 10%, #6bff9a 86%, #ffb347 86%)", opacity: 0.85 }}>
            {ui.tail.d != null && <div style={{ position: "absolute", top: -4, width: 4, height: 18, borderRadius: 2, background: "#fff", boxShadow: "0 0 8px #fff", left: `${Math.max(0, Math.min(100, (ui.tail.d / (ui.tail.far * 1.16)) * 100))}%` }} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,.5)", marginTop: 3, letterSpacing: ".15em" }}><span>TOO CLOSE</span><span>{ui.tail.d != null ? ui.tail.d + " m" : ""}</span><span>LOSING</span></div>
          {ui.tail.warn && <div style={{ marginTop: 6, fontFamily: MONO, fontWeight: 800, fontSize: 14, letterSpacing: ".3em", color: ui.tail.warn === "TOO CLOSE" ? "#ff2d55" : "#ffb347", animation: "sgWarn .5s infinite", textShadow: "0 0 10px #000" }}>{ui.tail.warn}</div>}
        </div>
      )}
      {ui.radio && (
        <div style={{ position: "absolute", left: "50%", bottom: 110, transform: "translateX(-50%)", maxWidth: 620, width: "52%", pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,.66)", borderLeft: `3px solid ${ui.radio.color}`, padding: "8px 14px", borderRadius: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".25em", color: ui.radio.color, marginBottom: 3 }}>{ui.radio.phone ? "◉ " : "📻 "}{ui.radio.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: "#fff" }}>{ui.radio.text}</div>
          </div>
        </div>
      )}
      {ui.result && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.62)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: "min(7vw, 10vh)", color: ui.result.good ? "#6bff9a" : "#ff2d75", animation: "sgSlam .7s both", textShadow: `0 0 26px ${ui.result.good ? "#6bff9a" : "#ff2d75"}88` }}>{ui.result.title}</div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 15, color: "rgba(255,255,255,.8)" }}>{ui.result.text}</div>
          {ui.result.good && <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 11, letterSpacing: ".3em", color: "#6bff9a" }}>FOOTAGE · {ui.footage} / {ui.footageTotal}</div>}
          <div style={{ marginTop: 28, fontFamily: MONO, fontSize: 12, letterSpacing: ".3em", color: "#fff", opacity: ui.result.ready ? 1 : 0, animation: "sgPulse 1.1s infinite" }}>ENTER ▸ {ui.result.good ? "CONTINUE" : "RETRY"}</div>
        </div>
      )}

      {/* ---- voices on / off ---- */}
      {ui.voice && ui.voice.available && k !== "busy" && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onVoice && onVoice(); }} style={{ position: "absolute", left: 18, top: k === "talk" ? "calc(11% + 44px)" : k === "dash" ? 54 : cinematic ? 18 : 120, fontFamily: MONO, fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.35)", background: "rgba(0,0,0,.55)", color: "#fff", cursor: "pointer", letterSpacing: ".15em", pointerEvents: "auto", zIndex: 3 }}>{ui.voice.on ? "🔊 VOICES ON" : "🔇 VOICES OFF"} <span style={{ opacity: 0.55 }}>(V)</span></button>
      )}

      {/* ---- skip ---- */}
      {(k === "talk" || k === "dash" || k === "card") && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onSkip && onSkip(); }} style={{ position: "absolute", right: 18, top: k === "talk" ? "calc(11% + 14px)" : k === "dash" ? 54 : 18, fontFamily: MONO, fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.35)", background: "rgba(0,0,0,.55)", color: "#fff", cursor: "pointer", letterSpacing: ".15em" }}>SKIP SCENE ▸▸ <span style={{ opacity: 0.55 }}>(TAB)</span></button>
      )}
    </div>
  );
}

// ---- the story panel on the Midnight Burn menu ------------------------------------------------------------------------------------------------
export function StoryMenuCard({ save, onPlay, onRestart }) {
  // onPlay(chapter | undefined): undefined = carry on from the save; a number = play that chapter from its start
  const st = save && save.story; const cleared = (st && st.cleared) || (st && st.done ? { 1: true } : {});
  const cur = st ? Math.max(1, Math.min(CHAPTERS.length, st.ch || 1)) : 1; const at = st ? st.at || 0 : 0; const all = !!(st && st.done);
  const n = useMemo(() => storyScenes(cur).length, [cur]);
  const open = (c) => c === 1 || !!cleared[c] || !!cleared[c - 1] || c <= cur; // a chapter is open once the one before it is finished
  const pctAll = Math.round((Object.keys(cleared).length / CHAPTERS.length) * 100);
  const label = all ? "REPLAY THE STORY ▸" : at > 0 ? `CONTINUE · CHAPTER ${cur} ▸` : cur > 1 ? `PLAY CHAPTER ${cur} ▸` : "PLAY CHAPTER 1 ▸";
  return (
    <div className="rounded-2xl border p-4 md:p-6 mb-5 relative overflow-hidden" style={{ borderColor: "rgba(255,255,255,.14)", background: "radial-gradient(ellipse at 90% 0%, rgba(45,226,255,.16), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(255,45,149,.14), transparent 55%), linear-gradient(160deg, #0d0a1c, #06050d)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0px, rgba(255,255,255,.025) 1px, transparent 2px, transparent 4px)" }} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] tracking-[0.4em] mb-2" style={{ color: "#ff3b3b" }}>● STORY MODE · 6 CHAPTERS · FULLY VOICED</p>
          <h3 style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 38, lineHeight: 1, color: "#fff", textShadow: "0 0 24px rgba(45,226,255,.35), 3px 3px 0 rgba(255,45,149,.5)" }}>THE LAST GHOST</h3>
          <p className="font-mono text-[12px] text-white/70 mt-3 leading-relaxed">{STORY_TAG} Rebuild the lost dashcam footage, chapter by chapter, and find out what really happened that night.</p>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {CHAPTERS.map((c) => { const ok = open(c.n), done = !!cleared[c.n]; return (
              <button key={c.n} disabled={!ok} onClick={() => ok && onPlay(c.n)} title={ok ? `Play chapter ${c.n} from the start` : "Finish the chapter before to unlock"} className="font-mono rounded border transition" style={{ fontSize: 9, letterSpacing: ".12em", padding: "4px 8px", cursor: ok ? "pointer" : "default", borderColor: done ? "rgba(107,255,154,.55)" : ok ? "rgba(45,226,255,.5)" : "rgba(255,255,255,.12)", color: done ? "#6bff9a" : ok ? "#9fefff" : "rgba(255,255,255,.35)", background: c.n === cur && !all ? "rgba(45,226,255,.08)" : "transparent" }}>{done ? "✓ " : ok ? "" : "🔒 "}{c.n}. {c.title}</button>); })}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2" style={{ minWidth: 260 }}>
          <div className="font-mono text-[10px] text-white/50 tracking-[0.2em]">STORY · {pctAll}%{st ? ` · FOOTAGE ${st.footage || 0}/${FOOTAGE_TOTAL}` : ""}</div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${pctAll}%`, background: "linear-gradient(90deg,#2de2ff,#ff2d95)" }} /></div>
          <button onClick={() => onPlay(all ? 1 : undefined)} className="font-pixel rounded-xl transition hover:brightness-110" style={{ marginTop: 4, padding: "15px 22px", fontSize: 11, letterSpacing: ".12em", whiteSpace: "nowrap", background: "linear-gradient(135deg, #2de2ff, #ff2d95)", color: "#0b0b14", boxShadow: "0 8px 30px rgba(45,226,255,.3)" }}>{label}</button>
          {st && at > 0 && !all && <button onClick={onRestart} className="font-mono rounded-lg border border-white/15 text-white/60 hover:text-white" style={{ padding: "8px 12px", fontSize: 10, letterSpacing: ".2em" }}>RESTART CHAPTER {cur}</button>}
          <p className="font-mono text-white/40" style={{ fontSize: 9, letterSpacing: ".1em" }}>{n} scenes in chapter {cur} · voices use your browser's speech</p>
        </div>
      </div>
    </div>
  );
}
