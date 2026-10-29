import Navbar from "@/components/Navbar";
import StoreTabs from "@/components/store/StoreTabs";
import BrowseView from "@/components/store/BrowseView";
import { getGames, getComingSoon } from "@/lib/games";
import { getViewer } from "@/lib/viewer";
import { TIERS } from "@/lib/catalog";

export const metadata = {
  title: "Browse games",
  description: "Every game on Tap & Score: free platformers and physics puzzles, Power Pass action games, and four 3D flagships. Play in your browser, no download.",
  alternates: { canonical: "/games" },
};

const TIER_IDS = ["free", "power", "legend"];

// The whole catalogue in one place. Public: nobody needs an account to look around.
export default async function BrowsePage({ searchParams }) {
  const sp = await searchParams;
  const tier = TIER_IDS.includes(sp?.tier) ? sp.tier : null;
  const [v, games, soon] = await Promise.all([getViewer(), getGames(), getComingSoon()]);
  const t = tier ? TIERS[tier] : null;
  const heading = t ? (tier === "free" ? "Free games" : `${t.name} games`) : "All games";
  const blurb = t
    ? tier === "free"
      ? "Play right away. No card, no catch. Each one has levels, stars and a leaderboard."
      : tier === "power"
      ? "Bigger, deeper games with bosses and many levels. Power Pass also includes every Free game."
      : "The four flagship 3D games. Legend Pass also includes every Power Pass and Free game. Laptop or desktop."
    : "Everything on Tap & Score, from quick free games to full 3D flagships.";

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-1 pb-16">
        <StoreTabs active={tier || "all"} home={v.user ? "/dashboard" : "/"} />
        <header className="mt-5 mb-7">
          <h1 className="st-h1" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", color: t ? t.color : undefined }}>{heading}</h1>
          <p className="st-muted mt-2 text-[15.5px] max-w-[62ch]">{blurb}</p>
        </header>
        <BrowseView
          key={tier || "all"}
          games={games.map(lite)}
          soon={soon.map(lite)}
          tier={tier}
          initial={{ q: str(sp?.q), genre: str(sp?.genre), sort: str(sp?.sort) }}
        />
      </main>
    </div>
  );
}

const str = (v) => (typeof v === "string" ? v.slice(0, 60) : "");
// only what a card needs, so the page does not ship every game's long text to the browser
function lite(g) {
  return { slug: g.slug, name: g.name, icon: g.icon, genre: g.genre, style: g.style, tier: g.tier, tierName: g.tierName, status: g.status, isNew: g.isNew, added: g.added, order: g.order, accentColor: g.accentColor, tagline: g.tagline, tags: g.tags, capsule: g.capsule, free: g.free, underMaintenance: g.underMaintenance };
}
