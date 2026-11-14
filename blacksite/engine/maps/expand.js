// Operation Blacksite (Upgrade 119 maps) - grows an existing map definition and adds new outer lanes, tunnels and secret shortcuts to it.
// expand(def, pad, extra): every coordinate of the original map is moved by the padding; `extra` is written in the ORIGINAL map's cell
// coordinates (so new areas outside the old walls simply use negative numbers or numbers past the old edge).
import { CELL } from "../mapkit";

export function expand(def, pad, extra = {}) {
  const l = pad.l || 0, t = pad.t || 0, r = pad.r || 0, b = pad.b || 0;
  const P = ([i, j]) => [i + l, j + t];
  const mz = (z) => ({ ...z, rect: [z.rect[0] + l, z.rect[1] + t, z.rect[2] + l, z.rect[3] + t] });
  const sites = {}; for (const k of Object.keys(def.sites)) sites[k] = { ...def.sites[k], cx: def.sites[k].cx + l, cz: def.sites[k].cz + t };
  const routes = {};
  for (const s of Object.keys(def.routes)) { routes[s] = {}; for (const n of Object.keys(def.routes[s])) routes[s][n] = def.routes[s][n].map(P); }
  for (const s of Object.keys(extra.routes || {})) { routes[s] = routes[s] || {}; for (const n of Object.keys(extra.routes[s])) routes[s][n] = extra.routes[s][n].map(P); }
  const holds = {}; for (const s of Object.keys(def.holds)) holds[s] = def.holds[s].map((h) => ({ p: P(h.p), look: P(h.look) }));
  // new watch spots go in at slot 1 so the computer police actually guard the new ways in (slot 0 stays the old main hold)
  for (const s of Object.keys(extra.holds || {})) { holds[s] = holds[s] || []; holds[s].splice(1, 0, ...extra.holds[s].map((h) => ({ p: P(h.p), look: P(h.look) }))); }
  const entrances = {}; for (const s of Object.keys(def.entrances)) entrances[s] = def.entrances[s].map(P);
  for (const s of Object.keys(extra.entrances || {})) entrances[s] = (entrances[s] || []).concat(extra.entrances[s].map(P));
  const sg = (a) => { const o = a.slice(); o[2] += l * CELL; o[3] += t * CELL; return o; };
  const shiftR = (R) => (kind, x0, z0, x1, z1, h, o) => R(kind, x0 + l, z0 + t, x1 + l, z1 + t, h, o);
  const out = {
    ...def, cols: def.cols + l + r, rows: def.rows + t + b,
    zones: def.zones.map(mz).concat((extra.zones || []).map(mz)), sites,
    props: (R) => { def.props(shiftR(R)); if (extra.props) extra.props(shiftR(R)); },
    tSpawns: def.tSpawns.map(P), pSpawns: def.pSpawns.map(P), routes, holds, entrances,
  };
  if (def.signZones) out.signZones = def.signZones.concat(extra.signZones || []);
  if (def.signs) out.signs = def.signs.map(sg).concat((extra.signs || []).map(sg));
  if (def.hanging) out.hanging = def.hanging.map(P).concat((extra.hanging || []).map(P));
  return out;
}

// ---- helpers used by the per-map extras ------------------------------------------------------------------------------------------------
// Scatter low cover along a straight lane so it is never an empty corridor. Lane runs along x (horizontal) or z (vertical).
export function laneCover(R, x0, z0, x1, z1, seed = 1) {
  const horiz = x1 - x0 > z1 - z0; const len = horiz ? x1 - x0 + 1 : z1 - z0 + 1; const wid = horiz ? z1 - z0 + 1 : x1 - x0 + 1;
  let k = seed;
  for (let s = 3; s < len - 3; s += 4 + (k++ % 3)) {
    const side = (k + s) % 2 ? 0 : wid - 1; const kind = (k + s) % 5;
    const cx = horiz ? x0 + s : x0 + side, cz = horiz ? z0 + side : z0 + s;
    if (kind === 0) R("crate", cx, cz, cx + 1.2, cz + 1.2, 1.3);
    else if (kind === 1) R("barrel", cx + 0.2, cz + 0.2, cx + 0.7, cz + 0.7, 1.1);
    else if (kind === 2) R("barrier", cx, cz, horiz ? cx + 2 : cx + 0.6, horiz ? cz + 0.6 : cz + 2, 1.1);
    else if (kind === 3) R("crate", cx, cz, cx + 1, cz + 1, 2.6);
    else R("pillar", cx, cz, cx + 1, cz + 1, 6.4);
  }
}
