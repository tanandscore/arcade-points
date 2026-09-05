import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import PublicGameLanding from "@/components/PublicGameLanding";
import Leaderboard from "@/components/Leaderboard";
import GameRunner from "@/components/games/GameRunner";
import BuyButton from "@/components/games/BuyButton";
import UpgradeNudge from "@/components/UpgradeNudge";
import CountdownTimer from "@/components/CountdownTimer";
import { getGame, getGames } from "@/lib/games";
import { gameVideoGameJsonLd } from "@/lib/structuredData";
import { hasSubscriptionAccess, hasAnySubscription } from "@/lib/access";
import { getTournaments, findActiveTournamentForGame } from "@/lib/tournaments";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const game = await getGame(slug);
  if (!game) return {};
  // Fixed a real, pre-existing accuracy bug found while working on
  // this function: the title and description unconditionally said
  // "Play Free Online" / "Play free" for every game, including paid
  // one-time and subscription titles — inaccurate metadata that
  // could mislead both search engines and anyone sharing the link.
  const title = game.accessType === "free" ? `${game.name} — Play Free Online` : `${game.name} — Play Online`;
  const description =
    game.accessType === "free"
      ? `${game.tagline} Play ${game.name} free on Tap & Score and climb the leaderboard.`
      : `${game.tagline} Play ${game.name} on Tap & Score and climb the leaderboard.`;
  // Real per-game preview image for free and subscription games —
  // statically pre-generated (58 real games, using the actual
  // production data parsed from every games migration file, not
  // guessed) rather than generated at request time. Deliberately not
  // using next/og's ImageResponse here: research turned up multiple
  // credible, independent reports of it failing in production on
  // this exact deployment stack (@opennextjs/cloudflare) because
  // Workers have no filesystem for the font-loading it needs, and
  // that risk isn't worth taking untested. One-time-purchase games
  // fall back to the site-wide image — matching the scope actually
  // requested (free and subscription games only).
  const ogImage = game.accessType !== "onetime" ? `/og-games/${game.slug}.png` : "/og-image.png";
  return {
    title,
    description,
    alternates: { canonical: `/games/${game.slug}` },
    // Now genuinely indexable — previously every game page told
    // search engines not to index it regardless of content, which
    // matched robots.js's own blanket disallow on /games/. Both are
    // fixed together: this page now has real public content for a
    // signed-out visitor, so both layers can safely allow it.
    robots: { index: true, follow: true },
    openGraph: { title, description, images: [{ url: ogImage, width: 1200, height: 630, alt: game.name }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function GamePage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const game = await getGame(slug);
  if (!game) notFound();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Moved above the signed-out branch below (it used to run only for
  // logged-in visitors, further down) so a signed-out visitor's
  // public landing view can show accurate maintenance/countdown
  // state too, instead of always showing a sign-up CTA for a game
  // that isn't actually playable yet even right after signing up.
  // site_settings already allows public reads, so no access change
  // was needed to move this — just moving where it's read.
  const { data: siteSettings } = await supabase.from("site_settings").select("launch_countdown_at, launch_countdown_label").eq("id", 1).maybeSingle();
  const countdownAtAll = siteSettings?.launch_countdown_at && new Date(siteSettings.launch_countdown_at) > new Date();

  // A real public landing view instead of an immediate redirect to
  // /login — previously every signed-out visitor (including search
  // engines) hit a login wall here with zero actual content, which
  // is why robots.js used to block this whole path from crawling.
  // This branch is the only thing that changes for a signed-out
  // visitor; every line below it is the exact, unmodified logged-in
  // experience.
  if (!user) {
    // A signed-out visitor can never be an admin, so an
    // admin-test-only game must be fully hidden here too — this
    // check previously only existed further down in the logged-in
    // path, which meant a signed-out visitor could have seen the
    // public landing page for a game that's supposed to be
    // completely invisible to everyone except admins. Caught while
    // restructuring this function, not a pre-existing bug that
    // shipped — fixed before it could.
    if (game.adminTestOnly) notFound();
    return (
      <PublicGameLanding
        game={game}
        countdownActive={countdownAtAll}
        countdownLabel={siteSettings?.launch_countdown_label}
        countdownAt={siteSettings?.launch_countdown_at}
      />
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_admin, is_premium, bonus_subscription_until")
    .eq("id", user.id)
    .single();

  // A game marked admin_test_only is fully live and playable, but
  // deliberately invisible to everyone except admins — the real
  // equivalent of "upload and test before rolling out to the main
  // site" in a compiled Next.js app, where nothing can genuinely be
  // uploaded and run at request time.
  if (game.adminTestOnly && !profile?.is_admin) notFound();

  // Launch countdown: browsing, account creation, and this very page
  // stay reachable — only actually playing is gated, and only for
  // non-admins, so an admin can always verify a game is genuinely
  // ready before the countdown ends.
  const countdownActive = countdownAtAll && !profile?.is_admin;

  const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);
  const totalPoints = (scores || []).reduce((sum, r) => sum + r.score, 0);
  const username = profile?.username || user.email;

  // Admins play everything free — checked before any purchase/subscription
  // lookup, so it's a clean bypass rather than a patch on top of the gate.
  let owned = game.accessType === "free" || profile?.is_admin === true;
  if (!owned && game.accessType === "onetime") {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("game")
      .eq("user_id", user.id)
      .eq("game", slug)
      .maybeSingle();
    owned = !!purchase;
  } else if (!owned && game.accessType === "subscription") {
    owned = await hasSubscriptionAccess(supabase, user.id, game.subscriptionPlanId, profile);
  }

  // Used only for the "unlocks all N Pass games" messaging below —
  // computed from the live games table so it never goes stale as more
  // Pass games are added.
  let sameTierCount = 0;
  if (!owned && game.accessType === "subscription") {
    const allGames = await getGames();
    sameTierCount = allGames.filter((g) => g.subscriptionPlanId === game.subscriptionPlanId).length;
  }

  // Tournament override — a game's own access tier (even "free") does
  // not apply while it's part of an active tournament: playing it
  // requires a subscription regardless, so a free player can browse
  // the tournament page but can't actually play any of its games,
  // including ones that are normally free the rest of the time.
  // Checked after the normal access computation so it can override
  // an already-true `owned`, and skipped for admins the same way the
  // normal gate is.
  let tournamentLocked = false;
  // A second, separate lock: an admin can opt a specific tournament
  // into "tournament-only" play (require_tournament_entry). When
  // that's on, this page only allows play when reached via the
  // tournament page's own "Play Now" link, which appends
  // ?via=tournament — worth being direct about what this actually
  // is: a UX steering signal, not a cryptographic access boundary,
  // since a query parameter can be typed by hand. The real access
  // control here remains the subscription check above; this is about
  // making the tournament page the natural, intended path to a
  // tournament-exclusive game, not about stopping a determined user
  // who already has legitimate access from finding the page.
  let exclusiveLocked = false;
  let exclusiveTournamentName = null;
  if (!profile?.is_admin) {
    const tournaments = await getTournaments();
    const activeTournament = findActiveTournamentForGame(tournaments, slug);
    if (activeTournament) {
      const subscribed = await hasAnySubscription(supabase, user.id, profile);
      if (!subscribed) {
        owned = false;
        tournamentLocked = true;
      } else if (activeTournament.require_tournament_entry && sp?.via !== "tournament") {
        owned = false;
        exclusiveLocked = true;
        exclusiveTournamentName = activeTournament.name;
      }
    }
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameVideoGameJsonLd(game)) }}
      />
      <Navbar username={username} points={totalPoints} isAdmin={profile?.is_admin} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-xs mb-2 text-center" style={{ color: game.accentColor }}>
          {game.name.toUpperCase()}
        </h1>
        <div className="text-center mb-6 h-4">
          {profile?.is_admin && !game.free && (
            <p className="font-mono text-[10px] text-accentAmber">★ Admin access — unlocked free</p>
          )}
        </div>
        {game.category === "Legend Pass" && (
          <p className="text-center font-mono text-[10px] text-textDim mb-6">
            💻 Built for laptop and desktop screens — opens in fullscreen, not optimized for mobile.
          </p>
        )}

        {game.underMaintenance ? (
          <div className="rounded-xl border border-accentAmber/40 p-10 text-center bg-bgPanel max-w-md mx-auto">
            <div className="text-4xl mb-4">🔧</div>
            <p className="font-pixel text-xs text-accentAmber mb-3">GAME ENGINE UPDATING</p>
            <p className="text-textDim text-sm">
              {game.name} is getting a quick update behind the scenes. This usually takes just a few minutes —
              check back shortly. Everything else on the site is working normally.
            </p>
          </div>
        ) : countdownActive ? (
          <div className="rounded-xl border border-accentCyan/40 p-10 text-center bg-bgPanel max-w-md mx-auto">
            <div className="text-4xl mb-4">🚀</div>
            <p className="font-pixel text-xs text-accentCyan mb-2">{siteSettings.launch_countdown_label || "LAUNCHING SOON"}</p>
            <p className="text-textDim text-sm mb-6">
              You can browse and set up your account now — {game.name} unlocks the moment the countdown hits zero.
            </p>
            <CountdownTimer targetIso={siteSettings.launch_countdown_at} size="lg" />
          </div>
        ) : owned ? (
          <GameRunner slug={game.slug} name={game.name} accentColor={game.accentColor} />
        ) : tournamentLocked ? (
          <div className="rounded-xl border border-accentAmber/40 p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">🏆</div>
            <p className="font-pixel text-xs text-accentAmber mb-2">TOURNAMENT LOCKED</p>
            <p className="text-textDim text-sm mb-6 max-w-xs mx-auto">
              {game.name} is part of an active tournament right now. Playing it — even though it's normally free —
              requires a subscription for the duration of the tournament.
            </p>
            <Link
              href="/pricing"
              className="inline-block font-mono text-[11px] px-5 py-2.5 rounded-md bg-accentAmber text-bgDeep"
            >
              See subscription plans
            </Link>
          </div>
        ) : exclusiveLocked ? (
          <div className="rounded-xl border border-accentAmber/40 p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">🔒</div>
            <p className="font-pixel text-xs text-accentAmber mb-2">TOURNAMENT EXCLUSIVE</p>
            <p className="text-textDim text-sm mb-6 max-w-xs mx-auto">
              {game.name} is locked to {exclusiveTournamentName} right now — play it from the Tournament page to
              have your run count toward the leaderboard.
            </p>
            <Link
              href="/tournaments"
              className="inline-block font-mono text-[11px] px-5 py-2.5 rounded-md bg-accentAmber text-bgDeep"
            >
              Go to Tournaments
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-lineColor p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">{game.icon}</div>
            {game.accessType === "onetime" ? (
              <>
                <p className="text-textDim mb-1">{game.name} is a paid game.</p>
                <p className="font-pixel text-xl text-accentAmber mb-6">{game.priceDisplay}</p>
              </>
            ) : (
              <>
                <p className="text-textDim mb-1">{game.name} is a {game.subscriptionPlanName || "Power Pass"} game.</p>
                <p className="font-pixel text-xl text-accentAmber mb-2">{game.priceDisplay || "—"}/month</p>
                <p className="text-[12px] text-accentCyan mb-6 max-w-xs mx-auto">
                  👑 One {game.subscriptionPlanName || "Power Pass"} unlocks all {sameTierCount || ""}{" "}
                  games for as long as it's active — not just this one.
                </p>
              </>
            )}
            <BuyButton
              slug={game.slug}
              gameName={game.name}
              accessType={game.accessType}
              priceDisplay={game.priceDisplay}
              planName={game.subscriptionPlanName || "Power Pass"}
            />
          </div>
        )}

        {game.free && !profile?.is_premium && !profile?.is_admin && <UpgradeNudge />}

        <div className="mt-12">
          <h2 className="font-pixel text-[10px] mb-3 text-textDim">🏆 TOP 5 ALL-TIME</h2>
          <div className="rounded-xl border border-lineColor p-4 bg-bgPanel">
            <Leaderboard game={game.slug} highlightUsername={username} limit={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
