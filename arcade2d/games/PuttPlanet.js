"use client";
// Putt Planet — space mini-golf (free). Drag back from the ball and let go. 4 planets, 20 holes, every hole solved by the automatic golfer.
import { createKitGame } from "../shell/Kit";
import { PuttSession, NO_INPUT } from "./putt/session";
import { WORLDS, FLAT, describeHole } from "./putt/levels";

const def = {
  id: "puttplanet", title: "Putt Planet", titleSize: 80, genreLabel: "Mini golf · Free", accent: "#3ee6e0", music: "calm", touch: "none",
  tagline: "Mini golf across the planets: bank it, boost it, bend it round a gas giant.",
  goal: "Get the ball into the cup in as few strokes as you can. Drag back from the ball like a slingshot and let go: the further you pull, the harder the putt. Walls bounce, sand grabs, ice slides, water and lava send you back with a one-stroke penalty. Finish in par for three stars!",
  controls: [["Drag back from the ball", "Aim and set the power"], ["Let go", "Putt"], ["Left / Right", "Turn the aim"], ["Up / Down", "More or less power"], ["Space or X", "Putt"], ["R", "Restart the hole"], ["P or Esc", "Pause"]],
  touchControls: [["Touch the ball and drag back", "Aim and set the power"], ["Let go", "Putt"], ["Tap while it rolls", "Speed up the ball"], ["Restart button", "Try the hole again"]],
  tips: ["The dotted line shows the first bounces of your shot. Use the walls like a pool table.", "Sand slows the ball a lot, ice barely slows it at all.", "A ball that is too fast will skip over the cup. Soft putts drop in more easily.", "Planets pull the ball towards them. Let them bend your shot around the course.", "Portals send the ball out of the twin portal at the same speed.", "Wait for the windmill: you can aim as long as you like while it spins."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeHole(l) })) })),
  makeSession: (level, ctx) => new PuttSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the ball plays the first holes by itself
    const holes = ["1-2", "1-3", "2-1"].map((id) => FLAT.find((l) => l.id === id)).filter(Boolean);
    let k = 0, S = null, shot = 0, wait = 0;
    const make = () => { const lv = holes[k++ % holes.length]; S = new PuttSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); shot = 0; wait = 1.3; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "aim") { wait -= dt; if (wait <= 0) { const sol = S.lv.sol[shot++]; if (sol) { S.setClock(sol[2]); S.shootDeg(sol[0], sol[1]); wait = 1.0; } else { wait = 2; } } }
        if (S.done || (S.state === "aim" && shot > S.lv.sol.length && wait < 0.2)) make();
      },
      draw(g) { g.save(); g.translate(478, 118); g.scale(0.5, 0.5); S.draw(g, env); g.restore(); },
    };
  },
};

export default createKitGame(def);
export { def as PUTT_DEF };
