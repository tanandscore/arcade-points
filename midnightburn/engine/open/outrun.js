// Midnight Burn — Upgrade 38: outrun races.
//
// A few street racers (each known by a street alias, never a personal name) cruise the roads at night. Pull up next to one, flash your lights (ENTER or L) and it is an OUTRUN: no start line, no
// checkpoints, no countdown on the road. Both cars simply race down the street and whoever can open up a big enough lead on the other wins.
//
// This file is plain data and plain geometry (no graphics), so the same code runs headless for the tests. The race itself lives in sim.js.
import { IS_TOKYO } from "./mapId";

export const OUT = {
  WIN_GAP: 220,       // metres of lead needed (and held for HOLD seconds) to win - or to lose
  HOLD: 2.5,
  LIGHTS: 3,          // 3-2-1 before the rival floors it
  TIME: 300,          // five minutes, then whoever is in front wins
  CHALLENGE_R: 40,    // how close you must be to a racer to challenge it
  SEE_R: 330,         // a racer this close shows on the minimap
  SPAWN_MIN: 170, SPAWN_MAX: 320, DESPAWN: 700,
  CRUISE: 0.45,       // a racer that has not been challenged cruises at under half its race pace
  COOL: 150,          // seconds before a racer that you have raced will show up again
};

// Name, car, paint, a signature look, how good they are (tier 1 street, 2 pro, 3 ace), and what they say.
// (Aliases are different from the Blacklist rivals so nobody is confused.)
const MUMBAI = [
  { id: "pappu", name: "Taxi Ghost", tag: "Never Brakes", tier: 1, car: "kestrel", look: { color: "#ffc400", finish: "gloss", livery: { type: "racing", color: "#101015" }, rims: { style: "ten", color: "#1a1a20" }, wing: "lip", kit: "street", number: 11 }, taunt: "Arre, you want to race ME? Chalo, let's see.", win: "Bhai, next time I'll be ready.", lose: "Too slow, yaar. Go home." },
  { id: "lovely", name: "Pink Lightning", tag: "Fast and Pretty", tier: 1, car: "gecko", look: { color: "#ff2d95", finish: "candy", livery: { type: "side", color: "#f2f2f2" }, rims: { style: "turbine", color: "#f2f2f2" }, wing: "stock", kit: "street", number: 21 }, taunt: "Nice car. Shame about the driver.", win: "Okay okay, you're quick. Don't let it go to your head.", lose: "Told you. Pink is fast." },
  { id: "tinku", name: "Back Alley", tag: "Knows Every Shortcut", tier: 1, car: "brute", look: { color: "#2b6b4a", finish: "satin", livery: { type: "stripes", color: "#ffb703" }, rims: { style: "deep", color: "#c9a227" }, kit: "race", hood: "vent", exhaust: "big", number: 3 }, taunt: "My gully, my rules. Follow me!", win: "Fine. The gully is yours tonight.", lose: "Gully boys never lose at home." },
  { id: "sheru", name: "Night Cat", tag: "Claws Out", tier: 2, car: "stinger", look: { color: "#ff5a1f", finish: "metallic", livery: { type: "flames", color: "#ffb703" }, rims: { style: "mesh", color: "#1a1a20" }, wing: "gt", kit: "wide", hood: "scoop", stance: "low", camber: 1, number: 8 }, taunt: "You picked the wrong cat to wake up.", win: "Hmph. Lucky. Very lucky.", lose: "Meow." },
  { id: "billu", name: "Green Light", tag: "Never Stops", tier: 2, car: "rennsport", look: { color: "#101015", finish: "matte", livery: { type: "split", color: "#ffb703" }, rims: { style: "star", color: "#ffb703" }, wing: "dual", kit: "attack", stance: "sport", number: 44 }, taunt: "Every light on this street turns green for me.", win: "You got the lights tonight, that's all.", lose: "Green all the way. Always." },
  { id: "mirchi", name: "Red Hot", tag: "Burns Everyone", tier: 2, car: "phantom", look: { color: "#d4202a", finish: "pearl", livery: { type: "racing", color: "#f2f2f2" }, rims: { style: "blade", color: "#f2f2f2" }, wing: "swan", kit: "race", hood: "carbon", stance: "low", camber: 2, number: 5 }, taunt: "Careful, I bite.", win: "Hot... but you burned me.", lose: "Too spicy for you." },
  { id: "vajra", name: "Thunderbolt", tag: "Untouchable", tier: 3, car: "razor", look: { color: "#1b6dff", finish: "chameleon", livery: { type: "speed", color: "#2de2ff" }, rims: { style: "split", color: "#101015" }, kit: "attack", exhaust: "quad", stance: "slam", camber: 2, glow: "cyan", number: 99 }, taunt: "Few get to see my tail lights. You won't.", win: "...Respect. Now go find someone your size.", lose: "Another one for the wall." },
  { id: "toofan", name: "The Storm", tag: "Rules the Road", tier: 3, car: "specter", look: { color: "#101015", finish: "carbon", livery: { type: "grid", color: "#d4202a" }, rims: { style: "multi", color: "#d4202a" }, kit: "wide", exhaust: "titan", stance: "slam", camber: 3, glow: "red", number: 1 }, taunt: "They call me the storm. Try to keep up.", win: "The storm has passed. You're the new weather.", lose: "Everyone fades in the storm." },
];
const TOKYO = [
  { id: "tomo", name: "Night Bus", tag: "Last Ride Home", tier: 1, car: "kestrel", look: { color: "#e6e0d0", finish: "pearl", livery: { type: "side", color: "#d4202a" }, rims: { style: "classic", color: "#c9ccd8" }, wing: "lip", kit: "street", number: 12 }, taunt: "A race? On this road? Sure. Don't scratch it.", win: "Good run. I'll practise.", lose: "Slow and steady. Mostly steady." },
  { id: "nana", name: "Seven Lives", tag: "Still Counting", tier: 1, car: "gecko", look: { color: "#2de2ff", finish: "metallic", livery: { type: "hex", color: "#101015" }, rims: { style: "ten", color: "#f2f2f2" }, wing: "stock", kit: "street", number: 7 }, taunt: "Seven lives. You'll need more than one.", win: "One life gone. I have six left.", lose: "That's life number one for you." },
  { id: "botan", name: "Peony", tag: "Pretty and Sharp", tier: 1, car: "brute", look: { color: "#b45cff", finish: "candy", livery: { type: "stripes", color: "#f2f2f2" }, rims: { style: "deep", color: "#1a1a20" }, kit: "race", hood: "vent", exhaust: "big", number: 30 }, taunt: "Pretty cars bite too!", win: "Ah, you pruned me.", lose: "In full bloom, as always." },
  { id: "riko", name: "Bay Fox", tag: "Bayshore Runner", tier: 2, car: "stinger", look: { color: "#f2f2f2", finish: "gloss", livery: { type: "rally", color: "#1b6dff" }, rims: { style: "mesh", color: "#1b6dff" }, wing: "gt", kit: "drift", hood: "scoop", stance: "low", camber: 1, number: 86 }, taunt: "The bay lights are better at 250. Come see.", win: "You run clean. I'm impressed.", lose: "Foxes don't get caught." },
  { id: "jun", name: "Matte Black", tag: "No Stickers", tier: 2, car: "phantom", look: { color: "#101015", finish: "matte", livery: { type: "side", color: "#ffb703" }, rims: { style: "blade", color: "#ffb703" }, wing: "swan", kit: "race", hood: "carbon", stance: "low", camber: 2, number: 13 }, taunt: "No stickers. No excuses.", win: "No excuses. You were faster.", lose: "Matte black. Still invisible to you." },
  { id: "hoshi", name: "Shooting Star", tag: "Make a Wish", tier: 2, car: "rennsport", look: { color: "#2de2ff", finish: "chameleon", livery: { type: "speed", color: "#f2f2f2" }, rims: { style: "star", color: "#101015" }, wing: "dual", kit: "attack", stance: "sport", glow: "cyan", number: 24 }, taunt: "Make a wish. Then try to catch me.", win: "Wish granted, I suppose.", lose: "Wish denied." },
  { id: "raiden", name: "Lightning Rod", tag: "Highway King", tier: 3, car: "razor", look: { color: "#0a4d3a", finish: "metallic", livery: { type: "checker", color: "#c9a227" }, rims: { style: "split", color: "#c9a227" }, kit: "attack", exhaust: "quad", stance: "slam", camber: 2, glow: "lime", number: 5 }, taunt: "The Wangan is mine. Always has been.", win: "You are the real thing. Remember my name.", lose: "Thunder follows lightning." },
  { id: "oni", name: "Red Demon", tag: "Collects Every Race", tier: 3, car: "specter", look: { color: "#d4202a", finish: "gloss", livery: { type: "flames", color: "#101015" }, rims: { style: "multi", color: "#101015" }, kit: "wide", exhaust: "titan", stance: "slam", camber: 3, glow: "red", number: 666 }, taunt: "Run. Or race. Same result.", win: "The demon bows. For tonight.", lose: "Demons always collect." },
];

