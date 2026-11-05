// Snip & Drop: the automatic player. It tries every sensible order and moment for cutting the ropes and popping the bubbles (a few tenths of a second apart),
// and keeps the best result: fed with the most stars. It proves every level can be finished with all three stars and plays behind the title screen.
import { makeSim, step, cutRope, popBubble, DT } from "./physics";

export function copySim(S) {
  return {
    lv: S.lv, t: S.t, state: S.state, got: S.got, events: [],
    ropes: S.ropes.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n })) })), berry: { ...S.berry },
    stars: S.stars.map((s) => ({ ...s })), bubbles: S.bubbles.map((b) => ({ ...b })),
  };
}
const settled = (S) => S.t > 2 && Math.abs(S.berry.x - S.berry.px) + Math.abs(S.berry.y - S.berry.py) < 1e-4 && S.berry.bubble < 0;
function finish(S, maxT) { while (S.state === "play" && S.t < maxT) { step(S); if (settled(S)) break; } return S; }

export function solve(lv, { dt = 0.2, tmax = 3.4, maxEvents = 4, maxT = 12, want = 3, budget = 60000 } = {}) {
  const nR = lv.ropes.length, nB = (lv.bubbles || []).length, acts = []; for (let i = 0; i < nR; i++) acts.push({ cut: i }); for (let i = 0; i < nB; i++) acts.push({ pop: i });
  let best = null, sims = 0;
  const score = (S) => (S.state === "fed" ? 10 + S.got : 0);
  const rec = (S, done, used, last) => {
    if (sims++ > budget) return;
    const L = finish(copySim(S), maxT), sc = score(L);
    if (sc > 0 && (!best || sc > best.sc || (sc === best.sc && done.length < best.acts.length))) best = { sc, acts: done.slice(), stars: L.got, t: L.t };
    if (best && best.stars >= want && best.sc >= 10 + want) return;
    if (done.length >= maxEvents) return;
    const W = copySim(S); let t = last;
    for (let k = 0; t <= tmax && W.state === "play"; k++) {
      for (let a = 0; a < acts.length; a++) {
        if (used & (1 << a)) continue;
        const X = copySim(W); if (acts[a].cut != null) cutRope(X, acts[a].cut); else popBubble(X, acts[a].pop);
        done.push({ t: +t.toFixed(3), ...acts[a] }); rec(X, done, used | (1 << a), t); done.pop();
        if (best && best.stars >= want && best.sc >= 10 + want) return;
      }
      for (let i = 0; i < Math.round(dt / DT) && W.state === "play"; i++) step(W);
      t = W.t;
    }
  };
  rec(makeSim(lv), [], 0, 0);
  return best ? { actions: best.acts, stars: best.stars, time: best.t, sims } : null;
}
