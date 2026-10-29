// Garden Guards: 4 worlds, 20 levels. Each level lists which defenders you may use and the whole timetable of the Gloom Gang
// (made once from a fixed seed, so every player faces the same waves). The automatic player in bot.js has beaten every level.
import { rng } from "../../core/util";

const ALL = ["pip", "dew", "bramble", "frost", "twin", "chili"];
// spec: seed, dur (seconds the waves run for), first (first arrival), pool [[type, weight, appears-after-fraction]], gap0 -> gap1 (seconds between arrivals), flag (size of the big final wave), boss
function makeWaves(sp) {
  const R = rng(sp.seed), out = []; let t = sp.first, last = -1;
  while (t < sp.dur) {
    const p = (t - sp.first) / (sp.dur - sp.first), pool = sp.pool.filter((q) => p >= q[2]), tot = pool.reduce((a, q) => a + q[1], 0);
    let r = R.range(0, tot), ty = pool[0][0]; for (const q of pool) { if (r < q[1]) { ty = q[0]; break; } r -= q[1]; }
    let row = R.int(0, 4); if (row === last) row = (row + 1 + R.int(0, 3)) % 5; last = row;
    out.push([+t.toFixed(2), ty, row]);
    const gap = sp.gap0 + (sp.gap1 - sp.gap0) * Math.min(1, p); t += gap * R.range(0.75, 1.25);
  }
  if (sp.flag) { const t0 = sp.dur + 6; const kinds = sp.pool.filter((q) => q[2] < 0.9).map((q) => q[0]); for (let i = 0; i < sp.flag; i++) out.push([+(t0 + i * 0.7).toFixed(2), kinds[(i * 2 + 1) % kinds.length], i % 5]); }
  if (sp.boss) out.push([+(sp.dur * 0.75).toFixed(2), "queen", 2]);
  out.sort((a, b) => a[0] - b[0]);
  return out;
}
const PACE = [1, 0.85, 0.72, 0.62];   // the Gang arrives faster in later worlds
const lvl = (id, name, o0) => { const w = +id[0] - 1, li = +id[2] - 1, f = PACE[w] * (1 - 0.02 * li), o = { ...o0, gap0: o0.gap0 * f, gap1: o0.gap1 * f, flag: o0.flag ? Math.round(o0.flag * (1 + 0.15 * w)) : 0 }; return build(id, name, o); };
const build = (id, name, o) => ({ id, name, hint: o.hint, sky: o.sky !== false, start: o.start ?? 100, cards: o.cards, flagAt: o.flag ? o.dur + 6 : 0, bossAt: o.boss ? o.dur * 0.75 : 0, marks: o.flag ? [o.dur + 6] : [], waves: makeWaves(o) });

