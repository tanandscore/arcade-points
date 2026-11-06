"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Galaxy Strike: a formation of aliens sways overhead and peels off to dive-bomb you. Your ship fires by itself - just steer and dodge.
export default function GalaxyStrike({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={480} H={640} accentColor={accentColor} onFinish={onFinish} title="GALAXY STRIKE"
      hint={"Drag (or use arrow keys) to steer. Your ship fires automatically.\nShoot the formation. Diving aliens are worth double.\nClear the wave to go on. Three lives."}
      make={(api) => {
        const { W, H } = api; const COLS = 8, ROWS = 4;
        let ship = { x: W / 2, inv: 0 }, lives = 3, score = 0, wave = 1, keyDir = 0, fireT = 0, bullets = [], eb = [], aliens = [], form = { x: 0, y: 70, dir: 1 }, diveT = 2, sparks = [], stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 20 + Math.random() * 60 })), msg = 0, targetX = null;
        const rnd = (a, b) => a + Math.random() * (b - a);
        function spawnWave() {
          aliens = []; form = { x: 0, y: 70, dir: 1 };
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) aliens.push({ r, c, x: 0, y: 0, alive: true, mode: "form", t: 0, bx: 0, by: 0, shootT: rnd(0.8, 2) });
          msg = 1.4;
        }
        const slot = (a) => [48 + a.c * 52 + form.x + (ROWS - a.r) * 0, form.y + a.r * 44];
        function boom(x, y, col) { for (let i = 0; i < 10; i++) sparks.push({ x, y, vx: rnd(-120, 120), vy: rnd(-120, 120), t: rnd(0.3, 0.6), col }); }
        function hitShip() { if (ship.inv > 0) return; lives--; ship.inv = 1.8; boom(ship.x, H - 70, "#3ee6e0"); api.sfx.wrong(); api.haptics.success(); if (lives <= 0) { api.sfx.lose(); api.finish(score); } }
        spawnWave();
        return {
          update(dt) {
            stars.forEach((s) => { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
            if (targetX !== null) ship.x += Math.max(-640 * dt, Math.min(640 * dt, targetX - ship.x)); else ship.x += keyDir * 340 * dt;
            ship.x = Math.max(24, Math.min(W - 24, ship.x)); if (ship.inv > 0) ship.inv -= dt; if (msg > 0) msg -= dt;
            fireT -= dt; if (fireT <= 0) { fireT = 0.26; bullets.push({ x: ship.x - 10, y: H - 90 }, { x: ship.x + 10, y: H - 90 }); api.sfx.click(); }
            bullets.forEach((b) => { b.y -= 640 * dt; }); bullets = bullets.filter((b) => b.y > -10);
            const alive = aliens.filter((a) => a.alive);
            const spd = 36 + wave * 8 + (1 - alive.length / (ROWS * COLS)) * 70;
            form.x += form.dir * spd * dt; const minC = Math.min(...alive.filter((a) => a.mode === "form").map((a) => a.c), 99), maxC = Math.max(...alive.filter((a) => a.mode === "form").map((a) => a.c), -1);
            if (48 + minC * 52 + form.x < 24) { form.dir = 1; form.y += 10; } if (48 + maxC * 52 + form.x > W - 24) { form.dir = -1; form.y += 10; }
            diveT -= dt; if (diveT <= 0) { diveT = Math.max(0.7, 2.6 - wave * 0.22); const f = alive.filter((a) => a.mode === "form"); if (f.length) { const a = f[(Math.random() * f.length) | 0]; const [x, y] = slot(a); a.mode = "dive"; a.t = 0; a.bx = x; a.by = y; a.dx = ship.x; } }
            for (const a of alive) {
              if (a.mode === "form") { [a.x, a.y] = slot(a); a.shootT -= dt; if (a.shootT <= 0) { a.shootT = rnd(2.5, 6) / (1 + wave * 0.15); if (Math.random() < 0.35) eb.push({ x: a.x, y: a.y + 12 }); } }
              else { a.t += dt; const k = a.t * (0.6 + wave * 0.07); a.x = a.bx + (a.dx - a.bx) * Math.min(1, k * 0.9) + Math.sin(a.t * 4) * 60; a.y = a.by + a.t * (170 + wave * 14); a.shootT -= dt; if (a.shootT <= 0) { a.shootT = 0.9; eb.push({ x: a.x, y: a.y + 12 }); } if (a.y > H + 20) { a.mode = "form"; } if (Math.abs(a.x - ship.x) < 22 && Math.abs(a.y - (H - 70)) < 22) { a.alive = false; boom(a.x, a.y, "#ffb703"); hitShip(); } }
            }
            for (const b of bullets) for (const a of aliens) if (a.alive && Math.abs(b.x - a.x) < 18 && Math.abs(b.y - a.y) < 16) { a.alive = false; b.y = -99; const p = a.mode === "dive" ? 100 : 50; score += p; boom(a.x, a.y, ["#ff3ea5", "#ffb703", "#3ee6e0", "#b6ff3e"][a.r]); api.sfx.hit(); }
            eb.forEach((b) => { b.y += 260 * dt; if (Math.abs(b.x - ship.x) < 16 && Math.abs(b.y - (H - 70)) < 18) { b.y = H + 99; hitShip(); } }); eb = eb.filter((b) => b.y < H + 20);
            sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt; }); sparks = sparks.filter((s) => s.t > 0);
            if (aliens.every((a) => !a.alive)) { score += 300 + wave * 100; wave++; bullets = []; eb = []; spawnWave(); api.sfx.win(); api.haptics.celebrate(); }
            if (aliens.some((a) => a.alive && a.mode === "form" && a.y > H - 130)) { lives = 0; api.sfx.lose(); api.finish(score); }
          },
          key(code, down) { if (code === "ArrowLeft" || code === "KeyA") keyDir = down ? -1 : (keyDir === -1 ? 0 : keyDir); if (code === "ArrowRight" || code === "KeyD") keyDir = down ? 1 : (keyDir === 1 ? 0 : keyDir); if (down) targetX = null; },
          pointer(type, x) { if (type === "up") { targetX = null; return; } targetX = x; },
          draw(ctx) {
            ctx.fillStyle = "#070418"; ctx.fillRect(0, 0, W, H); stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${s.s / 90})`; ctx.fillRect(s.x, s.y, 2, 2); });
            for (const a of aliens) { if (!a.alive) continue; const col = ["#ff3ea5", "#ffb703", "#3ee6e0", "#b6ff3e"][a.r], w = Math.sin(performance.now() / 160 + a.c) > 0;
              ctx.fillStyle = col; ctx.fillRect(a.x - 14, a.y - 8, 28, 16); ctx.fillRect(a.x - 20, a.y - (w ? 10 : 2), 8, 10); ctx.fillRect(a.x + 12, a.y - (w ? 10 : 2), 8, 10); ctx.fillStyle = "#070418"; ctx.fillRect(a.x - 8, a.y - 4, 5, 5); ctx.fillRect(a.x + 3, a.y - 4, 5, 5); }
            ctx.fillStyle = "#ffeb3b"; bullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 8, 4, 12)); ctx.fillStyle = "#ff5a5a"; eb.forEach((b) => ctx.fillRect(b.x - 2, b.y - 6, 4, 12));
            sparks.forEach((s) => { ctx.fillStyle = s.col; ctx.fillRect(s.x, s.y, 4, 4); });
            if (ship.inv <= 0 || Math.floor(ship.inv * 12) % 2 === 0) { const x = ship.x, y = H - 70; ctx.fillStyle = "#3ee6e0"; ctx.fillRect(x - 5, y - 20, 10, 30); ctx.fillRect(x - 22, y + 2, 44, 10); ctx.fillStyle = "#ff3ea5"; ctx.fillRect(x - 22, y + 8, 8, 10); ctx.fillRect(x + 14, y + 8, 8, 10); ctx.fillStyle = "#fff"; ctx.fillRect(x - 3, y - 12, 6, 8); }
            text(ctx, `SCORE ${score}`, 12, 20, 11, "#fff"); text(ctx, `WAVE ${wave}`, W / 2, 20, 11, "#ffb703", "center"); text(ctx, "♥".repeat(lives), W - 12, 20, 13, "#ff3ea5", "right");
            if (msg > 0) text(ctx, `WAVE ${wave}`, W / 2, H / 2, 22, "#3ee6e0", "center");
          },
        };
      }}
    />
  );
}
