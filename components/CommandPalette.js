"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIERS } from "@/lib/catalog";

const PAGES = [
  ["Store", "/"],
  ["Browse all games", "/games"],
  ["Free games", "/games?tier=free"],
  ["Power Pass games", "/games?tier=power"],
  ["Legend Pass games", "/games?tier=legend"],
  ["Your library", "/library"],
  ["Leaderboard", "/leaderboard"],
  ["Tournaments", "/tournaments"],
  ["Hall of Fame", "/hall-of-fame"],
  ["Game gallery", "/gallery"],
  ["Pricing", "/pricing"],
  ["My account", "/account"],
  ["What's new", "/changelog"],
  ["Send feedback", "/feedback"],
  ["Contact", "/contact"],
];

// Press Ctrl/⌘+K (or "/") anywhere, or use the search button in the top bar, to jump to a game or page by typing.
export default function CommandPalette({ games }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inp = useRef(null);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [
      ...games.map((g) => ({ label: g.name, icon: g.icon, sub: g.status === "soon" ? `Coming soon. ${g.tagline}` : g.tagline, href: `/games/${g.slug}`, key: `${g.name} ${g.tagline} ${g.genre || ""}`, tier: g.tier })),
      ...PAGES.map(([l, h]) => ({ label: l, icon: null, sub: "Page", href: h, key: l })),
    ];
    return (s ? all.filter((x) => x.key.toLowerCase().includes(s)) : all.slice(0, 12)).slice(0, 9);
  }, [games, q]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setOpen((o) => !o); setQ(""); setI(0); }
      else if (e.key === "/" && !typing && !document.pointerLockElement) { e.preventDefault(); setOpen(true); setQ(""); setI(0); }
      else if (e.key === "Escape") setOpen(false);
    };
    const openIt = () => { setOpen(true); setQ(""); setI(0); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("ts-open-palette", openIt);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("ts-open-palette", openIt); };
  }, []);
  useEffect(() => { if (open) setTimeout(() => inp.current && inp.current.focus(), 20); }, [open]);
  if (!open) return null;
  const go = (it) => { setOpen(false); router.push(it.href); };

  return (
    <div className="fixed inset-0 z-[90] bg-black/65 flex items-start justify-center pt-[10vh] px-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Search games and pages">
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#1d1046] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inp}
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter" && items[i]) go(items[i]);
          }}
          placeholder="Search games and pages"
          aria-label="Search games and pages"
          className="w-full bg-transparent px-5 py-4 text-[16px] outline-none border-b border-white/10 placeholder:text-[#a99fd6]"
        />
        <ul className="max-h-[22rem] overflow-y-auto p-1.5">
          {items.map((it, n) => (
            <li key={it.href}>
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => go(it)} className={"w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-3 " + (n === i ? "bg-white/10" : "")}>
                <span className="w-7 text-center text-lg shrink-0" aria-hidden>{it.icon || "›"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold truncate">{it.label}</span>
                  <span className="block text-[12.5px] text-[#a99fd6] truncate">{it.sub}</span>
                </span>
                {it.tier && it.tier !== "free" && <span className="text-[11.5px] font-bold shrink-0" style={{ color: TIERS[it.tier].color }}>{TIERS[it.tier].name}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-5 text-sm text-[#a99fd6]">Nothing matches that.</li>}
        </ul>
        <p className="px-5 py-2.5 text-[12px] text-[#a99fd6] border-t border-white/10">Arrow keys to move, Enter to open, Esc to close</p>
      </div>
    </div>
  );
}
