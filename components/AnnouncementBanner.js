"use client";
import { useEffect, useState } from "react";

const TONE = { info: ["rgba(62,230,224,0.12)", "#3ee6e0"], promo: ["rgba(255,194,51,0.14)", "#ffc233"], warning: ["rgba(255,99,99,0.14)", "#ff8080"] };

// A slim banner above every page. Visitors can close it; it stays closed for that announcement only.
export default function AnnouncementBanner({ a }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem("ts-ann-" + a.id) === "1"); } catch { setHidden(false); } }, [a.id]);
  if (hidden) return null;
  const [bg, fg] = TONE[a.level] || TONE.info;
  return (
    <div role="status" className="relative z-50 text-sm" style={{ background: bg, borderBottom: `1px solid ${fg}55` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <p className="flex-1 text-textLight">{a.message}{a.link_url && <> <a href={a.link_url} className="font-semibold underline underline-offset-2" style={{ color: fg }}>{a.link_label || "Learn more"}</a></>}</p>
        <button aria-label="Dismiss announcement" onClick={() => { try { localStorage.setItem("ts-ann-" + a.id, "1"); } catch {} setHidden(true); }} className="text-textDim hover:text-textLight text-lg leading-none px-1">×</button>
      </div>
    </div>
  );
}
