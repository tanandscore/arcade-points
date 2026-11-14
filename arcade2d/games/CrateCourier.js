"use client";
// Crate Courier — a warehouse pushing puzzle (free). Push every crate onto a glowing pad. Ice makes crates slide, holes swallow them.
// 4 worlds, 20 levels. Every level was solved by the automatic solver.
import { createKitGame } from "../shell/Kit";
import { CrateSession, NO_INPUT } from "./crate/session";
import { WORLDS, FLAT, describeLevel } from "./crate/levels";

const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });

const def = {
  id: "cratecourier", title: "Crate Courier", titleSize: 66, genreLabel: "Pushing puzzle · Free", accent: "#ff9d2e", music: "puzzle",
  touch: [B("up", "▲", 74, 354, 62), B("left", "◀", 8, 418, 62), B("right", "▶", 140, 418, 62), B("down", "▼", 74, 480, 56), B("alt", "UNDO", 858, 420, 70, { fs: 13 })],
  tagline: "Push every crate onto its pad. Think first, shove second.",
  goal: "Walk into a crate to push it one square. You can only push, never pull, and a crate cannot be pushed into a wall or another crate. Cover every glowing pad to finish. On ice a pushed crate keeps sliding until something stops it. A crate pushed into a hole fills it, and the hole turns into floor. Fewer moves earn more stars.",
  controls: [["Arrow keys or WASD", "Walk and push"], ["U or Backspace", "Undo your last move"], ["R", "Restart the level"], ["Click a square", "Walk there"], ["P or Esc", "Pause"]],
  touchControls: [["Arrow buttons", "Walk and push"], ["UNDO", "Take back your last move"], ["Tap a square", "Walk there"]],
  tips: ["Before you push, look at where the crate will end up. A crate against a wall can never leave it.", "Park crates on pads that are far from you first, then do the easy ones.", "On ice, aim the push: the crate will not stop until it hits something.", "Undo is free. Use it as often as you like.", "Holes need exactly one crate each. Count them before you start."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new CrateSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the courier solves level 1-3 all by itself
    const lv = FLAT.find((l) => l.id === "1-3") || FLAT[0];
    let S = null, i = 0, wait = 0, rest = 0;
    const make = () => { S = new CrateSession(lv, { save: null }, { quiet: true, bare: true, demo: true, cs: 44, cx: 718, cy: 292 }); i = 0; wait = 1.2; rest = 0; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "play") { wait -= dt; if (wait <= 0 && i < lv.sol.length) { S.apply(lv.sol[i++]); wait = 0.3; } }
        else { rest += dt; if (rest > 2.2) make(); }
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as CRATE_DEF };
