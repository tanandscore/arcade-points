import Link from "next/link";
import { TIERS, tierCovers } from "@/lib/catalog";
import FeaturedCarousel from "./FeaturedCarousel";
import StoreTabs from "./StoreTabs";
import GameCard from "./GameCard";
import Shelf from "./Shelf";
import { PassBand } from "./PassCompare";
import RankMark from "./RankMark";
import CountdownTimer from "@/components/CountdownTimer";
import { CheckIcon, BoltIcon, CloudIcon, TrophyIcon, ArrowRight } from "./Icons";

export const STORE_FAQ = [
  ["Is it really free?", "Yes. An account is free and so are the Free games. The passes are optional and every game says clearly which pass it belongs to."],
  ["Do I need to download anything?", "No. Every game runs in your browser on a phone, tablet or computer. The four flagship 3D games need a laptop or desktop with a keyboard."],
  ["What does a pass include?", "Power Pass adds the Power Pass games on top of everything Free. Legend Pass adds the four flagship games on top of everything else. Both renew monthly or yearly and can be cancelled any time."],
  ["Is my progress saved?", "Yes. Your levels, stars and scores are saved to your account, so you can carry on from another device."],
  ["How do leaderboards work?", "Your best score in each game counts. Scores add up into an overall ranking, and every game has its own top list."],
];

// Who is looking: null when signed out, otherwise { tier: "power" | "legend" | null, isAdmin }.
const canPlay = (viewer, game) => !!viewer && (viewer.isAdmin || tierCovers(viewer.tier || "free", game.tier));

// The rotating showcase at the top: the games marked `featured` in the catalogue, in that order.
export function buildSlides(games, viewer) {
  return games
    .filter((g) => g.featured > 0)
    .sort((a, b) => a.featured - b.featured)
    .slice(0, 5)
    .map((g) => {
      let cta;
      if (!viewer) {
        cta = g.free
          ? { label: "Play free", href: `/signup?next=${encodeURIComponent(`/games/${g.slug}?play=1`)}` }
          : { label: `Unlock with ${g.tierName}`, href: `/games/${g.slug}`, locked: true };
      } else if (canPlay(viewer, g)) {
        cta = { label: "Play now", href: `/games/${g.slug}?play=1` };
      } else {
        cta = { label: `Unlock with ${g.tierName}`, href: `/games/${g.slug}`, locked: true };
      }
      return { slug: g.slug, name: g.name, icon: g.icon, tier: g.tier, genre: g.genre, accentColor: g.accentColor, capsule: g.capsule, tagline: g.tagline, pitch: g.pitch, isNew: g.isNew, cta, details: `/games/${g.slug}` };
    });
}

function IntroStrip({ freeCount }) {
  return (
    <section className="st-panel mb-5 px-5 py-5 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center gap-5 md:gap-10 justify-between" aria-label="Welcome">
      <div className="min-w-0">
        <h1 className="st-h1" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)" }}>Big games in your browser. No downloads, no ads.</h1>
        <p className="st-muted mt-2 text-[15.5px] max-w-[60ch]">Start with {freeCount} free games. Go further with a pass whenever you like. One account keeps your scores and saves everywhere.</p>
      </div>
      <div className="flex flex-wrap gap-3 shrink-0" style={{ "--acc": "#3ee6e0" }}>
        <Link href="/signup" className="st-btn st-btn-primary">Create free account</Link>
        <Link href="/login" className="st-btn st-btn-ghost">Log in</Link>
      </div>
    </section>
  );
}

