import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import FungiesSubscribeButton from "@/components/account/FungiesSubscribeButton";
import CountdownTimer from "@/components/CountdownTimer";
import GameShare from "@/components/GameShare";
import GameHero from "@/components/store/GameHero";
import GameCard from "@/components/store/GameCard";
import Shelf from "@/components/store/Shelf";
import FavButton from "@/components/store/Favs";
import { CheckIcon, PlayIcon } from "@/components/store/Icons";
import { getGames, getStoreGame, getComingSoon } from "@/lib/games";
import { isRetired, TIERS } from "@/lib/catalog";
import { gameVideoGameJsonLd } from "@/lib/structuredData";
import { hasSubscriptionAccess, hasAnySubscription } from "@/lib/access";
import { getTournaments, findActiveTournamentForGame } from "@/lib/tournaments";
import { getSaveSummary } from "@/lib/progress";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const game = await getStoreGame(slug);
  if (!game) return {};
  const soon = game.status === "soon";
  const title = soon ? `${game.name} - coming soon` : game.free ? `${game.name} - Play Free Online` : `${game.name} - Play Online`;
  const description = soon
    ? `${game.tagline} ${game.name} is coming soon to ${game.tierName} on Tap & Score.`
    : game.free
    ? `${game.tagline} Play ${game.name} free on Tap & Score and climb the leaderboard.`
    : `${game.tagline} Play ${game.name} with ${game.tierName} on Tap & Score and climb the leaderboard.`;
  // The game's own capsule picture is the share image (it exists for every playable game). Announced games use the site image.
  const ogImage = soon ? "/og-image-v3.png" : game.capsule;
  return {
    title,
    description,
    alternates: { canonical: `/games/${game.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, images: [{ url: ogImage, alt: game.name }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

const enc = encodeURIComponent;

function Box({ title, tone = "#ffb703", children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: `${tone}14`, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
      <p className="font-bold text-[15.5px]" style={{ color: tone }}>{title}</p>
      <div className="st-muted text-[14px] mt-1.5 leading-relaxed">{children}</div>
    </div>
  );
}

// "Related" = same genre first, then same pass, with games you can play now ahead of announced ones.
function pickRelated(game, live, soon, n = 4) {
  return [...live, ...soon]
    .filter((g) => g.slug !== game.slug)
    .map((g) => ({ g, score: (g.genre === game.genre ? 4 : 0) + (g.tier === game.tier ? 2 : 0) + (g.status === "live" ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.g.order - b.g.order)
    .slice(0, n)
    .map((x) => x.g);
}

export default async function GamePage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;

  // Games that were retired in the store overhaul: send old links (search results, shared links) to the store.
  if (isRetired(slug)) redirect("/games");

  const game = await getStoreGame(slug);
  if (!game) notFound();
  const soon = game.status === "soon";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // site_settings allows public reads, so a signed-out visitor sees the true countdown / maintenance state too.
  const { data: siteSettings } = await supabase.from("site_settings").select("launch_countdown_at, launch_countdown_label").eq("id", 1).maybeSingle();
  const countdownAtAll = !!(siteSettings?.launch_countdown_at && new Date(siteSettings.launch_countdown_at) > new Date());

  const [live, comingSoon] = await Promise.all([getGames(), getComingSoon()]);
  const related = pickRelated(game, live, comingSoon);
  const passPlan = game.tier !== "free";
  const tone = TIERS[game.tier].color;

  let profile = null;
  let username = null;
  let totalPoints = 0;
  let best = 0;
  let owned = false;
  let tournamentLocked = false;
  let exclusiveLocked = false;
  let exclusiveTournamentName = null;
  let cleared = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("username, is_admin, is_premium, bonus_subscription_until").eq("id", user.id).single();
    profile = data;
    username = profile?.username || user.email;

    // An admin-test-only game is fully playable but invisible to everyone except admins.
    if (!soon && game.adminTestOnly && !profile?.is_admin) notFound();

    const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);
    for (const r of scores || []) {
      totalPoints += r.score;
      if (r.game === slug) best = Math.max(best, r.score);
    }

    if (!soon) {
      // Admins play everything. Free games are open to everyone signed in. Pass games need a pass that covers the game's tier.
      owned = game.accessType === "free" || profile?.is_admin === true;
      if (!owned && game.accessType === "subscription") {
        owned = await hasSubscriptionAccess(supabase, user.id, game.subscriptionPlanId, profile);
      }

      // A game inside an active tournament needs a subscription for the duration, even a normally free one, and a tournament can
      // also be "exclusive": playable only through the tournament page's own link. (?via=tournament is a steering signal, not
      // security: the real access check is the subscription test above.)
      if (!profile?.is_admin) {
        const tournaments = await getTournaments();
        const active = findActiveTournamentForGame(tournaments, slug);
        if (active) {
          const subscribed = await hasAnySubscription(supabase, user.id, profile);
          if (!subscribed) {
            owned = false;
            tournamentLocked = true;
          } else if (active.require_tournament_entry && sp?.via !== "tournament") {
            owned = false;
            exclusiveLocked = true;
            exclusiveTournamentName = active.name;
          }
        }
      }

      if (game.kit) {
        const summary = await getSaveSummary(supabase, user.id, slug);
        if (summary && game.levels) cleared = { done: Math.min(summary.done, game.levels), total: game.levels, stars: summary.stars };
      }
    }
  } else if (!soon && game.adminTestOnly) {
    notFound(); // a signed-out visitor can never be an admin
  }

  const countdownActive = countdownAtAll && !profile?.is_admin;
  const blocked = soon || game.underMaintenance || countdownActive;
  const canPlay = !!user && owned && !blocked;
  const autoPlay = sp?.play === "1" || sp?.play === "true";
  const playPath = `/games/${slug}?play=1`;

  // ---- the box that replaces the Play button when the player cannot press it ----
  let action = null;
  if (soon) {
    action = (
      <Box title="Coming soon" tone={game.accentColor}>
        <p>{game.name} is being built right now and will arrive as part of {game.tierName}. Add it to your favourites to find it again easily.</p>
        <div className="mt-4 flex flex-wrap gap-2.5" style={{ "--acc": game.accentColor }}>
          <FavButton slug={game.slug} name={game.name} />
          <Link href="/games?tier=free" className="st-btn st-btn-sm st-btn-ghost">Play free games now</Link>
        </div>
      </Box>
    );
  } else if (game.underMaintenance) {
    action = (
      <Box title="Updating right now">
        <p>{game.name} is getting a quick update behind the scenes. This usually takes just a few minutes, so check back shortly. Everything else on the site is working normally.</p>
      </Box>
    );
  } else if (countdownActive) {
    action = (
      <Box title={siteSettings.launch_countdown_label || "Launching soon"} tone="#3ee6e0">
        <p className="mb-4">You can browse and set up your account now. {game.name} unlocks the moment the clock reaches zero.</p>
        <CountdownTimer targetIso={siteSettings.launch_countdown_at} size="md" />
        {!user && (
          <Link href="/signup" className="st-btn st-btn-primary w-full mt-4" style={{ "--acc": "#3ee6e0" }}>Sign up to be ready</Link>
        )}
      </Box>
    );
  } else if (!user) {
    action = game.free ? (
      <div className="space-y-3" style={{ "--acc": game.accentColor }}>
        <Link href={`/signup?next=${enc(playPath)}`} className="st-btn st-btn-primary w-full !h-[54px] !text-[16px]"><PlayIcon size={18} /> Play free</Link>
        <Link href={`/login?next=${enc(playPath)}`} className="st-btn st-btn-ghost w-full">I already have an account</Link>
        <p className="st-muted text-[12.5px] leading-relaxed">A free account keeps your scores, stars and saves. It takes about a minute.</p>
      </div>
    ) : (
      <div className="space-y-3" style={{ "--acc": tone }}>
        <Box title={`Part of ${game.tierName}`} tone={tone}>
          <p>{game.priceDisplay || game.subscriptionPlanFungiesPriceDisplayMonthly ? `${game.subscriptionPlanFungiesPriceDisplayMonthly || game.priceDisplay} a month. ` : ""}One pass unlocks every {game.tierName} game, including new ones, plus every Free game.</p>
        </Box>
        <Link href={`/signup?next=${enc(`/games/${slug}`)}`} className="st-btn st-btn-primary w-full !h-[54px] !text-[16px]">Sign up to unlock</Link>
        <Link href={`/login?next=${enc(`/games/${slug}`)}`} className="st-btn st-btn-ghost w-full">I already have an account</Link>
      </div>
    );
  } else if (tournamentLocked) {
    action = (
      <Box title="Tournament lock">
        <p>{game.name} is part of an active tournament right now. Playing it, even though it is normally free, needs a subscription while the tournament runs.</p>
        <Link href="/pricing" className="st-btn st-btn-sm st-btn-primary mt-4" style={{ "--acc": "#ffb703" }}>See the passes</Link>
      </Box>
    );
  } else if (exclusiveLocked) {
    action = (
      <Box title="Tournament exclusive">
        <p>{game.name} is locked to {exclusiveTournamentName} right now. Open it from the tournament page so your run counts toward the tournament board.</p>
        <Link href="/tournaments" className="st-btn st-btn-sm st-btn-primary mt-4" style={{ "--acc": "#ffb703" }}>Go to tournaments</Link>
      </Box>
    );
  } else if (!owned) {
    action = (
      <div className="space-y-4">
        <Box title={`Part of ${game.tierName}`} tone={tone}>
          <p>One pass unlocks every {game.tierName} game, including the new ones we add, plus every Free game, for as long as it is active.</p>
        </Box>
        <FungiesSubscribeButton
          fungiesCheckoutUrlMonthly={game.subscriptionPlanFungiesCheckoutUrlMonthly}
          fungiesCheckoutUrlAnnual={game.subscriptionPlanFungiesCheckoutUrlAnnual}
          priceDisplayMonthly={game.subscriptionPlanFungiesPriceDisplayMonthly}
          priceDisplayAnnual={game.subscriptionPlanFungiesPriceDisplayAnnual}
          planId={game.subscriptionPlanId}
          planName={game.tierName}
          userId={user.id}
          accent={tone}
        />
      </div>
    );
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tap & Score", item: "https://tapandscore.com/" },
      { "@type": "ListItem", position: 2, name: game.tierName, item: `https://tapandscore.com/games?tier=${game.tier}` },
      { "@type": "ListItem", position: 3, name: game.name, item: `https://tapandscore.com/games/${game.slug}` },
    ],
  };
  const home = user ? "/dashboard" : "/";

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      {!soon && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameVideoGameJsonLd(game)) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />

      <main className="st-container pt-5 pb-16">
        <nav aria-label="Breadcrumb" className="text-[13.5px] st-muted flex items-center gap-2 flex-wrap">
          <Link href={home} className="hover:text-white">Store</Link>
          <span aria-hidden>/</span>
          <Link href={`/games?tier=${game.tier}`} className="hover:text-white" style={{ color: tone }}>{game.tierName}</Link>
          <span aria-hidden>/</span>
          <span className="text-[#f5f0ff]" aria-current="page">{game.name}</span>
        </nav>

        <div className="mt-3 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="st-h1" style={{ fontSize: "clamp(2rem, 4.4vw, 3.1rem)" }}>{game.name}</h1>
          {!soon && <FavButton slug={game.slug} name={game.name} />}
        </div>

        {profile?.is_admin && passPlan && !soon && (
          <p className="mb-4 text-[13px] text-accentAmber">Admin access: unlocked for you.</p>
        )}

        <GameHero
          game={game}
          canPlay={canPlay}
          autoPlay={autoPlay}
          action={action}
          best={best}
          cleared={cleared}
          related={related.filter((g) => g.status === "live").slice(0, 2).map((g) => ({ slug: g.slug, name: g.name, icon: g.icon }))}
        />

        <div className="mt-12 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-12 items-start">
          <div className="space-y-10 min-w-0">
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="st-h2 mb-3">About this game</h2>
              <div className="st-prose">
                {game.about.map((p) => <p key={p}>{p}</p>)}
              </div>
            </section>

            {game.features.length > 0 && (
              <section aria-labelledby="inside-h">
                <h2 id="inside-h" className="st-h2 mb-4">What&apos;s inside</h2>
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {game.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[15px] leading-snug">
                      <span className="mt-[3px] shrink-0" style={{ color: game.accentColor }}><CheckIcon size={16} /></span>
                      <span className="text-[#e6e0ff]">{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {game.controls && (
              <section aria-labelledby="controls-h">
                <h2 id="controls-h" className="st-h2 mb-4">Controls</h2>
                <div className="st-band overflow-hidden">
                  <table className="w-full text-[14.5px]">
                    <tbody className="divide-y divide-white/10">
                      {game.controls.map(([k, v]) => (
                        <tr key={k}>
                          <th scope="row" className="text-left font-mono text-[13.5px] font-semibold px-4 py-3 w-[44%] align-top" style={{ color: game.accentColor }}>{k}</th>
                          <td className="px-4 py-3 text-[#e6e0ff]">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {game.touchControls && <p className="st-muted text-[14px] mt-3"><span className="font-semibold text-[#f5f0ff]">On a phone or tablet:</span> {game.touchControls}</p>}
              </section>
            )}
          </div>

          <div className="space-y-6 min-w-0">
            {!soon && (
              <section className="st-panel p-5 sm:p-6" aria-labelledby="board-h">
                <h2 id="board-h" className="st-h3 mb-3">Top 5 of all time</h2>
                <Leaderboard game={game.slug} highlightUsername={username} limit={5} />
              </section>
            )}
            {!soon && (
              <section aria-labelledby="share-h">
                <h2 id="share-h" className="st-h3 mb-3">Challenge a friend</h2>
                <GameShare name={game.name} slug={game.slug} />
              </section>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <Shelf title="More like this" cols={4}>
              {related.map((g) => <GameCard key={g.slug} game={g} />)}
            </Shelf>
          </div>
        )}
      </main>
    </div>
  );
}
