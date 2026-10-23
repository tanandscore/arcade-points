import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";
import GalleryGrid from "@/components/GalleryGrid";
import { getGames } from "@/lib/games";
import { GALLERY } from "@/lib/gallery";

export const metadata = {
  title: "Game Gallery — Legend Pass flagship games",
  alternates: { canonical: "/gallery" },
  description: "See the four Legend Pass flagship games in full resolution: Midnight Burn open-world night racing, Operation Blacksite tactical shooter, Ashtide town builder and Wrath of Olympus strategy.",
  openGraph: {
    title: "Tap & Score Game Gallery — Legend Pass flagship games",
    description: "Real in-game screenshots of Midnight Burn, Operation Blacksite, Ashtide and Wrath of Olympus.",
    images: [{ url: "/gallery/mb-tokyo-neon.jpg", width: 1920, height: 1080, alt: "Midnight Burn — neon Tokyo at night" }],
  },
};

// Deliberately public — no login needed. This is the shop window for the Legend Pass: free players can see exactly what the flagship games look like.
export default async function GalleryPage() {
  const games = await getGames();
  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const price = games.find((g) => g.category === "Legend Pass")?.subscriptionPlanFungiesPriceDisplayMonthly || null;
  const total = GALLERY.reduce((n, s) => n + s.shots.length, 0);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight flex flex-col">
      <MarqueeBar
        rightSlot={
          <div className="flex gap-2">
            <Link href="/pricing" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">Pricing</Link>
            <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md bg-accentCyan text-bgDeep">Sign up</Link>
          </div>
        }
      />

      <header className="relative overflow-hidden border-b border-lineColor">
        <img src="/gallery/mb-tokyo-neon.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-bgDeep/30 via-bgDeep/60 to-bgDeep" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-24 text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-accentMagenta mb-4">Legend Pass · Game Gallery</p>
          <h1 className="font-pixel text-lg sm:text-3xl leading-relaxed mb-5">FULL 3D GAMES,<br />RIGHT IN YOUR BROWSER</h1>
          <p className="text-textLight/90 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-8">
            The free arcade is only the start. These are the four flagship games that come with the Legend Pass — {total} real screenshots, straight from the games. Nothing to download.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/pricing" className="font-pixel text-[10px] sm:text-xs px-6 py-3.5 rounded-md text-bgDeep font-bold" style={{ background: "#ff3ea5" }}>GET LEGEND PASS{price ? ` · ${price}/MO` : ""} ▸</Link>
            <Link href="/signup" className="font-pixel text-[10px] sm:text-xs px-6 py-3.5 rounded-md border border-accentCyan text-accentCyan">CREATE FREE ACCOUNT</Link>
          </div>
          <nav aria-label="Jump to a game" className="flex flex-wrap justify-center gap-2 mt-8">
            {GALLERY.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-lineColor text-textLight/90 hover:bg-bgPanel3 transition-colors">{bySlug[s.slug]?.name || s.slug}</a>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 space-y-20">
        {GALLERY.map((s, idx) => {
          const g = bySlug[s.slug];
          const accent = g?.accentColor || "#ff3ea5";
          return (
            <section key={s.slug} id={s.slug} className="scroll-mt-6">
              <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: accent }}>{s.kicker}</p>
                  <h2 className="font-pixel text-base sm:text-xl mb-3 leading-snug" style={{ color: accent }}>{g?.icon} {g?.name || s.slug}</h2>
                  <p className="text-textLight/90 text-sm sm:text-[15px] leading-relaxed">{s.blurb}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {s.points.map((t) => (
                      <span key={t} className="font-mono text-[10px] px-2.5 py-1 rounded-full border text-textLight bg-white/[0.03]" style={{ borderColor: `${accent}55` }}>{t}</span>
                    ))}
                  </div>
                </div>
                <span className="self-start md:self-end font-mono text-[10px] px-2.5 py-1 rounded-full border bg-black/40 text-textLight shrink-0" style={{ borderColor: `${accent}80` }}>LEGEND PASS</span>
              </div>
              <GalleryGrid shots={s.shots} accent={accent} priority={idx === 0} />
            </section>
          );
        })}

        <section className="rounded-2xl border-2 p-8 sm:p-12 text-center bg-bgPanel" style={{ borderColor: "#ff3ea5" }}>
          <h2 className="font-pixel text-sm sm:text-lg text-accentMagenta mb-4 leading-relaxed">PLAY ALL OF THEM</h2>
          <p className="text-textLight/90 text-sm max-w-xl mx-auto leading-relaxed mb-6">
            One Legend Pass unlocks all four flagship games plus every other Power Pass and Legend game. Best on a laptop or desktop. Cancel anytime.
          </p>
          <Link href="/pricing" className="inline-block font-pixel text-[10px] sm:text-xs px-7 py-3.5 rounded-md text-bgDeep font-bold" style={{ background: "#ff3ea5" }}>SEE LEGEND PASS{price ? ` · ${price}/MO` : ""} ▸</Link>
          <p className="font-mono text-[10px] text-textDim mt-5">Screenshots are taken directly from the games and may look different on your device and graphics settings.</p>
        </section>
      </main>
    </div>
  );
}
