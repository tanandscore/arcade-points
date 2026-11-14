"use client";
// Ironbloom Clash — a 2.5D one-on-one fighting game (Power Pass). Six fighters, a ladder of eight bouts, best of three rounds.
import { createKitGame } from "../shell/Kit";
import { FightSession } from "./brawl/fight";
import { LADDER } from "./brawl/roster";

const touch = [
  { act: "left", label: "◀", x: 14, y: 430, d: 72 }, { act: "right", label: "▶", x: 94, y: 430, d: 72 }, { act: "up", label: "▲", x: 54, y: 352, d: 66 }, { act: "down", label: "▼", x: 174, y: 440, d: 66 },
  { act: "fire", label: "P", x: 640, y: 440, d: 72, fs: 22 }, { act: "alt", label: "K", x: 724, y: 440, d: 72, fs: 22 }, { act: "swap", label: "H", x: 808, y: 424, d: 80, fs: 22 }, { act: "confirm", label: "OK", x: 880, y: 340, d: 58, fs: 14 },
];
const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "ironbloomclash", title: "Ironbloom Clash", titleSize: 78, genreLabel: "Fighting · Power Pass", accent: "#ff9a3c", music: "boss", touch,
  tagline: "Six fighters. Eight bouts. Fireballs, combos, throws and supers in a 2.5D fighting game.",
  goal: "Win two rounds out of three in every bout. Pick a fighter, learn the special moves, and fight up the ladder to the Ironbloom King. Win without losing a round for 2 stars, and finish with half your health for 3.",
  controls: [["← → or A D", "Walk (hold back to block)"], ["↑ or W / Space", "Jump"], ["↓ or S", "Crouch"], ["X, J or F", "Punch"], ["C, L or Shift", "Kick"], ["Q, E or Tab", "Heavy attack"], ["Punch + Kick together", "Throw (when close)"], ["↓ ↘ → + Punch", "Special: fireball (varies by fighter)"], ["→ ↓ ↘ + Punch", "Special: rising strike"], ["↓ ↙ ← + Kick", "Special: rush, slide or blink"], ["↓ ↘ → ↓ ↘ → + Punch", "SUPER (when the bar is full)"]],
  touchControls: [["◀ ▶ ▲ ▼", "Move, jump, crouch"], ["P  K  H", "Punch, kick, heavy"], ["P + K", "Throw"], ["Slide ▼ → ▶ then P", "Specials: use the arrows then tap a button fast"]],
  tips: ["Hold back to block. Low attacks need a crouching block.", "Sweeps and uppercuts launch your opponent. Light attacks chain into specials.", "Landing hits fills your super bar. Spend it with the double-fireball motion.", "Jump-ins lose to uppercuts. Throws beat blockers."],
  worlds: [
    { name: "Street Circuit", theme: "harbor", music: "city", blurb: "Four bouts to prove yourself.", levels: LADDER.slice(0, 4).map((l, i) => ({ id: `b${i + 1}`, label: `${i + 1}`, name: l.name, desc: l.tag, index: i })) },
    { name: "Grand Finals", theme: "volcano", music: "boss", blurb: "The champions are waiting.", levels: LADDER.slice(4).map((l, i) => ({ id: `b${i + 5}`, label: `${i + 5}`, name: l.name, desc: l.tag, index: i + 4 })) },
  ],
  makeSession: (level, ctx) => new FightSession({ ...level, index: level.index ?? 0 }, ctx, { remember: true, lastPick: typeof window !== "undefined" ? window.__clashPick : 0 }),
  createIdle(env) {
    let S = new FightSession({ id: "demo", index: 2 }, { save: null }, {}, { quiet: true, demo: true });
    return { update(dt) { S.update(dt, { pressed: () => false, held: () => false, axis: () => 0 }, env); }, draw(g) { S.draw(g, env); } };
  },
};
export default createKitGame(def);
export { def as BRAWL_DEF };
