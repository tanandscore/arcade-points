// Midnight Burn — the map picture: land, sea and every road, drawn once, then used by the minimap and the full map.
import { W, G as GN, CELL, land, DISTRICTS, AIRPORTS } from "./geo";

export const MAP_PX = 3072;
export const MAP_S = MAP_PX / W; // pixels per metre

export function buildBaseMap(city) {
  const c = document.createElement("canvas"); c.width = c.height = MAP_PX; const g = c.getContext("2d");
  g.fillStyle = "#07121d"; g.fillRect(0, 0, MAP_PX, MAP_PX);
  g.fillStyle = "#16222e"; const cs = CELL * MAP_S;
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) if (land[j * GN + i]) g.fillRect(i * cs - 0.2, j * cs - 0.2, cs + 0.4, cs + 0.4);
  // green belts
  for (const d of DISTRICTS) if (d.style === "forest") { const gr = g.createRadialGradient(d.x * MAP_S, d.z * MAP_S, 0, d.x * MAP_S, d.z * MAP_S, d.r * MAP_S); gr.addColorStop(0, "rgba(34,86,52,0.55)"); gr.addColorStop(1, "rgba(34,86,52,0)"); g.save(); g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect((d.x - d.r) * MAP_S, (d.z - d.r) * MAP_S, d.r * 2 * MAP_S, d.r * 2 * MAP_S); g.restore(); }
  g.lineCap = "round"; g.lineJoin = "round";
  const draw = (cls, w, col, elev) => {
    g.strokeStyle = col; g.lineWidth = w;
    for (const r of city.roads) { if (r.cls !== cls) continue; g.beginPath(); r.pts.forEach((p, k) => { const x = p.x * MAP_S, y = p.z * MAP_S; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke(); }
  };
  draw("str", 1.5, "#3b4a5c"); draw("art", 2.8, "#7d8aa3");
  draw("hwy", 5.2, "#14100a"); draw("hwy", 3.4, "#e0b445");
  for (const L of city.metro || []) { g.strokeStyle = "#" + L.color.toString(16).padStart(6, "0"); g.lineWidth = 3.2; g.beginPath(); L.pts.forEach((p, k) => { const x = p.x * MAP_S, y = p.z * MAP_S; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke(); g.fillStyle = "#fff"; for (const st of L.stations) { g.beginPath(); g.arc(st.x * MAP_S, st.z * MAP_S, 3.2, 0, 7); g.fill(); } }
  for (const L of city.metro || []) { const col = "#" + L.color.toString(16).padStart(6, "0"); for (const st of L.stations) { g.beginPath(); g.arc(st.x * MAP_S, st.z * MAP_S, 4.2, 0, 7); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 2; g.strokeStyle = col; g.stroke(); } }
  // airports: runways and terminals
  for (const a of AIRPORTS) { g.save(); g.translate(a.x * MAP_S, a.z * MAP_S); g.rotate(a.rot); g.fillStyle = "#2a3646"; g.fillRect(-a.rx * MAP_S * 0.9, -a.rz * MAP_S * 0.9, a.rx * 1.8 * MAP_S, a.rz * 1.8 * MAP_S); g.strokeStyle = "#cfd8e6"; g.lineWidth = 3.2; for (const r of a.runways) { g.save(); g.translate(r.x * MAP_S, r.z * MAP_S); g.rotate(r.ang); g.beginPath(); g.moveTo(-r.len / 2 * MAP_S, 0); g.lineTo(r.len / 2 * MAP_S, 0); g.stroke(); g.restore(); } g.fillStyle = "#ffb703"; g.fillRect((a.terminal.x - a.terminal.len / 2) * MAP_S, (a.terminal.z - 20) * MAP_S, a.terminal.len * MAP_S, 40 * MAP_S); g.restore(); g.fillStyle = "#cfe8ff"; g.font = "bold 18px Arial"; g.textAlign = "center"; g.fillText("✈ " + (a.id === "csmia" ? "MUMBAI AIRPORT" : "NAVI MUMBAI AIRPORT"), a.x * MAP_S, (a.z - a.rz - 40) * MAP_S); }
  g.setLineDash([6, 5]); g.strokeStyle = "#ffb44a"; g.lineWidth = 3; for (const r of city.roads) if (r.hasTunnel) { g.beginPath(); for (let k = r.tunFrom; k <= r.tunTo; k++) { const p = r.pts[k], x = p.x * MAP_S, y = p.z * MAP_S; if (k === r.tunFrom) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); } g.setLineDash([]);
  g.font = "bold 15px Arial"; g.textAlign = "center"; g.fillStyle = "rgba(190,205,230,0.55)";
  for (const d of DISTRICTS) { if (d.r < 300) continue; g.fillText(d.name.toUpperCase(), d.x * MAP_S, d.z * MAP_S); }
  return c;
}

// minimap: rotates with the car, 'range' metres from the centre to the edge
export function drawMinimap(ctx, size, base, G, range = 520) {
  const P = G.player, half = size / 2, sc = (half / range) / MAP_S;
  ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(half, half, half - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#07121d"; ctx.fillRect(0, 0, size, size);
  ctx.translate(half, half); ctx.rotate(-Math.PI / 2 - P.yaw); const m = half / range; // metres → px
  ctx.save(); ctx.scale(sc, sc); ctx.drawImage(base, -P.x * MAP_S, -P.z * MAP_S); ctx.restore();
  const X = (x) => (x - P.x) * m, Z = (z) => (z - P.z) * m;
  // route / GPS
  const line = G.run && G.run.route && G.run.kind !== "drift" ? G.run.route.pts : G.nav && G.nav.line;
  if (line && line.length > 1) {
    ctx.strokeStyle = "#2de2ff"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath(); let first = true;
    for (let i = 0; i < line.length; i += line.length > 800 ? 3 : 1) { const q = line[i]; if (Math.abs(q.x - P.x) > range * 1.5 || Math.abs(q.z - P.z) > range * 1.5) { first = true; continue; } if (first) { ctx.moveTo(X(q.x), Z(q.z)); first = false; } else ctx.lineTo(X(q.x), Z(q.z)); }
    ctx.stroke();
  }
  const dot = (x, z, col, r = 3.5) => { const px = X(x), pz = Z(z); if (px * px + pz * pz > (half * 1.3) ** 2) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, pz, r, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1; ctx.stroke(); };
  if (!G.run) {
    for (const ev of G.events) { if (ev.type === "trap") continue; const done = G.career.done[ev.id]; dot(ev.sx, ev.sz, !G.isUnlocked(ev) ? "#7a3030" : done ? "#6bff9a" : "#ffffff", 3.2); }
    for (const sh of G.content.shops) dot(sh.x, sh.z, "#ffb703", 5);
  } else if (G.run.route) { const L = G.run.route.pts, gi = G.run.route.gates; const gidx = Math.min(gi.length - 1, G.run.gate); dot(L[gi[gidx]].x, L[gi[gidx]].z, "#ffffff", 4); if (gidx < gi.length - 1) dot(L[L.length - 1].x, L[L.length - 1].z, "#ffd23a", 4.5); G.run.racers && G.run.racers.forEach((r) => { if (!r.out) dot(r.v.x, r.v.z, r.color, 4); }); }
  if (G.nav && G.nav.target && !G.run) dot(G.nav.target.x, G.nav.target.z, "#2de2ff", 6);
  ctx.restore();
  // the car: always pointing up
  ctx.save(); ctx.translate(half, half); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = "rgba(160,190,230,0.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(half, half, half - 2, 0, Math.PI * 2); ctx.stroke();
}

// =====================================================================================================================================================
// Upgrade 25 — the GPS minimap, made bigger, brighter and easier to follow.
//  - the roads are drawn as crisp vectors (not stretched from the big picture) onto a tile that is only redrawn when the car has driven a little way,
//    so the map turns smoothly every frame for almost no cost
//  - the route has a dark outline, a bright core and little white pulses that run in the direction you must drive
//  - the next turn (left / right / U-turn and how far) is worked out from the route and shown by the HUD; so are wrong-way and distance to checkpoint
//  - the zoom follows the speed (close when slow, wide when fast) and the player can pin it (Z)
// =====================================================================================================================================================
const TAU = Math.PI * 2;
let _landMap = null;
function landMap() { // sea, land, green belts and airports only (no roads: those are drawn as vectors)
  if (_landMap) return _landMap; const PX = 2048, S = PX / W; const c = document.createElement("canvas"); c.width = c.height = PX; const g = c.getContext("2d");
  g.fillStyle = "#0b1b2b"; g.fillRect(0, 0, PX, PX); g.fillStyle = "#1d2c3b"; const cs = CELL * S; for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) if (land[j * GN + i]) g.fillRect(i * cs - 0.3, j * cs - 0.3, cs + 0.6, cs + 0.6);
  for (const d of DISTRICTS) if (d.style === "forest") { const gr = g.createRadialGradient(d.x * S, d.z * S, 0, d.x * S, d.z * S, d.r * S); gr.addColorStop(0, "rgba(40,110,64,0.6)"); gr.addColorStop(1, "rgba(40,110,64,0)"); g.save(); g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect((d.x - d.r) * S, (d.z - d.r) * S, d.r * 2 * S, d.r * 2 * S); g.restore(); }
  for (const a of AIRPORTS) { g.save(); g.translate(a.x * S, a.z * S); g.rotate(a.rot); g.fillStyle = "#33465a"; g.fillRect(-a.rx * S * 0.9, -a.rz * S * 0.9, a.rx * 1.8 * S, a.rz * 1.8 * S); g.strokeStyle = "#e4ecf8"; g.lineWidth = 2.2; for (const r of a.runways) { g.save(); g.translate(r.x * S, r.z * S); g.rotate(r.ang); g.beginPath(); g.moveTo(-r.len / 2 * S, 0); g.lineTo(r.len / 2 * S, 0); g.stroke(); g.restore(); } g.restore(); }
  _landMap = { c, S }; return _landMap;
}

const RANGES = { close: 300, mid: 520, wide: 880 };
export function createMiniMap(city) {
  const tile = document.createElement("canvas"); const tg = tile.getContext("2d");
  const T = { cx: 1e9, cz: 1e9, K: 0, ppm: 0, R: 0 };
  let mode = "auto"; try { const m = localStorage.getItem("mb-mapzoom"); if (m === "close" || m === "mid" || m === "wide") mode = m; } catch {}
  let range = 520, dwell = 0, navIdx = 0, navLine = null, clock = 0;
  const segSeen = new Set();

  // ---- the road tile ----
  function paintTile(P, R, ppmView) {
    const K = R * 1.6, ppm = Math.min(ppmView, 1400 / (2 * K)), tpx = Math.max(64, Math.ceil(2 * K * ppm)); T.cx = P.x; T.cz = P.z; T.K = K; T.ppm = ppm; T.R = R;
    if (tile.width !== tpx) { tile.width = tile.height = tpx; } else tg.clearRect(0, 0, tpx, tpx);
    const lm = landMap(); tg.fillStyle = "#0b1b2b"; tg.fillRect(0, 0, tpx, tpx);
    const sx = (P.x - K) * lm.S, sy = (P.z - K) * lm.S, sw = 2 * K * lm.S; tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = "high";
    { const ix0 = Math.max(0, sx), iy0 = Math.max(0, sy), ix1 = Math.min(lm.c.width, sx + sw), iy1 = Math.min(lm.c.height, sy + sw); if (ix1 > ix0 && iy1 > iy0) tg.drawImage(lm.c, ix0, iy0, ix1 - ix0, iy1 - iy0, (ix0 - sx) / sw * tpx, (iy0 - sy) / sw * tpx, (ix1 - ix0) / sw * tpx, (iy1 - iy0) / sw * tpx); }
    const X = (x) => (x - (P.x - K)) * ppm, Z = (z) => (z - (P.z - K)) * ppm;
    const lists = { str: [], art: [], hwy: [], up: [], tun: [] }; segSeen.clear();
    city.nearSegs(P.x, P.z, K * 1.45 + 40, (r, i) => {
      const key = r.idx * 65536 + i; if (segSeen.has(key)) return; segSeen.add(key); const a = r.pts[i], b = r.pts[i + 1]; if (!b) return;
      if (Math.max(a.x, b.x) < P.x - K - 20 || Math.min(a.x, b.x) > P.x + K + 20 || Math.max(a.z, b.z) < P.z - K - 20 || Math.min(a.z, b.z) > P.z + K + 20) return;
      const s = [X(a.x), Z(a.z), X(b.x), Z(b.z)];
      if (a.tun) lists.tun.push(s); else if (a.y - a.g > 3.2 || a.over) lists.up.push([...s, r.cls]); else lists[r.cls === "hwy" ? "hwy" : r.cls === "art" ? "art" : "str"].push(s);
    });
    const k = Math.max(0.8, tpx / 900); // line widths scale with how sharp the tile is
    tg.lineCap = "round"; tg.lineJoin = "round";
    const stroke = (arr, w, col) => { if (!arr.length) return; tg.strokeStyle = col; tg.lineWidth = w; tg.beginPath(); for (const s of arr) { tg.moveTo(s[0], s[1]); tg.lineTo(s[2], s[3]); } tg.stroke(); };
    const W_ = { str: 4.2 * k, art: 6.4 * k, hwy: 8.6 * k };
    stroke(lists.str, W_.str + 2.4 * k, "#050a12"); stroke(lists.art, W_.art + 2.6 * k, "#050a12"); stroke(lists.hwy, W_.hwy + 2.8 * k, "#050a12");
    stroke(lists.str, W_.str, "#7388a6"); stroke(lists.art, W_.art, "#c9d6ec"); stroke(lists.hwy, W_.hwy, "#ffcf5a");
    for (const c of ["str", "art", "hwy"]) { const arr = lists.up.filter((s) => (c === "hwy" ? s[4] === "hwy" : c === "art" ? s[4] === "art" : s[4] !== "hwy" && s[4] !== "art")); stroke(arr, W_[c] + 3.2 * k, "#050a12"); stroke(arr, W_[c] + 0.4 * k, c === "hwy" ? "#ffe08a" : c === "art" ? "#e3ecfa" : "#93a7c4"); }
    if (lists.tun.length) { tg.setLineDash([5 * k, 4 * k]); stroke(lists.tun, 3 * k, "#ffb44a"); tg.setLineDash([]); }
  }

  // ---- route guidance: the next turn along a line of points ----
  function nearestIdx(line, P, from) {
    let best = -1, bd = 1e12; const lo = Math.max(0, from - 40), hi = Math.min(line.length - 1, from + 160);
    for (let i = lo; i <= hi; i++) { const q = line[i], d = (q.x - P.x) * (q.x - P.x) + (q.z - P.z) * (q.z - P.z); if (d < bd) { bd = d; best = i; } }
    if (best < 0 || bd > 90 * 90) { best = 0; bd = 1e12; for (let i = 0; i < line.length; i += line.length > 3000 ? 3 : 1) { const q = line[i], d = (q.x - P.x) * (q.x - P.x) + (q.z - P.z) * (q.z - P.z); if (d < bd) { bd = d; best = i; } } }
    return best;
  }
  // returns { d, dir (-1 left, +1 right), ang, wrong, off } or null; `line` is [{x,z}] in driving order
  function hint(P, line) {
    if (!line || line.length < 4) return null;
    if (line !== navLine) { navLine = line; navIdx = 0; }
    const i0 = nearestIdx(line, P, navIdx); navIdx = i0;
    const dirAt = (a, b) => Math.atan2(line[b].z - line[a].z, line[b].x - line[a].x);
    const wrapA = (x) => { while (x > Math.PI) x -= TAU; while (x < -Math.PI) x += TAU; return x; };
    // are we facing the way the route goes?
    const ia = Math.min(line.length - 1, i0 + 3); const rh = dirAt(Math.max(0, ia - 3), ia); const diff = Math.abs(wrapA(rh - P.yaw)); const off = Math.hypot(line[i0].x - P.x, line[i0].z - P.z);
    const wrong = P.speed > 7 && diff > 2.2 && off < 60;
    // walk ahead, measuring the heading change over a short stretch; the first clear bend is the next turn
    let dist = 0, prev = i0; const step = Math.max(1, Math.round(10 / Math.max(1, Math.hypot(line[Math.min(line.length - 1, i0 + 1)].x - line[i0].x, line[Math.min(line.length - 1, i0 + 1)].z - line[i0].z)))); // ~10 m between samples
    for (let i = i0 + step; i < line.length - step && dist < 900; i += step) {
      dist += Math.hypot(line[i].x - line[prev].x, line[i].z - line[prev].z); prev = i;
      const back = Math.max(0, i - 2 * step), fwd = Math.min(line.length - 1, i + 2 * step);
      const a1 = dirAt(back, i), a2 = dirAt(i, fwd), turn = wrapA(a2 - a1);
      if (Math.abs(turn) > 0.5) { // bend of more than ~28 degrees: its size is the heading after the bend minus the heading before it (never added up twice)
        const hin = dirAt(Math.max(0, back - step), back); let hout = a2, j = i + step, quiet = 0, run = 0;
        while (j < line.length - step && run < 40) { const h2 = dirAt(j, Math.min(line.length - 1, j + step)); const t2 = wrapA(h2 - dirAt(Math.max(0, j - step), j)); hout = h2; if (Math.abs(t2) < 0.05) { if (++quiet >= 2) break; } else quiet = 0; run += 10; j += step; }
        const tot = wrapA(hout - hin);
        return { d: dist + 8, dir: tot > 0 ? 1 : -1, ang: Math.abs(tot), wrong, off, end: false };
      }
    }
    const rest = Math.hypot(line[line.length - 1].x - P.x, line[line.length - 1].z - P.z);
    return { d: rest, dir: 0, ang: 0, wrong, off, end: true };
  }

  // ---- drawing (every frame) ----
  function draw(ctx, size, G, dt) {
    const P = G.player; clock += dt || 0.016; const racing = !!(G.run && G.run.route && G.run.kind !== "drift"), half = size / 2, u = size / 220; // u: one "design pixel"
    // zoom
    if (mode === "auto") { const sp = P.speed || 0; const want = racing ? (sp > 40 ? 880 : 520) : sp < 16 ? 300 : sp < 42 ? 520 : 880; if (want !== range) { dwell += dt || 0.016; if (dwell > 1.6) { range = want; dwell = 0; } } else dwell = 0; } else range = RANGES[mode];
    const R = range, ppmView = half / R;
    if (T.R !== R || Math.abs(P.x - T.cx) > R * 0.34 || Math.abs(P.z - T.cz) > R * 0.34 || Math.abs(ppmView - T.ppm) > T.ppm * 3 && T.ppm < ppmView * 0.33) paintTile(P, R, ppmView);
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(half, half, half - 2 * u, 0, TAU); ctx.clip(); ctx.fillStyle = "#0b1b2b"; ctx.fillRect(0, 0, size, size);
    ctx.translate(half, half); ctx.rotate(-Math.PI / 2 - P.yaw);
    const m = ppmView; // metres to pixels
    { const s = ppmView / T.ppm; ctx.save(); ctx.translate((T.cx - P.x) * m, (T.cz - P.z) * m); ctx.scale(s, s); ctx.drawImage(tile, -T.K * T.ppm, -T.K * T.ppm); ctx.restore(); }
    const X = (x) => (x - P.x) * m, Z = (z) => (z - P.z) * m;
    // the route: dark outline, bright core, pulses that run the way to drive
    const line = racing ? G.run.route.pts : G.nav && G.nav.line;
    if (line && line.length > 1) {
      const i0 = Math.max(0, navLine === line ? navIdx - 6 : 0), lim = R * 1.7; ctx.lineJoin = "round"; ctx.lineCap = "round";
      const trace = () => { ctx.beginPath(); let first = true, n = 0; for (let i = i0; i < line.length && n < 900; i += line.length > 1500 ? 2 : 1) { const q = line[i]; if (Math.abs(q.x - P.x) > lim || Math.abs(q.z - P.z) > lim) { if (!first) break; continue; } if (first) { ctx.moveTo(X(q.x), Z(q.z)); first = false; } else ctx.lineTo(X(q.x), Z(q.z)); n++; } };
      trace(); ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 11 * u; ctx.stroke();
      ctx.strokeStyle = racing ? "#3dffa0" : "#27d8ff"; ctx.lineWidth = 7 * u; ctx.stroke();
      ctx.setLineDash([2 * u, 22 * u]); ctx.lineDashOffset = -clock * 46 * u; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5.5 * u; ctx.stroke(); ctx.setLineDash([]);
    }
    // marks
    const edge = []; const pulse = 1 + 0.18 * Math.sin(clock * 6);
    const dot = (x, z, col, r = 5, ring = false, edgeArrow = false) => {
      const px = X(x), pz = Z(z), d2 = px * px + pz * pz, lim = (half - 8 * u);
      if (d2 > lim * lim) { if (edgeArrow) edge.push([px, pz, col]); return; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, pz, r * u, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 2 * u; ctx.stroke();
      if (ring) { ctx.strokeStyle = col; ctx.lineWidth = 2.2 * u; ctx.beginPath(); ctx.arc(px, pz, r * 1.9 * u * pulse, 0, TAU); ctx.stroke(); }
    };
    if (!G.run) {
      for (const ev of G.events) { if (ev.type === "trap") continue; const done = G.career.done[ev.id]; dot(ev.sx, ev.sz, !G.isUnlocked(ev) ? "#9a4040" : done ? "#6bff9a" : "#ffffff", 4.2); }
      for (const sh of G.content.shops) dot(sh.x, sh.z, "#ffb703", 5.6);
    } else if (G.run.route) {
      const L = G.run.route.pts, gi = G.run.route.gates; const gidx = Math.min(gi.length - 1, G.run.gate);
      if (G.run.racers) G.run.racers.forEach((r) => { if (!r.out) dot(r.v.x, r.v.z, r.color, 5.6); });
      if (gidx < gi.length - 1) dot(L[L.length - 1].x, L[L.length - 1].z, "#ffd23a", 6.2, false, true);
      dot(L[gi[gidx]].x, L[gi[gidx]].z, "#ffffff", 6.6, true, true);
    }
    if (G.nav && G.nav.target && !G.run) dot(G.nav.target.x, G.nav.target.z, "#27d8ff", 7.6, true, true);
    // arrows at the rim for things that are off the map
    for (const [px, pz, col] of edge) { const a = Math.atan2(pz, px), rr = half - 10 * u; ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = "#000"; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(7 * u, 0); ctx.lineTo(-5 * u, 6 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-5 * u, -6 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
    // north marker on the rim (the map turns, so N moves round)
    { const th = (-Math.PI / 2 - P.yaw) - Math.PI / 2; const rr = half - 11 * u; const nx = half + Math.cos(th) * rr, nz = half + Math.sin(th) * rr; ctx.fillStyle = "rgba(10,18,30,0.9)"; ctx.beginPath(); ctx.arc(nx, nz, 8 * u, 0, TAU); ctx.fill(); ctx.fillStyle = "#ff6b6b"; ctx.font = `bold ${11 * u}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("N", nx, nz + 0.5 * u); }
    // the car: always pointing up, with a soft halo so it is easy to find
    ctx.save(); ctx.translate(half, half); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(0, 0, 13 * u, 0, TAU); ctx.fill(); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2.4 * u; ctx.beginPath(); ctx.moveTo(0, -12 * u); ctx.lineTo(8.5 * u, 10 * u); ctx.lineTo(0, 5.5 * u); ctx.lineTo(-8.5 * u, 10 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    // rim
    ctx.strokeStyle = racing ? "rgba(61,255,160,0.9)" : "rgba(190,215,250,0.85)"; ctx.lineWidth = 3.6 * u; ctx.beginPath(); ctx.arc(half, half, half - 2 * u, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.arc(half, half, half - 4.8 * u, 0, TAU); ctx.stroke();
  }
  return {
    draw, hint, get mode() { return mode; }, get range() { return range; },
    cycleMode() { mode = mode === "auto" ? "close" : mode === "close" ? "mid" : mode === "mid" ? "wide" : "auto"; try { localStorage.setItem("mb-mapzoom", mode); } catch {} T.R = 0; return mode; },
  };
}
