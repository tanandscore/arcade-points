// Midnight Burn — the map picture: land, sea and every road, drawn once, then used by the minimap and the full map.
import { W, G as GN, CELL, land, DISTRICTS } from "./geo";

export const MAP_PX = 2048;
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
