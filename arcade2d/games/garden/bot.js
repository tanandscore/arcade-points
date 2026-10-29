// Garden Guards: the automatic player. It follows a simple plan that any careful player could follow: grow dew first, put shooters in the busy lanes,
// add walls and frost where the big ones come, and drop a Chili Bomb on a crowd. It has a short "reaction time" so it is not a perfect machine.
// The tests let it play every level to prove each one can be won.
import { COLS, PLANTS, plantAt, canPlace, place, collectAll } from "./sim";

const ROW_ORDER = [2, 1, 3, 0, 4];
export function newBrain() { return { next: 0 }; }
const weight = (e) => (e.hpMax > 30 ? 3 : e.hpMax > 12 ? 2 : 1);
// one decision (call every frame; it acts about twice a second of game time). Returns what it did, or null.
export function botAct(S, brain, io) {
  if (S.status !== "play") return null;
  if (!io) collectAll(S);
  if (S.t < brain.next) return null; brain.next = S.t + 0.45;
  const cards = S.lv.cards, has = (c) => cards.includes(c);
  const count = (t) => S.plants.filter((p) => p.type === t).length;
  const threat = (row) => S.enemies.filter((e) => e.row === row && e.x < 9.8).reduce((a, e) => a + weight(e), 0);
  const soon = (row) => S.waves.slice(S.wi, S.wi + 8).filter((w) => w[2] === row && w[0] < S.t + 14).length;
  const shooters = (row) => S.plants.filter((p) => p.row === row && (p.type === "pip" || p.type === "twin" || p.type === "frost"));
  const tryPlace = (type, col, row) => canPlace(S, type, col, row) && (io ? io.place(type, col, row) : place(S, type, col, row)) && { type, col, row };
  // 1. a Chili Bomb on a crowd
  if (has("chili") && S.cool.chili <= 0 && S.dew >= PLANTS.chili.cost) {
    let best = null, bestN = 0;
    for (const e of S.enemies) {
      const col = Math.max(0, Math.min(COLS - 1, Math.floor(e.x - 0.4))); if (e.x > 8.6) continue;
      const r = e.row, n = S.enemies.filter((o) => Math.abs(o.row - r) <= 1 && Math.abs(o.x - e.x) <= 1.6 && o.x < 9.4).reduce((a, o) => a + weight(o), 0);
      if (n > bestN && !plantAt(S, col, r)) { bestN = n; best = [col, r]; }
    }
    if (best && bestN >= 5) { const r = tryPlace("chili", best[0], best[1]); if (r) return r; }
  }
  // 2. dew first
  const wantDew = S.t < 20 ? 2 : S.t < 50 ? 3 : 4, dewNeed = S.lv.sky ? wantDew : wantDew + 1;
  if (has("dew") && count("dew") < dewNeed) {
    for (const row of ROW_ORDER) for (const col of [0, 1]) { if (S.lv.sky && col === 1 && count("dew") < 2) continue; const r = tryPlace("dew", col, row); if (r) return r; }
  }
  // 3. defend the lanes in order of danger
  const rows = [0, 1, 2, 3, 4].sort((a, b) => (threat(b) + soon(b)) - (threat(a) + soon(a)) || ROW_ORDER.indexOf(a) - ROW_ORDER.indexOf(b));
  // first make sure every lane has at least one shooter before any lane gets a second
  if (S.t > 6) for (const row of rows) if (!shooters(row).length) { for (let col = 1; col <= 5; col++) { const r = tryPlace("pip", col, row); if (r) return r; } if (S.dew < PLANTS.pip.cost) break; }
  for (const row of rows) {
    const act = threat(row) + soon(row), sh = shooters(row).length;
    const big = S.enemies.some((e) => e.row === row && e.hpMax > 30) || S.waves.slice(S.wi, S.wi + 8).some((w) => w[2] === row && (w[1] === "brute" || w[1] === "queen") && w[0] < S.t + 18);
    const want = big ? 4 : act >= 3 ? 3 : act >= 1 ? 2 : S.t > 15 ? 1 : 0;
    if (sh < want) {
      const kind = has("twin") && sh > 0 && S.dew >= PLANTS.twin.cost ? "twin" : "pip";
      for (let col = 1; col <= 5; col++) { const r = tryPlace(kind, col, row); if (r) return r; }
    }
    if (has("frost") && sh >= 2 && !S.plants.some((p) => p.row === row && p.type === "frost") && (big || act >= 4)) { for (let col = 2; col <= 5; col++) { const r = tryPlace("frost", col, row); if (r) return r; } }
    if (has("bramble") && sh >= 1 && (big || act >= 3) && !S.plants.some((p) => p.row === row && p.type === "bramble")) { for (const col of [6, 5, 7]) { const r = tryPlace("bramble", col, row); if (r) return r; } }
  }
  // 4. use spare dew: more shooters in the busiest lanes
  if (S.dew >= 150) for (const row of rows) { if (shooters(row).length < 5) for (let col = 1; col <= 5; col++) { const r = tryPlace(has("twin") ? "twin" : "pip", col, row); if (r) return r; } }
  return null;
}
