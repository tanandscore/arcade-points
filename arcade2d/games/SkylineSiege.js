"use client";
// Skyline Siege — a run-and-gun action game (Power Pass). Sixteen missions across four districts, a boss at the end of each.
import { createKitGame } from "../shell/Kit";
import { SiegeSession } from "./siege/session";
import { Bot } from "./siege/bot";
import { DISTRICTS, MISSIONS } from "./siege/levels";

const touch = [
  { act: "left", label: "◀", x: 18, y: 428, d: 82 }, { act: "right", label: "▶", x: 108, y: 428, d: 82 },
  { act: "up", label: "▲", x: 63, y: 342, d: 68 }, { act: "down", label: "▼", x: 200, y: 446, d: 62 },
  { act: "jump", label: "JUMP", x: 846, y: 428, d: 84, fs: 16 }, { act: "fire", label: "FIRE", x: 738, y: 414, d: 98, fs: 18 },
  { act: "alt", label: "BOMB", x: 740, y: 314, d: 66, fs: 13 }, { act: "swap", label: "SWAP", x: 842, y: 330, d: 62, fs: 12 },
];

const def = {
  id: "skylinesiege", title: "Skyline Siege", titleSize: 80, genreLabel: "Run & Gun · Power Pass", accent: "#ff8a1f", music: "city", touch,
  tagline: "Port Meridian is under siege. Run, gun and blast through sixteen missions and four towering bosses.",
  goal: "Fight to the exit of every mission. Rescue the 3 citizens, keep your combo going, and stay alive for 3 stars. At the end of each district a boss blocks the way!",
  controls: [["← → or A D", "Run"], ["Space, Z or K", "Jump (hold for higher)"], ["X, J or F", "Shoot (hold to keep firing)"], ["↑ (hold)", "Aim up. ↑ + direction aims diagonally"], ["↓ (hold)", "Duck. ↓ + Jump drops through a catwalk"], ["C, L or Shift", "Throw a grenade"], ["Q, E or Tab", "Swap guns"], ["P or Esc", "Pause"]],
  touchControls: [["◀  ▶", "Run left and right"], ["JUMP", "Jump (hold for higher)"], ["FIRE", "Shoot (hold to keep firing)"], ["▲ (hold)", "Aim up. ▲ + ◀ ▶ aims diagonally"], ["▼ (hold)", "Duck"], ["BOMB", "Throw a grenade"], ["SWAP", "Switch guns"]],
  tips: ["Shield Brutes block shots from the front. Lob a grenade over the shield, or shoot steeply down from a jump.", "Snipers show a red laser first. Move before it flashes white!", "Red barrels explode. Shoot them when enemies stand close.", "Grenades blow open brick walls. Secrets are hiding behind them.", "Kill quickly to build a combo: the multiplier goes up to x5.", "Checkpoints give you back some health and save your guns."],
  worlds: DISTRICTS.map((d, wi) => ({ name: d.name, short: d.short, theme: d.theme, music: d.music, blurb: d.blurb, levels: MISSIONS[wi].map((m) => ({ id: m.id, label: m.id, name: m.name, desc: m.desc })) })),
  makeSession: (level, ctx) => new SiegeSession(level, ctx),
  createIdle(env) {
    let S = null, bestX = 0, stuck = 0;
    const make = () => { S = new SiegeSession({ id: "demo", wi: 0, li: 0, name: "", label: "" }, { save: null }, { quiet: true, demo: true, bot: new Bot(), camShift: -190 }); bestX = 0; stuck = 0; };
    make();
    return {
      update(dt) {
        S.update(dt, null, env);
        // start over if the little bot dies, finishes, or has been going for a while
        if (S.hero.x > bestX + 24) { bestX = S.hero.x; stuck = 0; } else stuck += dt;
        if (S.finished || S.state === "win" || S.hero.y > 1500 || stuck > 8 || S.time > 45 || (S.hero.dead && S.hero.deadT > 0.3)) make();
      },
      draw(g) { S.draw(g, env); },
    };
  },
};

export default createKitGame(def);
export { def as SIEGE_DEF };
