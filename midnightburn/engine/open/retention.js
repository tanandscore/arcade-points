// Midnight Burn — Upgrade 81: reasons to come back. HEAT MASTERY badges (three per heat level), the WEEKLY MOST WANTED target, and the SEASON frame.
// Plain data and plain maths (no graphics), so the same numbers run in the tests.
import { dayKey, dayNum, rngOf } from "./challenges";

export const HEAT_NAMES = ["", "NOTICE", "PURSUIT", "MANHUNT", "CRACKDOWN", "WAR", "BLACKOUT"];
// three badges per heat level h (1..6). A badge for a higher heat also counts for the lower ones.
export const MASTERY = [
  { k: "e", name: "ESCAPE", text: (h) => `Escape a heat ${h} chase`, cash: (h) => 300 * h },
  { k: "w", name: "DEMOLITION", text: (h) => `Wreck 5 patrol cars in one heat ${h} chase`, cash: (h) => 400 * h },
  { k: "c", name: "UNTOUCHABLE", text: (h) => `Escape heat ${h} without ever being close to busted`, cash: (h) => 600 * h },
];
/** Which badges a finished chase earns: [{id:"e3", h:3, k:"e"}]. */
export function badgesFor(r) {
  const out = []; if (!r || !(r.peak >= 1)) return out;
  for (let h = 1; h <= Math.min(6, r.peak); h++) {
    if (r.kind !== "bust") out.push({ id: "e" + h, h, k: "e" });
    if ((r.wrecks || 0) >= 5) out.push({ id: "w" + h, h, k: "w" });
    if (r.kind !== "bust" && (r.bustMax || 0) < 0.5) out.push({ id: "c" + h, h, k: "c" });
  }
  return out;
}

// ---- the weekly target: the same for everyone in a given week (weeks start on Monday) ----
export const weekKey = (d = new Date()) => { const n = Math.floor((dayNum(dayKey(d)) + 3) / 7); return "W" + n; };
export const WEEKLY = [
  { id: "escapes", icon: "🚨", text: (g) => `Escape the police ${g} times at heat 3 or higher`, goal: [2, 3, 4], cash: [4000, 8000, 14000], xp: [300, 500, 800] },
  { id: "wrecks", icon: "💥", text: (g) => `Wreck ${g} police cars`, goal: [8, 15, 25], cash: [4000, 8000, 14000], xp: [300, 500, 800] },
  { id: "bank", icon: "💰", text: (g) => `Bank ${g.toLocaleString("en-US")} in chase cash`, goal: [3000, 8000, 15000], cash: [4000, 8000, 14000], xp: [300, 500, 800] },
  { id: "highheat", icon: "🔥", text: (g) => `Escape a heat ${g} chase`, goal: [3, 4, 5], cash: [4000, 9000, 16000], xp: [300, 550, 900] },
  { id: "near", icon: "⚡", text: (g) => `Make ${g} near misses during chases`, goal: [20, 40, 70], cash: [3500, 7500, 13000], xp: [300, 500, 800] },
];
export function pickWeekly(wk, level) {
  const r = rngOf(wk, 3); const t = WEEKLY[Math.floor(r() * WEEKLY.length)]; const tier = level >= 13 ? 2 : level >= 6 ? 1 : 0;
  return { id: t.id, icon: t.icon, goal: t.goal[tier], text: t.text(t.goal[tier]), cash: t.cash[tier], xp: t.xp[tier] };
}
/** How much a finished chase adds to a weekly target. */
export function weeklyGain(id, r) {
  if (!r) return 0;
  switch (id) {
    case "escapes": return r.kind !== "bust" && r.peak >= 3 ? 1 : 0;
    case "wrecks": return r.wrecks || 0;
    case "bank": return r.kind !== "bust" ? Math.round(r.cash || 0) : 0;
    case "highheat": return r.kind !== "bust" ? r.peak : 0; // progress is the best heat escaped this week (a "max" target)
    case "near": return r.near || 0;
    default: return 0;
  }
}
export const weeklyIsMax = (id) => id === "highheat";

// ---- seasons: six-week blocks counted from Monday 2 November 2026 ----
export const SEASON_WEEKS = 6, SEASON_FINISH_CASH = 15000;
const SEASON_START = Math.floor((dayNum("2026-11-02") + 3) / 7);
export const SEASON_NAMES = ["NEON RAIN", "SUMMER BURN", "GHOST LIGHTS", "MONSOON KINGS", "CHROME HEAT", "LAST CALL"];
export function seasonOf(wk) {
  const n = Math.max(0, Number(String(wk).replace("W", "")) - SEASON_START); const idx = Math.floor(n / SEASON_WEEKS);
  return { n: idx + 1, name: SEASON_NAMES[idx % SEASON_NAMES.length], week: (n % SEASON_WEEKS) + 1, weeks: SEASON_WEEKS, weeksLeft: SEASON_WEEKS - (n % SEASON_WEEKS) };
}
