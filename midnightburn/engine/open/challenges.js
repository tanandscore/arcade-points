// Midnight Burn — Upgrade 65: daily challenges, race-day bounties and the free-roam style combo.
//
// DAILY CHALLENGES: every day (by the player's own calendar date) three goals are picked from the list below, the same three for everyone that day,
// a different set tomorrow. Finishing one pays cash and XP straight away; finishing all three pays a bonus, and doing that on days in a row builds a
// streak that makes every reward a bit bigger (up to +50%).
// RACE-DAY BOUNTIES: each day two of the city's races are "wanted": win one and you collect an extra purse on top of the normal prize, once per day.
// STYLE COMBO: in free roam, drifting, near misses, high speed and escapes feed a combo bank. The longer you keep it going the bigger the multiplier;
// stop for a few seconds and the bank is paid out as cash and XP; crash and it is lost.
// Plain data and plain maths (no graphics), so the same numbers run in the tests.
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dayNum = (key) => { const [y, m, d] = key.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const seedOf = (key) => { let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rngOf = (key, salt = 0) => { let a = (seedOf(key) + salt * 7919) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// kind = the counter that moves; goal = [easy, normal, hard] so the day scales with the player's level; reward = cash and xp per 1.0 difficulty
export const DAILY = [
  { id: "nearmiss", kind: "nearmiss", icon: "⚡", text: (g) => `Make ${g} near misses`, goal: [8, 14, 24], cash: 220, xp: 40 },
  { id: "drift", kind: "drift", icon: "🌀", text: (g) => `Drift ${g} metres in total`, goal: [600, 1400, 2800], cash: 240, xp: 45 },
  { id: "speed", kind: "topspeed", icon: "🚀", text: (g) => `Reach ${g} km/h`, goal: [180, 230, 280], cash: 260, xp: 45, max: true },
  { id: "distance", kind: "dist", icon: "🛣️", text: (g) => `Drive ${g} km`, goal: [4, 9, 16], cash: 200, xp: 35 },
  { id: "escape", kind: "escape", icon: "🚨", text: (g) => `Escape the police ${g === 1 ? "once" : g + " times"}`, goal: [1, 2, 3], cash: 340, xp: 60 },
  { id: "combo", kind: "combo", icon: "🔥", text: (g) => `Bank ${g.toLocaleString("en-US")} combo points in one go`, goal: [800, 2000, 4500], cash: 280, xp: 50, max: true },
  { id: "race", kind: "racewin", icon: "🏁", text: (g) => `Win ${g === 1 ? "a race" : g + " races"}`, goal: [1, 2, 3], cash: 380, xp: 70 },
  { id: "outrun", kind: "outrun", icon: "🏎️", text: (g) => `Win ${g === 1 ? "an outrun" : g + " outruns"} against a street racer`, goal: [1, 1, 2], cash: 400, xp: 75 },
];
/** Today's three challenges for a player of this level (0-based tier from level: 1-5 easy, 6-12 normal, 13+ hard). */
export function pickDaily(key, level) {
  const r = rngOf(key, 1); const pool = [...DAILY]; const out = [];
  while (out.length < 3 && pool.length) { const i = Math.floor(r() * pool.length); out.push(pool.splice(i, 1)[0]); }
  const tier = level >= 13 ? 2 : level >= 6 ? 1 : 0;
  return out.map((d) => ({ id: d.id, kind: d.kind, icon: d.icon, goal: d.goal[tier], text: d.text(d.goal[tier]), cash: Math.round(d.cash * (1 + tier * 0.5)), xp: Math.round(d.xp * (1 + tier * 0.4)), max: !!d.max }));
}
export const streakBonus = (streak) => 1 + Math.min(5, Math.max(0, streak)) * 0.1;
/** Two featured races today out of the city's list. */
export function pickBounties(key, events) {
  const pool = events.filter((e) => ["circuit", "sprint", "drift", "delivery"].includes(e.type)); const r = rngOf(key, 2); const out = [];
  while (out.length < 2 && pool.length) { const i = Math.floor(r() * pool.length); out.push(pool.splice(i, 1)[0].id); }
  return out;
}
export const BOUNTY = { CASH: 0.75, XP: 0.5 };

// ---- the combo ----
export const COMBO = {
  IDLE: 4,                 // seconds with nothing new before the bank is paid out
  DRIFT_RATE: 2.6,         // points per second of drifting, times speed
  FAST_SPEED: 52, FAST_RATE: 14,   // flat out (about 187 km/h) feeds the bank slowly
  NEAR: 120, ESCAPE: 600,
  STEPS: [0, 3, 7, 12, 18, 26, 36, 48], // number of "moves" in the chain needed for multiplier x1..x8
  PAY_CASH: 0.12, PAY_XP: 0.03,
};
export const comboMult = (moves) => { let m = 1; for (let i = 1; i < COMBO.STEPS.length; i++) if (moves >= COMBO.STEPS[i]) m = i + 1; return m; };
