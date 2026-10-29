// Wrath of Olympus — the long game (Upgrade 69): laurels, blessings, ranks, campaign stars and the daily streak.
// Everything here is plain data and plain functions (no screen, no storage calls except the two tiny helpers at the bottom),
// so it can be tested on its own.

export const META_KEY = "wrath-meta-v1";

// Permanent blessings, bought with laurels in the Pantheon. Each level is small; together they make every new war a bit easier.
export const BLESSINGS = {
  hearth: { name: "Hearth's Bounty", icon: "🍞", max: 5, costs: [30, 60, 100, 150, 220], per: 40, text: (l) => `Start every war with +${l * 40} food and +${l * 40} wood.` },
  tutor: { name: "Chiron's Lessons", icon: "📜", max: 4, costs: [40, 80, 140, 220], per: 20, text: (l) => `Your champion starts with ${l * 20} experience${l >= 4 ? " (already level 2)" : ""}.` },
  haste: { name: "Hermes's Haste", icon: "👟", max: 5, costs: [35, 70, 110, 160, 230], per: 0.03, text: (l) => `Your citizens gather ${l * 3}% faster.` },
  masonry: { name: "Hephaestus's Masonry", icon: "🧱", max: 4, costs: [45, 90, 150, 230], per: 0.05, text: (l) => `Your buildings are ${l * 5}% tougher.` },
  piety: { name: "Pious Offerings", icon: "✨", max: 4, costs: [40, 80, 130, 200], per: 15, text: (l) => `Start with +${l * 15} favor and gain favor ${l * 12}% faster.` },
  oracle: { name: "The Oracle's Eyes", icon: "🔮", max: 3, costs: [50, 110, 190], per: 4, text: (l) => `See ${l * 4} tiles farther around your city at the start.` },
  fortune: { name: "Fortune's Favor", icon: "🎲", max: 3, costs: [60, 130, 220], per: 0.06, text: (l) => `Earn ${l * 6}% more laurels from every war.` },
};
export const BLESSING_ORDER = Object.keys(BLESSINGS);

export const RANKS = [
  { name: "Wanderer", at: 0, icon: "🥾" },
  { name: "Hoplite", at: 60, icon: "🛡️" },
  { name: "Strategos", at: 180, icon: "📯" },
  { name: "Champion", at: 400, icon: "⚔️" },
  { name: "Hero of Athens", at: 800, icon: "🏛️" },
  { name: "Demigod", at: 1500, icon: "⚡" },
  { name: "Olympian", at: 3000, icon: "👑" },
];
export function rankOf(total) {
  let i = 0; for (let k = 0; k < RANKS.length; k++) if (total >= RANKS[k].at) i = k;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return { index: i, ...cur, next, into: total - cur.at, span: next ? next.at - cur.at : 1, pct: next ? Math.min(1, (total - cur.at) / (next.at - cur.at)) : 1 };
}

export const emptyMeta = () => ({ v: 1, laurels: 0, total: 0, blessings: {}, campaign: {}, daily: { last: "", streak: 0, best: 0, doneToday: false }, wins: 0, matches: 0, bestScore: 0, fatesDone: 0 });

export function normalize(m) {
  const e = emptyMeta(); if (!m || typeof m !== "object") return e;
  const out = { ...e, ...m, blessings: { ...(m.blessings || {}) }, campaign: { ...(m.campaign || {}) }, daily: { ...e.daily, ...(m.daily || {}) } };
  for (const k of ["laurels", "total", "wins", "matches", "bestScore", "fatesDone"]) out[k] = Math.max(0, Math.floor(+out[k] || 0));
  for (const k of Object.keys(out.blessings)) { if (!BLESSINGS[k]) delete out.blessings[k]; else out.blessings[k] = Math.max(0, Math.min(BLESSINGS[k].max, Math.floor(+out.blessings[k] || 0))); }
  return out;
}

// what the blessings do, as numbers the game can use
export function blessingFx(meta) {
  const b = (meta && meta.blessings) || {}; const L = (k) => Math.max(0, Math.min(BLESSINGS[k].max, b[k] || 0));
  return {
    startFW: L("hearth") * BLESSINGS.hearth.per, xp: L("tutor") * BLESSINGS.tutor.per, gather: L("haste") * BLESSINGS.haste.per, bhp: L("masonry") * BLESSINGS.masonry.per,
    favor: L("piety") * BLESSINGS.piety.per, favorRate: L("piety") * 0.042, vision: L("oracle") * BLESSINGS.oracle.per, laurelMul: 1 + L("fortune") * BLESSINGS.fortune.per,
  };
}

