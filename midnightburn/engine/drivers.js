// Midnight Burn — the Underground Ladder. Ten named street racers, from
// #10 up to the boss at #1, each with their own car, personality and
// way of racing. You face them one at a time, and each one only
// appears once you have reached the right level AND beaten the driver
// below. All fictional.
//
// Duels are one-on-one races on Harbor Loop (the pilot map: the other
// maps join the ladder later).

// total XP needed to be level 1..10
export const LEVEL_XP = [0, 400, 1000, 1800, 2800, 4000, 5400, 7000, 9000, 11500];
export function levelOf(xp) {
  let lv = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i + 1;
  return lv;
}
export function levelProgress(xp) {
  const lv = levelOf(xp);
  if (lv >= LEVEL_XP.length) return { level: lv, frac: 1, into: 0, need: 0 };
  const a = LEVEL_XP[lv - 1], b = LEVEL_XP[lv];
  return { level: lv, frac: (xp - a) / (b - a), into: xp - a, need: b - a };
}

const mk = (rank, o) => {
  const t = 10 - rank; // 0 (easiest) .. 9 (boss)
  return {
    rank,
    reqLevel: t + 1,
    map: "harbor",
    laps: 2,
    traffic: 8,
    ai: {
      base: 0.8 + t * 0.021,
      latG: 0.76 + t * 0.011,
      useNos: rank <= 8,
      block: rank <= 7 ? 0.35 + (7 - rank) * 0.1 : 0,
    },
    carLevel: Math.floor(t * 0.55),
    reward: { cash: 800 + t * 450, xp: 350 + t * 220, pts: 1000 + t * 300 },
    ...o,
  };
};

export const DRIVERS = [
  mk(10, {
    id: "pixel", name: "Pixel", full: "Aiko Tanabe", age: 19, from: "Dockside Row", title: "The Courier",
    style: "Cheerful and clean. Slow in, slow out.",
    bio: "Delivers parts all day and races all night. Her hatchback is held together with stickers and optimism.",
    taunt: "You're the new face? Okay! Easy race, no hard feelings. Mostly.",
    loss: "Wow, you're quick! Go get 'em at the next rank.",
    win: "Ha! Practice on the straights, rookie.",
    car: { car: "gecko", color: "#2de2ff", finish: "gloss", livery: { type: "stripes", color: "#f2f2f2" }, rims: { style: "ten", color: "#f2f2f2" }, wing: "gt", kit: "stock", glow: "cyan", number: 10 },
  }),
  mk(9, {
    id: "rook", name: "Rook", full: "Marcus Bell", age: 31, from: "Foundry Heights", title: "Big Iron",
    style: "Heavy right foot, heavy sliding.",
    bio: "A mechanic who built his muscle car from three wrecks. Hits the throttle like he's mad at it.",
    taunt: "Kid, my engine's older than you. Try and keep up.",
    loss: "Huh. You corner better than you look.",
    win: "Power wins. Always has.",
    car: { car: "brute", color: "#6bff6b", finish: "metallic", livery: { type: "stripes", color: "#101015" }, rims: { style: "deep", color: "#1a1a20" }, wing: "stock", kit: "stock", glow: "green", number: 9 },
  }),
  mk(8, {
    id: "nova", name: "Nova", full: "Priya Nair", age: 24, from: "Neon Row", title: "Drift Queen",
    style: "Lives sideways. Burns nitrous early.",
    bio: "Won three drift contests before anyone noticed she'd never lifted off the handbrake.",
    taunt: "Straight lines are boring. Show me something sideways.",
    loss: "Okay okay, you can drive. Don't get cocky.",
    win: "Sideways beats sensible. Every time.",
    car: { car: "gecko", color: "#ff2d95", finish: "pearl", livery: { type: "side", color: "#f2f2f2" }, rims: { style: "turbine", color: "#ff2d95" }, wing: "gt", kit: "street", glow: "pink", number: 8 },
  }),
  mk(7, {
    id: "mako", name: "Mako", full: "Tomas Reyes", age: 36, from: "The Container Yard", title: "The Wall",
    style: "Blocks. Hard. Never gives an inch.",
    bio: "Ex-dockworker who knows every inch of Harbor Loop. If you want to pass, you'd better be brave.",
    taunt: "This is my yard. Want past? You'll have to go through me.",
    loss: "Nobody passes me. Nobody. ...Fine. Good run.",
    win: "Told you. My yard, my rules.",
    car: { car: "brute", color: "#ff5a1f", finish: "matte", livery: { type: "racing", color: "#f2f2f2" }, rims: { style: "mesh", color: "#c9ccd8" }, wing: "stock", kit: "street", glow: "off", number: 7 },
  }),
  mk(6, {
    id: "juno", name: "Juno", full: "Elena Volkov", age: 27, from: "Skyline Ridge", title: "Nitro Princess",
    style: "Smooth lines, then a wall of nitrous.",
    bio: "Mountain road specialist who treats a straight like a launch pad.",
    taunt: "I'll let you lead until the long straight. Then we'll see.",
    loss: "You burned nitro cleverer than me. Respect.",
    win: "The straight was mine. It always is.",
    car: { car: "kestrel", color: "#b45cff", finish: "pearl", livery: { type: "hex", color: "#2de2ff" }, rims: { style: "fivespoke", color: "#2de2ff" }, wing: "gt", kit: "street", glow: "violet", number: 6 },
  }),
  mk(5, {
    id: "dagger", name: "Dagger", full: "Dmitri Cole", age: 29, from: "Eclipse Heights", title: "The Edge",
    style: "Late braker. Dirty, but quick.",
    bio: "Bought his reputation with a thousand risky overtakes. Half the city is scared of his bumper.",
    taunt: "Brake early if you want. I won't.",
    loss: "You braked later than me. Impossible.",
    win: "Should've braked earlier, friend.",
    car: { car: "kestrel", color: "#101015", finish: "carbon", livery: { type: "stripes", color: "#d4202a" }, rims: { style: "turbine", color: "#d4202a" }, wing: "tall", kit: "race", glow: "off", number: 5 },
  }),
  mk(4, {
    id: "saint", name: "Saint", full: "Julian Okafor", age: 33, from: "Old Town", title: "The Gentleman",
    style: "Perfect lines. Never touches a wall.",
    bio: "A retired track champion who now races for the love of it. Beating him means beating the textbook.",
    taunt: "Good evening. I'll be honest: you won't beat me with luck.",
    loss: "Splendid. Take my GT. You've earned it.",
    win: "Practise your lines. We'll go again.",
    car: { car: "phantom", color: "#f2f2f2", finish: "gloss", livery: { type: "racing", color: "#ffb703" }, rims: { style: "fivespoke", color: "#ffb703" }, wing: "gt", kit: "race", glow: "off", number: 44 },
    unlockCar: "phantom",
  }),
  mk(3, {
    id: "vex", name: "Vex", full: "Zara Quinn", age: 26, from: "Neon Strip", title: "Apex Hunter",
    style: "Fastest through the corners in the city.",
    bio: "Lives for the apex. She has never once taken a corner slower than the car allows.",
    taunt: "Corners are where I win. Let's see how you handle them.",
    loss: "Ugh. You carried more speed through that last bend than I thought possible.",
    win: "Corners. Told you.",
    car: { car: "phantom", color: "#6bff6b", finish: "metallic", livery: { type: "side", color: "#101015" }, rims: { style: "ten", color: "#101015" }, wing: "gt", kit: "race", glow: "green", number: 3 },
  }),
  mk(2, {
    id: "nyx", name: "Nyx", full: "Unknown", age: 0, from: "Nobody knows", title: "The Ghost",
    style: "Silent, relentless, never makes a mistake.",
    bio: "No one has seen her face. People say the matte black GT only appears when it's raining.",
    taunt: "...",
    loss: "...You earned it.",
    win: "...",
    car: { car: "phantom", color: "#101015", finish: "matte", livery: { type: "none", color: "#101015" }, rims: { style: "deep", color: "#1a1a20" }, wing: "tall", kit: "race", glow: "violet", number: 2 },
  }),
  mk(1, {
    id: "kage", name: "Kage", full: "Kage Mori", age: 38, from: "The Skyline", title: "The Midnight King",
    style: "The best there is. Every skill, no weakness.",
    bio: "Ten years undefeated. The prototype he drives was built in a garage nobody can find. Beat him and the city is yours.",
    taunt: "You came a long way to lose. I respect that. Let's burn.",
    loss: "Ten years... and it ends here. The city is yours.",
    win: "Come back when you're ready. I'll be here.",
    car: { car: "specter", color: "#101015", finish: "satin", livery: { type: "hex", color: "#ffb703" }, rims: { style: "turbine", color: "#ffb703" }, wing: "tall", kit: "race", glow: "off", number: 1 },
    unlockCar: "specter",
    reward: { cash: 6000, xp: 2500, pts: 5000 },
  }),
];

