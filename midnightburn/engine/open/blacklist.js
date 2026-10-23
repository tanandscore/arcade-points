// Midnight Burn — THE BLACKLIST (Upgrade 33). The city's fifteen most wanted street racers, #15 up to the boss at #1, a different crew in each city.
// To challenge a rival you first have to earn the right: three MILESTONES (two races on their turf and one skill goal) and the rival below
// you on the list must already be beaten. Beat a rival and you move up the list and take their car. No police yet — this is racers only.
//
// Mumbai: rough street racing — dock gangs, bridge kings, monsoon ghosts.   Tokyo: clean, fast drift racing — touge teams and the Wangan crews.
// All names are fictional, and every rival goes by a street alias, not a personal name.
import { IS_TOKYO } from "./mapId";

// [id, name, full name, title, home area, style, bio, taunt, win line, loss line, car, colour, livery, route places]
const MUMBAI = [
  ["chotu", "Chai Runner", "Chai Runner", "Quick off the line", "Colaba Causeway", "Quick off the line, nervous in the corners.", "Runs chai to the night crowd and races the empty roads after the last order. Fast hands, small car, huge heart.", "Arrey, new face! Easy race, bhai. I'll even let you take the first corner.", "Chai gets cold, my lead doesn't. Come back stronger.", "Haan, tum tez ho. Go on, the list is waiting for you.", "gecko", "#ffd23a", "stripes", ["colaba", "marinedrive"]],
  ["guddu", "Gully Dart", "Gully Dart", "Cuts everything close", "Dharavi", "Knows every gully. Cuts everything close.", "Grew up in lanes too narrow for a bus, so wide roads feel like a holiday. He never lifts.", "Wide road? That's cheating, yaar. I race where the walls are close.", "Gully rules. You'll learn.", "Not bad. You carry speed like a local.", "kestrel", "#ff4d3a", "side", ["dharavi", "kurla", "bkc"]],
  ["tiger", "Dock Brawler", "Dock Brawler", "Heavy and loud", "Sewri Docks", "Heavy and loud. Shoves through traffic.", "Drives a rebuilt dock truck's engine in a hatchback frame. Nobody has ever called him subtle.", "I race like I load ships. Hard. Try to keep up.", "Power wins. Always has.", "Hmm. You cornered better than you look.", "brute", "#ff8a1f", "racing", ["sewri", "kurla"]],
  ["bunty", "Showtime", "Showtime", "Loves an audience", "Bandra Reclamation", "Smooth, show-off lines. Loves an audience.", "Weekend king of the Bandra promenade. He wants to be seen winning, so he rarely makes a mess.", "Bandra is my stage. Hope you've got a good seat for the show.", "Applause, please. Thank you, thank you.", "Okay okay, you earned the crowd tonight.", "seven", "#2de2ff", "hex", ["bandra", "worli"]],
  ["roshni", "Night Shift", "Night Shift", "Waits for your mistake", "Juhu", "Patient. Waits for your mistake.", "Works hospital nights and races the sea road at dawn. Never rushes, never wastes a gear.", "I've been awake for twenty hours. I'm still going to beat you.", "Sleep well, champion. I won't.", "You were awake too, I see. Good drive.", "kestrel", "#ff7be0", "side", ["juhu", "bandra", "bkc"]],
  ["rocky", "Bandra Bullet", "Bandra Bullet", "Full throttle from metre one", "Pali Hill", "Full throttle from the first metre.", "Plays guitar, drives like he's in a hurry to a gig that already started. Brutal off the line.", "No warm-up, no mercy. Ready? Too late.", "Straight line speed. That's the whole secret.", "You out-braked me. Respect, man.", "frame", "#ff5a1f", "stripes", ["thane", "ghatkopar"]],
  ["mamba", "Thane Terror", "Thane Terror", "Late brakes, dirty overtakes", "Thane Station Road", "Late brakes, dirty overtakes.", "Half of Thane is scared of his bumper. He thinks a gap is an invitation.", "Brake early if you like. I never do.", "Should have braked earlier, friend.", "Impossible... you braked later than me.", "brute", "#7bff5a", "racing", ["thane", "upvan", "airoli"]],
  ["saira", "Marine Queen", "Marine Queen", "Perfect lines on the sea wall", "Marine Drive", "Perfect lines along the sea wall.", "Has driven Marine Drive more times than anyone alive. She can do the whole curve with her eyes closed.", "The Queen's Necklace is mine, every night. Ready to lose?", "The sea wall remembers me.", "Take my car, you earned it. Drive it well.", "phantom", "#f2f2f2", "racing", ["gateway", "marinedrive", "worli"]],
  ["raka", "Vashi Viper", "Vashi Viper", "Strikes from behind", "Vashi", "Strikes from behind. Waits, then pounces.", "Sits in your mirror for three kilometres and then pulls the move. Cold-blooded.", "I'll let you think you're winning. Right up to the bridge.", "The Viper always bites last.", "You never gave me a gap. Well driven.", "rennsport", "#b45cff", "hex", ["vashiarch", "nerul", "belapur"]],
  ["diva", "Palm Princess", "Palm Princess", "Flat out on the coast straights", "Palm Beach Road", "Flat out on the long coast straights.", "Palm Beach after midnight is her runway. Her nitrous timing is the stuff of legend.", "Long road, bright lights. Fast company, darling.", "The straight was mine. It always is.", "You burned your nitrous cleverer than me. Wow.", "praga", "#ff2d95", "side", ["vashiarch", "palmbeach", "belapur"]],
  ["bhai", "Bridge King", "Bridge King", "King of the bridges", "Airoli Bridge", "Heavy on the gas, king of the bridges.", "Runs the creek bridges like they're his living room. Whoever crosses first, owns the night.", "Bridges are mine. Cross if you dare.", "Long live the king.", "A new king? Hmm. Fine. Cross freely.", "solo", "#ff4d4d", "racing", ["airoli", "kharghar"]],
  ["ghost", "Monsoon Phantom", "Monsoon Phantom", "Only appears in the rain", "Atal Setu", "Only shows up when it rains. Never errs.", "A matte black car and a driver nobody has seen. They say the sea bridge hums when he's near.", "...", "...", "...You earned it.", "razor", "#14151b", "none", ["gateway", "atal", "jnpt"]],
  ["maharaj", "Sea Link Baron", "Sea Link Baron", "Smooth, never seems to try", "Bandra–Worli Sea Link", "Smooth, fast, never seems to try.", "Owns half the sea road's late-night record boards and speaks about them like old friends.", "The Sea Link is where I'm unbeatable. Convince me otherwise.", "Records are not for borrowing.", "Remarkable. The Sea Link is yours tonight.", "meteor", "#d8d8e0", "stripes", ["juhu", "sealink", "worli", "bkc"]],
  ["kali", "Black Widow", "Black Widow", "Hunts you on exit speed", "Dadar", "Hunts you down on exit speed.", "No one has ever beaten her out of a corner. Her little red hair-tie hangs on the mirror like a trophy.", "I don't chase. I wait for the exit. Then you're mine.", "Another one for the web.", "You carried the speed through the last bend. Impossible.", "vesper", "#b01030", "hex", ["cst", "dadar", "worli"]],
  ["sultan", "Midnight Monarch", "Midnight Monarch", "No weakness", "Bandra–Worli Sea Link", "The best there is. No weakness.", "Ten years unbeaten. His prototype was built in a garage nobody can find. Beat him and Mumbai is yours.", "You came a long way to lose. I respect that. Let's burn.", "Come back when you're ready. I'll be here.", "Ten years... and it ends here. The city is yours.", "specter", "#14151b", "hex", ["juhu", "sealink", "worli", "bkc"]],
];

