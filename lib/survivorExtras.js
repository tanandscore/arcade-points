// Upgrade 48: new content shared by the survivor-style Legend Pass games (new perks, a timed "surge" event).
// Everything here is a small plain function, so each game only needs a line or two to use it.
export const EXTRA_UPGRADES = [
  { id: "bloodpact", name: "Blood Pact", desc: "Heal 2 HP for every enemy you defeat", apply: (s) => ({ ...s, lifesteal: (s.lifesteal || 0) + 2 }) },
  { id: "shockwave", name: "Shockwave", desc: "A burst hits every nearby enemy every few seconds (stacks)", apply: (s) => ({ ...s, nova: (s.nova || 0) + 1 }) },
  { id: "ironskin", name: "Iron Skin", desc: "Take 15% less damage from everything", apply: (s) => ({ ...s, armor: Math.min(0.6, (s.armor || 0) + 0.15) }) },
];

export const reduceDamage = (stats, dmg) => Math.max(1, Math.round(dmg * (1 - (stats.armor || 0))));

export function healOnKill(stats) {
  if (stats.lifesteal) stats.hp = Math.min(stats.maxHp, stats.hp + stats.lifesteal);
}

// Every 4.5 seconds (faster with each stack) hurts every enemy within 95 pixels of the player.
export function shockwaveTick(stats, nowMs, enemies, p, baseDamage, burst) {
  if (!stats.nova) return;
  if (nowMs - (stats.novaAt || 0) < 4500 / (0.6 + stats.nova * 0.4)) return;
  stats.novaAt = nowMs;
  for (const e of enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 95) e.hp -= Math.max(6, Math.round(baseDamage * 1.6));
  if (burst) burst(p.x, p.y);
}

// Two "surges" per run: for 18 seconds twice as many enemies arrive, and every gem they drop is worth double.
export function surgeActive(elapsed, total) {
  const a = total * 0.42, b = total * 0.75;
  return (elapsed >= a && elapsed < a + 18) || (elapsed >= b && elapsed < b + 18);
}
