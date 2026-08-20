// Central registry of every game on the site. Adding a new game later
// means: add an entry here, add a matching component in
// components/games/, and register it in components/games/GameRunner.js.
// Nothing else needs to change — no new routes, no new pages.

export const GAMES = [
  {
    slug: "reflex",
    name: "Reflex Tap",
    icon: "⚡",
    category: "Reflex",
    accentColor: "#3ee6e0",
    tagline: "Tap the instant it turns green.",
    free: true,
  },
  {
    slug: "memory",
    name: "Memory Match",
    icon: "🧠",
    category: "Puzzle",
    accentColor: "#ff3ea5",
    tagline: "Clear the board in the fewest moves.",
    free: true,
  },
  {
    slug: "math",
    name: "Math Rush",
    icon: "🔢",
    category: "Reflex",
    accentColor: "#ffb703",
    tagline: "Solve as many as you can in 30s.",
    free: false,
    pricePaise: 14900,
    priceDisplay: "₹149",
  },
  {
    slug: "snake",
    name: "Neon Snake",
    icon: "🐍",
    category: "Arcade",
    accentColor: "#3ee6e0",
    tagline: "Classic snake — eat, grow, don't crash.",
    free: true,
  },
  {
    slug: "whackamole",
    name: "Mole Rush",
    icon: "🔨",
    category: "Reflex",
    accentColor: "#ff3ea5",
    tagline: "Whack moles before they duck back down.",
    free: true,
  },
  {
    slug: "simonsays",
    name: "Sequence",
    icon: "🎹",
    category: "Puzzle",
    accentColor: "#ffb703",
    tagline: "Repeat the growing pattern of lights.",
    free: true,
  },
  {
    slug: "typing",
    name: "Typing Rush",
    icon: "⌨️",
    category: "Reflex",
    accentColor: "#3ee6e0",
    tagline: "Type the words before time runs out.",
    free: true,
  },
  {
    slug: "colormatch",
    name: "Color Rush",
    icon: "🎨",
    category: "Reflex",
    accentColor: "#ff3ea5",
    tagline: "Tap only when the word matches its color.",
    free: true,
  },
  {
    slug: "numbermemory",
    name: "Digit Span",
    icon: "🔢",
    category: "Puzzle",
    accentColor: "#ffb703",
    tagline: "Remember an ever-longer string of digits.",
    free: true,
  },
  {
    slug: "tictactoe",
    name: "Tic Tac Duel",
    icon: "⭕",
    category: "Strategy",
    accentColor: "#3ee6e0",
    tagline: "Beat the computer as fast as you can.",
    free: true,
  },
  {
    slug: "wordscramble",
    name: "Word Scramble",
    icon: "🔤",
    category: "Word",
    accentColor: "#ff3ea5",
    tagline: "Unscramble as many words as you can.",
    free: true,
  },
  {
    slug: "trivia",
    name: "Quick Trivia",
    icon: "❓",
    category: "Word",
    accentColor: "#ffb703",
    tagline: "Answer general-knowledge questions fast.",
    free: true,
  },
  {
    slug: "lanedash",
    name: "Lane Dash",
    icon: "🏎️",
    category: "Arcade",
    accentColor: "#3ee6e0",
    tagline: "Dodge traffic in an endless 3-lane sprint.",
    free: true,
  },
  {
    slug: "pixeljumper",
    name: "Pixel Jumper",
    icon: "🟩",
    category: "Arcade",
    accentColor: "#ff3ea5",
    tagline: "Jump platform to platform, don't fall.",
    free: true,
  },
];

export function getGame(slug) {
  return GAMES.find((g) => g.slug === slug) || null;
}

export const VALID_GAME_SLUGS = GAMES.map((g) => g.slug);

export const CATEGORIES = [...new Set(GAMES.map((g) => g.category))];