const G = [["grub", 1, 0]], GC = [["grub", 6, 0], ["capped", 3, 0.25]];
export const WORLDS = [
  { name: "Sunny Patch", short: "Patch", theme: "meadow", music: "sunny", blurb: "Daytime in the veg patch. Sunlight rains dew, so plant, grow and hold the lanes.",
    levels: [
      lvl("1-1", "First Sprouts", { seed: 11, dur: 70, first: 14, pool: G, gap0: 11, gap1: 7, cards: ["pip", "dew"], hint: "Pick a seed card, then tap a square. Dewbloom makes dew; Pip Pod spits seeds at the Gang. Tap falling dew to collect it." }),
      lvl("1-2", "Walls and Weeds", { seed: 12, dur: 85, first: 14, pool: GC, gap0: 9, gap1: 5.5, cards: ["pip", "dew", "bramble"], hint: "Capped Grubs take more hits. Bramble Walls hold them while your Pods keep firing." }),
      lvl("1-3", "Hot Stuff", { seed: 13, dur: 95, first: 13, pool: GC, gap0: 7.5, gap1: 4.5, cards: ["pip", "dew", "bramble", "chili"], hint: "A Chili Bomb wipes out everything in the squares around it. Save it for a crowd." }),
      lvl("1-4", "Frost Bite", { seed: 14, dur: 100, first: 12, pool: [["grub", 5, 0], ["capped", 4, 0.1]], gap0: 6.5, gap1: 3.8, cards: ["pip", "dew", "bramble", "chili", "frost"], hint: "Frost Ferns slow the Gang down, which gives every Pod more time to shoot." }),
      lvl("1-5", "Patch Defender", { seed: 15, dur: 105, first: 12, pool: [["grub", 5, 0], ["capped", 4, 0.1]], gap0: 6, gap1: 3.4, flag: 9, cards: ALL, hint: "A big wave is coming at the end. Twin Pods fire two seeds at a time." }),
    ] },
  { name: "Moonlit Garden", short: "Moon", theme: "forest", music: "spooky", blurb: "Night time: no sunlight, so Dewbloom is your only income. Hoppers leap over your first defender.",
    levels: [
      lvl("2-1", "Lights Out", { seed: 21, dur: 90, first: 16, sky: false, start: 150, pool: GC, gap0: 9, gap1: 6, cards: ALL, hint: "No sunlight at night. Plant Dewbloom early." }),
      lvl("2-2", "Hop Along", { seed: 22, dur: 95, first: 14, sky: false, start: 150, pool: [["grub", 4, 0], ["capped", 3, 0], ["hopper", 4, 0.1]], gap0: 7.5, gap1: 4.5, cards: ALL, hint: "Hoppers jump over the first defender they meet. Keep a Pod behind your wall." }),
      lvl("2-3", "Moth Hour", { seed: 23, dur: 100, first: 13, sky: false, start: 150, pool: [["grub", 4, 0], ["capped", 4, 0], ["hopper", 4, 0.05]], gap0: 6.5, gap1: 4, cards: ALL }),
      lvl("2-4", "Long Night", { seed: 24, dur: 110, first: 13, sky: false, start: 150, pool: [["grub", 3, 0], ["capped", 4, 0], ["hopper", 4, 0.05]], gap0: 6, gap1: 3.5, cards: ALL }),
      lvl("2-5", "Dawn Is Near", { seed: 25, dur: 115, first: 12, sky: false, start: 175, pool: [["grub", 3, 0], ["capped", 4, 0], ["hopper", 4, 0.05]], gap0: 5.8, gap1: 3.3, flag: 12, cards: ALL }),
    ] },
  { name: "Bramble Hills", short: "Hills", theme: "snow", music: "snow", blurb: "Brutes lumber in, huge and slow. Time to stack your firepower.",
    levels: [
      lvl("3-1", "Big Footsteps", { seed: 31, dur: 100, first: 14, start: 125, pool: [["grub", 4, 0], ["capped", 4, 0], ["brute", 2, 0.3]], gap0: 7.5, gap1: 5, cards: ALL, hint: "Brutes take lots of hits and chew through plants quickly. Frost slows them and a Chili Bomb hurts them." }),
      lvl("3-2", "Crowd Control", { seed: 32, dur: 105, first: 13, start: 125, pool: [["grub", 3, 0], ["capped", 4, 0], ["hopper", 3, 0.1], ["brute", 3, 0.2]], gap0: 7, gap1: 4.2, cards: ALL }),
      lvl("3-3", "Snow Squall", { seed: 33, dur: 110, first: 13, start: 125, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 3, 0.15]], gap0: 6.5, gap1: 4, cards: ALL }),
      lvl("3-4", "Stampede", { seed: 34, dur: 115, first: 12, start: 125, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 4, 0.1]], gap0: 6, gap1: 3.6, cards: ALL }),
      lvl("3-5", "Hill Top", { seed: 35, dur: 120, first: 12, start: 150, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 4, 0.1]], gap0: 5.6, gap1: 3.3, flag: 13, cards: ALL }),
    ] },
  { name: "Gloom Keep", short: "Keep", theme: "dungeon", music: "boss", blurb: "The Gang's own castle. Everything attacks at once, and the Queen is waiting.",
    levels: [
      lvl("4-1", "Castle Gate", { seed: 41, dur: 105, first: 13, sky: false, start: 200, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 3, 0.1]], gap0: 6.6, gap1: 4, cards: ALL }),
      lvl("4-2", "Dark Corridors", { seed: 42, dur: 110, first: 12, sky: false, start: 200, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 3, 0]], gap0: 6.2, gap1: 3.8, cards: ALL }),
      lvl("4-3", "Throne Room Door", { seed: 43, dur: 115, first: 12, start: 150, pool: [["capped", 3, 0], ["hopper", 4, 0], ["brute", 4, 0]], gap0: 5.8, gap1: 3.5, cards: ALL }),
      lvl("4-4", "Last Defence", { seed: 47, dur: 120, first: 12, sky: false, start: 250, pool: [["capped", 4, 0], ["hopper", 3, 0], ["brute", 3, 0.25]], gap0: 6.2, gap1: 3.9, flag: 9, cards: ALL }),
      lvl("4-5", "The Gloom Queen", { seed: 45, dur: 125, first: 12, start: 175, pool: [["capped", 3, 0], ["hopper", 4, 0], ["brute", 4, 0]], gap0: 6, gap1: 3.6, boss: true, flag: 12, cards: ALL, hint: "The Queen keeps spawning Grubs. Pour everything you have into her lane." }),
    ] },
];
export const FLAT = []; WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => FLAT.push({ ...l, wi, li })));
export const describeLevel = (l) => `${l.waves.length} enemies${l.sky ? "" : " · night"}${l.waves.some((w) => w[1] === "queen") ? " · boss" : ""}`;
