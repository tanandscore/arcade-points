"use client";

import ArcadeCanvas, { text } from "./ArcadeCanvas";

// Minefield: the classic number-and-flag puzzle. Clear a board to move to a bigger one; touching a mine ends the run.
// Tap = dig, hold (or right-click, or the DIG/FLAG button) = flag. Your first tap is always safe.
const NUM_COL = ["", "#4da3ff", "#4cd964", "#ff5a5a", "#a77bff", "#ffb703", "#3ee6e0", "#fff", "#aaa"];
export default function Minefield({ onFinish, accentColor }) {
  return (
    <ArcadeCanvas
      W={480} H={640} accentColor={accentColor} onFinish={onFinish} title="MINEFIELD"
      hint={"Numbers show how many mines touch a square.\nTap to dig. Hold, right-click or press the\nFLAG button to plant a flag. Clear it to level up."}
      make={(api) => {
        const { W } = api;
        let level = 1, score = 0, flagMode = false, board, over = 0, held = null, time = 0, started = false, msg = "", msgT = 0;
        const cfg = (L) => { const cols = Math.min(10, 6 + L), rows = Math.min(12, 8 + L); return { cols, rows, mines: Math.min(Math.round(cols * rows * 0.22), Math.round(cols * rows * (0.12 + 0.012 * L))) }; };
        const cell = () => Math.floor(448 / board.cols), gx = () => (W - cell() * board.cols) / 2, gy = 100;
        function fresh() {
          const c = cfg(level); board = { ...c, cells: Array.from({ length: c.cols * c.rows }, () => ({ m: false, n: 0, open: false, flag: false })), placed: false, left: c.cols * c.rows - c.mines };
          time = 0; started = false;
        }
        const nb = (i) => { const { cols, rows } = board, x = i % cols, y = (i / cols) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && X < cols && Y >= 0 && Y < rows) out.push(Y * cols + X); } return out; };
        function place(safe) {
          const avoid = new Set([safe, ...nb(safe)]); let n = 0;
          while (n < board.mines) { const i = (Math.random() * board.cells.length) | 0; if (!board.cells[i].m && !avoid.has(i)) { board.cells[i].m = true; n++; } }
          board.cells.forEach((c, i) => { c.n = nb(i).filter((j) => board.cells[j].m).length; }); board.placed = true; started = true;
        }
        function open(i) {
          const c = board.cells[i]; if (c.open || c.flag) return;
          if (!board.placed) place(i);
          if (c.m) { c.open = true; board.cells.forEach((q) => { if (q.m) q.open = true; }); over = 1; api.sfx.lose(); api.haptics.success(); setTimeout(() => api.finish(score), 500); return; }
          const stack = [i];
          while (stack.length) { const k = stack.pop(), q = board.cells[k]; if (q.open || q.flag) continue; q.open = true; board.left--; score += 10; if (q.n === 0) nb(k).forEach((j) => { if (!board.cells[j].open) stack.push(j); }); }
          api.sfx.tap();
          if (board.left <= 0) { const bonus = 200 + Math.max(0, 300 - Math.floor(time) * 3) + level * 50; score += bonus; msg = `BOARD CLEARED +${bonus}`; msgT = 1.6; level++; api.sfx.win(); api.haptics.celebrate(); fresh(); }
        }
        function flag(i) { const c = board.cells[i]; if (c.open) return; c.flag = !c.flag; api.sfx.select(); api.haptics.tap(); }
        const at = (x, y) => { const cs = cell(), cx = Math.floor((x - gx()) / cs), cy = Math.floor((y - gy) / cs); return cx >= 0 && cx < board.cols && cy >= 0 && cy < board.rows ? cy * board.cols + cx : -1; };
        fresh();
        return {
          update(dt) { if (started && !over) time += dt; if (msgT > 0) msgT -= dt; if (held && !held.done && performance.now() - held.t > 450 && !over) { held.done = true; if (held.i >= 0) flag(held.i); } },
          pointer(type, x, y, e) {
            if (over) return;
            if (type === "down") {
              if (x > 320 && x < 464 && y > 20 && y < 64) { flagMode = !flagMode; api.sfx.click(); held = null; return; }
              const i = at(x, y); if (i < 0) return;
              if (e && (e.button === 2)) { flag(i); held = null; return; }
              held = { i, t: performance.now(), done: false };
            }
            if (type === "up" && held) { const h = held; held = null; if (h.done || h.i < 0) return; if (at(x, y) !== h.i) return; if (flagMode) flag(h.i); else open(h.i); }
          },
          draw(ctx) {
            ctx.fillStyle = "#0a061c"; ctx.fillRect(0, 0, W, 640);
            text(ctx, `LEVEL ${level}`, 16, 28, 11, "#fff"); text(ctx, `SCORE ${score}`, 16, 52, 10, api.accent);
            const flags = board.cells.filter((c) => c.flag).length; text(ctx, `⚑ ${board.mines - flags}`, 250, 28, 11, "#ff3ea5", "center"); text(ctx, `${Math.floor(time)}s`, 250, 52, 10, "#a99fd6", "center");
            ctx.fillStyle = flagMode ? "#ff3ea5" : api.accent; ctx.fillRect(320, 20, 144, 44); text(ctx, flagMode ? "FLAG ⚑" : "DIG ⛏", 392, 43, 11, "#0a061c", "center");
            const cs = cell(), ox = gx();
            board.cells.forEach((c, i) => {
              const x = ox + (i % board.cols) * cs, y = gy + ((i / board.cols) | 0) * cs;
              if (!c.open) { ctx.fillStyle = "#3b2f6b"; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); ctx.fillStyle = "#5646a0"; ctx.fillRect(x + 1, y + 1, cs - 2, 4); ctx.fillRect(x + 1, y + 1, 4, cs - 2); if (c.flag) text(ctx, "⚑", x + cs / 2, y + cs / 2 + 1, cs * 0.5, "#ff3ea5", "center"); }
              else { ctx.fillStyle = c.m ? "#7a1f3b" : "#17102f"; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2); if (c.m) { ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.24, 0, 7); ctx.fill(); } else if (c.n) text(ctx, String(c.n), x + cs / 2, y + cs / 2 + 1, cs * 0.5, NUM_COL[c.n], "center"); }
            });
            if (msgT > 0) { ctx.fillStyle = "rgba(10,6,28,0.8)"; ctx.fillRect(0, 300, W, 50); text(ctx, msg, W / 2, 325, 13, "#ffb703", "center"); }
          },
        };
      }}
    />
  );
}
