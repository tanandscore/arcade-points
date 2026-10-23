// Midnight Burn — the big map (Pause ▸ Map), drawn as sharp vector art for whatever part of the world is on screen.
//
// Why this file exists (Upgrade 36). The old map was ONE 3072-pixel picture of the whole 22 km world, drawn once and then shrunk onto the screen: a side
// street came out well under a pixel wide, so the map looked soft and grey. Its markers (events, shops, sights, the car) were also placed with the
// size of the OLD 6.4 km world, so they sat in the wrong places, or off the picture altogether. Now:
//   - the sea, the coast, parks, airports, every road class, flyovers, tunnels and the metro are drawn as crisp lines at the player's own zoom
//     (mouse wheel zooms, dragging moves); thin streets fade in as you zoom in, so the picture never turns into a grey smear;
//   - while the view is moving the last sharp picture is simply slid and scaled (instant), and a fresh sharp one is drawn once the view settles;
//   - markers are placed from real world metres through toScreen(), so they can never drift from the map again;
//   - nothing big is kept in memory any more (the old picture was a 3072 x 3072 canvas, about 37 MB, built twice).
import { W, CELL, DISTRICTS, AIRPORTS, shoreDist } from "./geo";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const LAND = [27, 43, 60], RIM = [58, 86, 114]; // land and its bright shoreline (rgb)
const SEA = "#09192a", CASE = "rgba(4,9,16,0.92)";
const MAX_PPM = 3.2; // closest zoom: 3.2 pixels per metre

