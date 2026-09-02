import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";
import CountdownTimer from "@/components/CountdownTimer";
import { getTournaments, getTournamentStandings, isDuelGame } from "@/lib/tournaments";
import { getGames } from "@/lib/games";

export const metadata = {
  title: "Tournaments",
  alternates: { canonical: "/tournaments" },
  description: "Weekly and monthly tournaments on Tap & Score — schedule, standings, and announcements.",
};

// Deliberately public, no auth check — same reasoning as /pricing:
// people should be able to see what's running before they sign up.
export default async function TournamentsPage() {
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
  const ended = tournaments.filter((t) => t.status === "ended").slice(-5).reverse();

  const standingsByTournament = {};
  for (const t of [...active, ...ended]) {
    standingsByTournament[t.id] = await getTournamentStandings(t);
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
            Sign up
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">TOURNAMENTS</h1>
        <p className="text-textDim text-sm mb-2">Weekly and monthly competitive events. Sign up free to take part.</p>
        <p className="font-mono text-[11px] text-accentAmber mb-10">
          👑 Tournament standings are a Power Pass / Legend Pass perk — an active subscription is needed for your
          scores to count toward the leaderboard.
        </p>

        {tournaments.length === 0 && <p className="text-textDim text-sm">No tournaments scheduled right now — check back soon.</p>}

        {active.map((t) => (
          <TournamentCard key={t.id} tournament={t} gameBySlug={gameBySlug} standings={standingsByTournament[t.id]} />
        ))}

        {upcoming.map((t) => (
          <div key={t.id} className="rounded-xl border border-accentAmber/40 bg-bgPanel p-6 mb-6">
            <p className="font-pixel text-[10px] text-accentAmber mb-1">UPCOMING</p>
            <h2 className="font-pixel text-sm text-textLight mb-2">{t.name}</h2>
            {t.description && <p className="text-textDim text-sm mb-4">{t.description}</p>}
            <CountdownTimer targetIso={t.starts_at} size="md" />
            <p className="font-mono text-[10px] text-textDim mt-4">
              {(t.game_slugs || []).map((slug) => gameBySlug[slug]?.name || slug).join(", ")}
            </p>
          </div>
        ))}

        {ended.length > 0 && (
          <>
            <h2 className="font-pixel text-xs text-textDim mt-10 mb-4">RECENT RESULTS</h2>
            {ended.map((t) => (
              <TournamentCard key={t.id} tournament={t} gameBySlug={gameBySlug} standings={standingsByTournament[t.id]} ended />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ tournament, gameBySlug, standings, ended }) {
  return (
    <div className={`rounded-xl border p-6 mb-6 bg-bgPanel ${ended ? "border-lineColor" : "border-accentCyan/50"}`}>
      <p className={`font-pixel text-[10px] mb-1 ${ended ? "text-textDim" : "text-accentCyan"}`}>{ended ? "ENDED" : "LIVE NOW"}</p>
      <h2 className="font-pixel text-sm text-textLight mb-2">{tournament.name}</h2>
      {tournament.description && <p className="text-textDim text-sm mb-3">{tournament.description}</p>}
      {tournament.announcement && (
        <div className="rounded-md border border-accentAmber/40 bg-accentAmber/10 p-3 mb-4">
          <p className="font-mono text-[11px] text-accentAmber">📣 {tournament.announcement}</p>
        </div>
      )}
      {!ended && (
        <p className="font-mono text-[10px] text-textDim mb-4">Ends {new Date(tournament.ends_at).toLocaleString()}</p>
      )}

      {(tournament.game_slugs || []).map((slug) => {
        const game = gameBySlug[slug];
        const rows = standings?.[slug] || [];
        const duel = isDuelGame(slug);
        return (
          <div key={slug} className="mb-5 last:mb-0">
            <p className="font-mono text-xs text-textLight mb-2">
              {game?.icon} {game?.name || slug} <span className="text-textDim">— {duel ? "wins" : "high score"}</span>
            </p>
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
