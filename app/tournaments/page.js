import Link from "next/link";
import Navbar from "@/components/Navbar";
import TournamentCountdown from "@/components/TournamentCountdown";
import PageHeader from "@/components/store/PageHeader";
import CommunityTabs from "@/components/store/CommunityTabs";
import RankMark from "@/components/store/RankMark";
import { hasAnySubscription } from "@/lib/access";
import { getTournaments, getTournamentStandings, getTournamentWinners, isDuelGame } from "@/lib/tournaments";
import { getGames } from "@/lib/games";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "Tournaments",
  alternates: { canonical: "/tournaments" },
  description: "Weekly and monthly tournaments on Tap & Score — schedule, standings, and announcements.",
};

// Forces this page to always render at request time on the Cloudflare
// Worker, never prerendered as static HTML during the build. This is
// the actual fix for the real build failure this caused: getTournaments()
// and getTournamentStandings() (lib/tournaments.js) use the service-role
// Supabase client, which — unlike the cookie-based client getGames()
// elsewhere uses — gives Next.js no automatic signal that this route
// needs per-request rendering. Without this, Next.js tried to prerender
// the page during `next build`, which meant actually calling those
// functions at BUILD time — and the service-role key isn't available
// during Cloudflare's build step (only at runtime), so the build failed
// with "supabaseKey is required."
export const dynamic = "force-dynamic";

