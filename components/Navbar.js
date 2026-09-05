"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { haptics } from "@/lib/haptics";

const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

export default function Navbar({ username, points, isAdmin }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [unreadChangelog, setUnreadChangelog] = useState(0);

  // Fetched client-side here rather than passed as a prop from every
  // one of the 13 pages that render this component — adding that
  // prop everywhere would mean touching 13 separate server
  // components just to surface one badge count. This component
  // already has its own Supabase client for sign-out, so one more
  // small fetch on mount is the far lower-risk way to get real,
  // per-user unread data onto every page without restructuring how
  // this component is used.
  useEffect(() => {
    if (!username) return;
    fetch("/api/changelog/unread-count")
      .then((r) => r.json())
      .then((d) => setUnreadChangelog(d.count || 0))
      .catch(() => {});
  }, [username]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="relative px-4 py-3 sm:px-6 sm:py-4 border-b border-lineColor bg-bgPanel">
        <div className="flex justify-center gap-2 mb-2">
          {new Array(18).fill(0).map((_, i) => {
            const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
            return (
              <span
                key={i}
                className="ap-marquee-light inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color, color, animationDelay: `${(i % 6) * 0.12}s` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
          <Link href={username ? "/dashboard" : "/"} className="font-pixel text-sm sm:text-base text-textLight">
            TAP & SCORE
          </Link>
          {username ? (
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Home
              </Link>
              {isAdmin && (
                <Link href="/admin" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-accentAmber text-accentAmber hidden sm:inline-block">
                  ★ Admin
                </Link>
              )}
              <Link href="/account" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Account
              </Link>
              <Link href="/leaderboard" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Leaderboard
              </Link>
              <Link href="/tournaments" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Tournaments
              </Link>
              <Link href="/feedback" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Feedback
              </Link>
              <Link href="/changelog" className="relative font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                What&apos;s New
                {unreadChangelog > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-accentMagenta text-white text-[9px] flex items-center justify-center">
                    {unreadChangelog}
                  </span>
                )}
              </Link>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase text-textDim">{username}</div>
                <div className="font-mono text-sm font-semibold text-accentAmber">
                  {(points || 0).toLocaleString()} PTS
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/tournaments" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hidden sm:inline-block">
                Tournaments
              </Link>
              <Link href="/login" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim">
                Log in
              </Link>
              <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tab bar — mobile only. This one thing does more than
          anything else to make the site feel like an installed app
          rather than a page in a browser tab. */}
      {username && (
        <nav
          className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-bgPanel border-t border-lineColor"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <TabLink href="/dashboard" label="Games" icon="🎮" active={pathname === "/dashboard"} />
          <TabLink href="/leaderboard" label="Ranks" icon="🏆" active={pathname === "/leaderboard"} />
          <TabLink href="/hall-of-fame" label="Fame" icon="🏛️" active={pathname === "/hall-of-fame"} />
          <TabLink href="/account" label="Account" icon="⚙️" active={pathname === "/account"} />
          <TabLink href="/changelog" label="New" icon="🔔" active={pathname === "/changelog"} badge={unreadChangelog} />
          {isAdmin ? (
            <TabLink href="/admin" label="Admin" icon="★" active={pathname === "/admin"} />
          ) : (
            <button onClick={handleSignOut} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-textDim">
              <span className="text-lg leading-none">🚪</span>
              <span className="font-mono text-[9px]">Sign out</span>
            </button>
          )}
        </nav>
      )}
    </>
  );
}

function TabLink({ href, label, icon, active, badge }) {
  return (
    <Link
      href={href}
      onClick={() => haptics.tap()}
      className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
      style={{ color: active ? "#ffb703" : "#a99fd6" }}
    >
      <span className="relative text-lg leading-none">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-1 rounded-full bg-accentMagenta text-white text-[8px] flex items-center justify-center">
            {badge}
          </span>
        )}
      </span>
      <span className="font-mono text-[9px]">{label}</span>
    </Link>
  );
}
