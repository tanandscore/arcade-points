// Lumen Trail — the turn-based battle rules (no drawing here). Break the shields, spend boost points, outlast the telegraphed attacks.
import { HEROES, SKILLS, ITEMS, ENEMIES, ENEMY_ACTS, statsAt } from "./data";
import { clamp, rng } from "../../core/util";

export const makeHero = (id, lvl, unlockCh) => {
  const H = HEROES[id], st = statsAt(H, lvl);
  return { kind: "hero", id, def: H, name: H.name, ...st, maxhp: st.hp, maxsp: st.sp, hp: st.hp, sp: st.sp, bp: 1, ko: false, buffs: {}, poison: 0, guard: false, skills: H.skills.filter((s) => SKILLS[s].unlock <= unlockCh), lvl };
};
export const makeFoe = (id, i, rnd) => {
  const D = ENEMIES[id];
  return { kind: "foe", id, def: D, name: D.name, hp: D.hp, maxhp: D.hp, atk: D.atk, mag: D.mag || D.atk, def_: D.def, spd: D.spd, shield: D.shield, maxShield: D.shield, broken: 0, known: new Set(), buffs: {}, poison: 0, ko: false, slot: i, chargeLeft: D.charge ? D.charge.every : 0, acts: D.acts, phase: 1, boss: !!D.boss };
};
const stat = (u, k) => (u[k] ?? 0) * (1 + (u.buffs[k] ? u.buffs[k].amt : 0));

export class Battle {
  constructor(party, foeIds, inv, seed = 1) {
    this.r = rng(seed * 13 + 3); this.heroes = party; this.foes = foeIds.map((id, i) => makeFoe(id, i, this.r)); this.inv = inv; this.log = []; this.clock = 0; this.turns = 0; this.breaks = 0; this.kills = 0; this.dmgDone = 0;
    for (const u of [...this.heroes, ...this.foes]) u.t = 40 / Math.max(1, u.spd) * (0.6 + this.r() * 0.6);
    this.cur = null; this.over = null;
  }
  alive(side) { return (side === "hero" ? this.heroes : this.foes).filter((u) => !u.ko); }
  order(n = 9) { // simulate the next n actors
    const sim = [...this.heroes, ...this.foes].filter((u) => !u.ko).map((u) => ({ u, t: u.t, broken: u.broken })); const out = [];
    for (let i = 0; i < n; i++) { sim.sort((a, b) => a.t - b.t); const s = sim[0]; out.push(s.u); s.t += 100 / Math.max(1, s.u.spd) * (s.broken > 0 ? 1.4 : 1); if (s.broken > 0) s.broken--; }
    return out;
  }
  nextActor() {
    const all = [...this.heroes, ...this.foes].filter((u) => !u.ko); all.sort((a, b) => a.t - b.t); const u = all[0]; this.cur = u; u.t += 100 / Math.max(1, u.spd);
    if (u.kind === "hero") { u.bp = Math.min(5, u.bp + 1); u.guard = false; }
    return u;
  }
  tickBuffs(u) { for (const k of Object.keys(u.buffs)) { u.buffs[k].t--; if (u.buffs[k].t <= 0) delete u.buffs[k]; } }
  // ---- damage ----
  hitFoe(hero, foe, { type, pow, mag, pierce, boost = 0, crit = 0.06 }) {
    const atk = mag ? stat(hero, "mag") : stat(hero, "atk"), weak = foe.def.weak.includes(type);
    let d = atk * pow * (0.92 + this.r() * 0.16) * 1.6 - foe.def_ * (pierce ? 0.15 : 0.55);
    if (weak) d *= 1.3; if (foe.broken > 0) d *= 1.5; const isCrit = this.r() < crit; if (isCrit) d *= 1.5; d = Math.max(3, Math.round(d));
    foe.hp = Math.max(0, foe.hp - d); this.dmgDone += d; let broke = false;
    if (weak) { foe.known.add(type); if (foe.shield > 0 && foe.broken <= 0) { foe.shield--; if (foe.shield <= 0) { foe.broken = 2; broke = true; this.breaks++; foe.chargeLeft = foe.def.charge ? foe.def.charge.every + 1 : 0; } } }
    if (foe.hp <= 0) { foe.ko = true; this.kills++; }
    return { d, weak, broke, crit: isCrit, ko: foe.ko };
  }
  hitHero(foe, hero, pow, mag) {
    const a = mag ? stat(foe, "mag") : stat(foe, "atk"); let d = a * pow * (0.9 + this.r() * 0.2) * 1.5 - stat(hero, "def") * 0.5; if (hero.guard) d *= 0.5; d = Math.max(2, Math.round(d));
    hero.hp = Math.max(0, hero.hp - d); if (hero.hp <= 0) { hero.ko = true; hero.bp = 0; } return { d, ko: hero.ko };
  }
  // enemy decides what to do. returns { act, name, pow, mag, elem, all, targets:[], charge?:bool, text }
  foePlan(foe) {
    const D = foe.def, heroes = this.alive("hero"); if (!heroes.length) return null;
    if (foe.broken > 0) return { skip: true };
    if (D.charge) { if (foe.chargeLeft <= 0) { foe.chargeLeft = D.charge.every; return { name: D.charge.name, pow: D.charge.dmg, mag: true, all: true, targets: heroes, big: true }; } foe.chargeLeft--; }
    const key = foe.acts[Math.floor(this.r() * foe.acts.length)], A = ENEMY_ACTS[key] || ENEMY_ACTS.attack;
    const tgt = heroes[Math.floor(this.r() * heroes.length)];
    if (key === "howl") return { name: A.name, buff: true, targets: [] };
    if (key === "sleepy") return { name: A.name, pow: A.pow, all: true, targets: heroes };
    return { name: A.name, pow: A.pow ?? 1, mag: !!A.mag, elem: A.elem, poison: !!A.poison, drain: !!A.drain, targets: A.all ? heroes : [tgt], steal: key === "stealgold" };
  }
}
