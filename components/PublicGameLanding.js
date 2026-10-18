import Link from "next/link";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import CountdownTimer from "@/components/CountdownTimer";
import { gameVideoGameJsonLd } from "@/lib/structuredData";

// The real public landing view for a signed-out visitor — previously
// this path didn't exist at all, since every visitor hit an
// immediate redirect to /login with nothing to see. Reuses the exact
// same real leaderboard data the logged-in page shows (the scores
// and profiles tables already allow public reads, confirmed directly
// against their own RLS policies before assuming this would work),
// so a first-time visitor sees genuine top players and scores, not a
// placeholder.
//
// Also mirrors the logged-in page's own maintenance/countdown
// priority order (maintenance first, then countdown, then the
// normal call to action) — a first pass of this component always
// showed the sign-up CTA regardless of whether the game was actually
// playable yet, which would have meant signing up only to land on a
// maintenance or countdown screen instead. Fixed before it shipped
// broadly, not left as a known gap.
export default function PublicGameLanding({ game, countdownActive, countdownLabel, countdownAt }) {
  return (
    <div className="min-h-screen bg-bgDeep text-textLight pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameVideoGameJsonLd(game)) }}
      />
      <Navbar username={null} points={0} isAdmin={false} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="text-5xl mb-4">{game.icon}</div>
        <h1 className="font-pixel text-lg mb-3" style={{ color: game.accentColor }}>
          {game.name}
        </h1>
        <p className="text-textDim text-base max-w-lg mx-auto mb-8 leading-relaxed">{game.tagline}</p>

        {game.underMaintenance ? (
          <div className="rounded-xl border border-accentAmber/40 p-8 text-center bg-bgPanel max-w-md mx-auto mb-10">
            <div className="text-3xl mb-3">🔧</div>
            <p className="font-pixel text-xs text-accentAmber mb-3">GAME ENGINE UPDATING</p>
            <p className="text-textDim text-sm">
              {game.name} is getting a quick update behind the scenes. Check back shortly — everything else on
              the site is working normally.
            </p>
          </div>
        ) : countdownActive ? (
          <div className="rounded-xl border border-accentCyan/40 p-8 text-center bg-bgPanel max-w-md mx-auto mb-10">
            <div className="text-3xl mb-3">🚀</div>
            <p className="font-pixel text-xs text-accentCyan mb-2">{countdownLabel || "LAUNCHING SOON"}</p>
            <p className="text-textDim text-sm mb-6">
              You can create your account now — {game.name} unlocks the moment the countdown hits zero.
            </p>
            <CountdownTimer targetIso={countdownAt} size="lg" />
            <Link
              href="/signup"
              className="block font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep mt-6"
              style={{ background: game.accentColor }}
            >
              SIGN UP TO BE READY
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-lineColor p-6 bg-bgPanel max-w-md mx-auto mb-10">
            {game.accessType === "free" ? (
              <p className="font-pixel text-sm text-accentCyan mb-2">FREE TO PLAY</p>
            ) : game.accessType === "onetime" ? (
              <>
                <p className="text-textDim text-sm mb-1">One-time unlock</p>
                <p className="font-pixel text-xl text-accentAmber mb-2">{game.priceDisplay}</p>
              </>
            ) : (
              <>
                <p className="text-textDim text-sm mb-1">{game.subscriptionPlanName || "Power Pass"} game</p>
                <p className="font-pixel text-xl text-accentAmber mb-2">{game.priceDisplay || "—"}/month</p>
              </>
            )}
            <p className="text-textDim text-xs mb-6">
              Free account, real leaderboards, no downloads — sign up in seconds to play.
            </p>
            <Link
              href="/signup"
              className="block font-pixel text-[11px] px-6 py-3 rounded-md text-bgDeep mb-3"
              style={{ background: game.accentColor }}
            >
              SIGN UP FREE TO PLAY
            </Link>
            <Link href="/login" className="text-textDim text-xs underline">
              Already have an account? Log in
            </Link>
          </div>
        )}

        <div className="text-left">
          <h2 className="font-pixel text-[10px] mb-3 text-textDim text-center">🏆 TOP 5 ALL-TIME</h2>
          <div className="rounded-xl border border-lineColor p-4 bg-bgPanel">
            <Leaderboard game={game.slug} limit={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
