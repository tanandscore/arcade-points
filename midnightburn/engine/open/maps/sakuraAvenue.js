// Midnight Burn: Tokyo Drift — which stretches of road are the cherry-blossom avenues (Upgrade 34).
// plants.js lines them (and the park lawns beside them) with real cherry trees; landmarksJapan3d.js hangs the evening lanterns over the same stretches.
export const AVENUE_IDS = ["ueno", "chidorigafuchi", "meguro", "showakinen", "sakuraave"];
export function sakuraAvenues(city, landmarks) {
  if (city._sakuraAv) return city._sakuraAv;
  const out = [];
  for (const id of AVENUE_IDS) {
    const l = landmarks.find((q) => q.id === id); if (!l) continue;
    const n = city.nearestRoad(l.rx ?? l.x, l.rz ?? l.z, 300, (r) => !r.ramp && r.cls !== "hwy", null); if (!n) continue;
    const r = n.road, len = id === "showakinen" ? 700 : 420; let s0 = r.pts[n.i].s - len / 2; s0 = Math.max(10, Math.min(s0, r.len - len - 10));
    out.push({ id, r, s0, s1: s0 + len, x: l.rx ?? l.x, z: l.rz ?? l.z });
  }
  city._sakuraAv = out; return out;
}
