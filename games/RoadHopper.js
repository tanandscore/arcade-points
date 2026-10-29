"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Road Hopper: guide the frog across a busy road and a river of logs, to the far bank. Every new row = points; every crossing speeds things up.
export default function RoadHopper({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={480} H={624} accentColor={accentColor} onFinish={onFinish} title="ROAD HOPPER"
      hint={"Swipe or tap (or use arrow keys) to hop.\nDodge cars. Ride the logs over the river.\nReach the top bank to score big."}
      make={(api) => {
        const { W, H } = api; const C = 48, COLS = 10, ROWS = 13;
        let lives = 3, score = 0, level = 1, bestRow = 12, cd = 0, dead = 0, flash = 0;
        const frog = { x: 5 * C - C / 2, row: 12 };
        // rows: 0 goal bank, 1-5 river, 6 median, 7-11 road, 12 start
        const mk = () => {
          const lanes = [];
          const rnd = (a, b) => a + Math.random() * (b - a);
          for (let r = 1; r <= 5; r++) { const dir = r % 2 ? 1 : -1, w = [C * 3, C * 2, C * 4, C * 2.5, C * 3][r - 1], gap = rnd(C * 1.6, C * 2.6) + w; lanes[r] = { type: "log", dir, base: rnd(40, 70) + r * 6, objs: [], w, gap }; }
          for (let r = 7; r <= 11; r++) { const dir = r % 2 ? -1 : 1, w = [C * 1.1, C * 1.7, C * 1.1, C * 2.1, C * 1.3][r - 7], gap = rnd(C * 3, C * 5) + w; lanes[r] = { type: "car", dir, base: rnd(70, 120) + (r - 7) * 10, objs: [], w, gap, hue: [190, 330, 45, 280, 120][r - 7] }; }
          lanes.forEach((l) => { if (!l) return; for (let x = rnd(0, l.gap); x < W + l.gap; x += l.gap) l.objs.push({ x }); });
          return lanes;
        };
        let lanes = mk();
        const spd = (l) => l.base * (1 + (level - 1) * 0.13) * l.dir;
        function reset(loseLife) { frog.x = 5 * C - C / 2; frog.row = 12; bestRow = 12; if (loseLife) { lives--; dead = 0.5; api.sfx.wrong(); api.haptics.success(); if (lives <= 0) { api.sfx.lose(); api.finish(score); } } }
        function hop(dx, dy) {
          if (cd > 0 || dead > 0) return; cd = 0.09;
          frog.x = Math.max(C / 2, Math.min(W - C / 2, frog.x + dx * C)); frog.row = Math.max(0, Math.min(12, frog.row + dy));
          api.sfx.tap();
          if (frog.row < bestRow) { score += 10; bestRow = frog.row; }
          if (frog.row === 0) { score += 100 + level * 20; level++; flash = 0.35; api.sfx.win(); api.haptics.celebrate(); lanes = mk(); reset(false); }
        }
        let sx = 0, sy = 0;
        return {
          update(dt) {
            if (cd > 0) cd -= dt; if (flash > 0) flash -= dt; if (dead > 0) { dead -= dt; }
            lanes.forEach((l) => { if (!l) return; l.objs.forEach((o) => { o.x += spd(l) * dt; if (l.dir > 0 && o.x > W + 10) o.x -= (Math.ceil((W + l.gap + 20) / l.gap)) * l.gap; if (l.dir < 0 && o.x < -l.w - 10) o.x += (Math.ceil((W + l.gap + 20) / l.gap)) * l.gap; }); });
            if (dead > 0) return;
            const l = lanes[frog.row];
            if (l && l.type === "log") {
              const on = l.objs.find((o) => frog.x > o.x + 4 && frog.x < o.x + l.w - 4);
              if (!on) { reset(true); return; } frog.x += spd(l) * dt; if (frog.x < 0 || frog.x > W) { reset(true); return; }
            } else if (l && l.type === "car") {
              if (l.objs.some((o) => frog.x + 14 > o.x && frog.x - 14 < o.x + l.w)) reset(true);
            }
          },
          key(code, down) { if (!down) return; if (code === "ArrowUp" || code === "KeyW") hop(0, -1); if (code === "ArrowDown" || code === "KeyS") hop(0, 1); if (code === "ArrowLeft" || code === "KeyA") hop(-1, 0); if (code === "ArrowRight" || code === "KeyD") hop(1, 0); },
          pointer(type, x, y) {
            if (type === "down") { sx = x; sy = y; }
            if (type === "up") { const dx = x - sx, dy = y - sy; if (Math.hypot(dx, dy) < 22) hop(0, -1); else if (Math.abs(dx) > Math.abs(dy)) hop(Math.sign(dx), 0); else hop(0, Math.sign(dy)); }
          },
          draw(ctx, t) {
            for (let r = 0; r < ROWS; r++) {
              const y = r * C; const l = lanes[r];
              ctx.fillStyle = r === 0 ? "#1f6b3a" : r >= 1 && r <= 5 ? "#0e3a73" : r === 6 || r === 12 ? "#2f7a3e" : "#2a2a36"; ctx.fillRect(0, y, W, C);
              if (r >= 1 && r <= 5) { ctx.fillStyle = "rgba(255,255,255,0.07)"; for (let k = 0; k < 6; k++) ctx.fillRect(((k * 97 + t * 20 * (r % 2 ? 1 : -1)) % W + W) % W, y + 10 + (k % 3) * 12, 26, 3); }
              if (r >= 7 && r <= 11) { ctx.fillStyle = "rgba(255,255,255,0.18)"; for (let k = 0; k < 10; k++) ctx.fillRect(k * C + 12, y + C - 3, 24, 2); }
              if (r === 0) { ctx.fillStyle = "#2f9b55"; for (let k = 0; k < 5; k++) ctx.fillRect(k * 2 * C + 10, y + 8, C - 20, C - 16); }
              if (!l) continue;
              l.objs.forEach((o) => {
                if (l.type === "log") { ctx.fillStyle = "#8b5a2b"; ctx.fillRect(o.x, y + 6, l.w, C - 12); ctx.fillStyle = "#a9722f"; ctx.fillRect(o.x, y + 10, l.w, 6); ctx.fillStyle = "#6f4520"; for (let k = o.x + 14; k < o.x + l.w - 8; k += 28) ctx.fillRect(k, y + 22, 3, 12); }
                else { ctx.fillStyle = `hsl(${l.hue},80%,55%)`; ctx.fillRect(o.x, y + 8, l.w, C - 16); ctx.fillStyle = "rgba(255,255,255,0.75)"; const hx = l.dir > 0 ? o.x + l.w - 16 : o.x + 4; ctx.fillRect(hx, y + 12, 12, C - 24); ctx.fillStyle = "#111"; ctx.fillRect(o.x + 6, y + 6, 8, 4); ctx.fillRect(o.x + l.w - 14, y + 6, 8, 4); ctx.fillRect(o.x + 6, y + C - 10, 8, 4); ctx.fillRect(o.x + l.w - 14, y + C - 10, 8, 4); }
              });
            }
            // the frog
            if (dead <= 0 || Math.floor(dead * 20) % 2 === 0) {
              const fx = frog.x, fy = frog.row * C + C / 2;
              ctx.fillStyle = "#6fe26f"; ctx.fillRect(fx - 14, fy - 10, 28, 22); ctx.fillStyle = "#3fae3f"; ctx.fillRect(fx - 18, fy + 4, 8, 10); ctx.fillRect(fx + 10, fy + 4, 8, 10);
              ctx.fillStyle = "#fff"; ctx.fillRect(fx - 11, fy - 14, 8, 8); ctx.fillRect(fx + 3, fy - 14, 8, 8); ctx.fillStyle = "#111"; ctx.fillRect(fx - 8, fy - 11, 4, 4); ctx.fillRect(fx + 6, fy - 11, 4, 4);
            }
            if (flash > 0) { ctx.fillStyle = `rgba(255,214,102,${flash})`; ctx.fillRect(0, 0, W, H); }
            ctx.fillStyle = "rgba(10,6,28,0.6)"; ctx.fillRect(0, 0, W, 30);
            text(ctx, `SCORE ${score}`, 10, 15, 10, "#fff"); text(ctx, `LV ${level}`, W / 2, 15, 10, "#ffb703", "center"); text(ctx, "♥".repeat(lives), W - 10, 15, 12, "#ff3ea5", "right");
          },
        };
      }}
    />
  );
}
