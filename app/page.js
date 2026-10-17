import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getGames, getCategories } from "@/lib/games";
import { getLeaderboardRows } from "@/lib/leaderboard";
import MarqueeBar from "@/components/MarqueeBar";
import ArcadeMusic from "@/components/ArcadeMusic";
import FlagshipBanner from "@/components/FlagshipBanner";
import CountdownTimer from "@/components/CountdownTimer";

const FAQ = [
  ["Is it really free?", "Yes. Creating an account is free and a large part of the library is free to play with no card needed. Premium games are clearly marked with their price on every card."],
  ["Do I need to download anything?", "No. Every game runs in your browser on phone, tablet or computer. The big 3D games work best on a laptop or desktop with a keyboard."],
  ["How do leaderboards work?", "Your best score in each game counts. Scores add up into an overall ranking, and each game also has its own top list you can climb."],
  ["Can I play on my phone?", "Most games are built for touch. The flagship 3D titles are marked 'Desktop only' because they need a keyboard."],
  ["What happens to my progress?", "It is saved to your account, so you can pick up on another device. Career games keep your cash, cars and unlocks."],
];

export default async function LandingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const [games, categories, board, { data: siteSettings }] = await Promise.all([
    getGames(), getCategories(), getLeaderboardRows("overall", 5).catch(() => []),
    supabase.from("site_settings").select("launch_countdown_at, launch_countdown_label").eq("id", 1).maybeSingle(),
  ]);
  const freeCount = games.filter((g) => g.free).length;
  const countdownActive = siteSettings?.launch_countdown_at && new Date(siteSettings.launch_countdown_at) > new Date();
  const CATEGORY_ORDER = { Arcade: 0, "Legend Pass": 1, "Power Pass": 2 };
  const orderedCategories = [...categories].sort((a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99));
  const spotlight = games.filter((g) => g.free).slice(0, 6);
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  return (
    <div className="min-h-screen text-textLight">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <ArcadeMusic />
      <MarqueeBar
        rightSlot={
          <div className="flex items-center gap-1.5">
            <Link href="/leaderboard" className="hidden sm:inline-block text-xs font-medium px-3 py-2 rounded-lg text-textDim hover:text-textLight hover:bg-white/5 transition-colors">Leaderboard</Link>
            <Link href="/tournaments" className="hidden sm:inline-block text-xs font-medium px-3 py-2 rounded-lg text-textDim hover:text-textLight hover:bg-white/5 transition-colors">Tournaments</Link>
            <Link href="/pricing" className="hidden sm:inline-block text-xs font-medium px-3 py-2 rounded-lg text-textDim hover:text-textLight hover:bg-white/5 transition-colors">Pricing</Link>
            <Link href="/login" className="text-xs font-medium px-3 py-2 rounded-lg text-textLight hover:bg-white/5">Log in</Link>
            <Link href="/signup" className="text-xs font-bold px-4 py-2 rounded-lg bg-accentCyan text-ink">Sign up free</Link>
          </div>
        }
      />

      {/* Hero: the pitch on the left, the real scoreboard on the right */}
      <section className="relative overflow-hidden ap-grain">
        <div className="ap-hero-glow" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-24 pb-16 sm:pb-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div>
            {countdownActive && (
              <div className="mb-8 inline-block rounded-2xl ap-glass px-5 py-4">
                <p className="text-xs font-semibold text-accentCyan mb-2">{siteSettings.launch_countdown_label || "Launching soon"}</p>
                <CountdownTimer targetIso={siteSettings.launch_countdown_at} size="lg" />
              </div>
            )}
            <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl lg:text-[4.4rem] leading-[1.02] tracking-tight [text-wrap:balance]">
              Every game has a top score. Go take it.
            </h1>
            <p className="text-textDim text-lg sm:text-xl max-w-xl mt-6 leading-relaxed">
              {games.length} games that run in your browser, from ten-second reflex tests to a full open-world racer. One account, real rankings, nothing to install.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link href="/signup" className="ap-btn ap-btn-primary text-base">Start playing free</Link>
              <Link href="/login" className="ap-btn ap-btn-ghost text-base">I have an account</Link>
            </div>
            <p className="text-sm text-textDim mt-5">{freeCount} games free to play. No card needed to sign up.</p>
          </div>

          <aside aria-label="Top players right now" className="ap-glass rounded-3xl p-5 sm:p-6 shadow-2xl" style={{ boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)" }}>
            {board.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="font-display font-bold text-lg">Top players now</h2>
                  <Link href="/leaderboard" className="text-xs text-accentCyan hover:underline">Full leaderboard</Link>
                </div>
                <ol className="space-y-2">
                  {board.map((r, i) => (
                    <li key={r.userId} className="ap-row-in flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ animationDelay: `${i * 90}ms`, background: i === 0 ? "linear-gradient(90deg, rgba(255,194,51,0.16), rgba(255,194,51,0.03))" : "rgba(255,255,255,0.035)" }}>
                      <span className="w-6 text-center font-mono text-sm" style={{ color: i === 0 ? "#ffc233" : "#a99fd6" }}>{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate font-semibold">{r.username}</span>
                      <span className="font-mono text-sm text-gold">{r.total.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-textDim mt-4">Overall points across every game. Yours could be next.</p>
              </>
            ) : (
              <>
                <h2 className="font-display font-bold text-lg mb-4">Free to play today</h2>
                <ul className="grid grid-cols-2 gap-2.5">
                  {spotlight.map((g) => (
                    <li key={g.slug} className="rounded-xl bg-white/5 px-3 py-3 flex items-center gap-2.5"><span className="text-xl">{g.icon}</span><span className="text-sm font-semibold truncate">{g.name}</span></li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </section>

      {/* Flagships */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="mb-6 max-w-2xl">
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">Console-size games, in a browser tab</h2>
          <p className="text-textDim mt-3 leading-relaxed">Open worlds, real-time strategy and tactical shooters built for the big screen. Sign up to try them.</p>
        </div>
        <FlagshipBanner games={games} bestByGame={{}} />
      </section>

      {/* Library by category */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mb-2">Pick something and play</h2>
        <p className="text-textDim mb-10">Free games are marked on every card. Premium ones show their price.</p>
        {orderedCategories.map((category) => (
          <div key={category} className="mb-12">
            <h3 className="font-display font-bold text-xl mb-4">{category}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {games.filter((g) => g.category === category).map((game) => (
                <Link key={game.slug} href="/signup" className="ap-card p-4 flex items-center gap-3 relative overflow-hidden">
                  <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: game.accentColor }} />
                  <span className="text-2xl shrink-0 ml-1">{game.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{game.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: game.free ? "#3ee6e0" : "#ffc233" }}>{game.free ? "Free" : game.accessType === "subscription" ? `${game.priceDisplay || "Premium"}/mo` : game.priceDisplay}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How it works (a real sequence) */}
      <section className="border-y border-lineColor/50" style={{ background: "rgba(8,4,22,0.4)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mb-10">From sign-up to rank one</h2>
          <ol className="grid md:grid-cols-3 gap-5">
            {[["Make a free account", "Pick a username and you are in. It takes under a minute."], ["Play anything", "Start with a quick game or jump straight into a career. Your best scores save automatically."], ["Climb the board", "Scores turn into points, points turn into a rank, and the top players are shown on the leaderboard."]].map(([t, d], i) => (
              <li key={t} className="ap-card p-6">
                <span className="grid place-items-center w-9 h-9 rounded-full font-mono text-sm text-ink font-bold" style={{ background: ["#3ee6e0", "#ffc233", "#ff3ea5"][i] }}>{i + 1}</span>
                <h3 className="font-display font-bold text-xl mt-4">{t}</h3>
                <p className="text-textDim mt-2 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Free vs premium */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mb-10">Free forever, or go further</h2>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="ap-card p-7">
            <h3 className="font-display font-bold text-2xl">Free</h3>
            <p className="text-textDim mt-1">Everything you need to compete.</p>
            <ul className="mt-5 space-y-2.5 text-[15px]">
              {[`${freeCount} games to play as often as you like`, "Global leaderboards and rank", "Daily challenges and streaks", "Tournaments you can enter"].map((x) => <li key={x} className="flex gap-2.5"><span className="text-accentCyan">✓</span>{x}</li>)}
            </ul>
            <Link href="/signup" className="ap-btn ap-btn-ghost mt-7 w-full">Create free account</Link>
          </div>
          <div className="ap-card p-7 relative overflow-hidden" style={{ borderColor: "rgba(255,194,51,0.45)" }}>
            <span aria-hidden className="absolute -top-20 -right-16 w-60 h-60 rounded-full opacity-25" style={{ background: "radial-gradient(closest-side,#ffc233,transparent)" }} />
            <h3 className="font-display font-bold text-2xl text-gold">Premium</h3>
            <p className="text-textDim mt-1">The big games and the full experience.</p>
            <ul className="mt-5 space-y-2.5 text-[15px]">
              {["Open-world racing, strategy and shooter flagships", "Higher-detail graphics and full careers", "Subscriber perks and premium badge", "New games added as they launch"].map((x) => <li key={x} className="flex gap-2.5"><span className="text-gold">✓</span>{x}</li>)}
            </ul>
            <Link href="/pricing" className="ap-btn mt-7 w-full text-ink" style={{ background: "linear-gradient(180deg,#ffd466,#ffb703)" }}>See pricing</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mb-8">Questions</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="ap-card px-5 py-4 group">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold">{q}<span className="text-accentCyan text-xl transition-transform group-open:rotate-45">+</span></summary>
              <p className="text-textDim mt-3 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing call */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-28 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl px-6 sm:px-14 py-14 text-center ap-grain" style={{ background: "linear-gradient(135deg,#2b1466,#4a1b6d 50%,#1c3a63)" }}>
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight">Your first score takes thirty seconds.</h2>
          <p className="text-textLight/80 mt-4 max-w-lg mx-auto">Join {games.length > 0 ? `${games.length} games` : "the games"} and a leaderboard that is waiting for you.</p>
          <Link href="/signup" className="ap-btn ap-btn-primary text-base mt-8">Create free account</Link>
        </div>
      </section>

      {/* Mobile sticky call to action */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 px-4 pt-3 ap-glass border-x-0 border-b-0" style={{ background: "rgba(15,8,38,0.92)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <Link href="/signup" className="ap-btn ap-btn-primary w-full">Start playing free</Link>
      </div>
    </div>
  );
}