// ---- Upgrade 39: radio chatter. Each racer talks while you race: when you pull up, at the start, when they pull ahead, when you do, when it is close,
// when you crash and when they light the nitrous. (Result lines, "win" and "lose" above, are shown on the result card.)
const CHAT = {
  pappu: { spot: ["Oye! Nice wheels. Want a race?", "Chalo, meter down. Race on?"], go: ["Seatbelt on, yaar!", "Meter's running!"], ahead: ["Traffic ke beech se nikal gaya!", "That's how a taxi does it!"], behind: ["Arre! Where did that come from?", "Slow down, I'm only a taxi!"], close: ["Door to door, bhai!", "Bumper to bumper, aaj toh!"], crash: ["Ooh, that's going to cost you!", "Careful! Repairs are expensive!"], nos: ["Hold on... nitro!", "Full tank, full speed!"] },
  lovely: { spot: ["Hey you. Yes, you. Race?", "Pink doesn't wait."], go: ["Don't blink!", "Lights out, sweetheart."], ahead: ["Look at those tail lights!", "Pretty, isn't it? My rear view."], behind: ["Okay, not bad!", "Wait up! I'm not done yet!"], close: ["Come on, closer, closer!", "Is that all you've got?"], crash: ["Oops. Did that hurt?", "Mind the paint, darling."], nos: ["Pink mode: ON!", "Say goodbye!"] },
  tinku: { spot: ["Gully mein race? Chalo!", "You, in my gully?"], go: ["Gully ka raja, let's go!", "Follow me if you can!"], ahead: ["Gully knowledge wins!", "Shortcut! You don't know this one."], behind: ["Arre, you know the road!", "No way! In MY gully?"], close: ["Sab barabar, abhi tak!", "Tight, yaar. Tight."], crash: ["Haha! The gully got you!", "Bad turn, bhai!"], nos: ["Gully rocket!", "Nitro, nitro, nitro!"] },
  sheru: { spot: ["Wake the cat? Brave.", "The cat is awake. Are you sure?"], go: ["Claws out!", "Hunting time."], ahead: ["Can't catch what you can't see.", "Cat and mouse, as usual."], behind: ["The cat slipped? Never.", "Hmph. I'm still here."], close: ["Close. The cat likes close.", "Right on my tail. Cute."], crash: ["Ouch. That's going to sting.", "Meow. Nine lives, you?"], nos: ["Pounce!", "Nitro claws!"] },
  billu: { spot: ["Yellow light. Go or stop?", "All the lights are green. Come."], go: ["Green light, go go go!", "All green, all mine!"], ahead: ["Green, green, green...", "Every light is mine!"], behind: ["You took my lights!", "Okay, now I'm angry."], close: ["Photo finish incoming!", "Wheel to wheel!"], crash: ["Red light for you!", "That's a red, my friend."], nos: ["Yellow flash!", "Floor it!"] },
  mirchi: { spot: ["Feeling spicy? Come.", "Careful. I'm hot."], go: ["Time to burn!", "Spice level: maximum."], ahead: ["Too spicy for you!", "Burn, baby, burn."], behind: ["That burns... in a good way.", "You're hot too!"], close: ["The heat is rising!", "Whoa, hot hot hot!"], crash: ["Told you, I bite!", "Ouch! Chilli in the eye?"], nos: ["Extra spice!", "Chilli bomb!"] },
  vajra: { spot: ["Thunder doesn't ask twice.", "Good timing. Race."], go: ["Thunder rolls.", "Strike."], ahead: ["You hear it after it passes.", "Too fast for your eyes."], behind: ["Impossible... again!", "Lightning never loses!"], close: ["Finally, someone real.", "Impressive. Now faster."], crash: ["Even storms don't miss.", "Gravity wins today."], nos: ["Lightning strike!", "Thunderclap!"] },
  toofan: { spot: ["The storm sees you.", "Brave. Or foolish."], go: ["Storm warning!", "The weather is turning."], ahead: ["Flood warning: you're behind.", "No calm before this storm."], behind: ["The storm shifts.", "You're the wind now."], close: ["A rival at last.", "The eye of the storm."], crash: ["Wreckage. Always wreckage.", "Another casualty."], nos: ["Hurricane force!", "Full storm!"] },
  tomo: { spot: ["Hello, driver. A friendly race?", "The night bus has room. Race?"], go: ["Doors closing. Hold on!", "Next stop: the finish line."], ahead: ["Express service. No stops.", "All aboard? Too late."], behind: ["Oh! You passed the bus!", "Faster than the timetable!"], close: ["Right on schedule!", "Side by side!"], crash: ["Mind the doors!", "That was a bad stop."], nos: ["Express mode!", "Full throttle!"] },
  nana: { spot: ["Meow. A race?", "Seven lives. Race me."], go: ["Nyaa! Let's go!", "Seven lives, one race!"], ahead: ["Cat on the prowl!", "Catch me, if you can!"], behind: ["Nyaa?! Impressive!", "Okay, one life gone!"], close: ["So close, nya!", "Whiskers to whiskers!"], crash: ["Did you land on your feet?", "Oh no, there goes a life!"], nos: ["Nya-trous!", "Cat rocket!"] },
  botan: { spot: ["Pretty cars bite too.", "A race among the flowers?"], go: ["Bloom time!", "Petals fly!"], ahead: ["Petals falling behind me.", "Beautiful, isn't it?"], behind: ["You trimmed me!", "A tough weed!"], close: ["Roots tangled!", "Thorn to thorn!"], crash: ["Wilted already?", "Ouch, thorns!"], nos: ["Full bloom!", "Petal storm!"] },
  riko: { spot: ["The bay is lovely at speed.", "Fox hunting? Come."], go: ["Fox run!", "Bay lights, go!"], ahead: ["Foxes are fast.", "Too clever for you."], behind: ["Clever fox... you!", "You caught my scent!"], close: ["Tails tangled!", "A real hunt now."], crash: ["Careful, hunter!", "Slipped, didn't you?"], nos: ["Fox fire!", "Kitsune boost!"] },
  jun: { spot: ["...A race.", "I don't talk much. Race."], go: ["Go.", "Quiet. Now."], ahead: ["...Faster.", "Gone."], behind: ["...Hm.", "Not bad."], close: ["Interesting.", "Hold the line."], crash: ["...Careless.", "Pity."], nos: ["Now.", "Boost."] },
  hoshi: { spot: ["Wish upon a star? Race me.", "I'm a shooting star!"], go: ["Make a wish!", "Star power!"], ahead: ["Wish denied!", "Chase the star!"], behind: ["A star falls... no!", "Impressive wish!"], close: ["The stars align!", "Side by side!"], crash: ["Oh, a falling star!", "Not your night."], nos: ["Supernova!", "Starlight boost!"] },
  raiden: { spot: ["The Wangan awaits. Race?", "Lightning strikes twice."], go: ["Tonight, the Wangan is mine.", "Flash!"], ahead: ["Faster than thunder.", "The Wangan bows to me."], behind: ["A worthy opponent.", "You are not ordinary."], close: ["Finally, a battle!", "This is racing!"], crash: ["Even legends fall.", "The road is unforgiving."], nos: ["Lightning rod!", "Maximum voltage!"] },
  oni: { spot: ["The demon watches you.", "Dare you?"], go: ["The hunt begins.", "Run, little one."], ahead: ["Fear the demon!", "No escape."], behind: ["The demon... falters?", "Impossible."], close: ["Hot breath on your neck.", "I smell fear... mine?"], crash: ["Demons always collect.", "A soul for the road."], nos: ["Hellfire boost!", "Burn!"] },
};
for (const r of [...MUMBAI, ...TOKYO]) r.chat = CHAT[r.id] || null;
// What a racer says when it has no line of its own for the moment, by how good it is.
const CHAT_GENERIC = {
  spot: [["Race?", "Want to race?"], ["Up for a race?", "You and me?"], ["Show me what you've got.", "Try to keep up."]],
  go: [["Go!", "Here we go!"], ["Let's do this!", "Now!"], ["Catch me!", "Don't blink."]],
  ahead: [["Eat my dust!", "Too slow!"], ["Keep up!", "See you at the end."], ["Gone.", "Can't touch this."]],
  behind: [["Not bad!", "Okay, you're quick."], ["Where did you come from?", "Nice move."], ["Impressive.", "Hm."]],
  close: [["Close one!", "Neck and neck!"], ["Don't lift!", "Wheel to wheel!"], ["Now it's a race.", "Finally."]],
  crash: [["Ouch.", "That looked painful."], ["Careful!", "Easy there."], ["Pity.", "Careless."]],
  nos: [["Nitrous!", "Hold on!"], ["Boost!", "Here we go!"], ["Nitro!", "Full send!"]],
};
/** What the racer says for this occasion (`kind`: spot, go, ahead, behind, close, crash, nos). Never the same line twice in a row: `last` is the previous one. */
export function chatLine(def, kind, rnd = Math.random, last = "") {
  const own = def && def.chat && def.chat[kind]; const gen = (CHAT_GENERIC[kind] || CHAT_GENERIC.go)[clamp((def && def.tier || 1) - 1, 0, 2)];
  const pool = (own && own.length ? own : gen).filter((t) => t !== last); const from = pool.length ? pool : (own && own.length ? own : gen);
  return from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
}
export const CHAT_KINDS = ["spot", "go", "ahead", "behind", "close", "crash", "nos"];

