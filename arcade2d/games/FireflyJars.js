"use client";
// Firefly Jars — a light puzzle (free). Tap a jar to flip it and the jars around it. Wake every firefly.
// 4 worlds, 20 levels. Every level was made by the level maker and solved by the automatic solver.
import { createKitGame } from "../shell/Kit";
import { FireflySession, NO_INPUT } from "./firefly/session";
import { WORLDS, FLAT, describeLevel } from "./firefly/levels";

const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });

const def = {
  id: "fireflyjars", title: "Firefly Jars", titleSize: 62, genreLabel: "Light puzzle · Free", accent: "#ffd23f", music: "puzzle",
  touch: [B("alt", "UNDO", 858, 420, 70, { fs: 13 })],
  tagline: "Tap a jar. Wake every firefly.",
  goal: "Every jar holds a sleeping or glowing firefly. Tapping a jar flips it and some of the jars around it, depending on the world. Make every firefly glow to finish the level. Tapping the same jar twice cancels out, so each jar only ever needs one tap or none.",
  controls: [["Click a jar", "Flip it and its neighbours"], ["Arrow keys, then Space", "Pick a jar and tap it"], ["U or Backspace", "Undo your last tap"], ["R", "Restart the level"], ["P or Esc", "Pause"]],
  touchControls: [["Tap a jar", "Flip it and its neighbours"], ["UNDO", "Take back your last tap"]],
  tips: ["Move the pointer over a jar to see which jars would flip. The dashed outlines show it.", "Work row by row: fix the top row first, then use the jars below to fix it without changing it.", "A jar never needs more than one tap. If you tapped it twice, that was wasted.", "Frozen jars cannot be tapped, but their neighbours can still wake them."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new FireflySession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    const lv = FLAT.find((l) => l.id === "1-2") || FLAT[0];
    let S = null, i = 0, wait = 0, rest = 0;
    const make = () => { S = new FireflySession(lv, { save: null }, { quiet: true, bare: true, demo: true, cs: 70, cx: 718, cy: 292 }); i = 0; wait = 1.2; rest = 0; };
    make();
    return {
      update(dt) { S.update(dt, NO_INPUT, env); if (S.state === "play") { wait -= dt; if (wait <= 0 && i < lv.sol.length) { S.tapJar(lv.sol[i++]); wait = 0.7; } } else { rest += dt; if (rest > 2.4) make(); } },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as FIREFLY_DEF };
