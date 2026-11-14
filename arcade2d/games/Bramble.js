"use client";
// Bramble Rush — a fast, bouncy jungle run (free). Twelve long levels in three worlds. Stomp, roll and spring your way home.
import { createKitGame } from "../shell/Kit";
import { SideSession, SideBot } from "../core/side";
import { brambleLevel, BRAMBLE_WORLDS } from "./bramble/levels";
import { capsule, ellipse, circle, OUT } from "../core/draw";

function drawBram(g, H, t, cfg) {
  const moving = H.onGround && Math.abs(H.vx) > 30, sw = moving ? Math.sin(H.runT * 3) : 0, air = !H.onGround;
  g.save(); g.translate(H.x, H.y); g.scale(H.face >= 0 ? 1 : -1, 1);
  if (H.roll > 0) { g.translate(0, -16); g.rotate(H.runT * 6); ellipse(g, 0, 0, 17, 17, "#f08a3c", OUT, 2.5); ellipse(g, 4, 3, 9, 9, "#fde3b8", OUT, 2); g.restore(); return; }
  // tail
  g.save(); g.translate(-12, -16); g.rotate(-0.5 + Math.sin(t * 6) * 0.15 + (air ? -0.4 : 0)); ellipse(g, -8, 0, 14, 7, "#f08a3c", OUT, 2.5); ellipse(g, -17, 0, 6, 5, "#fff", OUT, 2); g.restore();
  capsule(g, -5, -10, -5 + Math.sin(air ? 0.7 : sw) * 8, -1, 8, "#d9712a", OUT, 2); capsule(g, 6, -10, 6 + Math.sin(air ? -0.4 : -sw) * 8, -1, 8, "#d9712a", OUT, 2);
  const bob = moving ? Math.abs(Math.sin(H.runT * 3)) * 2 : 0; g.translate(0, -bob);
  ellipse(g, 0, -20, 15, 15, "#f08a3c", OUT, 2.5); ellipse(g, 3, -16, 9, 10, "#fde3b8", null);
  capsule(g, 6, -22, 12 + sw * 4, -14 + (air ? -8 : 2), 6, "#f08a3c", OUT, 2);
  ellipse(g, 3, -36, 13, 12, "#f08a3c", OUT, 2.5); g.fillStyle = "#f08a3c"; g.beginPath(); g.moveTo(-5, -43); g.lineTo(-9, -55); g.lineTo(1, -46); g.fill(); g.stroke(); g.beginPath(); g.moveTo(8, -46); g.lineTo(14, -57); g.lineTo(16, -43); g.fill(); g.stroke();
  ellipse(g, 9, -33, 6, 5, "#fde3b8", null); circle(g, 11, -34, 2.2, "#111"); circle(g, 6, -38, 3, "#fff"); circle(g, 7, -38, 1.6, "#111");
  g.fillStyle = "#e84a5f"; g.fillRect(-4, -28, 14, 5);
  g.restore();
}
const touch = [
  { act: "left", label: "◀", x: 22, y: 420, d: 84 }, { act: "right", label: "▶", x: 124, y: 420, d: 84 },
  { act: "jump", label: "JUMP", x: 834, y: 404, d: 104, fs: 18 }, { act: "fire", label: "ROLL", x: 726, y: 440, d: 76, fs: 15 }, { act: "down", label: "▼", x: 770, y: 340, d: 64 },
];
const CFG = { mode: "run", relicName: "Sunstone", relicColor: "#ffd04a", coinName: "Berries", coinColor: "#ff5a7a", exitColor: "#fff3a0", art: { hero: drawBram } };
const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "bramblerush", title: "Bramble Rush", titleSize: 80, genreLabel: "Platformer · Free", accent: "#ff9a3c", music: "sunny", touch,
  tagline: "A fast, bouncy jungle run. Stomp, roll and spring your way through twelve long levels.",
  goal: "Reach the glowing portal at the end of every level. Grab all 3 golden Sunstones and beat the par time for 3 stars.",
  controls: [["← → or A D", "Run"], ["Space or W", "Jump (hold for higher)"], ["X, J or Shift", "Roll: smashes cracked blocks and bowls over walkers"], ["↓ + Jump", "Drop through planks"], ["P or Esc", "Pause"]],
  touchControls: [["◀  ▶", "Run"], ["JUMP", "Jump (hold for higher)"], ["ROLL", "Roll through blocks and walkers"], ["▼", "Drop through planks"]],
  tips: ["Land on enemies' heads to squash them. Touching their sides hurts.", "Roll smashes cracked blocks. Sunstones love to hide behind them.", "Crumbling planks fall a moment after you land. Keep moving.", "Hearts refill your health. Checkpoints keep your place."],
  worlds: BRAMBLE_WORLDS.map((w) => ({ ...w, levels: w.levels.map(([id, name, desc]) => ({ id, label: id, name, desc })) })),
  makeSession: (level, ctx) => new SideSession({ ...brambleLevel(level.id), id: level.id }, ctx, CFG),
  createIdle(env) {
    let S = null, stuck = 0, bestX = 0; const make = () => { S = new SideSession({ ...brambleLevel("1-1"), id: "demo" }, { save: null }, CFG, { quiet: true, bot: new SideBot() }); stuck = 0; bestX = 0; }; make();
    return { update(dt) { S.update(dt, null, env); if (S.hero.x > bestX + 20) { bestX = S.hero.x; stuck = 0; } else stuck += dt; if (S.finished || (S.hero.dead && S.hero.deadT > 0.8) || stuck > 5) make(); }, draw(g) { S.draw(g, env); } };
  },
};
export default createKitGame(def);
export { def as BRAMBLE_DEF };