const TOKYO = [
  ["mikan", "Market Runner", "Market Runner", "Clean and careful", "Tsukiji", "Clean and careful. Lifts early.", "Delivers fish to the markets before sunrise and drifts the empty streets after. Her hatchback is covered in stickers.", "Hi! Easy race, okay? No hard feelings. Mostly.", "Slow in, slow out. Come back later!", "Wow, you're quick! Go get the next one.", "gecko", "#ffd23a", "stripes", ["tsukiji", "shinagawa", "meguro"]],
  ["daichi", "Corner Store Kid", "Corner Store Kid", "Copies the best line", "Nakano", "Learns fast. Copies the best line.", "Spends every night at the corner store parking lot watching better drivers, then goes home and beats his own times.", "I watched your line already. I think I can take it.", "Study the line, then break it.", "Okay. That was the better line. Next time.", "kestrel", "#2de2ff", "side", ["nakano", "shinjuku"]],
  ["ren", "Wangan Rookie", "Wangan Rookie", "Flat out on the bayshore", "Haneda", "Flat out on the bayshore straights.", "Loves speed more than technique. The Wangan is his school.", "Eight hundred metres of straight. That's where I live.", "Wangan speed. Can't beat that.", "You took the corners better. Teach me?", "brute", "#ff7be0", "racing", ["hnd", "keihin"]],
  ["haruka", "Cherry Blossom", "Cherry Blossom", "Wide, graceful drift arcs", "Ueno", "Graceful, wide drift arcs.", "Learned to drift on a closed car park at midnight. Her lines look like brush strokes.", "Ueno is quiet at night. Let's make it loud.", "Petals fall where I choose.", "A beautiful drive. Please, take it.", "seven", "#ff9ad0", "hex", ["ueno", "asakusa", "skytree"]],
  ["kenji", "Drift King Jr.", "Drift King Jr.", "Sideways everywhere", "Shibuya", "Sideways everywhere. Loves the crowd.", "His father drifted these roads before him. He has the family name and the family grin.", "Sideways is faster. Don't tell my dad I said that.", "Family tradition: win.", "Heh. Dad is going to love hearing about you.", "frame", "#ff5a1f", "stripes", ["shibuyax", "harajuku", "shinjuku"]],
  ["tatsu", "Dragon", "Dragon", "A wall of nitrous", "Kawasaki", "Hard on the throttle, a wall of nitrous.", "Industrial night shifts, factory chimneys and a rumbling engine that wakes the whole block.", "I breathe fire on the straights. Watch the mirrors.", "The dragon never sleeps.", "You out-braked the dragon. I'll remember that.", "brute", "#7bff5a", "racing", ["kawasaki", "keihin", "tsurumi"]],
  ["sora", "Night Courier", "Night Courier", "Sharp transitions", "Akihabara", "Quick reflexes, sharp transitions.", "Delivers electronics by day and races the Akihabara back streets after the shutters close. Never looks at the speedometer.", "I know every shortcut in this district. You'll need more than a map.", "Shortcuts win races.", "Okay, the long way round was faster. Noted.", "kestrel", "#35e0ff", "stripes", ["akihabara", "ueno", "asakusa"]],
  ["yuki", "Snow Line", "Snow Line", "Cold and precise", "Hachioji", "Mountain specialist. Cold and precise.", "Takao mountain is her home course. She treats the hairpins like a conversation she's had a thousand times.", "Mountains don't forgive. I don't either.", "The mountain wins again.", "Good line through the last hairpin. Take my car.", "phantom", "#f2f2f2", "racing", ["hachioji", "takaosummit"]],
  ["hiro", "Touge Master", "Touge Master", "Textbook lines, endless patience", "Yokohama", "Textbook lines, endless patience.", "Taught half the Yokohama drivers how to take a corner. Still faster than any of them.", "I wrote the book on corners. Let's see if you read it.", "Class is dismissed.", "Remarkable. The student learned.", "rennsport", "#b45cff", "hex", ["yokohama", "kannai", "daikoku"]],
  ["mei", "Neon Angel", "Neon Angel", "Fast, bright, fearless", "Odaiba", "Fast, bright and fearless.", "Her car lights up the whole Odaiba waterfront. She's never taken a corner slower than the car allows.", "Lights on, music up. This one's for the crowd.", "Shine bright. Race faster.", "Okay okay, you can really drive. Don't get cocky.", "praga", "#ff2d95", "side", ["odaiba", "toyosu", "rainbow"]],
  ["goro", "Bayshore Bull", "Bayshore Bull", "Huge top speed", "Chiba", "Heavy right foot, huge top speed.", "Chiba's highway legend. If it's long and straight and the lights are off, the Bull is already there.", "Long road, big engine. You're going to need all of it.", "Bayshore bulls don't back down.", "You rode the bay better than I did. Wow.", "solo", "#ff4d4d", "racing", ["chiba", "makuhari", "funabashi"]],
  ["kuro", "Black Cat", "Black Cat", "Silent, after midnight", "Daikoku Parking Area", "Only shows up after midnight. Silent.", "A matte black car that appears out of nowhere at Daikoku and disappears just as fast.", "...", "...", "...You earned it.", "razor", "#14151b", "none", ["daikokupa", "baybridge", "kannai"]],
  ["shin", "Rainbow Runner", "Rainbow Runner", "Smooth over the long bridges", "Shiodome", "Smooth over the long bridges.", "Rainbow Bridge at 3 a.m. is his office. Nobody holds a drift through the loop like he does.", "The bridge loop is mine. Try to hold a line with me.", "The bridge remembers me.", "A new name on the bridge tonight. Well done.", "meteor", "#d8d8e0", "stripes", ["shiodome", "rainbow", "odaiba", "toyosu"]],
  ["akane", "Crimson Drift", "Crimson Drift", "Precision at impossible angles", "Roppongi", "Precision at impossible angles.", "Never once has she lost the back of the car. She leaves red tyre marks on every corner.", "Show me your angle. I'll show you mine.", "Crimson on the asphalt, again.", "Your angle was cleaner. I won't forget it.", "vesper", "#c8102e", "hex", ["roppongi", "shibuyax", "shinjuku", "nakano"]],
  ["kaito", "Wangan Emperor", "Wangan Emperor", "No weakness", "Daikoku Parking Area", "The best there is. No weakness.", "Ten years unbeaten from Daikoku to Yokohama. His prototype was built in a garage nobody can find.", "You came a long way to lose. I respect that. Let's burn.", "Come back when you're ready. I'll be here.", "Ten years... and it ends here. The city is yours.", "specter", "#14151b", "hex", ["daikokupa", "baybridge", "kannai", "landmarktower"]],
];

