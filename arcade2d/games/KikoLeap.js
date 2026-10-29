"use client";
// Kiko Leap — a bouncy platform adventure (free). Four worlds, 24 levels, a boss at the end of every world.
import { createKitGame } from "../shell/Kit";
import { KikoSession } from "./kiko/session";
import { Bot } from "./kiko/bot";
import { worldDefs } from "./kiko/level";

const touch = [
  { act: "left", label: "◀", x: 22, y: 420, d: 84 }, { act: "right", label: "▶", x: 124, y: 420, d: 84 },
  { act: "jump", label: "JUMP", x: 834, y: 404, d: 104, fs: 18 }, { act: "fire", label: "RUN", x: 726, y: 440, d: 76, fs: 15 }, { act: "down", label: "▼", x: 770, y: 340, d: 64 },
];

const def = {
  id: "kikoleap", title: "Kiko Leap", titleSize: 88, genreLabel: "Platformer · Free", accent: "#3ee6e0", music: "sunny", touch,
  tagline: "A bouncy platform adventure across four worlds. Stomp, float and smash your way to the flag!",
  goal: "Reach the flag at the end of every level. Collect the 3 big Star Seeds and beat the par time to earn 3 stars. At the end of each world a boss is waiting!",
  controls: [["← → or A D", "Run"], ["Space or Z", "Jump (hold for higher)"], ["Jump again, hold", "Float in mid-air"], ["↓ or S in the air", "Ground-pound"], ["X, J or Shift", "Hold to sprint"], ["P or Esc", "Pause"]],
  touchControls: [["◀  ▶", "Run left and right"], ["JUMP", "Jump (hold for higher)"], ["JUMP again, hold", "Float in mid-air"], ["RUN", "Tap to switch sprint on or off"], ["▼", "Ground-pound in the air"]],
  tips: ["Land on enemies' heads to squash them. Spikebacks need a ground-pound!", "Hold sprint before a jump to clear wide gaps.", "Press jump again in mid-air and hold it to float — you can do it once per jump.", "Checkpoint flags refill all your hearts.", "Bosses get dizzy after their big attack. That is your moment to stomp!"],
  worlds: worldDefs(),
  makeSession: (level, ctx) => new KikoSession(level, ctx),
  createIdle(env) {
    let S = null, bestX = 0, stuck = 0;
    const make = () => { S = new KikoSession({ id: "demo", wi: 0, li: 0, name: "", label: "" }, { save: null }, { quiet: true, bot: new Bot({ sprint: true }), camShift: -190 }); bestX = 0; stuck = 0; };
    make();
    return {
      update(dt) {
        S.update(dt, null, env);
        // start over if the little bot dies, finishes or gets stuck for a while
        if (S.hero.x > bestX + 24) { bestX = S.hero.x; stuck = 0; } else stuck += dt;
        if (S.finished || S.hero.y > 1500 || stuck > 8 || (S.hero.dead && S.hero.deadT > 0.3)) make();
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as KIKO_DEF };
