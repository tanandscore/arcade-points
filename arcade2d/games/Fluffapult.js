"use client";
// Fluffapult — a slingshot physics game (free). Launch the Fluffs, topple the forts, pop the Sprockets. 4 worlds, 24 levels.
import { createKitGame } from "../shell/Kit";
import { FluffSession, NO_INPUT } from "./fluff/session";
import { WORLDS } from "./fluff/levels";

const def = {
  id: "fluffapult", title: "Fluffapult", titleSize: 84, genreLabel: "Physics puzzle · Free", accent: "#ff3ea5", music: "sunny", touch: "none",
  tagline: "Launch the Fluffs, topple the wobbly forts and pop every Sprocket!",
  goal: "Pull the slingshot back and let go to fling a Fluff at the Sprockets' fort. Pop every Sprocket to win. The fewer Fluffs you use and the more you smash, the more stars you earn!",
  controls: [["Drag + release", "Pull the sling back and fling"], ["Click in the air", "Use the Fluff's power"], ["← → ↑ ↓ then Space", "Aim with the keyboard"], ["Drag the background", "Look around the level"], ["P or Esc", "Pause"]],
  touchControls: [["Drag back", "Pull the sling and let go"], ["Tap in the air", "Use the Fluff's power"], ["Drag the scenery", "Look around the level"]],
  tips: ["Hit the weak spots: the posts that hold everything up.", "Glass and ice break easily. Stone needs a heavy Fluff or a big boom.", "Tap in the air at the right moment: Zip dashes, Trio splits, Boomer blows up.", "Every Fluff left over at the end is worth 10,000 bonus points!", "TNT crates explode and take the neighbours with them."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: l.desc })) })),
  makeSession: (level, ctx) => new FluffSession(level, ctx),
  createIdle(env) {
    // a quiet demo behind the title screen: Fluffs keep knocking over a little fort
    const lv = { id: "1-4", wi: 0, li: 3, name: "", label: "" };
    const shots = [[0.244, 0.9], [0.384, 1], [1.222, 0.9], [0.3, 0.95]];   // found by the robot player: they really do topple the towers
    let S = null, k = 0, wait = 0;
    const make = () => { S = new FluffSession(lv, { save: null }, { quiet: true, noIntro: true }); S.bare = true; S.homeX = 360; S.cam.x = 360; S.updateCamera = () => {}; wait = 1.2; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "ready" && S.cur && !S.hopper) { wait -= dt; if (wait <= 0) { const s = shots[k++ % shots.length]; S.fire(s[0], s[1]); wait = 1.4; } }
        if (S.state === "fly") { const b = S.flying[0]; if (b && !b.used && b.t > 0.55 && b.type !== "pom") S.tap(); }
        if (S.state === "win" || S.state === "lose" || (S.state === "settle" && S.queue.length === 0 && S.stateT > 3)) { if (S.winT > 2.2 || S.state === "settle") make(); }
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as FLUFF_DEF };
