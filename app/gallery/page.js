import Link from "next/link";
import Navbar from "@/components/Navbar";
import GalleryGrid from "@/components/GalleryGrid";
import TierBadge from "@/components/store/TierBadge";
import { getGames, getPassPlans } from "@/lib/games";
import { getViewer } from "@/lib/viewer";
import { GALLERY } from "@/lib/gallery";

export const metadata = {
  title: "Game gallery: the Legend Pass flagship games",
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
  const [v, games, plans] = await Promise.all([getViewer(), getGames(), getPassPlans()]);
  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]));
  const price = plans.legend.monthly || null;
  const total = GALLERY.reduce((n, s) => n + s.shots.length, 0);

  return (
    <div className="min-h-screen bg-bgDeep text-textLight flex flex-col">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />

      <header className="relative overflow-hidden border-b border-lineColor">
        <img src="/gallery/mb-tokyo-neon.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-bgDeep/30 via-bgDeep/60 to-bgDeep" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-24 text-center">
          <div className="flex justify-center mb-4"><TierBadge tier="legend" size="lg" /></div>
          <h1 className="st-h1" style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)" }}>Full 3D games, right in your browser</h1>
          <p className="text-[#e6e0ff] text-[15.5px] sm:text-[17px] max-w-2xl mx-auto leading-relaxed mt-4 mb-8">
            These are the four flagship games that come with Legend Pass. {total} real screenshots, straight from the games. Nothing to download.
          </p>
          <div className="flex flex-wrap justify-center gap-3" style={{ "--acc": "#ff3ea5" }}>
            <Link href="/pricing" className="st-btn st-btn-primary">Get Legend Pass{price ? `, ${price} a month` : ""}</Link>
            {!v.user && <Link href="/signup" className="st-btn st-btn-ghost">Create a free account</Link>}
          </div>
          <nav aria-label="Jump to a game" className="flex flex-wrap justify-center gap-2 mt-8">
            {GALLERY.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="st-chip st-chip-btn !h-9 !px-4 !text-[13.5px]">{bySlug[s.slug]?.name || s.slug}</a>
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
                  <p className="text-[14px] font-semibold mb-1.5" style={{ color: accent }}>{s.kicker}</p>
                  <h2 className="st-h1 mb-3" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)" }}>{g?.icon} {g?.name || s.slug}</h2>
                  <p className="text-[#e6e0ff] text-[15px] sm:text-[16px] leading-relaxed">{s.blurb}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {s.points.map((t) => <span key={t} className="st-chip">{t}</span>)}
                  </div>
                  <Link href={`/games/${s.slug}`} className="st-link inline-block mt-4 text-sm">Open the game page</Link>
                </div>
                <TierBadge tier="legend" className="self-start md:self-end shrink-0" />
              </div>
              <GalleryGrid shots={s.shots} accent={accent} priority={idx === 0} />
            </section>
          );
        })}

        <section className="st-panel p-8 sm:p-12 text-center" style={{ boxShadow: "inset 0 0 0 1px rgba(255,62,165,.4)" }}>
          <h2 className="st-h1" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Play all four</h2>
          <p className="text-[#e6e0ff] text-[15.5px] max-w-xl mx-auto leading-relaxed mt-3 mb-6">
            One Legend Pass unlocks all four flagship games, plus every Power Pass and Free game. Best on a laptop or desktop. Cancel any time.
          </p>
          <Link href="/pricing" className="st-btn st-btn-primary" style={{ "--acc": "#ff3ea5" }}>See Legend Pass{price ? `, ${price} a month` : ""}</Link>
          <p className="text-[12.5px] st-muted mt-5">Screenshots are taken directly from the games and may look different on your device and graphics settings.</p>
        </section>
      </main>
    </div>
  );
}
