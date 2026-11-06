"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Bubble Pop: aim, shoot, match three or more. Bubbles left hanging fall for bonus points. The ceiling creeps down every few shots - don't let it reach the line.
const COLS = 10, R = 24, DY = R * 1.732;
const PAL = ["#ff3ea5", "#3ee6e0", "#ffb703", "#b6ff3e", "#a77bff", "#ff5a3c"];
export default function BubblePop({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={480} H={640} accentColor={accentColor} onFinish={onFinish} title="BUBBLE POP"
      hint={"Move your finger or mouse to aim, let go to shoot\n(or use arrows and space). Match 3 or more.\nCut off a hanging group to drop it for bonus."}
      make={(api) => {
        const { W, H } = api; const SX = W / 2, SY = H - 54, DEAD = 12;
        let par = 0, rows = [], score = 0, shots = 0, combo = 0, aim = -Math.PI / 2, cur, next, ball = null, pops = [], falls = [], keyAim = 0, level = 1, perRow = 7, shake = 0;
        const off = (r) => ((r + par) % 2) * R, cx = (r, c) => R + c * 2 * R + off(r), cy = (r) => R + r * DY;
        const valid = (r, c) => c >= 0 && c < COLS - (off(r) ? 1 : 0);
        const colorsIn = () => { const s = new Set(); rows.forEach((row) => row.forEach((c) => { if (c !== null) s.add(c); })); return s.size ? [...s] : [0, 1, 2]; };
        const pick = () => { const cs = colorsIn(); return cs[(Math.random() * cs.length) | 0]; };
        const newRow = () => Array.from({ length: COLS }, (_, c) => c);
        function addRow() { const n = Math.min(PAL.length, 4 + Math.floor(level / 2)); rows.unshift(Array.from({ length: COLS }, () => (Math.random() * n) | 0)); par = (par + 1) % 2; rows[0] = rows[0].map((v, c) => (valid(0, c) ? v : null)); }
        for (let i = 0; i < 6; i++) { par = i % 2 ? 1 : 0; }
        par = 0; rows = Array.from({ length: 6 }, (_, r) => Array.from({ length: COLS }, (_, c) => (valid(r, c) ? (Math.random() * 4) | 0 : null)));
        cur = pick(); next = pick();
        const nbrs = (r, c) => { const o = off(r); const same = [[r, c - 1], [r, c + 1]]; const adj = o ? [[r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]] : [[r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]; return [...same, ...adj].filter(([rr, cc]) => rr >= 0 && rr < rows.length && valid(rr, cc)); };
        const get = (r, c) => (rows[r] ? rows[r][c] : null);
        function flood(r, c, same) { const seen = new Set([r * 100 + c]), st = [[r, c]], out = []; while (st.length) { const [a, b] = st.pop(); out.push([a, b]); for (const [x, y] of nbrs(a, b)) { const k = x * 100 + y; if (seen.has(k)) continue; const v = get(x, y); if (v === null || v === undefined) continue; if (same !== null && v !== same) continue; seen.add(k); st.push([x, y]); } } return out; }
        function settle(x, y, color) {
          // snap to the nearest empty valid cell
          let best = null, bd = 1e9;
          for (let r = 0; r <= rows.length; r++) for (let c = 0; c < COLS; c++) { if (!valid(r, c)) continue; if (get(r, c) !== null && get(r, c) !== undefined) continue; const d = Math.hypot(cx(r, c) - x, cy(r) - y); if (d < bd) { bd = d; best = [r, c]; } }
          if (!best) return; const [r, c] = best; while (rows.length <= r) rows.push(Array(COLS).fill(null)); rows[r][c] = color;
          const grp = flood(r, c, color);
          if (grp.length >= 3) {
            combo++; grp.forEach(([a, b]) => { pops.push({ x: cx(a, b), y: cy(a), col: color, t: 0.3 }); rows[a][b] = null; }); score += grp.length * 10 * combo; api.sfx.correct(); api.haptics.tap();
            const keep = new Set(); rows.forEach((row, a) => row.forEach((v, b) => { if (v !== null && a === 0) flood(a, b, null).forEach(([p, q]) => keep.add(p * 100 + q)); }));
            let dropped = 0; rows.forEach((row, a) => row.forEach((v, b) => { if (v !== null && !keep.has(a * 100 + b)) { falls.push({ x: cx(a, b), y: cy(a), vy: 0, col: v }); rows[a][b] = null; dropped++; } }));
            if (dropped) { score += dropped * 25; api.sfx.win(); shake = 0.2; }
          } else { combo = 0; api.sfx.tap(); }
          while (rows.length > 1 && rows[rows.length - 1].every((v) => v === null)) rows.pop();
        }
        function shoot() { if (ball) return; ball = { x: SX, y: SY, vx: Math.cos(aim) * 760, vy: Math.sin(aim) * 760, col: cur }; cur = next; next = pick(); shots++; api.sfx.select(); }
        return {
          update(dt) {
            if (shake > 0) shake -= dt; pops.forEach((p) => { p.t -= dt; }); pops = pops.filter((p) => p.t > 0); falls.forEach((f) => { f.vy += 900 * dt; f.y += f.vy * dt; }); falls = falls.filter((f) => f.y < H + 30);
            aim = Math.max(-Math.PI + 0.2, Math.min(-0.2, aim + keyAim * 1.8 * dt));
            if (ball) {
              const steps = 4; for (let s = 0; s < steps && ball; s++) {
                ball.x += (ball.vx * dt) / steps; ball.y += (ball.vy * dt) / steps;
                if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); } if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
                let hit = ball.y <= R + 1;
                if (!hit) for (let r = 0; r < rows.length && !hit; r++) for (let c = 0; c < COLS; c++) { const v = rows[r][c]; if (v !== null && v !== undefined && Math.hypot(cx(r, c) - ball.x, cy(r) - ball.y) < R * 1.8) { hit = true; break; } }
                if (hit) { const b = ball; ball = null; settle(b.x, b.y, b.col); if (shots % perRow === 0) { addRow(); api.sfx.hit(); } if (rows.length > DEAD || rows.some((row, r) => r >= DEAD && row.some((v) => v !== null))) { api.sfx.lose(); api.finish(score); } if (rows.every((row) => row.every((v) => v === null))) { score += 500; level++; perRow = Math.max(4, 7 - Math.floor(level / 2)); for (let i = 0; i < 4; i++) addRow(); api.sfx.win(); } }
              }
            }
          },
          key(code, down) { if (code === "ArrowLeft" || code === "KeyA") keyAim = down ? -1 : 0; if (code === "ArrowRight" || code === "KeyD") keyAim = down ? 1 : 0; if (down && (code === "Space" || code === "ArrowUp" || code === "Enter")) shoot(); },
          pointer(type, x, y) { const a = Math.atan2(y - SY, x - SX); aim = Math.max(-Math.PI + 0.2, Math.min(-0.2, a)); if (type === "up") shoot(); },
          draw(ctx) {
            const sx = shake > 0 ? (Math.random() - 0.5) * 6 : 0; ctx.translate(sx, 0);
            ctx.fillStyle = "#0a061c"; ctx.fillRect(-10, 0, W + 20, H);
            ctx.strokeStyle = "rgba(255,62,165,0.5)"; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); const dl = R + DEAD * DY - R * 0.2; ctx.moveTo(0, dl); ctx.lineTo(W, dl); ctx.stroke(); ctx.setLineDash([]);
            const bub = (x, y, col, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = PAL[col]; ctx.beginPath(); ctx.arc(x, y, R - 2, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.arc(x - 7, y - 8, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; };
            rows.forEach((row, r) => row.forEach((v, c) => { if (v !== null && valid(r, c)) bub(cx(r, c), cy(r), v); }));
            falls.forEach((f) => bub(f.x, f.y, f.col)); pops.forEach((p) => { ctx.strokeStyle = PAL[p.col]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R + (0.3 - p.t) * 60, 0, 7); ctx.stroke(); });
            if (!ball) { ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.setLineDash([4, 10]); ctx.lineWidth = 3; ctx.beginPath(); let x = SX, y = SY, vx = Math.cos(aim), vy = Math.sin(aim); ctx.moveTo(x, y); for (let i = 0; i < 70; i++) { x += vx * 8; y += vy * 8; if (x < R || x > W - R) vx = -vx; ctx.lineTo(x, y); if (y < R) break; } ctx.stroke(); ctx.setLineDash([]); }
            if (ball) bub(ball.x, ball.y, ball.col);
            ctx.fillStyle = "#2b2150"; ctx.fillRect(SX - 34, SY + 18, 68, 12); bub(SX, SY, cur); bub(SX - 80, SY + 12, next, 0.8); text(ctx, "NEXT", SX - 80, SY + 40, 8, "#a99fd6", "center");
            text(ctx, `SCORE ${score}`, 12, H - 14, 10, "#fff"); text(ctx, `ROW IN ${perRow - (shots % perRow)}`, W - 12, H - 14, 9, "#ffb703", "right"); text(ctx, `LV ${level}`, W / 2, H - 14, 9, "#3ee6e0", "center");
          },
        };
      }}
    />
  );
}
