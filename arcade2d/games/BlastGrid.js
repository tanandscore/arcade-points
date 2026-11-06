"use client";
// Blast Grid — a turn-based bomb puzzle (free). Drop bombs, break crates, grab gems, outsmart the bots and reach the door.
// 4 worlds, 20 levels. Every level was solved by the automatic solver.
import { createKitGame } from "../shell/Kit";
import { BlastSession, NO_INPUT } from "./blast/session";
import { WORLDS, FLAT, describeLevel } from "./blast/levels";

const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });

const def = {
  id: "blastgrid", title: "Blast Grid", titleSize: 84, genreLabel: "Bomb puzzle · Free", accent: "#ff5a5a", music: "sunny",
  touch: [B("up", "▲", 74, 354, 62), B("left", "◀", 8, 418, 62), B("right", "▶", 140, 418, 62), B("down", "▼", 74, 480, 56), B("jump", "BOMB", 846, 404, 100, { fs: 17 }), B("fire", "WAIT", 738, 450, 70, { fs: 13 }), B("alt", "UNDO", 858, 306, 66, { fs: 13 })],
  tagline: "Drop bombs, break crates and outsmart the bots.",
  goal: "Every step you take is one turn. After your move the bots step and every bomb ticks down. A bomb blows up three turns after you drop it, in a cross that is stopped by walls and breaks the first crate it hits. Blast the bots, grab the gems and walk into the door. You only get a few bombs, so plan before you drop one. Undo is always free!",
  controls: [["Arrow keys or WASD", "Step one square"], ["Space or Z", "Drop a bomb"], ["X", "Wait one turn"], ["U or Backspace", "Undo your last turn"], ["R", "Restart the level"], ["Click a square", "Walk there (click yourself to drop a bomb)"], ["P or Esc", "Pause"]],
  touchControls: [["Arrow buttons", "Step one square"], ["BOMB", "Drop a bomb"], ["WAIT", "Skip a turn"], ["UNDO", "Take back your last turn"], ["Tap a square", "Walk there (tap yourself to drop a bomb)"]],
  tips: ["Red squares show where a bomb will burn. Be somewhere else when it hits zero.", "Blasts stop at walls and at the first crate, so crates are also a shield.", "A bomb caught in another blast goes off at once. Chains save bombs.", "Red bots walk straight and turn right at a wall. Purple hunters follow you, but only every second turn.", "Some gems and even the door hide inside crates.", "The 3rd star needs every gem and few bombs. Try again with the Undo button, it costs nothing."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new BlastSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen a little hero plays level 1-3 all by itself, one step at a time
    const lv = FLAT.find((l) => l.id === "1-3") || FLAT[0];
    let S = null, i = 0, wait = 0, rest = 0;
    const make = () => { S = new BlastSession(lv, { save: null }, { quiet: true, bare: true, demo: true, cs: 40, cx: 718, cy: 292 }); i = 0; wait = 1.2; rest = 0; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "play") { wait -= dt; if (wait <= 0 && i < lv.sol.length) { S.apply(lv.sol[i++]); wait = lv.sol[i - 1] === "B" ? 0.3 : 0.26; } if (i >= lv.sol.length) { rest += dt; if (rest > 1.6) make(); } }
        else { rest += dt; if (rest > 2) make(); }
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as BLAST_DEF };
