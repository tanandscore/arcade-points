import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGames, getCategories } from "@/lib/games";
import MarqueeBar from "@/components/MarqueeBar";

export default async function LandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const [games, categories] = await Promise.all([getGames(), getCategories()]);
  const freeCount = games.filter((g) => g.free).length;

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <div className="flex gap-2">
            <Link href="/login" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep font-semibold">
              Sign up
            </Link>
          </div>
        }
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden text-center px-4 sm:px-6 pt-16 sm:pt-24 pb-20"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 60%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="font-pixel text-[10px] sm:text-xs tracking-widest mb-5 text-accentAmber">
            ✦ ✦ ✦ {games.length} GAMES, ONE FREE ACCOUNT ✦ ✦ ✦
          </div>
          <h1
            className="font-pixel text-2xl sm:text-5xl leading-relaxed sm:leading-relaxed mb-6 text-textLight"
            style={{ textShadow: "3px 3px 0 #ff3ea5, -2px -2px 0 #3ee6e0" }}
          >
            PLAY. SCORE.
            <br />
            CLIMB THE BOARD.
          </h1>
          <p className="text-textDim text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            {freeCount} games are completely free to play, worldwide, right now. Real leaderboards,
            one account, no downloads.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="font-pixel text-[11px] px-8 py-4 rounded-md bg-accentCyan text-bgDeep w-full sm:w-auto"
            >
              PLAY FREE ▸
            </Link>
            <Link
              href="/login"
              className="font-mono text-xs px-7 py-4 rounded-md border border-lineColor text-textLight w-full sm:w-auto hover:bg-bgPanel3 transition-colors"
            >
              I have an account
            </Link>
          </div>
          <p className="font-mono text-[11px] text-textDim mt-6">
            No credit card needed to start playing.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-lineColor bg-bgPanel">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-pixel text-lg sm:text-xl text-accentCyan">{games.length}</p>
            <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mt-1">Games</p>
          </div>
          <div>
            <p className="font-pixel text-lg sm:text-xl text-accentAmber">{freeCount}</p>
            <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mt-1">Free</p>
          </div>
          <div>
            <p className="font-pixel text-lg sm:text-xl text-accentMagenta">₹0</p>
            <p className="font-mono text-[10px] text-textDim uppercase tracking-wide mt-1">To join</p>
          </div>
        </div>
      </section>

      {/* Game categories teaser */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="font-pixel text-sm sm:text-base text-center mb-3 text-accentCyan">WHAT'S INSIDE</h2>
        <p className="text-center text-textDim text-sm mb-10">Sign up to unlock every game and start tracking your scores.</p>
        {categories.map((category) => (
          <div key={category} className="mb-10">
            <h3 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">{category}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {games
                .filter((g) => g.category === category)
                .map((game) => (
                  <div
                    key={game.slug}
                    className="rounded-lg border border-lineColor p-4 bg-bgPanel flex items-center gap-3"
                  >
                    <span className="text-xl shrink-0">{game.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: game.accentColor }}>
                        {game.name}
                      </p>
                      <p className="text-[11px] text-textDim">
                        {game.free
                          ? "Free"
                          : game.accessType === "subscription"
                          ? `${game.priceDisplay || "—"}/mo`
                          : game.priceDisplay}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>

      {/* Why play */}
      <section className="bg-bgPanel border-y border-lineColor">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="rounded-xl border border-lineColor p-6 bg-bgPanel3">
              <div className="text-2xl mb-3">🎮</div>
              <h3 className="font-semibold mb-1 text-textLight">Play instantly, anywhere</h3>
              <p className="text-sm text-textDim">No app to install. Every game runs right in your browser, on any device, anywhere in the world.</p>
            </div>
            <div className="rounded-xl border border-lineColor p-6 bg-bgPanel3">
              <div className="text-2xl mb-3">🏆</div>
              <h3 className="font-semibold mb-1 text-textLight">Real leaderboards</h3>
              <p className="text-sm text-textDim">Every score counts. See exactly where you rank against everyone else, per game and overall.</p>
            </div>
            <div className="rounded-xl border border-lineColor p-6 bg-bgPanel3">
              <div className="text-2xl mb-3">🔓</div>
              <h3 className="font-semibold mb-1 text-textLight">One account, everything saved</h3>
              <p className="text-sm text-textDim">Sign up once. Your points, scores, and progress all live in one place, forever.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="font-pixel text-base sm:text-lg mb-4 text-textLight">READY TO PLAY?</h2>
        <p className="text-textDim mb-8">Join free in seconds. No card required for {freeCount} of the {games.length} games.</p>
        <Link
          href="/signup"
          className="inline-block font-pixel text-[11px] px-8 py-4 rounded-md bg-accentCyan text-bgDeep"
        >
          CREATE FREE ACCOUNT ▸
        </Link>
      </section>

      <footer className="border-t border-lineColor py-6 text-center text-[11px] text-textDim font-mono">
        Tap & Score · tapandscore.com
      </footer>
    </div>
  );
}
