// Fluffapult — the 24 levels. Each level is a few lines that call building helpers ("put a wooden frame here, a Tinker inside").
// Heights are measured upwards from the ground (or from the top of a cliff), x is measured from the left end of the level.
import { GROUND_Y as G, FOES } from "./defs";

export const SLING_X = 150;

class Build {
  constructor(W) { this.W = W; this.items = []; this.foes = []; this.terrain = []; this.pits = []; this.decor = []; this.bases = []; }
  // a box standing on `base`, centred on cx. Returns the height of its top so pieces can be chained.
  box(mat, cx, base, w, h, o = {}) { this.items.push({ k: "box", mat, x: cx, y: G - base - h / 2, w, h, rot: 0, ...o }); return base + h; }
  post(mat, cx, base, h) { return this.box(mat, cx, base, 20, h); }
  beam(mat, cx, base, w) { return this.box(mat, cx, base, w, 20); }
  blk(mat, cx, base, s = 40) { return this.box(mat, cx, base, s, s); }
  tnt(cx, base, s = 30) { return this.box("tnt", cx, base, s, s); }
  frame(cx, base, w, h, mat = "wood", beam = mat, post = mat) { this.post(post, cx - w / 2 + 10, base, h); this.post(post, cx + w / 2 - 10, base, h); return this.beam(beam, cx, base + h, w); }
  // several frames on top of each other; this.bases lists the floor height of every storey (put Sprockets there)
  tower(cx, base, w, storeys, h, mat = "wood", beam = mat, post = mat) {
    let b = base; this.bases = [];
    for (let i = 0; i < storeys; i++) { this.bases.push(b); b = this.frame(cx, b, w, h, i % 2 ? beam : mat, beam, post); }
    return b;
  }
  stack(mat, cx, base, n, s = 40) { let b = base; for (let i = 0; i < n; i++) b = this.blk(mat, cx, b, s); return b; }
  wall(mat, x0, base, cols, rows, s = 40) { let b = base; for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) this.blk(mat, x0 + s / 2 + c * s, b, s); b += s; } return b; }
  pyramid(mat, cx, base, rows, s = 40) { let b = base; for (let r = 0; r < rows; r++) { const n = rows - r; for (let i = 0; i < n; i++) this.blk(mat, cx + (i - (n - 1) / 2) * s, b, s); b += s; } return b; }
  foe(kind, cx, base) { this.foes.push({ kind, x: cx, y: G - base - FOES[kind].r }); }
  rock(cx, base, r = 24) { this.items.push({ k: "circle", mat: "stone", x: cx, y: G - base - r, r }); }
  // solid ground that rises above the normal ground (things can stand on top of it). Returns its height.
  cliff(x0, x1, h) { this.terrain.push({ x: (x0 + x1) / 2, y: G - h / 2, w: x1 - x0, h }); return h; }
  // a slope from height h0 at x0 up (or down) to h1 at x1
  ramp(x0, h0, x1, h1, th = 24) {
    const dx = x1 - x0, dy = -(h1 - h0), len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len, mx = (x0 + x1) / 2, my = G - (h0 + h1) / 2;
    this.terrain.push({ x: mx - nx * th / 2, y: my - ny * th / 2, w: len, h: th, rot: Math.atan2(dy, dx), ramp: true }); return h1;
  }
  pit(x0, x1) { this.pits.push([x0, x1]); }
}

const mk = (id, name, desc, W, birds, fn, extra = {}) => ({ id, name, desc, W, birds, fn, ...extra });

