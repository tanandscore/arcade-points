// Weapons, grenades and money rules for the first-person Operation Blacksite.
// Numbers follow the familiar tactical-shooter feel: one-tap headshots with rifles,
// armour that soaks part of the damage, recoil you can learn, and a buy menu.

// Every gun is a real 3D model (see ./gunmodels). The id of a weapon is also the name of its model file.
// Nightfall (terrorist) and Sentinel (police) each get their own rifles, SMGs and a sniper; a few guns can be bought by both sides.
const W = (o) => ({ headMul: 4, crouchMul: 0.7, tracer: 0xffe9a0, ...o });
export const WEAPONS = {
  knife: { id: "knife", name: "Combat Knife", slot: 3, kind: "knife", price: 0, side: "both", damage: 40, stab: 65, rate: 0.5, range: 2.1, speed: 1.08, kill: 1500 },
  // ---- sidearms (slot 2) ----
  pistol: W({ id: "pistol", name: "Viper", slot: 2, kind: "pistol", price: 0, side: "both", damage: 30, armorPen: 0.5, rate: 0.17, auto: false, mag: 13, reserve: 52, reload: 2.2, speed: 1.0, rangeMod: 0.8, spread: [0.003, 0.03, 0.09], crouchMul: 0.7, kick: 1.1, kill: 300, noise: 38, note: "Free sidearm",
    rc: { up: 1.0, first: 1.1, cap: 2, tail: 0.85, sway: 0.15, freq: 1.3, drift: 0, jit: 0.18 } }),
  deagle: W({ id: "deagle", name: "Jackal .50", slot: 2, kind: "pistol", price: 700, side: "both", damage: 54, headMul: 3.4, armorPen: 0.93, rate: 0.34, auto: false, mag: 7, reserve: 35, reload: 2.3, speed: 0.98, rangeMod: 0.92, spread: [0.0025, 0.034, 0.1], crouchMul: 0.65, kick: 2.6, kill: 300, tracer: 0xffe0a0, noise: 50, pen: 1.2, note: "Hand-cannon, one-shot headshots",
    rc: { up: 3.1, first: 3.1, cap: 2, tail: 2.6, sway: 0.25, freq: 1.1, drift: 0.1, jit: 0.3 } }),
  // ---- submachine guns ----
  scorp: W({ id: "scorp", name: "Scorp SMG", slot: 1, kind: "smg", price: 1000, side: "terrorist", damage: 25, armorPen: 0.58, rate: 0.074, auto: true, mag: 32, reserve: 128, reload: 2.4, speed: 0.97, rangeMod: 0.86, spread: [0.006, 0.027, 0.088], kick: 0.6, kill: 600, tracer: 0x3ee6e0, noise: 52, note: "Cheap, fast, close range",
    rc: { up: 0.4, first: 0.55, cap: 9, tail: 0.2, sway: 0.5, freq: 0.85, drift: -0.05, jit: 0.3 } }),
  reaper: W({ id: "reaper", name: "Reaper SMG", slot: 1, kind: "smg", price: 1200, side: "police", damage: 27, armorPen: 0.62, rate: 0.078, auto: true, mag: 30, reserve: 120, reload: 2.3, speed: 0.97, rangeMod: 0.88, spread: [0.005, 0.024, 0.08], kick: 0.56, kill: 600, tracer: 0x3ea8ff, noise: 52, note: "Steady and accurate up close",
    rc: { up: 0.34, first: 0.5, cap: 10, tail: 0.18, sway: 0.28, freq: 0.6, drift: 0.04, jit: 0.2 } }),
  hawk: W({ id: "hawk", name: "Hawk MP", slot: 1, kind: "smg", price: 1500, side: "both", damage: 28, armorPen: 0.66, rate: 0.082, auto: true, mag: 30, reserve: 120, reload: 2.5, speed: 0.95, rangeMod: 0.92, spread: [0.004, 0.024, 0.08], kick: 0.6, kill: 600, tracer: 0xffd070, noise: 54, note: "Best SMG: hits hard, great at mid range",
    rc: { up: 0.42, first: 0.6, cap: 9, tail: 0.22, sway: 0.3, freq: 0.7, drift: 0.05, jit: 0.22 } }),
  // ---- Nightfall rifles ----
  sunda: W({ id: "sunda", name: "Dune Mk2", slot: 1, kind: "rifle", price: 2050, side: "terrorist", damage: 31, armorPen: 0.7, rate: 0.088, auto: true, mag: 30, reserve: 90, reload: 2.4, speed: 0.93, rangeMod: 0.96, spread: [0.0022, 0.034, 0.1], crouchMul: 0.6, kick: 0.7, kill: 300, tracer: 0xff8a3c, noise: 68, note: "Compact bullpup, light kick",
    rc: { up: 0.6, first: 0.8, cap: 7, tail: 0.32, sway: 0.24, freq: 0.9, drift: 0.08, jit: 0.2 } }),
  nomad: W({ id: "nomad", name: "Nomad-105", slot: 1, kind: "rifle", price: 2450, side: "terrorist", damage: 34, armorPen: 0.74, rate: 0.094, auto: true, mag: 30, reserve: 90, reload: 2.5, speed: 0.92, rangeMod: 0.97, spread: [0.002, 0.035, 0.1], crouchMul: 0.6, kick: 0.85, kill: 300, tracer: 0xff6a3c, noise: 70, note: "Bullpup with a heavy punch",
    rc: { up: 0.78, first: 1.0, cap: 8, tail: 0.4, sway: 0.28, freq: 0.7, drift: 0.12, jit: 0.22 } }),
  ironwood: W({ id: "ironwood", name: "Ironwood AK", slot: 1, kind: "rifle", price: 2700, side: "terrorist", damage: 36, armorPen: 0.775, rate: 0.1, auto: true, mag: 30, reserve: 90, reload: 2.5, speed: 0.9, rangeMod: 0.98, spread: [0.002, 0.037, 0.105], crouchMul: 0.6, kick: 1.0, kill: 300, tracer: 0xff5a3c, noise: 72, note: "Hard-hitting and hard to control",
    rc: { up: 0.98, first: 1.25, cap: 9, tail: 0.48, sway: 0.4, freq: 0.55, drift: -0.13, jit: 0.28 } }),
  // ---- Sentinel rifles ----
  lionheart: W({ id: "lionheart", name: "Lionheart L85", slot: 1, kind: "rifle", price: 2250, side: "police", damage: 31, armorPen: 0.7, rate: 0.09, auto: true, mag: 30, reserve: 90, reload: 2.6, speed: 0.93, rangeMod: 0.97, spread: [0.0018, 0.032, 0.1], crouchMul: 0.55, kick: 0.62, kill: 300, tracer: 0x3ea8ff, noise: 68, note: "Smooth bullpup, easy to hold on target",
    rc: { up: 0.52, first: 0.7, cap: 8, tail: 0.28, sway: 0.2, freq: 0.8, drift: -0.05, jit: 0.15 } }),
  guardian: W({ id: "guardian", name: "Guardian A4", slot: 1, kind: "rifle", price: 2900, side: "police", damage: 40, armorPen: 0.78, rate: 0.135, auto: false, mag: 20, reserve: 80, reload: 2.4, speed: 0.92, rangeMod: 0.99, spread: [0.0012, 0.034, 0.1], crouchMul: 0.5, kick: 0.9, kill: 300, tracer: 0x3ea8ff, noise: 70, note: "Semi-auto: tap for pinpoint accuracy",
    rc: { up: 1.35, first: 1.35, cap: 3, tail: 1.1, sway: 0.2, freq: 1.4, drift: 0.05, jit: 0.2 } }),
  warden: W({ id: "warden", name: "Warden M4", slot: 1, kind: "rifle", price: 3100, side: "police", damage: 33, armorPen: 0.72, rate: 0.09, auto: true, mag: 30, reserve: 90, reload: 2.4, speed: 0.92, rangeMod: 0.97, spread: [0.0018, 0.032, 0.1], crouchMul: 0.6, kick: 0.78, kill: 300, tracer: 0x3ea8ff, noise: 70, note: "The reliable all-rounder",
    rc: { up: 0.64, first: 0.85, cap: 10, tail: 0.3, sway: 0.28, freq: 0.5, drift: 0.1, jit: 0.2 } }),
  alpine: W({ id: "alpine", name: "Alpine AUG", slot: 1, kind: "rifle", price: 3300, side: "police", damage: 32, armorPen: 0.74, rate: 0.088, auto: true, mag: 30, reserve: 90, reload: 2.7, speed: 0.92, rangeMod: 0.98, spread: [0.0014, 0.03, 0.095], crouchMul: 0.5, kick: 0.55, kill: 300, tracer: 0x58b8ff, noise: 68, note: "Almost no recoil, costs more",
    rc: { up: 0.46, first: 0.62, cap: 8, tail: 0.22, sway: 0.13, freq: 0.9, drift: 0, jit: 0.1 } }),
  // ---- both sides ----
  ranger: W({ id: "ranger", name: "Ranger Carbine", slot: 1, kind: "rifle", price: 2600, side: "both", damage: 34, armorPen: 0.74, rate: 0.095, auto: true, mag: 30, reserve: 90, reload: 2.5, speed: 0.92, rangeMod: 0.97, spread: [0.002, 0.034, 0.1], crouchMul: 0.6, kick: 0.8, kill: 300, tracer: 0xffc860, noise: 70, note: "Modern carbine anyone can buy",
    rc: { up: 0.7, first: 0.9, cap: 9, tail: 0.34, sway: 0.3, freq: 0.65, drift: -0.08, jit: 0.2 } }),
  // ---- snipers ----
  longshot: W({ id: "longshot", name: "Longshot Sniper", slot: 1, kind: "sniper", price: 4750, side: "both", damage: 115, armorPen: 0.98, rate: 1.45, auto: false, mag: 10, reserve: 30, reload: 3.7, speed: 0.78, rangeMod: 0.99, spread: [0.0005, 0.07, 0.2], unscopedSpread: 0.11, crouchMul: 0.8, kick: 3.4, kill: 100, tracer: 0xffffff, noise: 90, zoom: [34, 12], scoped: true, note: "Bolt-action: one shot, long range",
    rc: { up: 3.4, first: 3.4, cap: 1, tail: 3.4, sway: 0.3, freq: 1, drift: 0, jit: 0.3 } }),
  ghost: W({ id: "ghost", name: "Ghost-X", slot: 1, kind: "sniper", price: 4500, side: "terrorist", damage: 86, armorPen: 0.95, rate: 0.55, auto: false, mag: 10, reserve: 40, reload: 3.4, speed: 0.8, rangeMod: 0.99, spread: [0.0006, 0.06, 0.18], unscopedSpread: 0.1, crouchMul: 0.8, kick: 2.2, kill: 100, tracer: 0x9affc8, noise: 86, zoom: [34, 14], scoped: true, note: "Semi-auto sniper: two quick shots",
    rc: { up: 2.2, first: 2.2, cap: 2, tail: 2.0, sway: 0.35, freq: 1, drift: 0.1, jit: 0.3 } }),
  marshal: W({ id: "marshal", name: "Marshal G28", slot: 1, kind: "sniper", price: 4250, side: "police", damage: 78, armorPen: 0.93, rate: 0.36, auto: false, mag: 20, reserve: 60, reload: 3.2, speed: 0.84, rangeMod: 0.99, spread: [0.0008, 0.05, 0.15], unscopedSpread: 0.085, crouchMul: 0.7, kick: 1.7, kill: 100, tracer: 0xffffff, noise: 82, zoom: [38, 18], scoped: true, note: "Semi-auto marksman rifle",
    rc: { up: 1.7, first: 1.7, cap: 2, tail: 1.5, sway: 0.25, freq: 1.2, drift: 0, jit: 0.25 } }),
};
// every gun is drawn by the model with its own name
export const modelOf = (id) => id;
export const MODEL_IDS = Object.keys(WEAPONS);
export const isPistolKind = (id) => !!WEAPONS[id] && WEAPONS[id].kind === "pistol";
// which guns each side can buy
export const sideCan = (w, side) => w.side === "both" || w.side === side;
// how much of a bullet's power survives a prop (0 = stops it). Thin wood, cloth and barrels let rounds through; stone, steel and concrete don't.
export const PENETRATION = { crate: 0.55, barrel: 0.5, stall: 0.75, cart: 0.7, sacks: 0.6, planter: 0.45, table: 0.9, pallets: 0.7 };
export const GRENADES = {
  flash: { id: "flash", name: "Flashbang", slot: 4, price: 200, max: 2, fuse: 1.6 },
  smoke: { id: "smoke", name: "Smoke Grenade", slot: 5, price: 300, max: 1, fuse: 1.5 },
  he: { id: "he", name: "Frag Grenade", slot: 6, price: 300, max: 1, fuse: 1.7 },
};
export const ARMOR_PRICE = 1000;
export const KIT_PRICE = 400;
export const START_MONEY = 800;
export const MAX_MONEY = 9000;

