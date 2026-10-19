// Weapons, grenades and money rules for the first-person Operation Blacksite.
// Numbers follow the familiar tactical-shooter feel: one-tap headshots with rifles,
// armour that soaks part of the damage, recoil you can learn, and a buy menu.

export const WEAPONS = {
  knife: { id: "knife", name: "Combat Knife", slot: 3, kind: "knife", price: 0, side: "both", damage: 40, stab: 65, rate: 0.5, range: 2.1, speed: 1.08, kill: 1500 },
  pistol: { id: "pistol", name: "Viper", slot: 2, kind: "pistol", price: 0, side: "both", damage: 30, headMul: 4, armorPen: 0.5, rate: 0.17, auto: false, mag: 13, reserve: 52, reload: 2.2, speed: 1.0, rangeMod: 0.8, spread: [0.003, 0.03, 0.09], crouchMul: 0.7, kick: 1.1, kill: 300, tracer: 0xffe9a0, noise: 38 },
  smgT: { id: "smgT", name: "Reaper SMG", slot: 1, kind: "smg", price: 1050, side: "terrorist", damage: 26, headMul: 4, armorPen: 0.6, rate: 0.08, auto: true, mag: 30, reserve: 120, reload: 2.4, speed: 0.96, rangeMod: 0.87, spread: [0.006, 0.026, 0.085], crouchMul: 0.7, kick: 0.62, kill: 600, tracer: 0x3ee6e0, noise: 52, pattern: 0.6 },
  smgCT: { id: "smgCT", name: "Sentinel SMG", slot: 1, kind: "smg", price: 1250, side: "police", damage: 28, headMul: 4, armorPen: 0.62, rate: 0.078, auto: true, mag: 25, reserve: 100, reload: 2.3, speed: 0.97, rangeMod: 0.88, spread: [0.005, 0.024, 0.08], crouchMul: 0.7, kick: 0.58, kill: 600, tracer: 0x3ea8ff, noise: 52, pattern: 0.5 },
  rifleT: { id: "rifleT", name: "Phantom Rifle", slot: 1, kind: "rifle", price: 2700, side: "terrorist", damage: 36, headMul: 4, armorPen: 0.775, rate: 0.1, auto: true, mag: 30, reserve: 90, reload: 2.5, speed: 0.9, rangeMod: 0.98, spread: [0.002, 0.036, 0.1], crouchMul: 0.6, kick: 0.95, kill: 300, tracer: 0xff5a3c, noise: 70, pattern: 1.0 },
  rifleCT: { id: "rifleCT", name: "Warden Rifle", slot: 1, kind: "rifle", price: 3100, side: "police", damage: 33, headMul: 4, armorPen: 0.7, rate: 0.09, auto: true, mag: 30, reserve: 90, reload: 2.4, speed: 0.92, rangeMod: 0.97, spread: [0.0018, 0.032, 0.1], crouchMul: 0.6, kick: 0.82, kill: 300, tracer: 0x3ea8ff, noise: 70, pattern: 0.8 },
  sniper: { id: "sniper", name: "Longshot Sniper", slot: 1, kind: "sniper", price: 4750, side: "both", damage: 115, headMul: 4, armorPen: 0.98, rate: 1.45, auto: false, mag: 10, reserve: 30, reload: 3.7, speed: 0.78, rangeMod: 0.99, spread: [0.0005, 0.07, 0.2], unscopedSpread: 0.11, crouchMul: 0.8, kick: 3.4, kill: 100, tracer: 0xffffff, noise: 90, zoom: [34, 12], scoped: true },
};
// extra guns: a hand-cannon, a pump shotgun and a semi-auto marksman rifle. They borrow the look of the closest base gun.
Object.assign(WEAPONS, {
  deagle: { id: "deagle", name: "Ranger .50", slot: 1, kind: "pistol", price: 700, side: "both", damage: 54, headMul: 3.4, armorPen: 0.93, rate: 0.34, auto: false, mag: 7, reserve: 35, reload: 2.3, speed: 0.98, rangeMod: 0.92, spread: [0.0025, 0.034, 0.1], crouchMul: 0.65, kick: 2.6, kill: 300, tracer: 0xffe0a0, noise: 50, pen: 1.2 },
  shotgun: { id: "shotgun", name: "Breaker 12-gauge", slot: 1, kind: "shotgun", price: 1200, side: "both", damage: 17, pellets: 9, cone: 0.052, headMul: 2, armorPen: 0.5, rate: 0.85, auto: false, mag: 8, reserve: 32, reload: 3.1, speed: 0.94, rangeMod: 0.7, spread: [0.004, 0.02, 0.06], crouchMul: 0.8, kick: 2.4, kill: 900, tracer: 0xfff0b0, noise: 76, pen: 0.2 },
  dmr: { id: "dmr", name: "Marksman DMR", slot: 1, kind: "dmr", price: 2000, side: "both", damage: 58, headMul: 3.5, armorPen: 0.86, rate: 0.27, auto: false, mag: 15, reserve: 60, reload: 2.8, speed: 0.88, rangeMod: 0.99, spread: [0.0012, 0.045, 0.12], crouchMul: 0.5, kick: 1.5, kill: 300, tracer: 0xffffff, noise: 78, pen: 1.0 },
});
// which 3D model draws each gun
export const modelOf = (id, team) => (id === "deagle" ? "pistol" : id === "shotgun" ? (team === "terrorist" ? "smgT" : "smgCT") : id === "dmr" ? (team === "terrorist" ? "rifleT" : "rifleCT") : id);
export const MODEL_IDS = ["rifleT", "rifleCT", "smgT", "smgCT", "sniper", "pistol", "knife"];
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

