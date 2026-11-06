// Hollow Deep: 4 depths, 20 floors. Each floor is one room with waves of monsters. The last floor of every depth is a boss.
// waves: [[monster, how many], ...] per wave. layout: the shape of the room. spikes: number of timed floor traps.
import { SOLVED } from "./solved";

export const WORLDS = [
  {
    name: "Mossy Crypt", short: "Crypt", theme: "forest", music: "spooky", look: 0, blurb: "Slimes, bats and bones. Learn to swing, dash and deflect.",
    levels: [
      { id: "1-1", name: "Cellar Door", layout: "open", seed: 11, waves: [[["slime", 2]], [["slime", 2], ["bat", 1]]], hint: "Move with the arrow keys or WASD. Swing your sword with X, dash with Shift or C. Clear the room, then take the stairs." },
      { id: "1-2", name: "Dripping Hall", layout: "pillars", pillars: 5, seed: 12, waves: [[["slime", 3]], [["slime", 2], ["bat", 2]]] },
      { id: "1-3", name: "Bone Lane", layout: "lanes", seed: 13, waves: [[["slime", 2], ["bat", 2]], [["archer", 1], ["slime", 2]]], hint: "Skeleton archers shoot arrows. Swing at an arrow to knock it out of the air." },
      { id: "1-4", name: "Coffin Room", layout: "chambers", seed: 14, waves: [[["bat", 3], ["slime", 2]], [["archer", 2], ["slime", 3]]] },
      { id: "1-5", name: "Crypt Warden", layout: "boss", seed: 15, waves: [[["warden", 1]]], hint: "The Warden charges when he glows. Step aside, then hit him while he is dizzy." },
    ],
  },
  {
    name: "Frost Vault", short: "Frost", theme: "snow", music: "snow", look: 1, blurb: "Cold halls, bigger brutes and many arrows.",
    levels: [
      { id: "2-1", name: "Icicle Hall", layout: "pillars", pillars: 6, seed: 21, waves: [[["slime", 3], ["archer", 1]], [["bat", 3], ["archer", 1]]] },
      { id: "2-2", name: "Frozen Stair", layout: "lanes", seed: 22, waves: [[["archer", 2], ["slime", 3]], [["brute", 1], ["bat", 2]]], hint: "Brutes are slow but hit for two hearts. Dash out of the way of their charge." },
      { id: "2-3", name: "Snowdrift", layout: "chambers", spikes: 4, seed: 23, waves: [[["brute", 1], ["slime", 3]], [["archer", 2], ["bat", 3]]], hint: "Spikes pop up on a timer. They flash just before they bite." },
      { id: "2-4", name: "Glacier Gate", layout: "cross", seed: 24, waves: [[["brute", 1], ["archer", 2]], [["brute", 1], ["bat", 3], ["slime", 2]]] },
      { id: "2-5", name: "Frost Queen", layout: "boss", seed: 25, waves: [[["queen", 1]]] },
    ],
  },
  {
    name: "Ember Halls", short: "Ember", theme: "volcano", music: "fire", look: 2, blurb: "Wisps fire three-way sparks and the floor bites back.",
    levels: [
      { id: "3-1", name: "Cinder Walk", layout: "pillars", pillars: 6, spikes: 6, seed: 31, waves: [[["wisp", 2], ["slime", 3]], [["brute", 1], ["bat", 3]]] },
      { id: "3-2", name: "Forge Floor", layout: "lanes", spikes: 6, seed: 32, waves: [[["wisp", 2], ["archer", 1], ["bat", 2]], [["brute", 2], ["slime", 2]]] },
      { id: "3-3", name: "Slag Pit", layout: "ring", spikes: 4, seed: 33, waves: [[["brute", 1], ["wisp", 2]], [["archer", 2], ["wisp", 1], ["bat", 3]]] },
      { id: "3-4", name: "Furnace Run", layout: "chambers", spikes: 8, seed: 34, waves: [[["brute", 2], ["archer", 1]], [["wisp", 3], ["bat", 3], ["slime", 2]]] },
      { id: "3-5", name: "Magma Golem", layout: "boss", spikes: 4, seed: 35, waves: [[["golem", 1]]] },
    ],
  },
  {
    name: "Void Sanctum", short: "Void", theme: "space", music: "tense", look: 3, blurb: "Everything at once, then the Eye.",
    levels: [
      { id: "4-1", name: "Whisper Hall", layout: "cross", seed: 41, waves: [[["wisp", 2], ["archer", 2], ["bat", 3]], [["brute", 2], ["wisp", 2]]] },
      { id: "4-2", name: "Shattered Floor", layout: "pillars", pillars: 7, spikes: 8, seed: 42, waves: [[["brute", 1], ["wisp", 2], ["slime", 3]], [["archer", 3], ["bat", 4]]] },
      { id: "4-3", name: "Mirror Maze", layout: "chambers", spikes: 6, seed: 43, waves: [[["wisp", 3], ["brute", 1], ["archer", 1]], [["brute", 2], ["wisp", 2], ["bat", 3]]] },
      { id: "4-4", name: "Last Stand", layout: "lanes", spikes: 6, seed: 44, waves: [[["brute", 2], ["archer", 2], ["wisp", 2]], [["brute", 1], ["wisp", 3], ["bat", 4], ["slime", 3]]] },
      { id: "4-5", name: "The Void Eye", layout: "boss", spikes: 0, seed: 45, waves: [[["eye", 1]]] },
    ],
  },
];

export const FLAT = [];
WORLDS.forEach((w, wi) => w.levels.forEach((lv, li) => { lv.wi = wi; lv.li = li; lv.look = w.look; lv.proof = SOLVED[lv.id] || null; FLAT.push(lv); }));

export function describeLevel(lv) {
  const total = lv.waves.reduce((a, w) => a + w.reduce((b, [, n]) => b + n, 0), 0), boss = lv.waves.some((w) => w.some(([t]) => ["warden", "queen", "golem", "eye"].includes(t)));
  const bits = boss ? ["Boss fight"] : [`${total} monsters`, `${lv.waves.length} waves`];
  if (lv.spikes) bits.push("spikes");
  return bits.join(" · ");
}