// Generic race rivals get a look too, so every map is full of different cars.
const R_LIV = ["stripes", "none", "side", "racing", "checker", "hex"];
const R_FIN = ["gloss", "metallic", "pearl", "gloss", "matte", "metallic"];
const R_RIM = ["fivespoke", "ten", "turbine", "mesh", "deep", "fivespoke"];
const R_WING = ["gt", "none", "stock", "tall", "gt", "none"];
const R_RIMC = ["#c9ccd8", "#1a1a20", "#f2f2f2", "#ffb703", "#c9ccd8", "#ff2d95"];
export function rivalSpec(i, mi, carId, color) {
  const k = (i + mi * 2) % 6;
  return {
    car: carId, color, finish: R_FIN[k],
    livery: { type: R_LIV[k], color: k % 2 ? "#101015" : "#f2f2f2" },
    rims: { style: R_RIM[k], color: R_RIMC[k] },
    wing: carId === "brute" && R_WING[k] === "tall" ? "gt" : R_WING[k],
    kit: k % 3 === 0 ? "street" : "stock", tint: "smoked", glow: "match", number: 11 + i * 7 + mi,
  };
}

// A colour that always reads on the dark UI (some cars are black).
const ACCENT = { kage: "#ffb703", nyx: "#b45cff", dagger: "#ff4d4d", mako: "#ff5a1f" };
DRIVERS.forEach((x) => { x.accent = ACCENT[x.id] || x.car.color; });

// Balance pass (from headless duel simulations): the top of the ladder is
// hard but beatable with a well-upgraded car.
const tune = (id, base, carLevel) => { const x = DRIVERS.find((d) => d.id === id); x.ai.base = base; if (carLevel !== undefined) x.carLevel = carLevel; };
tune("saint", 0.89, 2);
tune("nyx", 0.93, 3);
tune("kage", 0.9, 2);
