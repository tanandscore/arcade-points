// Progress for the 2D games: stars and best score per level, unlocks, small stats, settings.
// It is kept in the browser first (so it works offline and for guests) and copied to the player's account
// (table game_saves) so it follows them to another device. When both exist they are merged by "keep the best".
import { clamp } from "./util";

const KEY = (id) => `ts-k2d-${id}`;
export const emptySave = () => ({ v: 1, levels: {}, stats: { plays: 0, wins: 0, deaths: 0, score: 0 }, settings: {}, extra: {}, t: 0 });

export function normalizeSave(s) {
  const e = emptySave(); if (!s || typeof s !== "object") return e;
  const out = { ...e, ...s, levels: {}, stats: { ...e.stats, ...(s.stats || {}) }, settings: { ...(s.settings || {}) }, extra: s.extra && typeof s.extra === "object" ? s.extra : {} };
  for (const [k, v] of Object.entries(s.levels || {})) {
    if (!v || typeof v !== "object") continue;
    out.levels[k] = { stars: clamp(Math.floor(+v.stars || 0), 0, 3), best: Math.max(0, Math.floor(+v.best || 0)), time: +v.time > 0 ? +v.time : 0 };
  }
  for (const k of Object.keys(out.stats)) out.stats[k] = Math.max(0, Math.floor(+out.stats[k] || 0));
  return out;
}

export function mergeSaves(a, b) {
  const A = normalizeSave(a), B = normalizeSave(b), out = normalizeSave(A.t >= B.t ? A : B);
  out.levels = {};
  for (const k of new Set([...Object.keys(A.levels), ...Object.keys(B.levels)])) {
    const x = A.levels[k], y = B.levels[k];
    if (x && y) out.levels[k] = { stars: Math.max(x.stars, y.stars), best: Math.max(x.best, y.best), time: x.time && y.time ? Math.min(x.time, y.time) : x.time || y.time };
    else out.levels[k] = { ...(x || y) };
  }
  for (const k of Object.keys(out.stats)) out.stats[k] = Math.max(A.stats[k] || 0, B.stats[k] || 0);
  const ex = {}; for (const src of [B.extra, A.extra]) for (const [k, v] of Object.entries(src)) { if (typeof v === "number") ex[k] = Math.max(ex[k] || 0, v); else if (!(k in ex)) ex[k] = v; else if (A.t >= B.t && src === A.extra) ex[k] = v; }
  out.extra = ex; out.t = Math.max(A.t, B.t);
  return out;
}

export function loadSave(id) { try { return normalizeSave(JSON.parse(window.localStorage.getItem(KEY(id)))); } catch { return emptySave(); } }
function writeLocal(id, s) { try { window.localStorage.setItem(KEY(id), JSON.stringify(s)); } catch {} }

let upTimers = {};
export function writeSave(id, s, { cloud = true } = {}) {
  s.t = Date.now(); writeLocal(id, s);
  if (!cloud || typeof window === "undefined") return;
  clearTimeout(upTimers[id]);
  upTimers[id] = setTimeout(() => { try { fetch("/api/game-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: id, data: s }) }).catch(() => {}); } catch {} }, 1200);
}
// Pull the account copy and merge it with the browser copy. Safe to call when logged out or before the table exists.
export async function syncDown(id) {
  const local = loadSave(id);
  try {
    const r = await fetch(`/api/game-save?game=${encodeURIComponent(id)}`); if (!r.ok) return local;
    const { data } = await r.json(); if (!data) return local;
    const merged = mergeSaves(local, data); writeLocal(id, merged); return merged;
  } catch { return local; }
}

// helpers games use ------------------------------------------------------------------------------------------------------------
export function recordLevel(save, levelId, { stars = 0, score = 0, time = 0 }) {
  const prev = save.levels[levelId] || { stars: 0, best: 0, time: 0 };
  const next = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), time: time > 0 && (!prev.time || time < prev.time) ? time : prev.time };
  save.levels[levelId] = next;
  return { first: !save.levels[levelId] || prev.best === 0 && prev.stars === 0, newStars: next.stars - prev.stars, newBest: score > prev.best, prev, next };
}
export const totalStars = (save) => Object.values(save.levels).reduce((s, l) => s + (l.stars || 0), 0);
export const completedCount = (save) => Object.values(save.levels).filter((l) => l.stars > 0 || l.best > 0).length;
