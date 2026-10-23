"use client";
import { useEffect, useState } from "react";

// Returns the ids of maps an admin has switched OFF for this game. Fails open: if the request
// fails every map stays available, so a network blip can never lock players out.
export function useMapSwitches(slug) {
  const [off, setOff] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/game-maps?game=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && Array.isArray(d.disabled)) setOff(d.disabled); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);
  return off;
}
