import Link from "next/link";
import Navbar from "@/components/Navbar";
import TournamentCountdown from "@/components/TournamentCountdown";
import { createServerSupabase } from "@/lib/supabaseServer";
import { hasAnySubscription } from "@/lib/access";
import { getTournaments, getTournamentStandings, getTournamentWinners, isDuelGame } from "@/lib/tournaments";
import { getGames } from "@/lib/games";

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

// Deliberately public, no auth check that blocks access — same
// reasoning as /pricing: people should be able to see what's running
// before they sign up. The user lookup below is optional (never
// redirects), used only to power the Navbar correctly for a logged-in
// visitor and to know whether to show "Play Now" or an upgrade
// prompt next to each tournament's games.
export default async function TournamentsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let username = null;
  let isAdmin = false;
  let subscribed = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, is_admin, is_premium, bonus_subscription_until")
      .eq("id", user.id)
      .single();
    username = profile?.username || user.email;
    isAdmin = profile?.is_admin === true;
    if (isAdmin) {
      subscribed = true;
    } else {
      subscribed = await hasAnySubscription(supabase, user.id, profile);
    }
  }

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
      <Navbar username={username} points={0} isAdmin={isAdmin} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">TOURNAMENTS</h1>
        <p className="text-textDim text-sm mb-2">Weekly and monthly competitive events.</p>
        <p className="font-mono text-[11px] text-accentAmber mb-6">
          👑 Playing tournament games requires an active Power Pass / Legend Pass subscription — anyone can browse
          tournaments and see standings for free.
        </p>

        {active.filter((t) => t.announcement).map((t) => (
          <div
            key={t.id}
            className="rounded-xl border-2 border-accentAmber bg-gradient-to-r from-accentAmber/20 via-accentAmber/10 to-accentAmber/20 p-4 mb-4 animate-announce-pulse"
          >
            <p className="font-mono text-sm text-accentAmber font-bold text-center">📣 {t.announcement}</p>
          </div>
        ))}
        <div className="mb-4" />

        {tournaments.length === 0 && <p className="text-textDim text-sm">No tournaments scheduled right now — check back soon.</p>}

        {active.map((t) => (
          <TournamentCard key={t.id} tournament={t} gameBySlug={gameBySlug} standings={standingsByTournament[t.id]} subscribed={subscribed} />
        ))}

        {upcoming.map((t) => (
          <div key={t.id} className="rounded-xl border border-accentAmber/40 bg-bgPanel p-6 mb-6">
            <p className="font-pixel text-[10px] text-accentAmber mb-1">UPCOMING</p>
            <h2 className="font-pixel text-sm text-textLight mb-2">{t.name}</h2>
            {t.description && <p className="text-textDim text-sm mb-4">{t.description}</p>}
            <TournamentCountdown targetIso={t.starts_at} size="md" />
            <p className="font-mono text-[10px] text-textDim mt-4">
              {(t.game_slugs || []).map((slug) => gameBySlug[slug]?.name || slug).join(", ")}
            </p>
          </div>
        ))}

        {pastForWinners.length > 0 && (
          <>
            <h2 className="font-pixel text-xs text-textDim mt-10 mb-4">🏆 PAST WINNERS</h2>
            <div className="rounded-xl border border-lineColor bg-bgPanel divide-y divide-lineColor">
              {pastForWinners.map((t) => {
                const winners = getTournamentWinners(standingsByTournament[t.id]);
                const dateStamp = new Date(t.ends_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
                return (
                  <div key={t.id} className="p-4">
                    <div className="flex justify-between items-baseline mb-2 flex-wrap gap-1">
                      <p className="font-mono text-sm text-textLight">{t.name}</p>
                      <p className="font-mono text-[10px] text-textDim">{dateStamp}</p>
                    </div>
                    {Object.keys(winners).length === 0 ? (
                      <p className="font-mono text-[10px] text-textDim">No scores were recorded.</p>
                    ) : (
                      <div className="space-y-1">
                        {(t.game_slugs || []).map((slug) => {
                          const w = winners[slug];
                          if (!w) return null;
                          const game = gameBySlug[slug];
                          return (
                            <p key={slug} className="font-mono text-[11px] text-textDim">
                              {game?.icon} {game?.name || slug}: <span className="text-accentAmber">🥇 {w.username}</span>{" "}
                              <span>({w.value.toLocaleString()})</span>
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Only ever rendered for active tournaments now — past results are
// shown via the compact Past Winners list instead, so the ended-vs-
// live conditional branches this used to carry were removed rather
// than left in as dead code that would never actually trigger.
function TournamentCard({ tournament, gameBySlug, standings, subscribed }) {
  return (
    <div className="rounded-xl border p-6 mb-6 bg-bgPanel border-accentCyan/50">
      <p className="font-pixel text-[10px] mb-1 text-accentCyan">LIVE NOW</p>
      <h2 className="font-pixel text-sm text-textLight mb-2">{tournament.name}</h2>
      {tournament.description && <p className="text-textDim text-sm mb-3">{tournament.description}</p>}
      <p className="font-mono text-[10px] text-textDim mb-4">Ends {new Date(tournament.ends_at).toLocaleString()}</p>

      {(tournament.game_slugs || []).map((slug) => {
        const game = gameBySlug[slug];
        const rows = standings?.[slug] || [];
        const duel = isDuelGame(slug);
        return (
          // Its own bordered section, not just a text label above the
          // standings — the game itself, and how to play it, is the
          // thing a visitor should see clearly and separately from
          // the results table underneath it.
          <div key={slug} className="rounded-lg border border-lineColor bg-bgPanel3/40 p-4 mb-4 last:mb-0">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="font-mono text-sm text-textLight">
                {game?.icon} {game?.name || slug} <span className="text-textDim text-xs">— {duel ? "wins" : "high score"}</span>
              </p>
              {game && (
                subscribed ? (
                  <Link href={`/games/${slug}?via=tournament`} className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep">
                    ▶ Play Now
                  </Link>
                ) : (
                  <Link href="/pricing" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-accentAmber text-accentAmber">
                    👑 Subscribe to Play
                  </Link>
                )
              )}
            </div>
            {rows.length === 0 ? (
              <p className="font-mono text-[10px] text-textDim">No scores yet — be the first.</p>
            ) : (
              <div className="space-y-1">
                {rows.slice(0, 10).map((r, i) => (
                  <div key={r.userId} className="flex justify-between font-mono text-[11px]">
                    <span className="text-textLight">
                      {i + 1}. {r.username}
                    </span>
                    <span className="text-textDim">{r.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
