"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

// The premium frame every quick arcade game plays inside: glowing accent frame, a header with your best score,
// a proper ready screen + 3-2-1 countdown (so a round never starts before you are ready), tap ripples with a
// little haptic buzz, and a fullscreen button. The game itself is mounted only after the countdown.
export default function PremiumShell({ slug, name, icon, tagline, accentColor, best, runKey, muted, onMute, onExit, onPlayStart, children }) {
  const [phase, setPhase] = useState("ready"); // ready | count | play
  const [n, setN] = useState(3); const [ripples, setRipples] = useState([]); const [full, setFull] = useState(false);
  const first = useRef(true); const box = useRef(null);

  useEffect(() => { if (first.current) { first.current = false; return; } setPhase("count"); setN(3); }, [runKey]);
  useEffect(() => {
    if (phase !== "count") return;
    if (n === 0) { sfx.levelUp(); const t = setTimeout(() => { onPlayStart && onPlayStart(); setPhase("play"); }, 350); return () => clearTimeout(t); }
    sfx.tap(); haptics.tap();
    const t = setTimeout(() => setN((x) => x - 1), 720); return () => clearTimeout(t);
  }, [phase, n]);
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);

  const down = (e) => {
    if (phase !== "play" || !box.current) return;
    const r = box.current.getBoundingClientRect(); const id = Math.random();
    setRipples((p) => [...p.slice(-5), { id, x: e.clientX - r.left, y: e.clientY - r.top }]); setTimeout(() => setRipples((p) => p.filter((q) => q.id !== id)), 650);
    if (e.target.closest && e.target.closest("button")) haptics.tap();
  };
  const toggleFull = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else box.current && box.current.requestFullscreen && box.current.requestFullscreen(); } catch {} };
  const start = () => { sfx.click(); setPhase("count"); setN(3); };

  return (
    <div ref={box} onPointerDown={down} className="relative rounded-2xl overflow-hidden" style={{ background: `linear-gradient(160deg, ${accentColor}55, rgba(255,255,255,0.06) 40%, ${accentColor}33)`, padding: 1, boxShadow: `0 0 40px -12px ${accentColor}99, 0 20px 60px -30px #000` }}>
      <div className="relative rounded-[15px] bg-bgPanel overflow-hidden" style={{ background: `radial-gradient(120% 80% at 50% -10%, ${accentColor}22, transparent 60%), #150b33` }}>
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-black/20">
          <span className="text-lg" aria-hidden>{icon}</span>
          <div className="min-w-0 flex-1"><p className="font-display font-bold text-sm leading-tight truncate" style={{ color: accentColor }}>{name}</p>
            <p className="font-mono text-[10px] text-textDim">{best > 0 ? <>Your best <span className="text-gold font-semibold">{best.toLocaleString()}</span></> : "Set your first score"}</p></div>
          <button type="button" onClick={onMute} aria-label={muted ? "Unmute sound" : "Mute sound"} className="w-8 h-8 rounded-lg border border-white/10 text-sm hover:bg-white/10">{muted ? "🔇" : "🔊"}</button>
          <button type="button" onClick={toggleFull} aria-label={full ? "Exit fullscreen" : "Fullscreen"} className="w-8 h-8 rounded-lg border border-white/10 text-sm hover:bg-white/10">{full ? "🗗" : "⛶"}</button>
          <button type="button" onClick={onExit} aria-label="Exit game" className="w-8 h-8 rounded-lg border border-white/10 text-sm hover:bg-white/10">✕</button>
        </div>
        <div className="relative p-4 sm:p-6 min-h-[320px]">
          {phase === "play" && children}
          {phase === "ready" && (
            <div className="ap-pop-in absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4" style={{ background: `linear-gradient(135deg, ${accentColor}44, rgba(255,255,255,0.06))`, border: `1px solid ${accentColor}66`, boxShadow: `0 0 30px -6px ${accentColor}` }}>{icon}</div>
              <h2 className="font-display font-bold text-2xl mb-1">{name}</h2>
              <p className="text-textDim text-sm max-w-xs mb-5">{tagline}</p>
              <button type="button" onClick={start} className="font-pixel text-[11px] px-8 py-3.5 rounded-xl text-bgDeep hover:scale-105 transition-transform" style={{ background: accentColor, boxShadow: `0 8px 30px -8px ${accentColor}` }}>▶ TAP TO PLAY</button>
              <p className="font-mono text-[10px] text-textDim mt-4">{best > 0 ? `Beat ${best.toLocaleString()} to set a new best` : "Every score counts on the leaderboard"}</p>
            </div>
          )}
          {phase === "count" && (
            <div className="absolute inset-0 flex items-center justify-center" aria-live="assertive">
              <span key={n} className="ap-pop-in font-pixel" style={{ fontSize: n === 0 ? 48 : 84, color: accentColor, textShadow: `0 0 40px ${accentColor}` }}>{n === 0 ? "GO!" : n}</span>
            </div>
          )}
          {ripples.map((r) => <span key={r.id} aria-hidden className="pointer-events-none absolute rounded-full" style={{ left: r.x - 6, top: r.y - 6, width: 12, height: 12, border: `2px solid ${accentColor}`, animation: "apRipple .65s ease-out forwards" }} />)}
        </div>
      </div>
    </div>
  );
}