export function createFullMap(city) {
  const roads = city.roads, nR = roads.length;
  // a box round every road, once, so a view can skip all the roads that are nowhere near it
  const bb = new Float32Array(nR * 4);
  for (let k = 0; k < nR; k++) {
    const pts = roads[k].pts; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
    bb[k * 4] = x0; bb[k * 4 + 1] = x1; bb[k * 4 + 2] = z0; bb[k * 4 + 3] = z1;
  }
  const base = document.createElement("canvas"), landC = document.createElement("canvas");
  const S = { w: 800, h: 600, dpr: 1, cx: W / 2, cz: W / 2, ppm: 0.04 }; // the view being shown: centre (metres), pixels per metre
  let B = null; // the view the sharp picture (base) was drawn for
  const minPpm = () => (Math.min(S.w, S.h) / W) * 0.98;
  const keep = () => { S.ppm = clamp(S.ppm, minPpm(), MAX_PPM); S.cx = clamp(S.cx, 0, W); S.cz = clamp(S.cz, 0, W); };

  let sdA = null, sdB = null;
  // two passes of a sideways and an up-down running average (radius in samples); the edges repeat their last value. Returns whichever buffer holds the result.
  function smoothField(A, Bf, w, h, r) {
    const inv = 1 / (2 * r + 1);
    const pass = (src, dst, horizontal) => {
      const len = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 1 : w, lstep = horizontal ? w : 1;
      for (let l = 0; l < lines; l++) {
        const o = l * lstep; let acc = src[o] * (r + 1);
        for (let k = 1; k <= r; k++) acc += src[o + Math.min(k, len - 1) * step];
        for (let i = 0; i < len; i++) {
          dst[o + i * step] = acc * inv;
          acc += src[o + Math.min(i + r + 1, len - 1) * step] - src[o + Math.max(i - r, 0) * step];
        }
      }
    };
    pass(A, Bf, true); pass(Bf, A, false); pass(A, Bf, true); pass(Bf, A, false);
    return A;
  }

  // ---- sea and land (the coast is the zero line of the smooth shore-distance field, so it is smooth at every zoom) ----
  function paintLand(v) {
    const sc = Math.min(1, Math.sqrt(650000 / (v.w * v.h))); // at most ~650k samples; the result is smoothly scaled up
    const lw = Math.max(8, Math.round(v.w * sc)), lh = Math.max(8, Math.round(v.h * sc)), stepM = 1 / (v.ppm * sc);
    if (landC.width !== lw || landC.height !== lh) { landC.width = lw; landC.height = lh; }
    const g = landC.getContext("2d"); g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, lw, lh);
    const img = g.createImageData(lw, lh), px = new Uint32Array(img.data.buffer);
    const left = v.cx - v.w / (2 * v.ppm), top = v.cz - v.h / (2 * v.ppm), x0 = left + stepM / 2, z0 = top + stepM / 2;
    const band = stepM * 0.8, rimW = stepM * 1.8;
    // the shore-distance field comes from a coarse grid, so its zero line follows the grid's square corners; a short running-average smooths those steps into a flowing coastline (cheap: the cost does not depend on how wide the smoothing is)
    const n = lw * lh; if (!sdA || sdA.length < n) { sdA = new Float32Array(n); sdB = new Float32Array(n); }
    for (let j = 0; j < lh; j++) { const z = z0 + j * stepM, row = j * lw; for (let i = 0; i < lw; i++) sdA[row + i] = shoreDist(x0 + i * stepM, z); }
    const rad = Math.min(80, Math.round((CELL * 0.55) / stepM));
    const sdv = rad >= 1 ? smoothField(sdA, sdB, lw, lh, rad) : sdA;
    for (let j = 0; j < lh; j++) {
      const row = j * lw;
      for (let i = 0; i < lw; i++) {
        const s = sdv[row + i];
        if (s <= -band) continue; // open sea stays transparent
        const a = s >= band ? 255 : ((s + band) / (2 * band) * 255) | 0;
        let r = LAND[0], gg = LAND[1], b = LAND[2];
        if (s < rimW) { const t = 1 - (s > 0 ? s : 0) / rimW; r += (RIM[0] - r) * t; gg += (RIM[1] - gg) * t; b += (RIM[2] - b) * t; }
        px[row + i] = (a << 24) | ((b | 0) << 16) | ((gg | 0) << 8) | (r | 0);
      }
    }
    g.putImageData(img, 0, 0);
    g.globalCompositeOperation = "source-atop"; // green belts only where there is land
    for (const d of DISTRICTS) if (d.style === "forest") {
      const gx = (d.x - left) * v.ppm * sc, gz = (d.z - top) * v.ppm * sc, rr = Math.max(2, d.r * v.ppm * sc);
      const gr = g.createRadialGradient(gx, gz, 0, gx, gz, rr); gr.addColorStop(0, "rgba(44,112,68,0.7)"); gr.addColorStop(1, "rgba(44,112,68,0)");
      g.fillStyle = gr; g.fillRect(gx - rr, gz - rr, rr * 2, rr * 2);
    }
    g.globalCompositeOperation = "source-over";
  }

  function paintAirports(g, v) {
    for (const a of AIRPORTS) {
      g.save(); g.translate((a.x - v.cx) * v.ppm + v.w / 2, (a.z - v.cz) * v.ppm + v.h / 2); g.scale(v.ppm, v.ppm); g.rotate(a.rot);
      g.fillStyle = "#2b3f55"; g.fillRect(-a.rx * 0.9, -a.rz * 0.9, a.rx * 1.8, a.rz * 1.8);
      g.fillStyle = "#e4ecf8"; for (const r of a.runways) { g.save(); g.translate(r.x, r.z); g.rotate(r.ang); g.fillRect(-r.len / 2, -r.w / 2, r.len, r.w); g.restore(); }
      if (a.terminal) { g.save(); g.translate(a.terminal.x, a.terminal.z); g.rotate(a.terminal.ang || 0); g.fillStyle = "#7d94b2"; g.fillRect(-a.terminal.len / 2, -22, a.terminal.len, 44); g.restore(); }
      g.restore();
    }
  }

  // ---- roads: one path per kind, skipping roads (and stretches of road) that are off screen and points closer than a pixel ----
  function paintRoads(g, v) {
    const ppm = v.ppm, hw = v.w / 2, hh = v.h / 2, cx = v.cx, cz = v.cz, mg = 48 / ppm + 160;
    const xa = cx - hw / ppm - mg, xb = cx + hw / ppm + mg, za = cz - hh / ppm - mg, zb = cz + hh / ppm + mg;
    const ms2 = (1.15 / ppm) * (1.15 / ppm);
    const P = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()]; // 0-2 street/main/motorway, 3-5 the same on flyovers, 6 tunnels
    for (let k = 0; k < nR; k++) {
      if (bb[k * 4] > xb || bb[k * 4 + 1] < xa || bb[k * 4 + 2] > zb || bb[k * 4 + 3] < za) continue;
      const r = roads[k], pts = r.pts, n = pts.length, cl = r.cls === "hwy" ? 2 : r.cls === "art" ? 1 : 0;
      let a = pts[0], ax = (a.x - cx) * ppm + hw, ay = (a.z - cz) * ppm + hh, ain = a.x > xa && a.x < xb && a.z > za && a.z < zb, open = false, ok = -1;
      for (let i = 1; i < n; i++) {
        const b = pts[i], dx = b.x - a.x, dz = b.z - a.z;
        if (i < n - 1 && dx * dx + dz * dz < ms2) continue;
        const bin = b.x > xa && b.x < xb && b.z > za && b.z < zb, bx = (b.x - cx) * ppm + hw, by = (b.z - cz) * ppm + hh;
        if (ain || bin) {
          const kd = a.tun ? 6 : (a.y - a.g > 3.2 || a.over) ? 3 + cl : cl, p = P[kd];
          if (!open || ok !== kd) { p.moveTo(ax, ay); ok = kd; open = true; }
          p.lineTo(bx, by);
        } else open = false;
        a = b; ax = bx; ay = by; ain = bin;
      }
    }
    const wS = clamp(11 * ppm, 0.8, 5), wA = clamp(18 * ppm, 1.4, 7.5), wH = clamp(28 * ppm, 2.4, 11);
    g.lineCap = "round"; g.lineJoin = "round";
    const stroke = (p, w, col) => { g.lineWidth = w; g.strokeStyle = col; g.stroke(p); };
    g.globalAlpha = clamp(0.2 + ppm * 5.5, 0.2, 1); // thin streets are quiet when zoomed out and come forward as you zoom in
    if (wS > 1.6) stroke(P[0], wS + 1.6, CASE);
    stroke(P[0], wS, "#6a81a0");
    g.globalAlpha = 1;
    if (wA > 2.2) stroke(P[1], wA + 1.8, CASE);
    stroke(P[1], wA, "#c3d1e8");
    stroke(P[2], wH + 2.2, CASE); stroke(P[2], wH, "#ffcf5a");
    const ww = [wS, wA, wH], light = ["#9db1cf", "#e3ecfa", "#ffe08a"];
    for (let c = 0; c < 3; c++) { stroke(P[3 + c], ww[c] + 2.8, CASE); stroke(P[3 + c], ww[c] + 0.4, light[c]); }
    g.setLineDash([5, 4]); stroke(P[6], Math.max(1.6, wA * 0.85), "#ffb44a"); g.setLineDash([]);
  }

  function paintMetro(g, v) {
    if (v.ppm < 0.03 || !city.metro) return;
    const X = (x) => (x - v.cx) * v.ppm + v.w / 2, Z = (z) => (z - v.cz) * v.ppm + v.h / 2;
    g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = clamp(6 * v.ppm, 1.3, 3.6);
    for (const L of city.metro) { g.strokeStyle = "#" + L.color.toString(16).padStart(6, "0"); g.beginPath(); L.pts.forEach((p, k) => { if (k === 0) g.moveTo(X(p.x), Z(p.z)); else g.lineTo(X(p.x), Z(p.z)); }); g.stroke(); }
    if (v.ppm < 0.12) return;
    for (const L of city.metro) { g.strokeStyle = "#" + L.color.toString(16).padStart(6, "0"); g.lineWidth = 1.8; g.fillStyle = "#fff"; for (const st of L.stations) { const x = X(st.x), z = Z(st.z); if (x < -8 || z < -8 || x > v.w + 8 || z > v.h + 8) continue; g.beginPath(); g.arc(x, z, 3.2, 0, 6.2832); g.fill(); g.stroke(); } }
  }

  function paintLabels(g, v) {
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    for (const d of DISTRICTS) {
      if (d.r < 300) continue; const rpx = d.r * v.ppm; if (rpx < 30 || rpx > 900) continue;
      const x = (d.x - v.cx) * v.ppm + v.w / 2, z = (d.z - v.cz) * v.ppm + v.h / 2; if (x < -80 || z < -20 || x > v.w + 80 || z > v.h + 20) continue;
      g.font = `700 ${clamp(rpx * 0.14, 10, 15)}px system-ui, Arial, sans-serif`; g.lineWidth = 3.2; g.strokeStyle = "rgba(4,9,16,0.85)"; g.fillStyle = "rgba(206,221,243,0.8)";
      const t = d.name.toUpperCase(); g.strokeText(t, x, z); g.fillText(t, x, z);
    }
  }

  // draw the sharp picture for the current view (about 20 to 70 ms; done when the view settles, never during a drag or a zoom)
  function render() {
    const v = { w: S.w, h: S.h, dpr: S.dpr, cx: S.cx, cz: S.cz, ppm: S.ppm };
    const pw = Math.round(v.w * v.dpr), ph = Math.round(v.h * v.dpr);
    if (base.width !== pw || base.height !== ph) { base.width = pw; base.height = ph; }
    const g = base.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = SEA; g.fillRect(0, 0, pw, ph);
    paintLand(v); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(landC, 0, 0, pw, ph);
    g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    paintAirports(g, v); paintRoads(g, v); paintMetro(g, v); paintLabels(g, v);
    B = v;
  }

  const api = {
    get view() { return S; },
    get stale() { return !B || B.w !== S.w || B.h !== S.h || B.dpr !== S.dpr || B.cx !== S.cx || B.cz !== S.cz || B.ppm !== S.ppm; },
    resize(w, h, dpr) { if (S.w === w && S.h === h && S.dpr === dpr) return; S.w = w; S.h = h; S.dpr = dpr; keep(); },
    toScreen(x, z) { return [(x - S.cx) * S.ppm + S.w / 2, (z - S.cz) * S.ppm + S.h / 2]; },
    toWorld(sx, sy) { return [(sx - S.w / 2) / S.ppm + S.cx, (sy - S.h / 2) / S.ppm + S.cz]; },
    zoomAt(sx, sy, k) { const [wx, wz] = api.toWorld(sx, sy); S.ppm = clamp(S.ppm * k, minPpm(), MAX_PPM); S.cx = wx - (sx - S.w / 2) / S.ppm; S.cz = wz - (sy - S.h / 2) / S.ppm; keep(); },
    pan(dx, dy) { S.cx -= dx / S.ppm; S.cz -= dy / S.ppm; keep(); },
    focus(x, z, spanM) { S.cx = x; S.cz = z; S.ppm = Math.min(S.w, S.h) / spanM; keep(); },
    fitAll() { S.cx = S.cz = W / 2; S.ppm = minPpm(); },
    get span() { return Math.min(S.w, S.h) / S.ppm; }, // metres across the shorter side of the screen
    refine() { if (api.stale) render(); }, // draw the sharp picture now, if the view has moved since the last one
    // paint the map into a canvas context whose units are CSS pixels; if the view has moved since the last sharp picture, that picture is slid and scaled to fit
    draw(ctx) {
      ctx.fillStyle = SEA; ctx.fillRect(0, 0, S.w, S.h); if (!B) return;
      const s = S.ppm / B.ppm, ox = (B.cx - S.cx) * S.ppm + S.w / 2, oz = (B.cz - S.cz) * S.ppm + S.h / 2;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(base, ox - (B.w * s) / 2, oz - (B.h * s) / 2, B.w * s, B.h * s);
    },
  };
  return api;
}
