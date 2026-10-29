// Ember Deck: the automatic player. It plays like a careful beginner: kill what it can, block what it must, set up burn and vulnerable on the big enemy,
// otherwise spend energy on the most damage. The tests let it fight every battle from many different shuffles.
import { CARDS, canPlay, playCard, alive, intentDamage, endPlayerTurn, enemyAct } from "./rules";

function damageOf(S, c, tgt) { let d = 0; for (const f of c.fx) if (f.dmg != null) { let x = f.dmg + S.hero.str; if (S.hero.weak > 0) x *= 0.75; if (tgt.vuln > 0) x *= 1.5; d += Math.floor(x) * (f.hits || 1); } return d; }
function worthOf(S, hi, need) {
  const id = S.hand[hi], c = CARDS[id], live = alive(S), H = S.hero; if (!canPlay(S, hi)) return null;
  const fx = (k) => c.fx.find((f) => f[k] != null);
  let best = null;
  const cand = c.aoe ? [live[0]] : live;
  for (const t of cand) {
    let v = 0;
    const dmg = damageOf(S, c, t) * (c.aoe ? live.length : 1), eff = t.hp + t.blk;
    if (!c.aoe && !c.fx.some((f) => f.dmg != null)) v += 0; else v += Math.min(dmg, eff + 2) * 1.0;
    if (dmg >= eff && !c.aoe) v += 18 + (t.max > 30 ? 8 : 0);      // a kill
    if (c.aoe) for (const o of live) if (damageOf(S, c, o) >= o.hp + o.blk) v += 14;
    const b = fx("blk"); if (b) { const useful = Math.max(0, Math.min(b.blk, need - H.blk)); v += useful * 1.15 - (useful === 0 ? 2 : 0); }
    if (fx("vuln") && t.vuln === 0 && t.hp > 14) v += 6; if (fx("weak") && t.weak === 0 && intentDamage(S, t) > 0) v += 5;
    if (fx("burn") && t.hp > 12) v += 4 + (c.aoe ? live.length * 3 : 0);
    if (fx("draw") && S.hand.length < 6) v += 5; if (fx("energy")) v += H.energy < 3 && S.hand.some((x) => CARDS[x].c >= 2) ? 7 : 1;
    if (fx("heal")) v += H.hp < H.max - 14 ? 9 : -4; if (fx("str") && live.some((e) => e.hp > 20)) v += 8 - S.turn * 0.4;
    v -= c.c * 0.6;
    if (!best || v > best.v) best = { v, t };
  }
  return best ? { hi, v: best.v, target: best.t.i } : null;
}
// the single best card to play right now: { hi, target, v }, or null when nothing worth playing is left
export function botPick(S) {
  const incoming = alive(S).reduce((a, e) => a + intentDamage(S, e), 0), need = Math.max(0, incoming);
  let best = null;
  for (let hi = 0; hi < S.hand.length; hi++) { const w = worthOf(S, hi, need); if (w && (!best || w.v > best.v)) best = w; }
  return best && best.v >= 1 ? best : null;
}
export function botTurn(S, maxPlays = 99) {
  // plays cards until nothing worth playing is left. Returns the list of plays (for tests/logging).
  const plays = []; let guard = 0;
  while (S.phase === "player" && guard++ < 30 && plays.length < maxPlays) {
    const best = botPick(S); if (!best) break;
    const id = S.hand[best.hi]; if (!playCard(S, best.hi, best.target)) break; plays.push(id);
  }
  return plays;
}
export function botBattle(S) { let n = 0; while ((S.phase === "player" || S.phase === "enemy") && n++ < 400) { if (S.phase === "player") { botTurn(S); if (S.phase === "player") endPlayerTurn(S); } else { let e; do { e = enemyAct(S); } while (e && S.phase === "enemy"); if (S.phase === "enemy") enemyAct(S); } S.ev.length = 0; } return S; }
