"use client";
// Hollow Deep — a top-down dungeon fighter (Power Pass). Swing, dash, deflect arrows and take down the boss at the end of every depth.
// 4 depths, 20 floors. Every floor was cleared with all three stars by the automatic hero (bot.js).
import { createKitGame } from "../shell/Kit";
import { HollowSession, NO_INPUT } from "./hollow/session";
import { WORLDS, FLAT, describeLevel } from "./hollow/levels";

const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });

const def = {
  id: "hollowdeep", title: "Hollow Deep", titleSize: 66, genreLabel: "Dungeon fighter · Power Pass", accent: "#8f7bff", music: "spooky",
  touch: [B("up", "▲", 74, 354, 62), B("left", "◀", 8, 418, 62), B("right", "▶", 140, 418, 62), B("down", "▼", 74, 480, 56), B("fire", "SWING", 846, 404, 100, { fs: 16 }), B("alt", "DASH", 738, 450, 70, { fs: 13 }), B("jump", "BOLT", 858, 306, 66, { fs: 13 })],
  tagline: "Swing your sword, dash through danger and take down the boss at the bottom of every depth.",
  goal: "Each floor is one room full of monsters that arrive in waves. Defeat them all to open the stairs. Swing your sword to hit monsters and knock arrows out of the air, dash to slip through attacks, and fire sparks from a distance. Find the hidden relic chest and keep at least three hearts for all three stars.",
  controls: [["Arrow keys or WASD", "Move"], ["X, J or click", "Swing your sword (click aims at the mouse)"], ["Shift or C", "Dash (you cannot be hit while dashing)"], ["Space, Z or K", "Fire a spark (3 charges, they refill)"], ["R", "Restart the floor"], ["P or Esc", "Pause"]],
  touchControls: [["Arrow buttons", "Move"], ["SWING", "Slash with your sword"], ["DASH", "Dash through attacks"], ["BOLT", "Fire a spark"]],
  tips: ["Swing at an arrow or a spark to knock it away.", "A brute glows red before it charges. Step aside and it will crash into the wall and get dizzy.", "Spikes flash just before they pop up.", "Hearts drop now and then, so do not be afraid to take a hit.", "Keep moving. A moving hero is a hard target.", "Spend your sparks on archers and wisps that stay far away."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new HollowSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the hero fights through a floor all by itself
    const ids = ["1-3", "2-2", "3-1"]; let n = 0;
    let S = null, rest = 0;
    const make = () => { const id = ids[n++ % ids.length], lv = FLAT.find((l) => l.id === id); S = new HollowSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); rest = 0; };
    make();
    return {
      update(dt) { S.update(dt, NO_INPUT, env); if (S.state !== "play") { rest += dt; if (rest > 1.8) make(); } },
      draw(g) { g.save(); g.translate(494, 108); g.scale(0.48, 0.48); S.draw(g, env); g.restore(); },
    };
  },
};

export default createKitGame(def);
export { def as HOLLOW_DEF };
