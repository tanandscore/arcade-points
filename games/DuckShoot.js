"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Duck Shoot: a light-gun classic with a mouse or finger. Two ducks fly up each round and you only get three shots. Let them escape and you lose hearts.
export default function DuckShoot({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={640} H={420} accentColor={accentColor} onFinish={onFinish} title="DUCK SHOOT"
      hint={"Tap or click a duck to shoot it.\nThree shots per round, two ducks per round.\nEvery duck that escapes costs a heart."}
      make={(api) => {
        const { W, H } = api;
        let score = 0, lives = 3, round = 1, ammo = 3, ducks = [], pause = 1.0, hits = 0, cross = [W / 2, H / 2], pops = [], shake = 0, flashT = 0, roundHits = 0;
        const rnd = (a, b) => a + Math.random() * (b - a);
        function spawn() {
          ducks = []; ammo = 3; roundHits = 0;
          const n = 2;
          for (let i = 0; i < n; i++) { const fromLeft = Math.random() < 0.5; ducks.push({ x: rnd(120, W - 120), y: H - 110, vx: (fromLeft ? 1 : -1) * rnd(110, 150) * (1 + round * 0.07), vy: -rnd(140, 190) * (1 + round * 0.05), t: rnd(0, 6), state: "fly", dead: 0, dir: 1, age: 0 }); }
        }
        function shoot(x, y) {
          if (ammo <= 0 || pause > 0) return; ammo--; api.sfx.hit(); shake = 0.08;
          let got = false;
          for (const d of ducks) if (d.state === "fly" && Math.abs(x - d.x) < 34 && Math.abs(y - d.y) < 28) { d.state = "fall"; d.vy = 60; got = true; hits++; roundHits++; const pts = 100 + Math.round(Math.max(0, 3 - d.age) * 30); score += pts; pops.push({ x: d.x, y: d.y, s: `+${pts}`, t: 0.9 }); api.sfx.correct(); api.haptics.tap(); break; }
          if (!got) api.sfx.tap();
        }
        return {
          start() { spawn(); },
          update(dt) {
            if (shake > 0) shake -= dt; if (flashT > 0) flashT -= dt; pops.forEach((p) => { p.t -= dt; p.y -= 30 * dt; }); pops = pops.filter((p) => p.t > 0);
            if (pause > 0) { pause -= dt; if (pause <= 0 && !ducks.length) spawn(); return; }
            let active = 0;
            for (const d of ducks) {
              d.age += dt; d.t += dt;
              if (d.state === "fly") {
                d.x += d.vx * dt + Math.sin(d.t * 3.2) * 40 * dt; d.y += d.vy * dt; d.dir = d.vx > 0 ? 1 : -1;
                if (d.y < 60) d.vy = Math.abs(d.vy) * 0.5; else if (d.y > H - 120 && d.age > 1) d.vy = -Math.abs(d.vy) * 0.7;
                if (d.x < 30) d.vx = Math.abs(d.vx); if (d.x > W - 30) d.vx = -Math.abs(d.vx);
                if (ammo <= 0 || d.age > 7) { d.state = "escape"; }
                active++;
              } else if (d.state === "fall") { d.vy += 500 * dt; d.y += d.vy * dt; if (d.y > H - 80) { d.state = "gone"; } }
              else if (d.state === "escape") { d.y -= 220 * dt; d.x += d.vx * dt; if (d.y < -50) { d.state = "gone"; lives--; api.sfx.wrong(); api.haptics.success(); flashT = 0.3; if (lives <= 0) { api.sfx.lose(); api.finish(score); } } }
            }
            if (ducks.length && ducks.every((d) => d.state === "gone")) {
              if (roundHits === 2) { score += 100; pops.push({ x: W / 2, y: H / 2, s: "PERFECT +100", t: 1.2 }); api.sfx.win(); }
              ducks = []; round++; pause = 1.1;
            } else if (active === 0 && ducks.some((d) => d.state === "fall") === false && ducks.every((d) => d.state === "escape" || d.state === "gone") && !ducks.some((d) => d.state === "escape")) { /* wait */ }
          },
          pointer(type, x, y) { cross = [x, y]; if (type === "down") shoot(x, y); },
          draw(ctx, t) {
            const sx = shake > 0 ? (Math.random() - 0.5) * 6 : 0; ctx.translate(sx, 0);
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#58b8ff"); g.addColorStop(1, "#d6f1ff"); ctx.fillStyle = g; ctx.fillRect(-10, 0, W + 20, H);
            ctx.fillStyle = "#fff"; [[80, 70, 90], [300, 50, 110], [520, 90, 80]].forEach(([x, y, w]) => { const dx = (x + t * 8) % (W + 120) - 60; ctx.fillRect(dx, y, w, 20); ctx.fillRect(dx + 14, y - 12, w - 36, 16); });
            ctx.fillStyle = "#3b9c4a"; ctx.beginPath(); ctx.moveTo(0, H - 90); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 100 - Math.sin(x * 0.02) * 22); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
            ctx.fillStyle = "#6b3b18"; ctx.fillRect(520, H - 210, 22, 120); ctx.fillStyle = "#2f8a3a"; ctx.fillRect(490, H - 270, 84, 70); ctx.fillRect(504, H - 300, 56, 40);
            for (const d of ducks) {
              if (d.state === "gone") continue; const flap = Math.sin(d.t * 18) > 0, fx = d.dir;
              ctx.save(); ctx.translate(d.x, d.y); ctx.scale(fx, d.state === "fall" ? -1 : 1);
              ctx.fillStyle = "#6b3b18"; ctx.fillRect(-18, -8, 34, 22); ctx.fillStyle = "#2a8a4a"; ctx.fillRect(10, -20, 16, 16); ctx.fillStyle = "#f2c200"; ctx.fillRect(24, -14, 12, 6); ctx.fillStyle = "#111"; ctx.fillRect(18, -17, 4, 4);
              ctx.fillStyle = "#e8e0d0"; ctx.fillRect(-12, flap ? -22 : 2, 22, 12); ctx.restore();
            }
            ctx.fillStyle = "#2b7a35"; ctx.fillRect(0, H - 70, W, 70); ctx.fillStyle = "#3da34a"; for (let x = 0; x < W; x += 16) ctx.fillRect(x, H - 74 + ((x / 16) % 3) * 3, 10, 12);
            pops.forEach((p) => text(ctx, p.s, p.x, p.y, 12, "#ffeb3b", "center"));
            ctx.strokeStyle = "#ff3ea5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cross[0], cross[1], 16, 0, 7); ctx.moveTo(cross[0] - 24, cross[1]); ctx.lineTo(cross[0] + 24, cross[1]); ctx.moveTo(cross[0], cross[1] - 24); ctx.lineTo(cross[0], cross[1] + 24); ctx.stroke();
            ctx.fillStyle = "rgba(10,6,28,0.65)"; ctx.fillRect(-10, H - 40, W + 20, 40);
            text(ctx, `SCORE ${score}`, 14, H - 20, 11, "#fff"); text(ctx, `ROUND ${round}`, W / 2, H - 20, 11, "#ffb703", "center"); text(ctx, "●".repeat(ammo) + "○".repeat(3 - ammo), 200, H - 20, 12, "#3ee6e0"); text(ctx, "♥".repeat(lives), W - 14, H - 20, 13, "#ff3ea5", "right");
            if (flashT > 0) { ctx.fillStyle = `rgba(255,62,165,${flashT})`; ctx.fillRect(-10, 0, W + 20, H); }
            if (pause > 0 && ducks.length === 0) text(ctx, `ROUND ${round}`, W / 2, H / 2, 20, "#fff", "center");
          },
        };
      }}
    />
  );
}