export const ECON = {
  win: 3250, plantedWin: 3500, loss: 1400, lossStep: 500, lossMax: 3400, plantedLoss: 800, plant: 300, defuse: 300,
};

const CATS = [["Pistols", (w) => w.slot === 2], ["SMGs", (w) => w.slot === 1 && w.kind === "smg"], ["Rifles", (w) => w.slot === 1 && w.kind === "rifle"], ["Snipers", (w) => w.slot === 1 && w.kind === "sniper"]];
export function buyCatalog(side) {
  const items = [];
  const add = (cat, id, name, price, extra = {}) => items.push({ cat, id, name, price, ...extra });
  for (const [cat, f] of CATS) for (const w of Object.values(WEAPONS).filter((w) => w.kind !== "knife" && f(w) && sideCan(w, side)).sort((a, b) => a.price - b.price)) add(cat, w.id, w.name, w.price, { note: w.note, slot: w.slot });
  add("Gear", "armor", "Body Armor", ARMOR_PRICE, { note: "Soaks damage" });
  if (side === "police") add("Gear", "kit", "Defuse Kit", KIT_PRICE, { note: "Defuse in half the time" });
  add("Grenades", "flash", GRENADES.flash.name, GRENADES.flash.price, { note: "Blinds anyone looking" });
  add("Grenades", "smoke", GRENADES.smoke.name, GRENADES.smoke.price, { note: "Blocks sight lines" });
  add("Grenades", "he", GRENADES.he.name, GRENADES.he.price, { note: "Explosive damage" });
  return items;
}

