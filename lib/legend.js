// Legend Pass upgrade (upgrade 47): shared layer for the 14 non-flagship Legend Pass games.
// Challenge level, mastery rank, daily mission. Progress is kept in the browser AND saved to the player's account
// (table legend_progress, migration 083) so it follows them to another device.
export const LEGEND_SLUGS = [
  "titanarena", "duskward", "bloodmoonsiege", "starfalloverrun", "arcanesurvivor", "arenasurvivor", "shadowfall",
  "driftlight", "neondrift", "emberlight", "eclipseprotocol", "thelaststar", "celestialdreams", "eternalfrontier",
];
export const isLegendUpgradeGame = (slug) => LEGEND_SLUGS.includes(slug);

// Games where the challenge level really changes how hard the game is (enemy health, damage and how fast they arrive).
export const CHALLENGE_SLUGS = ["bloodmoonsiege", "starfalloverrun", "arcanesurvivor", "arenasurvivor"];

export const CHALLENGES = {
  standard: { id: "standard", name: "Standard", blurb: "The normal game.", hp: 1, dmg: 1, spawn: 1, score: 1, color: "#3ee6e0" },
  veteran: { id: "veteran", name: "Veteran", blurb: "Tougher enemies, more of them. Scores count 35% extra.", hp: 1.35, dmg: 1.25, spawn: 1.25, score: 1.35, color: "#ffb703" },
  nightmare: { id: "nightmare", name: "Nightmare", blurb: "Brutal. Scores count 80% extra.", hp: 1.8, dmg: 1.6, spawn: 1.6, score: 1.8, color: "#ff3ea5" },
};
let current = CHALLENGES.standard;
export function setChallenge(id) { current = CHALLENGES[id] || CHALLENGES.standard; }
export function getChallenge() { return current; }

export const RANKS = [
  { id: "recruit", name: "Recruit", at: 0, icon: "🥉" },
  { id: "contender", name: "Contender", at: 120, icon: "🥈" },
  { id: "veteran", name: "Veteran", at: 450, icon: "🥇" },
  { id: "elite", name: "Elite", at: 1100, icon: "💎" },
  { id: "legend", name: "Legend", at: 2600, icon: "👑" },
];
export function rankFor(points) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (points >= RANKS[k].at) i = k;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return { cur, next, progress: next ? (points - cur.at) / (next.at - cur.at) : 1, toNext: next ? next.at - points : 0 };
}

export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// One mission per game per day, the same for everyone that day. Targets are based on the player's own best, so they are
// never impossible and never trivial.
export function missionFor(slug, best, day = todayKey()) {
  const kind = hash(slug + day) % 3;
  const base = Math.max(40, Math.round(((best || 0) * 0.75) / 10) * 10);
  if (kind === 0 || !best) return { kind: "score", title: best ? `Score ${base.toLocaleString()} or more` : "Finish your first run", target: best ? base : 1, reward: 60 };
  if (kind === 1) return { kind: "runs", title: "Play 3 runs today", target: 3, reward: 50 };
  return { kind: "beat", title: `Beat your best (${best.toLocaleString()})`, target: best + 1, reward: 90 };
}

const KEY = (slug) => `ts-legend-${slug}`;
export const emptyProgress = () => ({ runs: 0, total: 0, best: 0, points: 0, streak: 0, lastDay: "", missionDay: "", missionDone: false, missionRuns: 0, challengeBest: {} });
export function loadProgress(slug) {
  try { return { ...emptyProgress(), ...(JSON.parse(localStorage.getItem(KEY(slug)) || "{}")) }; } catch { return emptyProgress(); }
}
function saveLocal(slug, p) { try { localStorage.setItem(KEY(slug), JSON.stringify(p)); } catch {} }
const mergeP = (a, b) => ({
  ...a, ...b,
  runs: Math.max(a.runs || 0, b.runs || 0), total: Math.max(a.total || 0, b.total || 0), best: Math.max(a.best || 0, b.best || 0),
  points: Math.max(a.points || 0, b.points || 0), streak: Math.max(a.streak || 0, b.streak || 0),
  challengeBest: { ...(a.challengeBest || {}), ...(b.challengeBest || {}) },
  lastDay: (a.lastDay || "") > (b.lastDay || "") ? a.lastDay : b.lastDay,
  missionDay: (a.missionDay || "") > (b.missionDay || "") ? a.missionDay : b.missionDay,
  missionDone: (a.missionDay || "") === (b.missionDay || "") ? !!(a.missionDone || b.missionDone) : ((a.missionDay || "") > (b.missionDay || "") ? !!a.missionDone : !!b.missionDone),
  missionRuns: (a.missionDay || "") === (b.missionDay || "") ? Math.max(a.missionRuns || 0, b.missionRuns || 0) : ((a.missionDay || "") > (b.missionDay || "") ? a.missionRuns || 0 : b.missionRuns || 0),
});
export async function syncDown(slug) {
  const local = loadProgress(slug);
  try {
    const r = await fetch(`/api/legend-progress?game=${encodeURIComponent(slug)}`);
    if (!r.ok) return local;
    const { data } = await r.json();
    const merged = data ? mergeP(local, data) : local;
    saveLocal(slug, merged);
    return merged;
  } catch { return local; }
}
async function syncUp(slug, p) {
  try { await fetch("/api/legend-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: slug, data: p }) }); } catch {}
}

// Called after every finished run. `score` is the final (already challenge-adjusted) score. Returns what changed so the result screen can show it.
export function recordRun(slug, score, challengeId) {
  const day = todayKey();
  const p = loadProgress(slug);
  const before = rankFor(p.points);
  const wasBest = p.best;
  if (p.missionDay !== day) { p.missionDay = day; p.missionDone = false; p.missionRuns = 0; }
  p.missionRuns += 1;
  p.runs += 1; p.total += score; p.best = Math.max(p.best, score);
  p.challengeBest = { ...p.challengeBest, [challengeId]: Math.max(p.challengeBest?.[challengeId] || 0, score) };
  let gain = 10 + Math.min(60, Math.floor(score / 40));
  if (CHALLENGES[challengeId]?.score > 1) gain = Math.round(gain * CHALLENGES[challengeId].score);
  // Daily streak: playing on consecutive days builds a small bonus.
  if (p.lastDay !== day) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    p.streak = p.lastDay === yk ? p.streak + 1 : 1; p.lastDay = day;
    gain += Math.min(30, p.streak * 5);
  }
  const m = missionFor(slug, wasBest, day);
  let missionJustDone = false;
  const ok = m.kind === "runs" ? p.missionRuns >= m.target : score >= m.target;
  if (!p.missionDone && ok) { p.missionDone = true; missionJustDone = true; gain += m.reward; }
  p.points += gain;
  saveLocal(slug, p);
  syncUp(slug, p);
  const after = rankFor(p.points);
  return { gain, missionJustDone, mission: m, rankUp: after.cur.id !== before.cur.id ? after.cur : null, rank: after, progress: p };
}
