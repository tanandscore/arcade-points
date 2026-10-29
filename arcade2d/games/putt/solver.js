// Putt Planet: the automatic golfer. It tries lots of angles and powers, looks at where the ball ends up, and keeps going from those spots until a shot drops in.
// The first stroke count that works is the hole's par. It also proves every hole can be finished and plays behind the title screen.
import { makeCourse, simulate } from "./physics";

export function solve(lv, { angleStep = 3, powers = [0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92, 1], maxStrokes = 6, cell = 22, clockSteps = 6 } = {}) {
  const C = makeCourse(lv), blades = C.blades;
  let clocks = [0];
  if (blades.length) { const P = (2 * Math.PI) / Math.max(0.2, Math.min(...blades.map((b) => Math.abs(b.speed)))); clocks = Array.from({ length: clockSteps }, (_, i) => +(P * i / clockSteps).toFixed(3)); }
  let frontier = [{ x: lv.tee[0], y: lv.tee[1], shots: [] }]; const seen = new Set([Math.round(lv.tee[0] / cell) + "," + Math.round(lv.tee[1] / cell)]);
  for (let s = 1; s <= maxStrokes; s++) {
    const next = [];
    for (const n of frontier) for (const t0 of clocks) for (let a = 0; a < 360; a += angleStep) for (const p of powers) {
      const rad = (a * Math.PI) / 180, r = simulate(C, n.x, n.y, rad, p, t0);
      if (r.state === "cup") return { par: s, sol: [...n.shots, [a, p, t0]] };
      if (r.state === "stopped") { const k = Math.round(r.x / cell) + "," + Math.round(r.y / cell); if (!seen.has(k)) { seen.add(k); next.push({ x: r.x, y: r.y, shots: [...n.shots, [a, p, t0]] }); } }
    }
    frontier = next; if (!frontier.length) break;
  }
  return null;
}

// replay a recorded answer from the tee (used by the tests): shots are [angle in degrees, power, clock offset]
export function replay(lv, shots) {
  const C = makeCourse(lv); let x = lv.tee[0], y = lv.tee[1];
  for (const [a, p, t0] of shots) { const r = simulate(C, x, y, (a * Math.PI) / 180, p, t0); if (r.state === "cup") return { ok: true, strokes: shots.indexOf([a, p, t0]) + 1 }; if (r.state === "water") continue; x = r.x; y = r.y; }
  return { ok: false };
}
