"use client";

// Shared shell for the retro arcade games (Upgrade 59). A game is a small object made by `make(api)`:
//   { start(), update(dt), draw(ctx), key(code, down), pointer(type, x, y, event) }
// The shell takes care of the screen size (sharp on phones), the game loop, the "tap to start" card, keyboard and touch input,
// pausing when the tab is hidden, and reporting the final score exactly once through onFinish.
import { useEffect, useRef } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

export const FONT = "'Press Start 2P', ui-monospace, Menlo, monospace";
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD", "Enter"]);

export function text(ctx, s, x, y, size, color, align = "left") {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(s, x, y);
}

export default function ArcadeCanvas({ W, H, accentColor = "#3ee6e0", onFinish, title, hint, make }) {
  const ref = useRef(null);
  const live = useRef({ onFinish });
  live.current.onFinish = onFinish;

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { document.fonts && document.fonts.load(`12px 'Press Start 2P'`); } catch {}
    let phase = "ready", done = false, raf = 0, last = 0, t = 0;
    const api = {
      W, H, accent: accentColor, sfx, haptics,
      finish(score) { if (done) return; done = true; phase = "done"; setTimeout(() => live.current.onFinish && live.current.onFinish(Math.max(0, Math.round(score))), 650); },
    };
    const game = make(api);
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height]; };
    function begin() { if (phase !== "ready") return; phase = "play"; game.start && game.start(); }
    const down = (e) => { e.preventDefault(); if (phase === "ready") { begin(); return; } if (phase === "play") { try { canvas.setPointerCapture(e.pointerId); } catch {} const [x, y] = pos(e); game.pointer && game.pointer("down", x, y, e); } };
    const move = (e) => { if (phase === "play") { const [x, y] = pos(e); game.pointer && game.pointer("move", x, y, e); } };
    const up = (e) => { if (phase === "play") { const [x, y] = pos(e); game.pointer && game.pointer("up", x, y, e); } };
    const kd = (e) => {
      if (GAME_KEYS.has(e.code)) { if (phase !== "done") e.preventDefault(); }
      if (e.repeat) return;
      if (phase === "ready") { if (GAME_KEYS.has(e.code)) begin(); return; }
      if (phase === "play") game.key && game.key(e.code, true);
    };
    const ku = (e) => { if (phase === "play") game.key && game.key(e.code, false); };
    const ctxm = (e) => e.preventDefault();
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("contextmenu", ctxm);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t += dt;
      if (phase === "play" && !document.hidden) game.update(dt);
      ctx.save(); game.draw(ctx, t);
      if (phase === "ready") {
        ctx.fillStyle = "rgba(10,6,28,0.72)"; ctx.fillRect(0, 0, W, H);
        text(ctx, title, W / 2, H * 0.38, Math.max(14, W / 22), accentColor, "center");
        text(ctx, "TAP OR PRESS SPACE TO START", W / 2, H * 0.52, Math.max(8, W / 50), "#ffffff", "center");
        const lines = String(hint || "").split("\n"); lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.62 + i * Math.max(14, W / 40), Math.max(7, W / 64), "#a99fd6", "center"));
      }
      if (phase === "done") { ctx.fillStyle = "rgba(10,6,28,0.55)"; ctx.fillRect(0, 0, W, H); text(ctx, "GAME OVER", W / 2, H / 2, Math.max(16, W / 20), "#ff3ea5", "center"); }
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("contextmenu", ctxm);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full flex justify-center select-none">
      <canvas ref={ref} aria-label={title} style={{ width: "100%", maxWidth: Math.min(W, 640), aspectRatio: `${W} / ${H}`, touchAction: "none", borderRadius: 12, border: `2px solid ${accentColor}55`, background: "#0a061c", display: "block" }} />
    </div>
  );
}
