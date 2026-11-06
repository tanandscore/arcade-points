// Putt Planet: 4 planets, 20 holes. The courses are drawn by hand here; `par` and the winning shots come from the automatic solver (solved.js).
// `par` is one stroke more than the fewest strokes the solver found. 3 stars = finish in par or fewer, 2 stars = one over par, 1 star = any finish.
import { R } from "./physics";
import { SOLVED } from "./solved";

const ring = (cx, cy, r, n, from, to, rad = 15) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * 360; if (a >= from && a <= to) continue; out.push([Math.round(cx + Math.cos((a * Math.PI) / 180) * r), Math.round(cy + Math.sin((a * Math.PI) / 180) * r), rad, "post"]); } return out; };

export const WORLDS = [
  {
    name: "Pebble Moon", short: "Moon", theme: "space", music: "calm", look: 0, blurb: "Quiet craters and friendly walls. Learn to aim, bank and carry the water.",
    levels: [
      { id: "1-1", name: "First Putt", poly: R(80, 190, 800, 160), tee: [150, 270], cup: [800, 270], hint: "Drag back from the ball and let go to putt. The further you pull, the harder it goes." },
      { id: "1-2", name: "Dog Leg", poly: [[80, 150], [600, 150], [600, 330], [880, 330], [880, 470], [460, 470], [460, 290], [80, 290]], tee: [140, 220], cup: [820, 400], hint: "Walls bounce the ball. Bank it round the corner! The dotted guide shows the first bounces." },
      { id: "1-3", name: "Pillars", poly: R(80, 130, 800, 340), blocks: [[320, 130, 40, 150], [520, 320, 40, 150], [700, 200, 40, 120]], tee: [140, 300], cup: [820, 300] },
      { id: "1-4", name: "Bumper Park", poly: R(80, 130, 800, 340), blocks: [[760, 200, 30, 270]], bumpers: [[430, 230, 24], [430, 370, 24], [560, 300, 24], [690, 200, 24], [690, 400, 24]], tee: [140, 300], cup: [840, 160], hint: "Round bumpers kick the ball away faster than it came." },
      { id: "1-5", name: "Water Hop", poly: R(80, 120, 800, 360), water: [[420, 120, 100, 230], [420, 400, 100, 80]], bumpers: [[640, 250, 16, "post"], [640, 420, 16, "post"]], tee: [140, 200], cup: [820, 200], hint: "Water costs a stroke and puts the ball back where you hit it from." },
    ],
  },
  {
    name: "Rusty Mars", short: "Mars", theme: "desert", music: "tense", look: 1, blurb: "Sticky red sand, lava lakes and winding canyons.",
    levels: [
      { id: "2-1", name: "Dune Run", poly: R(80, 140, 800, 320), sand: [[330, 140, 180, 320]], blocks: [[600, 140, 30, 100], [600, 360, 30, 100]], tee: [140, 300], cup: [820, 300], hint: "Sand grabs the ball and slows it down. Hit a little harder to get across." },
      { id: "2-2", name: "Crater Ring", poly: R(80, 120, 800, 360), sand: [[400, 120, 120, 360]], bumpers: ring(760, 300, 70, 14, 130, 230), tee: [140, 300], cup: [760, 300] },
      { id: "2-3", name: "Lava Lake", poly: R(80, 100, 800, 400), water: [[330, 200, 300, 140]], sand: [[330, 100, 300, 100], [330, 340, 300, 160]], bumpers: [[480, 150, 20, "post"]], tee: [140, 300], cup: [820, 300], hint: "Lava works like water: the ball goes back and you add a stroke." },
      { id: "2-4", name: "Switchback", poly: R(80, 100, 800, 400), blocks: [[80, 205, 720, 40], [160, 350, 720, 40]], sand: [[400, 245, 160, 105]], tee: [130, 150], cup: [830, 445] },
      { id: "2-5", name: "Mesa", poly: R(80, 100, 800, 400), blocks: [[250, 100, 40, 220], [250, 380, 40, 120], [450, 200, 40, 300], [650, 100, 40, 260]], water: [[690, 400, 190, 100]], sand: [[290, 330, 160, 50]], tee: [130, 300], cup: [800, 200] },
    ],
  },
  {
    name: "Frost Comet", short: "Comet", theme: "snow", music: "snow", look: 2, blurb: "Slippery ice, speed pads and pinball bumpers.",
    levels: [
      { id: "3-1", name: "Ice Slide", poly: R(80, 120, 800, 360), ice: [[80, 120, 800, 360]], blocks: [[300, 120, 30, 230], [520, 250, 30, 230], [740, 120, 30, 230]], tee: [140, 420], cup: [840, 420], hint: "Ice is very slippery. Use a gentle putt, or bank the ball off the walls." },
      { id: "3-2", name: "Boost Lane", poly: [[80, 150], [620, 150], [620, 330], [880, 330], [880, 470], [480, 470], [480, 290], [80, 290]], boost: [{ r: [180, 150, 220, 140], dx: 1, dy: 0 }], water: [[640, 330, 60, 85]], ice: [[480, 290, 140, 180]], tee: [130, 220], cup: [830, 400], hint: "Speed pads push the ball along. Line up the shot before you hit the lane." },
      { id: "3-3", name: "Slalom", poly: R(80, 100, 800, 400), ice: [[80, 100, 800, 400]], blocks: [[250, 100, 28, 270], [420, 230, 28, 270], [590, 100, 28, 270], [760, 230, 28, 270]], tee: [140, 300], cup: [845, 160] },
      { id: "3-4", name: "Frozen Pond", poly: R(80, 100, 800, 400), ice: [[80, 100, 800, 400]], water: [[300, 180, 200, 170]], blocks: [[580, 100, 30, 280]], bumpers: [[300, 440, 18, "post"], [680, 440, 18, "post"]], tee: [140, 440], cup: [820, 150] },
      { id: "3-5", name: "Comet Tail", poly: R(80, 100, 800, 400), blocks: [[330, 100, 30, 250], [330, 420, 30, 80], [600, 250, 30, 250]], boost: [{ r: [230, 330, 100, 120], dx: 0.8, dy: -0.6 }], bumpers: [[700, 180, 24], [780, 360, 24], [470, 250, 22]], water: [[420, 100, 80, 100]], tee: [130, 440], cup: [830, 170] },
    ],
  },
  {
    name: "Gas Giants", short: "Giants", theme: "space", music: "boss", look: 3, blurb: "Planets pull the ball, portals warp it and windmills spin in the way.",
    levels: [
      { id: "4-1", name: "Orbit", poly: R(80, 100, 800, 400), blocks: [[440, 100, 30, 290]], wells: [{ x: 600, y: 430, r: 30, gm: 4.6e6 }], tee: [140, 170], cup: [820, 170], hint: "Big planets pull the ball towards them. Use that to curve your shot!" },
      { id: "4-2", name: "Warp Gate", poly: R(80, 120, 800, 360), blocks: [[470, 120, 30, 360], [80, 290, 350, 30]], portals: [[300, 420, 640, 190]], tee: [140, 190], cup: [830, 400], hint: "Roll into a portal and pop out of its twin." },
      { id: "4-3", name: "Windmill", poly: R(80, 120, 800, 360), blocks: [[700, 120, 30, 170]], blades: [{ x: 560, y: 330, len: 200, speed: 1.6, phase: 0, w: 14 }], tee: [140, 300], cup: [830, 200], hint: "Time your putt so the spinning blade is out of the way." },
      { id: "4-4", name: "Twin Suns", poly: R(80, 100, 800, 400), blocks: [[480, 100, 30, 230]], wells: [{ x: 300, y: 380, r: 30, gm: 4.2e6 }, { x: 660, y: 200, r: 30, gm: 4.2e6 }], portals: [[200, 200, 760, 440]], tee: [140, 300], cup: [830, 300] },
      { id: "4-5", name: "Grand Finale", poly: R(80, 100, 800, 400), blocks: [[420, 100, 30, 200], [700, 300, 30, 200]], wells: [{ x: 300, y: 300, r: 28, gm: 4e6 }], blades: [{ x: 600, y: 330, len: 240, speed: -1.4, phase: 1, w: 14 }], portals: [[180, 160, 480, 440]], water: [[520, 100, 60, 120]], tee: [130, 440], cup: [840, 200] },
    ],
  },
];

export const FLAT = [];
WORLDS.forEach((w, wi) => w.levels.forEach((lv, li) => {
  lv.wi = wi; lv.li = li; lv.look = w.look;
  const s = SOLVED[lv.id]; lv.par = s ? s.par + 1 : 3; lv.best = s ? s.par : 0; lv.sol = s ? s.sol : [];
  FLAT.push(lv);
}));

export function describeHole(lv) {
  const bits = [`Par ${lv.par}`];
  if (lv.water && lv.water.length) bits.push("water"); if (lv.sand && lv.sand.length) bits.push("sand"); if (lv.ice && lv.ice.length) bits.push("ice");
  if (lv.wells && lv.wells.length) bits.push("planets"); if (lv.portals && lv.portals.length) bits.push("portals"); if (lv.blades && lv.blades.length) bits.push("windmill"); if (lv.boost && lv.boost.length) bits.push("boost");
  return bits.join(" · ");
}