export const WORLDS = [
  { name: "Sunny Meadow", short: "Meadow", theme: "meadow", look: "meadow", music: "sunny", blurb: "Wooden huts and glass houses. Easy does it!", W: 1600, levels: [
    mk("1-1", "First Flight", "Drag back, aim, let go!", 1600, ["pom", "pom", "pom"], (B) => {
      B.frame(860, 0, 100, 80); B.foe("tinker", 860, 0); B.blk("wood", 860, 100, 40);
    }, { hint: ["Drag the Fluff back, aim at the hut, then let go!", "Tap again in the air to use the Fluff's power."] }),
    mk("1-2", "Hay Fort", "Two floors, two Tinkers.", 1600, ["pom", "pom", "pom", "zip", "pom"], (B) => {
      B.tower(820, 0, 120, 2, 60); B.foe("tinker", 820, B.bases[0]); B.foe("tinker", 820, B.bases[1]);
      B.frame(1090, 0, 100, 70); B.foe("tinker", 1090, 0);
    }),
    mk("1-3", "Glass House", "Glass breaks easily. Aim for the cracks!", 1600, ["pom", "pom", "zip", "pom"], (B) => {
      B.wall("wood", 790, 0, 4, 1); const t = B.tower(870, 40, 140, 2, 60, "glass", "glass", "glass"); B.foe("foreman", 870, B.bases[0]); B.foe("tinker", 870, B.bases[1]); B.blk("glass", 870, t, 40);
      B.frame(1160, 0, 100, 70, "glass", "wood", "glass"); B.foe("tinker", 1160, 0);
    }, { hint: ["Glass is fragile. Hit the posts and the whole house falls!"] }),
    mk("1-4", "Twin Towers", "Knock out the legs.", 1700, ["pom", "zip", "pom", "pom"], (B) => {
      B.post("wood", 800, 0, 200); B.post("wood", 1100, 0, 200); B.beam("wood", 950, 200, 340); B.foe("tinker", 950, 220);
      B.foe("foreman", 950, 0); B.stack("wood", 880, 0, 2); B.stack("wood", 1020, 0, 3);
    }),
    mk("1-5", "Hilltop", "A fort on a hill. Zip loves hills.", 1700, ["zip", "pom", "pom", "zip"], (B) => {
      const h = B.cliff(840, 1140, 110); B.tower(990, h, 120, 2, 60); B.foe("tinker", 990, B.bases[0]); B.foe("tinker", 990, B.bases[1]); B.stack("wood", 920, h, 2, 30);
      B.stack("wood", 1330, 0, 2); B.foe("tinker", 1330, 80);
    }),
    mk("1-6", "King's Cottage", "The King is hiding inside!", 1700, ["pom", "pom", "zip", "zip", "pom"], (B) => {
      B.wall("stone", 850, 0, 6, 1); const t = B.tower(990, 40, 160, 2, 70, "wood", "wood"); B.foe("king", 990, B.bases[0]); B.foe("tinker", 990, B.bases[1]); B.blk("wood", 990, t, 40);
      B.frame(780, 0, 80, 70); B.foe("tinker", 780, 0); B.frame(1230, 0, 80, 70); B.foe("tinker", 1230, 0);
    }),
  ] },
  { name: "Frosty Peaks", short: "Frost", theme: "snow", look: "snow", music: "snow", blurb: "Slippery ice and a cheeky Trio.", W: 1700, levels: [
    mk("2-1", "Ice Cubes", "Ice is slippery. Watch them slide!", 1700, ["pom", "zip", "pom", "pom"], (B) => {
      const t = B.pyramid("ice", 900, 0, 4); B.foe("foreman", 900, t); B.blk("glass", 1120, 0, 40); B.foe("tinker", 1120, 40);
    }),
    mk("2-2", "Frozen Bridge", "Don't fall in the pit!", 1700, ["pom", "zip", "pom", "pom"], (B) => {
      B.pit(800, 1100); B.beam("ice", 950, 0, 340); B.stack("ice", 880, 20, 2); B.stack("ice", 1020, 20, 3, 40); B.foe("tinker", 950, 20); B.foe("tinker", 1020, 140); B.frame(1230, 0, 90, 70, "ice"); B.foe("foreman", 1230, 0);
    }),
    mk("2-3", "Snow Fort", "Thick walls, thin roof.", 1700, ["trio", "pom", "zip", "pom", "zip"], (B) => {
      B.tower(850, 0, 100, 3, 60, "ice", "wood"); B.foe("tinker", 850, B.bases[0]); B.foe("tinker", 850, B.bases[2]);
      B.wall("ice", 1010, 0, 3, 2); B.foe("foreman", 1070, 80); B.blk("wood", 1070, 80 + 38, 40);
    }, { hint: ["Tap Trio in the air to split it into three!"] }),
    mk("2-4", "Avalanche", "Send the boulders rolling!", 1700, ["pom", "zip", "pom", "trio", "pom"], (B) => {
      const h = B.cliff(520, 700, 170); B.rock(640, h, 30); B.rock(580, h, 24);
      B.tower(940, 0, 120, 2, 70, "ice", "ice"); B.foe("tinker", 940, B.bases[0]); B.foe("tinker", 940, B.bases[1]); B.frame(1180, 0, 100, 70, "wood"); B.foe("foreman", 1180, 0);
    }, { hint: ["Hit the round rocks on the cliff so they roll down onto the fort!"] }),
    mk("2-5", "Icicle Towers", "Three tall towers. Trio is handy!", 1800, ["trio", "zip", "pom", "trio", "zip"], (B) => {
      for (const [x, n] of [[820, 3], [1040, 4], [1260, 3]]) { const t = B.tower(x, 0, 70, n, 60, "ice", "ice"); B.foe("tinker", x, t); }
      B.beam("wood", 930, 0, 140); B.foe("tinker", 930, 20);
    }),
    mk("2-6", "Frost King", "The Ice King's castle.", 1800, ["pom", "zip", "trio", "pom", "zip", "trio"], (B) => {
      B.wall("stone", 800, 0, 2, 2); B.wall("stone", 1120, 0, 2, 2);
      B.tower(960, 0, 160, 3, 70, "ice", "wood"); B.foe("king", 960, B.bases[0]); B.foe("tinker", 960, B.bases[1]); B.foe("tinker", 960, B.bases[2]);
      B.frame(1330, 0, 90, 70, "ice"); B.foe("foreman", 1330, 0);
    }),
  ] },
  { name: "Stone Quarry", short: "Quarry", theme: "desert", look: "desert", music: "tense", blurb: "Heavy stone, hidden TNT. Time for Boomer and Boulder!", W: 1800, levels: [
    mk("3-1", "Gravel Pit", "Stone is tough. Boomer is tougher!", 1800, ["boomer", "pom", "zip", "pom"], (B) => {
      B.stack("stone", 800, 0, 2); B.stack("stone", 980, 0, 2); B.beam("wood", 890, 80, 240); B.tnt(860, 0); B.foe("tinker", 925, 0); B.foe("foreman", 890, 100);
      B.frame(1210, 0, 100, 80, "stone", "wood"); B.foe("tinker", 1210, 0);
    }, { hint: ["Tap Boomer in the air to blow it up. Boom!"] }),
    mk("3-2", "Powder Keg", "Don't light a match near the TNT.", 1800, ["boomer", "pom", "zip", "pom"], (B) => {
      B.tnt(860, 0); B.tnt(910, 0); B.tnt(960, 0); B.beam("stone", 910, 30, 220); B.foe("foreman", 860, 50); B.foe("tinker", 960, 50); B.stack("wood", 910, 50, 2, 30);
      B.frame(1200, 0, 100, 70, "wood"); B.foe("tinker", 1200, 0);
    }),
    mk("3-3", "Double Decker", "Two cliffs, two forts.", 1800, ["pom", "boomer", "zip", "pom", "boulder"], (B) => {
      const h = B.cliff(780, 1000, 120); B.tower(890, h, 100, 2, 60, "stone", "wood"); B.foe("tinker", 890, B.bases[0]); B.foe("tinker", 890, B.bases[1]);
      const h2 = B.cliff(1180, 1420, 200); B.frame(1300, h2, 120, 70, "wood", "stone"); B.foe("foreman", 1300, h2); B.tnt(1380, h2);
    }),
    mk("3-4", "Rolling Stones", "Use the slope and the rocks.", 1800, ["boulder", "pom", "zip", "boomer"], (B) => {
      B.ramp(520, 0, 700, 140); B.cliff(700, 760, 140); B.rock(690, 140 + 12, 28); B.rock(735, 140, 26);
      B.tower(960, 0, 140, 2, 70, "stone", "wood"); B.foe("foreman", 960, B.bases[0]); B.foe("tinker", 960, B.bases[1]); B.frame(1220, 0, 100, 70, "wood"); B.foe("tinker", 1220, 0);
    }),
    mk("3-5", "Stone Hearth", "Thick walls. Bring the heavy one.", 1800, ["boulder", "boulder", "pom", "boomer"], (B) => {
      B.stack("stone", 840, 0, 3); B.stack("stone", 980, 0, 3); B.beam("stone", 910, 120, 200); B.foe("foreman", 910, 0); B.foe("tinker", 910, 140);
      B.frame(1240, 0, 120, 80, "stone", "stone"); B.foe("tinker", 1240, 0); B.tnt(1240, 100);
    }),
    mk("3-6", "Quarry King", "The King guards a mountain of stone.", 1900, ["boulder", "boomer", "pom", "zip", "trio", "boomer"], (B) => {
      B.wall("stone", 840, 0, 5, 2); const t = B.tower(940, 80, 160, 2, 70, "stone", "wood"); B.foe("king", 940, B.bases[0]); B.foe("tinker", 940, B.bases[1]); B.tnt(1040, 80); B.tnt(840, 80);
      B.frame(1330, 0, 100, 80, "wood", "stone"); B.foe("foreman", 1330, 0);
    }),
  ] },
  { name: "Sprocket Citadel", short: "Citadel", theme: "factory", look: "factory", music: "city", blurb: "The Sprockets' great clockwork fortress.", W: 1900, levels: [
    mk("4-1", "Gate Crashers", "Drop in on them!", 1900, ["dropper", "pom", "zip", "boulder", "pom"], (B) => {
      B.wall("stone", 820, 0, 2, 2); B.wall("wood", 1060, 0, 2, 3); B.beam("wood", 950, 80, 300); B.foe("tinker", 950, 100); B.foe("tinker", 950, 0);
      B.stack("wood", 1260, 0, 3, 30); B.foe("tinker", 1260, 90);
    }, { hint: ["Tap Dropper in the air to drop an egg bomb straight down!"] }),
    mk("4-2", "Clock Tower", "Tall, thin and wobbly.", 1900, ["zip", "trio", "dropper", "pom", "boomer"], (B) => {
      const t = B.tower(980, 0, 90, 5, 60, "wood", "stone"); B.foe("tinker", 980, B.bases[1]); B.foe("foreman", 980, B.bases[3]); B.foe("tinker", 980, t); B.wall("wood", 800, 0, 2, 1); B.frame(1250, 0, 100, 70); B.foe("tinker", 1250, 0);
    }),
    mk("4-3", "Cog Bridge", "Bridges over bottomless pits.", 1900, ["pom", "dropper", "trio", "boomer", "zip"], (B) => {
      B.pit(820, 1060); B.pit(1180, 1420); B.beam("stone", 940, 0, 300); B.beam("stone", 1300, 0, 300);
      B.stack("wood", 940, 20, 2); B.foe("tinker", 940, 100); B.frame(1300, 20, 120, 70, "wood", "wood"); B.foe("foreman", 1300, 20); B.tnt(1100, 0);
    }),
    mk("4-4", "Powder Wagon", "Everything here goes boom.", 1900, ["boomer", "boomer", "dropper", "boulder", "pom"], (B) => {
      B.wall("wood", 800, 0, 3, 1); B.tnt(840, 40); B.tnt(880, 40); B.tnt(920, 40); B.beam("stone", 860, 70, 200); B.foe("foreman", 860, 90);
      B.frame(1160, 0, 120, 80, "stone", "wood"); B.tnt(1160, 0); B.foe("tinker", 1160, 100); B.foe("tinker", 1330, 0); B.stack("wood", 1330, 30, 2, 30);
    }),
    mk("4-5", "Fort Fortissimo", "Big, loud and full of Sprockets.", 1900, ["pom", "zip", "trio", "boomer", "dropper", "boulder"], (B) => {
      B.wall("stone", 860, 0, 3, 2); B.tower(920, 80, 120, 3, 60, "wood", "stone"); B.foe("tinker", 920, B.bases[0]); B.foe("foreman", 920, B.bases[1]); B.foe("tinker", 920, B.bases[2]); B.tnt(1015, 0);
      const h = B.cliff(1180, 1500, 120); B.frame(1340, h, 140, 70, "ice", "stone"); B.foe("foreman", 1340, h);
    }),
    mk("4-6", "Clockwork King", "The final fort. Good luck!", 2000, ["boulder", "pom", "zip", "trio", "boomer", "dropper", "boulder"], (B) => {
      B.stack("stone", 800, 0, 3); B.tnt(860, 0); B.wall("stone", 880, 0, 4, 2);
      B.tower(960, 80, 160, 3, 70, "wood", "stone"); B.foe("king", 960, B.bases[0]); B.foe("foreman", 960, B.bases[1]); B.foe("tinker", 960, B.bases[2]); B.tnt(1075, 0);
      const h = B.cliff(1260, 1560, 140); B.tower(1410, h, 100, 2, 60, "glass", "wood"); B.foe("tinker", 1410, B.bases[0]); B.foe("tinker", 1410, B.bases[1]);
    }),
  ] },
];

export const FLAT = []; WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => FLAT.push({ ...l, wi, li, world: w })));

export function buildLevel(wi, li) {
  const w = WORLDS[wi], lv = w.levels[li], B = new Build(lv.W);
  lv.fn(B);
  return { id: lv.id, name: lv.name, W: lv.W, birds: lv.birds.slice(), items: B.items, foes: B.foes, terrain: B.terrain, pits: B.pits, theme: w.theme, look: w.look, hint: lv.hint || null, wi, li };
}