// Times are shown in UTC and say so, so nobody has to guess which time zone a deadline is in.
const fmtUtc = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const fmtDay = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Deliberately public, no auth check that blocks access — same
// reasoning as /pricing: people should be able to see what's running
// before they sign up. The viewer lookup below is optional (never
// redirects), used only to power the top bar correctly for a signed-in
// visitor and to know whether to show "Play now" or an upgrade
// prompt next to each tournament's games.
export default async function TournamentsPage() {
  const v = await getViewer();
  let subscribed = false;
  if (v.user) subscribed = v.isAdmin ? true : await hasAnySubscription(v.supabase, v.user.id, v.profile);

  // Deliberately the default getGames() (excludes admin_test_only
  // games) — this page is public, and a test-only game accidentally
  // added to a tournament shouldn't leak its name/icon to visitors
  // who aren't supposed to know it exists yet. It'll just fall back
  // to showing the raw slug, which is a fair signal to the admin to
  // publish the game or remove it from the tournament.
  const [tournaments, games] = await Promise.all([getTournaments(), getGames()]);
  const gameBySlug = Object.fromEntries(games.map((g) => [g.slug, g]));

  const active = tournaments.filter((t) => t.status === "active");
  const upcoming = tournaments.filter((t) => t.status === "upcoming");
  // Capped at the most recent 15, not "every ended tournament ever" —
  // the same reasoning the leaderboard already uses elsewhere: at
  // real scale that becomes an unbounded, ever-growing query and
  // page. Filtered by show_in_winners_list, the admin's per-tournament
  // control over what's public without deleting the underlying data.
  const pastForWinners = tournaments
    .filter((t) => t.status === "ended" && t.show_in_winners_list !== false)
    .slice(-15)
    .reverse();

  const standingsByTournament = {};
  for (const t of [...active, ...pastForWinners]) {
    standingsByTournament[t.id] = await getTournamentStandings(t);
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <PageHeader title="Tournaments" sub="Weekly and monthly competitive events." />
        <CommunityTabs active="tournaments" />

        <div className="mt-8 max-w-3xl space-y-6">
          <p className="st-muted text-[14.5px] leading-relaxed">
            Playing tournament games requires an active Power Pass or Legend Pass subscription. Anyone can browse tournaments and see standings for free.
          </p>

          {active.filter((t) => t.announcement).map((t) => (
            <div key={t.id} className="animate-announce-pulse rounded-2xl border border-accentAmber/60 bg-accentAmber/10 px-5 py-4 text-center text-[15px] font-semibold text-accentAmber">
              📣 {t.announcement}
            </div>
          ))}

          {tournaments.length === 0 && (
            <div className="st-band px-6 py-10 text-center">
              <p className="st-muted">No tournaments scheduled right now. Check back soon.</p>
            </div>
          )}

          {active.map((t) => (
            <TournamentCard key={t.id} tournament={t} gameBySlug={gameBySlug} standings={standingsByTournament[t.id]} subscribed={subscribed} />
          ))}

          {upcoming.map((t) => (
            <section key={t.id} className="st-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 3px 0 #ffb703" }}>
              <span className="st-chip !border-accentAmber/50 !text-accentAmber">Upcoming</span>
              <h2 className="st-h2 mt-3">{t.name}</h2>
              {t.description && <p className="st-muted mt-1.5 text-[15px] leading-relaxed">{t.description}</p>}
              <div className="mt-5">
                <p className="mb-2 text-[13px] text-[#a99fd6]">Starts in</p>
                <TournamentCountdown targetIso={t.starts_at} size="md" align="start" />
              </div>
              <p className="mt-5 text-[14px] text-[#c3bbea]">
                <span className="text-[#a99fd6]">Games: </span>
                {(t.game_slugs || []).map((slug) => gameBySlug[slug]?.name || slug).join(", ")}
              </p>
            </section>
          ))}

          {pastForWinners.length > 0 && (
            <section className="pt-4" aria-label="Past winners">
              <h2 className="st-h2 mb-3">Past winners</h2>
              <ul className="st-panel divide-y divide-white/10 overflow-hidden">
                {pastForWinners.map((t) => {
                  const winners = getTournamentWinners(standingsByTournament[t.id]);
                  return (
                    <li key={t.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="font-semibold text-[#f5f0ff]">{t.name}</p>
                        <p className="text-[13px] text-[#a99fd6]">{fmtDay(t.ends_at)}</p>
                      </div>
                      {Object.keys(winners).length === 0 ? (
                        <p className="mt-1.5 text-[14px] text-[#c3bbea]">No scores were recorded.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {(t.game_slugs || []).map((slug) => {
                            const w = winners[slug];
                            if (!w) return null;
                            const game = gameBySlug[slug];
                            return (
                              <li key={slug} className="text-[14px] text-[#c3bbea]">
                                {game?.icon} {game?.name || slug}: <span className="font-semibold text-accentAmber">{w.username}</span>{" "}
                                <span className="tabular-nums">({w.value.toLocaleString()})</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// Only ever rendered for active tournaments now — past results are
// shown via the compact Past Winners list instead, so the ended-vs-
// live conditional branches this used to carry were removed rather
// than left in as dead code that would never actually trigger.
function TournamentCard({ tournament, gameBySlug, standings, subscribed }) {
  return (
    <section className="st-panel p-5 sm:p-6" style={{ boxShadow: "inset 0 3px 0 #3ee6e0" }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="st-chip !border-accentCyan/50 !text-accentCyan"><i className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-accentCyan" />Live now</span>
        <p className="text-[13px] text-[#a99fd6]">Ends {fmtUtc(tournament.ends_at)}</p>
      </div>
      <h2 className="st-h2 mt-3">{tournament.name}</h2>
      {tournament.description && <p className="st-muted mt-1.5 text-[15px] leading-relaxed">{tournament.description}</p>}

      <div className="mt-5 space-y-4">
        {(tournament.game_slugs || []).map((slug) => {
          const game = gameBySlug[slug];
          const rows = standings?.[slug] || [];
          const duel = isDuelGame(slug);
          return (
            // Its own boxed section, not just a text label above the
            // standings — the game itself, and how to play it, is the
            // thing a visitor should see clearly and separately from
            // the results table underneath it.
            <div key={slug} className="st-band p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[16px] font-semibold text-[#f5f0ff]">
                  {game?.icon} {game?.name || slug} <span className="ml-1 text-[13.5px] font-normal text-[#a99fd6]">{duel ? "most wins" : "high score"}</span>
                </p>
                {game && (
                  subscribed ? (
                    <Link href={`/games/${slug}?via=tournament`} className="st-btn st-btn-primary st-btn-sm">Play now</Link>
                  ) : (
                    <Link href="/pricing" className="st-btn st-btn-ghost st-btn-sm">Get a pass to play</Link>
                  )
                )}
              </div>
              {rows.length === 0 ? (
                <p className="mt-3 text-[14px] text-[#c3bbea]">No scores yet. Be the first.</p>
              ) : (
                <ol className="mt-3 divide-y divide-white/10">
                  {rows.slice(0, 10).map((r, i) => (
                    <li key={r.userId} className="flex items-center gap-3 py-2 text-[14.5px]">
                      <RankMark rank={i + 1} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-[#f5f0ff]">{r.username}</span>
                      <span className="tabular-nums text-[#c3bbea]">{r.value.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
