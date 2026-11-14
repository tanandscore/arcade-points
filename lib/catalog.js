// Upgrade 70 — THE game catalogue.
//
// This one file says which games exist on the site, which tier each one belongs to, and how each one is described and drawn.
// The database still holds the switches an owner flips from the admin area (a game on or off, "updating" mode, test-only),
// but WHAT a game is and WHICH tier it sits in now lives here, in code, so the store can never drift out of step.
//
// Three tiers, each one including the one before it:
//   Free        — every Free game, no card needed
//   Power Pass  — Free + the Power Pass games
//   Legend Pass — Free + Power Pass + the four big flagship games (and nothing else lives in Legend Pass)
//
// Any game that is NOT listed below is treated as retired: it disappears from the store, the search, the leaderboards' game list
// and the sitemap. Its old scores stay safe in the database. To bring one back, add it to CATALOG again.
//
// This file must stay plain data + tiny helpers (no imports from the server) because browser code uses it too.

import { GALLERY } from "./gallery";

export const TIERS = {
  free: { id: "free", name: "Free", short: "FREE", color: "#3ee6e0", planId: null, rank: 0, blurb: "Play right away. No card, no catch." },
  power: { id: "power", name: "Power Pass", short: "POWER PASS", color: "#ffb703", planId: "premium", rank: 1, blurb: "Bigger, deeper games. Includes everything in Free." },
  legend: { id: "legend", name: "Legend Pass", short: "LEGEND PASS", color: "#ff3ea5", planId: "premium_plus", rank: 2, blurb: "The four flagship games. Includes everything in Power Pass." },
};
export const TIER_ORDER = ["free", "power", "legend"];

// Broad genres used for filters and the "Browse by genre" tiles. Each game also has a more specific `style` label shown on its page.
export const GENRES = [
  { id: "Platformer", icon: "🏃", color: "#3ee6e0", blurb: "Run, jump and stomp" },
  { id: "Physics", icon: "🎯", color: "#ff3ea5", blurb: "Aim, launch and topple" },
  { id: "Action", icon: "💥", color: "#ff8a1f", blurb: "Fast fights and boss battles" },
  { id: "Shooter", icon: "🔫", color: "#3e8bff", blurb: "Take aim and clear the room" },
  { id: "Puzzle", icon: "🧩", color: "#c06bff", blurb: "Think first, then move" },
  { id: "Strategy", icon: "♟️", color: "#8ae234", blurb: "Plan, build and outsmart" },
  { id: "Racing", icon: "🏁", color: "#ff2d95", blurb: "Speed, drifts and neon" },
  { id: "Sports", icon: "⛳", color: "#5de37a", blurb: "Relaxed skill games" },
];

const shotsOf = (slug) => (GALLERY.find((g) => g.slug === slug)?.shots || []).map((s) => ({ src: s.src, alt: s.alt, cap: s.cap }));
const own = (slug, n, caps) => Array.from({ length: n }, (_, i) => ({ src: `/shots/${slug}-${i + 1}.jpg`, alt: `${slug} gameplay screenshot ${i + 1}`, cap: caps[i] || "" }));