const SKILL = [ // the third milestone for each rung of the list (index 0 = #15 ... 14 = #1)
  ["wins", 3, "Win 3 street races"], ["sights", 3, "Discover 3 landmarks"], ["speed", 160, "Reach 160 km/h"], ["gold", 1, "Win a gold medal"],
  ["drift", 8000, "Score a drift of 8,000"], ["near", 30, "Make 30 near misses"], ["wins", 8, "Win 8 street races"], ["sights", 10, "Discover 10 landmarks"],
  ["speed", 200, "Reach 200 km/h"], ["gold", 4, "Win 4 gold medals"], ["drift", 16000, "Score a drift of 16,000"], ["near", 100, "Make 100 near misses"],
  ["wins", 16, "Win 16 street races"], ["gold", 8, "Win 8 gold medals"], ["sights", 20, "Discover 20 landmarks"],
];
const UNLOCK = { 12: "seven", 10: "frame", 8: "phantom", 6: "praga", 5: "solo", 4: "razor", 3: "meteor", 2: "vesper", 1: "specter" }; // rank -> the car you win
const MEDAL_NAME = ["", "a finish", "silver or better", "gold"];

/** The rivals for this city, #15 first. `events` is the list of races, used to pick the two turf races for each rival. */
export function makeBlacklist(events) {
  const src = IS_TOKYO ? TOKYO : MUMBAI;
  const races = events.filter((e) => e.type === "circuit" || e.type === "sprint" || e.type === "knockout" || e.type === "drag")
    .sort((a, b) => a.level - b.level || (a.type > b.type ? 1 : -1) || (a.id > b.id ? 1 : -1));
  const N = races.length;
  return src.map((r, j) => {
    const [id, name, full, title, from, style, bio, taunt, win, loss, car, color, livery, route] = r;
    const rank = 15 - j, t = j;
    const a = Math.min(N - 2, Math.floor((j * (N - 2)) / 14)), pick = [races[a], races[a + 1]].filter(Boolean);
    const minMedal = rank >= 9 ? 1 : 2;
    const ms = [...pick.map((e) => ({ kind: "race", ev: e.id, min: minMedal, label: `${minMedal > 1 ? "Win silver or better in" : "Finish"} ${e.name}` })), (() => { const [k, n, label] = SKILL[j]; return { kind: k, n, label }; })()];
    const unlockCar = UNLOCK[rank];
    return {
      id, rank, name, full, title, from, style, bio, taunt, win, loss, route, ms, unlockCar, accent: color === "#14151b" ? "#b45cff" : color,
      car: { car: unlockCar || car, color, finish: rank <= 4 ? "satin" : rank > 11 ? "gloss" : "metallic", livery: { type: livery, color: "#f2f2f2" }, rims: { style: ["fivespoke", "ten", "turbine", "mesh", "deep"][j % 5], color: "#c9ccd8" }, wing: rank <= 8 ? "gt" : "stock", kit: rank <= 6 ? "race" : rank <= 11 ? "street" : "stock", glow: "match", tint: "smoked", number: rank },
      ai: { base: 0.78 + t * 0.00857, latG: 0.75 + t * 0.0083, useNos: rank <= 13, block: rank <= 12 ? Math.min(0.6, 0.25 + (12 - rank) * 0.05) : 0 },
      carLevel: Math.floor(t * 0.21) + (rank === 1 ? 1 : 0),
      reward: { cash: 600 + t * 420 + (rank === 1 ? 2500 : 0), xp: 300 + t * 170 + (rank === 1 ? 1200 : 0), pts: 900 + t * 260 + (rank === 1 ? 2500 : 0) },
    };
  });
}

