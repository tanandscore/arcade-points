"use client";
// Snip & Drop — a rope-cutting physics puzzle (free). Feed the critter the berry, grab the stars. 4 worlds, 20 levels, every level solved by the automatic player.
import { createKitGame } from "../shell/Kit";
import { SnipSession, NO_INPUT } from "./snip/session";
import { WORLDS, FLAT, describeLevel } from "./snip/levels";

const def = {
  id: "snipdrop", title: "Snip & Drop", titleSize: 80, genreLabel: "Rope puzzle · Free", accent: "#4fd1ff", music: "sunny", touch: "none",
  tagline: "Snip the ropes in the right order and guide the glowing berry to a hungry critter.",
  goal: "Swipe across a rope to cut it. Work out which rope to cut, and when, so the berry swings and drops into the critter's mouth. Grab all three stars on the way for a perfect score. Tap bubbles to pop them, and keep the berry away from spikes!",
  controls: [["Swipe across a rope", "Cut it"], ["Click a bubble", "Pop it"], ["1 2 3 ...", "Cut the ropes from left to right"], ["Space", "Pop a bubble"], ["R", "Restart the level"], ["P or Esc", "Pause"]],
  touchControls: [["Swipe across a rope", "Cut it"], ["Tap a bubble", "Pop it"], ["Restart button", "Try the level again"]],
  tips: ["The berry swings like a pendulum. Cut at the bottom of the swing to throw it forwards.", "Cutting a rope early or late changes where the berry lands. Try again, it is free!", "A bubble lifts the berry up. Pop it when the berry is above where you want it to fall.", "Spikes are the only thing that is truly dangerous. Falling off the screen just means trying again.", "You get 3 stars for collecting all three stars, so plan a path through them.", "The critter opens wide when the berry is close. Watch its eyes!"],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new SnipSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the critter gets fed by itself, over and over
    const lv = FLAT.find((l) => l.id === "1-2") || FLAT[0];
    let S = null, wait = 0, rest = 0;
    const make = () => { S = new SnipSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); wait = 0; rest = 0; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "play") for (const a of lv.sol) { if (!a.done && S.S.t >= a.t + 1.0) { a.done = true; if (a.cut != null) S.cut(a.cut); else S.pop(a.pop); } }
        else { rest += dt; if (rest > 2.2) { for (const a of lv.sol) a.done = false; make(); } }
      },
      draw(g) { g.save(); g.translate(472, 96); g.scale(0.52, 0.52); S.draw(g, env); g.restore(); },
    };
  },
};

export default createKitGame(def);
export { def as SNIP_DEF };
