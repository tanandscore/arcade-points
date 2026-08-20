import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { GAMES, CATEGORIES } from "@/lib/games";

export default async function LandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const freeCount = GAMES.filter((g) => g.free).length;
  const lightColors = ["#3ee6e0", "#ffb703", "#ff3ea5"];

  return (
    <div>
      {/* Marquee header */}
      <div className="relative px-4 py-3 sm:px-6 sm:py-4 border-b border-lineColor bg-bgPanel">
        <div className="flex justify-center gap-2 mb-2">
          {new Array(18).fill(0).map((_, i) => {
            const color = lightColors[i % lightColors.length];
            return (
              <span
                key={i}
                className="ap-marquee-light inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color, color, animationDelay: `${(i % 6) * 0.12}s` }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <span className="font-pixel text-sm text-textLight">TAP & SCORE</span>
          <div className="flex gap-2">
            <Link href="/login" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim">
              Log in
            </Link>
            <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep">
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
        <div className="font-pixel text-[10px] tracking-widest mb-4 text-accentAmber">
          ✦ ✦ ✦ {GAMES.length} GAMES, ONE ACCOUNT ✦ ✦ ✦
        </div>
        <h1
          className="font-pixel text-2xl sm:text-4xl leading-relaxed mb-6 text-textLight"
          style={{ textShadow: "3px 3px 0 #ff3ea5, -1px -1px 0 #3ee6e0" }}
        >
          PLAY. SCORE.
          <br />
          CLIMB THE BOARD.
        </h1>
        <p className="text-textDim max-w-lg mx-auto mb-8">
          {freeCount} free arcade games, real leaderboards, and one account that remembers every
          personal best. Sign up in seconds — no downloads.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="font-pixel text-[10px] px-7 py-3.5 rounded-md bg-accentCyan text-bgDeep"
          >
            PLAY FREE ▸
          </Link>
          <Link
            href="/login"
            className="font-mono text-xs px-6 py-3.5 rounded-md border border-lineColor text-textLight"
          >
            I have an account
          </Link>
        </div>
      </section>

      {/* Game categories teaser */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="font-pixel text-xs text-center mb-8 text-accentCyan">WHAT'S INSIDE</h2>
        {CATEGORIES.map((category) => (
          <div key={category} className="mb-8">
            <h3 className="font-mono text-xs uppercase tracking-widest text-textDim mb-3">{category}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {GAMES.filter((g) => g.category === category).map((game) => (
                <div
                  key={game.slug}
                  className="rounded-lg border border-lineColor p-4 bg-bgPanel flex items-center gap-3"
                >
                  <span className="text-xl">{game.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: game.accentColor }}>
                      {game.name}
                    </p>
                    <p className="text-[11px] text-textDim">{game.free ? "Free" : game.priceDisplay}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Why play */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
            <div className="text-2xl mb-3">🎮</div>
            <h3 className="font-semibold mb-1 text-textLight">Play instantly</h3>
            <p className="text-sm text-textDim">No app to install. Every game runs right in your browser.</p>
          </div>
          <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
            <div className="text-2xl mb-3">🏆</div>
            <h3 className="font-semibold mb-1 text-textLight">Real leaderboards</h3>
            <p className="text-sm text-textDim">Every score counts. See exactly where you rank against everyone else.</p>
          </div>
          <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
            <div className="text-2xl mb-3">🔓</div>
            <h3 className="font-semibold mb-1 text-textLight">One account</h3>
            <p className="text-sm text-textDim">Sign up once. Your points, scores, and progress all live in one place.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <h2 className="font-pixel text-sm mb-4 text-textLight">READY TO PLAY?</h2>
        <Link
          href="/signup"
          className="inline-block font-pixel text-[10px] px-7 py-3.5 rounded-md bg-accentCyan text-bgDeep"
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
