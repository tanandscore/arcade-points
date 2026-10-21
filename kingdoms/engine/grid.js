// The slightly wonky grid the town is built on. Every cell is a four-cornered patch of sea;
// jittered corners are what give the town its hand-made, organic look.
export const N = 40;          // cells across
export const S = 2.2;         // cell size
export const RADIUS = 16.5;   // how far from the middle you may build, in cells
export const H = 1.75;        // height of one floor
export const BASE = 0.45;     // how far the stone base rises above the water
export const MAXK = 8;        // tallest tower, in floors

export function hash(a, b, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const key = (i, j, k) => i * 1024 + j * 16 + k;
export const unkey = (q) => [Math.floor(q / 1024), Math.floor((q % 1024) / 16), q % 16];

const V = [];
for (let i = 0; i <= N; i++) {
  for (let j = 0; j <= N; j++) {
    const edge = i === 0 || j === 0 || i === N || j === N;
    const a = edge ? 0 : 0.27 * S;
    V.push([(i - N / 2) * S + (hash(i, j, 1) - 0.5) * 2 * a, (j - N / 2) * S + (hash(i, j, 2) - 0.5) * 2 * a]);
  }
}
const vert = (i, j) => V[i * (N + 1) + j];

// corners in order: (i,j) (i+1,j) (i+1,j+1) (i,j+1)
export function cellCorners(i, j) { return [vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)]; }
export function cellCenter(i, j) {
  const c = cellCorners(i, j); return [(c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4];
}
export function inRadius(i, j) {
  const di = i + 0.5 - N / 2, dj = j + 0.5 - N / 2; return di * di + dj * dj <= RADIUS * RADIUS && i >= 0 && j >= 0 && i < N && j < N;
}
function inQuad(px, pz, c) {
  let sign = 0;
  for (let e = 0; e < 4; e++) {
    const a = c[e], b = c[(e + 1) % 4];
    const cr = (b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
    const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
export function cellAt(x, z) {
  const i0 = Math.floor(x / S + N / 2), j0 = Math.floor(z / S + N / 2);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
    if (inQuad(x, z, cellCorners(i, j))) return [i, j];
  }
  return null;
}
