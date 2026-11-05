"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { haptics } from "@/lib/haptics";
import { SearchIcon, ChevronDown, StoreIcon, LibraryIcon, TrophyIcon, UserIcon, MoreIcon } from "@/components/store/Icons";

// Upgrade 70: one calm bar for the whole site, in the style of a game store:
//   logo · Store · Library · Community ▾ · Pricing ........ search · points · you
// On phones the same places live in a tab bar along the bottom. The props are unchanged, so every page that already renders
// <Navbar username points isAdmin /> picks up the new look without any other edit.

const COMMUNITY = [
  ["Leaderboard", "/leaderboard"],
  ["Tournaments", "/tournaments"],
  ["Hall of Fame", "/hall-of-fame"],
  ["Game gallery", "/gallery"],
  ["What's new", "/changelog"],
  ["Send feedback", "/feedback"],
];
const COMMUNITY_PATHS = ["/leaderboard", "/tournaments", "/hall-of-fame", "/gallery", "/changelog", "/feedback", "/players"];

function useDisclosure(pathname) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  return [open, setOpen, ref];
}

export default function Navbar({ username, points, isAdmin }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const supabase = createClient();
  const [unreadChangelog, setUnreadChangelog] = useState(0);
  const [commOpen, setCommOpen, commRef] = useDisclosure(pathname);
  const [meOpen, setMeOpen, meRef] = useDisclosure(pathname);
  const [moreOpen, setMoreOpen] = useState(false);

  // Fetched client-side here rather than passed as a prop from every page that renders this component — adding that prop everywhere
  // would mean touching every server component just to surface one badge count.
  useEffect(() => {
    if (!username) return;
    fetch("/api/changelog/unread-count")
      .then((r) => r.json())
      .then((d) => setUnreadChangelog(d.count || 0))
      .catch(() => {});
  }, [username]);
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  const openSearch = () => window.dispatchEvent(new Event("ts-open-palette"));

  const home = username ? "/dashboard" : "/";
  const onStore = pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/games");
  const onLibrary = pathname.startsWith("/library");
  const onCommunity = COMMUNITY_PATHS.some((p) => pathname.startsWith(p));
  const onPricing = pathname.startsWith("/pricing");
  const initial = (username || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <header className="st-top">
        <div className="st-container flex items-center gap-2 sm:gap-3 h-14">
          <Link href={home} className="st-logo mr-1 sm:mr-4" aria-label="Tap and Score home">TAP<b>&amp;</b>SCORE</Link>

          <nav aria-label="Main" className="hidden md:flex items-center">
            <Link href={home} className="st-navlink" aria-current={onStore ? "page" : undefined}>Store</Link>
            {username && <Link href="/library" className="st-navlink" aria-current={onLibrary ? "page" : undefined}>Library</Link>}
            <div className="relative" ref={commRef}>
              <button type="button" className="st-navlink" aria-haspopup="menu" aria-expanded={commOpen} aria-current={onCommunity ? "page" : undefined} onClick={() => setCommOpen((o) => !o)}>
                Community <ChevronDown size={14} />
              </button>
              {commOpen && (
                <div className="st-menu" role="menu" style={{ top: "calc(100% - 4px)", left: 0 }}>
                  {COMMUNITY.map(([label, href]) => (
                    <Link key={href} href={href} role="menuitem">
                      {label}
                      {href === "/changelog" && unreadChangelog > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accentMagenta text-white text-[11px] font-bold flex items-center justify-center">{unreadChangelog}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/pricing" className="st-navlink" aria-current={onPricing ? "page" : undefined}>Pricing</Link>
          </nav>

          <div className="flex-1" />

          <button type="button" className="st-search hidden md:flex" onClick={openSearch} aria-label="Search games and pages">
            <SearchIcon size={16} /> <span>Search games</span> <kbd>/</kbd>
          </button>
          <button type="button" aria-label="Search games and pages" onClick={openSearch} className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-[#c3bbea] hover:text-white hover:bg-white/10"><SearchIcon size={20} /></button>

          {username ? (
            <>
              <Link href="/account" className="hidden sm:inline-flex items-center h-9 px-3 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] transition-colors font-mono text-[12.5px] font-semibold text-accentAmber" title="Your total points">
                {(points || 0).toLocaleString()} PTS
              </Link>
              <div className="relative" ref={meRef}>
                <button type="button" onClick={() => setMeOpen((o) => !o)} aria-haspopup="menu" aria-expanded={meOpen} aria-label="Your menu" className="w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-[15px] text-[#0c0620]" style={{ background: "linear-gradient(135deg,#3ee6e0,#ff3ea5)" }}>{initial}</button>
                {meOpen && (
                  <div className="st-menu" role="menu" style={{ top: "calc(100% + 8px)", right: 0 }}>
                    <div className="px-3 pt-2 pb-2">
                      <p className="font-display font-bold text-[15px] truncate max-w-[200px]">{username}</p>
                      <p className="font-mono text-[12px] text-accentAmber">{(points || 0).toLocaleString()} PTS</p>
                    </div>
                    <hr />
                    <Link href="/library" role="menuitem">Your library</Link>
                    <Link href="/account" role="menuitem">Account and plan</Link>
                    {isAdmin && <Link href="/admin" role="menuitem"><span className="text-accentAmber">Admin area</span></Link>}
                    <hr />
                    <button type="button" className="st-menu-item" role="menuitem" onClick={handleSignOut}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="st-btn st-btn-ghost st-btn-sm hidden sm:inline-flex">Log in</Link>
              <Link href="/signup" className="st-btn st-btn-primary st-btn-sm" style={{ "--acc": "#3ee6e0" }}>Sign up</Link>
            </>
          )}
        </div>
      </header>

      {/* Phones: the same places as a tab bar along the bottom — it is what makes the site feel like an app. */}
      <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-[#1d1046]/95 backdrop-blur border-t border-lineColor" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {username ? (
          <>
            <Tab href="/dashboard" label="Store" icon={<StoreIcon />} active={onStore} />
            <Tab href="/library" label="Library" icon={<LibraryIcon />} active={onLibrary} />
            <Tab href="/leaderboard" label="Ranks" icon={<TrophyIcon />} active={pathname.startsWith("/leaderboard")} />
            <Tab href="/account" label="You" icon={<UserIcon />} active={pathname.startsWith("/account")} />
            <button type="button" onClick={() => { haptics.tap(); setMoreOpen(true); }} className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[#a99fd6]" aria-label="More">
              <span className="relative"><MoreIcon />{unreadChangelog > 0 && <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-1 rounded-full bg-accentMagenta text-white text-[9px] font-bold flex items-center justify-center">{unreadChangelog}</span>}</span>
              <span className="text-[10.5px] font-semibold">More</span>
            </button>
          </>
        ) : (
          <>
            <Tab href="/" label="Store" icon={<StoreIcon />} active={pathname === "/"} />
            <Tab href="/games" label="Browse" icon={<LibraryIcon />} active={pathname.startsWith("/games")} />
            <Tab href="/leaderboard" label="Ranks" icon={<TrophyIcon />} active={pathname.startsWith("/leaderboard")} />
            <Tab href="/pricing" label="Pricing" icon={<UserIcon />} active={onPricing} />
          </>
        )}
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/60" onClick={() => setMoreOpen(false)} role="dialog" aria-modal="true" aria-label="More">
          <div className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[#1d1046] border-t border-lineColor p-3 pb-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-3" />
            <div className="st-menu !static !shadow-none !border-0 !bg-transparent !p-0 !min-w-0">
              {[["Tournaments", "/tournaments"], ["Hall of Fame", "/hall-of-fame"], ["Game gallery", "/gallery"], ["Pricing", "/pricing"], ["What's new", "/changelog"], ["Send feedback", "/feedback"]].map(([l, h]) => (
                <Link key={h} href={h}>{l}{h === "/changelog" && unreadChangelog > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accentMagenta text-white text-[11px] font-bold flex items-center justify-center">{unreadChangelog}</span>}</Link>
              ))}
              {isAdmin && <Link href="/admin"><span className="text-accentAmber">Admin area</span></Link>}
              <hr />
              <button type="button" className="st-menu-item" onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({ href, label, icon, active }) {
  return (
    <Link href={href} onClick={() => haptics.tap()} aria-current={active ? "page" : undefined} className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5" style={{ color: active ? "#3ee6e0" : "#a99fd6" }}>
      {icon}
      <span className="text-[10.5px] font-semibold">{label}</span>
    </Link>
  );
}
