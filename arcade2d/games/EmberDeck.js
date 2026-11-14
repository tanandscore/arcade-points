"use client";
// Ember Deck — a card battler (Power Pass). Play cards with energy, read what each enemy is about to do and block, burn and smash your way up the road.
// 4 worlds, 20 battles. Every battle was won by the automatic player from many different shuffles.
import { createKitGame } from "../shell/Kit";
import { EmberSession, NO_INPUT } from "./ember/session";
import { WORLDS, FLAT, describeLevel } from "./ember/levels";

const def = {
  id: "emberdeck", title: "Ember Deck", titleSize: 84, genreLabel: "Card roguelite · Power Pass", accent: "#ff5d73", music: "tense",
  touch: "none",
  tagline: "Build a deck, read the enemy's plan and burn your way up the road.",
  goal: "Each battle is a turn-based card fight. On your turn you have 3 energy and a hand of 5 cards. Attack cards hurt enemies, skill cards give block, heal or draw, and power cards make you stronger. Above every enemy is a red icon showing exactly what it will do next turn, so you can block the big hit and strike when it is safe. Block wears off at the start of your next turn. Before each battle you can add one extra card to your deck. Win with plenty of health left for three stars.",
  controls: [["Click a card", "Play it (single-target cards: then click an enemy)"], ["Click End turn, or Enter / E", "Finish your turn"], ["1 to 9", "Play that card"], ["R", "Restart the battle"], ["P or Esc", "Pause"]],
  touchControls: [["Tap a card", "Play it (then tap an enemy for single-target cards)"], ["Tap End turn", "Finish your turn"]],
  tips: ["Read the red number over each enemy and block exactly that much.", "Vulnerable makes an enemy take half again as much damage. Play it before your big hits.", "Burn hurts at the start of the enemy's turn and fades by 1 each time. Great against bosses.", "Stoke gives you strength for the whole battle. Play it early.", "Kill the enemy that hits hardest first.", "Cards marked Exhaust vanish for the battle after you play them."],
  worlds: WORLDS.map((w) => ({ name: w.name, short: w.short, theme: w.theme, music: w.music, blurb: w.blurb, levels: w.levels.map((l) => ({ id: l.id, label: l.id, name: l.name, desc: describeLevel(l) })) })),
  makeSession: (level, ctx) => new EmberSession(FLAT.find((l) => l.id === level.id) || FLAT[level.index], ctx),
  createIdle(env) {
    // behind the title screen a battle plays itself
    const lv = FLAT.find((l) => l.id === "1-2") || FLAT[0];
    let S = null;
    const make = () => { S = new EmberSession(lv, { save: null }, { quiet: true, bare: true, demo: true }); };
    make();
    return {
      update(dt) { S.update(dt, NO_INPUT, env); },
      draw(g) { g.save(); g.translate(478, 70); g.scale(0.48, 0.48); g.translate(-0, -40); S.draw(g, env); g.restore(); },
    };
  },
};

export default createKitGame(def);
export { def as EMBER_DEF };