export const ROSTER = IS_TOKYO ? TOKYO : MUMBAI;
export const racerById = (id) => ROSTER.find((r) => r.id === id) || null;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TIER_MUL = [1, 1.5, 2.2];
/** The highest tier of racer that shows up for a driver at this level. */
export const maxTier = (level) => (level >= 6 ? 3 : level >= 3 ? 2 : 1);
/** How hard a racer drives at this level: tuning level for the car (0-5) and the AI settings. */
export function difficulty(level, tier) {
  const tl = clamp(Math.round(level * 0.45 + (tier - 1) * 1.2), 0, 5);
  return { tl, base: clamp(0.80 + 0.009 * level + 0.03 * (tier - 1), 0.80, 0.99), latG: 0.78 + 0.035 * (tier - 1) };
}
/** What a win pays. `streak` is the number of outruns won in a row BEFORE this one; `first` is the first time this racer is beaten. */
export function rewardFor(level, tier, streak = 0, first = false) {
  const m = TIER_MUL[clamp(tier, 1, 3) - 1] * (1 + Math.min(5, streak) * 0.1) * (first ? 1.6 : 1);
  return { cash: Math.round((300 + 130 * level) * m), xp: Math.round((70 + 22 * level) * m) };
}

// ---- geometry ------------------------------------------------------------------------------------------------------------------------------------------
/** Find the point on the route nearest to (x,z), searching around `hint` first (a route index). Returns {i, s, d}: index, distance along the route, distance off it. */
export function projectOnRoute(pts, hint, x, z) {
  const n = pts.length; const look = (a, b) => { let bi = -1, bd = 1e18; for (let i = Math.max(0, a); i < Math.min(n, b); i++) { const dx = pts[i].x - x, dz = pts[i].z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } } return { bi, bd }; };
  let r = look(hint - 25, hint + 160); if (r.bi < 0 || r.bd > 150 * 150) { const w = look(0, n); if (w.bi >= 0 && (r.bi < 0 || w.bd < r.bd * 0.5)) r = w; } // lost the route: search all of it
  const i = r.bi < 0 ? clamp(hint, 0, n - 1) : r.bi; let s = pts[i].s;
  // refine along the neighbouring segment so the number moves smoothly
  const nb = i + 1 < n ? i + 1 : i - 1 >= 0 ? i - 1 : i; if (nb !== i) { const a = pts[i], b = pts[nb]; const sx = b.x - a.x, sz = b.z - a.z, L2 = sx * sx + sz * sz || 1; const t = ((x - a.x) * sx + (z - a.z) * sz) / L2; if (t > 0 && t < 1) s = a.s + (b.s - a.s) * t; else if (t >= 1 && nb > i) s = b.s; }
  return { i, s, d: Math.sqrt(r.bd < 1e17 ? r.bd : 0) };
}

