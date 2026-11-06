// Starline Vanguard: 4 sectors, 20 stages. Each stage is a fixed timetable of enemy formations (made once from a seed, so every pilot faces the same fleet).
// The fifth stage of every sector ends with a boss. The automatic pilot in bot.js has cleared every stage.
import { rng } from "../../core/util";
import { TOP, BOT } from "./sim";

const MID = (TOP + BOT) / 2;
// spec: seed, dur (seconds of enemy arrivals), gap (seconds between formations), dif (0..1: how many bullets), pool [formation names], boss (type), elite (seconds at which a mid-boss appears)
function makeScript(sp) {
  const R = rng(sp.seed), out = []; let t = 2.5, n = 0; const drops = ["P", "S", "P", "N", "P", "S", "P", "N"]; let di = 0;
  const yy = (lo = TOP + 40, hi = BOT - 40) => Math.round(R.range(lo, hi));
  while (t < sp.dur) {
    const f = R.pick(sp.pool), carry = n % 3 === 1; n++;
    const mark = (e) => { if (carry && !e[3].drop) e[3].drop = drops[di++ % drops.length]; };
    if (f === "line") { const y = yy(), k = 5 + R.int(0, 2); for (let i = 0; i < k; i++) { const e = [+(t + i * 0.38).toFixed(2), "drone", y, { amp: 55, ph: 0 }]; if (i === 2) mark(e); out.push(e); } }
    else if (f === "wave") { const y = yy(TOP + 110, BOT - 110), k = 6; for (let i = 0; i < k; i++) { const e = [+(t + i * 0.4).toFixed(2), "drone", y, { amp: 90, ph: i * 0.5 }]; if (i === 3) mark(e); out.push(e); } }
    else if (f === "vee") { const y = yy(TOP + 100, BOT - 100); for (const [dt, dy] of [[0, 0], [0.45, -60], [0.45, 60], [0.9, -120], [0.9, 120]]) { const e = [+(t + dt).toFixed(2), "swooper", Math.max(TOP + 20, Math.min(BOT - 20, y + dy)), {}]; if (dt === 0) mark(e); out.push(e); } }
    else if (f === "gunners") { const a = yy(TOP + 50, MID - 40), b = yy(MID + 40, BOT - 50); const e1 = [+t.toFixed(2), "gunner", a, {}]; mark(e1); out.push(e1, [+(t + 0.8).toFixed(2), "gunner", b, {}]); }
    else if (f === "rocks") { const k = 3 + R.int(0, 2); for (let i = 0; i < k; i++) { const e = [+(t + i * 0.9).toFixed(2), "rock", yy(TOP + 40, BOT - 40), {}]; if (i === 1) mark(e); out.push(e); } }
    else if (f === "pair") { const y = yy(TOP + 60, BOT - 60); for (let i = 0; i < 4; i++) out.push([+(t + i * 0.5).toFixed(2), i % 2 ? "swooper" : "drone", Math.max(TOP + 20, Math.min(BOT - 20, y + (i % 2 ? 70 : -70))), { amp: 40, ph: i }]); mark(out[out.length - 1]); }
    t += sp.gap * R.range(0.8, 1.25);
  }
  if (sp.elite) out.push([+sp.elite.toFixed(2), "elite", MID, { drop: "P" }]);
  if (sp.boss) out.push([+(sp.dur + 6).toFixed(2), sp.boss, MID, {}]);
  out.sort((a, b) => a[0] - b[0]); return out;
}
const DIFK = [0, 0.25, 0.45, 0.62], GAPK = [1, 0.85, 0.72, 0.6];   // later sectors: faster, denser fire and fleets that arrive closer together
const lvl = (id, name, o0) => { const w = +id[0] - 1, o = { ...o0, dif: Math.min(1.3, o0.dif + DIFK[w]), gap: o0.gap * GAPK[w] }; return { id, name, hint: o.hint, seed: o.seed, dif: o.dif, boss: !!o.boss, elite: !!o.elite, script: makeScript(o) }; };

