"use client";
// Browser side of the flagship cloud save (Upgrade 129). Call `await startFlagshipSync(game)` BEFORE the game starts:
//  1. asks the account for its copy and writes any newer key into localStorage (so the game loads the newest progress),
//  2. watches localStorage.setItem for this game's keys and uploads changes a few seconds later.
// Guests, offline play and any failure are harmless: the game just keeps using its own browser copy.
import { FLAGSHIP_SYNC, keyAllowed } from "./flagshipKeys";

const TS = "fs-ts:"; // local time stamp of each key
const stamp = (k) => { try { return +localStorage.getItem(TS + k) || 0; } catch { return 0; } };
let active = null;

export async function startFlagshipSync(game) {
  if (typeof window === "undefined" || !FLAGSHIP_SYNC[game] || active?.game === game) return;
  const st = { game, dirty: new Set(), timer: 0, ok: true };
  active = st;
  const send = async () => {
    st.timer = 0; if (!st.ok || !st.dirty.size) return;
    const data = {}; for (const k of st.dirty) { try { const v = localStorage.getItem(k); if (v != null) data[k] = { v, t: stamp(k) || Date.now() }; } catch {} }
    st.dirty.clear();
    try { const r = await fetch("/api/flagship-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, data }), keepalive: true }); if (r.status === 401) st.ok = false; } catch {}
  };
  const mark = (k) => { if (!keyAllowed(game, k)) return; try { localStorage.setItem(TS + k, String(Date.now())); } catch {} st.dirty.add(k); if (!st.timer) st.timer = setTimeout(send, 8000); };
  // pull first (4 s at most so a slow network never holds the game back)
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`/api/flagship-save?game=${game}`, { signal: ctl.signal }); clearTimeout(to);
    if (r.status === 401) st.ok = false;
    else if (r.ok) {
      const { data } = await r.json(); const up = {};
      for (const [k, e] of Object.entries(data || {})) {
        if (!keyAllowed(game, k) || typeof e?.v !== "string") continue;
        const have = localStorage.getItem(k);
        if (have == null || (e.t || 0) > stamp(k)) { localStorage.setItem(k, e.v); localStorage.setItem(TS + k, String(e.t || Date.now())); }
        else if (have !== e.v && stamp(k) > (e.t || 0)) up[k] = 1;
      }
      for (const k of Object.keys(up)) st.dirty.add(k);
      // local keys the account has never seen
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (keyAllowed(game, k) && !(data || {})[k]) st.dirty.add(k); }
      if (st.dirty.size) st.timer = setTimeout(send, 3000);
    }
  } catch {}
  if (!st.ok) return;
  const orig = Storage.prototype.setItem;
  if (!Storage.prototype.__fsPatched) {
    Storage.prototype.__fsPatched = true;
    Storage.prototype.setItem = function (k, v) { orig.call(this, k, v); if (this === window.localStorage && active && active.ok) { try { active.mark(k); } catch {} } };
  }
  st.mark = mark;
  window.addEventListener("pagehide", () => { if (st.dirty.size) send(); });
}
export function stopFlagshipSync() { if (active) { try { clearTimeout(active.timer); } catch {} active.ok = false; active = null; } }
