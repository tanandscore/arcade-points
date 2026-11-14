// Ember Deck: the rules of the card battles. Pure code (no drawing), used by the game, the automatic player and the tests.
// You play cards with energy, enemies show what they will do next (their "intent"), and block soaks up damage until your next turn.
export const HERO = { hp: 50, energy: 3, hand: 5 };

// type: a attack, s skill, p power. fx ops run in order. aoe = hits every enemy. ex = exhaust (removed from the deck for this battle).
export const CARDS = {
  strike:   { n: "Strike",       c: 1, t: "a", fx: [{ dmg: 6 }], txt: "Deal 6 damage." },
  guard:    { n: "Guard",        c: 1, t: "s", fx: [{ blk: 5 }], txt: "Gain 5 block." },
  bash:     { n: "Bash",         c: 2, t: "a", fx: [{ dmg: 9 }, { vuln: 2 }], txt: "Deal 9 damage. Vulnerable 2." },
  spark:    { n: "Spark",        c: 0, t: "a", fx: [{ dmg: 3 }], txt: "Deal 3 damage." },
  cleave:   { n: "Cleave",       c: 1, t: "a", aoe: 1, fx: [{ dmg: 5 }], txt: "Deal 5 damage to ALL enemies." },
  fireball: { n: "Fireball",     c: 2, t: "a", fx: [{ dmg: 7 }, { burn: 4 }], txt: "Deal 7 damage. Burn 4." },
  flurry:   { n: "Flurry",       c: 1, t: "a", fx: [{ dmg: 3, hits: 3 }], txt: "Deal 3 damage 3 times." },
  shield:   { n: "Ember Shield", c: 2, t: "s", fx: [{ blk: 13 }], txt: "Gain 13 block." },
  insight:  { n: "Insight",      c: 1, t: "s", fx: [{ draw: 2 }], txt: "Draw 2 cards." },
  surge:    { n: "Surge",        c: 0, t: "s", fx: [{ energy: 2 }], ex: 1, txt: "Gain 2 energy. Exhaust." },
  mend:     { n: "Mend",         c: 1, t: "s", fx: [{ heal: 7 }], ex: 1, txt: "Heal 7. Exhaust." },
  stoke:    { n: "Stoke",        c: 1, t: "p", fx: [{ str: 2 }], ex: 1, txt: "Gain 2 strength. Exhaust." },
  heavy:    { n: "Heavy Blow",   c: 2, t: "a", fx: [{ dmg: 16 }], txt: "Deal 16 damage." },
  weaken:   { n: "Weaken",       c: 1, t: "s", fx: [{ weak: 2 }, { blk: 4 }], txt: "Weak 2. Gain 4 block." },
  inferno:  { n: "Inferno",      c: 3, t: "a", aoe: 1, fx: [{ dmg: 10 }, { burn: 3 }], txt: "Deal 10 damage and Burn 3 to ALL." },
  riposte:  { n: "Riposte",      c: 1, t: "a", fx: [{ blk: 4 }, { dmg: 5 }], txt: "Gain 4 block. Deal 5 damage." },
};
export const STARTER = ["strike", "strike", "strike", "strike", "strike", "guard", "guard", "guard", "guard", "bash"];

// intents: atk (damage), hits, blk, str (gain strength), weak / vuln (put on you), heal
export const ENEMIES = {
  rat:      { n: "Cinder Rat",    hp: 14, moves: [{ atk: 5 }, { atk: 7 }] },
  wisp:     { n: "Ash Wisp",      hp: 11, moves: [{ atk: 3, weak: 1 }, { atk: 5 }] },
  brute:    { n: "Slag Brute",    hp: 34, moves: [{ atk: 10 }, { blk: 9 }, { atk: 13 }] },
  scorpion: { n: "Glass Scorpion", hp: 21, moves: [{ atk: 4, hits: 2 }, { atk: 9 }] },
  wolf:     { n: "Frost Wolf",    hp: 26, moves: [{ atk: 8 }, { vuln: 2, atk: 4 }] },
  golem:    { n: "Ice Golem",     hp: 42, moves: [{ blk: 12 }, { atk: 14 }, { atk: 8 }] },
  imp:      { n: "Ember Imp",     hp: 19, moves: [{ atk: 3, hits: 3 }, { str: 1, blk: 5 }] },
  shade:    { n: "Gloom Shade",   hp: 30, moves: [{ atk: 7, weak: 1 }, { atk: 11 }, { blk: 8, vuln: 1 }] },
  knight:   { n: "Magma Knight",  hp: 58, elite: 1, moves: [{ atk: 12 }, { str: 2, blk: 6 }, { atk: 8, hits: 2 }] },
  serpent:  { n: "Crystal Serpent", hp: 54, elite: 1, moves: [{ atk: 6, hits: 2 }, { blk: 12 }, { atk: 15 }] },
  titan:    { n: "Ash Titan",     hp: 88, boss: 1, moves: [{ atk: 13 }, { blk: 10, str: 1 }, { atk: 6, hits: 2 }, { atk: 18 }] },
  queen:    { n: "Glass Queen",   hp: 100, boss: 1, moves: [{ atk: 8, hits: 2 }, { blk: 14 }, { atk: 12, weak: 1 }, { atk: 20 }] },
  king:     { n: "Frost King",    hp: 112, boss: 1, moves: [{ vuln: 2, atk: 6 }, { atk: 15 }, { blk: 14, str: 1 }, { atk: 9, hits: 2 }] },
  lord:     { n: "Ember Lord",    hp: 124, boss: 1, moves: [{ atk: 12 }, { atk: 7, hits: 2, str: 1 }, { blk: 12, weak: 1 }, { atk: 22 }] },
};

