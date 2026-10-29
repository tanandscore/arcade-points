import { redirect } from "next/navigation";
import Link from "next/link";
import { getGames, getPopularGames } from "@/lib/games";
import { getLeaderboardRows, getUserOverallRank, getUserGameRank, LEADERBOARD_DISPLAY_LIMIT } from "@/lib/leaderboard";
import { getViewer } from "@/lib/viewer";
import { TIERS as PASS_TIERS } from "@/lib/catalog";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/store/PageHeader";
import CommunityTabs from "@/components/store/CommunityTabs";
import BoardPicker from "@/components/store/BoardPicker";
import RankMark from "@/components/store/RankMark";
import CountryTag from "@/components/CountryTag";
import PremiumBadge from "@/components/PremiumBadge";
import ShareRankButton from "@/components/ShareRankButton";
import MostPlayedLive from "@/components/MostPlayedLive";
import { extraBoardByKey, extraBoardsOf } from "@/lib/boards";

// Always built fresh for every visit — never a saved copy — so scores
// and "Most played" are current the moment the page opens.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Leaderboard",
  alternates: { canonical: "/leaderboard" },
};

// Three stretches of the table, so a long list reads in chunks. Deliberately capped at LEADERBOARD_DISPLAY_LIMIT, not "everyone
// else" — at real scale that used to mean rendering the entire user base in one response. Your own rank is still shown
// accurately in the box above the table through a dedicated lookup, even when you are outside this displayed range.
const RANGES = [
  { key: "top10", label: "Top 10", start: 0, end: 10, accent: "#ffb703" },
  { key: "next40", label: "11th – 50th", start: 10, end: 50, accent: "#3ee6e0" },
  { key: "rest", label: `51st – ${LEADERBOARD_DISPLAY_LIMIT}th`, start: 50, end: LEADERBOARD_DISPLAY_LIMIT, accent: "#a99fd6" },
];

// the boards one game has: its own, plus any extra boards inside it (Midnight Burn: Mumbai Drift and Tokyo Drift)
function boardsOf(g) {
  const extras = extraBoardsOf(g.slug);
  return [{ key: g.slug, label: extras.length ? `${g.name} · ${extras[0].baseName}` : g.name }, ...extras.map((b) => ({ key: b.key, label: `${g.name} · ${b.name}` }))];
}

export default async function LeaderboardPage({ searchParams }) {
  const { game: gameParam } = await searchParams;
  const activeGame = gameParam || "overall";

  const v = await getViewer();
  if (!v.user) redirect(`/login?next=${encodeURIComponent(activeGame === "overall" ? "/leaderboard" : `/leaderboard?game=${activeGame}`)}`);
  const { user } = v;

  const [games, rows, popularGames, myRankResult] = await Promise.all([
    getGames(),
    getLeaderboardRows(activeGame),
    getPopularGames(10),
    activeGame === "overall" ? getUserOverallRank(user.id) : getUserGameRank(user.id, activeGame),
  ]);

  // "Overall" first, then the games grouped by pass in the same order as the store (Free, Power Pass, Legend Pass)
  const groups = [
    { label: null, items: [{ key: "overall", label: "Overall" }] },
    ...["free", "power", "legend"]
      .map((k) => ({ label: PASS_TIERS[k].name, color: PASS_TIERS[k].color, items: games.filter((g) => g.tier === k).flatMap(boardsOf) }))
      .filter((g) => g.items.length > 0),
  ];

  const activeGameDef = games.find((g) => g.slug === activeGame);
  const activeExtra = extraBoardByKey(activeGame);
  const extraParent = activeExtra && games.find((g) => g.slug === activeExtra.base);
  const baseExtras = activeGameDef ? extraBoardsOf(activeGameDef.slug) : [];
  const title = activeGame === "overall" ? "Overall" : activeExtra ? `${extraParent?.name || activeExtra.base} · ${activeExtra.name}` : baseExtras.length ? `${activeGameDef.name} · ${baseExtras[0].baseName}` : activeGameDef?.name || activeGame;
  const playSlug = activeGameDef?.slug || extraParent?.slug || null;
  // A dedicated rank lookup, not a search through the displayed rows — this is what keeps "your rank" accurate even when you're
  // outside the top 100 shown below.
  const myRank = myRankResult?.rank || null;
  const myTotal = myRankResult ? (myRankResult.total ?? myRankResult.score) : null;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <PageHeader
          title="Leaderboard"
          sub={activeGame === "overall" ? "Total points across every game." : `Best scores in ${title}.`}
        />
        <CommunityTabs active="leaderboard" />

        <div className="mt-6 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12">
          <BoardPicker groups={groups} active={activeGame} activeLabel={title} hrefFor={(k) => `/leaderboard?game=${k}`} />

          <div className="mt-6 min-w-0 lg:mt-0">
            <div className="st-band flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              {myRank ? (
                <>
                  <p className="text-[15px]">
                    <span className="st-muted">Your rank on {title}</span>
                    <span className="st-h3 ml-3 text-[1.25rem]">#{myRank.toLocaleString()}</span>
                    <span className="st-muted ml-3 tabular-nums">{Number(myTotal).toLocaleString()} points</span>
                  </p>
                  <ShareRankButton rank={myRank} total={myTotal} boardName={title} />
                </>
              ) : (
                <p className="st-muted text-[15px]">You haven&apos;t played this board yet. Your score will appear here after your first run.</p>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="st-band mt-6 px-6 py-10 text-center">
                <p className="st-muted">No scores on this board yet. Be the first.</p>
                {playSlug && <Link href={`/games/${playSlug}`} className="st-btn st-btn-primary st-btn-sm mt-4">Play {activeGameDef?.name || extraParent?.name}</Link>}
              </div>
            ) : (
              RANGES.map((range) => {
                const rangeRows = rows.slice(range.start, range.end);
                if (rangeRows.length === 0) return null;
                return (
                  <section key={range.key} className="mt-8" aria-label={range.label}>
                    <h2 className="st-h3 mb-3 flex items-center gap-2" style={{ color: range.accent }}>{range.label}</h2>
                    <ol className="st-panel divide-y divide-white/10 overflow-hidden">
                      {rangeRows.map((row, i) => {
                        const rank = range.start + i + 1;
                        const isMe = row.username === v.username;
                        const canLink = row.username && row.username !== "player";
                        return (
                          <li key={row.userId} className={`flex items-center gap-3 px-4 py-3 text-[15px] ${isMe ? "bg-[rgba(62,230,224,0.09)]" : ""}`}>
                            <RankMark rank={rank} />
                            <span className="flex min-w-0 flex-1 items-center">
                              <CountryTag code={row.country} />
                              {row.isPremium && <PremiumBadge />}
                              {canLink ? (
                                <Link href={`/players/${encodeURIComponent(row.username)}`} className="truncate font-semibold text-[#f5f0ff] hover:underline">{row.username}</Link>
                              ) : (
                                <span className="truncate font-semibold text-[#f5f0ff]">{row.username}</span>
                              )}
                              {isMe && <span className="st-chip ml-2 !h-5 !px-2 !text-[11px]">You</span>}
                            </span>
                            <span className="font-semibold tabular-nums" style={{ color: rank <= 3 ? "#ffb703" : "#f5f0ff" }}>{row.total.toLocaleString()}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })
            )}

            <MostPlayedLive
              initial={popularGames.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon, plays: g.plays, players: g.playerCount }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