export const WORLDS = [
  { name: "Outer Belt", short: "Belt", theme: "space", music: "space", blurb: "Your first sorties through an asteroid belt full of drones.",
    levels: [
      lvl("1-1", "First Sortie", { seed: 101, dur: 45, gap: 4.6, dif: 0.1, pool: ["line", "wave"], hint: "Your ship fires on its own. Steer with the arrow keys or WASD, grab the P power-ups and dodge the bullets." }),
      lvl("1-2", "Rock Garden", { seed: 102, dur: 55, gap: 4.0, dif: 0.2, pool: ["line", "wave", "rocks"], hint: "Space drops a Nova bomb: it clears every bullet and hurts everything on screen. Pick up N for more." }),
      lvl("1-3", "Swarm Lane", { seed: 103, dur: 60, gap: 3.6, dif: 0.3, pool: ["line", "wave", "vee", "rocks"] }),
      lvl("1-4", "Gunship Alley", { seed: 104, dur: 65, gap: 3.5, dif: 0.4, pool: ["line", "vee", "gunners", "rocks", "pair"], elite: 56 }),
      lvl("1-5", "The Warden", { seed: 105, dur: 52, gap: 3.5, dif: 0.45, pool: ["line", "wave", "vee", "gunners", "pair"], boss: "boss1", hint: "Boss ahead. Stay near the middle and slip between its rings." }),
    ] },
  { name: "Crystal Nebula", short: "Nebula", theme: "space", music: "sky", blurb: "Glittering gas clouds hide gunships. Shoot, weave and survive.",
    levels: [
      lvl("2-1", "Glitter Run", { seed: 201, dur: 55, gap: 3.4, dif: 0.45, pool: ["line", "wave", "vee", "pair"] }),
      lvl("2-2", "Prism Pass", { seed: 202, dur: 60, gap: 3.3, dif: 0.5, pool: ["wave", "vee", "gunners", "rocks", "pair"] }),
      lvl("2-3", "Static Storm", { seed: 203, dur: 65, gap: 3.1, dif: 0.55, pool: ["line", "vee", "gunners", "rocks", "pair"], elite: 58 }),
      lvl("2-4", "Crossfire", { seed: 204, dur: 70, gap: 3.0, dif: 0.6, pool: ["wave", "vee", "gunners", "gunners", "pair"], elite: 62 }),
      lvl("2-5", "The Prism", { seed: 205, dur: 56, gap: 3.1, dif: 0.6, pool: ["line", "vee", "gunners", "pair"], boss: "boss2" }),
    ] },
  { name: "Ruined Station", short: "Station", theme: "space", music: "tense", blurb: "A wrecked space station, still guarded by its old defences.",
    levels: [
      lvl("3-1", "Docking Ring", { seed: 301, dur: 60, gap: 3.0, dif: 0.6, pool: ["line", "vee", "gunners", "rocks", "pair"] }),
      lvl("3-2", "Debris Field", { seed: 302, dur: 65, gap: 2.9, dif: 0.65, pool: ["wave", "vee", "gunners", "rocks", "rocks"] }),
      lvl("3-3", "Reactor Hall", { seed: 303, dur: 70, gap: 2.8, dif: 0.7, pool: ["line", "vee", "gunners", "pair", "rocks"], elite: 60 }),
      lvl("3-4", "Broken Spine", { seed: 304, dur: 75, gap: 2.7, dif: 0.75, pool: ["wave", "vee", "gunners", "pair", "rocks"], elite: 66 }),
      lvl("3-5", "The Bulwark", { seed: 305, dur: 58, gap: 2.8, dif: 0.7, pool: ["line", "vee", "gunners", "pair"], boss: "boss3" }),
    ] },
  { name: "Void Gate", short: "Gate", theme: "space", music: "boss", blurb: "The last gate. Everything the fleet has is waiting on the other side.",
    levels: [
      lvl("4-1", "Event Horizon", { seed: 401, dur: 65, gap: 2.7, dif: 0.75, pool: ["line", "wave", "vee", "gunners", "pair"] }),
      lvl("4-2", "Long Dark", { seed: 402, dur: 70, gap: 2.6, dif: 0.8, pool: ["wave", "vee", "gunners", "gunners", "rocks", "pair"] }),
      lvl("4-3", "Mirror Fleet", { seed: 403, dur: 75, gap: 2.5, dif: 0.85, pool: ["line", "vee", "gunners", "pair", "rocks"], elite: 64 }),
      lvl("4-4", "Last Wall", { seed: 404, dur: 78, gap: 2.4, dif: 0.9, pool: ["wave", "vee", "gunners", "gunners", "pair"], elite: 70 }),
      lvl("4-5", "The Gate Eye", { seed: 405, dur: 60, gap: 2.5, dif: 0.85, pool: ["line", "wave", "vee", "gunners", "pair"], boss: "boss4" }),
    ] },
];
export const FLAT = []; WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => FLAT.push({ ...l, wi, li })));
export const describeLevel = (l) => `${l.script.length} ships${l.boss ? " · boss" : l.elite ? " · mid-boss" : ""}`;
