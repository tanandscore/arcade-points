// Midnight Burn — THE WANTED FILE (Upgrade 132). Every police chase now goes on your record:
//  • COST TO THE CITY: what your chase cost in wrecked patrol cars, smashed roadblocks, breakers and traffic,
//  • CHARGES: the list of things you were seen doing (speeding, ramming a patrol car, hit and run...),
//  • NOTORIETY: one number for how wanted you are. It never goes down. The Blacklist rivals each have a notoriety of their own,
//    and a rival only agrees to race you once yours has passed a set amount (a fourth milestone on every rival).
// Plain data and plain functions only, so it can be tested on its own. Saved inside the career as career.wanted.

// what each kind of damage costs the city (in the map's own money)
export const COST = { unit: 18000, block: 12000, breaker: 45000, traffic: 6000, spike: 3000 };

// [id, name, test(tally)] — each charge counts once per chase
export const CHARGES = [
  ["speed", "Speeding", (w) => w.top >= 120],
  ["speed2", "Excessive speeding", (w) => w.top >= 200],
  ["reckless", "Reckless driving", (w) => w.near >= 3],
  ["ram", "Ramming a police vehicle", (w) => w.rams >= 1],
  ["hitrun", "Hit and run", (w) => w.traffic >= 1],
  ["property", "Damage to city property", (w) => w.breakers >= 1],
  ["block", "Jumping a police roadblock", (w) => w.leaps >= 1],
  ["resist", "Resisting arrest", (w) => w.time >= 60],
];
export const CHARGE_NAME = Object.fromEntries(CHARGES.map((c) => [c[0], c[1]]));

export const newTally = () => ({ cost: 0, top: 0, near: 0, rams: 0, traffic: 0, breakers: 0, leaps: 0, units: 0, time: 0 });
export const chargesOf = (w) => CHARGES.filter((c) => c[2](w)).map((c) => c[0]);

// Notoriety earned by one finished chase. You keep most of it even when busted: the police file does not forget.
export const KEEP = { escape: 1, hideout: 0.75, bust: 0.5 };
export function notorietyFor(w, kind, peak) {
  const raw = w.cost / 10 + chargesOf(w).length * 250 + peak * peak * 400 + Math.min(600, w.time) * 15;
  return Math.round((raw * (KEEP[kind] ?? 0.5)) / 10) * 10;
}

// What each Blacklist rung asks for before the rival will race you, #15 first ... #1 last.
export const NEED = [5000, 12000, 22000, 35000, 50000, 70000, 95000, 125000, 160000, 200000, 250000, 310000, 380000, 460000, 560000];
export const needFor = (rank) => NEED[Math.max(0, Math.min(14, 15 - rank))];
// a rival's own notoriety on the board: exactly what they ask of you, so reaching the number puts you above them
export const rivalNotoriety = (rank) => needFor(rank);

export const emptyWanted = () => ({ v: 1, n: 0, cost: 0, chases: 0, charges: {}, best: { n: 0, cost: 0, charges: 0 }, last: null });

// Old saves have chased before this file existed. Give them a fair starting number from what they already did,
// and never re-lock a rival who was already open (`readyRanks` = ranks whose challenge had opened).
export function seedWanted(career, readyRanks = []) {
  if (career.wanted && career.wanted.v === 1) return career.wanted;
  const W = emptyWanted(); const pr = career.pursuit || {};
  let n = (pr.escapes || career.escapes || 0) * 9000 + (career.wrecked || 0) * 1200 + (career.busted || 0) * 2000 + (career.hideouts || 0) * 5000;
  for (const rk of readyRanks) n = Math.max(n, needFor(rk));
  W.n = Math.round(n / 10) * 10; W.cost = (career.wrecked || 0) * COST.unit; W.chases = (pr.escapes || 0) + (career.busted || 0) + (career.hideouts || 0); W.seeded = W.n;
  career.wanted = W; return W;
}

// One finished chase goes on the file. Returns what to show on the chase card.
export function fileChase(career, w, kind, peak) {
  const W = career.wanted || (career.wanted = emptyWanted());
  const ch = chargesOf(w), gain = notorietyFor(w, kind, peak);
  W.n += gain; W.cost += Math.round(w.cost); W.chases++;
  for (const c of ch) W.charges[c] = (W.charges[c] || 0) + 1;
  W.best.n = Math.max(W.best.n, gain); W.best.cost = Math.max(W.best.cost, Math.round(w.cost)); W.best.charges = Math.max(W.best.charges, ch.length);
  W.last = { kind, peak, gain, cost: Math.round(w.cost), charges: ch, time: Math.round(w.time), units: w.units };
  return { gain, cost: Math.round(w.cost), charges: ch, total: W.n };
}

// The board: you among the fifteen rivals, most wanted first. `rivals` = [{ id, rank, name, beaten }].
export function wantedBoard(career, rivals, you = "YOU") {
  const n = (career.wanted && career.wanted.n) || 0;
  const rows = rivals.map((r) => ({ id: r.id, name: r.name, rank: r.rank, n: rivalNotoriety(r.rank), beaten: !!r.beaten, you: false }));
  rows.push({ id: "you", name: you, rank: 0, n, you: true });
  rows.sort((a, b) => b.n - a.n || (a.you ? -1 : 1));
  rows.forEach((r, i) => { r.place = i + 1; });
  return rows;
}
