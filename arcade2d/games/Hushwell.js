"use client";
// Hushwell — a quiet, dark puzzle-escape (free). Nine chapters, no words, one small kid and a very big building.
import { createKitGame } from "../shell/Kit";
import { SideSession, SideBot } from "../core/side";
import { hushLevel, HUSH_WORLDS } from "./hushwell/levels";

const touch = [
  { act: "left", label: "◀", x: 22, y: 420, d: 84 }, { act: "right", label: "▶", x: 124, y: 420, d: 84 }, { act: "down", label: "▼", x: 70, y: 340, d: 64 },
  { act: "jump", label: "JUMP", x: 834, y: 404, d: 104, fs: 18 },
];
const CFG = { mode: "puzzle", relicName: "Spark", relicColor: "#8be9ff", coinName: "Scrap", coinColor: "#e8c46a", exitColor: "#ffe9a6", boxColor: "#8d6b47", kid: { body: "#d94a4a", accent: "#efd2b4", hair: "#2f2420" }, hideColor: "#2d4a36" };

const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "hushwell", title: "Hushwell", titleSize: 92, genreLabel: "Puzzle escape · Free", accent: "#ff6b6b", music: "puzzle", touch,
  tagline: "A quiet little kid. A very big, very silent building. Find out what is humming at the bottom.",
  goal: "Reach the glowing door in every chapter. Push crates onto plates to open gates, dodge the traps, hide from the guards and collect 3 Sparks for 3 stars.",
  controls: [["← → or A D", "Walk"], ["Space or W", "Jump"], ["↓ or S", "Crouch (hold in tall grass to hide)"], ["Walk into a crate", "Push it"], ["P or Esc", "Pause"]],
  touchControls: [["◀  ▶", "Walk"], ["JUMP", "Jump"], ["▼", "Crouch / hide in grass"]],
  tips: ["Crates hold plates down for you. Plates and gates share a colour.", "Checkpoints save you when something goes wrong. It will.", "Crouching makes guards see you from half as far.", "Chase chapters: don't stop, don't look back."],
  worlds: HUSH_WORLDS.map((w) => ({ ...w, levels: w.levels.map(([id, name, desc]) => ({ id, label: id, name, desc })) })),
  makeSession: (level, ctx) => new SideSession({ ...hushLevel(level.id), id: level.id }, ctx, CFG),
  createIdle(env) {
    let S = null, stuck = 0, bestX = 0; const make = () => { S = new SideSession({ ...hushLevel("1-1"), id: "demo" }, { save: null }, CFG, { quiet: true, bot: new SideBot() }); stuck = 0; bestX = 0; }; make();
    return { update(dt) { S.update(dt, null, env); if (S.hero.x > bestX + 20) { bestX = S.hero.x; stuck = 0; } else stuck += dt; if (S.finished || S.hero.dead && S.hero.deadT > 0.8 || stuck > 6 || S.hero.x > 60 * 48) make(); }, draw(g) { S.draw(g, env); } };
  },
};
export default createKitGame(def);
export { def as HUSHWELL_DEF };
