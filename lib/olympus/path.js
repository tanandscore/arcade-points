// Finds routes around trees, mines, buildings, lakes and mountains (A* on the tile grid).
export function createPather(N, occ) {
  const size = N * N;
  const g = new Float32Array(size), parent = new Int32Array(size), seen = new Uint32Array(size), closed = new Uint32Array(size);
  const heapIdx = new Int32Array(size * 6), heapF = new Float32Array(size * 6);
  let stamp = 0, hn = 0, expanded = 0;
  const free = (x, z) => x >= 0 && z >= 0 && x < N && z < N && occ[z * N + x] === 0;
  const push = (i, f) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapF[k] = heapF[p]; heapIdx[k] = heapIdx[p]; k = p; } heapF[k] = f; heapIdx[k] = i; };
  const pop = () => {
    const top = heapIdx[0], f = heapF[--hn]; const i = heapIdx[hn]; let k = 0;
    for (;;) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= f) break; heapF[k] = heapF[c]; heapIdx[k] = heapIdx[c]; k = c; }
    heapF[k] = f; heapIdx[k] = i; return top;
  };

  function nearestFree(x, z, maxR = 8) {
    if (free(x, z)) return [x, z];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; if (free(x + dx, z + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [x + dx, z + dz]; } } }
      if (best) return best;
    }
    return null;
  }

  // can a unit of the given radius walk in a straight line between two points?
  function clear(x0, z0, x1, z1, r = 0.3) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 1e-4) return true;
    const nx = -dz / len * r, nz = dx / len * r; const steps = Math.ceil(len / 0.3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = x0 + dx * t, z = z0 + dz * t;
      if (!free(Math.floor(x), Math.floor(z)) || !free(Math.floor(x + nx), Math.floor(z + nz)) || !free(Math.floor(x - nx), Math.floor(z - nz))) return false;
    }
    return true;
  }

  // returns an array of [x,z] world points, or null. opts: {partial, fx, fz, budget}
  function find(sxw, szw, gxw, gzw, opts = {}) {
    let sx = Math.floor(sxw), sz = Math.floor(szw);
    const s0 = nearestFree(sx, sz, 4); if (!s0) return null; [sx, sz] = s0;
    let gx = Math.floor(gxw), gz = Math.floor(gzw);
    gx = Math.max(0, Math.min(N - 1, gx)); gz = Math.max(0, Math.min(N - 1, gz));
    const g0 = nearestFree(gx, gz, opts.partial ? 12 : 6); if (!g0) return null; [gx, gz] = g0;
    if (sx === gx && sz === gz) return [[opts.fx ?? gx + 0.5, opts.fz ?? gz + 0.5]];
    stamp++; hn = 0; expanded = 0;
    const start = sz * N + sx, goal = gz * N + gx;
    g[start] = 0; parent[start] = -1; seen[start] = stamp; push(start, 0);
    let best = start, bestH = Math.hypot(sx - gx, sz - gz);
    const maxExp = opts.budget || 9000;
    let found = false;
    while (hn > 0) {
      const cur = pop(); if (closed[cur] === stamp) continue; closed[cur] = stamp;
      if (cur === goal) { found = true; break; }
      if (++expanded > maxExp) break;
      const cx = cur % N, cz = (cur / N) | 0;
      const h0 = Math.hypot(cx - gx, cz - gz); if (h0 < bestH) { bestH = h0; best = cur; }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue; // no squeezing through corners
        const ni = nz * N + nx; if (closed[ni] === stamp) continue;
        const ng = g[cur] + (dx && dz ? 1.4142 : 1);
        if (seen[ni] !== stamp || ng < g[ni]) {
          seen[ni] = stamp; g[ni] = ng; parent[ni] = cur;
          const ox = Math.abs(nx - gx), oz = Math.abs(nz - gz); push(ni, ng + (ox + oz) + (1.4142 - 2) * Math.min(ox, oz));
        }
      }
    }
    let end = goal;
    if (!found) { if (!opts.partial || best === start) return null; end = best; }
    const pts = []; for (let c = end; c !== -1; c = parent[c]) pts.push([(c % N) + 0.5, ((c / N) | 0) + 0.5]);
    pts.reverse();
    // pull the string tight
    const out = [pts[0]]; let anchor = [sxw, szw]; let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !clear(anchor[0], anchor[1], pts[j][0], pts[j][1])) j--;
      out.push(pts[j]); anchor = pts[j]; i = j;
    }
    out.shift();
    if (found && opts.fx !== undefined && free(Math.floor(opts.fx), Math.floor(opts.fz))) out[out.length - 1] = [opts.fx, opts.fz];
    return out.length ? out : [[opts.fx ?? gx + 0.5, opts.fz ?? gz + 0.5]];
  }
  return { find, clear, free, nearestFree, get expanded() { return expanded; } };
}
