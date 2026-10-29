"use client";
// Starline Vanguard — a side-scrolling space shooter (Power Pass). Your ship fires by itself: dodge, grab power-ups, drop Nova bombs and beat the bosses.
// 4 sectors, 20 stages. Every stage was cleared by the automatic pilot.
import { createKitGame } from "../shell/Kit";
import { StarSession, NO_INPUT } from "./starline/session";
import { WORLDS, FLAT, describeLevel } from "./starline/levels";

const B = (act, label, x, y, d, extra = {}) => ({ act, label, x, y, d, ...extra });

const def = {
  id: "starlinevanguard", title: "Starline Vanguard", titleSize: 54, genreLabel: "Space shooter · Power Pass", accent: "#38bdf8", music: "space",
  touch: [B("alt", "NOVA", 846, 410, 96, { fs: 17 })],
  tagline: "Fly the last fighter of the Starline fleet through four sectors of enemy fire.",
  goal: "Your ship fires on its own, so all you have to do is fly. Dodge the enemy fire, line up your shots and grab power-ups: P makes your guns stronger, S repairs a shield pip, N gives you a Nova bomb. A hit costs a shield pip and one weapon level. The Nova bomb wipes every bullet off the screen and hurts everything. Lose all your shield pips and the stage ends. The last stage of every sector ends with a boss. Finish without a hit for three stars.",
  controls: [["Arrow keys or WASD", "Fly"], ["Space, Z or X", "Nova bomb"], ["Click and drag", "Fly toward the pointer"], ["R", "Restart the stage"], ["P or Esc", "Pause"]],
  touchControls: [["Drag a finger", "Fly (your ship follows, just to the left of your finger)"], ["NOVA button", "Nova bomb"]],
  tips: ["Your hit circle is tiny. You can squeeze through gaps that look closer than they are.", "Stay on the left side so you have time to see bullets coming.", "A hit also knocks a level off your weapon, so S pickups matter twice.", "Boss walls always have a gap. Look for it early.", "Keep one Nova bomb for the boss.", "Shoot the glowing carriers: they drop the power-ups."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new StarSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen the autopilot flies stage 1-3 by itself
    const lv = FLAT.find((l) => l.id === "1-3") || FLAT[0];
    let S = null;
    const make = () => { S = new StarSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); };
    make();
    return {
      update(dt) { S.update(dt, NO_INPUT, env); },
      draw(g) { g.save(); g.translate(492, 78); g.scale(0.47, 0.47); S.draw(g, env); g.restore(); },
    };
  },
};

export default createKitGame(def);
export { def as STAR_DEF };
