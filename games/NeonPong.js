"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Neon Pong: the 1970s original, on a phone. You are the bottom paddle; beat the computer, which gets quicker every point. Three lives.
export default function NeonPong({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={480} H={640} accentColor={accentColor} onFinish={onFinish} title="NEON PONG"
      hint={"Drag (or use arrow keys) to move your paddle.\nScore a point when the computer misses.\nThree lives - the ball gets faster."}
      make={(api) => {
        const { W, H } = api; const PW0 = 96, PH = 14, BR = 8;
        let me = W / 2, cpu = W / 2, lives = 3, points = 0, hits = 0, level = 0, keyDir = 0, trail = [];
        let ball, serveT = 0, flash = 0;
        const speed = () => 330 + level * 28 + Math.min(hits, 40) * 4;
        const pw = () => Math.max(66, PW0 - level * 3);
        function serve(dir) { const a = (Math.random() * 0.7 - 0.35); const s = 300 + level * 20; ball = { x: W / 2, y: H / 2, vx: Math.sin(a) * s, vy: Math.cos(a) * s * dir }; serveT = 0.8; trail = []; }
        serve(-1);
        return {
          update(dt) {
            me = Math.max(pw() / 2, Math.min(W - pw() / 2, me + keyDir * 520 * dt));
            if (flash > 0) flash -= dt;
            if (serveT > 0) { serveT -= dt; cpu += Math.sign(W / 2 - cpu) * Math.min(Math.abs(W / 2 - cpu), 200 * dt); return; }
            // the computer follows the ball, but only so fast (and with a small delay), so it can be beaten
            const target = ball.vy < 0 ? ball.x + Math.sin(performance.now() / 400) * 14 : W / 2;
            const maxv = 210 + level * 32; cpu += Math.max(-maxv * dt, Math.min(maxv * dt, target - cpu));
            cpu = Math.max(pw() / 2, Math.min(W - pw() / 2, cpu));
            ball.x += ball.vx * dt; ball.y += ball.vy * dt;
            trail.push([ball.x, ball.y]); if (trail.length > 10) trail.shift();
            if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); } if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
            const paddle = (px, py, dirOut) => {
              if (Math.abs(ball.y - py) < PH / 2 + BR && Math.abs(ball.x - px) < pw() / 2 + BR && Math.sign(ball.vy) === -dirOut) {
                const off = Math.max(-1, Math.min(1, (ball.x - px) / (pw() / 2))); const s = speed(); const a = off * 1.0;
                ball.vx = Math.sin(a) * s; ball.vy = dirOut * Math.cos(a) * s; ball.y = py + dirOut * (PH / 2 + BR + 1); return true;
              } return false;
            };
            if (paddle(me, H - 60, -1)) { hits++; api.sfx.tap(); api.haptics.tap(); }
            if (paddle(cpu, 60, 1)) api.sfx.select();
            if (ball.y < -20) { points++; level = Math.floor(points / 2); api.sfx.correct(); flash = 0.25; serve(1); }
            if (ball.y > H + 20) { lives--; api.sfx.wrong(); api.haptics.success(); if (lives <= 0) { api.sfx.lose(); api.finish(points * 100 + hits * 5); } else serve(-1); }
          },
          key(code, down) { if (code === "ArrowLeft" || code === "KeyA") keyDir = down ? -1 : (keyDir === -1 ? 0 : keyDir); if (code === "ArrowRight" || code === "KeyD") keyDir = down ? 1 : (keyDir === 1 ? 0 : keyDir); },
          pointer(type, x) { if (type !== "up") me = Math.max(pw() / 2, Math.min(W - pw() / 2, x)); },
          draw(ctx) {
            ctx.fillStyle = "#0a061c"; ctx.fillRect(0, 0, W, H);
            if (flash > 0) { ctx.fillStyle = `rgba(62,230,224,${flash})`; ctx.fillRect(0, 0, W, H); }
            ctx.strokeStyle = "rgba(169,159,214,0.35)"; ctx.setLineDash([12, 12]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
            trail.forEach(([x, y], i) => { ctx.fillStyle = `rgba(255,255,255,${i / 22})`; ctx.fillRect(x - BR / 2, y - BR / 2, BR, BR); });
            ctx.shadowColor = api.accent; ctx.shadowBlur = 14; ctx.fillStyle = api.accent; ctx.fillRect(me - pw() / 2, H - 60 - PH / 2, pw(), PH);
            ctx.shadowColor = "#ff3ea5"; ctx.fillStyle = "#ff3ea5"; ctx.fillRect(cpu - pw() / 2, 60 - PH / 2, pw(), PH);
            ctx.shadowColor = "#fff"; ctx.fillStyle = "#fff"; ctx.fillRect(ball.x - BR, ball.y - BR, BR * 2, BR * 2); ctx.shadowBlur = 0;
            text(ctx, `SCORE ${points * 100 + hits * 5}`, 16, 24, 11, "#ffffff"); text(ctx, "♥".repeat(lives), W - 16, 24, 14, "#ff3ea5", "right");
            if (serveT > 0) text(ctx, "GET READY", W / 2, H / 2 + 60, 12, "#ffb703", "center");
          },
        };
      }}
    />
  );
}