// Each gun has its own recoil signature (def.rc, in degrees per bullet): the first shot kicks (first), the muzzle then climbs (up) for `cap` bullets and
// keeps creeping at `tail` degrees a bullet after, while the sight wanders side to side (sway at freq) and slowly pulls one way (drift: negative = left).
// A spray is the same every time, so it can be learned and pulled down; jit is a small fixed (not random) wobble so it is never a perfect line.
export function recoilStep(def, n) {
  const r = def.rc; const k = def.kick || 1;
  if (!r) return [0, k];
  const pitch = n === 0 ? r.first : n < r.cap ? r.up * (0.8 + 0.2 * Math.min(1, n / 3)) : r.tail;
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453; const jit = (h - Math.floor(h) - 0.5) * 2 * r.jit;
  const yaw = r.sway * Math.sin(n * r.freq) * Math.min(1, 0.3 + n / 5) + r.drift * Math.min(n, r.cap * 1.5) / Math.max(1, r.cap) * 1.6 + jit;
  return [yaw, pitch];
}

// Damage with distance falloff, armour and headshots. Returns { dmg, armorLoss }.
export function computeDamage(def, dist, head, armor) {
  let d = def.damage * Math.pow(def.rangeMod ?? 1, dist / 12.7);
  if (head) d *= def.headMul ?? 4;
  let armorLoss = 0;
  if (armor > 0) {
    const absorbed = d * (1 - (def.armorPen ?? 0.5)); const want = absorbed * 0.5;
    armorLoss = Math.min(armor, want); d -= absorbed * (want > 0 ? armorLoss / want : 0);
  }
  return { dmg: Math.max(1, Math.round(d)), armorLoss: Math.round(armorLoss) };
}
