// Level is always derived from platform_xp, never stored — changing
// the curve here changes what every profile displays instantly, with
// no migration or backfill needed. The curve: level 1 at 0 XP, level
// 2 at 100 XP, level 3 at 400 XP, level 6 at 2500 XP, level 11 at
// 10,000 XP — reachable through ordinary play plus occasional
// achievement bonuses over weeks/months, not minutes.

export const XP_PER_SESSION = 5; // any score submission, win or lose
export const XP_PER_NEW_BEST = 15; // bonus for beating your own record
export const XP_PER_DUEL_WIN = 20;

export function levelForXp(xp) {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

// The XP threshold where a given level begins — the inverse of
// levelForXp, used to compute progress toward the next level.
export function xpFloorForLevel(level) {
  return Math.pow(Math.max(1, level) - 1, 2) * 100;
}

export function levelProgress(xp) {
  const level = levelForXp(xp);
  const floor = xpFloorForLevel(level);
  const nextFloor = xpFloorForLevel(level + 1);
  const span = nextFloor - floor;
  const progress = span > 0 ? (xp - floor) / span : 0;
  return {
    level,
    xp,
    currentLevelFloor: floor,
    nextLevelFloor: nextFloor,
    progress: Math.max(0, Math.min(1, progress)),
  };
}
