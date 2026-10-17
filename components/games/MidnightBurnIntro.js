"use client";

// On-screen layer of the Midnight Burn intro: letterbox bars, fades, animated captions, the title slam and a skip button.
// The 3D shots and the music are driven by MidnightBurnCity; this just draws the words and the black.
import { INTRO } from "@/lib/midnightBurn/introScore";

const CAPS = (era, carName) => [
  { a: 0.3, b: 2.2, big: "TAP & SCORE", sub: "PRESENTS", kind: "card" },
  { a: 3.0, b: 6.0, big: "MUMBAI.", sub: era === "2046" ? "THE YEAR IS 2046" : "2:07 AM", kind: "line" },
  { a: 6.2, b: 9.2, big: "RAIN. NEON. NO RULES.", kind: "line" },
  { a: 10.3, b: 13.2, big: "THE CITY NEVER SLEEPS.", kind: "line" },
  { a: 13.4, b: 16.4, big: "NEITHER DO WE.", kind: "line" },
  { a: 17.6, b: 21.4, big: "YOUR GARAGE.", sub: carName ? `YOUR CAR · ${carName.toUpperCase()}` : "YOUR CAR", kind: "line" },
  { a: 21.8, b: 25.9, big: "TEN DRIVERS. ONE CROWN.", kind: "line" },
  { a: 26.4, b: 36.6, big: "MIDNIGHT BURN", sub: era === "2046" ? "MUMBAI 2046" : "MUMBAI UNDERGROUND", kind: "title" },
  { a: 33.2, b: 38.2, big: "BECOME #1.", kind: "tag" },
  { a: 39.0, b: 43.0, big: "▶ START YOUR CAREER", kind: "tag2" },
];

export default function MidnightBurnIntro({ t, hold, era, carName, onSkip }) {
  const caps = CAPS(era, carName);
  let fade = t < 1.0 ? 1 : 0; if (t < 2.4) fade = Math.max(fade, 0); // opening card sits on black
  const opening = t < 2.4 ? 1 : 0;
  for (const c of INTRO.CUTS) fade = Math.max(fade, Math.max(0, 1 - Math.abs(t - c) / (c === INTRO.DROP ? 0.12 : 0.4)));
  if (t > INTRO.END - 1.8) fade = Math.max(fade, Math.min(1, (t - (INTRO.END - 1.8)) / 1.6));
  if (t > 2.4 && t < 3.2) fade = Math.max(fade, 1 - (t - 2.4) / 0.8);
  if (hold) fade = 1; if (opening) fade = 1;
  const flash = Math.max(0, 1 - Math.abs(t - INTRO.DROP) / 0.18) * (t >= INTRO.DROP ? 1 : 0);
  const shake = t >= INTRO.DROP && t < INTRO.DROP + 0.6 ? (1 - (t - INTRO.DROP) / 0.6) * 10 : 0;
  const active = caps.filter((c) => t >= c.a && t <= c.b);
  return (
    <div style={{ position: "absolute", inset: 0, userSelect: "none", zIndex: 60, pointerEvents: "auto", overflow: "hidden", transform: shake ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : undefined }} onClick={onSkip}>
      <style>{`
        @keyframes mbRise{0%{opacity:0;transform:translateY(24px) scale(.96);letter-spacing:.5em}100%{opacity:1;transform:none;letter-spacing:.18em}}
        @keyframes mbSlam{0%{opacity:0;transform:scale(3.2);filter:blur(14px)}40%{opacity:1;transform:scale(.96);filter:blur(0)}60%{transform:scale(1.03)}100%{transform:scale(1)}}
        @keyframes mbGlitch{0%,92%,100%{transform:none;clip-path:none}93%{transform:translateX(-6px);clip-path:inset(20% 0 55% 0)}95%{transform:translateX(8px);clip-path:inset(60% 0 10% 0)}97%{transform:none;clip-path:none}}
        @keyframes mbSub{0%{opacity:0;letter-spacing:1em}100%{opacity:1;letter-spacing:.5em}}
        @keyframes mbPulse{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes mbBar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
      `}</style>
      {/* cinema bars */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "11%", background: "#000", transformOrigin: "top", animation: "mbBar .9s ease-out both" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "11%", background: "#000", transformOrigin: "bottom", animation: "mbBar .9s ease-out both" }} />
      {/* vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
      {/* captions */}
      {active.map((c) => (
        <div key={c.a} style={{ position: "absolute", left: 0, right: 0, textAlign: "center", top: c.kind === "title" ? "36%" : c.kind === "tag" || c.kind === "tag2" ? "74%" : c.kind === "card" ? "43%" : "70%", padding: "0 5%" }}>
          {c.kind === "title" ? (
            <>
              <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontStyle: "italic", fontSize: "min(11vw, 17vh)", lineHeight: 1, color: "#fff", animation: "mbSlam .7s cubic-bezier(.2,.9,.2,1) both, mbGlitch 3.2s infinite 1.5s", letterSpacing: ".04em", textShadow: "0 0 18px #2de2ff, 0 0 46px #2de2ff, 0 0 90px #ff2d95, 4px 4px 0 #ff2d95" }}>{c.big}</div>
              <div style={{ marginTop: "2.4vh", fontFamily: "monospace", fontWeight: 700, fontSize: "min(2.2vw, 3.4vh)", color: "#ffb703", animation: "mbSub 1.6s .5s ease-out both", textShadow: "0 0 14px #ffb703" }}>{c.sub}</div>
            </>
          ) : c.kind === "card" ? (
            <>
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "min(3.4vw, 5vh)", color: "#fff", animation: "mbRise 1.2s ease-out both" }}>{c.big}</div>
              <div style={{ marginTop: "1vh", fontFamily: "monospace", fontSize: "min(1.6vw, 2.4vh)", color: "#2de2ff", letterSpacing: ".6em" }}>{c.sub}</div>
            </>
          ) : c.kind === "tag2" ? (
            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "min(2.3vw, 3.6vh)", color: "#6bff9a", letterSpacing: ".2em", animation: "mbPulse 1.1s infinite", textShadow: "0 0 12px #6bff9a" }}>{c.big}</div>
          ) : (
            <>
              <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: c.kind === "tag" ? "min(5vw, 8vh)" : "min(4vw, 6.4vh)", color: "#fff", fontStyle: "italic", animation: "mbRise 1.1s ease-out both", textShadow: "0 0 16px rgba(45,226,255,0.85), 3px 3px 0 rgba(255,45,149,0.8)" }}>{c.big}</div>
              {c.sub && <div style={{ marginTop: "1.4vh", fontFamily: "monospace", fontWeight: 700, fontSize: "min(1.8vw, 2.8vh)", color: "#ffb703", letterSpacing: ".4em", animation: "mbSub 1.4s .4s ease-out both" }}>{c.sub}</div>}
            </>
          )}
        </div>
      ))}
      {/* white flash on the drop, then the black dips */}
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fade, pointerEvents: "none" }} />
      {t > 0.6 && t < INTRO.END - 1 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onSkip(); }} style={{ position: "absolute", fontFamily: "monospace", right: 16, bottom: "13%", padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer", zIndex: 5 }}>SKIP ▸ <span style={{ opacity: 0.6 }}>(Esc / Enter)</span></button>
      )}
    </div>
  );
}
