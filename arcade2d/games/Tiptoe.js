"use client";
// Tiptoe — a tiny kid sneaking out of a house built for giants (free). Nine chapters of hiding, keys, crates and chases.
import { createKitGame } from "../shell/Kit";
import { SideSession, SideBot } from "../core/side";
import { tiptoeLevel, TIPTOE_WORLDS } from "./tiptoe/levels";

const touch = [
  { act: "left", label: "◀", x: 22, y: 420, d: 84 }, { act: "right", label: "▶", x: 124, y: 420, d: 84 }, { act: "down", label: "▼", x: 70, y: 340, d: 64 },
  { act: "jump", label: "JUMP", x: 834, y: 404, d: 104, fs: 18 },
];
const CFG = { mode: "puzzle", relicName: "Button", relicColor: "#ffd23a", coinName: "Crumbs", coinColor: "#e8b46a", exitColor: "#fff1b0", boxColor: "#b07a3a", kid: { body: "#f2c230", accent: "#f3d3b0", hair: "#5a3a22" }, hideColor: "#3a5a32" };
const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "tiptoe", title: "Tiptoe", titleSize: 100, genreLabel: "Stealth escape · Free", accent: "#f2c230", music: "puzzle", touch,
  tagline: "A very small kid in a very big house. Stay quiet. Stay hidden. Find the front door.",
  goal: "Sneak to the glowing exit in every chapter. Hide from the Keeper in tall grass, carry keys to locked doors, put crates on plates, and run when he sees you. Collect 3 golden Buttons for 3 stars.",
  controls: [["← → or A D", "Walk"], ["Space or W", "Jump"], ["↓ or S", "Crouch (hold in tall grass to hide)"], ["Walk into a crate", "Push it"], ["P or Esc", "Pause"]],
  touchControls: [["◀  ▶", "Walk"], ["JUMP", "Jump"], ["▼", "Crouch / hide in grass"]],
  tips: ["The Keeper only chases what he sees. Hold ▼ in the grass and he walks right past.", "Crouching halves how far he can see you.", "Crates hold plates down for you. Plates and gates share a number.", "When he spots you, do not hide. Run."],
  worlds: TIPTOE_WORLDS.map((w) => ({ ...w, levels: w.levels.map(([id, name, desc]) => ({ id, label: id, name, desc })) })),
  makeSession: (level, ctx) => new SideSession({ ...tiptoeLevel(level.id), id: level.id }, ctx, CFG),
  createIdle(env) {
    let S = null, stuck = 0, bestX = 0; const make = () => { S = new SideSession({ ...tiptoeLevel("1-1"), id: "demo" }, { save: null }, CFG, { quiet: true, bot: new SideBot() }); stuck = 0; bestX = 0; }; make();
    return { update(dt) { S.update(dt, null, env); if (S.hero.x > bestX + 20) { bestX = S.hero.x; stuck = 0; } else stuck += dt; if (S.finished || (S.hero.dead && S.hero.deadT > 0.8) || stuck > 6) make(); }, draw(g) { S.draw(g, env); } };
  },
};
export default createKitGame(def);
export { def as TIPTOE_DEF };
