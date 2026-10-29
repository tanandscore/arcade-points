"use client";
// Gem Garden — a match-3 puzzle game (free). Swap gems, bloom the soil, break the crates and carry the golden acorns home.
// 4 gardens, 24 levels.
import { createKitGame } from "../shell/Kit";
import { GemSession, NO_INPUT } from "./gem/session";
import { WORLDS, FLAT, describeGoals } from "./gem/levels";
import { pickMove } from "./gem/bot";

const def = {
  id: "gemgarden", title: "Gem Garden", titleSize: 84, genreLabel: "Match-3 puzzle · Free", accent: "#c06bff", music: "puzzle", touch: "none",
  tagline: "Swap, match and blast your way through four sparkling gardens.",
  goal: "Swap two neighbouring gems to line up three or more of the same kind. Reach each garden's goals before the moves run out: collect gems, bloom the soil, break the crates and carry the golden acorns down to the roots. Moves you do not need turn into fireworks at the end!",
  controls: [["Click a gem, then a neighbour", "Swap them"], ["Drag a gem", "Slide it one square"], ["Arrow keys + Space", "Move the cursor, pick, swap"], ["Hammer button or C", "Smash one gem or crate"], ["H", "Show a hint"], ["P or Esc", "Pause"]],
  touchControls: [["Tap a gem, then tap next to it", "Swap them"], ["Swipe a gem", "Slide it one square"], ["Hammer button", "Smash one gem or crate"]],
  tips: ["Match four in a row to make a Line gem. It clears a whole row or column.", "Make an L, T or plus shape to get a Blast gem that clears a 3 by 3 square.", "Match five in a row for a Prism. Swap it with any gem to clear every gem of that colour.", "Swap two special gems together for a huge combo.", "Matches next to a crate crack it. Special gems smash crates at once.", "An acorn can swap with the gem right under it, the quickest way to bring it home."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeGoals(l) })) })),
  makeSession: (level, ctx) => new GemSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // a quiet demo behind the title screen: the board plays itself, one calm move at a time
    const lv = FLAT[2];
    let S = null, wait = 0;
    const make = () => { S = new GemSession(lv, { save: null }, { quiet: true, noIntro: true, bare: true, demo: true, cx: 706, cy: 290 }); wait = 1.4; };
    make();
    return {
      update(dt) {
        S.update(dt, NO_INPUT, env);
        if (S.state === "idle") {
          wait -= dt;
          if (wait <= 0) { const m = S.board.moves > 1 ? pickMove(S.board, 0.4, S.board.movesUsed) : null; if (m) { S.requestSwap(m[0], m[1], m[2], m[3]); wait = 0.9; } else make(); }
        }
        if (S.done) make();
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as GEM_DEF };