export function buyCatalog(side) {
  const items = [];
  const add = (cat, id, name, price, extra = {}) => items.push({ cat, id, name, price, ...extra });
  add("Pistols", "pistol", WEAPONS.pistol.name, 0, { note: "Free sidearm" });
  const smg = side === "terrorist" ? WEAPONS.smgT : WEAPONS.smgCT; const rifle = side === "terrorist" ? WEAPONS.rifleT : WEAPONS.rifleCT;
  add("Pistols", "deagle", WEAPONS.deagle.name, WEAPONS.deagle.price, { note: "Hand-cannon, one-shot headshots" });
  add("SMGs", smg.id, smg.name, smg.price, { note: "Fast, close range" });
  add("Shotguns", "shotgun", WEAPONS.shotgun.name, WEAPONS.shotgun.price, { note: "Devastating up close" });
  add("Rifles", rifle.id, rifle.name, rifle.price, { note: "Reliable at any range" });
  add("Rifles", "dmr", WEAPONS.dmr.name, WEAPONS.dmr.price, { note: "Semi-auto, two-tap precision" });
  add("Rifles", "sniper", WEAPONS.sniper.name, WEAPONS.sniper.price, { note: "One shot, long range" });
  add("Gear", "armor", "Body Armor", ARMOR_PRICE, { note: "Soaks damage" });
  if (side === "police") add("Gear", "kit", "Defuse Kit", KIT_PRICE, { note: "Defuse in half the time" });
  add("Grenades", "flash", GRENADES.flash.name, GRENADES.flash.price, { note: "Blinds anyone looking" });
  add("Grenades", "smoke", GRENADES.smoke.name, GRENADES.smoke.price, { note: "Blocks sight lines" });
  add("Grenades", "he", GRENADES.he.name, GRENADES.he.price, { note: "Explosive damage" });
  return items;
}

// Deterministic spray pattern: returns [yaw, pitch] degrees added to the view for bullet n of a spray.
export function recoilStep(def, n) {
  const k = def.kick || 1, p = def.pattern ?? 1;
  if (def.kind === "pistol" || def.kind === "sniper" || def.kind === "dmr" || def.kind === "shotgun") return [((n * 37) % 5 - 2) * 0.12 * k, k];
  const up = Math.min(n, 9) * 0.14 + 0.52; const sway = Math.sin(n * 0.62) * (n < 6 ? 0.18 : 0.62) * p + (n > 14 ? Math.sin(n * 1.7) * 0.35 : 0);
  return [sway * k, up * k * 0.9];
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