function rnd(S) { S.seed = (S.seed * 1664525 + 1013904223) >>> 0; return S.seed / 4294967296; }
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function createState(lv, deck, seed) {
  const S = {
    lv, seed: (((seed >>> 0) * 2654435761 + 12345) >>> 0) || 7, turn: 0, phase: "player", ev: [], uid: 1,
    hero: { hp: HERO.hp + (lv.bonusHp || 0), max: HERO.hp + (lv.bonusHp || 0), blk: 0, energy: 0, str: 0, weak: 0, vuln: 0 },
    draw: [], hand: [], disc: [], exh: [], en: [], played: 0, dmgTaken: 0, eq: [],
  };
  S.en = lv.enemies.map((id, i) => ({ id: S.uid++, type: id, i, hp: ENEMIES[id].hp, max: ENEMIES[id].hp, blk: 0, str: 0, vuln: 0, weak: 0, burn: 0, mv: 0, intent: ENEMIES[id].moves[0], dead: false }));
  S.draw = shuffle(S, deck.slice());
  startTurn(S);
  return S;
}
export const alive = (S) => S.en.filter((e) => !e.dead);

function drawCards(S, n) {
  for (let i = 0; i < n; i++) {
    if (!S.draw.length) { if (!S.disc.length) break; S.draw = shuffle(S, S.disc); S.disc = []; S.ev.push({ k: "shuffle" }); }
    S.hand.push(S.draw.pop());
  }
}
export function startTurn(S) {
  S.turn++; S.phase = "player"; S.hero.energy = HERO.energy; S.hero.blk = S.turn === 1 && S.lv.startBlock ? S.lv.startBlock : 0;
  drawCards(S, HERO.hand + (S.turn === 1 && S.lv.extraDraw ? S.lv.extraDraw : 0));
  for (const e of alive(S)) e.intent = ENEMIES[e.type].moves[e.mv % ENEMIES[e.type].moves.length];
  S.ev.push({ k: "turn" });
}

const dmgTo = (base, atk, tgt) => { let d = base + (atk.str || 0); if (atk.weak > 0) d = d * 0.75; if (tgt.vuln > 0) d = d * 1.5; return Math.max(0, Math.floor(d)); };
export const intentDamage = (S, e) => (e.intent && e.intent.atk ? dmgTo(e.intent.atk, e, S.hero) * (e.intent.hits || 1) : 0);

function hurtEnemy(S, e, amount) {
  const absorbed = Math.min(e.blk, amount); e.blk -= absorbed; const real = amount - absorbed; e.hp -= real;
  S.ev.push({ k: "edmg", id: e.id, i: e.i, amount: real, blocked: absorbed });
  if (e.hp <= 0 && !e.dead) { e.dead = true; e.hp = 0; S.ev.push({ k: "edie", id: e.id, i: e.i }); }
}
function hurtHero(S, amount) {
  const H = S.hero, absorbed = Math.min(H.blk, amount); H.blk -= absorbed; const real = amount - absorbed; H.hp -= real; S.dmgTaken += real;
  S.ev.push({ k: "hdmg", amount: real, blocked: absorbed });
  if (H.hp <= 0) { H.hp = 0; S.phase = "lost"; S.ev.push({ k: "lose" }); }
}

