import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGames, getPopularGames } from "@/lib/games";
import { getLeaderboardRows } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/admin";
import Navbar from "@/components/Navbar";
import CountryTag from "@/components/CountryTag";
import PremiumBadge from "@/components/PremiumBadge";
import ShareRankButton from "@/components/ShareRankButton";

export const metadata = {
  title: "Leaderboard",
  alternates: { canonical: "/leaderboard" },
};

const TIERS = [
  { key: "top10", label: "Top 10", start: 0, end: 10, accent: "#ffb703" },
  { key: "next40", label: "11th – 50th", start: 10, end: 50, accent: "#3ee6e0" },
  { key: "rest", label: "51st & beyond", start: 50, end: Infinity, accent: "#a99fd6" },
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
  const [games, rows, popularGames] = await Promise.all([getGames(), getLeaderboardRows(activeGame), getPopularGames(10)]);

  const activeGameDef = games.find((g) => g.slug === activeGame);
  const title = activeGame === "overall" ? "Overall" : activeGameDef?.name || activeGame;
  const myUsername = profile?.username || user.email;
  const myIndex = rows.findIndex((r) => r.username === myUsername);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <Navbar username={myUsername} points={0} isAdmin={admin} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="font-pixel text-sm text-textLight">LEADERBOARD</h1>
          {myRank && <ShareRankButton rank={myRank} total={myRow.total} boardName={title} />}
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
          {games.map((g) => (
            <Link
              key={g.slug}
              href={`/leaderboard?game=${g.slug}`}
              className={`font-mono text-[10px] px-2.5 py-1 rounded-md border ${
                activeGame === g.slug ? "bg-accentCyan text-bgDeep border-accentCyan" : "border-lineColor text-textDim"
              }`}
            >
              {g.name}
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

        {popularGames.length > 0 && (
          <div className="mt-12 pt-8 border-t border-lineColor">
            <h2 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">🔥 Most Played Games</h2>
            <div className="rounded-xl border border-lineColor bg-bgPanel overflow-hidden">
              {popularGames.map((game, i) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-lineColor last:border-0 hover:bg-bgPanel3 transition-colors font-mono text-sm"
                >
                  <span className="text-textDim w-8">#{i + 1}</span>
                  <span className="text-lg">{game.icon}</span>
                  <span className="text-textLight">{game.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
