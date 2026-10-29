// Snip & Drop: 4 worlds, 20 levels. Every level was solved by the automatic player (solver.js), which found a way to feed the critter with all 3 stars.
// ropes: [pinX, pinY, length?]   berry: where it hangs at the start   critter: its mouth   stars   bubbles   spikes: [x,y,w,h]   blocks: [x,y,w,h]
import { SOLVED } from "./solved";
import { GEN } from "./generated";

export const WORLDS = [
  {
    name: "Berry Patch", short: "Patch", theme: "meadow", music: "sunny", look: 0, blurb: "Learn to snip: one rope, two ropes, and a swing.",
    levels: [
      { id: "1-1", name: "First Snip", ropes: [[480, 90]], berry: [480, 230], critter: [480, 470], stars: [[480, 320], [480, 375], [480, 425]], hint: "Swipe across the rope to cut it. Drop the berry into the critter's mouth and grab the stars on the way." },
      { id: "1-2", name: "Swing Low", ropes: [[300, 90], [660, 90]], berry: [480, 250], critter: [820, 470], stars: [[600, 340], [700, 400], [770, 450]], hint: "Cut a rope and the berry swings. Cut the other at the right moment to let it fly." },
      { id: "1-3", name: "Triple Tie", ropes: [[340, 90], [480, 70], [620, 90]], berry: [480, 240], critter: [480, 480], stars: [[480, 330], [480, 385], [480, 435]] },
      { id: "1-4", name: "Pendulum", ropes: [[330, 90]], berry: [110, 200], critter: [700, 430], stars: [[330, 330], [470, 270], [560, 300]] },
      { id: "1-5", name: "Ledge Hop", ropes: [[240, 90], [420, 90]], berry: [330, 260], critter: [800, 300], blocks: [[640, 340, 240, 20]], stars: [[500, 250], [600, 240], [720, 290]] },
    ],
  },
  {
    name: "Bubble Grove", short: "Grove", theme: "forest", music: "calm", look: 1, blurb: "Bubbles lift the berry. Tap them to pop at just the right moment.",
    levels: [
      { id: "2-1", name: "Up We Go", ropes: [[480, 90]], berry: [480, 330], bubbles: [[480, 420]], critter: [480, 120], stars: [[480, 230], [480, 170], [420, 330]], hint: "Tap a bubble to pop it. A bubble lifts the berry up and away." },
      { id: "2-2", name: "Float Over", ropes: [[260, 90], [400, 90]], berry: [330, 260], bubbles: [[480, 300]], critter: [820, 420], blocks: [[500, 370, 80, 170]], stars: [[420, 300], [600, 230], [740, 340]] },
      { id: "2-3", name: "Elevator", ropes: [[400, 90], [560, 90]], berry: [480, 250], bubbles: [[480, 420]], critter: [800, 140], blocks: [[640, 200, 20, 340]], stars: [[480, 340], [560, 150], [720, 120]] },
      { id: "2-4", name: "Two Bubbles", ropes: [[240, 90], [380, 90]], berry: [310, 270], bubbles: [[310, 420], [620, 260]], critter: [800, 460], stars: [[300, 350], [470, 200], [700, 330]] },
      { id: "2-5", name: "Grove Gate", ropes: [[240, 90], [480, 90]], berry: [360, 250], bubbles: [[360, 400], [680, 300]], critter: [850, 160], blocks: [[560, 220, 20, 320]], stars: [[360, 330], [470, 130], [760, 220]] },
    ],
  },
  {
    name: "Spike Caverns", short: "Caverns", theme: "cave", music: "tense", look: 2, blurb: "Spikes bite! Swing and float past them.",
    levels: [
      { id: "3-1", name: "Mind the Floor", ropes: [[340, 90], [620, 90]], berry: [480, 250], critter: [700, 470], spikes: [[420, 500, 160, 40]], stars: [[480, 320], [560, 400], [650, 450]] },
      { id: "3-2", name: "Spiky Swing", ropes: [[300, 90], [620, 90]], berry: [460, 250], critter: [830, 470], spikes: [[560, 500, 150, 40]], stars: [[580, 340], [700, 400], [790, 450]] },
      { id: "3-3", name: "Needle Ceiling", ropes: [[400, 90]], berry: [400, 280], bubbles: [[400, 400]], critter: [800, 300], spikes: [[560, 70, 200, 40], [560, 400, 200, 140]], stars: [[400, 330], [560, 250], [700, 280]] },
      { id: "3-4", name: "Spike Garden", ropes: [[260, 90], [500, 90]], berry: [380, 260], critter: [800, 470], spikes: [[560, 500, 120, 40], [380, 500, 100, 40]], blocks: [[600, 330, 140, 20]], stars: [[520, 320], [660, 300], [760, 430]] },
      { id: "3-5", name: "Crystal Maze", ropes: [[240, 90], [540, 90]], berry: [390, 270], bubbles: [[700, 380]], critter: [850, 200], spikes: [[620, 70, 160, 40], [400, 500, 200, 40]], stars: [[470, 350], [680, 300], [780, 200]] },
    ],
  },
  {
    name: "Sky Factory", short: "Factory", theme: "factory", music: "city", look: 3, blurb: "Everything at once: ropes, bubbles, spikes and tricky ledges.",
    levels: [
      { id: "4-1", name: "Conveyor", ropes: [[200, 90], [420, 90]], berry: [310, 250], critter: [830, 440], blocks: [[470, 330, 180, 20], [680, 400, 200, 20]], stars: [[560, 290], [700, 340], [770, 420]] },
      { id: "4-2", name: "Cog Drop", ropes: [[300, 90], [420, 90], [540, 90]], berry: [420, 250], critter: [820, 470], spikes: [[580, 500, 120, 40]], blocks: [[470, 330, 20, 210]], stars: [[560, 280], [680, 380], [770, 450]] },
      { id: "4-3", name: "Pipe Dream", ropes: [[220, 90], [360, 90]], berry: [290, 260], bubbles: [[420, 300], [640, 260]], critter: [850, 150], spikes: [[520, 440, 200, 100]], stars: [[380, 220], [560, 150], [760, 140]] },
      { id: "4-4", name: "Steam Vent", ropes: [[240, 90], [520, 90]], berry: [380, 260], bubbles: [[380, 400]], critter: [850, 460], spikes: [[560, 280, 20, 260], [700, 70, 200, 30]], stars: [[380, 340], [600, 200], [780, 330]] },
      { id: "4-5", name: "Grand Machine", ropes: [[220, 90], [460, 90]], berry: [340, 260], bubbles: [[340, 410], [660, 220]], critter: [860, 120], spikes: [[560, 330, 20, 210], [700, 330, 200, 210]], blocks: [[600, 260, 120, 20]], stars: [[340, 350], [600, 170], [780, 110]] },
    ],
  },
];

export const FLAT = [];
WORLDS.forEach((w, wi) => w.levels.forEach((lv, li) => { lv.wi = wi; lv.li = li; lv.look = w.look; if (GEN[lv.id]) { lv.critter = GEN[lv.id].critter; lv.stars = GEN[lv.id].stars; } lv.sol = SOLVED[lv.id] ? SOLVED[lv.id].actions : []; lv.solStars = SOLVED[lv.id] ? SOLVED[lv.id].stars : 0; FLAT.push(lv); }));

export function describeLevel(lv) {
  const bits = [`${lv.ropes.length} rope${lv.ropes.length > 1 ? "s" : ""}`];
  if (lv.bubbles && lv.bubbles.length) bits.push(`${lv.bubbles.length} bubble${lv.bubbles.length > 1 ? "s" : ""}`);
  if (lv.spikes && lv.spikes.length) bits.push("spikes");
  return bits.join(" · ");
}