// how a milestone stands: { done, have, need } (have/need are numbers for progress bars)
export function milestoneState(m, career, medalRank) {
  const doneEv = (id) => career.done[id];
  switch (m.kind) {
    case "race": { const d = doneEv(m.ev); const have = d ? medalRank(d.medal) : 0; return { done: have >= m.min, have: Math.min(have, m.min), need: m.min }; }
    case "wins": { const have = Object.entries(career.done).filter(([id, d]) => !id.startsWith("duel-") && d.medal !== "none" && /^(circ|spr|ko|drag)/.test(id)).length; return { done: have >= m.n, have: Math.min(have, m.n), need: m.n }; }
    case "gold": { const have = Object.values(career.done).filter((d) => d.medal === "gold").length; return { done: have >= m.n, have: Math.min(have, m.n), need: m.n }; }
    case "sights": { const have = career.sights.length; return { done: have >= m.n, have: Math.min(have, m.n), need: m.n }; }
    case "speed": { const have = career.topSpeed || 0; return { done: have >= m.n, have: Math.min(have, m.n), need: m.n }; }
    case "drift": { const have = career.bestDrift || 0; return { done: have >= m.n, have: Math.min(Math.round(have), m.n), need: m.n }; }
    case "near": { const have = Math.floor(career.nearMiss || 0); return { done: have >= m.n, have: Math.min(have, m.n), need: m.n }; }
    default: return { done: false, have: 0, need: 1 };
  }
}
export { MEDAL_NAME };
