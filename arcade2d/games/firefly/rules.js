// Firefly Jars: the rules and the automatic solver. A jar holds a firefly that is either asleep (dark) or awake (glowing).
// Tapping a jar flips it AND the jars around it (the "pattern" for that level). Wake every firefly to win.
// Map letters:  .  no jar (an empty gap)   o  sleeping firefly   *  awake firefly   x  frozen sleeping jar (cannot be tapped)   X  frozen awake jar
export const PATTERNS = {
  plus: { name: "Plus", short: "the 4 jars next to it", offs: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] },
  cross: { name: "Cross", short: "the 4 jars on its corners", offs: [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
  ring: { name: "Ring", short: "all 8 jars around it", offs: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
  row: { name: "Row", short: "every jar in its row", offs: null },
};

export function parseMap(map) {
  const h = map.length, w = map[0].length, n = w * h, jar = new Uint8Array(n), frozen = new Uint8Array(n), lit = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = map[y][x], i = y * w + x;
    if (c === ".") continue;
    jar[i] = 1; if (c === "x" || c === "X") frozen[i] = 1; if (c === "*" || c === "X") lit[i] = 1;
  }
  return { w, h, jar, frozen, lit, moves: 0 };
}
export const cloneState = (S) => ({ ...S, lit: S.lit.slice() });

// the jars that flip when jar i is tapped (only real jars)
export function affected(pat, w, h, jar, i) {
  const x = i % w, y = (i / w) | 0, out = [], P = PATTERNS[pat];
  if (!P.offs) { for (let xx = 0; xx < w; xx++) { const j = y * w + xx; if (jar[j]) out.push(j); } return out; }
  for (const [dx, dy] of P.offs) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (jar[j]) out.push(j); }
  return out;
}
export function tap(S, pat, i) {
  if (i < 0 || !S.jar[i] || S.frozen[i]) return null;
  const list = affected(pat, S.w, S.h, S.jar, i); for (const j of list) S.lit[j] ^= 1; S.moves++; return list;
}
export const countLit = (S) => { let c = 0; for (let i = 0; i < S.lit.length; i++) if (S.jar[i] && S.lit[i]) c++; return c; };
export const countJars = (S) => { let c = 0; for (let i = 0; i < S.jar.length; i++) if (S.jar[i]) c++; return c; };
export const solved = (S) => countLit(S) === countJars(S);

// Solver: every jar needs an odd or even number of flips. Tapping a jar twice does nothing, so a solution is simply a SET of jars to tap.
// Gaussian elimination over 0/1 gives one solution plus the "free" taps that change nothing; trying all of those finds the fewest taps.
export function solve(map, pat) {
  const S = parseMap(map), { w, h, jar, frozen, lit } = S, n = w * h;
  const vars = []; for (let i = 0; i < n; i++) if (jar[i] && !frozen[i]) vars.push(i);
  const rows = []; // one equation per jar: sum of taps that hit it = 1 - lit
  for (let j = 0; j < n; j++) if (jar[j]) rows.push({ mask: 0n, rhs: lit[j] ? 0 : 1 });
  const rowOf = new Map(); let r = 0; for (let j = 0; j < n; j++) if (jar[j]) rowOf.set(j, r++);
  vars.forEach((v, k) => { for (const j of affected(pat, w, h, jar, v)) rows[rowOf.get(j)].mask |= 1n << BigInt(k); });
  const nv = vars.length, piv = []; let rr = 0;
  for (let c = 0; c < nv && rr < rows.length; c++) {
    let p = -1; for (let k = rr; k < rows.length; k++) if ((rows[k].mask >> BigInt(c)) & 1n) { p = k; break; } if (p < 0) continue;
    [rows[rr], rows[p]] = [rows[p], rows[rr]];
    for (let k = 0; k < rows.length; k++) if (k !== rr && ((rows[k].mask >> BigInt(c)) & 1n)) { rows[k].mask ^= rows[rr].mask; rows[k].rhs ^= rows[rr].rhs; }
    piv.push(c); rr++;
  }
  for (let k = rr; k < rows.length; k++) if (rows[k].rhs) return null; // unsolvable
  const free = []; for (let c = 0; c < nv; c++) if (!piv.includes(c)) free.push(c);
  if (free.length > 18) return null;
  let best = null;
  for (let m = 0; m < (1 << free.length); m++) {
    const x = new Array(nv).fill(0); free.forEach((c, k) => { x[c] = (m >> k) & 1; });
    for (let k = rr - 1; k >= 0; k--) { let v = rows[k].rhs; for (const c of free) if ((rows[k].mask >> BigInt(c)) & 1n) v ^= x[c]; x[piv[k]] = v; }
    let wgt = 0; for (const v of x) wgt += v; if (!best || wgt < best.n) best = { n: wgt, x: x.slice() };
  }
  return { par: best.n, taps: vars.filter((v, k) => best.x[k]) };
}