export const nextCost = (meta, key) => { const l = (meta.blessings[key] || 0); const B = BLESSINGS[key]; return l >= B.max ? null : B.costs[l]; };
export function buyBlessing(meta, key) {
  if (!BLESSINGS[key]) return { ok: false, reason: "No such blessing" };
  const c = nextCost(meta, key); if (c == null) return { ok: false, reason: "Fully blessed" }; if (meta.laurels < c) return { ok: false, reason: `Needs ${c} laurels` };
  const m = normalize(meta); m.laurels -= c; m.blessings[key] = (m.blessings[key] || 0) + 1; return { ok: true, meta: m, cost: c };
}

// ---- earning laurels after a war -------------------------------------------------------------------------------------
export const DIFF_MULT = { recruit: 1, veteran: 1.6, elite: 2.4 };
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function prevDay(key) { const [y, m, d] = key.split("-").map(Number); const t = new Date(y, m - 1, d); t.setDate(t.getDate() - 1); return dayKey(t); }

// result = what the game returned at the end (see engine.computeResult).  Returns { meta, gain, parts, rankUp, newStars, streak }
export function recordMatch(metaIn, result, now = new Date()) {
  const meta = normalize(metaIn); const fx = blessingFx(meta); const before = rankOf(meta.total);
  const parts = []; let gain = 0; const add = (label, n) => { n = Math.round(n); if (n > 0) { parts.push({ label, n }); gain += n; } };
  const dm = DIFF_MULT[result.difficulty] || 1;
  add(result.won ? "Victory" : "Fought on", (result.won ? 30 : 8) * dm);
  add("Time at war", Math.min(15, Math.floor((result.time || 0) / 120)));
  const fates = (result.objectives || []).filter((o) => o.kind === "fate" && o.done); add(`Fates fulfilled ×${fates.length}`, fates.length * 10);
  let newStars = 0; const mid = result.mission;
  if (mid && result.mode === "campaign") {
    const prev = (meta.campaign[mid] || {}).stars || 0; const stars = result.won ? result.stars || 1 : 0;
    if (stars > prev) { newStars = stars - prev; add(`New stars ×${newStars}`, newStars * 25); meta.campaign[mid] = { stars, best: Math.max(result.score || 0, (meta.campaign[mid] || {}).best || 0) }; }
    else if (prev) meta.campaign[mid] = { stars: prev, best: Math.max(result.score || 0, (meta.campaign[mid] || {}).best || 0) };
    if (result.won && !prev) add("First conquest", 20);
  }
  let streak = meta.daily.streak;
  if (result.mode === "daily") {
    const key = dayKey(now);
    if (result.won && meta.daily.last !== key) {
      streak = meta.daily.last === prevDay(key) ? meta.daily.streak + 1 : 1; meta.daily = { last: key, streak, best: Math.max(meta.daily.best || 0, streak), doneToday: true };
      add("Daily trial won", 40); add(`Streak ×${streak}`, Math.min(7, streak) * 10);
    }
  }
  const mul = fx.laurelMul; if (mul > 1) { const extra = Math.round(gain * (mul - 1)); if (extra > 0) { parts.push({ label: "Fortune's Favor", n: extra }); gain += extra; } }
  meta.laurels += gain; meta.total += gain; meta.matches++; if (result.won) meta.wins++; meta.fatesDone += fates.length; meta.bestScore = Math.max(meta.bestScore, result.score || 0);
  const after = rankOf(meta.total);
  return { meta, gain, parts, rankUp: after.index > before.index ? after : null, newStars, streak };
}

export function dailyDone(meta, now = new Date()) { return meta.daily && meta.daily.last === dayKey(now); }
export function liveStreak(meta, now = new Date()) { const k = dayKey(now); const l = meta.daily.last; return l === k || l === prevDay(k) ? meta.daily.streak : 0; }

// ---- the two storage helpers (the only part that touches the browser) ---------------------------------------------------
export function loadMeta() { try { return normalize(JSON.parse(window.localStorage.getItem(META_KEY))); } catch { return emptyMeta(); } }
export function saveMeta(m) { try { window.localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} }
