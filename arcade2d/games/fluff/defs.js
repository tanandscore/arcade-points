// Fluffapult — the rules of the world: what the blocks are made of, what each Fluff can do, how tough the Sprockets are.
// HP numbers are "impact points": a body takes damage equal to how hard it was hit (mass x speed) above a small threshold.

export const MATS = {
  wood: { name: "Wood", density: 0.5, friction: 0.5, rest: 0.05, hp: 1.5, pts: 500, snd: "Wood", top: "#e9b274", mid: "#cf8d4c", low: "#a8672e", edge: "#5b3314", deb: ["#e9b274", "#cf8d4c", "#8a5526", "#6e4020"] },
  stone: { name: "Stone", density: 1.25, friction: 0.6, rest: 0.03, hp: 4.4, pts: 800, snd: "Stone", top: "#c3c8de", mid: "#9aa1c2", low: "#767ea3", edge: "#2e2f55", deb: ["#c3c8de", "#9aa1c2", "#767ea3", "#5b6285"] },
  ice: { name: "Ice", density: 0.38, friction: 0.04, rest: 0.05, hp: 0.95, pts: 400, snd: "Ice", top: "#e6fbff", mid: "#b5ecff", low: "#7fd2f5", edge: "#1d5f94", deb: ["#e6fbff", "#b5ecff", "#7fd2f5", "#ffffff"] },
  glass: { name: "Glass", density: 0.3, friction: 0.25, rest: 0.1, hp: 0.5, pts: 300, snd: "Glass", top: "#effcff", mid: "#cdf3ff", low: "#9fe0f8", edge: "#3a86b4", deb: ["#effcff", "#cdf3ff", "#9fe0f8", "#ffffff"] },
  tnt: { name: "TNT", density: 0.55, friction: 0.5, rest: 0.05, hp: 0.9, pts: 1000, snd: "Wood", top: "#ff7a6e", mid: "#e0463d", low: "#a82a2a", edge: "#4a0f1a", deb: ["#ff7a6e", "#e0463d", "#ffe38a", "#4a0f1a"], explosive: true },
};

// r = radius, d = density (weight), ability = what a tap does in the air
export const BIRDS = {
  pom: { name: "Pom", r: 14, d: 1.0, color: "#ff3ea5", dark: "#a8165f", belly: "#ffc4e1", ability: "puff", blurb: "Tap in the air to puff up big and heavy." },
  zip: { name: "Zip", r: 11, d: 0.85, color: "#3ee6e0", dark: "#0f8e93", belly: "#c9fffb", ability: "dash", blurb: "Tap in the air for a lightning-fast dash." },
  boomer: { name: "Boomer", r: 14, d: 0.9, color: "#ffb703", dark: "#b36a00", belly: "#fff0b8", ability: "boom", blurb: "Tap to blow up (or it pops by itself after a hit)." },
  trio: { name: "Trio", r: 12, d: 0.85, color: "#8a6bff", dark: "#4b32b8", belly: "#ddd3ff", ability: "split", blurb: "Tap in the air to split into three." },
  dropper: { name: "Dropper", r: 14, d: 0.9, color: "#fff0b0", dark: "#c79a2b", belly: "#ffffff", ability: "drop", blurb: "Tap to drop an egg bomb straight down." },
  boulder: { name: "Boulder", r: 19, d: 1.5, color: "#8fcf8a", dark: "#3f7a46", belly: "#d8f5d2", ability: "dive", blurb: "Tap to dive-bomb straight down. Very heavy!" },
};
export const BIRD_ORDER = ["pom", "zip", "trio", "boomer", "dropper", "boulder"];

// Sprockets: clockwork gremlins that build the forts. They pop when hit hard enough.
export const FOES = {
  tinker: { name: "Tinker", r: 15, d: 0.5, hp: 1500, pts: 5000, hat: "none" },
  foreman: { name: "Foreman", r: 19, d: 0.55, hp: 3000, pts: 7500, hat: "hard" },
  king: { name: "King Cogsworth", r: 27, d: 0.6, hp: 7000, pts: 12000, hat: "crown" },
};

export const G = 1100;            // gravity (px/s^2)
export const GROUND_Y = 470;      // top of the ground in the world
export const MAX_PULL = 82;       // how far the sling can be stretched
export const LAUNCH_K = 15.4;     // launch speed = stretch x this (max about 1260 px/s)
export const HIT_MIN = 90;        // hits softer than this do no damage
export const BONUS_BIRD = 10000;  // points for every Fluff left over

// damage a hit does: impact beyond the threshold, a little extra for the very hard ones
export const hurt = (imp, t = HIT_MIN) => (imp > t ? imp - t : 0);
