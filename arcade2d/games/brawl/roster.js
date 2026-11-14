// Ironbloom Clash — the six fighters and eight opponents. Every fighter shares the same move engine; what differs is speed,
// reach, damage, the kind of each special move and how they look.
export const FLOOR = 450; // screen y of the ground line
export const FIGHTERS = [
  { id: "rook", name: "Rook", title: "The Sparkfist", blurb: "All-rounder. Great fireball, great uppercut.", hp: 1000, walk: 3.1, back: 2.5, jump: 15.5, dmg: 1.0, reach: 1.0, scale: 1.0, power: 3, speed: 3, range: 3, skill: 1,
    spec: { qcf: "proj", dp: "rise", qcb: "rush" }, sup: "bigproj", look: { skin: "#e9b98d", top: "#e24a3b", pants: "#2f3a63", accent: "#ffd23a", hair: "#2a1d18", style: "spiky" }, proj: "#ffb347" },
  { id: "vesper", name: "Vesper", title: "The Flicker", blurb: "Lightning feet. Slides and spinning kicks.", hp: 900, walk: 3.8, back: 3.0, jump: 16.5, dmg: 0.9, reach: 1.1, scale: 0.96, power: 2, speed: 5, range: 4, skill: 2,
    spec: { qcf: "proj", dp: "spin", qcb: "slide" }, sup: "multi", look: { skin: "#c98f6a", top: "#9b5cff", pants: "#1d1b2e", accent: "#5cf0ff", hair: "#e8f0ff", style: "pony" }, proj: "#8be9ff" },
  { id: "bruno", name: "Bruno", title: "The Landslide", blurb: "Slow and huge. Command throw and armour.", hp: 1200, walk: 2.5, back: 2.0, jump: 14, dmg: 1.2, reach: 0.95, scale: 1.14, power: 5, speed: 1, range: 2, skill: 2,
    spec: { qcf: "quake", dp: "rise", qcb: "grab" }, sup: "biggrab", look: { skin: "#d49a73", top: "#3c8f5a", pants: "#4a3b2a", accent: "#f2f2f2", hair: "#1a1410", style: "bald" }, proj: "#c9a36a" },
  { id: "mira", name: "Mira", title: "The Orbit", blurb: "Zoner. Fast shots and a teleport.", hp: 880, walk: 3.0, back: 2.8, jump: 16, dmg: 0.85, reach: 1.0, scale: 0.97, power: 2, speed: 3, range: 5, skill: 4,
    spec: { qcf: "proj", dp: "rise", qcb: "teleport" }, sup: "beam", look: { skin: "#f0c6a0", top: "#2fbf9d", pants: "#26324d", accent: "#ff77d0", hair: "#ff77d0", style: "bob" }, proj: "#ff77d0" },
  { id: "juno", name: "Juno", title: "The Barrage", blurb: "Rushdown. Multi-hit combos and a dash punch.", hp: 950, walk: 3.5, back: 2.7, jump: 15.5, dmg: 1.0, reach: 0.95, scale: 1.0, power: 3, speed: 4, range: 2, skill: 3,
    spec: { qcf: "rush", dp: "rise", qcb: "multi" }, sup: "multi", look: { skin: "#e0a77f", top: "#ffb02e", pants: "#7a2230", accent: "#fff", hair: "#552a1a", style: "band" }, proj: "#ffd23a" },
  { id: "tark", name: "Tark", title: "The Wall", blurb: "Armoured bruiser. Slow fireball, tough hide.", hp: 1100, walk: 2.8, back: 2.3, jump: 14.5, dmg: 1.1, reach: 1.0, scale: 1.08, power: 4, speed: 2, range: 3, skill: 2,
    spec: { qcf: "proj", dp: "rise", qcb: "rush" }, sup: "bigproj", look: { skin: "#b9805e", top: "#5b6b78", pants: "#303842", accent: "#ff5a3c", hair: "#0f0f12", style: "mohawk" }, proj: "#ff6a3c", armor: true },
];
// the ladder: opponent id + difficulty 0..7 + stage backdrop
export const LADDER = [
  { fid: "bruno", diff: 0, stage: "harbor", name: "Bruno", tag: "Warm-up at the docks" },
  { fid: "juno", diff: 1, stage: "factory", name: "Juno", tag: "Fast hands on the factory floor" },
  { fid: "mira", diff: 2, stage: "ruins", name: "Mira", tag: "Shots from every angle" },
  { fid: "tark", diff: 3, stage: "desert", name: "Tark", tag: "Armoured and angry" },
  { fid: "vesper", diff: 4, stage: "sewer", name: "Vesper", tag: "Blink and you lose" },
  { fid: "rook", diff: 5, stage: "snow", name: "Rook", tag: "The champion's mirror" },
  { fid: "juno", diff: 6, stage: "volcano", name: "Juno Unleashed", tag: "Everything turned up", tint: "#ff3a1a" },
  { fid: "bruno", diff: 7, stage: "dungeon", name: "Ironbloom King", tag: "The final bout", tint: "#b04aff", boss: true },
];