function TodayStrip({ streakDays, challenges }) {
  const list = challenges || [];
  if (!streakDays && !list.length) return null;
  const done = list.filter((c) => c.completed).length;
  return (
    <section className="st-band mt-5 px-4 py-3.5 sm:px-5 flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Today">
      {streakDays > 0 && (
        <p className="text-[14px] font-semibold flex items-center gap-2 text-accentAmber">
          <BoltIcon size={16} /> {streakDays} day{streakDays === 1 ? "" : "s"} in a row
        </p>
      )}
      {list.length > 0 && (
        <>
          <p className="text-[14px] font-semibold">Today&apos;s challenges <span className="st-muted font-medium">{done} of {list.length}</span></p>
          <ul className="flex flex-wrap gap-2">
            {list.map((c) => (
              <li key={c.id} className="st-chip !h-auto !py-1" style={c.completed ? { background: "rgba(62,230,224,.14)", borderColor: "rgba(62,230,224,.5)", color: "#3ee6e0" } : undefined}>
                {c.completed ? <CheckIcon size={13} /> : <span className="w-[13px] h-[13px] rounded-full border border-current opacity-60 inline-block" aria-hidden />}
                <span className="ml-1.5">{c.description}</span>
                <span className="ml-1.5 opacity-70 font-mono text-[11px]">+{c.xpReward} XP</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Band({ children, color = "#3ee6e0" }) {
  return (
    <section className="mt-5 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}55` }}>
      {children}
    </section>
  );
}

function TierShelf({ tier, games, soon, viewer }) {
  const t = TIERS[tier];
  const live = games.filter((g) => g.tier === tier);
  const upcoming = soon.filter((g) => g.tier === tier);
  if (!live.length && !upcoming.length) return null;
  const cards = [...live, ...upcoming].slice(0, 4);
  const mine = viewer && tier !== "free" && (viewer.isAdmin || tierCovers(viewer.tier || "free", tier));
  const note = mine ? `Included in your plan. ${t.blurb}` : t.blurb;
  const title = (
    <span className="inline-flex items-center gap-2.5">
      <i className="w-2.5 h-2.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 12px ${t.color}` }} aria-hidden />
      {tier === "free" ? "Free to play" : t.name}
    </span>
  );
  const grid = (
    <Shelf id={tier === "free" ? "free" : tier === "power" ? "power-pass" : "legend-pass"} title={title} note={note} href={`/games?tier=${tier}`} hrefLabel="See all" cols={4}>
      {cards.map((g) => (
        <GameCard key={g.slug} game={g} showTier={false} priority={false} />
      ))}
    </Shelf>
  );
  if (tier !== "legend") return grid;
  return (
    <div className="rounded-[26px] p-4 sm:p-6" style={{ background: "linear-gradient(180deg, rgba(255,62,165,.11), rgba(255,62,165,.025))", boxShadow: "inset 0 0 0 1px rgba(255,62,165,.28)" }}>
      {grid}
    </div>
  );
}

function TopPlayers({ board }) {
  if (!board?.length) return null;
  return (
    <section className="st-panel p-5 sm:p-6" aria-label="Top players">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="st-h3">Top players</h2>
        <Link href="/leaderboard" className="st-link text-sm">Leaderboard</Link>
      </div>
      <p className="st-muted mt-1 text-[13px]">Points from every game added together.</p>
      <ol className="mt-4 grid divide-y divide-white/10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-1 sm:divide-y-0 lg:grid-cols-5 lg:gap-x-6">
        {board.slice(0, 5).map((r, i) => (
          <li key={r.userId || r.username} className="flex items-center gap-3 py-2.5">
            <RankMark rank={i + 1} />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:block">
              <span className="block truncate font-semibold text-[14.5px]">{r.username}</span>
              <span className="block text-[14px] font-semibold tabular-nums text-accentAmber">{r.total.toLocaleString()}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Value() {
  const items = [
    [<BoltIcon key="b" size={20} />, "Play in seconds", "Every game runs in the browser, on phone, tablet or computer."],
    [<TrophyIcon key="t" size={20} />, "Real leaderboards", "Your best score counts. Climb each game's list and the overall ranking."],
    [<CloudIcon key="c" size={20} />, "Saved everywhere", "Levels, stars and scores follow your account to any device."],
  ];
  return (
    <section className="st-band grid md:grid-cols-3 gap-6 px-6 py-6" aria-label="Why Tap and Score">
      {items.map(([icon, h, p]) => (
        <div key={h} className="flex gap-3.5">
          <span className="mt-0.5 text-accentCyan shrink-0">{icon}</span>
          <div>
            <h3 className="st-h3">{h}</h3>
            <p className="st-muted text-[14px] mt-1 leading-relaxed">{p}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="faq-h" className="max-w-3xl">
      <h2 id="faq-h" className="st-h2 mb-4">Questions</h2>
      <div className="space-y-2.5">
        {STORE_FAQ.map(([q, a]) => (
          <details key={q} className="st-band group px-5 py-4">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[15px]">
              {q}
              <span className="text-accentCyan text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="st-muted text-[14.5px] mt-3 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// The store front page. The public home (/) and the signed-in home (/dashboard) are this same page: signed-out visitors get a
// short welcome strip and the questions at the bottom; signed-in players get their streak, today's challenges and the games they
// were playing. Everything below the carousel is shelves of games, one per pass.
export default function StoreHome({ games, soon, viewer = null, recent = [], challenges = [], streakDays = 0, countdown = null, tournament = null, plans, board = [], home = "/" }) {
  const slides = buildSlides(games, viewer);
  const freeCount = games.filter((g) => g.tier === "free").length;
  const counts = { power: games.filter((g) => g.tier === "power").length + soon.filter((g) => g.tier === "power").length, legend: games.filter((g) => g.tier === "legend").length };
  const showPasses = !viewer?.isAdmin && viewer?.tier !== "legend";

  return (
    <div className="st-container pt-1 pb-14 sm:pb-16">
      <StoreTabs active="featured" home={home} />
      {!viewer && <IntroStrip freeCount={freeCount} />}
      <FeaturedCarousel slides={slides} />

      {viewer && <TodayStrip streakDays={streakDays} challenges={challenges} />}
      {countdown && (
        <Band color="#3ee6e0">
          <div>
            <p className="font-bold text-[15px]">{countdown.label || "Launching soon"}</p>
            <p className="st-muted text-[13.5px]">Browse everything now. Playing opens when the clock reaches zero.</p>
          </div>
          <CountdownTimer targetIso={countdown.at} size="md" />
        </Band>
      )}
      {tournament && (
        <Band color="#ffb703">
          <div>
            <p className="font-bold text-[15px]">{tournament.name} is live</p>
            <p className="st-muted text-[13.5px]">Compete on the tournament board while it lasts.</p>
          </div>
          <Link href="/tournaments" className="st-btn st-btn-sm st-btn-ghost">Open tournaments</Link>
        </Band>
      )}

      <div className="mt-12 sm:mt-14 space-y-12 sm:space-y-14">
        {recent.length > 0 && (
          <Shelf id="continue" title="Continue playing" cols={4}>
            {recent.slice(0, 4).map((r) => (
              <GameCard key={r.game.slug} game={r.game} showTier={false} progress={r.progress} note={r.note} href={`/games/${r.game.slug}?play=1`} />
            ))}
          </Shelf>
        )}

        <TierShelf tier="free" games={games} soon={soon} viewer={viewer} />
        <TierShelf tier="power" games={games} soon={soon} viewer={viewer} />
        <TierShelf tier="legend" games={games} soon={soon} viewer={viewer} />

        {(showPasses || board.length > 0) && (
          <div className="space-y-5">
            {showPasses && <PassBand tier={viewer?.tier || null} plans={plans} counts={counts} />}
            <TopPlayers board={board} />
          </div>
        )}

        {!viewer && <Value />}
        {!viewer && <Faq />}
      </div>
    </div>
  );
}
