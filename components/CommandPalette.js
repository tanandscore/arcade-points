"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PAGES = [["Dashboard", "/dashboard"], ["Leaderboard", "/leaderboard"], ["Tournaments", "/tournaments"], ["Hall of Fame", "/hall-of-fame"], ["Pricing", "/pricing"], ["My account", "/account"], ["Changelog", "/changelog"], ["Send feedback", "/feedback"], ["Contact", "/contact"]];

// Press Ctrl/⌘+K (or "/") anywhere to jump to a game or page by typing.
export default function CommandPalette({ games }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [i, setI] = useState(0); const inp = useRef(null);
  const items = useMemo(() => { const s = q.trim().toLowerCase(); const all = [...games.map((g) => ({ label: `${g.icon} ${g.name}`, sub: g.tagline, href: `/games/${g.slug}`, key: g.name + g.tagline })), ...PAGES.map(([l, h]) => ({ label: l, sub: "Page", href: h, key: l }))]; return (s ? all.filter((x) => x.key.toLowerCase().includes(s)) : all).slice(0, 9); }, [games, q]);
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || ""; const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setOpen((o) => !o); setQ(""); setI(0); }
      else if (e.key === "/" && !typing && !document.pointerLockElement) { e.preventDefault(); setOpen(true); setQ(""); setI(0); }
      else if (e.key === "Escape") setOpen(false);
    };
    const openIt = () => { setOpen(true); setQ(""); setI(0); };
    window.addEventListener("keydown", onKey); window.addEventListener("ts-open-palette", openIt); return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("ts-open-palette", openIt); };
  }, []);
  useEffect(() => { if (open) setTimeout(() => inp.current && inp.current.focus(), 20); }, [open]);
  if (!open) return null;
  const go = (it) => { setOpen(false); router.push(it.href); };
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Quick jump">
      <div className="w-full max-w-lg rounded-2xl border border-lineColor bg-bgPanel shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } else if (e.key === "Enter" && items[i]) go(items[i]); }} placeholder="Jump to a game or page…" className="w-full bg-transparent px-5 py-4 text-sm outline-none border-b border-lineColor" />
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.map((it, n) => <li key={it.href}><button type="button" onMouseEnter={() => setI(n)} onClick={() => go(it)} className={"w-full text-left px-5 py-2.5 " + (n === i ? "bg-accentCyan/10" : "")}><span className="text-sm">{it.label}</span><span className="block text-[11px] text-textDim truncate">{it.sub}</span></button></li>)}
          {!items.length && <li className="px-5 py-4 text-sm text-textDim">No match.</li>}
        </ul>
        <p className="px-5 py-2 font-mono text-[10px] text-textDim border-t border-lineColor">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