// status: "live" = playable now, "soon" = shown in the "Coming soon" row.   kit: built on the shared 2D game kit (arcade2d/).
export const CATALOG = [
  // ───────────────────────────── LEGEND PASS — the four flagships ─────────────────────────────
  {
    slug: "midnightburn", name: "Midnight Burn", icon: "🌃", tier: "legend", genre: "Racing", style: "Open-world street racing", accent: "#ff2d95", status: "live", kit: false, desktopOnly: true, order: 1, featured: 1,
    tagline: "A six-map neon street-racing career. Rain, fog, traffic, rivals, a garage, and quests hidden in every map.",
    about: [
      "Drive a living city after dark. Tokyo neon, Mumbai's coastline in 2046, rain, fog and storms, and traffic that actually reacts to you.",
      "Build a career: win races, finish quests hidden in every map, earn cash and turn a humble car into your dream machine in the garage.",
    ],
    features: ["Six night maps across Tokyo and Mumbai", "Rain, fog and storms that change how the road feels", "A quest hidden in every map", "A garage with upgrades and cosmetics", "Rivals, traffic and a full career to climb"],
    pitch: ["6 night maps", "Rain & storms", "Garage & upgrades", "Real 3D"], tags: ["Open world", "3D", "Racing", "Career", "Atmospheric", "Great visuals"],
    stats: [["6", "maps"], ["3D", "graphics"]], modes: ["Single-player"],
    capsule: "/gallery/mb-tokyo-neon.jpg", shots: shotsOf("midnightburn"), controls: null,
  },
  {
    slug: "operationblacksite", name: "Operation Blacksite", icon: "🎯", tier: "legend", genre: "Shooter", style: "Tactical 3D shooter", accent: "#ff3ea5", status: "live", kit: false, desktopOnly: true, order: 2, featured: 5,
    tagline: "Mouse-aimed tactical shooting, a buy phase, and a bomb to plant or defuse.",
    about: [
      "Buy your gear, then plant or defuse the bomb across four detailed maps. The bots here really do hunt you, so use cover and think before you peek.",
      "Play against smart bots on your own, or jump into online matches with other players.",
    ],
    features: ["A buy phase before every round", "Plant and defuse the bomb", "Smart bots that flank and hunt", "Four detailed maps", "Online multiplayer matches"],
    pitch: ["Buy phase", "Plant & defuse", "Smart bots", "Real 3D"], tags: ["Tactical", "3D", "Shooter", "Multiplayer", "Bots", "Competitive"],
    stats: [["4", "maps"], ["3D", "graphics"]], modes: ["Single-player", "Online multiplayer"],
    capsule: "/gallery/bs-foundry.jpg", shots: shotsOf("operationblacksite"), controls: null,
  },
  {
    slug: "kingdomsofash", name: "Ashtide", icon: "🏘️", tier: "legend", genre: "Strategy", style: "Cozy town builder", accent: "#ffb703", status: "live", kit: false, desktopOnly: true, order: 3, featured: 0,
    tagline: "A cozy harbour-town builder. Click the sea to raise colourful houses, towers and gardens. No timer, no enemies.",
    about: [
      "Stack colourful houses over the water, plant rooftop gardens and watch your town glow when night falls.",
      "There is no timer and nothing to lose. Ashtide is calm, deep and endlessly creative.",
    ],
    features: ["Raise houses, towers and gardens with a click", "A full day and night cycle", "No timer, no enemies, no pressure", "Your town is saved to your account"],
    pitch: ["Build a town", "Day & night", "Calm & deep"], tags: ["Relaxing", "Building", "3D", "Creative", "Cozy", "No fail state"],
    stats: [["∞", "to build"], ["3D", "graphics"]], modes: ["Single-player"],
    capsule: "/gallery/ash-night.jpg", shots: shotsOf("kingdomsofash"), controls: null,
  },
  {
    slug: "wrathofolympus", name: "Wrath of Olympus", icon: "⚡", tier: "legend", genre: "Strategy", style: "Real-time strategy", accent: "#ffd23f", status: "live", kit: false, desktopOnly: true, order: 4, featured: 0,
    tagline: "Lead Athens in a real-time strategy war. Gather, build a city, climb three ages, raise an army and destroy Sparta.",
    about: [
      "Gather food, wood, gold and stone, build your city, climb through three ages and train an army of hoplites, archers, horsemen and catapults.",
      "Call on the gods for thunderbolts and blessings, push through the fog of war and destroy every enemy Town Center to win.",
    ],
    features: ["Gather, build and climb three ages", "Heroes, gods and siege weapons", "Fog of war and a minimap", "Three difficulty levels with score bonuses", "A campaign, omens and a pantheon of powers"],
    pitch: ["Divine powers", "Heroes & gods", "Fog of war"], tags: ["RTS", "3D", "Mythology", "Base building", "Strategy", "Deep"],
    stats: [["3", "ages"], ["3D", "graphics"]], modes: ["Single-player"],
    capsule: "/gallery/ol-battle.jpg", shots: shotsOf("wrathofolympus"), controls: null,
  },

  // ───────────────────────────── POWER PASS ─────────────────────────────
  {
    slug: "skylinesiege", name: "Skyline Siege", icon: "🔫", tier: "power", genre: "Action", style: "Run & gun", accent: "#ff8a1f", status: "live", kit: true, desktopOnly: false, order: 10, featured: 2, added: "2026-10-28",
    tagline: "Port Meridian is under siege. Run, gun and blast through sixteen missions and four towering bosses.",
    about: [
      "A classic run-and-gun for the browser. Sprint through four districts of Port Meridian, shoot your way past the Syndicate's soldiers, snipers, drones and walkers, and rescue the citizens they have trapped.",
      "Pick up the Rattler, Thumper, Prism and Skybreaker, blow open hidden walls with grenades and build a combo for a bigger score. At the end of every district a huge boss blocks the way.",
    ],
    features: ["16 missions across 4 districts", "4 big bosses: Crane Colossus, Neon Widow, Forge Titan and The Architect", "5 guns, grenades, armour and secret stashes", "Rescue 3 citizens per mission", "Combo scoring up to x5, stars for every mission", "Works with a keyboard or on a phone with touch controls"],
    pitch: ["16 missions", "4 boss fights", "5 guns", "Touch friendly"], tags: ["Run and gun", "Boss fights", "2D", "Action", "Retro-inspired", "Touch friendly", "Cloud saves"],
    stats: [["16", "missions"], ["4", "districts"], ["4", "bosses"]], modes: ["Single-player"], levels: 16,
    capsule: "/capsules/skylinesiege.jpg", shots: own("skylinesiege", 5, ["Harbor Front", "Boss: Crane Colossus", "Neon Strip", "Foundry Row", "Skyline Spire"]),
    controls: [["← → or A D", "Run"], ["Space, Z or K", "Jump (hold for higher)"], ["X, J or F", "Shoot"], ["↑ (hold)", "Aim up; ↑ + direction aims diagonally"], ["↓", "Duck"], ["C, L or Shift", "Throw a grenade"], ["Q, E or Tab", "Swap guns"]],
    touchControls: "On-screen buttons for run, jump, fire, aim up, duck, grenade and swap.",
  },
  {
    slug: "hollowdeep", name: "Hollow Deep", icon: "🗡️", tier: "power", genre: "Action", style: "Dungeon fighter", accent: "#8f7bff", status: "live", kit: true, desktopOnly: false, order: 11, added: "2026-10-29",
    tagline: "Swing, dash and deflect your way down four depths to four bosses.",
    about: [
      "Each floor is one torch-lit room, and the monsters arrive in waves. Swing your sword to cut them down and to knock arrows and sparks out of the air, dash to slip through attacks, and fire sparks at the archers and wisps that keep their distance.",
      "Twenty floors across four depths: a mossy crypt, a frozen vault, burning halls and a void sanctum. Each depth ends in a boss with its own tricks. On every floor, clear the room for a first star, find the hidden relic chest for a second, and keep three hearts for the third.",
    ],
    features: ["20 floors in 4 depths, 4 boss fights", "Sword, dash and spark: three moves that all matter", "9 kinds of monster, from slimes to the Void Eye", "Timed spike traps and shock rings to dodge", "A hidden relic chest on every floor", "Every floor cleared with 3 stars by an automatic hero", "Keyboard, mouse or touch"],
    pitch: ["20 floors", "4 boss fights", "Swing, dash, deflect", "Touch friendly"], tags: ["Action", "Dungeon", "Boss fights", "2D", "Top-down", "Touch friendly", "Cloud saves"],
    stats: [["20", "floors"], ["4", "bosses"], ["9", "monsters"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/hollowdeep.jpg", shots: own("hollowdeep", 5, ["Mossy Crypt", "Frost Queen", "Magma Golem", "Void Sanctum", "The Void Eye"]),
    controls: [["Arrow keys or WASD", "Move"], ["X, J or click", "Swing your sword"], ["Shift or C", "Dash (no damage while dashing)"], ["Space, Z or K", "Fire a spark"], ["R", "Restart the floor"]],
    touchControls: "Use the arrow buttons to move. SWING slashes your sword, DASH slips through attacks and BOLT fires a spark.",
  },
  {
    slug: "ironbloomclash", name: "Ironbloom Clash", icon: "🥊", tier: "power", genre: "Fighting", style: "2.5D fighter", accent: "#ff9a3c", status: "live", kit: true, desktopOnly: false, order: 14, added: "2026-11-06",
    tagline: "Six fighters. Eight bouts. Fireballs, combos, throws and supers in a 2.5D fighting game.",
    about: [
      "Ironbloom Clash is a one-on-one fighting game with real fighting-game rules: blocking, high and low attacks, throws, combos, launchers and a super bar. Pick one of six very different fighters, from the fast Vesper to the huge Bruno, and fight up an eight-bout ladder to the Ironbloom King.",
      "Every bout is best of three rounds in front of a roaring crowd, on eight different stages. The opponents get smarter as you climb: they block, anti-air your jumps, throw when you turtle and spend their super bar. Win without dropping a round for two stars, and finish healthy for three.",
    ],
    features: ["6 fighters with their own looks, stats and special moves", "Special moves by motion: fireballs, rising strikes, rushes, slides, blinks and command throws", "Blocking, throws, launchers, combos and a super bar", "8 bouts on 8 stages, best of three rounds", "Opponents that block, anti-air and zone, getting smarter every bout", "Keyboard or touch controls"],
    pitch: ["6 fighters", "8 bouts", "Specials and supers", "Touch friendly"], tags: ["Fighting", "2.5D", "Action", "Combos", "Arcade", "Touch friendly", "Cloud saves"],
    stats: [["6", "fighters"], ["8", "bouts"], ["8", "stages"]], modes: ["Single-player"], levels: 8,
    capsule: "/capsules/ironbloomclash.jpg", shots: own("ironbloomclash", 5, ["Docks", "Factory floor", "Super move", "Snowfield", "Final bout"]),
    controls: [["← → or A D", "Walk (hold back to block)"], ["↑ or W", "Jump"], ["↓ or S", "Crouch"], ["X, J or F", "Punch"], ["C, L or Shift", "Kick"], ["Q, E or Tab", "Heavy attack"], ["Punch + Kick", "Throw"]],
    touchControls: "On-screen arrows plus P, K and H buttons. Press P and K together to throw.",
  },
  {
    slug: "lumentrail", name: "Lumen Trail", icon: "🗡️", tier: "power", genre: "Role-playing", style: "HD-2D turn-based RPG", accent: "#ffcf5a", status: "live", kit: true, desktopOnly: false, order: 15, added: "2026-11-06",
    tagline: "Four travellers, one fallen star. Break shields, boost your party and fight your way north.",
    about: [
      "Lumen Trail is a turn-based role-playing game in a glowing, pixel-art world with soft lighting and depth blur. Walk the road through six chapters, meet four travellers with very different weapons and magic, and fight your way to the place where the star fell.",
      "Every enemy hides weaknesses. Find them to crack its shields, then unload boosted attacks while it is stunned. Bosses charge huge attacks, so breaking them in time is the whole game. Keep your whole party standing for more stars.",
    ],
    features: ["6 chapters with story scenes, chests, camps and boss fights", "4 heroes who join along the way, each with their own weapons and skills", "Break and boost battle system with hidden weaknesses", "Bosses with charge-up attacks and a second phase", "Items, healing, revives and party skills", "Keyboard, mouse or touch menus", "Cloud saves"],
    pitch: ["6 chapters", "4 heroes", "Break and boost", "Touch friendly"], tags: ["Role-playing", "Turn-based", "HD-2D", "Story", "Pixel art", "Touch friendly", "Cloud saves"],
    stats: [["6", "chapters"], ["4", "heroes"], ["6", "bosses"]], modes: ["Single-player"], levels: 6,
    capsule: "/capsules/lumentrail.jpg", shots: own("lumentrail", 5, ["The road", "Story", "Weakness found", "Shield break", "Boss"]),
    controls: [["↑ ↓", "Move the menu cursor"], ["Enter, Space or X", "Confirm"], ["C, L or Shift", "Back"], ["Q, E or Tab", "Boost"], ["Mouse or touch", "Tap menu entries and enemies"]],
    touchControls: "On-screen arrows, OK, BACK and BOOST buttons, or tap the menu directly.",
  },
  {
    slug: "gloamreach", name: "Gloamreach", icon: "🏮", tier: "power", genre: "Adventure", style: "Metroidvania", accent: "#9bffb0", status: "live", kit: true, desktopOnly: false, order: 16, added: "2026-11-06",
    tagline: "One dark, glowing map. Four lost abilities. A heart that will not stop beating.",
    about: [
      "Gloamreach is a metroidvania: one big connected map of sixteen rooms that you explore in any order you can manage. Doors you cannot open and ledges you cannot reach are not dead ends. They are notes to yourself for later.",
      "Find the double jump, the air dash, the wall cling and the overcharged shot. Beat three guardians, Lanternjaw, Mossback and Cinderwyrm, to open the way to the Gloam Heart. Rest at statues to heal and save. Your lantern lights the way, and the dark is real.",
    ],
    features: ["16 connected rooms in five regions with a map screen", "4 abilities that open up the world: double jump, air dash, wall cling, overcharge", "4 boss fights with their own patterns and rage phases", "Secret rooms behind cracked blocks and amber blocks", "12 Sparks and 5 Life crystals to find", "Rest statues that heal and save your progress", "Dynamic lantern lighting", "Every ability route checked by an automatic route tester", "Keyboard or touch controls"],
    pitch: ["Connected map", "4 abilities", "4 bosses", "Touch friendly"], tags: ["Metroidvania", "Exploration", "Action", "Platformer", "Boss fights", "Touch friendly", "Cloud saves"],
    stats: [["16", "rooms"], ["4", "abilities"], ["4", "bosses"]], modes: ["Single-player"], levels: 1,
    capsule: "/capsules/gloamreach.jpg", shots: own("gloamreach", 5, ["Mossgate", "Sunken caves", "Boss fight", "Crystal spires", "Cinder shaft"]),
    controls: [["← → or A D", "Move"], ["Space, Z or K", "Jump"], ["X, J or F", "Fire (hold ↑ to aim up)"], ["C, L or Shift", "Dash (once learned)"], ["↑ at a statue", "Rest and save"], ["Tab, Q or E", "Map"]],
    touchControls: "On-screen arrows, JUMP, FIRE, DASH and MAP buttons. Press ▲ at a statue to rest.",
  },
  { slug: "starlinevanguard", name: "Starline Vanguard", icon: "🚀", tier: "power", genre: "Shooter", style: "Shoot 'em up", accent: "#38bdf8", status: "live", kit: true, desktopOnly: false, order: 12, added: "2026-10-29",
    tagline: "Fly the last fighter of the Starline fleet through four sectors of enemy fire.",
    about: [
      "Your ship fires by itself, so the whole game is flying. Weave through walls of bullets, shoot down the carriers to grab power-ups, and drop a Nova bomb when the screen fills up. Every hit costs a shield pip and a weapon level, so every dodge matters.",
      "Twenty stages in four sectors: an asteroid belt, a glittering nebula, a ruined space station and the Void Gate. Each sector ends with a giant boss with its own pattern: the Warden, the Prism, the Bulwark and the Gate Eye. Clear a stage without a single hit for three stars.",
    ],
    features: ["20 stages in 4 sectors", "4 giant bosses with their own patterns", "Weapon upgrades up to a 5-way spread with homing missiles", "Nova bombs that clear the screen", "Combo score multiplier", "Every stage cleared by our automatic test pilot", "Keyboard, mouse drag or touch drag", "Cloud saves"],
    pitch: ["20 stages", "4 bosses", "Power-ups", "Touch friendly"], tags: ["Shoot 'em up", "Space", "Arcade", "Bullet hell", "Boss fights", "Touch friendly", "Cloud saves"],
    stats: [["20", "stages"], ["4", "bosses"], ["5", "weapon levels"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/starlinevanguard.jpg", shots: own("starlinevanguard", 5, ["Rock Garden", "Prism Pass", "Reactor Hall", "Mirror Fleet", "The Gate Eye"]),
    controls: [["Arrow keys or WASD", "Fly"], ["Space, Z or X", "Nova bomb"], ["Click and drag", "Fly toward the pointer"], ["R", "Restart the stage"]],
    touchControls: "Drag a finger anywhere to fly: your ship follows, just to the left of your finger. Tap NOVA for a screen-clearing bomb.",
  },
  { slug: "emberdeck", name: "Ember Deck", icon: "🃏", tier: "power", genre: "Strategy", style: "Card battler", accent: "#ff5d73", status: "live", kit: true, desktopOnly: false, order: 13, added: "2026-10-29",
    tagline: "Build a deck of ember cards and fight your way up to the Ember Lord.",
    about: [
      "Every fight is a turn-based card duel. You get three energy and a hand of five cards each turn. Strike, shield, burn or heal, and watch the red numbers above each enemy to see what they will do next, so you can plan around it before you end your turn.",
      "Twenty fights in four worlds: ash dunes, a glass desert, a frozen pass and the Ember Lord's throne. Win a fight and pick one new card for your deck. Fourteen kinds of enemy, from pests to knights to bosses, and sixteen cards to find, so every deck plays differently.",
    ],
    features: ["20 fights in 4 worlds", "16 cards to collect", "14 enemy types and 4 bosses", "Enemies show their next move", "Pick a new card after every win", "Every fight beaten by our automatic player", "Mouse, keyboard and touch"],
    pitch: ["20 fights", "16 cards", "Build your deck", "Touch friendly"], tags: ["Card game", "Strategy", "Deck building", "Turn-based", "Touch friendly", "Cloud saves"],
    stats: [["20", "fights"], ["16", "cards"], ["4", "worlds"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/emberdeck.jpg", shots: own("emberdeck", 5, ["Two Pests", "Pick a Card", "Wolf Pack", "Knight Watch", "The Ember Lord"]),
    controls: [["Click a card, then an enemy", "Play it"], ["1 to 9", "Pick a card from your hand"], ["Enter or E", "End your turn"], ["Esc", "Put a card back"], ["R", "Restart the fight"]],
    touchControls: "Tap a card, then tap the enemy you want to hit. Tap End turn when you are done.",
  },
  { slug: "echocaverns", name: "Echo Caverns", icon: "🦇", tier: "power", genre: "Platformer", style: "Exploration platformer", accent: "#2de2b3", status: "soon", kit: true, desktopOnly: false, order: 14,
    tagline: "Explore a sprawling cave, find new abilities and unlock the way back to the surface.",
    about: ["One big connected cave full of secrets. Every new ability opens a path you could not reach before."],
    features: [], pitch: ["One big map", "New abilities"], tags: ["Exploration", "Platformer", "2D"], stats: [], modes: ["Single-player"] },
  { slug: "backalleybrawl", name: "Back Alley Brawl", icon: "🥊", tier: "power", genre: "Action", style: "Beat 'em up", accent: "#ffd166", status: "soon", kit: true, desktopOnly: false, order: 15,
    tagline: "Punch, kick and throw your way down the neon back alleys.",
    about: ["A street brawler with combos, throws and a boss waiting at the end of every block."],
    features: [], pitch: ["Combos", "Boss at every block"], tags: ["Brawler", "Action", "2D"], stats: [], modes: ["Single-player"] },
  { slug: "craterwars", name: "Crater Wars", icon: "☄️", tier: "power", genre: "Physics", style: "Artillery", accent: "#d98cff", status: "soon", kit: true, desktopOnly: false, order: 16,
    tagline: "Aim, fire and blast away the enemy's ground in turn-based artillery.",
    about: ["Dial in your angle and power, read the wind and blow craters in the terrain until the other side has nowhere left to stand."],
    features: [], pitch: ["Wind & terrain", "Many weapons"], tags: ["Artillery", "Physics", "2D"], stats: [], modes: ["Single-player"] },
  { slug: "lanternwatch", name: "Lantern Watch", icon: "🏮", tier: "power", genre: "Strategy", style: "Tower defense", accent: "#ffa94d", status: "soon", kit: true, desktopOnly: false, order: 17,
    tagline: "Light the lanterns, build your towers and hold the night.",
    about: ["Place towers along the path, light the lanterns that power them and stop every wave before dawn."],
    features: [], pitch: ["Towers & upgrades", "Hold the night"], tags: ["Tower defense", "Strategy", "2D"], stats: [], modes: ["Single-player"] },

  // ───────────────────────────── FREE ─────────────────────────────
  {
    slug: "kikoleap", name: "Kiko Leap", icon: "🫧", tier: "free", genre: "Platformer", style: "Platform adventure", accent: "#3ee6e0", status: "live", kit: true, desktopOnly: false, order: 20, featured: 3, added: "2026-10-28",
    tagline: "A bouncy platform adventure across four worlds. Stomp, float and smash your way to the flag!",
    about: [
      "Run, jump and float through four colourful worlds: Sunny Meadow, Crystal Caves, Cloud Kingdom and Ember Peak. Stomp on gloops, bounce off springs, smash bricks and ground-pound the spiky ones.",
      "Collect the three big Star Seeds in every level and beat the par time for three stars. At the end of each world a boss is waiting, and each one has a pattern you can learn.",
    ],
    features: ["24 levels in 4 worlds", "A boss at the end of every world", "Jump, float, sprint and ground-pound", "3 Star Seeds and a par time on every level", "Checkpoint flags that refill your hearts", "Works with a keyboard or on a phone with touch controls"],
    pitch: ["24 levels", "4 worlds", "Boss fights", "Touch friendly"], tags: ["Platformer", "Colorful", "Cute", "Family friendly", "Boss fights", "Touch friendly", "Cloud saves"],
    stats: [["24", "levels"], ["4", "worlds"], ["4", "bosses"]], modes: ["Single-player"], levels: 24,
    capsule: "/capsules/kikoleap.jpg", shots: own("kikoleap", 5, ["Sunny Meadow", "Crystal Caves", "Cloud Kingdom", "Ember Peak", "Boss: Ignar the Magma Golem"]),
    controls: [["← → or A D", "Run"], ["Space or Z", "Jump (hold for higher)"], ["Jump again, hold", "Float in mid-air"], ["↓ or S in the air", "Ground-pound"], ["X, J or Shift", "Hold to sprint"]],
    touchControls: "On-screen buttons for run, jump, sprint and ground-pound.",
  },
  {
    slug: "hushwell", name: "Hushwell", icon: "🔦", tier: "free", genre: "Puzzle", style: "Puzzle escape", accent: "#ff6b6b", status: "live", kit: true, desktopOnly: false, order: 30, featured: 5, added: "2026-11-06",
    tagline: "A quiet little kid. A very big, very silent building. Find out what is humming at the bottom.",
    about: [
      "Hushwell is a moody puzzle-escape in three parts: a silent pump hall, a drowned and dark lower floor, and a bright ward full of guards. There is no talking. You work it out by pushing crates onto plates, dodging dart traps and falling weights, and hiding in tall grass.",
      "Every chapter hides three glowing Sparks, and the last two chapters turn into frantic chases where something dark follows you. Finish with few tries for a third star.",
    ],
    features: ["9 hand-built chapters in 3 areas", "Crate and plate puzzles with colour-matched gates", "Lantern-lit dark levels, dart traps and crushers", "Stealth: hide from guards in tall grass", "Two panicked chase chapters", "3 hidden Sparks and a try limit on every chapter", "Keyboard or touch controls"],
    pitch: ["9 chapters", "Crates and gates", "Stealth and chases", "Touch friendly"], tags: ["Puzzle", "Atmospheric", "Stealth", "2D", "Story", "Touch friendly", "Cloud saves"],
    stats: [["9", "chapters"], ["3", "areas"], ["27", "sparks"]], modes: ["Single-player"], levels: 9,
    capsule: "/capsules/hushwell.jpg", shots: own("hushwell", 5, ["Cold Start", "Weighted Doors", "Wet Dark", "Quiet Feet", "Flood Run"]),
    controls: [["← → or A D", "Walk"], ["Space or W", "Jump"], ["↓ or S", "Crouch; hold in tall grass to hide"], ["Walk into a crate", "Push it"]],
    touchControls: "On-screen buttons for walking, jumping and crouching.",
  },
  {
    slug: "starbreak", name: "Starbreak", icon: "🚀", tier: "free", genre: "Action", style: "3D space rebels", accent: "#ff7a3a", status: "live", kit: false, desktopOnly: true, order: 9, added: "2026-11-06",
    tagline: "Fly a rebel starfighter, run the station trench and duel with an energy blade. Full 3D.",
    about: [
      "Starbreak is a full 3D space-rebels adventure. The Free Fleet is outnumbered by the Iron Dominion, and you are the pilot who has to even the odds.",
      "Fly six starfighter missions: dogfights with lock-on missiles, a convoy you must keep alive, an asteroid field, a giant warship with turrets and engine pods, a canyon-like trench run with a torpedo shot at the end, and a final dreadnought battle.",
      "Then step out of the cockpit for six energy-blade duels. Swing, guard, parry a mercenary's strike, push enemies back and turn blaster bolts around on the troopers who fired them, all the way to the Iron Knight. Every star you earn raises your fleet power. It is completely free.",
    ],
    features: ["6 starfighter missions with lasers, missiles and boost", "Convoy guard, asteroid field, warship and dreadnought battles", "A full trench run ending with a torpedo shot", "6 blade duels with guard, parry, deflect and force push", "Boss duel against the Iron Knight", "Earn stars to raise your fleet power"],
    pitch: ["12 levels", "Starfighter combat", "Blade duels", "Trench run"], tags: ["3D", "Sci-fi", "Space", "Action", "Free", "Cloud saves"],
    stats: [["12", "levels"], ["2", "modes"], ["36", "stars"]], modes: ["Single-player"], levels: 12,
    capsule: "/capsules/starbreak.jpg", shots: own("starbreak", 5, ["Warship Strike", "Trench Run", "Asteroid Field", "Dogfight", "Blade Duel"]),
    controls: [["Mouse / W A S D", "Steer the ship, or move in duels"], ["Left click", "Lasers, or swing the blade"], ["Right click", "Missile, or guard and parry"], ["Shift / Space", "Boost / brake (ship), roll (duel)"], ["E", "Force push (duel)"], ["Tab", "Switch target (duel)"]],
    touchControls: "This game needs a keyboard and mouse (laptop or desktop).",
  },
  {
    slug: "skyguard", name: "Skyguard", icon: "🦅", tier: "free", genre: "Action", style: "3D superhero", accent: "#4aa3ff", status: "live", kit: false, desktopOnly: true, order: 10, added: "2026-11-07",
    tagline: "Fly over a glowing city, put out fires, stop getaway cars and fight giant robots in the street. Full 3D.",
    about: [
      "Skyguard is a full 3D superhero adventure set in Halcyon City. You are Kestrel, a hero who can fly, burn targets with heat vision, freeze fires with frost breath and smash through almost anything.",
      "In Sky Patrol you fly freely between the skyscrapers: race through rings, catch falling civilians, put out five burning towers, stop three armoured getaway cars, shoot down a missile barrage aimed at City Hall and finally take on a giant warship.",
      "In Street Justice you fight gangs in the plaza: chain punch combos, dodge gunmen, slam the ground, hurl whole cars at shield robots and heavy hitters, and finish with a duel against the giant Overload. Every star you earn raises your hero power. It is completely free.",
    ],
    features: ["6 flying missions over a full 3D city, day, dusk, dawn and night", "Heat vision, frost breath and a sonic boost that smashes enemies", "6 street fights with combos, dash, ground slam and throwable cars", "Gunmen, brutes and shield robots that each need a different answer", "Boss fights: a warship in the sky and the giant Overload on the ground", "Earn stars to raise your hero power"],
    pitch: ["12 levels", "Free flight", "Street fights", "Boss battles"], tags: ["3D", "Superhero", "Flying", "Action", "Free", "Cloud saves"],
    stats: [["12", "levels"], ["2", "modes"], ["36", "stars"]], modes: ["Single-player"], levels: 12,
    capsule: "/capsules/skyguard.jpg", shots: own("skyguard", 5, ["Over the City", "Fire Night", "Street Fight", "Car Smash", "Overload"]),
    controls: [["Mouse / W A S D", "Steer and fly, or move and turn"], ["Left click", "Heat vision (flying) or punch"], ["Right click", "Frost breath (flying) or heat vision"], ["Shift", "Sonic boost"], ["Space / Q / E", "Up or dash / ground slam / throw"], ["Tab", "Switch target (fights)"]],
    touchControls: "This game needs a keyboard and mouse (laptop or desktop).",
  },
  {
    slug: "threefold", name: "Threefold", icon: "🛡️", tier: "free", genre: "Puzzle", style: "3D puzzle platformer", accent: "#ffd24a", status: "live", kit: false, desktopOnly: true, order: 11, added: "2026-11-07",
    tagline: "Swap between a Warden, a Wisp and an Archer to solve physics puzzles and get through the Hollow. Full 3D.",
    about: [
      "Threefold is a puzzle-platformer in a storybook 3D world. Three heroes travel together and you can swap between them at any moment: the Warden swings a sword and raises a shield, the Wisp conjures crates and drags them around with her mind, and the Archer shoots targets and glides over wide chasms.",
      "Every level is a set of physical puzzles. Push crates onto pressure plates, stack conjured crates to climb tall walls and bridge spiked pits, smash cracked walls, shoot far-away switches, ride moving lifts and fight off walkers and archer-bots.",
      "Six levels take you from the sunny meadow of Mossgate to the Hollow King's Road. Collect sparks, keep all three heroes alive and earn up to three stars per level. It is completely free.",
    ],
    features: ["3 heroes you swap between with 1, 2 and 3", "Real crate physics: push, stack, drag and conjure", "Pressure plates, shoot-able targets, doors and moving lifts", "Cracked walls, spikes, walkers and archer-bots", "6 levels in 6 different worlds", "Sparks, life crystals and up to 3 stars per level"],
    pitch: ["6 levels", "3 heroes", "Physics puzzles", "Free"], tags: ["3D", "Puzzle", "Platformer", "Physics", "Fantasy", "Free", "Cloud saves"],
    stats: [["6", "levels"], ["3", "heroes"], ["18", "stars"]], modes: ["Single-player"], levels: 6,
    capsule: "/capsules/threefold.jpg", shots: own("threefold", 5, ["Mossgate", "Wisp Hollow", "Archer's Pass", "Cinder Bridge", "Clockwork Lifts"]),
    controls: [["A D", "Walk"], ["Space", "Jump (hold to glide as the Archer)"], ["1 2 3 / Tab", "Swap hero"], ["Left click", "Sword / conjure crate / shoot"], ["Right click", "Shield / drag crate"], ["Mouse", "Aim"]],
    touchControls: "This game needs a keyboard and mouse (laptop or desktop).",
  },
  {
    slug: "spellwright", name: "Spellwright", icon: "🧙", tier: "free", genre: "Adventure", style: "3D wizard school", accent: "#6fa8ff", status: "live", kit: false, desktopOnly: true, order: 8, added: "2026-11-06",
    tagline: "Duel rival wizards, race broomsticks over the valley and fight your way down the haunted crypt. Full 3D.",
    about: [
      "Spellwright is a full 3D wizard-school adventure with three ways to play. In Duel Club you fight seven rival wizards in the glowing Rune Court: fire Zing bolts, freeze them with Frostbind, blast them back with Gale, and hold your Aegis ward at the last moment to PARRY a spell straight back at them.",
      "In the Broom League you race three rival riders through glowing rings above a castle valley, in sunshine, at sunset and through a night thunderstorm. In the Crypt you fight through four haunted floors of imps, shades and stone brutes, collecting crystals and facing the Warlock at the bottom.",
      "Every star you earn makes your wand stronger. No downloads, no account needed to try it, and it is completely free.",
    ],
    features: ["3 full 3D modes: duels, broom races and a dungeon crawl", "7 duel opponents including a two-on-one and an Archwizard boss", "3 broom courses: day, sunset and a thunderstorm night", "4 crypt floors ending in a Warlock boss fight", "Parry, dodge-roll, lock-on and a Starfall ultimate", "Earn stars to raise your wand power"],
    pitch: ["3 modes", "Spell duels", "Broom racing", "Dungeon boss"], tags: ["3D", "Fantasy", "Magic", "Racing", "Action", "Free", "Cloud saves"],
    stats: [["3", "modes"], ["14", "levels"], ["42", "stars"]], modes: ["Single-player"], levels: 14,
    capsule: "/capsules/spellwright.jpg", shots: own("spellwright", 5, ["Rune Court Duel", "Broom Race", "Storm Night", "The Crypt", "Warlock Fight"]),
    controls: [["W A S D", "Move (or steer the broom)"], ["Mouse", "Look and aim"], ["Left click", "Zing bolt"], ["2 / 3", "Gale / Frostbind"], ["Hold right click", "Aegis ward and parry"], ["Space", "Dodge roll (brake on broom)"], ["R", "Starfall"], ["Tab", "Lock on"]],
    touchControls: "This game needs a keyboard and mouse (laptop or desktop).",
  },
  {
    slug: "tiptoe", name: "Tiptoe", icon: "🧥", tier: "free", genre: "Adventure", style: "Stealth escape", accent: "#f2c230", status: "live", kit: true, desktopOnly: false, order: 32, added: "2026-11-06",
    tagline: "A very small kid in a very big house. Stay quiet. Stay hidden. Find the front door.",
    about: [
      "Tiptoe is a stealth escape in a house built for giants. You are a kid in a yellow raincoat who has squeezed under the door of a vast hall, and the only way out is the big front door at the far end of the house.",
      "The Keeper patrols back and forth. Hide in tall grass until his back is turned, carry keys to locked doors, put crates on plates to open gates, and run when he sees you. Nine chapters take you from the great hall through the boiler rooms to the dark cellar. Each hides three golden Buttons.",
    ],
    features: ["9 chapters in 3 areas: great hall, boiler rooms and cellar", "Stealth: hide from the Keeper in tall grass", "Keys, locked doors, crates and plates", "Steam vents, falling things and dark, lamp-lit cellars", "Two chase chapters", "3 hidden Buttons and a try-count rating in every chapter", "Keyboard or touch controls"],
    pitch: ["9 chapters", "Stealth and chases", "Keys and crates", "Touch friendly"], tags: ["Stealth", "Puzzle", "Atmospheric", "2D", "Escape", "Touch friendly", "Cloud saves"],
    stats: [["9", "chapters"], ["3", "areas"], ["27", "buttons"]], modes: ["Single-player"], levels: 9,
    capsule: "/capsules/tiptoe.jpg", shots: own("tiptoe", 5, ["Under the Door", "Crumbs", "Cold Boiler", "Lamplight", "The Big Door"]),
    controls: [["← → or A D", "Walk"], ["Space or W", "Jump"], ["↓ or S", "Crouch; hold in tall grass to hide"], ["Walk into a crate", "Push it"]],
    touchControls: "On-screen buttons for walking, jumping and crouching.",
  },
  {
    slug: "bramblerush", name: "Bramble Rush", icon: "🦊", tier: "free", genre: "Platformer", style: "Jungle run", accent: "#ff9a3c", status: "live", kit: true, desktopOnly: false, order: 31, featured: 6, added: "2026-11-06",
    tagline: "A fast, bouncy jungle run. Stomp, roll and spring your way through twelve long levels.",
    about: [
      "Bramble Rush is built for flow. Twelve long levels run through a treetop canopy, a ruined desert and a volcano, and every level is made of hand-designed pieces that always join up: spring towers, crumbling bridges, moving stones, spike runs and dart galleries.",
      "Stomp the walkers, roll through cracked blocks, and hunt down three golden Sunstones in every level. Some hide in the treetops, some behind smashable walls. Beat the par time without taking a hit for the perfect score.",
    ],
    features: ["12 long levels in 3 worlds", "Stomp, roll, spring and drop through planks", "14 hand-designed level pieces, mixed differently in every level", "3 Sunstones and a par time on every level", "Hearts, checkpoints and a clean-run bonus", "Keyboard or touch controls"],
    pitch: ["12 long levels", "3 worlds", "Roll and stomp", "Touch friendly"], tags: ["Platformer", "Fast", "Colorful", "2D", "Family friendly", "Touch friendly", "Cloud saves"],
    stats: [["12", "levels"], ["3", "worlds"], ["36", "sunstones"]], modes: ["Single-player"], levels: 12,
    capsule: "/capsules/bramblerush.jpg", shots: own("bramblerush", 5, ["Mossy Start", "Canopy Dash", "Dune Gate", "Sandstorm Ridge", "Ember Falls"]),
    controls: [["← → or A D", "Run"], ["Space or W", "Jump (hold for higher)"], ["X, J or Shift", "Roll"], ["↓ + Jump", "Drop through planks"]],
    touchControls: "On-screen buttons for run, jump, roll and drop.",
  },
  {
    slug: "fluffapult", name: "Fluffapult", icon: "🐤", tier: "free", genre: "Physics", style: "Physics puzzle", accent: "#ff3ea5", status: "live", kit: true, desktopOnly: false, order: 21, featured: 4, added: "2026-10-28",
    tagline: "Launch the Fluffs, topple the wobbly forts and pop every Sprocket!",
    about: [
      "Pull back the slingshot, let go and fling a Fluff at the clockwork Sprockets' forts. Wood splinters, glass shatters, ice slides and stone needs a heavy hitter.",
      "Each Fluff has its own power: puff up, dash, split in three, blow up, drop egg bombs or dive-bomb. Use every one you have left for a huge bonus.",
    ],
    features: ["24 levels in 4 worlds", "6 kinds of Fluff with a power each", "Real physics: wood, stone, ice, glass and TNT", "3 stars for every level", "10,000 bonus points for every Fluff left over", "Drag-and-release works perfectly with a mouse or a finger"],
    pitch: ["24 levels", "6 Fluffs", "Real physics", "Touch friendly"], tags: ["Physics", "Puzzle", "Casual", "Family friendly", "Destruction", "Touch friendly", "Cloud saves"],
    stats: [["24", "levels"], ["4", "worlds"], ["6", "Fluffs"]], modes: ["Single-player"], levels: 24,
    capsule: "/capsules/fluffapult.jpg", shots: own("fluffapult", 5, ["Sunny Meadow", "Frosty Peaks", "Stone Quarry", "Sprocket Citadel", "TNT!"]),
    controls: [["Drag + release", "Pull the sling back and fling"], ["Click in the air", "Use the Fluff's power"], ["← → ↑ ↓ then Space", "Aim with the keyboard"], ["Drag the background", "Look around the level"]],
    touchControls: "Drag back to aim, let go to launch, tap in the air for the Fluff's power.",
  },
  {
    slug: "puttplanet", name: "Putt Planet", icon: "⛳", tier: "free", genre: "Sports", style: "Mini golf", accent: "#3ee6e0", status: "live", kit: true, desktopOnly: false, order: 22, added: "2026-10-29",
    tagline: "Mini golf across the planets: bank it, boost it, bend it round a gas giant.",
    about: [
      "Drag back from the ball like a slingshot, let go and sink it in as few strokes as you can. Walls bounce, sand grabs, ice slides, and water or lava sends you back with a one-stroke penalty.",
      "Four planets, twenty holes: friendly moon craters, red Martian canyons, a frozen comet with speed pads and bumpers, then gas giants whose gravity bends your shot, portals that warp the ball and windmills you have to time. Finish in par for three stars.",
    ],
    features: ["20 holes on 4 planets", "Drag-and-release slingshot putting, with a bounce guide", "Bumpers, sand, ice, water and lava", "Speed pads, gravity planets, portals and windmills", "3 stars per hole, with a hole-in-one bonus", "Every hole proven playable by an automatic golfer", "Mouse, touch or keyboard"],
    pitch: ["20 holes", "Bank shots", "Gravity planets", "Touch friendly"], tags: ["Mini golf", "Sports", "Physics", "Casual", "Family friendly", "Relaxing", "Touch friendly", "Cloud saves"],
    stats: [["20", "holes"], ["4", "planets"], ["8", "kinds of hazard"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/puttplanet.jpg", shots: own("puttplanet", 5, ["Pebble Moon", "Rusty Mars", "Frost Comet", "Gas Giants", "Warp Gate"]),
    controls: [["Drag back from the ball, let go", "Aim and putt"], ["Left / Right", "Turn the aim"], ["Up / Down", "More or less power"], ["Space or X", "Putt"], ["R", "Restart the hole"]],
    touchControls: "Touch the ball and drag back, then let go to putt. The dotted line shows the first bounces. Tap while the ball rolls to speed it up.",
  },
  {
    slug: "gemgarden", name: "Gem Garden", icon: "💎", tier: "free", genre: "Puzzle", style: "Match-3 puzzle", accent: "#c06bff", status: "live", kit: true, desktopOnly: false, order: 23, added: "2026-10-29",
    tagline: "Swap, match and blast your way through four sparkling gardens.",
    about: [
      "Swap neighbouring gems to line up three or more. Match four for a Line gem, an L or T for a Blast gem, five for a Prism, then swap two specials together for a screen-shaking combo.",
      "Every level has its own goal: collect gems, bloom patches of soil, break stubborn crates or carry golden acorns down to the roots. Moves you do not need turn into fireworks and bonus points.",
    ],
    features: ["24 levels in 4 gardens", "Line, Blast and Prism gems with big combos", "Soil, crates and falling acorns to mix up the goals", "A free hammer in every level", "3 stars for every level", "Spare moves turn into bonus fireworks", "Tap, swipe or use the keyboard"],
    pitch: ["24 levels", "Big combos", "Four gardens", "Touch friendly"], tags: ["Match-3", "Puzzle", "Casual", "Family friendly", "Relaxing", "Touch friendly", "Cloud saves"],
    stats: [["24", "levels"], ["4", "gardens"], ["3", "special gems"]], modes: ["Single-player"], levels: 24,
    capsule: "/capsules/gemgarden.jpg", shots: own("gemgarden", 5, ["Dewdrop Meadow", "Prism lightning", "Bloom Greenhouse", "Frostpetal crates", "Starlight acorns"]),
    controls: [["Click a gem, then a neighbour", "Swap them"], ["Drag a gem", "Slide it one square"], ["Arrow keys + Space", "Move the cursor, pick, swap"], ["Hammer button or C", "Smash one gem or crate"], ["H", "Show a hint"]],
    touchControls: "Tap a gem and then the one next to it, or swipe a gem to slide it. Tap the hammer to smash one gem.",
  },
  {
    slug: "snipdrop", name: "Snip & Drop", icon: "✂️", tier: "free", genre: "Physics", style: "Rope puzzle", accent: "#4fd1ff", status: "live", kit: true, desktopOnly: false, order: 24, added: "2026-10-29",
    tagline: "Snip the ropes in the right order and guide the glowing berry to a hungry critter.",
    about: [
      "Swipe across a rope to cut it. Work out which rope to snip, and when, so the berry swings, flies and drops into the critter's mouth. Grab all three stars on the way for a perfect score.",
      "Twenty levels in four worlds: a sunny berry patch, a forest full of lifting bubbles, spike-filled crystal caverns and a night-time factory where everything shows up at once. Timing is everything, and a retry is always free.",
    ],
    features: ["20 levels in 4 worlds", "Real rope physics: swing, snip and fly", "Bubbles that lift the berry, spikes that pop it", "3 stars on every level", "Every level proven winnable with 3 stars", "Swipe with a finger or the mouse", "Cloud saves"],
    pitch: ["20 levels", "Rope physics", "Chase 3 stars", "Touch friendly"], tags: ["Physics", "Puzzle", "Casual", "Family friendly", "Relaxing", "Touch friendly", "Cloud saves"],
    stats: [["20", "levels"], ["4", "worlds"], ["3", "stars each"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/snipdrop.jpg", shots: own("snipdrop", 5, ["Swing Low", "Bubble Grove", "Spike Caverns", "Sky Factory", "Grand Machine"]),
    controls: [["Swipe across a rope", "Cut it"], ["Click a bubble", "Pop it"], ["1 2 3 ...", "Cut the ropes from left to right"], ["Space", "Pop a bubble"], ["R", "Restart the level"]],
    touchControls: "Swipe a finger across a rope to cut it. Tap a bubble to pop it. Use the Restart button to try again.",
  },
  {
    slug: "blastgrid", name: "Blast Grid", icon: "💣", tier: "free", genre: "Puzzle", style: "Bomb maze", accent: "#ff5a5a", status: "live", kit: true, desktopOnly: false, order: 25, added: "2026-10-29",
    tagline: "Drop bombs, break crates and outsmart the bots.",
    about: [
      "A turn-based bomb puzzle. Every step you take is one turn: the bots move, the fuses tick down and boom, a cross-shaped blast clears crates, bots and anything standing in the way. You only get a few bombs, so every one has to count.",
      "Blast the bots to open the door, dig out gems that hide in crates and walk out alive. Undo is free, so think, try, take it back and find the neat way through. Four worlds of patrol slimes, chasing ghosts, sleepers and doors buried in crates.",
    ],
    features: ["20 hand-checked levels in 4 worlds", "Turn-based: no reflexes needed, just a good plan", "Free undo and restart at any time", "Red warning squares show every blast before it happens", "Patrol, hunter and sleeper bots", "Gems and even doors hidden in crates", "3 stars per level for gems and bomb saving", "Keyboard, mouse tap-to-walk or touch buttons"],
    pitch: ["20 levels", "Free undo", "Chain blasts", "Touch friendly"], tags: ["Bomb puzzle", "Puzzle", "Strategy", "Casual", "Family friendly", "Touch friendly", "Cloud saves"],
    stats: [["20", "levels"], ["4", "worlds"], ["3", "kinds of bots"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/blastgrid.jpg", shots: own("blastgrid", 5, ["Sunny Yard", "Chain blast", "Crystal Mines hunters", "Neon Docks", "Ember Core"]),
    controls: [["Arrow keys or WASD", "Step one square"], ["Space or Z", "Drop a bomb"], ["X", "Wait one turn"], ["U", "Undo your last turn"], ["R", "Restart the level"], ["Click a square", "Walk there"]],
    touchControls: "Use the arrow buttons or tap a square to walk there. BOMB drops a bomb, WAIT skips a turn and UNDO takes your last turn back.",
  },
  { slug: "gardenguards", name: "Garden Guards", icon: "🌻", tier: "free", genre: "Strategy", style: "Lane defense", accent: "#8ae234", status: "live", kit: true, desktopOnly: false, order: 26, added: "2026-10-29",
    tagline: "Plant your defenders along the lanes and stop the Gloom Gang.",
    about: [
      "The Gloom Gang is marching on your house along five lanes. Tap a seed card, tap a square, and plant a defender. Collect the dew that rains from the sky, grow Dewbloom flowers for more, and build a wall of firepower that no Grub, Hopper or Brute can pass.",
      "Twenty levels in four worlds: a sunny veg patch, a moonlit garden with no sunlight, snowy hills full of Brutes, and the Gloom Keep itself, where the Gloom Queen is waiting. Six different defenders, five kinds of enemy and one garden cart per lane for emergencies.",
    ],
    features: ["20 levels in 4 worlds", "6 defenders: shooters, walls, frost, dew makers and a Chili Bomb", "5 enemy types, including a boss", "Night levels with no sunlight", "Big final waves", "Every level beaten by our automatic tester", "Tap, drag or use number keys", "Cloud saves"],
    pitch: ["20 levels", "6 defenders", "Boss fight", "Touch friendly"], tags: ["Strategy", "Defense", "Casual", "Family friendly", "Touch friendly", "Cloud saves"],
    stats: [["20", "levels"], ["6", "defenders"], ["4", "worlds"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/gardenguards.jpg", shots: own("gardenguards", 5, ["First Lanes", "Moonlit Garden", "Snow Squall", "Throne Room Door", "The Gloom Queen"]),
    controls: [["Click a seed card, then a square", "Plant a defender"], ["Click falling dew", "Collect it"], ["1 to 6", "Pick a seed card"], ["X", "Shovel"], ["F", "Play twice as fast"], ["R", "Restart the level"]],
    touchControls: "Tap a seed card, then tap a square to plant it. Tap falling dew to collect it. Use the Shovel button to dig up a defender and x2 to speed things up.",
  },
  { slug: "cratecourier", name: "Crate Courier", icon: "📦", tier: "free", genre: "Puzzle", style: "Box-pushing puzzle", accent: "#ff9d2e", status: "live", kit: true, desktopOnly: false, order: 27, added: "2026-10-29",
    tagline: "Push every crate onto its glowing pad. Think before you shove.",
    about: [
      "You are the night-shift courier. Walk into a crate to push it, and cover every glowing pad to finish the level. You can only push, never pull, so every shove needs a plan. Undo and restart are always free.",
      "Twenty levels in four worlds: plain warehouse floors, a frozen dock where crates slide until they hit something, a factory full of holes that swallow crates, and a grand depot that mixes everything. Finish in the fewest moves for three stars.",
    ],
    features: ["20 levels in 4 worlds", "Ice that makes crates slide", "Holes you fill with crates", "Free undo and restart", "3 stars for the shortest routes", "Every level proven solvable, with its shortest answer", "Keyboard, tap or touch buttons", "Cloud saves"],
    pitch: ["20 levels", "Free undo", "Chase 3 stars", "Touch friendly"], tags: ["Puzzle", "Brain teaser", "Casual", "Relaxing", "Touch friendly", "Cloud saves"],
    stats: [["20", "levels"], ["4", "worlds"], ["3", "stars each"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/cratecourier.jpg", shots: own("cratecourier", 5, ["Loading Bay", "Cold Corner", "Fill It In", "Double Trouble", "Courier Master"]),
    controls: [["Arrow keys or WASD", "Walk and push"], ["U or Backspace", "Undo"], ["R", "Restart the level"], ["Click a square", "Walk there"]],
    touchControls: "Use the arrow buttons to walk and push, UNDO to take a move back, or tap a square to walk there.",
  },
  { slug: "fireflyjars", name: "Firefly Jars", icon: "🪲", tier: "free", genre: "Puzzle", style: "Light puzzle", accent: "#ffd23f", status: "live", kit: true, desktopOnly: false, order: 28, added: "2026-11-07",
    tagline: "Tap a jar. Wake every firefly.",
    about: [
      "A shelf of glass jars, each with a sleeping firefly inside. Tap a jar and it flips, along with the jars around it. Make every firefly glow to finish the level. It looks easy for about thirty seconds.",
      "Twenty levels in four worlds. Each world changes which jars flip: the four beside it, the four on its corners, all eight around it, and finally frozen jars you cannot tap at all. Finish in the fewest taps for three stars.",
    ],
    features: ["20 levels in 4 worlds", "A different flip pattern in every world", "Frozen jars and gaps in the last world", "Preview outlines show what will flip", "Free undo and restart", "3 stars for the shortest answers", "Every level proven solvable, with its shortest answer", "Mouse, keyboard or touch", "Cloud saves"],
    pitch: ["20 levels", "Free undo", "Chase 3 stars", "Touch friendly"], tags: ["Puzzle", "Brain teaser", "Casual", "Relaxing", "Touch friendly", "Cloud saves"],
    stats: [["20", "levels"], ["4", "worlds"], ["3", "stars each"]], modes: ["Single-player"], levels: 20,
    capsule: "/capsules/fireflyjars.jpg", shots: own("fireflyjars", 5, ["First Glow", "Frost Pond", "Glow Garden", "Frozen Jars", "Storm Master"]),
    controls: [["Click a jar", "Flip it and its neighbours"], ["Arrow keys, then Space", "Pick a jar and tap it"], ["U or Backspace", "Undo"], ["R", "Restart the level"]],
    touchControls: "Tap a jar to flip it and its neighbours. Use UNDO to take a tap back.",
  },
];

// ───────────────────────────── helpers ─────────────────────────────
export const CATALOG_BY_SLUG = Object.fromEntries(CATALOG.map((g) => [g.slug, g]));
export const LIVE_CATALOG = CATALOG.filter((g) => g.status === "live");
export const SOON_CATALOG = CATALOG.filter((g) => g.status === "soon");
export const isKitSlug = (slug) => !!CATALOG_BY_SLUG[slug]?.kit;
export const isCatalogued = (slug) => !!CATALOG_BY_SLUG[slug];
export const tierOf = (slug) => CATALOG_BY_SLUG[slug]?.tier || null;
export const FLAGSHIP_SLUGS = CATALOG.filter((g) => g.tier === "legend").map((g) => g.slug);

// Everything that used to be on the site and is now retired (kept so old links can be sent to the store politely).
export const RETIRED_SLUGS = [
  "reflex", "memory", "math", "snake", "whackamole", "simonsays", "typing", "colormatch", "numbermemory", "tictactoe", "wordscramble", "trivia", "lanedash",
  "pixeljumper", "empirecommand", "turbocircuit", "colonyrush", "echochase", "pulsemaze", "strikezone", "platformquest", "creatureclash", "brickblaster", "blockcascade",
  "mazemuncher", "apexcircuit", "dominion", "territoryduel", "grandprixduel", "stardefender", "voiddrifter", "swarmbreach", "skyraiders", "peakascent", "horizonguardian",
  "duelarena", "frontlinemarksman", "fruitchase", "ironfist", "shellsquad", "rimrockers", "beatrush", "titanarena", "duskward", "bloodmoonsiege", "starfalloverrun",
  "arcanesurvivor", "arenasurvivor", "shadowfall", "driftlight", "neondrift", "emberlight", "eclipseprotocol", "thelaststar", "celestialdreams", "eternalfrontier",
  "neonpong", "roadhopper", "minefield", "duckshoot", "galaxystrike", "bubblepop", "mumbaistreetracer",
];
export const isRetired = (slug) => RETIRED_SLUGS.includes(slug);

export const isNewGame = (g, days = 45) => !!g.added && Date.now() - new Date(g.added).getTime() < days * 86400000;
export const capsuleOf = (g) => g.capsule || `/capsules/${g.slug}.jpg`;

// "free" | "power" | "legend" → the plan a player needs ("premium" / "premium_plus"), or null for Free
export const planForTier = (tier) => TIERS[tier]?.planId || null;
// A subscription to `have` covers a game of tier `need` when it is the same tier or a higher one.
export const tierCovers = (have, need) => (TIERS[have]?.rank ?? -1) >= (TIERS[need]?.rank ?? 99);