export function canPlay(S, hi) { const id = S.hand[hi]; return S.phase === "player" && id != null && CARDS[id].c <= S.hero.energy; }
export const needsTarget = (S, hi) => { const c = CARDS[S.hand[hi]]; return !c.aoe && c.fx.some((f) => f.dmg != null || f.vuln || f.weak || f.burn) && alive(S).length > 1; };

// play card number hi from the hand; target = index into S.en (a living enemy). Returns false if it cannot be played.
export function playCard(S, hi, target) {
  if (!canPlay(S, hi)) return false;
  const c = CARDS[S.hand[hi]], H = S.hero, live = alive(S);
  let tgt = S.en[target]; if (!tgt || tgt.dead) tgt = live[0]; if (!tgt) return false;
  const id = S.hand.splice(hi, 1)[0]; H.energy -= c.c; S.played++;
  S.ev.push({ k: "play", card: id, target: tgt.i });
  const targets = c.aoe ? live.slice() : [tgt];
  for (const f of c.fx) {
    if (f.dmg != null) for (const t of targets) for (let h = 0; h < (f.hits || 1); h++) if (!t.dead) hurtEnemy(S, t, dmgTo(f.dmg, H, t));
    if (f.blk) { H.blk += f.blk; S.ev.push({ k: "blk", amount: f.blk }); }
    if (f.vuln) for (const t of targets) { t.vuln += f.vuln; S.ev.push({ k: "debuff", i: t.i, what: "vuln" }); }
    if (f.weak) for (const t of targets) { t.weak += f.weak; S.ev.push({ k: "debuff", i: t.i, what: "weak" }); }
    if (f.burn) for (const t of targets) { if (!t.dead) { t.burn += f.burn; S.ev.push({ k: "debuff", i: t.i, what: "burn" }); } }
    if (f.draw) drawCards(S, f.draw);
    if (f.energy) H.energy += f.energy;
    if (f.heal) { H.hp = Math.min(H.max, H.hp + f.heal); S.ev.push({ k: "heal", amount: f.heal }); }
    if (f.str) { H.str += f.str; S.ev.push({ k: "buff", what: "str" }); }
  }
  if (c.ex) S.exh.push(id); else S.disc.push(id);
  if (!alive(S).length && S.phase === "player") { S.phase = "won"; S.ev.push({ k: "win" }); }
  return true;
}

// the enemy phase, one enemy at a time so the game can show each one acting
export function endPlayerTurn(S) {
  if (S.phase !== "player") return false;
  S.disc.push(...S.hand); S.hand = []; S.phase = "enemy"; S.eq = alive(S).map((e) => e.id); S.ev.push({ k: "endturn" }); return true;
}
export function enemyAct(S) {
  // returns the enemy that just acted, or null when everyone has acted (then a new player turn begins)
  while (S.eq && S.eq.length) {
    const e = S.en.find((x) => x.id === S.eq[0]); S.eq.shift(); if (!e || e.dead) continue;
    e.blk = 0; const m = e.intent;
    if (e.burn > 0) { hurtEnemy(S, e, e.burn); e.burn--; if (e.dead) { if (!alive(S).length) { S.phase = "won"; S.ev.push({ k: "win" }); return e; } continue; } }
    S.ev.push({ k: "eact", i: e.i, intent: m });
    if (m.blk) { e.blk += m.blk; }
    if (m.str) { e.str += m.str; }
    if (m.atk) for (let h = 0; h < (m.hits || 1); h++) if (S.phase !== "lost") hurtHero(S, dmgTo(m.atk, e, S.hero));
    if (m.weak) S.hero.weak += m.weak;
    if (m.vuln) S.hero.vuln += m.vuln;
    if (e.vuln > 0) e.vuln--; if (e.weak > 0) e.weak--;
    e.mv++;
    return e;
  }
  if (S.phase === "enemy") {
    const H = S.hero; if (H.weak > 0) H.weak--; if (H.vuln > 0) H.vuln--;
    if (!alive(S).length) { S.phase = "won"; S.ev.push({ k: "win" }); return null; }
    startTurn(S);
  }
  return null;
}

// stars: how much of your health is left
export function stars(S) { if (S.phase !== "won") return 0; const f = S.hero.hp / S.hero.max; return f >= 0.6 ? 3 : f >= 0.3 ? 2 : 1; }
export const scoreOf = (S) => stars(S) * 1000 + S.hero.hp * 20 + Math.max(0, 400 - S.turn * 20);
