"use client";
import { useState } from "react";

// Share a game: phone share sheet where available, WhatsApp link, and copy-link.
export default function GameShare({ name, slug }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/games/${slug}` : `https://tapandscore.com/games/${slug}`;
  const text = `Try ${name} on Tap & Score — free, no download. Can you beat my score?`;
  const native = async () => { try { if (navigator.share) { await navigator.share({ title: name, text, url }); return; } } catch { return; } window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank", "noopener"); };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };
  return (
    <div className="flex gap-2 justify-center flex-wrap mt-8">
      <button type="button" onClick={native} className="font-mono text-[11px] px-4 py-2 rounded-full border border-lineColor text-textDim hover:text-textLight">📤 Share this game</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] px-4 py-2 rounded-full border border-lineColor text-textDim hover:text-textLight">WhatsApp</a>
      <button type="button" onClick={copy} className="font-mono text-[11px] px-4 py-2 rounded-full border border-lineColor text-textDim hover:text-textLight">{copied ? "✓ Link copied" : "🔗 Copy link"}</button>
    </div>
  );
}
