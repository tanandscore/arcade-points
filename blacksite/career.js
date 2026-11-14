// Operation Blacksite — the service record (Upgrade 130): ranks, daily contracts, medals and a win streak.
// Plain data and plain functions only (the two tiny storage helpers at the bottom aside), so it can be tested on its own.
// Saved under "blacksite-career-v1", which the flagship cloud save (Upgrade 129) copies to the player's account.
export const CAREER_KEY = "blacksite-career-v1";

export const RANKS = [
  { name: "Recruit", at: 0, icon: "▫️" }, { name: "Operator", at: 900, icon: "🔹" }, { name: "Pointman", at: 2400, icon: "🔷" },
  { name: "Breacher", at: 4800, icon: "🚪" }, { name: "Marksman", at: 8400, icon: "🎯" }, { name: "Squad Lead", at: 13500, icon: "📻" },
  { name: "Specialist", at: 21000, icon: "🛠️" }, { name: "Shadow", at: 31500, icon: "🌑" }, { name: "Vanguard", at: 45000, icon: "🛡️" },
  { name: "Night Captain", at: 63000, icon: "🌙" }, { name: "Ghost Commander", at: 87000, icon: "👻" }, { name: "Blacksite Legend", at: 120000, icon: "⭐" },
];
export function rankOf(xp) {
  let i = 0; for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].at) i = k;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return { index: i, ...cur, next, into: xp - cur.at, span: next ? next.at - cur.at : 0, pct: next ? Math.min(1, (xp - cur.at) / (next.at - cur.at)) : 1 };
}

const DIFF_MULT = { recruit: 1, veteran: 1.4, elite: 1.9 };
const MAP_NAMES = { bazaar: "Sunstone Bazaar", harbor: "Harbor Docks", quarter: "Old Quarter", foundry: "Foundry Yard" };
const MAP_IDS = Object.keys(MAP_NAMES);

// Every kind of daily contract. `prog(m)` is how much one finished match adds.
const CONTRACTS = [
  { id: "kills", n: [10, 14, 18], text: (n) => `Get ${n} kills`, prog: (m) => m.kills, xp: 120 },
  { id: "hs", n: [4, 6, 8], text: (n) => `Land ${n} headshots`, prog: (m) => m.hs, xp: 140 },
  { id: "plant", n: [2, 3], text: (n) => `Plant the bomb ${n} times`, prog: (m) => m.plants, xp: 130 },
  { id: "defuse", n: [1, 2], text: (n) => `Defuse the bomb ${n} time${n > 1 ? "s" : ""}`, prog: (m) => m.defuses, xp: 150 },
  { id: "win", n: [1, 2], text: (n) => `Win ${n} match${n > 1 ? "es" : ""}`, prog: (m) => (m.won ? 1 : 0), xp: 160 },
  { id: "rounds", n: [5, 8], text: (n) => `Win ${n} rounds`, prog: (m) => m.roundsWon, xp: 110 },
  { id: "damage", n: [1500, 2500], text: (n) => `Deal ${n} damage`, prog: (m) => m.damage, xp: 120 },
  { id: "map", n: [1], text: (n, map) => `Win a match on ${MAP_NAMES[map]}`, prog: (m, map) => (m.won && m.mapId === map ? 1 : 0), xp: 170, map: true },
  { id: "hard", n: [1], text: () => "Win a match on Veteran or Elite", prog: (m) => (m.won && m.difficulty !== "recruit" ? 1 : 0), xp: 200 },
  { id: "careful", n: [1], text: () => "Finish a match with 5 deaths or fewer", prog: (m) => (m.deaths <= 5 ? 1 : 0), xp: 150 },
];
const CBY = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));

