import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGames, getPopularGames } from "@/lib/games";
import { getLeaderboardRows, getUserOverallRank, getUserGameRank, LEADERBOARD_DISPLAY_LIMIT } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import CountryTag from "@/components/CountryTag";
import PremiumBadge from "@/components/PremiumBadge";
import ShareRankButton from "@/components/ShareRankButton";
import MostPlayedLive from "@/components/MostPlayedLive";
import { extraBoardByKey, extraBoardsOf } from "@/lib/boards";

// Always built fresh for every visit — never a saved copy — so scores
// and "Most Played Games" are current the moment the page opens.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Leaderboard",
  alternates: { canonical: "/leaderboard" },
};

const TIERS = [
  { key: "top10", label: "Top 10", start: 0, end: 10, accent: "#ffb703" },
  { key: "next40", label: "11th – 50th", start: 10, end: 50, accent: "#3ee6e0" },
  // Deliberately capped, not "everyone else" — at real scale that
  // used to mean rendering the entire user base in one response.
  // Your own rank is still shown accurately below via a dedicated
  // lookup even when you're outside this displayed range.
  { key: "rest", label: `51st – ${LEADERBOARD_DISPLAY_LIMIT}th`, start: 50, end: LEADERBOARD_DISPLAY_LIMIT, accent: "#a99fd6" },
];

// Real badges by rank — this is the moment a player sees themselves
// recognized, so it should feel like winning something, not just a
// number going up.
function badgeFor(rank) {
  if (rank === 1) return { icon: "🥇", label: "CHAMPION" };
  if (rank === 2) return { icon: "🥈", label: "RUNNER-UP" };
  if (rank === 3) return { icon: "🥉", label: "3RD PLACE" };
  if (rank <= 10) return { icon: "🏅", label: "TOP 10" };
  if (rank <= 50) return { icon: "⭐", label: null };
  return { icon: null, label: null };
}

export default async function LeaderboardPage({ searchParams }) {
  const { game: gameParam } = await searchParams;
  const activeGame = gameParam || "overall";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const admin = await isAdmin(supabase, user.id);
  const [games, rows, popularGames, myRankResult] = await Promise.all([
    getGames(),
    getLeaderboardRows(activeGame),
    getPopularGames(10),
    activeGame === "overall" ? getUserOverallRank(user.id) : getUserGameRank(user.id, activeGame),
  ]);

  // one tab per game, plus one for each extra board inside a game (Midnight Burn: Mumbai Drift and Tokyo Drift)
  const tabs = games.flatMap((g) => {
    const extras = extraBoardsOf(g.slug);
    return [{ key: g.slug, label: extras.length ? `${g.name} · ${extras[0].baseName}` : g.name }, ...extras.map((b) => ({ key: b.key, label: `${g.name} · ${b.name}` }))];
  });
  const activeGameDef = games.find((g) => g.slug === activeGame);
  const activeExtra = extraBoardByKey(activeGame);
  const extraParent = activeExtra && games.find((g) => g.slug === activeExtra.base);
  const baseExtras = activeGameDef ? extraBoardsOf(activeGameDef.slug) : [];
  const title = activeGame === "overall" ? "Overall" : activeExtra ? `${extraParent?.name || activeExtra.base} · ${activeExtra.name}` : baseExtras.length ? `${activeGameDef.name} · ${baseExtras[0].baseName}` : activeGameDef?.name || activeGame;
  const myUsername = profile?.username || user.email;
  // A dedicated rank lookup, not a search through the displayed
  // rows — this is what keeps "your rank" accurate even when you're
  // outside the top 100 shown above.
  const myRank = myRankResult?.rank || null;
  const myTotal = myRankResult ? (myRankResult.total ?? myRankResult.score) : null;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={myUsername} points={0} isAdmin={admin} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="font-pixel text-sm text-textLight">LEADERBOARD</h1>
          {myRank && <ShareRankButton rank={myRank} total={myTotal} boardName={title} />}
        </div>
        <p className="text-textDim text-sm mb-6">
          Showing: <span className="text-accentCyan">{title}</span> ·{" "}
          <Link href="/hall-of-fame" className="text-accentAmber">
            Hall of Fame ▸
          </Link>
        </p>

        <div className="flex flex-wrap gap-1.5 mb-8">
          <Link
            href="/leaderboard?game=overall"
            className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${
              activeGame === "overall" ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"
            }`}
          >
            Overall
          </Link>
          {tabs.map((g) => (
            <Link
              key={g.key}
              href={`/leaderboard?game=${g.key}`}
              className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${
                activeGame === g.key ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"
              }`}
            >
              {g.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-textDim text-sm">No scores yet for this board — be the first.</p>
        ) : (
          TIERS.map((tier) => {
            const tierRows = rows.slice(tier.start, tier.end === Infinity ? rows.length : tier.end);
            if (tierRows.length === 0) return null;
            return (
              <div key={tier.key} className="mb-8">
                <h2 className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: tier.accent }}>
                  {tier.label}
                </h2>
                <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
                  {tierRows.map((row, i) => {
                    const rank = tier.start + i + 1;
                    const isMe = row.username === (profile?.username || user.email);
                    const badge = badgeFor(rank);
                    return (
                      <div
                        key={row.userId}
                        className="flex items-center justify-between px-4 py-2.5 border-b border-lineColor last:border-0 font-mono text-sm"
                        style={{ color: isMe ? "#ffb703" : "#f5f0ff" }}
                      >
                        <span className="flex items-center gap-3">
                          <span className="w-8 flex items-center gap-1">
                            {badge.icon ? <span className="text-base">{badge.icon}</span> : <span className="text-textDim">#{rank}</span>}
                          </span>
                          <CountryTag code={row.country} />
                          {row.isPremium && <PremiumBadge />}
                          <span>{row.username}</span>
                          {badge.label && (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border" style={{ borderColor: tier.accent, color: tier.accent }}>
                              {badge.label}
                            </span>
                          )}
                        </span>
                        <span>{row.total.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <MostPlayedLive
          initial={popularGames.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon, plays: g.plays, players: g.playerCount }))}
        />
      </div>
    </div>
  );
}