/** A long route that starts near (x,z). Heads roughly along `yaw` (when given) so a racer spawned ahead of the driver cruises away from them. Null when none could be found. */
export function farRoute(city, rnd, x, z, yaw = null, minLen = 2200, maxLen = 6500, tries = 5) {
  const a = city.nearestNode(x, z, 140, 140); if (!a || !a.edges.length) return null;
  for (let k = 0; k < tries; k++) {
    const ang = yaw == null ? rnd() * Math.PI * 2 : yaw + (rnd() - 0.5) * (k < 3 ? 1.6 : 3.4), dist = 2000 + rnd() * 2400;
    const b = city.nearestNode(a.x + Math.cos(ang) * dist, a.z + Math.sin(ang) * dist, 300, 1500); if (!b || b === a) continue;
    const path = city.route(a, b); if (!path || path.length < 4) continue;
    const pts = city.routePoints(path).map((p) => ({ x: p.x, z: p.z, y: p.y, s: 0 }));
    let s = 0; for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = s; }
    if (pts.length < 40 || s < minLen || s > maxLen) continue;
    return { pts, len: s, gates: [pts.length - 1] };
  }
  return null;
}
/** The rest of a route from index `from`, with the distances starting again from zero. */
export function tailRoute(route, from) {
  const pts = route.pts.slice(Math.max(0, from)).map((p) => ({ x: p.x, z: p.z, y: p.y, s: 0 }));
  let s = 0; for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = s; }
  return { pts, len: s, gates: [pts.length - 1] };
}