// Lifetime medals. `get(t)` reads the running totals.
export const MEDALS = [
  { id: "k50", icon: "🔫", name: "First Blood Tally", text: "50 kills", need: 50, get: (t) => t.kills },
  { id: "k250", icon: "💥", name: "Room Clearer", text: "250 kills", need: 250, get: (t) => t.kills },
  { id: "k1000", icon: "☠️", name: "One-Man Squad", text: "1,000 kills", need: 1000, get: (t) => t.kills },
  { id: "hs25", icon: "🎯", name: "Steady Hands", text: "25 headshots", need: 25, get: (t) => t.hs },
  { id: "hs200", icon: "🦅", name: "Eagle Eye", text: "200 headshots", need: 200, get: (t) => t.hs },
  { id: "pl10", icon: "💣", name: "Demolition Crew", text: "10 bomb plants", need: 10, get: (t) => t.plants },
  { id: "df5", icon: "✂️", name: "Wire Cutter", text: "5 defuses", need: 5, get: (t) => t.defuses },
  { id: "df25", icon: "🧯", name: "Ice in the Veins", text: "25 defuses", need: 25, get: (t) => t.defuses },
  { id: "w5", icon: "🏅", name: "Field Proven", text: "5 match wins", need: 5, get: (t) => t.wins },
  { id: "w25", icon: "🎖️", name: "Decorated", text: "25 match wins", need: 25, get: (t) => t.wins },
  { id: "w100", icon: "🏆", name: "Living Legend", text: "100 match wins", need: 100, get: (t) => t.wins },
  { id: "st3", icon: "🔥", name: "On a Roll", text: "Win 3 matches in a row", need: 3, get: (t) => t.bestStreak },
  { id: "st7", icon: "🌋", name: "Unstoppable", text: "Win 7 matches in a row", need: 7, get: (t) => t.bestStreak },
  { id: "maps", icon: "🗺️", name: "World Tour", text: "Win on all four maps", need: 4, get: (t) => MAP_IDS.filter((m) => (t.mapWins || {})[m]).length },
  { id: "elite", icon: "👑", name: "Elite Breaker", text: "Win a match on Elite", need: 1, get: (t) => t.eliteWins },
  { id: "con10", icon: "📜", name: "Contractor", text: "Finish 10 daily contracts", need: 10, get: (t) => t.contracts },
  { id: "days7", icon: "📅", name: "Regular", text: "Play on 7 different days", need: 7, get: (t) => t.days },
];

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function rng(seedText) { let h = 2166136261; for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

// Three different contracts for a day; the same day always gives the same three.
export function contractsFor(day) {
  const r = rng("bs" + day); const pool = CONTRACTS.slice(); const out = [];
  while (out.length < 3) { const c = pool.splice(Math.floor(r() * pool.length), 1)[0]; const n = c.n[Math.floor(r() * c.n.length)]; const map = c.map ? MAP_IDS[Math.floor(r() * MAP_IDS.length)] : null; out.push({ id: c.id, n, map, p: 0, done: false }); }
  return out;
}
export const contractText = (c) => CBY[c.id] ? CBY[c.id].text(c.n, c.map) : "";
export const contractXp = (c) => (CBY[c.id] ? CBY[c.id].xp : 0);

export function emptyCareer() {
  return { v: 1, xp: 0, day: "", daily: [], streak: 0, lastDay: "", medals: {}, t: { matches: 0, wins: 0, kills: 0, hs: 0, deaths: 0, plants: 0, defuses: 0, damage: 0, roundsWon: 0, bestStreak: 0, eliteWins: 0, contracts: 0, days: 0, mapWins: {} } };
}
// Makes sure today's contracts are the ones on the record (call when the menu opens).
export function refreshDay(C, day = dayKey()) {
  if (C.day !== day) { C.day = day; C.daily = contractsFor(day); }
  return C;
}

// One finished solo match. m = { won, draw, kills, hs, deaths, plants, defuses, damage, roundsWon, mapId, difficulty }.
// Changes C and returns what to show on the result screen.
export function applyMatch(C, m, day = dayKey()) {
  refreshDay(C, day);
  const before = rankOf(C.xp); const mult = DIFF_MULT[m.difficulty] || 1; const t = C.t;
  const lines = [];
  const add = (label, pts) => { if (pts > 0) lines.push({ label, xp: Math.round(pts) }); };
  add(`${m.kills} kills`, m.kills * 10 * mult);
  add(`${m.hs} headshots`, m.hs * 6 * mult);
  add(`${m.plants} plants`, m.plants * 25 * mult);
  add(`${m.defuses} defuses`, m.defuses * 40 * mult);
  add(`${m.roundsWon} rounds won`, m.roundsWon * 15 * mult);
  if (m.won) add("Match won", 120 * mult); else add("Match played", 30);
  t.matches++; t.kills += m.kills; t.hs += m.hs; t.deaths += m.deaths; t.plants += m.plants; t.defuses += m.defuses; t.damage += m.damage; t.roundsWon += m.roundsWon;
  if (m.won) { t.wins++; C.streak++; t.mapWins = { ...(t.mapWins || {}), [m.mapId]: ((t.mapWins || {})[m.mapId] || 0) + 1 }; if (m.difficulty === "elite") t.eliteWins++; }
  else if (!m.draw) C.streak = 0;
  t.bestStreak = Math.max(t.bestStreak, C.streak);
  if (m.won && C.streak >= 2) add(`Win streak x${C.streak}`, Math.min(5, C.streak) * 20);
  if (C.lastDay !== day) { C.lastDay = day; t.days++; add("First match today", 60); }
  const contractsDone = [];
  for (const c of C.daily) {
    if (c.done || !CBY[c.id]) continue;
    c.p = Math.min(c.n, c.p + CBY[c.id].prog(m, c.map));
    if (c.p >= c.n) { c.done = true; t.contracts++; contractsDone.push(c); add(`Contract: ${contractText(c)}`, CBY[c.id].xp); }
  }
  if (C.daily.length && C.daily.every((c) => c.done) && contractsDone.length) add("All three contracts", 150);
  const medals = [];
  for (const md of MEDALS) if (!C.medals[md.id] && md.get(t) >= md.need) { C.medals[md.id] = day; medals.push(md); add(`Medal: ${md.name}`, 100); }
  const gained = lines.reduce((s, l) => s + l.xp, 0); C.xp += gained;
  const after = rankOf(C.xp);
  return { gained, lines, before, after, rankUp: after.index > before.index, contractsDone, medals, streak: C.streak };
}

export function loadCareer() {
  let C = null; try { C = JSON.parse(localStorage.getItem(CAREER_KEY) || "null"); } catch {}
  const e = emptyCareer(); C = C && C.v === 1 ? { ...e, ...C, t: { ...e.t, ...(C.t || {}) }, medals: C.medals || {} } : e;
  return refreshDay(C);
}
export function saveCareer(C) { try { localStorage.setItem(CAREER_KEY, JSON.stringify(C)); } catch {} }
