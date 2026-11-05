"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartIcon } from "./Icons";

// Favourites live in this browser only (localStorage "ts-favs", a list of game names in URL form). Games the player marked
// before the store was redesigned are still there; any that no longer exist are simply ignored.
const KEY = "ts-favs";
function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

export function useFavs() {
  const [favs, setFavs] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFavs(read());
    setReady(true);
    const on = () => setFavs(read());
    window.addEventListener("storage", on);
    window.addEventListener("ts-favs-changed", on);
    return () => { window.removeEventListener("storage", on); window.removeEventListener("ts-favs-changed", on); };
  }, []);
  const toggle = useCallback((slug) => {
    const cur = read();
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    setFavs(next);
    window.dispatchEvent(new Event("ts-favs-changed"));
  }, []);
  return { favs, toggle, ready };
}

// The heart on a game page.
export default function FavButton({ slug, name }) {
  const { favs, toggle, ready } = useFavs();
  const on = ready && favs.includes(slug);
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from your favourites` : `Add ${name} to your favourites`}
      className="st-btn st-btn-ghost st-btn-sm"
      style={on ? { color: "#ff3ea5", borderColor: "rgba(255,62,165,.6)" } : undefined}
    >
      <HeartIcon size={17} filled={on} /> {on ? "Favourite" : "Add to favourites"}
    </button>
  );
}
