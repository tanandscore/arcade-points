// 10 original fighters for Titan Arena. Each has two genuinely
// distinct special abilities (not just re-skinned damage numbers —
// 9 different mechanical "kinds" are used across the roster) and its
// own combat sound voice (base frequency + waveform + glide
// direction), so every character both plays and sounds different.
export const ROSTER = [
  {
    id: "kael",
    name: "Kael Ashborn",
    tagline: "Master of the Inferno",
    color: 0xff5a3c,
    accent: 0xffb703,
    icon: "🔥",
    sound: { freq: 380, type: "sawtooth", glideUp: true },
    specials: [
      { name: "Inferno Burst", desc: "Ranged — hits from anywhere.", damage: 18, kind: "ranged", cooldown: 4500 },
      { name: "Flame Wave", desc: "Unblockable.", damage: 22, kind: "unblockable", cooldown: 7000 },
    ],
  },
  {
    id: "nyx",
    name: "Nyx Frostwind",
    tagline: "Herald of the Frozen Wastes",
    color: 0x3ee6e0,
    accent: 0xffffff,
    icon: "❄️",
    sound: { freq: 700, type: "triangle", glideUp: false },
    specials: [
      { name: "Frozen Grasp", desc: "Breaks their guard — next hit lands full damage.", damage: 10, kind: "guardbreak", cooldown: 4500 },
      { name: "Ice Prison", desc: "Stuns the opponent briefly.", damage: 6, kind: "stun", cooldown: 8000 },
    ],
  },
  {
    id: "raiju",
    name: "Raiju Volt",
    tagline: "Avatar of the Storm",
    color: 0xb45cff,
    accent: 0xffe14d,
    icon: "⚡",
    sound: { freq: 900, type: "square", glideUp: true },
    specials: [
      { name: "Thunder Strike", desc: "Unblockable.", damage: 18, kind: "unblockable", cooldown: 5000 },
      { name: "Chain Lightning", desc: "Ranged.", damage: 14, kind: "ranged", cooldown: 4000 },
    ],
  },
  {
    id: "terra",
    name: "Terra Stoneheart",
    tagline: "The Unbroken Mountain",
    color: 0x8a6a3c,
    accent: 0x6bff6b,
    icon: "🪨",
    sound: { freq: 120, type: "square", glideUp: false },
    specials: [
      { name: "Boulder Toss", desc: "Ranged.", damage: 16, kind: "ranged", cooldown: 5000 },
      { name: "Stone Skin", desc: "Heals you.", damage: 20, kind: "heal", cooldown: 9000 },
    ],
  },
  {
    id: "zephyr",
    name: "Zephyr Windrunner",
    tagline: "Faster Than Sound",
    color: 0x9be8ff,
    accent: 0xffffff,
    icon: "🌪️",
    sound: { freq: 550, type: "triangle", glideUp: true },
    specials: [
      { name: "Gale Dash", desc: "Instantly closes the gap and strikes.", damage: 12, kind: "dash", cooldown: 4500 },
      { name: "Cyclone Kick", desc: "Knocks them all the way back.", damage: 14, kind: "knockback", cooldown: 6000 },
    ],
  },
  {
    id: "vex",
    name: "Vex Shadowbane",
    tagline: "The Unseen Blade",
    color: 0x2a1a40,
    accent: 0xff3ea5,
    icon: "🌑",
    sound: { freq: 200, type: "sawtooth", glideUp: false },
    specials: [
      { name: "Shadow Step", desc: "Instantly closes the gap and strikes.", damage: 12, kind: "dash", cooldown: 4500 },
      { name: "Nightfall Strike", desc: "Breaks their guard — next hit lands full damage.", damage: 16, kind: "guardbreak", cooldown: 6500 },
    ],
  },
  {
    id: "aurora",
    name: "Aurora Lightbringer",
    tagline: "Dawn Incarnate",
    color: 0xfff2b8,
    accent: 0xffd700,
    icon: "✨",
    sound: { freq: 850, type: "sine", glideUp: true },
    specials: [
      { name: "Radiant Heal", desc: "Heals you.", damage: 22, kind: "heal", cooldown: 8000 },
      { name: "Holy Smite", desc: "Unblockable.", damage: 20, kind: "unblockable", cooldown: 6500 },
    ],
  },
  {
    id: "korr",
    name: "Korr Ironclad",
    tagline: "Living Fortress",
    color: 0x9aa0a6,
    accent: 0xff5a3c,
    icon: "🛡️",
    sound: { freq: 300, type: "square", glideUp: false },
    specials: [
      { name: "Iron Wall", desc: "Heals you.", damage: 15, kind: "heal", cooldown: 7000 },
      { name: "Guillotine Slam", desc: "Unblockable.", damage: 22, kind: "unblockable", cooldown: 7000 },
    ],
  },
  {
    id: "venom",
    name: "Venom Vipress",
    tagline: "Death by a Thousand Bites",
    color: 0x6bff3e,
    accent: 0x2a1a40,
    icon: "🐍",
    sound: { freq: 250, type: "sawtooth", glideUp: false },
    specials: [
      { name: "Toxic Spit", desc: "Poisons them — damage ticks over the next few seconds.", damage: 6, kind: "poison", cooldown: 5500 },
      { name: "Venom Fang", desc: "Damages them and heals you for half.", damage: 14, kind: "lifesteal", cooldown: 6000 },
    ],
  },
  {
    id: "riptide",
    name: "Riptide Marlow",
    tagline: "Tide That Never Turns",
    color: 0x3e8eff,
    accent: 0x9be8ff,
    icon: "🌊",
    sound: { freq: 400, type: "triangle", glideUp: false },
    specials: [
      { name: "Tidal Wave", desc: "Knocks them all the way back.", damage: 12, kind: "knockback", cooldown: 5000 },
      { name: "Whirlpool", desc: "Ranged.", damage: 16, kind: "ranged", cooldown: 4500 },
    ],
  },
];

export function findFighter(id) {
  return ROSTER.find((f) => f.id === id);
}
