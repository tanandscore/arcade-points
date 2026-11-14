// Ember Deck: 4 worlds, 20 battles. Every battle has its own enemies and a deck that grows as you climb (the cards you "earned" on the way).
// Before each battle you also get to add one extra card to your deck (pick 1 of 3, or skip). The automatic player in bot.js has won every battle.
import { STARTER, CARDS } from "./rules";

const ADDS = ["cleave", "fireball", "shield", "flurry", "insight", "stoke", "heavy", "weaken", "mend", "surge", "riposte", "inferno"];
const POOL = Object.keys(CARDS).filter((c) => !["strike", "guard", "bash"].includes(c));
const deckFor = (k) => STARTER.concat(ADDS.slice(0, Math.min(ADDS.length, Math.floor(k * 0.65) + 1)));
const L = (w, li, name, enemies, o = {}) => { const k = w * 5 + li; return { id: `${w + 1}-${li + 1}`, name, enemies, deck: deckFor(k), seedBase: 1000 + k * 77, bonusHp: o.hp || 0, startBlock: o.blk || 0, extraDraw: o.draw || 0, hint: o.hint, boss: enemies.some((e) => ["titan", "queen", "king", "lord"].includes(e)), elite: enemies.some((e) => ["knight", "serpent"].includes(e)) }; };

export const WORLDS = [
  { name: "Ash Road", short: "Ash", theme: "volcano", music: "tense", blurb: "A burnt road through the ash fields. Learn the basics: play cards, block, and watch what the enemy plans.",
    levels: [
      L(0, 0, "Cinder Alley", ["rat"], { hint: "Click a card to play it. Each card costs energy (the orbs). The red number above an enemy is the damage it will deal next turn. Block cancels it." }),
      L(0, 1, "Two Pests", ["rat", "wisp"], { hint: "With two enemies, click a card and then click the enemy you want to hit. Kill the dangerous one first." }),
      L(0, 2, "Slag Gate", ["brute"], { hint: "When an enemy shows a shield, it is blocking this turn. Save your big hits for when it attacks." }),
      L(0, 3, "Glass Shards", ["scorpion", "wisp"]),
      L(0, 4, "The Ash Titan", ["titan"], { hint: "A boss. Keep your block up when it shows a big attack, and strike when it prepares something else." }),
    ] },
  { name: "Glass Desert", short: "Glass", theme: "desert", music: "tense", blurb: "Razor-sharp dunes and quick imps. You start each battle with a little block.",
    levels: [
      L(1, 0, "Razor Dunes", ["scorpion", "rat"], { blk: 6 }),
      L(1, 1, "Imp Nest", ["imp", "imp"], { blk: 6 }),
      L(1, 2, "The Magma Knight", ["knight"], { blk: 8 }),
      L(1, 3, "Shatter Field", ["scorpion", "scorpion", "wisp"], { blk: 8 }),
      L(1, 4, "The Glass Queen", ["queen"], { blk: 10 }),
    ] },
  { name: "Frost Keep", short: "Frost", theme: "snow", music: "snow", blurb: "A frozen fortress. Wolves weaken you, golems wall up. Burn and Vulnerable shine here.",
    levels: [
      L(2, 0, "Wolf Pack", ["wolf", "wolf"], { blk: 8, draw: 1 }),
      L(2, 1, "The Ice Golem", ["golem"], { blk: 8, draw: 1 }),
      L(2, 2, "Crystal Serpent", ["serpent"], { blk: 10, draw: 1 }),
      L(2, 3, "Cold Company", ["wolf", "imp", "wisp"], { blk: 10, draw: 1 }),
      L(2, 4, "The Frost King", ["king"], { blk: 12, draw: 1 }),
    ] },
  { name: "Ember Throne", short: "Throne", theme: "dungeon", music: "boss", blurb: "The end of the road. Every enemy here is at full strength, and the Ember Lord waits on the throne.",
    levels: [
      L(3, 0, "Throne Hall", ["shade", "imp"], { blk: 10, draw: 1, hp: 6 }),
      L(3, 1, "Knight Watch", ["knight", "wisp"], { blk: 10, draw: 1, hp: 6 }),
      L(3, 2, "Frozen Embers", ["golem", "scorpion"], { blk: 12, draw: 1, hp: 6 }),
      L(3, 3, "Serpent's Gate", ["serpent", "imp"], { blk: 12, draw: 1, hp: 8 }),
      L(3, 4, "The Ember Lord", ["lord"], { blk: 14, draw: 1, hp: 14 }),
    ] },
];
export const FLAT = []; WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => FLAT.push({ ...l, wi, li })));
export const describeLevel = (l) => `${l.enemies.length} enem${l.enemies.length > 1 ? "ies" : "y"}${l.boss ? " · boss" : l.elite ? " · elite" : ""}`;
// the three cards offered before a battle (always the same three for the same level and attempt)
export function draftOptions(lv, attempt = 0) {
  let s = ((lv.seedBase + attempt * 131) >>> 0) || 1; const pool = POOL.slice(), out = [];
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
export const RANK = ["heavy", "fireball", "cleave", "shield", "flurry", "inferno", "stoke", "insight", "riposte", "weaken", "mend", "surge", "spark"];
