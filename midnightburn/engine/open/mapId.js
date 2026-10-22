// Midnight Burn — which city is being played. Chosen once, when the page loads (the menu switches maps by reloading the page), so every part of the engine
// can read it at start-up and nothing from the other city is ever left behind in memory.
//   "mumbai"  Mumbai Drift (the default)
//   "tokyo"   Tokyo Drift
// Order of preference: a test hook (globalThis.__MB_MAP or the MB_MAP environment variable), the ?map= part of the address, then the saved choice.
export const MAPS = ["mumbai", "tokyo"];
function readId() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.__MB_MAP) return String(globalThis.__MB_MAP);
    if (typeof process !== "undefined" && process.env && process.env.MB_MAP) return String(process.env.MB_MAP);
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("map"); if (q && MAPS.includes(q)) return q;
      const s = window.localStorage.getItem("mb-map"); if (s && MAPS.includes(s)) return s;
    }
  } catch { /* private window or blocked storage: fall through */ }
  return "mumbai";
}
export const MAP_ID = MAPS.includes(readId()) ? readId() : "mumbai";
export const IS_TOKYO = MAP_ID === "tokyo";
// switch map: remember the choice and reload (the geography is built when the page loads)
export function chooseMap(id) {
  try { window.localStorage.setItem("mb-map", id); } catch { /* ignore */ }
  try { const u = new URL(window.location.href); u.searchParams.delete("map"); window.location.href = u.toString(); } catch { window.location.reload(); }
}
