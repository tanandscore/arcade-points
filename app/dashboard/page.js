import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import StoreHome from "@/components/store/StoreHome";
import { getGames, getComingSoon, getPassPlans } from "@/lib/games";
import { getTournaments } from "@/lib/tournaments";
import { getContinuePlaying, formatRelativeTime } from "@/lib/discovery";
import { currentStreakDays } from "@/lib/achievements";
import { getDailyChallengeStatus } from "@/lib/challenges";
import { getLeaderboardRows } from "@/lib/leaderboard";
import { getSaveSummaries } from "@/lib/progress";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "Store",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

// The signed-in front page of the store. (Upgrade 70: it used to be a long wall of every game plus feeds and tables; it is now
// the same storefront everybody sees, plus the few things that are personal: streak, today's challenges, games in progress.)
export default async function DashboardPage() {
  const v = await getViewer();
  if (!v.user) redirect("/login");
  const { supabase, user } = v;

  const [games, soon, plans, continuePlaying, streakDays, challenges, board, { data: siteSettings }, summaries, tournaments] = await Promise.all([
    getGames(),
    getComingSoon(),
    getPassPlans(),
    getContinuePlaying(user.id, 8),
    currentStreakDays(supabase, user.id),
    getDailyChallengeStatus(supabase, user.id),
    getLeaderboardRows("overall", 5).catch(() => []),
    supabase.from("site_settings").select("launch_countdown_at, launch_countdown_label").eq("id", 1).maybeSingle(),
    getSaveSummaries(supabase, user.id),
    getTournaments().catch(() => []),
  ]);

  const countdown = siteSettings?.launch_countdown_at && new Date(siteSettings.launch_countdown_at) > new Date()
    ? { at: siteSettings.launch_countdown_at, label: siteSettings.launch_countdown_label }
    : null;

  const liveSlugs = new Set(games.map((g) => g.slug));
  const tournament = tournaments.find((t) => t.status === "active" && (t.game_slugs || []).some((s) => liveSlugs.has(s))) || null;

  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const seen = new Set();
  const recent = [];
  for (const row of continuePlaying) {
    const g = bySlug[row.game];
    if (!g || seen.has(g.slug)) continue;
    seen.add(g.slug);
    const s = summaries[g.slug];
    const ago = formatRelativeTime(row.played_at);
    if (g.kit && g.levels && s) {
      recent.push({ game: g, progress: Math.min(1, s.done / g.levels), note: `${Math.min(s.done, g.levels)} of ${g.levels} levels, ${ago}` });
    } else {
      const best = v.bestByGame[g.slug];
      recent.push({ game: g, progress: null, note: best ? `Best ${best.toLocaleString()}, ${ago}` : `Played ${ago}` });
    }
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <StoreHome
        games={games}
        soon={soon}
        viewer={{ tier: v.tier, isAdmin: v.isAdmin }}
        recent={recent}
        challenges={challenges}
        streakDays={streakDays}
        countdown={countdown}
        tournament={tournament}
        plans={plans}
        board={board}
        home="/dashboard"
      />
    </div>
  );
}
