"use client";
import { useEffect, useState } from "react";
import { ShareIcon } from "@/components/store/Icons";

// Share a game: phone share sheet where available, WhatsApp link, and copy-link.
export default function GameShare({ name, slug }) {
  const [copied, setCopied] = useState(false);
  // The same address on the server and in the first browser render (otherwise the page would not match itself); the real
  // address of whichever site the visitor is on replaces it a moment later.
  const [origin, setOrigin] = useState("https://tapandscore.com");
  useEffect(() => { try { setOrigin(window.location.origin); } catch {} }, []);
  const url = `${origin}/games/${slug}`;
  const text = `Try ${name} on Tap & Score. Free to start, no download. Can you beat my score?`;
  const native = async () => { try { if (navigator.share) { await navigator.share({ title: name, text, url }); return; } } catch { return; } window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener"); };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };
  return (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={native} className="st-btn st-btn-ghost st-btn-sm"><ShareIcon size={16} /> Share</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer" className="st-btn st-btn-ghost st-btn-sm">WhatsApp</a>
      <button type="button" onClick={copy} className="st-btn st-btn-ghost st-btn-sm">{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}
